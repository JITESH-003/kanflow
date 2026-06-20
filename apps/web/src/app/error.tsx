'use client';

import { useEffect } from 'react';
import { AuroraBackground } from '@/components/aurora-background';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative flex min-h-screen items-center justify-center p-6 text-center">
      <AuroraBackground />
      <div className="relative max-w-md">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl">
          ⚠️
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Something went wrong</h1>
        <p className="mt-2 text-sm text-white/50">
          An unexpected error occurred. You can try again, or head back to your teams.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-lg border border-indigo-400/30 bg-indigo-500/15 px-4 py-2 text-sm text-indigo-100 transition-colors hover:bg-indigo-500/25"
          >
            Go home
          </a>
        </div>
      </div>
    </main>
  );
}
