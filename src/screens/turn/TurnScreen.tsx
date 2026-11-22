import { useCallback, useEffect, useRef, useState } from 'react';
import { money } from '../../engine/format';
import { netWorth, settleChild, type SettlementSummary } from '../../engine/portfolio';
import { emptySession, finishTurn, type TurnResult, type TurnSession } from '../../engine/rewards';
import { speak, stopSpeaking } from '../../hooks/tts';
import { useChild } from '../../hooks/useChild';
import { Avatar } from '../../components/Avatar';
import { Modal } from '../../components/Modal';
import { TimerBar } from '../../components/TimerBar';
import { Actions } from './Actions';
import { Briefing } from './Briefing';
import { Finish } from './Finish';
import { Inbox } from './Inbox';

const STEPS = [
  { n: 1, label: 'תדריך בוקר', icon: '☀️' },
  { n: 2, label: 'תיבת דואר', icon: '📬' },
  { n: 3, label: 'פעולות', icon: '🛒' },
  { n: 4, label: 'סיום', icon: '✅' },
];

export function TurnScreen({ childId, onExit }: { childId: string; onExit: () => void }) {
  const { child, family, mutate, today, mode } = useChild(childId);
  const [step, setStep] = useState(1);
  const [session, setSession] = useState<TurnSession>(emptySession);
  const [summary, setSummary] = useState<SettlementSummary | null>(null);
  const [result, setResult] = useState<TurnResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [warn, setWarn] = useState(false);
  const startedAt = useRef(Date.now());
  const settled = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (settled.current) return;
    settled.current = true;
    setSummary(mutate((c, f) => settleChild(c, f)));
  }, [mutate]);

  useEffect(() => () => stopSpeaking(), []);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  const onWarn = useCallback(() => {
    setWarn(true);
    if (child?.tier === 'early') speak('נשארו עוד שלוש דקות. זמן לסיים.');
  }, [child?.tier]);
  const onDone = useCallback(() => setTimeUp(true), []);

  if (!child) return null;
  const locked = timeUp || !!result;

  function finish() {
    const r = mutate((c, f) => finishTurn(c, f, session, today));
    setResult(r);
    setTimeUp(false);
    setStep(4);
  }

  function goto(n: number) {
    if (result) return;
    // The inbox must be cleared before acting.
    if (n >= 3 && child!.inbox.some((i) => !i.resolved)) {
      setStep(2);
      notify('קודם מטפלים בהודעות בתיבת הדואר 📬');
      return;
    }
    setStep(n);
    window.scrollTo({ top: 0 });
  }

  return (
    <div className={`turn tier-${child.tier}`}>
      <header className="turn__bar">
        <button type="button" className="icon-btn" onClick={onExit} aria-label="חזרה למשפחה">
          🏠
        </button>
        <Avatar avatarId={child.avatarId} accessory={child.equippedAccessory} size={48} />
        <div className="turn__who">
          <strong>{child.name}</strong>
          <span className="muted">חודש {family.currentMonth} · ⭐ {child.xp} · 🔥 {child.dailyStreak}</span>
        </div>
        <div className="turn__money">
          <span>💵 {money(child.cash)}</span>
          <span className="muted">שווי כולל {money(netWorth(child, family.assets))}</span>
        </div>
        <TimerBar startedAt={startedAt.current} onWarn={onWarn} onDone={onDone} />
      </header>

      <nav className="stepper" aria-label="שלבי התור">
        <ol>
          {STEPS.map((s) => (
            <li key={s.n}>
              <button type="button" className="stepper__btn" aria-current={step === s.n ? 'step' : undefined} onClick={() => goto(s.n)} disabled={!!result && s.n !== 4}>
                <span aria-hidden="true">{s.icon}</span> {s.label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {warn && !result && !timeUp && (
        <p className="gentle-warn" role="status">⏳ עוד כמה דקות נגמר הזמן להיום. כדאי להתחיל לסכם.</p>
      )}

      <main id="main">
        {step === 1 && (
          <Briefing
            child={child}
            family={family}
            summary={summary}
            readNews={session.readNews}
            onReadNews={() => {
              setSession((s) => ({ ...s, readNews: true }));
              mutate((c) => {
                c.stats.newsReads += 1;
              });
            }}
            onNext={() => goto(2)}
          />
        )}
        {step === 2 && <Inbox childId={childId} onNext={() => goto(3)} notify={notify} />}
        {step === 3 && (
          <Actions
            childId={childId}
            session={session}
            setSession={setSession}
            locked={locked}
            notify={notify}
            onStayPassive={() => {
              setSession((s) => ({ ...s, stayedPassive: true }));
              notify('בחרת להישאר פסיבי/ת היום 🧘 — לפעמים לא לעשות כלום זו ההחלטה הכי חכמה.');
              setStep(4);
            }}
            onNext={() => goto(4)}
          />
        )}
        {step === 4 && <Finish child={child} session={session} result={result} onFinish={finish} onExit={onExit} isDemo={mode === 'demo'} />}
      </main>

      <div className="toast" role="status" aria-live="polite" data-show={toast ? 'true' : 'false'}>
        {toast}
      </div>

      <Modal open={timeUp && !result} onClose={() => {}} title="🌙 הזמן להיום נגמר" dismissible={false}>
        <p>שיחקת 15 דקות — מצוין! שומרים את מה שעשית וממשיכים מחר.</p>
        <button type="button" className="btn btn--primary btn--lg" onClick={finish}>
          סיום התור
        </button>
      </Modal>
    </div>
  );
}
