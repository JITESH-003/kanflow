'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AppHeader } from '@/components/app-header';
import { AuroraBackground } from '@/components/aurora-background';
import { GlassCard } from '@/components/ui/glass-card';
import { GradientButton } from '@/components/ui/gradient-button';
import { RoleBadge } from '@/components/ui/role-badge';
import { Select } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import { teamsApi, type TeamDetail } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
];

export default function MembersPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  const reload = useCallback(() => {
    teamsApi
      .get(id)
      .then(setTeam)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load team'));
  }, [id]);

  useEffect(() => {
    if (user && id) reload();
  }, [user, id, reload]);

  if (loading || !user) {
    return (
      <main className="relative flex min-h-screen items-center justify-center">
        <AuroraBackground />
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
      </main>
    );
  }

  const myRole = team?.members.find((m) => m.user.id === user.id)?.role;
  const canManage = myRole === 'admin' || myRole === 'manager';

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAdding(true);
    try {
      await teamsApi.addMember(id, email.trim(), role);
      setEmail('');
      reload();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Could not add member');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="relative min-h-screen">
      <AuroraBackground />
      <AppHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href={`/teams/${id}`}
          className="text-sm text-white/50 transition-colors hover:text-white/80"
        >
          &larr; Back to board
        </Link>

        {loadError && <p className="mt-4 text-sm text-red-300">{loadError}</p>}

        {team && (
          <>
            <h1 className="mb-8 mt-3 text-2xl font-semibold tracking-tight text-white">
              {team.name} — members
            </h1>

            <GlassCard className="p-6">
              <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-white/40">
                Members ({team.members.length})
              </h2>
              <ul className="space-y-2">
                {team.members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-semibold text-white">
                        {m.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {m.user.name}
                          {m.user.id === user.id && <span className="text-white/40"> (you)</span>}
                        </p>
                        <p className="text-xs text-white/40">{m.user.email}</p>
                      </div>
                    </div>
                    <RoleBadge role={m.role} />
                  </li>
                ))}
              </ul>
            </GlassCard>

            {canManage && (
              <GlassCard className="mt-6 p-6">
                <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-white/40">
                  Add a member
                </h2>
                <form onSubmit={handleAdd} className="space-y-4">
                  <TextField
                    id="member-email"
                    label="Email"
                    type="email"
                    value={email}
                    autoComplete="off"
                    placeholder="teammate@example.com"
                    onChange={setEmail}
                  />
                  <Select
                    id="member-role"
                    label="Role"
                    value={role}
                    onChange={setRole}
                    options={ROLE_OPTIONS}
                  />
                  {addError && (
                    <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                      {addError}
                    </p>
                  )}
                  <GradientButton type="submit" loading={adding} className="w-full">
                    Add member
                  </GradientButton>
                </form>
              </GlassCard>
            )}
          </>
        )}
      </main>
    </div>
  );
}
