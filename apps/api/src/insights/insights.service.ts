import { Injectable } from '@nestjs/common';
import type { ActivityAction } from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const DAY = 86_400_000;
const CFD_DAYS = 45;
const THROUGHPUT_WEEKS = 8;
const FORECAST_WINDOW_DAYS = 60;
const FORECAST_TRIALS = 5000;
const MIN_BASELINE_SAMPLES = 3;

type StageMeta = { id: string; name: string; position: number; isInitial: boolean; isFinal: boolean };
type Segment = { stageId: string; enteredAt: number; leftAt: number | null };
type TicketModel = {
  id: string;
  title: string;
  createdAt: number;
  assigneeIds: string[];
  segments: Segment[];
  completedAt: number | null;
};
type Baseline = { p50: number; p90: number; avg: number; count: number };
type AgingItem = {
  ticketId: string;
  title: string;
  stageId: string;
  stageName: string;
  ageMs: number;
  p90Ms: number;
  overByMs: number;
  assigneeIds: string[];
};
type FlowModel = {
  stages: StageMeta[];
  stageById: Map<string, StageMeta>;
  finalStageIds: Set<string>;
  ticketModels: TicketModel[];
  baselines: Map<string, Baseline>;
  aging: AgingItem[];
  now: number;
};

@Injectable()
export class InsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private percentile(sorted: number[], p: number): number {
    if (!sorted.length) return 0;
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[idx];
  }

  private async buildModel(teamId: string): Promise<FlowModel | null> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { teamId },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
    const stages: StageMeta[] = (workflow?.stages ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      position: s.position,
      isInitial: s.isInitial,
      isFinal: s.isFinal,
    }));
    if (!stages.length) return null;

    const stageById = new Map(stages.map((s) => [s.id, s]));
    const initialStage = stages.find((s) => s.isInitial) ?? stages[0];
    const flagged = stages.filter((s) => s.isFinal);
    const finalStageIds = new Set(
      flagged.length ? flagged.map((s) => s.id) : [stages[stages.length - 1].id],
    );

    const tickets = await this.prisma.ticket.findMany({
      where: { teamId },
      select: {
        id: true,
        title: true,
        createdAt: true,
        stageId: true,
        assignees: { select: { userId: true } },
      },
    });
    const ticketIds = tickets.map((t) => t.id);

    const logs = ticketIds.length
      ? await this.prisma.activityLog.findMany({
          where: {
            ticketId: { in: ticketIds },
            action: { in: ['ticket_created', 'stage_changed'] as ActivityAction[] },
          },
          orderBy: { createdAt: 'asc' },
          select: { ticketId: true, action: true, payload: true, createdAt: true },
        })
      : [];

    const logsByTicket = new Map<string, typeof logs>();
    for (const l of logs) {
      const arr = logsByTicket.get(l.ticketId) ?? [];
      arr.push(l);
      logsByTicket.set(l.ticketId, arr);
    }

    const now = Date.now();
    const ticketModels: TicketModel[] = tickets.map((t) => {
      const tLogs = logsByTicket.get(t.id) ?? [];
      const firstMove = tLogs.find((l) => l.action === 'stage_changed');
      const firstFrom = (firstMove?.payload as { fromStageId?: string } | null)?.fromStageId;
      const segments: Segment[] = [];
      let curStage = typeof firstFrom === 'string' && firstFrom ? firstFrom : initialStage.id;
      let enteredAt = t.createdAt.getTime();
      for (const l of tLogs) {
        if (l.action !== 'stage_changed') continue;
        const payload = (l.payload ?? {}) as { toStageId?: string };
        const at = l.createdAt.getTime();
        segments.push({ stageId: curStage, enteredAt, leftAt: at });
        curStage = payload.toStageId ?? curStage;
        enteredAt = at;
      }
      segments.push({ stageId: curStage, enteredAt, leftAt: null });
      return {
        id: t.id,
        title: t.title,
        createdAt: t.createdAt.getTime(),
        assigneeIds: t.assignees.map((a) => a.userId),
        segments,
        completedAt: finalStageIds.has(curStage) ? enteredAt : null,
      };
    });

    const durationsByStage = new Map<string, number[]>();
    for (const tm of ticketModels) {
      for (const seg of tm.segments) {
        if (seg.leftAt === null) continue;
        const arr = durationsByStage.get(seg.stageId) ?? [];
        arr.push(seg.leftAt - seg.enteredAt);
        durationsByStage.set(seg.stageId, arr);
      }
    }
    const baselines = new Map<string, Baseline>();
    for (const s of stages) {
      const arr = (durationsByStage.get(s.id) ?? []).slice().sort((a, b) => a - b);
      baselines.set(s.id, {
        p50: this.percentile(arr, 50),
        p90: this.percentile(arr, 90),
        avg: arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : 0,
        count: arr.length,
      });
    }

    const aging: AgingItem[] = [];
    for (const tm of ticketModels) {
      const open = tm.segments[tm.segments.length - 1];
      if (open.leftAt !== null) continue;
      const stage = stageById.get(open.stageId);
      if (!stage || finalStageIds.has(stage.id)) continue;
      const base = baselines.get(open.stageId);
      if (!base || base.count < MIN_BASELINE_SAMPLES || base.p90 <= 0) continue;
      const age = now - open.enteredAt;
      if (age <= base.p90) continue;
      aging.push({
        ticketId: tm.id,
        title: tm.title,
        stageId: stage.id,
        stageName: stage.name,
        ageMs: age,
        p90Ms: base.p90,
        overByMs: age - base.p90,
        assigneeIds: tm.assigneeIds,
      });
    }
    aging.sort((a, b) => b.overByMs - a.overByMs);

    return {
      stages,
      stageById,
      finalStageIds,
      ticketModels,
      baselines,
      aging,
      now,
    };
  }

  private forecast(completed: TicketModel[], wipTotal: number, now: number) {
    const daily = new Array(FORECAST_WINDOW_DAYS).fill(0);
    for (const tm of completed) {
      if (tm.completedAt === null) continue;
      const daysAgo = Math.floor((now - tm.completedAt) / DAY);
      if (daysAgo >= 0 && daysAgo < FORECAST_WINDOW_DAYS) daily[FORECAST_WINDOW_DAYS - 1 - daysAgo]++;
    }
    const totalCompleted = daily.reduce((a, b) => a + b, 0);
    if (totalCompleted < 5 || wipTotal === 0) return null;

    const results: number[] = [];
    for (let t = 0; t < FORECAST_TRIALS; t++) {
      let remaining = wipTotal;
      let days = 0;
      while (remaining > 0 && days < 365) {
        remaining -= daily[Math.floor(Math.random() * daily.length)];
        days++;
      }
      results.push(days);
    }
    results.sort((a, b) => a - b);
    const pday = (p: number) => this.percentile(results, p);
    const mkDate = (d: number) => new Date(now + d * DAY).toISOString();
    return {
      backlog: wipTotal,
      p50Days: pday(50),
      p85Days: pday(85),
      p95Days: pday(95),
      p50Date: mkDate(pday(50)),
      p85Date: mkDate(pday(85)),
      p95Date: mkDate(pday(95)),
    };
  }

  async getForTeam(teamId: string) {
    const m = await this.buildModel(teamId);
    if (!m) return { hasWorkflow: false as const };

    const { stages, stageById, finalStageIds, ticketModels, baselines, aging, now } = m;

    const wipByStage = new Map<string, number>();
    for (const s of stages) wipByStage.set(s.id, 0);
    let wipTotal = 0;
    for (const tm of ticketModels) {
      const open = tm.segments[tm.segments.length - 1];
      wipByStage.set(open.stageId, (wipByStage.get(open.stageId) ?? 0) + 1);
      if (!finalStageIds.has(open.stageId)) wipTotal++;
    }

    const completed = ticketModels.filter((tm) => tm.completedAt !== null);
    const leadTimes = completed
      .map((tm) => tm.completedAt! - tm.createdAt)
      .sort((a, b) => a - b);
    const cycleTimes = completed
      .map((tm) => tm.completedAt! - (tm.segments[0]?.leftAt ?? tm.createdAt))
      .filter((v) => v >= 0)
      .sort((a, b) => a - b);

    let activeMs = 0;
    let totalMs = 0;
    for (const tm of completed) {
      for (const seg of tm.segments) {
        if (seg.leftAt === null) continue;
        const st = stageById.get(seg.stageId);
        if (st && !st.isInitial && !finalStageIds.has(st.id)) activeMs += seg.leftAt - seg.enteredAt;
      }
      totalMs += tm.completedAt! - tm.createdAt;
    }
    const flowEfficiencyPct = totalMs > 0 ? Math.round((activeMs / totalMs) * 100) : 0;

    const weekCounts = new Array(THROUGHPUT_WEEKS).fill(0);
    for (const tm of completed) {
      const weeksAgo = Math.floor((now - tm.completedAt!) / (7 * DAY));
      if (weeksAgo >= 0 && weeksAgo < THROUGHPUT_WEEKS) weekCounts[THROUGHPUT_WEEKS - 1 - weeksAgo]++;
    }
    const throughput = weekCounts.map((count, i) => ({
      weekStart: new Date(now - (THROUGHPUT_WEEKS - 1 - i) * 7 * DAY).toISOString(),
      count,
    }));
    const throughputPerWeek =
      Math.round((weekCounts.reduce((a, b) => a + b, 0) / THROUGHPUT_WEEKS) * 10) / 10;

    const cfd: { date: string; counts: Record<string, number> }[] = [];
    for (let i = CFD_DAYS - 1; i >= 0; i--) {
      const dayEnd = now - i * DAY;
      const counts: Record<string, number> = {};
      for (const s of stages) counts[s.id] = 0;
      for (const tm of ticketModels) {
        if (tm.createdAt > dayEnd) continue;
        let stageId = tm.segments[tm.segments.length - 1].stageId;
        for (const seg of tm.segments) {
          if (seg.enteredAt <= dayEnd && (seg.leftAt === null || seg.leftAt > dayEnd)) {
            stageId = seg.stageId;
            break;
          }
        }
        counts[stageId] = (counts[stageId] ?? 0) + 1;
      }
      cfd.push({ date: new Date(dayEnd).toISOString(), counts });
    }

    const perStage = stages.map((s) => {
      const b = baselines.get(s.id)!;
      return {
        stageId: s.id,
        name: s.name,
        position: s.position,
        isInitial: s.isInitial,
        isTerminal: finalStageIds.has(s.id),
        p50Ms: b.p50,
        p90Ms: b.p90,
        avgMs: b.avg,
        sampleCount: b.count,
        wip: wipByStage.get(s.id) ?? 0,
      };
    });

    const candidates = perStage.filter(
      (s) => !s.isInitial && !s.isTerminal && s.sampleCount >= MIN_BASELINE_SAMPLES,
    );
    const bottleneck = candidates.length
      ? candidates.reduce((a, b) => (b.p90Ms > a.p90Ms ? b : a))
      : null;

    return {
      hasWorkflow: true as const,
      generatedAt: new Date(now).toISOString(),
      kpis: {
        wip: wipTotal,
        throughputPerWeek,
        completedCount: completed.length,
        leadTimeP50Ms: this.percentile(leadTimes, 50),
        leadTimeP90Ms: this.percentile(leadTimes, 90),
        cycleTimeP50Ms: this.percentile(cycleTimes, 50),
        cycleTimeP90Ms: this.percentile(cycleTimes, 90),
        flowEfficiencyPct,
      },
      stages: stages.map((s) => ({ id: s.id, name: s.name, position: s.position })),
      perStage,
      bottleneck: bottleneck
        ? { stageId: bottleneck.stageId, name: bottleneck.name, p90Ms: bottleneck.p90Ms }
        : null,
      aging: aging.slice(0, 20),
      throughput,
      cfd,
      forecast: this.forecast(completed, wipTotal, now),
    };
  }

  async scanAgingForTeam(teamId: string) {
    const m = await this.buildModel(teamId);
    if (!m) return;
    const since = new Date(Date.now() - DAY);
    for (const a of m.aging) {
      const existing = await this.prisma.notification.findFirst({
        where: { ticketId: a.ticketId, kind: 'aging', createdAt: { gt: since } },
      });
      if (existing) continue;
      await this.notifications.notifyWatchers(a.ticketId, 'system', 'aging', {
        ticketTitle: a.title,
        stageName: a.stageName,
        p90Ms: a.p90Ms,
        overByMs: a.overByMs,
      });
    }
  }

  async scanAll() {
    const teams = await this.prisma.team.findMany({ select: { id: true } });
    for (const t of teams) {
      try {
        await this.scanAgingForTeam(t.id);
      } catch {
        // a single team's failure should not abort the sweep
      }
    }
  }
}
