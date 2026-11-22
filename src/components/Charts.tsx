/** Tiny inline sparkline for stock cards (Tier 2+). Fixed dimensions → no CLS. */
export function Sparkline({ values, width = 120, height = 36 }: { values: number[]; width?: number; height?: number }) {
  const v = values.slice(-12);
  if (v.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = max - min || 1;
  const pts = v.map((y, i) => `${(i / (v.length - 1)) * width},${height - 3 - ((y - min) / span) * (height - 6)}`).join(' ');
  const up = v.at(-1)! >= v[0];
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={up ? 'var(--up)' : 'var(--down)'} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Tier 3 performance chart: the child's net worth vs. a dashed line showing
 * the same money put entirely into the General Market Index (benchmark).
 */
export function PerformanceChart({ history }: { history: { month: number; totalValue: number; indexBenchmark: number }[] }) {
  const W = 520;
  const H = 220;
  const pad = { l: 56, r: 16, t: 16, b: 28 };
  const data = history.slice(-36);
  if (data.length < 2) {
    return <p className="muted">הגרף יופיע אחרי שני חודשי משחק לפחות.</p>;
  }
  const all = data.flatMap((d) => [d.totalValue, d.indexBenchmark]);
  const min = Math.min(...all) * 0.98;
  const max = Math.max(...all) * 1.02;
  const x = (i: number) => pad.l + (i / (data.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (H - pad.t - pad.b);
  const line = (key: 'totalValue' | 'indexBenchmark') => data.map((d, i) => `${x(i)},${y(d[key])}`).join(' ');
  const ticks = [min, (min + max) / 2, max];
  const last = data.at(-1)!;
  const beat = last.totalValue >= last.indexBenchmark;
  return (
    <figure className="perf">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`שווי התיק ${Math.round(last.totalValue)} שקלים, לעומת המדד ${Math.round(last.indexBenchmark)} שקלים`} style={{ direction: 'ltr' }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{Math.round(t)}</text>
          </g>
        ))}
        <polyline points={line('indexBenchmark')} fill="none" stroke="var(--bench)" strokeWidth="2" strokeDasharray="6 5" />
        <polyline points={line('totalValue')} fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinejoin="round" />
        <text x={pad.l} y={H - 8} fontSize="11" fill="var(--muted)">חודש {data[0].month}</text>
        <text x={W - pad.r} y={H - 8} fontSize="11" fill="var(--muted)" textAnchor="end">חודש {last.month}</text>
      </svg>
      <figcaption className="legend">
        <span><i className="sw sw--brand" /> התיק שלי</span>
        <span><i className="sw sw--bench" /> אילו הכול היה בסל השוק הכללי</span>
        <strong className={beat ? 'up' : 'down'}>{beat ? 'הבחירות שלך מנצחות את המדד 🎯' : 'המדד מוביל כרגע — השקעה פסיבית היא מתחרה חזקה'}</strong>
      </figcaption>
    </figure>
  );
}
