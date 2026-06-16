'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export function AppHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[#08080b]/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-bold text-white shadow-lg shadow-indigo-500/30">
            k
          </div>
          <span className="font-semibold tracking-tight text-white">kanflow</span>
        </Link>
        <div className="flex items-center gap-3">
          {user && <span className="hidden text-sm text-white/50 sm:block">{user.email}</span>}
          <button
            onClick={() => {
              logout();
              router.replace('/login');
            }}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
