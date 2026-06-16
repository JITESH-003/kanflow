'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { GlassCard } from './ui/glass-card';
import { GradientButton } from './ui/gradient-button';
import { TextField } from './ui/text-field';

export type AuthMode = 'signin' | 'signup';

export interface AuthSubmitValues {
  name: string;
  email: string;
  password: string;
}

export function AuthCard({
  onSubmit,
}: {
  onSubmit: (values: AuthSubmitValues, mode: AuthMode) => Promise<void>;
}) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSubmit({ name, email, password }, mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  function toggleMode() {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setError(null);
  }

  return (
    <GlassCard layout className="w-full max-w-md p-8">
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/30">
          <span className="text-lg font-bold text-white">k</span>
        </div>
        <span className="text-lg font-semibold tracking-tight text-white">kanflow</span>
      </div>

      <div className="mb-6">
        <AnimatePresence mode="wait">
          <motion.h1
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="text-2xl font-semibold tracking-tight text-white"
          >
            {isSignup ? 'Create your account' : 'Welcome back'}
          </motion.h1>
        </AnimatePresence>
        <p className="mt-1 text-sm text-white/50">
          {isSignup
            ? 'Start managing workflows in real time.'
            : 'Sign in to your kanflow workspace.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <AnimatePresence initial={false} mode="popLayout">
          {isSignup && (
            <motion.div
              key="name-field"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <TextField
                id="name"
                label="Name"
                type="text"
                value={name}
                autoComplete="name"
                placeholder="Ada Lovelace"
                onChange={setName}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <TextField
          id="email"
          label="Email"
          type="email"
          value={email}
          autoComplete="email"
          placeholder="you@example.com"
          onChange={setEmail}
        />

        <TextField
          id="password"
          label="Password"
          type="password"
          value={password}
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          placeholder="••••••••"
          minLength={isSignup ? 8 : undefined}
          onChange={setPassword}
        />

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="rounded-lg border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <GradientButton type="submit" loading={loading}>
          {isSignup ? 'Create account' : 'Sign in'}
        </GradientButton>
      </form>

      <p className="mt-6 text-center text-sm text-white/50">
        {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button
          type="button"
          onClick={toggleMode}
          className="font-medium text-indigo-400 transition-colors hover:text-indigo-300"
        >
          {isSignup ? 'Sign in' : 'Sign up'}
        </button>
      </p>
    </GlassCard>
  );
}
