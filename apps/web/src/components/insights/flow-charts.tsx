'use client';

import type { InsightsPerStage, InsightsStageRef } from '@/lib/api';

const STAGE_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#d946ef',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#3b82f6',
];

export function stageColor(i: number) {
  return STAGE_COLORS[i % STAGE_COLORS.length];
}

export function formatDuration(ms: number) {
  if (!ms || ms <= 0) return '—';
  const d = ms / 86_400_000;
  if (d >= 1) return `${d.toFixed(d < 10 ? 1 : 0)}d`;
  const h = ms / 3_600_000;
  if (h >= 1) return `${h.toFixed(h < 10 ? 1 : 0)}h`;
  const m = ms / 60_000;
  if (m >= 1) return `${Math.round(m)}m`;
  return `${Math.max(1, Math.round(ms / 1000))}s`;
}

function shortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function CumulativeFlowChart({
  cfd,
  stages,
}: {
  cfd: { date: string; counts: Record<string, number> }[];
  stages: InsightsStageRef[];
}) {
  const W = 720;
  const H = 260;
  const padL = 34;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const days = cfd.length;

  const totals = cfd.map((d) => stages.reduce((s, st) => s + (d.counts[st.id] || 0), 0));
  const maxTotal = Math.max(1, ...totals);

  const x = (i: number) => padL + (days <= 1 ? innerW / 2 : (i / (days - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / maxTotal) * innerH;

  const ordered = [...stages].sort((a, b) => b.position - a.position);
  const colorByStage = new Map(
    [...stages].sort((a, b) => a.position - b.position).map((s, i) => [s.id, stageColor(i)]),
  );

  const layers = ordered.map((st) => {
    const top: string[] = [];
    const bottom: string[] = [];
    cfd.forEach((d, i) => {
      let acc = 0;
      for (const o of ordered) {
        if (o.id === st.id) break;
        acc += d.counts[o.id] || 0;
      }
      const v = d.counts[st.id] || 0;
      bottom.push(`${x(i).toFixed(1)},${y(acc).toFixed(1)}`);
      top.push(`${x(i).toFixed(1)},${y(acc + v).toFixed(1)}`);
    });
    const path = `${top.join(' ')} ${bottom.reverse().join(' ')}`;
    return { id: st.id, path };
  });

  const gridVals = [0, Math.ceil(maxTotal / 2), maxTotal];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cumulative flow diagram">
      {gridVals.map((v) => (
        <g key={v}>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(v)}
            y2={y(v)}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
          <text x={padL - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.35)">
            {v}
          </text>
        </g>
      ))}
      {layers.map((l) => (
        <polygon key={l.id} points={l.path} fill={colorByStage.get(l.id)} fillOpacity={0.55} />
      ))}
      {days > 1 && (
        <>
          <text x={padL} y={H - 8} fontSize="10" fill="rgba(255,255,255,0.35)">
            {shortDate(cfd[0].date)}
          </text>
          <text x={W - padR} y={H - 8} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.35)">
            {shortDate(cfd[cfd.length - 1].date)}
          </text>
        </>
      )}
    </svg>
  );
}

export function ThroughputBars({ throughput }: { throughput: { weekStart: string; count: number }[] }) {
  const W = 720;
  const H = 200;
  const padL = 28;
  const padR = 10;
  const padT = 16;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = Math.max(1, throughput.length);
  const max = Math.max(1, ...throughput.map((t) => t.count));
  const slot = innerW / n;
  const bw = slot * 0.55;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Weekly throughput">
      <defs>
        <linearGradient id="thrBar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a5b4fc" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <line
        x1={padL}
        x2={W - padR}
        y1={padT + innerH}
        y2={padT + innerH}
        stroke="rgba(255,255,255,0.12)"
      />
      {throughput.map((t, i) => {
        const h = (t.count / max) * innerH;
        const bx = padL + i * slot + (slot - bw) / 2;
        const by = padT + innerH - h;
        return (
          <g key={t.weekStart}>
            {t.count > 0 && <rect x={bx} y={by} width={bw} height={h} rx={4} fill="url(#thrBar)" />}
            <text
              x={bx + bw / 2}
              y={by - 5}
              textAnchor="middle"
              fontSize="11"
              fill="rgba(255,255,255,0.6)"
            >
              {t.count || ''}
            </text>
            <text
              x={bx + bw / 2}
              y={H - 8}
              textAnchor="middle"
              fontSize="9.5"
              fill="rgba(255,255,255,0.3)"
            >
              {shortDate(t.weekStart)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function StageTimeBars({
  perStage,
  bottleneckStageId,
}: {
  perStage: InsightsPerStage[];
  bottleneckStageId?: string | null;
}) {
  const rows = perStage.filter((s) => !s.isTerminal);
  const W = 720;
  const rowH = 38;
  const padL = 120;
  const padR = 64;
  const padT = 10;
  const H = padT * 2 + rows.length * rowH;
  const innerW = W - padL - padR;
  const maxP90 = Math.max(1, ...rows.map((r) => r.p90Ms));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Per-stage time">
      {rows.map((s, i) => {
        const cy = padT + i * rowH + rowH / 2;
        const hasData = s.sampleCount > 0 && s.p90Ms > 0;
        const wp90 = hasData ? Math.max(3, (s.p90Ms / maxP90) * innerW) : 0;
        const wp50 = hasData ? Math.max(2, (s.p50Ms / maxP90) * innerW) : 0;
        const isBn = s.stageId === bottleneckStageId;
        return (
          <g key={s.stageId}>
            <text x={padL - 10} y={cy + 4} textAnchor="end" fontSize="12" fill="rgba(255,255,255,0.7)">
              {s.name}
            </text>
            <rect x={padL} y={cy - 8} width={innerW} height={16} rx={8} fill="rgba(255,255,255,0.05)" />
            {hasData ? (
              <>
                <rect
                  x={padL}
                  y={cy - 8}
                  width={wp90}
                  height={16}
                  rx={8}
                  fill={isBn ? '#f43f5e' : '#6366f1'}
                  fillOpacity={0.4}
                />
                <rect
                  x={padL}
                  y={cy - 8}
                  width={wp50}
                  height={16}
                  rx={8}
                  fill={isBn ? '#fb7185' : '#818cf8'}
                />
                <text x={padL + wp90 + 8} y={cy + 4} fontSize="11" fill="rgba(255,255,255,0.5)">
                  {formatDuration(s.p90Ms)}
                </text>
              </>
            ) : (
              <text x={padL + 10} y={cy + 4} fontSize="11" fill="rgba(255,255,255,0.3)">
                no data yet
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
