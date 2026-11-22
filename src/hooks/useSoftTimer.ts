import { useEffect, useState } from 'react';

/**
 * Calm turn timer: reports progress in 0..1 at a slow cadence (every 5 s)
 * so the UI never shows frantic ticking seconds.
 */
export function useSoftTimer(totalMinutes: number, startedAt: number, warnAtMinutesLeft = 3) {
  const total = totalMinutes * 60_000;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.max(0, now - startedAt);
  const remainingMs = Math.max(0, total - elapsed);
  return {
    progress: Math.min(1, elapsed / total),
    minutesLeft: Math.ceil(remainingMs / 60_000),
    warning: remainingMs > 0 && remainingMs <= warnAtMinutesLeft * 60_000,
    done: remainingMs === 0,
  };
}

/** A soft two-note chime via Web Audio — no audio files needed. */
export function chime(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t0 = ctx.currentTime + i * 0.25;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.12, t0 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.65);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {
    /* audio unavailable — the visual prompt is enough */
  }
}
