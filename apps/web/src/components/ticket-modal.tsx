'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { ticketsApi, uploadsApi, type TeamMemberView } from '@/lib/api';
import { useSocket } from '@/lib/socket-context';
import { GradientButton } from './ui/gradient-button';
import { MemberPicker } from './ui/member-picker';
import { Select } from './ui/select';
import { Spinner } from './ui/spinner';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

type Tab = 'details' | 'comments' | 'files' | 'activity';
const TABS: { key: Tab; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'comments', label: 'Comments' },
  { key: 'files', label: 'Files' },
  { key: 'activity', label: 'Activity' },
];

type CloudinarySig = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
};

type PendingUpload = { type: string; url: string; fileName: string; sizeBytes: number };

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function thumb(url: string) {
  return url.includes('/upload/')
    ? url.replace('/upload/', '/upload/w_96,h_96,c_fill,q_auto/')
    : url;
}

async function cloudinaryUpload(file: File, sig: CloudinarySig): Promise<PendingUpload> {
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed for ${file.name}`);
  const data = (await res.json()) as { secure_url: string; bytes?: number; resource_type?: string };
  const type =
    data.resource_type === 'image' ? 'image' : data.resource_type === 'video' ? 'video' : 'file';
  return { type, url: data.secure_url, fileName: file.name, sizeBytes: data.bytes ?? file.size };
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

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
  const socket = useSocket();
  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => ticketsApi.get(ticketId),
  });

  const [tab, setTab] = useState<Tab>('details');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [viewers, setViewers] = useState<{ id: string; name: string }[]>([]);
  const [pendingTicketUploads, setPendingTicketUploads] = useState<PendingUpload[]>([]);
  const [pendingCommentUploads, setPendingCommentUploads] = useState<PendingUpload[]>([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([]);
  const [uploadingTicket, setUploadingTicket] = useState(false);
  const [uploadingComment, setUploadingComment] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (ticket) {
      setTitle(ticket.title);
      setDescription(ticket.description ?? '');
      setPriority(ticket.priority);
      setAssigneeIds(ticket.assignees.map((a) => a.user.id));
    }
  }, [ticket]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('ticket:join', { ticketId });
    const refetch = () => qc.invalidateQueries({ queryKey: ['ticket', ticketId] });
    socket.on('comment:added', refetch);
    socket.on('ticket:updated', refetch);
    socket.on('ticket:assigned', refetch);
    const onPresence = (data: { room: string; users: { id: string; name: string }[] }) => {
      if (data.room !== `ticket:${ticketId}`) return;
      setViewers(Array.from(new Map(data.users.map((u) => [u.id, u])).values()));
    };
    socket.on('presence:update', onPresence);
    return () => {
      socket.emit('ticket:leave', { ticketId });
      socket.off('comment:added', refetch);
      socket.off('ticket:updated', refetch);
      socket.off('ticket:assigned', refetch);
      socket.off('presence:update', onPresence);
    };
  }, [socket, ticketId, qc]);

  async function handleSelect(
    files: File[],
    setUploading: (v: boolean) => void,
    add: (u: PendingUpload) => void,
  ) {
    if (!files.length) return;
    setUploadError(null);
    setUploading(true);
    try {
      const sig = await uploadsApi.sign();
      for (const file of files) add(await cloudinaryUpload(file, sig));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      await ticketsApi.update(ticketId, { title: title.trim(), description, priority });
      const original = new Set((ticket?.assignees ?? []).map((a) => a.user.id));
      const toAdd = assigneeIds.filter((id) => !original.has(id));
      const toRemove = [...original].filter((id) => !assigneeIds.includes(id));
      for (const id of toAdd) await ticketsApi.addAssignee(ticketId, id);
      for (const id of toRemove) await ticketsApi.removeAssignee(ticketId, id);

      if (comment.trim() || pendingCommentUploads.length) {
        const created = await ticketsApi.addComment(ticketId, comment.trim());
        for (const u of pendingCommentUploads) {
          await uploadsApi.createAttachment({
            commentId: created.id,
            type: u.type,
            url: u.url,
            fileName: u.fileName,
            sizeBytes: u.sizeBytes,
          });
        }
      }

      for (const u of pendingTicketUploads) {
        await uploadsApi.createAttachment({
          ticketId,
          type: u.type,
          url: u.url,
          fileName: u.fileName,
          sizeBytes: u.sizeBytes,
        });
      }

      for (const id of removedAttachmentIds) await uploadsApi.deleteAttachment(id);
    },
    onMutate: () => setUploadError(null),
    onSuccess: () => {
      setComment('');
      setPendingTicketUploads([]);
      setPendingCommentUploads([]);
      setRemovedAttachmentIds([]);
      qc.invalidateQueries({ queryKey: ['ticket', ticketId] });
      qc.invalidateQueries({ queryKey: ['tickets', teamId] });
    },
    onError: (e) => setUploadError(e instanceof Error ? e.message : 'Save failed'),
  });

  const assignedMembers = members.filter((m) => assigneeIds.includes(m.user.id));
  const assignable = members.filter((m) => !assigneeIds.includes(m.user.id));
  const visibleAttachments = (ticket?.attachments ?? []).filter(
    (a) => !removedAttachmentIds.includes(a.id),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8">
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
      <motion.div
        className="relative flex h-[40rem] max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0e0e14]/95 shadow-2xl backdrop-blur-xl"
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        {isLoading || !ticket ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <>
            <div className="border-b border-white/10 p-6 pb-0">
              <button
                onClick={onClose}
                className="absolute right-4 top-4 text-white/40 transition-colors hover:text-white"
              >
                ✕
              </button>
              <div className="mb-2 flex items-center gap-2 pr-8 text-xs text-white/40">
                <span className="rounded-full bg-white/10 px-2 py-0.5">{ticket.stage.name}</span>
                <span>·</span>
                <span>by {ticket.creator.name}</span>
                {viewers.length > 0 && (
                  <span className="ml-auto flex items-center gap-1.5 text-emerald-300/80">
                    <span className="flex -space-x-2">
                      {viewers.slice(0, 4).map((v) => (
                        <span
                          key={v.id}
                          title={v.name}
                          className="flex h-5 w-5 items-center justify-center rounded-full border border-[#0e0e14] bg-gradient-to-br from-emerald-500 to-teal-500 text-[9px] font-semibold text-white"
                        >
                          {v.name.charAt(0).toUpperCase()}
                        </span>
                      ))}
                    </span>
                    viewing
                  </span>
                )}
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
              <div className="mt-4 flex gap-5">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`-mb-px border-b-2 pb-2.5 text-sm transition-colors ${
                      tab === t.key
                        ? 'border-indigo-400 text-white'
                        : 'border-transparent text-white/50 hover:text-white/80'
                    }`}
                  >
                    {t.key === 'comments'
                      ? `Comments (${ticket.comments.length})`
                      : t.key === 'files'
                        ? `Files (${ticket.attachments.length})`
                        : t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {tab === 'details' && (
                <div className="space-y-6">
                  <div className="space-y-1.5">
                    <span className="text-xs uppercase tracking-wider text-white/40">
                      Description
                    </span>
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
                        <span className="text-xs uppercase tracking-wider text-white/40">
                          Priority
                        </span>
                        <p className="capitalize text-white/70">{ticket.priority}</p>
                      </>
                    )}
                  </div>

                  <div>
                    <span className="text-xs uppercase tracking-wider text-white/40">Assignees</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {assignedMembers.length === 0 && (
                        <span className="text-sm text-white/40">None yet</span>
                      )}
                      {assignedMembers.map((m) => (
                        <span
                          key={m.user.id}
                          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-2.5 text-sm text-white/80"
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-[10px] font-semibold text-white">
                            {m.user.name.charAt(0).toUpperCase()}
                          </span>
                          {m.user.name}
                          {canWrite && (
                            <button
                              onClick={() =>
                                setAssigneeIds((ids) => ids.filter((id) => id !== m.user.id))
                              }
                              className="text-white/30 transition-colors hover:text-red-300"
                            >
                              ✕
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                    {canWrite && assignable.length > 0 && (
                      <div className="mt-3">
                        <MemberPicker
                          members={assignable.map((m) => ({
                            id: m.user.id,
                            name: m.user.name,
                            email: m.user.email,
                            role: m.role,
                          }))}
                          onSelect={(uid) => setAssigneeIds((ids) => [...ids, uid])}
                          placeholder="Search people to assign…"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === 'comments' && (
                <div className="space-y-4">
                  {ticket.comments.length === 0 ? (
                    <p className="text-sm text-white/40">No comments yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {ticket.comments.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-lg border border-white/5 bg-white/[0.02] p-3"
                        >
                          <div className="mb-1 flex items-center gap-2 text-xs text-white/40">
                            <span className="font-medium text-white/70">{c.author.name}</span>
                            <span>{new Date(c.createdAt).toLocaleString()}</span>
                          </div>
                          {c.body && (
                            <p className="whitespace-pre-wrap text-sm text-white/80">{c.body}</p>
                          )}
                          {c.attachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {c.attachments.map((a) =>
                                a.type === 'image' ? (
                                  <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                                    <img
                                      src={thumb(a.url)}
                                      alt={a.fileName}
                                      className="h-16 w-16 rounded-md object-cover"
                                    />
                                  </a>
                                ) : (
                                  <a
                                    key={a.id}
                                    href={a.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 transition-colors hover:text-indigo-300"
                                  >
                                    <FileIcon className="h-3.5 w-3.5" />
                                    <span className="max-w-[10rem] truncate">{a.fileName}</span>
                                  </a>
                                ),
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {canWrite && (
                    <div className="space-y-2">
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={3}
                        placeholder="Write a comment…"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-indigo-400/60"
                      />
                      {pendingCommentUploads.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {pendingCommentUploads.map((u) => (
                            <span
                              key={u.url}
                              className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70"
                            >
                              {u.type === 'image' ? (
                                <img
                                  src={thumb(u.url)}
                                  alt={u.fileName}
                                  className="h-4 w-4 rounded object-cover"
                                />
                              ) : (
                                <FileIcon className="h-3.5 w-3.5" />
                              )}
                              <span className="max-w-[8rem] truncate">{u.fileName}</span>
                              <button
                                onClick={() =>
                                  setPendingCommentUploads((p) => p.filter((x) => x.url !== u.url))
                                }
                                className="text-white/30 transition-colors hover:text-red-300"
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-white/50 transition-colors hover:text-white/80">
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            disabled={uploadingComment}
                            onChange={(e) => {
                              handleSelect(
                                Array.from(e.target.files ?? []),
                                setUploadingComment,
                                (u) => setPendingCommentUploads((p) => [...p, u]),
                              );
                              e.target.value = '';
                            }}
                          />
                          {uploadingComment ? (
                            <>
                              <Spinner className="h-3.5 w-3.5" /> Uploading…
                            </>
                          ) : (
                            <>
                              <FileIcon className="h-3.5 w-3.5" /> Attach files
                            </>
                          )}
                        </label>
                        <p className="text-xs text-white/30">Saved on Save changes.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'files' && (
                <div className="space-y-4">
                  {canWrite && (
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-sm text-white/60 transition-colors hover:border-indigo-400/40 hover:bg-white/[0.04]">
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        disabled={uploadingTicket}
                        onChange={(e) => {
                          handleSelect(
                            Array.from(e.target.files ?? []),
                            setUploadingTicket,
                            (u) => setPendingTicketUploads((p) => [...p, u]),
                          );
                          e.target.value = '';
                        }}
                      />
                      {uploadingTicket ? (
                        <>
                          <Spinner className="h-4 w-4" /> Uploading…
                        </>
                      ) : (
                        '+ Add files'
                      )}
                    </label>
                  )}
                  {visibleAttachments.length === 0 && pendingTicketUploads.length === 0 ? (
                    <p className="text-sm text-white/40">No files yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {visibleAttachments.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-2.5"
                        >
                          {a.type === 'image' ? (
                            <a href={a.url} target="_blank" rel="noreferrer" className="shrink-0">
                              <img
                                src={thumb(a.url)}
                                alt={a.fileName}
                                className="h-12 w-12 rounded-md object-cover"
                              />
                            </a>
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-white/5 text-white/40">
                              <FileIcon />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block truncate text-sm text-white/90 transition-colors hover:text-indigo-300"
                            >
                              {a.fileName}
                            </a>
                            <p className="text-xs text-white/40">
                              {formatSize(a.sizeBytes)} · {a.uploadedBy.name}
                            </p>
                          </div>
                          {canWrite && (
                            <button
                              onClick={() => setRemovedAttachmentIds((r) => [...r, a.id])}
                              className="shrink-0 text-white/30 transition-colors hover:text-red-300"
                            >
                              ✕
                            </button>
                          )}
                        </li>
                      ))}
                      {pendingTicketUploads.map((u) => (
                        <li
                          key={u.url}
                          className="flex items-center gap-3 rounded-lg border border-dashed border-amber-300/20 bg-white/[0.02] p-2.5"
                        >
                          {u.type === 'image' ? (
                            <img
                              src={thumb(u.url)}
                              alt={u.fileName}
                              className="h-12 w-12 shrink-0 rounded-md object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-white/5 text-white/40">
                              <FileIcon />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-white/80">{u.fileName}</p>
                            <p className="text-xs text-white/40">
                              {formatSize(u.sizeBytes)} ·{' '}
                              <span className="text-amber-300/70">Pending save</span>
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              setPendingTicketUploads((p) => p.filter((x) => x.url !== u.url))
                            }
                            className="shrink-0 text-white/30 transition-colors hover:text-red-300"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {canWrite &&
                    (pendingTicketUploads.length > 0 || removedAttachmentIds.length > 0) && (
                      <p className="text-xs text-white/30">
                        Changes are saved when you click Save changes.
                      </p>
                    )}
                </div>
              )}

              {tab === 'activity' && (
                <ul className="space-y-1.5">
                  {ticket.activities.map((act) => (
                    <li
                      key={act.id}
                      className="flex flex-wrap items-center gap-x-2 text-xs text-white/40"
                    >
                      <span className="text-white/60">{act.actor.name}</span>
                      <span>{act.action.replace(/_/g, ' ')}</span>
                      <span>·</span>
                      <span>{new Date(act.createdAt).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {canWrite && (
              <div className="border-t border-white/10 p-4">
                {uploadError && (
                  <p className="mb-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {uploadError}
                  </p>
                )}
                <GradientButton
                  onClick={() => saveMut.mutate()}
                  loading={saveMut.isPending}
                  className="w-full"
                >
                  Save changes
                </GradientButton>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
