import { useState } from 'react';
import { money } from '../../engine/format';
import type { NegotiationOutcome } from '../../engine/negotiation';
import { applyNegotiationOutcome, resolveInboxMoney } from '../../engine/portfolio';
import { useAutoSpeak } from '../../hooks/tts';
import { useChild } from '../../hooks/useChild';
import type { InboxItem } from '../../types';
import { NegotiationDialog } from '../../components/NegotiationDialog';
import { Speak } from '../../components/Speak';
import { Term } from '../../components/Term';

export function Inbox({ childId, onNext, notify }: { childId: string; onNext: () => void; notify: (msg: string) => void }) {
  const { child, mutate } = useChild(childId);
  const [negotiating, setNegotiating] = useState<InboxItem | null>(null);
  const early = child?.tier === 'early';
  const open = child?.inbox.filter((i) => !i.resolved) ?? [];

  const inboxSpeakText =
    open.length === 0
      ? 'אין הודעות חדשות בתיבת הדואר היום.'
      : `יש לך ${open.length} הודעות בתיבת הדואר. ${open.map((i) => `${i.titleHe}: ${i.bodyHe}`).join('. ')}`;

  useAutoSpeak(inboxSpeakText, early);
  if (!child) return null;

  function pay(item: InboxItem) {
    const r = mutate((c, f) => resolveInboxMoney(c, f, item.id));
    if (item.kind === 'expense') {
      if (r && r.soldAssets.length > 0) notify('לא היה מספיק מזומן, אז נמכרו השקעות כדי לשלם. בפעם הבאה כדאי לשמור קרן חירום!');
      else if (r && r.fromSavings > 0) notify('שילמת בעזרת עץ החיסכון — רצף הריבית התחיל מחדש.');
      else notify(`שילמת ${money(item.amount)} מהמזומן. כל הכבוד שהיה לך כסף בצד!`);
    } else notify(`+${money(item.amount)} נכנסו למזומן!`);
  }

  function finishNegotiation(outcome: NegotiationOutcome) {
    if (!negotiating) return;
    mutate((c) => applyNegotiationOutcome(c, negotiating.id, outcome));
    setNegotiating(null);
  }

  return (
    <section className="step" aria-labelledby="inbox-h">
      <h2 id="inbox-h" className="step__title">
        📬 תיבת הדואר <Speak text={inboxSpeakText} label="הקראת הודעות" showText />
      </h2>
      {open.length === 0 ? (
        <div className="empty">
          <span className="big-emoji" aria-hidden="true">📭</span>
          <p>אין הודעות חדשות היום.</p>
        </div>
      ) : (
        <ul className="inbox">
          {open.map((item) => (
            <li key={item.id} className={`card inbox__item inbox__item--${item.kind}`}>
              <span className="big-emoji" aria-hidden="true">{item.icon}</span>
              <div className="inbox__body">
                <h3>
                  {item.titleHe} <Speak text={`${item.titleHe}. ${item.bodyHe}`} />
                </h3>
                <p>{item.bodyHe}</p>
                {item.kind === 'expense' && (
                  <p className="down">
                    לתשלום: {money(item.amount)}
                    {!early && child.cash < item.amount && (
                      <> · אין מספיק מזומן! (<Term k="emergency" />)</>
                    )}
                  </p>
                )}
                {(item.kind === 'income' || item.kind === 'parent_bonus') && <p className="up">+{money(item.amount)}</p>}
              </div>
              <div className="inbox__act">
                {item.kind === 'price_hike' && !child.bills.some((b) => b.id === item.billId) ? (
                  <button type="button" className="btn" onClick={() => mutate((c) => applyNegotiationOutcome(c, item.id, { finalAmount: 0, cancelled: false, win: false }))}>
                    השירות כבר בוטל ✔
                  </button>
                ) : item.kind === 'price_hike' ? (
                  <button type="button" className="btn btn--primary" onClick={() => setNegotiating(item)}>
                    💬 לדבר עם הנציג
                  </button>
                ) : (
                  <button type="button" className="btn btn--primary" onClick={() => pay(item)}>
                    {item.kind === 'expense' ? `לשלם ${money(item.amount)}` : 'לקבל 🎉'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!early && (
        <details className="card bills">
          <summary>📋 החשבונות החודשיים שלי: {money(child.fixedMonthlyExpenses)}</summary>
          <ul className="ledger">
            {child.bills.map((b) => (
              <li key={b.id}>
                <span>{b.icon} {b.nameHe}{b.essential ? '' : ' (לא הכרחי)'}</span>
                <span>{money(b.amount)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="step__nav">
        <button type="button" className="btn btn--primary btn--lg" onClick={onNext} disabled={open.length > 0}>
          {open.length > 0 ? 'קודם מטפלים בהודעות' : 'הלאה לפעולות 🛒'}
        </button>
      </div>

      <NegotiationDialog
        item={negotiating}
        bill={child.bills.find((b) => b.id === negotiating?.billId)}
        tier={child.tier}
        childName={child.name}
        onClose={() => setNegotiating(null)}
        onDone={finishNegotiation}
      />
    </section>
  );
}
