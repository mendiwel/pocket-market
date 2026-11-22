import { money } from '../engine/format';

/** SVG Savings Tree: size follows the balance, golden fruit follows the streak. */
export function SavingsTree({ balance, streakMonths, size = 220 }: { balance: number; streakMonths: number; size?: number }) {
  const stage = balance <= 0 ? 0 : balance < 100 ? 1 : balance < 300 ? 2 : balance < 700 ? 3 : 4;
  const crown = [0, 22, 38, 52, 64][stage];
  const trunkH = [0, 18, 34, 48, 58][stage];
  const fruit = Math.min(12, streakMonths);
  const cx = 100;
  const ground = 182;
  const crownY = ground - trunkH - crown * 0.55;
  // Fixed fruit spots around the crown (deterministic, no layout shift).
  const spots = Array.from({ length: 12 }, (_, i) => {
    const ang = (i / 12) * Math.PI * 2 + 0.4;
    const r = crown * (0.45 + ((i * 37) % 10) / 30);
    return { x: cx + Math.cos(ang) * r, y: crownY + Math.sin(ang) * r * 0.8 };
  });
  const label =
    stage === 0
      ? 'עץ החיסכון עוד לא נשתל — מפקידים כסף כדי לשתול זרע'
      : `עץ החיסכון: ${money(balance)}, ${streakMonths} חודשי ריבית ברצף`;
  return (
    <svg className="tree" viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={label}>
      <ellipse cx={cx} cy={ground + 6} rx="70" ry="10" fill="var(--soil)" />
      {stage === 0 ? (
        <g>
          <ellipse cx={cx} cy={ground - 2} rx="9" ry="6" fill="#a8743f" />
          <text x={cx} y={ground - 22} textAnchor="middle" fontSize="16">🌱?</text>
        </g>
      ) : (
        <g className="tree__grow">
          <path d={`M${cx} ${ground} Q ${cx - 4} ${ground - trunkH / 2} ${cx} ${ground - trunkH}`} stroke="#8a5a2b" strokeWidth={4 + stage * 2} fill="none" strokeLinecap="round" />
          <circle cx={cx - crown * 0.45} cy={crownY + crown * 0.2} r={crown * 0.6} fill="var(--leaf-2)" />
          <circle cx={cx + crown * 0.45} cy={crownY + crown * 0.2} r={crown * 0.6} fill="var(--leaf-2)" />
          <circle cx={cx} cy={crownY} r={crown * 0.8} fill="var(--leaf)" />
          {spots.slice(0, fruit).map((s, i) => (
            <g key={i} className="tree__coin" style={{ animationDelay: `${i * 80}ms` }}>
              <circle cx={s.x} cy={s.y} r="6" fill="#f5c542" stroke="#c99a1e" strokeWidth="1.5" />
              <text x={s.x} y={s.y + 3} textAnchor="middle" fontSize="7" fill="#7a5a00">₪</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
