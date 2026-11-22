import { useState } from 'react';
import { CATEGORY_LABEL_HE, EARLY_TIER_ASSETS, PASSIVE_ASSETS, PASSIVE_RESALE_FACTOR } from '../../engine/catalog';
import { money, pct, units } from '../../engine/format';
import { priceChange } from '../../engine/market';
import {
  buyAsset,
  buyPassive,
  categoriesHeld,
  depositSavings,
  holdingsValue,
  monthlyPassiveIncome,
  passiveBookValue,
  sellAsset,
  sellPassive,
  toggleWatch,
  TradeError,
  withdrawSavings,
} from '../../engine/portfolio';
import type { TurnSession } from '../../engine/rewards';
import { weatherImpacts } from '../../engine/weather';
import { speak, useAutoSpeak } from '../../hooks/tts';
import { useChild } from '../../hooks/useChild';
import type { ChildProfile, FamilyGameState, MarketAsset } from '../../types';
import { PerformanceChart, Sparkline } from '../../components/Charts';
import { SavingsTree } from '../../components/SavingsTree';
import { Speak } from '../../components/Speak';
import { Term } from '../../components/Term';
import { TradeDialog } from '../../components/TradeDialog';

type Tab = 'market' | 'tree' | 'business' | 'portfolio';

export function Actions({
  childId,
  session,
  setSession,
  onStayPassive,
  onNext,
  notify,
  locked,
}: {
  childId: string;
  session: TurnSession;
  setSession: (fn: (s: TurnSession) => TurnSession) => void;
  onStayPassive: () => void;
  onNext: () => void;
  notify: (msg: string) => void;
  locked: boolean;
}) {
  const { child, family, mutate } = useChild(childId);
  const [tab, setTab] = useState<Tab>('market');
  const [tradeAsset, setTradeAsset] = useState<string | null>(null);
  const early = child?.tier === 'early';
  useAutoSpeak(
    'עכשיו בוחרים: להשקיע בעץ החיסכון, לקנות חלק בחברה, או ללחוץ על הכפתור הגדול ולהישאר פסיביים היום.',
    early,
  );
  if (!child) return null;

  function act(fn: (c: ChildProfile, f: FamilyGameState) => void, okMsg: string, opts: { sold?: boolean } = {}) {
    if (locked) return;
    try {
      mutate(fn);
      setSession((s) => ({ ...s, trades: s.trades + 1, soldStock: s.soldStock || !!opts.sold, stayedPassive: false }));
      notify(okMsg);
      if (early) speak(okMsg);
    } catch (e) {
      notify(e instanceof TradeError ? e.message : 'משהו השתבש');
    }
  }

  const passiveBtn = (
    <div className="passive-cta">
      <button
        type="button"
        className="btn btn--passive"
        onClick={onStayPassive}
        disabled={session.trades > 0 || locked}
        aria-describedby="passive-hint"
      >
        <span aria-hidden="true">🧘</span> נשארים פסיביים היום
        <small>(לא עושים כלום — וזה בסדר גמור!)</small>
      </button>
      <p id="passive-hint" className="muted">
        {session.trades > 0 ? 'כבר ביצעת פעולות היום — אפשר לסיים את התור.' : <><Term k="passive" /> היא אסטרטגיה חכמה: +10 ⭐</>}
      </p>
    </div>
  );

  const asset = tradeAsset ? family.assets.find((a) => a.id === tradeAsset) ?? null : null;

  if (early) {
    return (
      <section className="step" aria-labelledby="act-h">
        <h2 id="act-h" className="step__title">🛒 מה עושים היום?</h2>
        <p className="cash-pill">יש לי במזומן: <strong>{money(child.cash)}</strong></p>
        {passiveBtn}
        <div className="grid-2">
          <article className="card tree-card">
            <h3>🌳 עץ החיסכון</h3>
            <SavingsTree balance={child.savingsTreeBalance} streakMonths={child.savingsStreakMonths} size={180} />
            <p className="stat">{money(child.savingsTreeBalance)}</p>
            <div className="chips chips--big">
              {[20, 50, 100].map((v) => (
                <button key={v} type="button" className="chip chip--big" disabled={child.cash < v || locked} onClick={() => act((c) => depositSavings(c, v), `שתלת ${v} שקלים בעץ!`)}>
                  🌱 {v} ₪
                </button>
              ))}
            </div>
          </article>
          <article className="card">
            <h3>🏪 לקנות חלק בחברה</h3>
            <ul className="early-assets">
              {EARLY_TIER_ASSETS.map((id) => family.assets.find((a) => a.id === id)!).map((a) => {
                const ch = priceChange(a);
                const held = child.holdings[a.id] ?? 0;
                return (
                  <li key={a.id} className="early-asset">
                    <button type="button" className="early-asset__name" onClick={() => speak(`${a.nameHe}. ${a.descriptionHe}`)}>
                      <span className="big-emoji" aria-hidden="true">{a.icon}</span>
                      <span>{a.nameHe}</span>
                      <span aria-label={ch >= 0 ? 'עלה' : 'ירד'}>{ch >= 0.005 ? '📈' : ch <= -0.005 ? '📉' : '➖'}</span>
                    </button>
                    {held > 0 && <span className="muted">שלי: {money(held * a.currentPrice)}</span>}
                    <div className="chips">
                      {[20, 50].map((v) => (
                        <button key={v} type="button" className="chip chip--big" disabled={child.cash < v || locked} onClick={() => act((c, f) => buyAsset(c, f, a.id, v), `קנית ${a.nameHe} ב-${v} שקלים!`)}>
                          {v} ₪
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>
        </div>
        <div className="step__nav">
          <button type="button" className="btn btn--primary btn--lg" onClick={onNext}>סיימתי לבחור ✅</button>
        </div>
      </section>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'market', label: '📈 לוח השוק' },
    { id: 'tree', label: '🌳 עץ החיסכון' },
    { id: 'business', label: '🍋 עסקים' },
    ...(child.tier === 'advanced' ? [{ id: 'portfolio' as Tab, label: '📊 התיק שלי' }] : []),
  ];

  return (
    <section className="step" aria-labelledby="act-h">
      <h2 id="act-h" className="step__title">🛒 פעולות</h2>
      <p className="cash-pill">מזומן פנוי: <strong>{money(child.cash)}</strong></p>
      {passiveBtn}

      <div className="tabs" role="tablist" aria-label="סוגי פעולות">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="tab" onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'market' && <MarketBoard child={child} family={family} onOpen={setTradeAsset} onWatch={(id) => mutate((c, f) => toggleWatch(c, f, id))} />}
        {tab === 'tree' && <TreePanel child={child} locked={locked} act={act} />}
        {tab === 'business' && <BusinessPanel child={child} family={family} locked={locked} act={act} />}
        {tab === 'portfolio' && <PortfolioPanel child={child} family={family} />}
      </div>

      <div className="step__nav">
        <button type="button" className="btn btn--primary btn--lg" onClick={onNext}>לסיכום התור ✅</button>
      </div>

      <TradeDialog
        key={tradeAsset ?? 'none'}
        asset={locked ? null : asset}
        cash={child.cash}
        held={asset ? child.holdings[asset.id] ?? 0 : 0}
        tier={child.tier}
        onClose={() => setTradeAsset(null)}
        onBuy={(amount) => {
          act((c, f) => void buyAsset(c, f, asset!.id, amount), `קנית ${asset!.nameHe} ב-${money(amount)}`);
          setTradeAsset(null);
        }}
        onSell={(u) => {
          act((c, f) => void sellAsset(c, f, asset!.id, u), `מכרת ${units(u)} יחידות של ${asset!.nameHe}`, { sold: true });
          setTradeAsset(null);
        }}
      />
    </section>
  );
}

function MarketBoard({ child, family, onOpen, onWatch }: { child: ChildProfile; family: FamilyGameState; onOpen: (id: string) => void; onWatch: (id: string) => void }) {
  const wImpact = weatherImpacts(family.weather);
  const sorted = [...family.assets].sort((a, b) => Number(child.watchlist.includes(b.id)) - Number(child.watchlist.includes(a.id)));
  return (
    <>
      <p className="muted">
        ⭐ = <Term k="watchlist" />. מומלץ לעקוב אחרי מניה כמה תורות לפני שקונים.
      </p>
      <ul className="board">
        {sorted.map((a) => (
          <StockCard key={a.id} asset={a} child={child} watched={child.watchlist.includes(a.id)} weatherBoost={wImpact[a.category] ?? 0} onOpen={() => onOpen(a.id)} onWatch={() => onWatch(a.id)} month={family.currentMonth} />
        ))}
      </ul>
    </>
  );
}

function StockCard({ asset, child, watched, weatherBoost, onOpen, onWatch, month }: { asset: MarketAsset; child: ChildProfile; watched: boolean; weatherBoost: number; onOpen: () => void; onWatch: () => void; month: number }) {
  const ch = priceChange(asset);
  const held = child.holdings[asset.id] ?? 0;
  const since = child.stats.watchSince[asset.id];
  return (
    <li className="stock">
      <div className="stock__inner">
        <div className="stock__head">
          <span className="stock__icon" aria-hidden="true">{asset.icon}</span>
          <div className="stock__title">
            <h3>{asset.nameHe}</h3>
            <span className="tag">{CATEGORY_LABEL_HE[asset.category]}</span>
          </div>
          <button type="button" className={`star${watched ? ' star--on' : ''}`} onClick={onWatch} aria-pressed={watched} aria-label={watched ? `להסיר את ${asset.nameHe} ממעקב` : `לעקוב אחרי ${asset.nameHe}`}>
            {watched ? '★' : '☆'}
          </button>
        </div>
        <div className="stock__price">
          <strong>{money(asset.currentPrice, true)}</strong>
          <span className={ch >= 0 ? 'up' : 'down'}>{ch >= 0 ? '▲' : '▼'} {pct(ch)}</span>
        </div>
        <Sparkline values={asset.priceHistory} />
        <div className="stock__meta">
          {held > 0 && <span>שלי: {money(held * asset.currentPrice)}</span>}
          {watched && since !== undefined && <span>⭐ במעקב {month - since} תורות</span>}
          {Math.abs(weatherBoost) > 0.004 && <span>{weatherBoost > 0 ? '☀️ מזג האוויר עוזר' : '🌧️ מזג האוויר מקשה'}</span>}
        </div>
        <button type="button" className="btn btn--sm" onClick={onOpen}>קנייה / מכירה</button>
      </div>
    </li>
  );
}

function TreePanel({ child, locked, act }: { child: ChildProfile; locked: boolean; act: (fn: (c: ChildProfile) => void, msg: string) => void }) {
  const [amount, setAmount] = useState(50);
  const max = Math.max(0, Math.floor(child.cash));
  const amt = Math.min(amount, max);
  const yearly = child.savingsTreeBalance * (Math.pow(1.006, 12) - 1);
  return (
    <div className="tree-panel">
      <div className="tree-panel__art">
        <SavingsTree balance={child.savingsTreeBalance} streakMonths={child.savingsStreakMonths} />
      </div>
      <div className="tree-panel__ctl">
        <p className="stat">{money(child.savingsTreeBalance, true)}</p>
        <p>
          העץ מקבל 0.6% <Term k="compound" /> כל חודש. רצף נוכחי: <strong>{child.savingsStreakMonths}</strong> חודשים 🪙
          <Speak text="עץ החיסכון מקבל ריבית קטנה כל חודש. אם לא מושכים ממנו, הריבית מרוויחה ריבית, והעץ גדל מהר יותר." />
        </p>
        {child.savingsTreeBalance > 0 && <p className="muted">אם לא תמשוך/י, בעוד 12 חודשים העץ יצמיח עוד כ-{money(yearly)}.</p>}
        <label className="field">
          <span>סכום: <strong>{money(amt)}</strong></span>
          <input type="range" min={1} max={Math.max(1, max)} value={amt} onChange={(e) => setAmount(Number(e.target.value))} disabled={max === 0} />
        </label>
        <div className="row">
          <button type="button" className="btn btn--primary" disabled={max === 0 || locked} onClick={() => act((c) => depositSavings(c, amt), `הפקדת ${money(amt)} בעץ 🌱`)}>
            להפקיד
          </button>
          <button type="button" className="btn" disabled={child.savingsTreeBalance <= 0 || locked} onClick={() => act((c) => withdrawSavings(c, Math.min(amt, c.savingsTreeBalance)), 'משכת מהעץ — רצף הריבית התחיל מחדש')}>
            למשוך (מאפס רצף)
          </button>
        </div>
      </div>
    </div>
  );
}

function BusinessPanel({ child, family, locked, act }: { child: ChildProfile; family: FamilyGameState; locked: boolean; act: (fn: (c: ChildProfile) => void, msg: string) => void }) {
  const income = monthlyPassiveIncome(child, family);
  return (
    <>
      <p>
        עסק קטן מכניס <Term k="dividend">הכנסה פסיבית</Term> כל חודש — גם כשאת/ה ישן/ה. הכנסה החודש: <strong className="up">{money(income)}</strong>
        {' '}· הוצאות קבועות: <strong className="down">{money(child.fixedMonthlyExpenses)}</strong>
      </p>
      <ul className="board">
        {PASSIVE_ASSETS.map((p) => {
          const owned = child.passiveAssets.filter((x) => x === p.id).length;
          return (
            <li key={p.id} className="stock">
              <div className="stock__inner">
                <div className="stock__head">
                  <span className="stock__icon" aria-hidden="true">{p.icon}</span>
                  <div className="stock__title">
                    <h3>{p.nameHe}</h3>
                    <span className="tag">{p.weatherSensitive ? 'תלוי מזג אוויר' : 'יציב'}</span>
                  </div>
                </div>
                <p className="muted">{p.descriptionHe}</p>
                <p>מחיר: <strong>{money(p.price)}</strong> · מכניס כ-<strong className="up">{money(p.baseMonthlyIncome)}</strong> בחודש ({pct(p.baseMonthlyIncome / p.price)})</p>
                <p className="muted">בערך {Math.ceil(p.price / p.baseMonthlyIncome)} חודשים עד שהעסק מחזיר את עצמו.</p>
                {owned > 0 && <p>יש לך: {owned} ✔</p>}
                <div className="row">
                  <button type="button" className="btn btn--primary btn--sm" disabled={child.cash < p.price || locked} onClick={() => act((c) => buyPassive(c, p.id), `קנית ${p.nameHe}! 🎉`)}>
                    לקנות
                  </button>
                  {owned > 0 && (
                    <button type="button" className="btn btn--sm" disabled={locked} onClick={() => act((c) => void sellPassive(c, p.id), `מכרת ${p.nameHe} ב-${money(p.price * PASSIVE_RESALE_FACTOR)}`)}>
                      למכור ({money(p.price * PASSIVE_RESALE_FACTOR)})
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function PortfolioPanel({ child, family }: { child: ChildProfile; family: FamilyGameState }) {
  const cats = categoriesHeld(child, family.assets);
  const stocks = holdingsValue(child, family.assets);
  const passive = monthlyPassiveIncome(child, family);
  const biz = passiveBookValue(child);
  const total = child.cash + child.savingsTreeBalance + stocks + biz;
  const slices = [
    { label: '💵 מזומן', v: child.cash, cls: 'cash' },
    { label: '🌳 עץ החיסכון', v: child.savingsTreeBalance, cls: 'tree' },
    { label: '📈 מניות וסלים', v: stocks, cls: 'stocks' },
    { label: '🍋 עסקים', v: biz, cls: 'biz' },
  ];
  return (
    <div className="portfolio">
      <article className="card">
        <h3>ביצועים לעומת המדד <Term k="benchmark">(?)</Term></h3>
        <PerformanceChart history={child.netWorthHistory} />
      </article>
      <div className="grid-2">
        <article className="card">
          <h3>הרכב התיק</h3>
          <div className="stack-bar" role="img" aria-label={slices.map((s) => `${s.label} ${Math.round((s.v / (total || 1)) * 100)} אחוז`).join(', ')}>
            {slices.map((s) => s.v > 0 && <span key={s.cls} className={`stack-bar__seg seg--${s.cls}`} style={{ flexGrow: s.v }} />)}
          </div>
          <ul className="ledger">
            {slices.map((s) => (
              <li key={s.cls}><span>{s.label}</span><span>{money(s.v)} ({pct(s.v / (total || 1)).replace('+', '')})</span></li>
            ))}
          </ul>
          <p>
            <Term k="diversification" />: {cats.length} סוגים{' '}
            {cats.length >= 3 ? <span className="up">— מפוזר היטב 🧩</span> : <span className="down">— כדאי לפזר יותר</span>}
          </p>
        </article>
        <article className="card">
          <h3>הכנסה פסיבית מול הוצאות קבועות</h3>
          <ul className="ledger">
            <li><span>הכנסה מעסקים</span><span className="up">{money(passive)}</span></li>
            <li><span>הוצאות קבועות</span><span className="down">{money(child.fixedMonthlyExpenses)}</span></li>
          </ul>
          <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(1, passive / (child.fixedMonthlyExpenses || 1)) * 100)}>
            <span style={{ transform: `scaleX(${Math.min(1, passive / (child.fixedMonthlyExpenses || 1))})` }} />
          </div>
          <p className="muted">
            {passive >= child.fixedMonthlyExpenses
              ? 'העסקים שלך מכסים את כל ההוצאות הקבועות — חופש כלכלי קטן! 🎉'
              : `העסקים מכסים ${Math.round((passive / (child.fixedMonthlyExpenses || 1)) * 100)}% מההוצאות הקבועות.`}
          </p>
        </article>
      </div>
    </div>
  );
}
