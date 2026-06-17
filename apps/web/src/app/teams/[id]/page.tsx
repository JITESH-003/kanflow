'use client';

import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { AppHeader } from '@/components/app-header';
import { AuroraBackground } from '@/components/aurora-background';
import { TicketModal } from '@/components/ticket-modal';
import { GradientButton } from '@/components/ui/gradient-button';
import { MemberPicker } from '@/components/ui/member-picker';
import { Modal } from '@/components/ui/modal';
import { RoleBadge } from '@/components/ui/role-badge';
import { Select } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import {
  teamsApi,
  ticketsApi,
  workflowApi,
  type StageRef,
  type TicketCard,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useSocket } from '@/lib/socket-context';

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-white/10 text-white/50',
  medium: 'bg-sky-500/15 text-sky-200',
  high: 'bg-amber-500/15 text-amber-200',
  urgent: 'bg-red-500/20 text-red-200',
};

function TicketCardView({ ticket, onClick }: { ticket: TicketCard; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`cursor-grab touch-none rounded-xl border border-white/10 bg-white/[0.05] p-3 text-left shadow-md backdrop-blur transition-colors hover:border-white/25 ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <p className="text-sm font-medium leading-snug text-white">{ticket.title}</p>
      <div className="mt-2.5 flex items-center justify-between">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
            PRIORITY_STYLES[ticket.priority] ?? PRIORITY_STYLES.medium
          }`}
        >
          {ticket.priority}
        </span>
        <div className="flex items-center gap-2">
          {ticket._count.comments > 0 && (
            <span className="text-[11px] text-white/40">💬 {ticket._count.comments}</span>
          )}
          <div className="flex -space-x-1.5">
            {ticket.assignees.slice(0, 3).map((a) => (
              <div
                key={a.id}
                title={a.user.name}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-[#0e0e14] bg-gradient-to-br from-indigo-500 to-violet-500 text-[10px] font-semibold text-white"
              >
                {a.user.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Column({
  stage,
  tickets,
  onCardClick,
}: {
  stage: StageRef;
  tickets: TicketCard[];
  onCardClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div className="flex h-full w-72 shrink-0 flex-col">
      <div className="mb-3 flex items-center gap-2 px-1">
        <h3 className="text-sm font-semibold text-white">{stage.name}</h3>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/50">
          {tickets.length}
        </span>
        {stage.isInitial && (
          <span className="text-[10px] uppercase tracking-wide text-indigo-300/70">start</span>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={`no-scrollbar flex flex-1 flex-col gap-2 overflow-y-auto rounded-2xl border p-2 transition-colors ${
          isOver ? 'border-indigo-400/40 bg-indigo-500/5' : 'border-white/5 bg-white/[0.02]'
        }`}
      >
        {tickets.map((t) => (
          <TicketCardView key={t.id} ticket={t} onClick={() => onCardClick(t.id)} />
        ))}
      </div>
    </div>
  );
}

export default function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const socket = useSocket();

  const [presence, setPresence] = useState<{ id: string; name: string }[]>([]);
  const [mineOnly, setMineOnly] = useState(false);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newAssigneeIds, setNewAssigneeIds] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('board:join', { teamId: id });
    const refetch = () => qc.invalidateQueries({ queryKey: ['tickets', id] });
    socket.on('ticket:created', refetch);
    socket.on('ticket:moved', refetch);
    socket.on('ticket:updated', refetch);
    socket.on('ticket:assigned', refetch);
    const onPresence = (data: { room: string; users: { id: string; name: string }[] }) => {
      if (data.room === `board:${id}`) setPresence(data.users);
    };
    socket.on('presence:update', onPresence);
    return () => {
      socket.emit('board:leave', { teamId: id });
      socket.off('ticket:created', refetch);
      socket.off('ticket:moved', refetch);
      socket.off('ticket:updated', refetch);
      socket.off('ticket:assigned', refetch);
      socket.off('presence:update', onPresence);
    };
  }, [socket, id, qc]);

  useEffect(() => {
    const ticketParam = searchParams.get('ticket');
    if (ticketParam) setOpenTicketId(ticketParam);
  }, [searchParams]);

  const teamQ = useQuery({ queryKey: ['team', id], queryFn: () => teamsApi.get(id), enabled: !!user });
  const wfQ = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => workflowApi.get(id),
    enabled: !!user,
  });
  const ticketsQ = useQuery({
    queryKey: ['tickets', id],
    queryFn: () => ticketsApi.list(id),
    enabled: !!user,
  });

  const moveMut = useMutation({
    mutationFn: ({ ticketId, stageId }: { ticketId: string; stageId: string }) =>
      ticketsApi.move(ticketId, stageId),
    onMutate: async ({ ticketId, stageId }) => {
      await qc.cancelQueries({ queryKey: ['tickets', id] });
      const prev = qc.getQueryData<TicketCard[]>(['tickets', id]);
      qc.setQueryData<TicketCard[]>(['tickets', id], (old) =>
        old?.map((t) => (t.id === ticketId ? { ...t, stageId } : t)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['tickets', id], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['tickets', id] }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const myRole = teamQ.data?.members.find((m) => m.user.id === user?.id)?.role;
  const canWrite = !!myRole && myRole !== 'viewer';

  function onDragEnd(event: DragEndEvent) {
    const ticketId = String(event.active.id);
    const targetStage = event.over ? String(event.over.id) : null;
    if (!targetStage) return;
    const ticket = ticketsQ.data?.find((t) => t.id === ticketId);
    if (ticket && ticket.stageId !== targetStage) {
      moveMut.mutate({ ticketId, stageId: targetStage });
    }
  }

  async function createTicket(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      await ticketsApi.create({
        teamId: id,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        assigneeIds: newAssigneeIds,
      });
      setTitle('');
      setDescription('');
      setPriority('medium');
      setNewAssigneeIds([]);
      setNewOpen(false);
      qc.invalidateQueries({ queryKey: ['tickets', id] });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create ticket');
    } finally {
      setCreating(false);
    }
  }

  if (loading || !user) {
    return (
      <main className="relative flex min-h-screen items-center justify-center">
        <AuroraBackground />
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
      </main>
    );
  }

  const stages = wfQ.data?.stages ?? [];
  const tickets = ticketsQ.data ?? [];

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <AuroraBackground />
      <AppHeader />
      <main className="flex flex-1 flex-col overflow-hidden px-6 pt-6">
        <Link href="/" className="text-sm text-white/50 transition-colors hover:text-white/80">
          &larr; Back to teams
        </Link>

        <div className="mb-6 mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {teamQ.data?.name ?? 'Team'}
            </h1>
            {myRole && <RoleBadge role={myRole} />}
            {presence.length > 0 && (
              <div className="ml-1 flex items-center -space-x-2">
                {presence.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    title={`${p.name} is viewing`}
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#08080b] bg-gradient-to-br from-emerald-500 to-teal-500 text-[11px] font-semibold text-white"
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMineOnly((v) => !v)}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                mineOnly
                  ? 'border-indigo-400/40 bg-indigo-500/20 text-indigo-100'
                  : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
              }`}
            >
              My tickets
            </button>
            <Link
              href={`/teams/${id}/members`}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
            >
              Members
            </Link>
            <Link
              href={`/teams/${id}/workflow`}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10"
            >
              Workflow
            </Link>
            {canWrite && <GradientButton onClick={() => setNewOpen(true)}>+ New ticket</GradientButton>}
          </div>
        </div>

        {wfQ.isLoading || ticketsQ.isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
          </div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={canWrite ? onDragEnd : undefined}>
            <div className="no-scrollbar flex flex-1 gap-4 overflow-x-auto pb-6">
              {stages.map((s) => (
                <Column
                  key={s.id}
                  stage={s}
                  tickets={tickets.filter(
                    (t) =>
                      t.stageId === s.id &&
                      (!mineOnly || t.assignees.some((a) => a.user.id === user.id)),
                  )}
                  onCardClick={setOpenTicketId}
                />
              ))}
            </div>
          </DndContext>
        )}
      </main>

      <Modal
        open={newOpen}
        onClose={() => {
          setNewOpen(false);
          setNewAssigneeIds([]);
        }}
        title="New ticket"
      >
        <form onSubmit={createTicket} className="space-y-4">
          <TextField
            id="ticket-title"
            label="Title"
            type="text"
            value={title}
            autoComplete="off"
            placeholder="Build the login page"
            onChange={setTitle}
          />
          <div className="space-y-1.5">
            <label htmlFor="ticket-desc" className="block text-sm font-medium text-white/60">
              Description
            </label>
            <textarea
              id="ticket-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <Select
            id="ticket-priority"
            label="Priority"
            value={priority}
            onChange={setPriority}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'urgent', label: 'Urgent' },
            ]}
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-white/60">
              Assign people (optional)
            </label>
            {newAssigneeIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {newAssigneeIds.map((uid) => {
                  const m = teamQ.data?.members.find((mm) => mm.user.id === uid);
                  return (
                    <span
                      key={uid}
                      className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 py-0.5 pl-1 pr-2 text-xs text-white/80"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-[9px] font-semibold text-white">
                        {m?.user.name.charAt(0).toUpperCase() ?? '?'}
                      </span>
                      {m?.user.name ?? 'Member'}
                      <button
                        type="button"
                        onClick={() => setNewAssigneeIds((ids) => ids.filter((x) => x !== uid))}
                        className="text-white/30 transition-colors hover:text-red-300"
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <MemberPicker
              members={(teamQ.data?.members ?? [])
                .filter((m) => !newAssigneeIds.includes(m.user.id))
                .map((m) => ({
                  id: m.user.id,
                  name: m.user.name,
                  email: m.user.email,
                  role: m.role,
                }))}
              onSelect={(uid) => setNewAssigneeIds((ids) => [...ids, uid])}
              placeholder="Search people…"
            />
          </div>
          {createError && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {createError}
            </p>
          )}
          <GradientButton type="submit" loading={creating} className="w-full">
            Create ticket
          </GradientButton>
        </form>
      </Modal>

      {openTicketId && (
        <TicketModal
          ticketId={openTicketId}
          teamId={id}
          canWrite={canWrite}
          members={teamQ.data?.members ?? []}
          onClose={() => setOpenTicketId(null)}
        />
      )}
    </div>
  );
}
