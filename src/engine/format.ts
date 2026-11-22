const whole = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
const two = new Intl.NumberFormat('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctFmt = new Intl.NumberFormat('he-IL', {
  style: 'percent',
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

export function money(n: number, precise = false): string {
  return `${(precise ? two : whole).format(n)} ₪`;
}

export function pct(fraction: number): string {
  return pctFmt.format(fraction);
}

export function units(n: number): string {
  return new Intl.NumberFormat('he-IL', { maximumFractionDigits: 3 }).format(n);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
