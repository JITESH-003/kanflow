'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AuroraBackground } from '@/components/aurora-background';
import { GlassCard } from '@/components/ui/glass-card';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="relative flex min-h-screen items-center justify-center">
        <AuroraBackground />
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-6">
      <AuroraBackground />
      <GlassCard className="w-full max-w-lg p-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-2xl font-bold text-white shadow-lg shadow-indigo-500/30">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Welcome, {user.name}
        </h1>
        <p className="mt-1 text-sm text-white/50">{user.email}</p>
        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
          You&apos;re signed in. Your real-time Kanban board lands here next.
        </div>
        <button
          onClick={() => {
            logout();
            router.replace('/login');
          }}
          className="mt-6 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
        >
          Sign out
        </button>
      </GlassCard>
    </main>
  );
}
