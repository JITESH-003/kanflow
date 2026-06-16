'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Spinner } from './spinner';

export function GradientButton({
  children,
  type = 'button',
  loading = false,
  onClick,
  className = '',
}: {
  children: ReactNode;
  type?: 'button' | 'submit';
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={loading}
      whileHover={{ scale: loading ? 1 : 1.02 }}
      whileTap={{ scale: loading ? 1 : 0.98 }}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition-opacity disabled:opacity-70 ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </motion.button>
  );
}
