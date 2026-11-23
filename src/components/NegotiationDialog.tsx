import { useEffect, useMemo, useState } from 'react';
import { getNegotiationProvider, type NegotiationContext, type NegotiationOutcome, type NegotiationStep, type NegotiationTurn } from '../engine/negotiation';
import { speak } from '../hooks/tts';
import type { AgeTier, Bill, InboxItem } from '../types';
import { Modal } from './Modal';
import { Speak } from './Speak';

interface Msg {
  from: 'rep' | 'me';
  text: string;
}

export function NegotiationDialog({
  item,
  bill,
  tier,
  childName,
  onClose,
  onDone,
}: {
  item: InboxItem | null;
  bill: Bill | undefined;
  tier: AgeTier;
  childName: string;
  onClose: () => void;
  onDone: (outcome: NegotiationOutcome) => void;
}) {
  const provider = useMemo(() => getNegotiationProvider(), []);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [step, setStep] = useState<NegotiationStep | null>(null);
  const [history, setHistory] = useState<NegotiationTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const ctx: NegotiationContext | null = item && bill ? { bill, hikeAmount: item.amount, tier, childName } : null;

  useEffect(() => {
    if (!ctx) return;
    setHistory([]);
    provider.start(ctx).then((s) => {
      setStep(s);
      setMsgs([{ from: 'rep', text: s.repMessageHe }]);
      if (tier === 'early') speak(s.repMessageHe);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  async function choose(optionId: string, label: string) {
    if (!ctx || busy) return;
    setBusy(true);
    const h = [...history, { optionId }];
    setHistory(h);
    setMsgs((m) => [...m, { from: 'me', text: label }]);
    const s = await provider.respond(ctx, h);
    setMsgs((m) => [...m, { from: 'rep', text: s.repMessageHe }]);
    setStep(s);
    setBusy(false);
    if (tier === 'early') speak(s.outcome ? `${s.repMessageHe}. ${s.outcome.lessonHe}` : s.repMessageHe);
  }

  return (
    <Modal open={!!item} onClose={onClose} title={<>💬 שיחה עם הנציג{bill ? ` — ${bill.icon} ${bill.nameHe}` : ''}</>}>
      <div className="chat" aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`bubble bubble--${m.from}`}>
            {m.from === 'rep' && <span className="bubble__who">🧑‍💼</span>}
            <span>{m.text}</span>
            {m.from === 'rep' && <Speak text={m.text} />}
          </div>
        ))}
      </div>
      {step?.outcome ? (
        <div className={`lesson ${step.outcome.win ? 'lesson--win' : ''}`}>
          <p>
            <strong>{step.outcome.cancelled ? 'השירות בוטל.' : `החשבון החודשי: ${step.outcome.finalAmount} ₪`}</strong>{' '}
            <Speak text={`${step.outcome.cancelled ? 'השירות בוטל.' : `החשבון החודשי הוא ${step.outcome.finalAmount} שקלים.`} ${step.outcome.lessonHe}`} />
          </p>
          <p>💡 {step.outcome.lessonHe}</p>
          <button type="button" className="btn btn--primary" onClick={() => onDone(step.outcome!)}>
            סיימתי את השיחה
          </button>
        </div>
      ) : (
        <div className={`chat-options${tier === 'early' ? ' chat-options--big' : ''}`}>
          {step?.options.map((o) => (
            <button key={o.id} type="button" className="btn btn--choice" disabled={busy} onClick={() => choose(o.id, o.labelHe)}>
              <span className="btn__icon" aria-hidden="true">{o.icon}</span>
              {o.labelHe}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
