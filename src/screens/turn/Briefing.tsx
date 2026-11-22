import { money, pct } from '../../engine/format';
import { priceChange } from '../../engine/market';
import type { SettlementSummary } from '../../engine/portfolio';
import { SEASON_LABEL, WEATHER_LABEL } from '../../engine/weather';
import { useAutoSpeak } from '../../hooks/tts';
import type { ChildProfile, FamilyGameState } from '../../types';
import { Speak } from '../../components/Speak';
import { Term } from '../../components/Term';

export function Briefing({
  child,
  family,
  summary,
  readNews,
  onReadNews,
  onNext,
}: {
  child: ChildProfile;
  family: FamilyGameState;
  summary: SettlementSummary | null;
  readNews: boolean;
  onReadNews: () => void;
  onNext: () => void;
}) {
  const early = child.tier === 'early';
  const w = family.weather;
  const wl = WEATHER_LABEL[w.condition];
  const news = family.news.filter((n) => n.month >= family.currentMonth - 1).slice(-4).reverse();
  const hist = child.netWorthHistory;
  const prev = hist.length >= 2 ? hist[hist.length - 2].totalValue : hist[0]?.totalValue ?? 0;
  const nowValue = hist.at(-1)?.totalValue ?? 0;
  const delta = nowValue - prev;
  const mood = delta > 1 ? '😊' : delta < -1 ? '😟' : '😌';
  const index = family.assets.find((a) => a.id === 'market_index');
  const indexMove = index ? priceChange(index) : 0;

  const ttsText = [
    `בוקר טוב ${child.name}!`,
    `היום ${wl.he}, ${w.temperatureC} מעלות.`,
    summary && summary.months > 0 ? `קיבלת דמי כיס ${summary.allowance} שקלים, ושילמת הוצאות ${summary.expenses} שקלים.` : '',
    summary && summary.interest > 0 ? `עץ החיסכון שלך גדל ב-${Math.round(summary.interest)} שקלים.` : '',
    ...news.map((n) => `${n.titleHe}. ${n.descriptionHe}`),
  ].join(' ');
  useAutoSpeak(ttsText, early);

  return (
    <section className="step" aria-labelledby="briefing-h">
      <h2 id="briefing-h" className="step__title">
        ☀️ תדריך בוקר {!early && <Speak text={ttsText} />}
      </h2>

      <div className="grid-3">
        <article className="card card--weather">
          <span className="big-emoji" aria-hidden="true">{wl.icon}</span>
          <div>
            <h3>מזג האוויר ב{family.settings.locationNameHe}</h3>
            <p className="stat">{w.temperatureC}° · {wl.he}</p>
            <p className="muted">עונה: {SEASON_LABEL[w.season]}{w.source === 'seasonal-fallback' ? ' · תחזית עונתית' : ''}</p>
          </div>
        </article>

        <article className="card">
          <h3>{early ? 'הכסף שלי' : 'השינוי בתיק מאתמול'}</h3>
          <p className="stat">
            <span aria-hidden="true">{mood}</span> {money(nowValue)}
          </p>
          {!early && (
            <p className={delta >= 0 ? 'up' : 'down'}>
              {delta >= 0 ? '▲' : '▼'} {money(Math.abs(delta))} {prev > 0 && `(${pct(delta / prev)})`}
            </p>
          )}
          {!early && index && (
            <p className="muted">
              <Term k="index">סל השוק</Term>: {pct(indexMove)} החודש
            </p>
          )}
        </article>

        <article className="card">
          <h3>💰 חודש {family.currentMonth} — מה נכנס ויצא</h3>
          {summary && summary.months > 0 ? (
            <ul className="ledger">
              <li><span>דמי כיס</span><span className="up">+{money(summary.allowance)}</span></li>
              {summary.passiveIncome > 0 && (
                <li><span><Term k="dividend">הכנסה מהעסקים</Term></span><span className="up">+{money(summary.passiveIncome)}</span></li>
              )}
              {summary.interest > 0 && (
                <li><span>🌳 <Term k="compound" /></span><span className="up">+{money(summary.interest, true)}</span></li>
              )}
              <li><span><Term k="fixed_expenses" /></span><span className="down">−{money(summary.expenses)}</span></li>
              {summary.charge && summary.charge.soldAssets.length > 0 && (
                <li className="warn">⚠️ לא היה מספיק מזומן — נמכרו מניות כדי לשלם. <Term k="emergency" /> הייתה עוזרת!</li>
              )}
            </ul>
          ) : (
            <p className="muted">כבר אספת את דמי הכיס של החודש הזה.</p>
          )}
        </article>
      </div>

      <article className="card news">
        <h3>📰 חדשות השוק {!early && <Speak text={news.map((n) => `${n.titleHe}. ${n.descriptionHe}`).join(' ')} />}</h3>
        {news.length === 0 ? (
          <p className="muted">חודש שקט — אין חדשות מיוחדות.</p>
        ) : (
          <ul className="news__list">
            {news.map((n) => (
              <li key={n.id}>
                <span className="news__icon" aria-hidden="true">{n.icon}</span>
                <div>
                  <strong>{n.titleHe}</strong>
                  {!early && <p>{n.descriptionHe}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn" onClick={onReadNews} disabled={readNews} aria-pressed={readNews}>
          {readNews ? '✔ קראתי (+5 ⭐)' : 'קראתי את החדשות'}
        </button>
      </article>

      <div className="step__nav">
        <button type="button" className="btn btn--primary btn--lg" onClick={onNext}>
          הלאה לתיבת הדואר 📬
        </button>
      </div>
    </section>
  );
}
