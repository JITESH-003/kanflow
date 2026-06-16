'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

export function GlassCard({
  children,
  className = '',
  layout = false,
}: {
  children: ReactNode;
  className?: string;
  layout?: boolean;
}) {
  return (
    <motion.div
      layout={layout}
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-2xl border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl ${className}`}
    >
      {children}
    </motion.div>
  );
}
