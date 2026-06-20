'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppHeader } from '@/components/app-header';
import { AuroraBackground } from '@/components/aurora-background';
import {
  CumulativeFlowChart,
  StageTimeBars,
  ThroughputBars,
  formatDuration,
  stageColor,
} from '@/components/insights/flow-charts';
import { GlassCard } from '@/components/ui/glass-card';
import { insightsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useSocket } from '@/lib/socket-context';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <GlassCard className="p-4">
      <p className="text-[11px] uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-0.5 h-4 text-xs text-white/40">{sub ?? ''}</p>
    </GlassCard>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {hint && <span className="text-xs text-white/35">{hint}</span>}
    </div>
  );
}

export default function InsightsPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['insights', id],
    queryFn: () => insightsApi.get(id),
    enabled: !!user && !!id,
  });

  useEffect(() => {
    if (!socket || !id) return;
    socket.emit('board:join', { teamId: id });
    const refetch = () => qc.invalidateQueries({ queryKey: ['insights', id] });
    socket.on('ticket:created', refetch);
    socket.on('ticket:moved', refetch);
    socket.on('ticket:updated', refetch);
    return () => {
      socket.emit('board:leave', { teamId: id });
      socket.off('ticket:created', refetch);
      socket.off('ticket:moved', refetch);
      socket.off('ticket:updated', refetch);
    };
  }, [socket, id, qc]);

  if (loading || !user) {
    return (
      <main className="relative flex min-h-screen items-center justify-center">
        <AuroraBackground />
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
      </main>
    );
  }

  const kpis = data?.kpis;
  const stages = data?.stages ?? [];
  const orderedStages = [...stages].sort((a, b) => a.position - b.position);

  return (
    <div className="relative min-h-screen">
      <AuroraBackground />
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link
          href={`/teams/${id}`}
          className="text-sm text-white/50 transition-colors hover:text-white/80"
        >
          &larr; Back to board
        </Link>
        <h1 className="mb-1 mt-3 text-2xl font-semibold tracking-tight text-white">Flow insights</h1>
        <p className="mb-8 text-sm text-white/50">
          Live analytics computed from your activity stream — how work actually flows, stalls, and
          when it&apos;ll be done.
        </p>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
          </div>
        ) : error ? (
          <GlassCard className="p-6">
            <p className="text-sm text-red-300">
              {error instanceof Error ? error.message : 'Failed to load insights.'}
            </p>
          </GlassCard>
        ) : !data?.hasWorkflow ? (
          <GlassCard className="p-8 text-center">
            <p className="text-white/70">No workflow yet.</p>
            <p className="mt-1 text-sm text-white/40">
              Create tickets and move them through stages — flow data appears here automatically.
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Kpi label="In progress" value={String(kpis?.wip ?? 0)} sub="open tickets" />
              <Kpi
                label="Throughput"
                value={String(kpis?.throughputPerWeek ?? 0)}
                sub="per week"
              />
              <Kpi
                label="Cycle time"
                value={formatDuration(kpis?.cycleTimeP50Ms ?? 0)}
                sub={`p90 ${formatDuration(kpis?.cycleTimeP90Ms ?? 0)}`}
              />
              <Kpi
                label="Lead time"
                value={formatDuration(kpis?.leadTimeP50Ms ?? 0)}
                sub={`p90 ${formatDuration(kpis?.leadTimeP90Ms ?? 0)}`}
              />
              <Kpi
                label="Flow efficiency"
                value={`${kpis?.flowEfficiencyPct ?? 0}%`}
                sub="active ÷ total"
              />
              <Kpi label="Completed" value={String(kpis?.completedCount ?? 0)} sub="all time" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <GlassCard className="p-5">
                <SectionTitle title="Bottleneck" hint="slowest stage by p90" />
                {data.bottleneck ? (
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-lg">
                      🐢
                    </span>
                    <div>
                      <p className="text-lg font-semibold text-white">{data.bottleneck.name}</p>
                      <p className="text-sm text-white/50">
                        p90 time in stage: {formatDuration(data.bottleneck.p90Ms)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-white/40">
                    Not enough data to identify a bottleneck yet.
                  </p>
                )}
              </GlassCard>

              <GlassCard className="p-5">
                <SectionTitle title="Delivery forecast" hint="Monte Carlo · 5k runs" />
                {data.forecast ? (
                  <div>
                    <p className="text-sm text-white/50">
                      Finishing the {data.forecast.backlog} open tickets:
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {[
                        { p: '50%', days: data.forecast.p50Days, date: data.forecast.p50Date },
                        { p: '85%', days: data.forecast.p85Days, date: data.forecast.p85Date },
                        { p: '95%', days: data.forecast.p95Days, date: data.forecast.p95Date },
                      ].map((row) => (
                        <div key={row.p} className="flex items-center justify-between text-sm">
                          <span className="text-white/50">{row.p} confidence</span>
                          <span className="font-medium text-white">
                            by {fmtDate(row.date)}{' '}
                            <span className="text-white/40">({row.days}d)</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-white/40">
                    Not enough completed tickets to forecast yet.
                  </p>
                )}
              </GlassCard>
            </div>

            <GlassCard className="p-5">
              <SectionTitle title="Cumulative flow" hint="last 45 days" />
              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {orderedStages.map((s, i) => (
                  <span key={s.id} className="flex items-center gap-1.5 text-xs text-white/55">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: stageColor(i) }}
                    />
                    {s.name}
                  </span>
                ))}
              </div>
              <CumulativeFlowChart cfd={data.cfd ?? []} stages={stages} />
            </GlassCard>

            <div className="grid gap-4 lg:grid-cols-2">
              <GlassCard className="p-5">
                <SectionTitle title="Time in stage" hint="bright = p50 · faded = p90" />
                <StageTimeBars
                  perStage={data.perStage ?? []}
                  bottleneckStageId={data.bottleneck?.stageId}
                />
              </GlassCard>
              <GlassCard className="p-5">
                <SectionTitle title="Weekly throughput" hint="tickets completed" />
                <ThroughputBars throughput={data.throughput ?? []} />
              </GlassCard>
            </div>

            <GlassCard className="p-5">
              <SectionTitle title="Aging work in progress" hint="past the stage p90 baseline" />
              {data.aging && data.aging.length > 0 ? (
                <ul className="space-y-2">
                  {data.aging.map((a) => (
                    <li key={a.ticketId}>
                      <Link
                        href={`/teams/${id}?ticket=${a.ticketId}`}
                        className="flex items-center gap-3 rounded-lg border border-amber-300/15 bg-amber-300/[0.04] px-3 py-2.5 transition-colors hover:bg-amber-300/[0.08]"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-sm">
                          ⏳
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-white/90">{a.title}</p>
                          <p className="text-xs text-white/40">
                            in {a.stageName} · {formatDuration(a.ageMs)} old
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-amber-300/80">
                          +{formatDuration(a.overByMs)} over
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-white/40">
                  Nothing is aging past its baseline. Flow is healthy. ✨
                </p>
              )}
            </GlassCard>
          </div>
        )}
      </main>
    </div>
  );
}
