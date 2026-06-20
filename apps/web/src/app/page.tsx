'use client';

import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { AppHeader } from '@/components/app-header';
import { AuroraBackground } from '@/components/aurora-background';
import { GradientButton } from '@/components/ui/gradient-button';
import { Modal } from '@/components/ui/modal';
import { RoleBadge } from '@/components/ui/role-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TextField } from '@/components/ui/text-field';
import { useToast } from '@/components/ui/toast';
import { teamsApi, type TeamSummary } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [teams, setTeams] = useState<TeamSummary[] | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (user) teamsApi.list().then(setTeams).catch(() => setTeams([]));
  }, [user]);

  if (loading || !user) {
    return (
      <main className="relative flex min-h-screen items-center justify-center">
        <AuroraBackground />
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
      </main>
    );
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const team = await teamsApi.create(name.trim());
      setName('');
      setOpen(false);
      toast.success('Team created');
      router.push(`/teams/${team.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create team');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="relative min-h-screen">
      <AuroraBackground />
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Your teams</h1>
            <p className="mt-1 text-sm text-white/50">
              Create a team to start building workflows.
            </p>
          </div>
          <GradientButton onClick={() => setOpen(true)}>+ New team</GradientButton>
        </div>

        {teams === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
        ) : teams.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
            <p className="text-white/60">No teams yet.</p>
            <p className="mt-1 text-sm text-white/40">
              Create your first one with the New team button.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((t, i) => (
              <motion.button
                key={t.id}
                onClick={() => router.push(`/teams/${t.id}`)}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -3 }}
                className="group rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left shadow-xl backdrop-blur-xl transition-colors hover:border-white/20"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 font-bold text-white shadow-lg shadow-indigo-500/30">
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                  <RoleBadge role={t.role} />
                </div>
                <h3 className="mt-4 font-semibold text-white">{t.name}</h3>
                <p className="mt-1 text-sm text-white/40">
                  {t.memberCount} member{t.memberCount === 1 ? '' : 's'}
                </p>
              </motion.button>
            ))}
          </div>
        )}
      </main>

      <Modal open={open} onClose={() => setOpen(false)} title="Create a team">
        <form onSubmit={handleCreate} className="space-y-4">
          <TextField
            id="team-name"
            label="Team name"
            type="text"
            value={name}
            autoComplete="off"
            placeholder="Design, Engineering, Marketing"
            onChange={setName}
          />
          {createError && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {createError}
            </p>
          )}
          <GradientButton type="submit" loading={creating} className="w-full">
            Create team
          </GradientButton>
        </form>
      </Modal>
    </div>
  );
}
