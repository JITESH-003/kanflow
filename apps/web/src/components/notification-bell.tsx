'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { notificationsApi, ticketsApi, type NotificationView } from '@/lib/api';
import { useSocket } from '@/lib/socket-context';

function describe(n: NotificationView): string {
  const title = (n.payload?.ticketTitle as string) || 'a ticket';
  switch (n.kind) {
    case 'assigned':
      return `You were assigned to "${title}"`;
    case 'comment_added':
      return `New comment on "${title}"`;
    case 'stage_changed':
      return `"${title}" moved to ${(n.payload?.to as string) ?? 'a new stage'}`;
    default:
      return `Update on "${title}"`;
  }
}

export function NotificationBell() {
  const qc = useQueryClient();
  const socket = useSocket();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data } = useQuery({ queryKey: ['notifications'], queryFn: () => notificationsApi.list() });

  useEffect(() => {
    if (!socket) return;
    const onNew = () => qc.invalidateQueries({ queryKey: ['notifications'] });
    socket.on('notification:new', onNew);
    return () => {
      socket.off('notification:new', onNew);
    };
  }, [socket, qc]);

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  async function openNotification(n: NotificationView) {
    if (!n.readAt) markRead.mutate(n.id);
    setOpen(false);
    if (!n.ticketId) return;
    try {
      const ticket = await ticketsApi.get(n.ticketId);
      router.push(`/teams/${ticket.teamId}?ticket=${n.ticketId}`);
    } catch {
      // ticket may have been deleted; ignore
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Notifications"
        className="relative rounded-lg border border-white/10 bg-white/5 p-2 text-white/80 transition-colors hover:bg-white/10"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div className="fixed inset-0 z-[60]">
                <motion.div
                  className="absolute inset-0 bg-black/40"
                  onClick={() => setOpen(false)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
                <motion.aside
                  className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-[#0b0b10]/95 backdrop-blur-xl"
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                >
                  <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <h2 className="font-semibold text-white">Notifications</h2>
                    <div className="flex items-center gap-3">
                      {unread > 0 && (
                        <button
                          onClick={() => markAll.mutate()}
                          className="text-xs text-indigo-400 transition-colors hover:text-indigo-300"
                        >
                          Mark all read
                        </button>
                      )}
                      <button
                        onClick={() => setOpen(false)}
                        className="text-white/40 transition-colors hover:text-white"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3">
                    {items.length === 0 ? (
                      <p className="px-2 py-12 text-center text-sm text-white/40">
                        You&apos;re all caught up.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {items.map((n) => (
                          <li key={n.id}>
                            <button
                              onClick={() => openNotification(n)}
                              className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                                n.readAt
                                  ? 'border-white/5 bg-white/[0.02] hover:bg-white/5'
                                  : 'border-indigo-400/20 bg-indigo-500/10 hover:bg-indigo-500/15'
                              }`}
                            >
                              <p className="text-sm text-white/90">{describe(n)}</p>
                              <p className="mt-1 text-xs text-white/40">
                                {new Date(n.createdAt).toLocaleString()}
                              </p>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </motion.aside>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
