const STYLES: Record<string, string> = {
  admin: 'border-indigo-400/30 bg-indigo-500/15 text-indigo-200',
  manager: 'border-violet-400/30 bg-violet-500/15 text-violet-200',
  member: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200',
  viewer: 'border-white/15 bg-white/5 text-white/60',
};

export function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STYLES[role] ?? STYLES.viewer}`}
    >
      {role}
    </span>
  );
}
