'use client';

import { motion } from 'motion/react';

export function AuroraBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#08080b]">
      <motion.div
        aria-hidden
        className="absolute -top-1/3 left-1/4 h-[55rem] w-[55rem] rounded-full bg-indigo-500/20 blur-[130px]"
        animate={{ x: [0, 90, -40, 0], y: [0, -70, 40, 0], scale: [1, 1.12, 0.94, 1] }}
        transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="absolute top-1/4 right-1/5 h-[48rem] w-[48rem] rounded-full bg-violet-600/20 blur-[130px]"
        animate={{ x: [0, -80, 50, 0], y: [0, 60, -30, 0], scale: [1, 0.92, 1.12, 1] }}
        transition={{ duration: 23, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-1/4 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-fuchsia-500/15 blur-[130px]"
        animate={{ x: [-40, 40, -40], scale: [1, 1.08, 1] }}
        transition={{ duration: 21, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#08080b_78%)]" />
    </div>
  );
}
