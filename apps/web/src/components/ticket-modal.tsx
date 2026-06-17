'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { ticketsApi, type TeamMemberView } from '@/lib/api';
import { GradientButton } from './ui/gradient-button';
import { Select } from './ui/select';
import { Spinner } from './ui/spinner';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function TicketModal({
  ticketId,
  teamId,
  canWrite,
  members,
  onClose,
}: {
  ticketId: string;
  teamId: string;
  canWrite: boolean;
  members: TeamMemberView[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => ticketsApi.get(ticketId),
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [comment, setComment] = useState('');
  const [assignUser, setAssignUser] = useState('');

  useEffect(() => {
    if (ticket) {
      setTitle(ticket.title);
      setDescription(ticket.description ?? '');
      setPriority(ticket.priority);
    }
  }, [ticket]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ticket', ticketId] });
    qc.invalidateQueries({ queryKey: ['tickets', teamId] });
  };

  const saveMut = useMutation({
    mutationFn: () => ticketsApi.update(ticketId, { title: title.trim(), description, priority }),
    onSuccess: invalidate,
  });
  const commentMut = useMutation({
    mutationFn: (body: string) => ticketsApi.addComment(ticketId, body),
    onSuccess: () => {
      setComment('');
      invalidate();
    },
  });
  const assignMut = useMutation({
    mutationFn: (userId: string) => ticketsApi.addAssignee(ticketId, userId),
    onSuccess: () => {
      setAssignUser('');
      invalidate();
    },
  });
  const unassignMut = useMutation({
    mutationFn: (userId: string) => ticketsApi.removeAssignee(ticketId, userId),
    onSuccess: invalidate,
  });

  const assignedIds = new Set(ticket?.assignees.map((a) => a.user.id));
  const assignable = members.filter((m) => !assignedIds.has(m.user.id));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
      <motion.div
        className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0e0e14]/95 p-6 shadow-2xl backdrop-blur-xl"
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-white/40 transition-colors hover:text-white"
        >
          ✕
        </button>

        {isLoading || !ticket ? (
          <div className="flex justify-center py-16">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs text-white/40">
                <span className="rounded-full bg-white/10 px-2 py-0.5">{ticket.stage.name}</span>
                <span>·</span>
                <span>by {ticket.creator.name}</span>
              </div>
              {canWrite ? (
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-transparent text-xl font-semibold text-white outline-none"
                />
              ) : (
                <h2 className="text-xl font-semibold text-white">{ticket.title}</h2>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-2">
                <span className="text-xs uppercase tracking-wider text-white/40">Description</span>
                {canWrite ? (
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-indigo-400/60"
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-sm text-white/70">
                    {ticket.description || '—'}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                {canWrite ? (
                  <Select
                    id="ticket-priority"
                    label="Priority"
                    value={priority}
                    onChange={setPriority}
                    options={PRIORITY_OPTIONS}
                  />
                ) : (
                  <>
                    <span className="text-xs uppercase tracking-wider text-white/40">Priority</span>
                    <p className="capitalize text-white/70">{ticket.priority}</p>
                  </>
                )}
              </div>
            </div>

            {canWrite && (
              <GradientButton onClick={() => saveMut.mutate()} loading={saveMut.isPending}>
                Save changes
              </GradientButton>
            )}

            <div>
              <span className="text-xs uppercase tracking-wider text-white/40">Assignees</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {ticket.assignees.length === 0 && (
                  <span className="text-sm text-white/40">None yet</span>
                )}
                {ticket.assignees.map((a) => (
                  <span
                    key={a.id}
                    className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-2.5 text-sm text-white/80"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-[10px] font-semibold text-white">
                      {a.user.name.charAt(0).toUpperCase()}
                    </span>
                    {a.user.name}
                    {canWrite && (
                      <button
                        onClick={() => unassignMut.mutate(a.user.id)}
                        className="text-white/30 transition-colors hover:text-red-300"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {canWrite && assignable.length > 0 && (
                <div className="mt-3 flex items-end gap-2">
                  <div className="flex-1">
                    <Select
                      id="assign-user"
                      label="Add assignee"
                      value={assignUser}
                      onChange={setAssignUser}
                      options={[
                        { value: '', label: 'Select a member' },
                        ...assignable.map((m) => ({
                          value: m.user.id,
                          label: `${m.user.name} (${m.role})`,
                        })),
                      ]}
                    />
                  </div>
                  <button
                    onClick={() => assignUser && assignMut.mutate(assignUser)}
                    disabled={!assignUser || assignMut.isPending}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/80 transition-colors hover:bg-white/10 disabled:opacity-40"
                  >
                    Assign
                  </button>
                </div>
              )}
            </div>

            <div>
              <span className="text-xs uppercase tracking-wider text-white/40">
                Comments ({ticket.comments.length})
              </span>
              <div className="mt-2 space-y-2">
                {ticket.comments.map((c) => (
                  <div key={c.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                    <div className="mb-1 flex items-center gap-2 text-xs text-white/40">
                      <span className="font-medium text-white/70">{c.author.name}</span>
                      <span>{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-white/80">{c.body}</p>
                  </div>
                ))}
              </div>
              {canWrite && (
                <div className="mt-3 flex items-end gap-2">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    placeholder="Add a comment…"
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-indigo-400/60"
                  />
                  <button
                    onClick={() => comment.trim() && commentMut.mutate(comment.trim())}
                    disabled={!comment.trim() || commentMut.isPending}
                    className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              )}
            </div>

            <div>
              <span className="text-xs uppercase tracking-wider text-white/40">Activity</span>
              <ul className="mt-2 space-y-1.5">
                {ticket.activities.map((act) => (
                  <li key={act.id} className="flex flex-wrap items-center gap-x-2 text-xs text-white/40">
                    <span className="text-white/60">{act.actor.name}</span>
                    <span>{act.action.replace(/_/g, ' ')}</span>
                    <span>·</span>
                    <span>{new Date(act.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
