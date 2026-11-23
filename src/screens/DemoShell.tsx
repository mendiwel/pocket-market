import { useCallback, useMemo, useState } from 'react';
import { InMemoryDemoRepository } from '../data/InMemoryDemoRepository';
import { addDays, toISODate } from '../engine/date';
import { ensureMarketTick } from '../engine/market';
import { DEFAULT_PIN, hashPin } from '../engine/pin';
import { buyAsset, depositSavings, settleChild } from '../engine/portfolio';
import { createFamily } from '../engine/seed';
import { seasonalFallback } from '../engine/weather';
import { stopSpeaking } from '../hooks/tts';
import type { FamilyGameState } from '../types';
import { GameApp } from './GameApp';

const DEMO_KIDS = [
  { id: 'demo-early', name: 'נועם', age: 6, gender: 'male' as const, avatarId: 'lion', label: 'גיל 5–6', hint: 'הקראה אוטומטית, אייקונים, 3 פעולות' },
  { id: 'demo-mid', name: 'מאיה', age: 9, gender: 'female' as const, avatarId: 'rabbit', label: 'גיל 8–10', hint: 'אחוזים, מעקב, עסקים פסיביים' },
  { id: 'demo-adv', name: 'אורי', age: 12, gender: 'male' as const, avatarId: 'turtle', label: 'גיל 11–12', hint: 'גרפים, השוואה למדד, פיזור' },
];

/** Builds a demo family with ~8 months of history so charts have something to show. */
async function buildDemoFamily(realToday: string): Promise<FamilyGameState> {
  const start = addDays(realToday, -8);
  const f = createFamily({
    familyId: `demo-${realToday}`,
    familyNameHe: 'הדמו',
    today: start,
    parentPinHash: await hashPin(`demo-${realToday}`, DEFAULT_PIN),
    children: DEMO_KIDS,
  });
  const [early, mid, adv] = f.children;
  settleChild(early, f);
  settleChild(mid, f);
  settleChild(adv, f);
  depositSavings(early, 300);
  buyAsset(early, f, 'market_index', 200);
  depositSavings(mid, 250);
  buyAsset(mid, f, 'super_shchuna', 150);
  buyAsset(mid, f, 'icecream_tourism', 150);
  depositSavings(adv, 200);
  buyAsset(adv, f, 'market_index', 300);
  buyAsset(adv, f, 'gaming', 150);
  buyAsset(adv, f, 'power_fuel', 100);
  mid.watchlist.push('gaming');
  mid.stats.watchSince.gaming = 0;
  for (let d = 1; d < 8; d++) {
    const date = addDays(start, d);
    ensureMarketTick(f, date, seasonalFallback(date, f.familyId));
    for (const c of f.children) {
      settleChild(c, f);
      c.inbox = c.inbox.map((i) => ({ ...i, resolved: i.kind !== 'price_hike' ? true : i.resolved }));
    }
  }
  // Make sure every demo child meets the Virtual Rep today.
  for (const c of f.children) {
    c.inbox = c.inbox.filter((i) => !i.resolved && i.kind !== 'price_hike');
    const bill = c.bills[2];
    c.inbox.push({
      id: `demo-hike-${c.id}`,
      kind: 'price_hike',
      icon: '📨',
      titleHe: `הודעה מ${bill.nameHe}`,
      bodyHe: `המחיר החודשי של ${bill.nameHe} עומד לעלות ב-6 ₪. אפשר לדבר עם הנציג.`,
      amount: 6,
      billId: bill.id,
      createdMonth: f.currentMonth,
      resolved: false,
    });
  }
  return f;
}

export function DemoShell() {
  const realToday = useMemo(() => toISODate(new Date()), []);
  const [nonce, setNonce] = useState(0);
  const repo = useMemo(() => new InMemoryDemoRepository(), [nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const [offset, setOffset] = useState(0);
  const [childId, setChildId] = useState<string | undefined>(undefined);
  const [appKey, setAppKey] = useState(0);
  const today = addDays(realToday, offset);
  const createInitial = useCallback(() => buildDemoFamily(realToday), [realToday]);

  function openTier(id: string) {
    stopSpeaking();
    setChildId(id);
    setAppKey((k) => k + 1);
  }

  return (
    <div className="demo">
      <aside className="demo-bar" aria-label="פקדי הדמו">
        <div className="demo-bar__title">
          <strong>🧪 מצב דמו</strong>
          <span className="muted">שום דבר לא נשמר · {today}</span>
        </div>
        <div className="demo-bar__tiers" role="group" aria-label="בחירת גיל">
          {DEMO_KIDS.map((k) => (
            <button key={k.id} type="button" className="btn btn--sm" aria-pressed={childId === k.id} onClick={() => openTier(k.id)} title={k.hint}>
              {k.label}
            </button>
          ))}
        </div>
        <div className="row">
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={() => {
              stopSpeaking();
              setOffset((o) => o + 1);
              setChildId(undefined);
              setAppKey((k) => k + 1);
            }}
            title="מקדם את השוק בחודש (כאילו עבר יום)"
          >
            ⏩ לדלג לחודש הבא
          </button>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => {
              stopSpeaking();
              setNonce((n) => n + 1);
              setOffset(0);
              setChildId(undefined);
              setAppKey((k) => k + 1);
            }}
          >
            ↺ איפוס
          </button>
          <a className="btn btn--sm btn--ghost" href="#/">יציאה</a>
        </div>
      </aside>
      <GameApp
        key={`${nonce}-${appKey}`}
        repo={repo}
        mode="demo"
        today={today}
        createInitial={createInitial}
        offlineWeather
        forcedChildId={childId}
      />
    </div>
  );
}
