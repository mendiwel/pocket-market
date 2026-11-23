import type { ChildProfile, FamilyGameState, InboxItem, MarketAsset } from '../types';
import {
  DONATION_XP_PER_SHEKEL,
  INDEX_ASSET_ID,
  LIFE_EVENTS,
  MAX_CATCHUP_MONTHS,
  MAX_DONATION_FRACTION,
  PASSIVE_ASSETS,
  PASSIVE_RESALE_FACTOR,
  SAVINGS_TREE_MONTHLY_RATE,
} from './catalog';
import { round2 } from './format';
import { assetById } from './market';
import { pick, randInt, seededRng } from './rng';
import { passiveWeatherMultiplier } from './weather';

const EPS = 1e-6;

export function holdingsValue(child: ChildProfile, assets: MarketAsset[]): number {
  return Object.entries(child.holdings).reduce((sum, [id, u]) => {
    const a = assets.find((x) => x.id === id);
    return sum + (a ? a.currentPrice * u : 0);
  }, 0);
}

export function passiveBookValue(child: ChildProfile): number {
  return child.passiveAssets.reduce((s, id) => s + (PASSIVE_ASSETS.find((p) => p.id === id)?.price ?? 0), 0);
}

export function netWorth(child: ChildProfile, assets: MarketAsset[]): number {
  return round2(child.cash + child.savingsTreeBalance + holdingsValue(child, assets) + passiveBookValue(child));
}

/** Distinct asset categories held — stock sectors plus savings tree and passive businesses. */
export function categoriesHeld(child: ChildProfile, assets: MarketAsset[]): string[] {
  const cats = new Set<string>();
  for (const [id, u] of Object.entries(child.holdings)) {
    if (u > EPS) {
      const a = assets.find((x) => x.id === id);
      if (a) cats.add(a.category);
    }
  }
  if (child.savingsTreeBalance > EPS) cats.add('savings');
  if (child.passiveAssets.length > 0) cats.add('passive');
  return [...cats];
}

export function hasStocks(child: ChildProfile): boolean {
  return Object.values(child.holdings).some((u) => u > EPS);
}

export function syncExpenses(child: ChildProfile): void {
  child.fixedMonthlyExpenses = child.bills.reduce((s, b) => s + b.amount, 0);
}

export function monthlyPassiveIncome(child: ChildProfile, family: Pick<FamilyGameState, 'weather'>): number {
  const mult = passiveWeatherMultiplier(family.weather);
  return round2(
    child.passiveAssets.reduce((s, id) => {
      const def = PASSIVE_ASSETS.find((p) => p.id === id);
      if (!def) return s;
      return s + def.baseMonthlyIncome * (def.weatherSensitive ? mult : 1);
    }, 0),
  );
}

// ---------------------------------------------------------------------------
// Paying for things: cash first, then the savings tree, then selling stocks.
// This is the emergency-fund lesson made concrete.
// ---------------------------------------------------------------------------
export interface ChargeResult {
  fromCash: number;
  fromSavings: number;
  soldAssets: { assetId: string; units: number; amount: number }[];
  unpaid: number;
}

export function chargeChild(child: ChildProfile, amount: number, assets: MarketAsset[]): ChargeResult {
  let remaining = round2(amount);
  const result: ChargeResult = { fromCash: 0, fromSavings: 0, soldAssets: [], unpaid: 0 };

  const cashPart = Math.min(Math.max(child.cash, 0), remaining);
  child.cash = round2(child.cash - cashPart);
  result.fromCash = cashPart;
  remaining = round2(remaining - cashPart);

  if (remaining > 0 && child.savingsTreeBalance > 0) {
    const part = Math.min(child.savingsTreeBalance, remaining);
    child.savingsTreeBalance = round2(child.savingsTreeBalance - part);
    child.savingsStreakMonths = 0;
    result.fromSavings = part;
    remaining = round2(remaining - part);
  }

  if (remaining > 0) {
    // Forced sale — sell the largest position first.
    const positions = Object.entries(child.holdings)
      .map(([id, u]) => ({ id, u, a: assets.find((x) => x.id === id) }))
      .filter((p) => p.a && p.u > EPS)
      .sort((x, y) => y.u * y.a!.currentPrice - x.u * x.a!.currentPrice);
    for (const p of positions) {
      if (remaining <= 0) break;
      const value = p.u * p.a!.currentPrice;
      const take = Math.min(value, remaining);
      const unitsSold = take / p.a!.currentPrice;
      child.holdings[p.id] = Math.max(0, p.u - unitsSold);
      if (child.holdings[p.id] < EPS) delete child.holdings[p.id];
      result.soldAssets.push({ assetId: p.id, units: unitsSold, amount: round2(take) });
      remaining = round2(remaining - take);
    }
  }

  if (remaining > 0) {
    // Nothing left to sell: allow a small negative cash balance (a "debt")
    // that next month's allowance repays. Price floors keep this rare.
    child.cash = round2(child.cash - remaining);
    result.unpaid = remaining;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Monthly settlement (Morning Briefing)
// ---------------------------------------------------------------------------
export interface SettlementSummary {
  months: number;
  allowance: number;
  passiveIncome: number;
  expenses: number;
  interest: number;
  charge: ChargeResult | null;
  netWorthBefore: number;
  netWorthAfter: number;
  newInboxItems: InboxItem[];
}

function addBenchmarkFlow(child: ChildProfile, family: FamilyGameState, flow: number) {
  const index = assetById(family, INDEX_ASSET_ID);
  if (!index) return;
  child.stats.benchmarkUnits = Math.max(0, child.stats.benchmarkUnits + flow / index.currentPrice);
}

export function benchmarkValue(child: ChildProfile, family: FamilyGameState): number {
  const index = assetById(family, INDEX_ASSET_ID);
  return round2(index ? child.stats.benchmarkUnits * index.currentPrice : 0);
}

function generateInboxEvents(child: ChildProfile, family: FamilyGameState, month: number): InboxItem[] {
  const rng = seededRng('life', family.familyId, child.id, month);
  const items: InboxItem[] = [];
  if (rng() < 0.3) {
    const ev = pick(rng, LIFE_EVENTS);
    items.push({
      id: `ev-${month}-${ev.id}`,
      kind: ev.kind,
      icon: ev.icon,
      titleHe: ev.titleHe,
      bodyHe: ev.bodyHe,
      amount: ev.amount,
      createdMonth: month,
      resolved: false,
    });
  }
  const hasOpenHike = child.inbox.some((i) => i.kind === 'price_hike' && !i.resolved);
  if (!hasOpenHike && child.bills.length > 0 && rng() < 0.15) {
    const bill = pick(rng, child.bills);
    const hike = randInt(rng, 4, 8);
    items.push({
      id: `hike-${month}-${bill.id}`,
      kind: 'price_hike',
      icon: '📨',
      titleHe: `הודעה מ${bill.nameHe}`,
      bodyHe: `המחיר החודשי של ${bill.nameHe} עומד לעלות ב-${hike} ₪. אפשר לדבר עם הנציג.`,
      amount: hike,
      billId: bill.id,
      createdMonth: month,
      resolved: false,
    });
  }
  return items;
}

/**
 * Credit every game month the child has not yet collected (capped), applying
 * allowance, passive income, fixed expenses and savings-tree interest.
 */
export function settleChild(child: ChildProfile, family: FamilyGameState): SettlementSummary {
  const netWorthBefore = netWorth(child, family.assets);
  const pending = family.currentMonth - child.stats.lastSettledMonth;
  const months = Math.max(0, Math.min(pending, MAX_CATCHUP_MONTHS));
  const summary: SettlementSummary = {
    months,
    allowance: 0,
    passiveIncome: 0,
    expenses: 0,
    interest: 0,
    charge: null,
    netWorthBefore,
    netWorthAfter: netWorthBefore,
    newInboxItems: [],
  };
  if (months === 0) return summary;

  syncExpenses(child);
  const allowance = family.settings.monthlyAllowance;
  const passive = monthlyPassiveIncome(child, family);

  for (let i = 0; i < months; i++) {
    const month = family.currentMonth - months + 1 + i;
    if (child.savingsTreeBalance > 0) {
      const interest = round2(child.savingsTreeBalance * SAVINGS_TREE_MONTHLY_RATE);
      child.savingsTreeBalance = round2(child.savingsTreeBalance + interest);
      child.savingsStreakMonths += 1;
      summary.interest = round2(summary.interest + interest);
    }
    summary.allowance += allowance;
    summary.passiveIncome = round2(summary.passiveIncome + passive);
    summary.expenses += child.fixedMonthlyExpenses;
    const items = generateInboxEvents(child, family, month);
    child.inbox.push(...items);
    summary.newInboxItems.push(...items);
  }

  child.cash = round2(child.cash + summary.allowance + summary.passiveIncome);
  summary.charge = chargeChild(child, summary.expenses, family.assets);
  addBenchmarkFlow(child, family, summary.allowance - summary.expenses);

  child.stats.lastSettledMonth = family.currentMonth;
  // Keep the inbox tidy: drop resolved items older than a few months.
  child.inbox = child.inbox.filter((i) => !i.resolved || family.currentMonth - i.createdMonth < 3);

  summary.netWorthAfter = netWorth(child, family.assets);
  recordNetWorth(child, family);
  return summary;
}

export function recordNetWorth(child: ChildProfile, family: FamilyGameState): void {
  const entry = {
    month: family.currentMonth,
    totalValue: netWorth(child, family.assets),
    indexBenchmark: benchmarkValue(child, family),
  };
  const last = child.netWorthHistory.at(-1);
  if (last && last.month === entry.month) child.netWorthHistory[child.netWorthHistory.length - 1] = entry;
  else child.netWorthHistory.push(entry);
  if (child.netWorthHistory.length > 120) child.netWorthHistory.shift();
}

// ---------------------------------------------------------------------------
// Inbox resolution
// ---------------------------------------------------------------------------
export function resolveInboxMoney(child: ChildProfile, family: FamilyGameState, itemId: string): ChargeResult | null {
  const item = child.inbox.find((i) => i.id === itemId);
  if (!item || item.resolved) return null;
  item.resolved = true;
  if (item.kind === 'income' || item.kind === 'parent_bonus') {
    child.cash = round2(child.cash + item.amount);
    addBenchmarkFlow(child, family, item.amount);
    return null;
  }
  if (item.kind === 'expense') {
    addBenchmarkFlow(child, family, -item.amount);
    return chargeChild(child, item.amount, family.assets);
  }
  return null;
}

export function applyNegotiationOutcome(
  child: ChildProfile,
  itemId: string,
  outcome: { finalAmount: number; cancelled: boolean; win: boolean },
): void {
  const item = child.inbox.find((i) => i.id === itemId);
  if (!item || item.resolved) return;
  item.resolved = true;
  if (outcome.cancelled) child.bills = child.bills.filter((b) => b.id !== item.billId);
  else {
    const bill = child.bills.find((b) => b.id === item.billId);
    if (bill) bill.amount = Math.max(0, Math.round(outcome.finalAmount));
  }
  if (outcome.win) child.stats.negotiationWins += 1;
  syncExpenses(child);
}

// ---------------------------------------------------------------------------
// Trades & savings
// ---------------------------------------------------------------------------
export class TradeError extends Error {}

export function buyAsset(child: ChildProfile, family: FamilyGameState, assetId: string, amount: number): number {
  const asset = assetById(family, assetId);
  if (!asset) throw new TradeError('נכס לא קיים');
  amount = round2(amount);
  if (amount <= 0) throw new TradeError('צריך לבחור סכום');
  if (amount > child.cash + EPS) throw new TradeError('אין מספיק מזומן');
  const u = amount / asset.currentPrice;
  child.cash = round2(child.cash - amount);
  child.holdings[assetId] = (child.holdings[assetId] ?? 0) + u;
  const since = child.stats.watchSince[assetId];
  if (since !== undefined && family.currentMonth - since >= 2) child.stats.boughtAfterWatching = true;
  return u;
}

export function sellAsset(child: ChildProfile, family: FamilyGameState, assetId: string, unitsToSell: number): number {
  if (unitsToSell <= 0 || !Number.isFinite(unitsToSell)) throw new TradeError('כמות לא תקינה');
  const asset = assetById(family, assetId);
  const held = child.holdings[assetId] ?? 0;
  if (!asset || held <= EPS) throw new TradeError('אין לך יחידות של הנכס הזה');
  const u = Math.min(held, unitsToSell);
  const proceeds = round2(u * asset.currentPrice);
  child.holdings[assetId] = held - u;
  if (child.holdings[assetId] < EPS) delete child.holdings[assetId];
  child.cash = round2(child.cash + proceeds);
  return proceeds;
}

export function depositSavings(child: ChildProfile, amount: number): void {
  amount = round2(amount);
  if (amount <= 0 || amount > child.cash + EPS) throw new TradeError('אין מספיק מזומן');
  child.cash = round2(child.cash - amount);
  child.savingsTreeBalance = round2(child.savingsTreeBalance + amount);
  child.stats.savingsDeposits += 1;
}

export function withdrawSavings(child: ChildProfile, amount: number): void {
  amount = round2(Math.min(amount, child.savingsTreeBalance));
  if (amount <= 0) throw new TradeError('אין כסף בעץ');
  child.savingsTreeBalance = round2(child.savingsTreeBalance - amount);
  child.cash = round2(child.cash + amount);
  child.savingsStreakMonths = 0;
}

export function buyPassive(child: ChildProfile, passiveId: string): void {
  const def = PASSIVE_ASSETS.find((p) => p.id === passiveId);
  if (!def) throw new TradeError('עסק לא קיים');
  if (def.price > child.cash + EPS) throw new TradeError('אין מספיק מזומן');
  child.cash = round2(child.cash - def.price);
  child.passiveAssets.push(passiveId);
}

export function sellPassive(child: ChildProfile, passiveId: string): number {
  const idx = child.passiveAssets.indexOf(passiveId);
  const def = PASSIVE_ASSETS.find((p) => p.id === passiveId);
  if (idx < 0 || !def) throw new TradeError('אין לך את העסק הזה');
  child.passiveAssets.splice(idx, 1);
  const proceeds = round2(def.price * PASSIVE_RESALE_FACTOR);
  child.cash = round2(child.cash + proceeds);
  return proceeds;
}

export function toggleWatch(child: ChildProfile, family: FamilyGameState, assetId: string): boolean {
  if (child.watchlist.includes(assetId)) {
    child.watchlist = child.watchlist.filter((x) => x !== assetId);
    delete child.stats.watchSince[assetId];
    return false;
  }
  child.watchlist.push(assetId);
  child.stats.watchSince[assetId] = family.currentMonth;
  return true;
}

// ---------------------------------------------------------------------------
// Charity / Tithe donation (הפרשת תרומה / מעשר) — capped at 10% of monthly income
// ---------------------------------------------------------------------------

/** Total monthly income of the child (allowance + passive income). */
export function monthlyTotalIncome(child: ChildProfile, family: Pick<FamilyGameState, 'settings' | 'weather'>): number {
  return round2(family.settings.monthlyAllowance + monthlyPassiveIncome(child, family));
}

/** Maximum donation allowed per game month: 10% (עשירית) of monthly income. */
export function maxMonthlyDonation(child: ChildProfile, family: Pick<FamilyGameState, 'settings' | 'weather'>): number {
  return Math.max(1, Math.floor(monthlyTotalIncome(child, family) * MAX_DONATION_FRACTION));
}

/** How much the child has already donated in the current game month. */
export function donatedInCurrentMonth(child: ChildProfile, currentMonth: number): number {
  return child.stats.lastDonationMonth === currentMonth ? (child.stats.donatedThisMonth ?? 0) : 0;
}

/** Remaining donation allowance for the current game month. */
export function remainingMonthlyDonation(
  child: ChildProfile,
  family: Pick<FamilyGameState, 'settings' | 'weather' | 'currentMonth'>,
): number {
  const max = maxMonthlyDonation(child, family);
  const used = donatedInCurrentMonth(child, family.currentMonth);
  return Math.max(0, round2(max - used));
}

/**
 * Donate `amount` from cash to charity.
 * Enforces:
 * - amount > 0 and amount <= child.cash
 * - total donated in `family.currentMonth` does not exceed 10% of monthly income.
 * Returns the XP stars earned immediately from this donation.
 */
export function donateCharity(
  child: ChildProfile,
  family: Pick<FamilyGameState, 'settings' | 'weather' | 'currentMonth'>,
  amount: number,
): { donated: number; xpEarned: number; remainingAllowance: number } {
  amount = round2(amount);
  if (amount <= 0 || !Number.isFinite(amount)) throw new TradeError('צריך לבחור סכום לתרומה');
  if (amount > child.cash + EPS) throw new TradeError('אין מספיק מזומן לתרומה');

  const max = maxMonthlyDonation(child, family);
  const used = donatedInCurrentMonth(child, family.currentMonth);
  const remaining = round2(max - used);
  if (amount > remaining + EPS) {
    throw new TradeError(`אפשר לתרום עד עשירית מההכנסה החודשית (${max} ₪ בחודש)`);
  }

  child.cash = round2(child.cash - amount);
  if (child.stats.lastDonationMonth !== family.currentMonth) {
    child.stats.lastDonationMonth = family.currentMonth;
    child.stats.donatedThisMonth = 0;
    child.stats.donationTurns = (child.stats.donationTurns ?? 0) + 1;
  }
  child.stats.donatedThisMonth = round2((child.stats.donatedThisMonth ?? 0) + amount);
  child.stats.totalDonated = round2((child.stats.totalDonated ?? 0) + amount);

  const xpEarned = Math.max(1, Math.round(amount * DONATION_XP_PER_SHEKEL));
  child.xp += xpEarned;

  return {
    donated: amount,
    xpEarned,
    remainingAllowance: Math.max(0, round2(max - child.stats.donatedThisMonth)),
  };
}
