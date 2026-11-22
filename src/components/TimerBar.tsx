import { useEffect, useRef } from 'react';
import { chime, useSoftTimer } from '../hooks/useSoftTimer';
import { TURN_MINUTES } from '../engine/catalog';

export function TimerBar({ startedAt, onWarn, onDone }: { startedAt: number; onWarn?: () => void; onDone?: () => void }) {
  const t = useSoftTimer(TURN_MINUTES, startedAt);
  const warned = useRef(false);
  const doneFired = useRef(false);
  useEffect(() => {
    if (t.warning && !warned.current) {
      warned.current = true;
      chime();
      onWarn?.();
    }
    if (t.done && !doneFired.current) {
      doneFired.current = true;
      onDone?.();
    }
  }, [t.warning, t.done, onWarn, onDone]);
  return (
    <div className={`timer${t.warning ? ' timer--warn' : ''}`} role="timer" aria-label={`נשארו בערך ${t.minutesLeft} דקות לתור`}>
      <div className="timer__track">
        <div className="timer__fill" style={{ transform: `scaleX(${1 - t.progress})` }} />
      </div>
      <span className="timer__label">{t.done ? 'הזמן להיום נגמר 🌙' : t.warning ? `עוד ${t.minutesLeft} דק׳ — זמן לסכם` : `⏳ ${t.minutesLeft} דק׳`}</span>
    </div>
  );
}
