import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import type { PrismaClient } from '../generated/prisma/client';

export const DEMO_EMAIL = 'demo@kanflow.dev';
export const DEMO_PASSWORD = 'demo12345';

const HOUR = 3_600_000;
const DAY = 86_400_000;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const chance = (p: number) => Math.random() < p;
const shuffle = <T>(arr: T[]): T[] =>
  arr
    .map((v) => [Math.random(), v] as const)
    .sort((a, b) => a[0] - b[0])
    .map((x) => x[1]);
const pickSome = <T>(arr: T[], k: number): T[] => shuffle(arr).slice(0, k);

const TITLES = [
  'Fix flaky login redirect on Safari',
  'Add dark mode toggle to settings',
  'Optimize board query (N+1 on assignees)',
  'Implement CSV export for tickets',
  'Add rate limiting to auth endpoints',
  'Fix websocket reconnect storm',
  'Cache team members in memory',
  'Add audit log view for admins',
  'Improve empty states across the app',
  'Fix timezone drift in weekly reports',
  'Add bulk assign on the board',
  'Harden presigned upload validation',
  'Add Google SSO',
  'Fix memory leak in notification worker',
  'Paginate the notifications feed',
  'Add outbound webhooks',
  'Throttle the global search input',
  'Reduce first-load JS bundle size',
  'Add keyboard shortcuts to the board',
  'Migrate CI to GitHub Actions',
  'Write E2E tests for ticket flow',
  'Add Sentry error monitoring',
  'Support sub-tickets / checklists',
  'Fix drag ghost offset in Firefox',
  'Add per-stage WIP limits',
  'Make the modal fully keyboard-navigable',
  'Add @mentions in comments',
  'Compress avatars on upload',
  'Add a "blocked" flag to tickets',
  'Fix double-fire on optimistic move',
  'Add team-level activity digest email',
  'Index activity_log by ticket + created_at',
];

const DESCRIPTIONS = [
  'Reported by several users this week — needs a repro and a fix before the next release.',
  'Tech-debt cleanup that unblocks faster iteration later.',
  'Customer-requested. Scope it small and ship behind a flag.',
  'Performance work — measure before and after.',
  'Part of the Q3 reliability push.',
  'Nice-to-have polish; pick up if there is slack this sprint.',
  'Security-sensitive — get a second review before merge.',
  'Blocked on design sign-off, then it is mostly front-end.',
];

const COMMENTS = [
  'On it — should have a PR up today.',
  'Blocked on design, pinged the team.',
  'Reproduced locally, fix incoming.',
  'PR is up for review 🙏',
  'LGTM 🚀',
  'Needs more tests before we merge.',
  'Pushed a fix, please re-check.',
  'Can we get this into the next release?',
  'Left a couple of comments on the PR.',
  'Confirmed fixed in staging.',
  'Reverted — it broke the board for viewers.',
  'Splitting this into two smaller tickets.',
];

type SeedUser = { name: string; email: string; role: string; id: string };

function dwellMs(stageIdx: number): number {
  switch (stageIdx) {
    case 0:
      return (chance(0.25) ? rand(72, 240) : rand(8, 72)) * HOUR;
    case 1:
      return rand(2, 24) * HOUR;
    case 2:
      return (chance(0.2) ? rand(120, 240) : rand(24, 120)) * HOUR;
    case 3:
      return (chance(0.3) ? rand(48, 168) : rand(6, 36)) * HOUR;
    default:
      return 0;
  }
}

export async function seedDemo(prisma: PrismaClient) {
  const now = Date.now();

  const userDefs = [
    { name: 'Priya Sharma', email: DEMO_EMAIL, role: 'admin' },
    { name: 'Arjun Mehta', email: 'arjun@kanflow.dev', role: 'manager' },
    { name: 'Sara Khan', email: 'sara@kanflow.dev', role: 'member' },
    { name: 'Dev Patel', email: 'dev@kanflow.dev', role: 'member' },
    { name: 'Riya Nair', email: 'riya@kanflow.dev', role: 'member' },
    { name: 'Tom Lee', email: 'tom@kanflow.dev', role: 'viewer' },
  ];
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const users: SeedUser[] = [];
  for (const u of userDefs) {
    const rec = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name },
      create: { email: u.email, name: u.name, passwordHash },
    });
    users.push({ ...u, id: rec.id });
  }
  const priya = users[0];

  await prisma.workspace.deleteMany({ where: { ownerId: priya.id } });

  const wsId = randomUUID();
  const teamId = randomUUID();
  const wfId = randomUUID();
  await prisma.workspace.create({
    data: { id: wsId, name: 'Acme Product', ownerId: priya.id, createdAt: new Date(now - 90 * DAY) },
  });
  await prisma.team.create({
    data: { id: teamId, workspaceId: wsId, name: 'Web Platform', createdAt: new Date(now - 90 * DAY) },
  });
  await prisma.teamMember.createMany({
    data: users.map((u) => ({
      teamId,
      userId: u.id,
      role: u.role as never,
      createdAt: new Date(now - 90 * DAY),
    })),
  });
  await prisma.workflow.create({ data: { id: wfId, teamId, name: 'Default workflow' } });
  const stageDefs = [
    { name: 'Backlog', slug: 'backlog', isInitial: true, isFinal: false },
    { name: 'To Do', slug: 'to-do', isInitial: false, isFinal: false },
    { name: 'In Progress', slug: 'in-progress', isInitial: false, isFinal: false },
    { name: 'In Review', slug: 'in-review', isInitial: false, isFinal: false },
    { name: 'Done', slug: 'done', isInitial: false, isFinal: true },
  ];
  const stages = stageDefs.map((s, i) => ({ ...s, id: randomUUID(), position: i }));
  await prisma.workflowStage.createMany({
    data: stages.map((s) => ({
      id: s.id,
      workflowId: wfId,
      name: s.name,
      slug: s.slug,
      position: s.position,
      isInitial: s.isInitial,
      isFinal: s.isFinal,
    })),
  });

  const assignable = users.filter((u) => u.role !== 'viewer');

  const tickets: Record<string, unknown>[] = [];
  const activity: Record<string, unknown>[] = [];
  const comments: Record<string, unknown>[] = [];
  const assigneesRows: Record<string, unknown>[] = [];
  const watchersRows: Record<string, unknown>[] = [];
  const attachments: Record<string, unknown>[] = [];
  const notifications: Record<string, unknown>[] = [];

  type Gen = { id: string; title: string; completed: boolean; stageIdx: number; enteredAt: number };

  function genTicket(opts: {
    createdAt: number;
    creatorId?: string;
    forceStage?: number;
    lastMoveAt?: number;
  }): Gen {
    const id = randomUUID();
    const { createdAt } = opts;
    const creator = opts.creatorId
      ? assignable.find((u) => u.id === opts.creatorId)!
      : pick(assignable);
    const title = pick(TITLES);
    const priority = pick(['low', 'medium', 'medium', 'high', 'high', 'urgent']);
    const watching = new Set<string>();
    const addWatcher = (userId: string) => {
      if (!watching.has(userId)) {
        watching.add(userId);
        watchersRows.push({ ticketId: id, userId });
      }
    };

    activity.push({
      ticketId: id,
      actorId: creator.id,
      action: 'ticket_created',
      payload: { title },
      createdAt: new Date(createdAt),
    });
    addWatcher(creator.id);

    const asn = pickSome(assignable, randInt(1, 2));
    for (const a of asn) {
      assigneesRows.push({ ticketId: id, userId: a.id });
      addWatcher(a.id);
      activity.push({
        ticketId: id,
        actorId: creator.id,
        action: 'assignee_added',
        payload: { userId: a.id },
        createdAt: new Date(createdAt + rand(0.1, 2) * HOUR),
      });
    }

    let cur = 0;
    let t = createdAt;
    if (opts.forceStage != null && opts.lastMoveAt != null) {
      const target = opts.forceStage;
      const span = opts.lastMoveAt - createdAt;
      for (let k = 0; k < target; k++) {
        const at = k === target - 1 ? opts.lastMoveAt : createdAt + (span * (k + 1)) / target;
        const from = stages[k];
        const to = stages[k + 1];
        activity.push({
          ticketId: id,
          actorId: pick(asn).id,
          action: 'stage_changed',
          payload: { fromStageId: from.id, toStageId: to.id, from: from.name, to: to.name },
          createdAt: new Date(at),
        });
      }
      cur = target;
      t = opts.lastMoveAt;
    } else {
      while (cur < stages.length - 1) {
        const leaveAt = t + dwellMs(cur);
        if (leaveAt > now) break;
        const from = stages[cur];
        const to = stages[cur + 1];
        activity.push({
          ticketId: id,
          actorId: pick(asn).id,
          action: 'stage_changed',
          payload: { fromStageId: from.id, toStageId: to.id, from: from.name, to: to.name },
          createdAt: new Date(leaveAt),
        });
        t = leaveAt;
        cur++;
      }
    }

    const lastActivity = t;
    const nComments = randInt(0, 3);
    for (let c = 0; c < nComments; c++) {
      const at = Math.min(
        now,
        createdAt + rand(0.2, Math.max(0.4, (lastActivity - createdAt) / HOUR)) * HOUR,
      );
      const author = pick([creator, ...asn]);
      comments.push({ ticketId: id, authorId: author.id, body: pick(COMMENTS), createdAt: new Date(at) });
      addWatcher(author.id);
      activity.push({
        ticketId: id,
        actorId: author.id,
        action: 'comment_added',
        payload: {},
        createdAt: new Date(at),
      });
    }

    if (chance(0.15)) {
      const at = Math.min(now, createdAt + rand(1, 24) * HOUR);
      attachments.push({
        ticketId: id,
        type: 'image',
        url: `https://picsum.photos/seed/${id.slice(0, 8)}/600/400`,
        fileName: 'screenshot.png',
        sizeBytes: randInt(40_000, 400_000),
        uploadedById: creator.id,
        createdAt: new Date(at),
      });
    }

    tickets.push({
      id,
      teamId,
      title,
      description: pick(DESCRIPTIONS),
      priority: priority as never,
      effort: chance(0.6) ? randInt(1, 8) : null,
      stageId: stages[cur].id,
      creatorId: creator.id,
      createdAt: new Date(createdAt),
    });

    return { id, title, completed: cur === stages.length - 1, stageIdx: cur, enteredAt: t };
  }

  for (let i = 0; i < 46; i++) {
    genTicket({ createdAt: now - rand(1, 60) * DAY - rand(0, 23) * HOUR });
  }

  const agingGen: Gen[] = [];
  for (let i = 0; i < 4; i++) {
    const createdAt = now - rand(22, 35) * DAY;
    const lastMoveAt = now - rand(12, 22) * DAY;
    const forceStage = chance(0.5) ? 3 : 2;
    agingGen.push(genTicket({ createdAt, lastMoveAt, forceStage, creatorId: priya.id }));
  }

  await prisma.ticket.createMany({ data: tickets as never });
  await prisma.ticketAssignee.createMany({ data: assigneesRows as never, skipDuplicates: true });
  await prisma.watcher.createMany({ data: watchersRows as never, skipDuplicates: true });
  await prisma.activityLog.createMany({ data: activity as never });
  await prisma.comment.createMany({ data: comments as never });
  if (attachments.length) await prisma.attachment.createMany({ data: attachments as never });

  for (const g of agingGen) {
    const stage = stages[g.stageIdx];
    const overByMs = Math.max(DAY, now - g.enteredAt - 5 * DAY);
    notifications.push({
      recipientId: priya.id,
      ticketId: g.id,
      kind: 'aging',
      payload: { ticketTitle: g.title, stageName: stage.name, p90Ms: 5 * DAY, overByMs },
      readAt: null,
      createdAt: new Date(now - rand(0.5, 6) * HOUR),
    });
  }
  for (const tk of tickets.slice(-5)) {
    const read = chance(0.6);
    notifications.push({
      recipientId: priya.id,
      ticketId: tk.id as string,
      kind: pick(['assigned', 'comment_added', 'stage_changed']),
      payload: { ticketTitle: tk.title, to: 'In Review' },
      readAt: read ? new Date(now - rand(1, 20) * HOUR) : null,
      createdAt: new Date(now - rand(6, 72) * HOUR),
    });
  }
  await prisma.notification.createMany({ data: notifications as never });

  const completed = tickets.filter((t) => t.stageId === stages[stages.length - 1].id).length;
  return {
    users: users.length,
    tickets: tickets.length,
    completed,
    wip: tickets.length - completed,
    activity: activity.length,
    comments: comments.length,
    attachments: attachments.length,
    notifications: notifications.length,
    teamId,
    teamName: 'Web Platform',
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  };
}
