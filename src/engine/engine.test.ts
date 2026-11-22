import { describe, expect, it } from 'vitest';
import type { FamilyGameState, WeatherContext } from '../types';
import { addDays } from './date';
import { MACRO_EVENTS } from './catalog';
import { advanceMarketOneMonth, ensureMarketTick, PRICE_CEILING, PRICE_FLOOR, trendPrice } from './market';
import { getNegotiationProvider } from './negotiation';
import {
  buyAsset,
  categoriesHeld,
  chargeChild,
  depositSavings,
  netWorth,
  sellAsset,
  settleChild,
  withdrawSavings,
} from './portfolio';
import { emptySession, finishTurn } from './rewards';
import { createFamily, SEED_CHILDREN } from './seed';

const mild = (date: string): WeatherContext => ({ date, temperatureC: 22, condition: 'mild', season: 'spring', source: 'seasonal-fallback' });

function family(id = 'fam-test'): FamilyGameState {
  return createFamily({ familyId: id, familyNameHe: 'בדיקה', today: '2026-01-01', parentPinHash: 'x', children: SEED_CHILDREN });
}

function runMonths(f: FamilyGameState, n: number) {
  let date = f.lastMarketTickDate;
  for (let i = 0; i < n; i++) {
    date = addDays(date, 1);
    ensureMarketTick(f, date, mild(date));
  }
}

describe('market engine', () => {
  it('is deterministic for the same family', () => {
    const a = family();
    const b = family();
    runMonths(a, 30);
    runMonths(b, 30);
    expect(a.assets.map((x) => x.currentPrice)).toEqual(b.assets.map((x) => x.currentPrice));
    expect(a.news.map((n) => n.id)).toEqual(b.news.map((n) => n.id));
  });

  it('differs between families', () => {
    const a = family('a');
    const b = family('b');
    runMonths(a, 12);
    runMonths(b, 12);
    expect(a.assets[0].currentPrice).not.toEqual(b.assets[0].currentPrice);
  });

  it('keeps every price within its floor/ceiling band around trend', () => {
    const f = family();
    for (let m = 1; m <= 240; m++) {
      advanceMarketOneMonth(f, '2026-03-15', mild('2026-03-15'));
      for (const a of f.assets) {
        const t = trendPrice(a, m);
        expect(a.currentPrice).toBeGreaterThanOrEqual(t * PRICE_FLOOR - 0.01);
        expect(a.currentPrice).toBeLessThanOrEqual(t * PRICE_CEILING + 0.01);
      }
    }
  });

  it('mean-reverts: long-run index stays near trend (no runaway inflation/deflation)', () => {
    const ratios: number[] = [];
    for (let s = 0; s < 20; s++) {
      const f = family(`seed-${s}`);
      for (let m = 1; m <= 60; m++) advanceMarketOneMonth(f, '2026-03-15', mild('2026-03-15'));
      const idx = f.assets.find((a) => a.id === 'market_index')!;
      ratios.push(idx.currentPrice / trendPrice(idx, 60));
    }
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    expect(avg).toBeGreaterThan(0.85);
    expect(avg).toBeLessThan(1.15);
  });

  it('spaces macro events 3–6 months and never chains high-severity events', () => {
    const f = family('guardrails');
    const fired: { month: number; severity: string }[] = [];
    for (let m = 1; m <= 600; m++) {
      advanceMarketOneMonth(f, '2026-03-15', mild('2026-03-15'));
      if (f.activeMacroEvent) fired.push({ month: f.currentMonth, severity: f.activeMacroEvent.severity });
    }
    expect(fired.length).toBeGreaterThan(80);
    for (let i = 1; i < fired.length; i++) {
      const gap = fired[i].month - fired[i - 1].month;
      expect(gap).toBeGreaterThanOrEqual(3);
      expect(gap).toBeLessThanOrEqual(6);
      expect(fired[i].severity === 'high' && fired[i - 1].severity === 'high').toBe(false);
    }
    expect(new Set(fired.map((e) => e.severity)).size).toBe(3);
    expect(MACRO_EVENTS.length).toBeGreaterThan(5);
  });

  it('ticks once per calendar day and caps catch-up months', () => {
    const f = family();
    expect(ensureMarketTick(f, '2026-01-01', mild('2026-01-01'))).toBe(0);
    expect(ensureMarketTick(f, '2026-01-02', mild('2026-01-02'))).toBe(1);
    expect(ensureMarketTick(f, '2026-01-02', mild('2026-01-02'))).toBe(0);
    expect(ensureMarketTick(f, '2026-02-15', mild('2026-02-15'))).toBe(6);
    expect(f.currentMonth).toBe(7);
  });
});

describe('child economy', () => {
  it('first briefing pays allowance minus fixed expenses', () => {
    const f = family();
    const c = f.children[0];
    const s = settleChild(c, f);
    expect(s.months).toBe(1);
    expect(s.allowance).toBe(150);
    expect(s.expenses).toBe(50);
    expect(c.cash).toBe(1100);
    expect(settleChild(c, f).months).toBe(0);
  });

  it('net disposable cash flow is ~90–110 ₪ per month', () => {
    const f = family();
    const c = f.children[0];
    settleChild(c, f);
    const flow = f.settings.monthlyAllowance - c.fixedMonthlyExpenses;
    expect(flow).toBeGreaterThanOrEqual(90);
    expect(flow).toBeLessThanOrEqual(110);
  });

  it('savings tree compounds at 0.6% and withdrawal resets the streak', () => {
    // Settle months one at a time like daily play.
    const f2 = family();
    const c2 = f2.children[0];
    settleChild(c2, f2);
    depositSavings(c2, 1000);
    for (let i = 0; i < 5; i++) {
      runMonths(f2, 1);
      settleChild(c2, f2);
    }
    expect(c2.savingsTreeBalance).toBeCloseTo(1000 * Math.pow(1.006, 5), 0);
    expect(c2.savingsStreakMonths).toBe(5);
    withdrawSavings(c2, 10);
    expect(c2.savingsStreakMonths).toBe(0);
  });

  it('charges cash first, then savings, then sells stocks', () => {
    const f = family();
    const c = f.children[0];
    c.cash = 300;
    buyAsset(c, f, 'market_index', 200); // 100 cash left
    depositSavings(c, 50); // 50 cash left
    const r = chargeChild(c, 180, f.assets);
    expect(r.fromCash).toBe(50);
    expect(r.fromSavings).toBe(50);
    expect(r.soldAssets[0].amount).toBe(80);
    expect(c.cash).toBe(0);
  });

  it('buy/sell round-trips and tracks diversification', () => {
    const f = family();
    const c = f.children[0];
    const u = buyAsset(c, f, 'super_shchuna', 120);
    expect(u).toBeCloseTo(2);
    buyAsset(c, f, 'gaming', 110);
    depositSavings(c, 10);
    expect(categoriesHeld(c, f.assets).length).toBe(3);
    expect(sellAsset(c, f, 'super_shchuna', 2)).toBe(120);
    expect(netWorth(c, f.assets)).toBe(1000);
    expect(() => buyAsset(c, f, 'gaming', 99999)).toThrow();
  });
});

describe('rewards', () => {
  it('builds daily streaks, XP and the 5-day micro bonus', () => {
    const f = family();
    const c = f.children[0];
    let day = '2026-01-01';
    let cashBefore = 0;
    for (let i = 1; i <= 5; i++) {
      cashBefore = c.cash;
      const r = finishTurn(c, f, { ...emptySession(), stayedPassive: true }, day);
      expect(r.newStreak).toBe(i);
      day = addDays(day, 1);
    }
    expect(c.cash - cashBefore).toBeGreaterThanOrEqual(20);
    expect(c.achievements).toContain('patience');
    expect(c.achievements).toContain('safety_net');
    expect(c.xp).toBeGreaterThan(100);
    expect(c.unlockedCosmetics.length).toBeGreaterThan(0);
  });

  it('resets the streak after a missed day', () => {
    const f = family();
    const c = f.children[0];
    finishTurn(c, f, emptySession(), '2026-01-01');
    finishTurn(c, f, emptySession(), '2026-01-02');
    expect(finishTurn(c, f, emptySession(), '2026-01-05').newStreak).toBe(1);
  });
});

describe('negotiation', () => {
  const bill = { id: 'b', nameHe: 'חוג', icon: '🎨', amount: 20, essential: false };
  const essential = { ...bill, essential: true };
  const p = getNegotiationProvider();

  it('offers 3 options to early learners and 4 to older kids', async () => {
    expect((await p.start({ bill, hikeAmount: 6, tier: 'early', childName: 'א' })).options).toHaveLength(3);
    expect((await p.start({ bill, hikeAmount: 6, tier: 'advanced', childName: 'א' })).options).toHaveLength(4);
  });

  it('calls the bluff on essential services', async () => {
    const ctx = { bill: essential, hikeAmount: 6, tier: 'intermediate' as const, childName: 'א' };
    const s1 = await p.respond(ctx, [{ optionId: 'threaten' }]);
    expect(s1.outcome).toBeUndefined();
    const s2 = await p.respond(ctx, [{ optionId: 'threaten' }, { optionId: s1.options[0].id }]);
    expect(s2.outcome).toMatchObject({ finalAmount: 26, win: false });
  });

  it('rewards politeness and research', async () => {
    const ctx = { bill, hikeAmount: 6, tier: 'advanced' as const, childName: 'א' };
    const loyal = await p.respond(ctx, [{ optionId: 'polite' }, { optionId: 'loyal' }]);
    expect(loyal.outcome).toMatchObject({ finalAmount: 22, win: true });
    const comp = await p.respond(ctx, [{ optionId: 'competitor' }]);
    expect(comp.outcome).toMatchObject({ finalAmount: 18, win: true });
  });
});
