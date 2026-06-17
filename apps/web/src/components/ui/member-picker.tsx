'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface PickerMember {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

export function MemberPicker({
  members,
  onSelect,
  placeholder = 'Search people…',
}: {
  members: PickerMember[];
  onSelect: (id: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? members.filter(
        (m) => m.name.toLowerCase().includes(q) || (m.email ?? '').toLowerCase().includes(q),
      )
    : members;

  function reposition() {
    const r = inputRef.current?.getBoundingClientRect();
    if (r) setRect({ top: r.bottom + 6, left: r.left, width: r.width });
  }

  function openList() {
    reposition();
    setOpen(true);
  }

  function pick(id: string) {
    onSelect(id);
    setQuery('');
    setOpen(false);
  }

  return (
    <div>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          openList();
        }}
        onFocus={openList}
        onBlur={() => setOpen(false)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-indigo-400/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-indigo-500/20"
      />
      {mounted &&
        open &&
        rect &&
        createPortal(
          <div
            style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width }}
            className="z-[70] max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-[#13131a] shadow-2xl"
          >
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-sm text-white/40">No people found</p>
            ) : (
              filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(m.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-indigo-500/15"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-[11px] font-semibold text-white">
                    {m.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-white/90">{m.name}</span>
                    {m.email && (
                      <span className="block truncate text-xs text-white/40">{m.email}</span>
                    )}
                  </span>
                  {m.role && (
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-white/40">
                      {m.role}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
