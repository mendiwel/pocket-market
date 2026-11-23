import { COSMETICS } from '../../engine/catalog';
import { money } from '../../engine/format';
import { MISSIONS, type TurnResult, type TurnSession } from '../../engine/rewards';
import { useAutoSpeak } from '../../hooks/tts';
import type { ChildProfile } from '../../types';
import { Speak } from '../../components/Speak';

export function Finish({
  child,
  session,
  result,
  onFinish,
  onExit,
  isDemo,
}: {
  child: ChildProfile;
  session: TurnSession;
  result: TurnResult | null;
  onFinish: () => void;
  onExit: () => void;
  isDemo: boolean;
}) {
  const early = child.tier === 'early';
  const doneText = result
    ? `כל הכבוד ${child.name}! קיבלת ${result.xpGained} כוכבים. ${result.newAchievements.map((a) => `הישג חדש: ${a.nameHe}.`).join(' ')} נתראה מחר!`
    : session.stayedPassive
      ? 'בחרת להישאר פסיבי היום. זו החלטה חכמה! לוחצים על סיום התור.'
      : 'מוכנים לסיים? לוחצים על סיום התור.';
  useAutoSpeak(doneText, early);

  if (!result) {
    return (
      <section className="step" aria-labelledby="fin-h">
        <h2 id="fin-h" className="step__title">
          ✅ סיכום התור <Speak text={doneText} label="הקראת סיכום" showText />
        </h2>
        <article className="card">
          <ul className="ledger">
            <li><span>📰 קראתי חדשות</span><span>{session.readNews ? '✔' : '—'}</span></li>
            <li><span>🛒 פעולות שביצעתי</span><span>{session.trades}</span></li>
            <li><span>🧘 נשארתי פסיבי/ת</span><span>{session.stayedPassive ? '✔' : '—'}</span></li>
            <li><span>💝 תרומה החודש</span><span>{session.donatedAmount ? `${money(session.donatedAmount)} (+${session.donationXp ?? 0} ⭐)` : '—'}</span></li>
            <li><span>💵 מזומן</span><span>{money(child.cash)}</span></li>
          </ul>
        </article>
        {!early && (
          <article className="card">
            <h3>🎯 משימות למידה</h3>
            <ul className="missions">
              {MISSIONS.map((m) => {
                const [cur, target] = m.progress(child);
                const done = child.completedMissions.includes(m.id);
                return (
                  <li key={m.id} className={done ? 'done' : ''}>
                    <span aria-hidden="true">{m.icon}</span>
                    <span>
                      {m.titleHe} <Speak text={m.titleHe} />
                    </span>
                    <progress max={target} value={done ? target : cur} aria-label={`${cur} מתוך ${target}`} />
                  </li>
                );
              })}
            </ul>
          </article>
        )}
        <div className="step__nav">
          <button type="button" className="btn btn--primary btn--lg" onClick={onFinish}>סיום התור 🌙</button>
        </div>
      </section>
    );
  }

  return (
    <section className="step celebrate" aria-labelledby="fin-h" aria-live="polite">
      <h2 id="fin-h" className="step__title">
        🎉 כל הכבוד, {child.name}! <Speak text={doneText} label="הקראת הישגים" showText />
      </h2>
      <div className="grid-3">
        <article className="card reward">
          <span className="big-emoji">⭐</span>
          <p className="stat">+{result.xpGained}</p>
          <p>כוכבים (סה״כ {child.xp})</p>
        </article>
        <article className="card reward">
          <span className="big-emoji">🔥</span>
          <p className="stat">{result.newStreak}</p>
          <p>ימים ברצף</p>
        </article>
        {result.bonusCash > 0 && (
          <article className="card reward">
            <span className="big-emoji">🎁</span>
            <p className="stat">+{money(result.bonusCash)}</p>
            <p>בונוס רצף/משימה</p>
          </article>
        )}
      </div>
      {result.newAchievements.map((a) => (
        <article key={a.id} className="card achievement-pop">
          <span className="big-emoji">{a.icon}</span>
          <div>
            <h3>הישג חדש: {a.nameHe}</h3>
            <p>{a.lessonHe}</p>
          </div>
        </article>
      ))}
      {result.newMissions.map((m) => (
        <article key={m.id} className="card achievement-pop">
          <span className="big-emoji">{m.icon}</span>
          <div><h3>משימה הושלמה!</h3><p>{m.titleHe}</p></div>
        </article>
      ))}
      {result.newCosmetics.map((c) => (
        <article key={c.id} className="card achievement-pop">
          <span className="big-emoji">{c.icon}</span>
          <div><h3>פריט חדש לדמות: {c.nameHe}</h3></div>
        </article>
      ))}
      {!result.newCosmetics.length && (
        <p className="muted">
          {(() => {
            const next = COSMETICS.find((c) => !child.unlockedCosmetics.includes(c.id));
            return next ? `עוד ${next.xpRequired - child.xp} ⭐ עד ${next.icon} ${next.nameHe}` : 'פתחת את כל הפריטים!';
          })()}
        </p>
      )}
      <p>{isDemo ? 'בדמו אפשר לדלג ליום הבא מהמסך הראשי.' : 'התור הבא מחר — 1 יום אמיתי = חודש במשחק. 🌙'}</p>
      <div className="step__nav">
        <button type="button" className="btn btn--primary btn--lg" onClick={onExit}>חזרה למשפחה 🏠</button>
      </div>
    </section>
  );
}
