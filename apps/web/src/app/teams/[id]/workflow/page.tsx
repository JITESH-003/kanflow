'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { AuroraBackground } from '@/components/aurora-background';
import { GlassCard } from '@/components/ui/glass-card';
import { GradientButton } from '@/components/ui/gradient-button';
import { teamsApi, workflowApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface EditableStage {
  key: string;
  id?: string;
  name: string;
  isInitial: boolean;
  isFinal: boolean;
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'stage'
  );
}

export default function WorkflowEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();

  const [stages, setStages] = useState<EditableStage[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !id) return;
    Promise.all([workflowApi.get(id), teamsApi.get(id)])
      .then(([wf, team]) => {
        setStages(
          wf.stages.map((s) => ({
            key: s.id,
            id: s.id,
            name: s.name,
            isInitial: s.isInitial,
            isFinal: s.isFinal,
          })),
        );
        const myRole = team.members.find((m) => m.user.id === user.id)?.role;
        setCanEdit(myRole === 'admin' || myRole === 'manager');
        setReady(true);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load workflow');
        setReady(true);
      });
  }, [user, id]);

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= stages.length) return;
    const next = [...stages];
    [next[i], next[j]] = [next[j], next[i]];
    setStages(next);
  }

  function rename(key: string, name: string) {
    setStages((prev) => prev.map((s) => (s.key === key ? { ...s, name } : s)));
  }

  function setInitial(key: string) {
    setStages((prev) => prev.map((s) => ({ ...s, isInitial: s.key === key })));
  }

  function toggleFinal(key: string) {
    setStages((prev) => prev.map((s) => (s.key === key ? { ...s, isFinal: !s.isFinal } : s)));
  }

  function addStage() {
    setStages((prev) => [
      ...prev,
      { key: crypto.randomUUID(), name: 'New stage', isInitial: false, isFinal: false },
    ]);
  }

  function remove(key: string) {
    setStages((prev) => {
      const next = prev.filter((s) => s.key !== key);
      if (next.length && !next.some((s) => s.isInitial)) next[0] = { ...next[0], isInitial: true };
      return next;
    });
  }

  async function save() {
    setError(null);
    setSaved(false);
    if (stages.length === 0) {
      setError('Add at least one stage');
      return;
    }
    if (!stages.some((s) => s.isInitial)) {
      setError('Mark one stage as the starting stage');
      return;
    }
    setSaving(true);
    try {
      const seen = new Map<string, number>();
      const payloadStages = stages.map((s, i) => {
        let slug = slugify(s.name);
        const count = seen.get(slug) ?? 0;
        seen.set(slug, count + 1);
        if (count > 0) slug = `${slug}-${count + 1}`;
        return {
          id: s.id,
          name: s.name.trim() || 'Untitled',
          slug,
          position: i,
          isInitial: s.isInitial,
          isFinal: s.isFinal,
        };
      });
      const updated = await workflowApi.update(id, { stages: payloadStages, rules: [] });
      setStages(
        updated.stages.map((s) => ({
          key: s.id,
          id: s.id,
          name: s.name,
          isInitial: s.isInitial,
          isFinal: s.isFinal,
        })),
      );
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save workflow');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user || !ready) {
    return (
      <main className="relative flex min-h-screen items-center justify-center">
        <AuroraBackground />
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
      </main>
    );
  }

  return (
    <div className="relative min-h-screen">
      <AuroraBackground />
      <AppHeader />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <Link
          href={`/teams/${id}`}
          className="text-sm text-white/50 transition-colors hover:text-white/80"
        >
          &larr; Back to team
        </Link>
        <h1 className="mb-2 mt-3 text-2xl font-semibold tracking-tight text-white">Workflow</h1>
        <p className="mb-8 text-sm text-white/50">
          Define the ordered stages tickets move through. These are data, not hardcoded.
        </p>

        {!canEdit && (
          <div className="mb-6 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">
            View-only access. Only admins and managers can edit the workflow.
          </div>
        )}

        <GlassCard className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wider text-white/40">Stages</h2>
            {canEdit && (
              <button
                onClick={addStage}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/10"
              >
                + Add stage
              </button>
            )}
          </div>
          <ul className="mt-4 space-y-2">
            {stages.map((s, i) => (
              <li
                key={s.key}
                className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
              >
                <span className="w-5 text-center text-xs text-white/30">{i + 1}</span>
                {canEdit ? (
                  <input
                    value={s.name}
                    onChange={(e) => rename(s.key, e.target.value)}
                    className="flex-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white outline-none transition-colors focus:border-indigo-400/60"
                  />
                ) : (
                  <span className="flex-1 text-sm text-white">{s.name}</span>
                )}
                <button
                  type="button"
                  onClick={() => setInitial(s.key)}
                  disabled={!canEdit}
                  className={`rounded-md px-2 py-1 text-xs transition-colors ${
                    s.isInitial
                      ? 'border border-indigo-400/30 bg-indigo-500/20 text-indigo-200'
                      : 'border border-white/10 text-white/40 hover:bg-white/5'
                  } disabled:opacity-50`}
                >
                  {s.isInitial ? 'Start' : 'Set start'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleFinal(s.key)}
                  disabled={!canEdit}
                  className={`rounded-md px-2 py-1 text-xs transition-colors ${
                    s.isFinal
                      ? 'border border-emerald-400/30 bg-emerald-500/20 text-emerald-200'
                      : 'border border-white/10 text-white/40 hover:bg-white/5'
                  } disabled:opacity-50`}
                >
                  {s.isFinal ? 'Done' : 'Set done'}
                </button>
                {canEdit && (
                  <>
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="rounded-md border border-white/10 px-2 py-1 text-xs text-white/60 transition-colors hover:bg-white/5 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === stages.length - 1}
                      className="rounded-md border border-white/10 px-2 py-1 text-xs text-white/60 transition-colors hover:bg-white/5 disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(s.key)}
                      disabled={stages.length <= 1}
                      className="rounded-md border border-white/10 px-2 py-1 text-xs text-red-300/70 transition-colors hover:bg-red-500/10 disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </GlassCard>

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        {saved && (
          <p className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            Workflow saved.
          </p>
        )}

        {canEdit && (
          <div className="mt-6">
            <GradientButton onClick={save} loading={saving} className="w-full">
              Save workflow
            </GradientButton>
          </div>
        )}
      </main>
    </div>
  );
}
