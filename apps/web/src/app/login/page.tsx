'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AuroraBackground } from '@/components/aurora-background';
import { AuthCard, type AuthMode, type AuthSubmitValues } from '@/components/auth-card';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const { user, loading, login, register } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  async function handleSubmit(values: AuthSubmitValues, mode: AuthMode) {
    if (mode === 'signin') {
      await login(values.email, values.password);
    } else {
      await register(values.name, values.email, values.password);
    }
    router.replace('/');
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center p-6">
      <AuroraBackground />
      <AuthCard onSubmit={handleSubmit} />
    </main>
  );
}
