'use client';

export function TextField({
  id,
  label,
  type,
  value,
  autoComplete,
  placeholder,
  minLength,
  onChange,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  autoComplete: string;
  placeholder: string;
  minLength?: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-white/60">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        minLength={minLength}
        required
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-indigo-400/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-indigo-500/20"
      />
    </div>
  );
}
