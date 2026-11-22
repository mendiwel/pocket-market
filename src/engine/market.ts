import type { AssetCategory, FamilyGameState, MacroEvent, MarketAsset, NewsItem, WeatherContext } from '../types';
import { ASSET_SEEDS, CALENDAR_EVENTS, MACRO_EVENTS, MAX_CATCHUP_MONTHS } from './catalog';
import { daysBetween, monthOf } from './date';
import { round2 } from './format';
import { gaussian, pick, randInt, seededRng } from './rng';
import { WEATHER_LABEL, seasonalFallback, weatherImpacts } from './weather';

/** How strongly a price is pulled back toward its fundamental trend each month. */
export const MEAN_REVERSION = 0.12;
/** Price floor/ceiling relative to trend — kids are never wiped out (SPEC §6.3). */
export const PRICE_FLOOR = 0.45;
export const PRICE_CEILING = 2.2;
const MAX_HISTORY = 120;
const MAX_NEWS = 40;

export function createInitialAssets(): MarketAsset[] {
  return ASSET_SEEDS.map((a) => ({ ...a, currentPrice: a.basePrice, priceHistory: [a.basePrice] }));
}

export function trendPrice(asset: Pick<MarketAsset, 'basePrice' | 'baseDrift'>, month: number): number {
  return asset.basePrice * Math.pow(1 + asset.baseDrift, month);
}

function sumImpacts(...maps: Partial<Record<AssetCategory, number>>[]): Partial<Record<AssetCategory, number>> {
  const out: Partial<Record<AssetCategory, number>> = {};
  for (const m of maps) {
    for (const [k, v] of Object.entries(m) as [AssetCategory, number][]) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

/**
 * Picks a macro event for this month, honouring the guardrails:
 * events every 3–6 months, never two high-severity events back to back,
 * and at least 6 months between high-severity events.
 */
export function chooseMacroEvent(state: FamilyGameState, month: number): MacroEvent | null {
  if (month < state.nextMacroEventMonth) return null;
  const rng = seededRng('macro', state.familyId, month);
  const lastId = state.news.findLast((n) => n.source === 'macro')?.id.split(':')[1];
  const candidates = MACRO_EVENTS.filter((e) => {
    if (e.id === lastId) return false;
    if (e.severity !== 'high') return true;
    if (state.lastMacroSeverity === 'high') return false;
    return month - state.lastHighSeverityMonth >= 6;
  });
  const event = pick(rng, candidates);
  state.nextMacroEventMonth = month + randInt(rng, 3, 6);
  state.lastMacroSeverity = event.severity;
  if (event.severity === 'high') state.lastHighSeverityMonth = month;
  return event;
}

function pushNews(state: FamilyGameState, item: NewsItem) {
  state.news.push(item);
  if (state.news.length > MAX_NEWS) state.news.splice(0, state.news.length - MAX_NEWS);
}

/** Advance the shared family market by exactly one game month (mutates `state`). */
export function advanceMarketOneMonth(state: FamilyGameState, isoDate: string, weather: WeatherContext): void {
  const month = state.currentMonth + 1;
  const rng = seededRng('market', state.familyId, month);

  const event = chooseMacroEvent(state, month);
  state.activeMacroEvent = event;
  if (event) {
    pushNews(state, {
      id: `${month}:${event.id}`,
      month,
      icon: event.icon,
      titleHe: event.titleHe,
      descriptionHe: event.descriptionHe,
      source: 'macro',
    });
  }

  // Calendar milestones apply once per real-world month.
  const calKey = isoDate.slice(0, 7);
  let calendarImpacts: Partial<Record<AssetCategory, number>> = {};
  const cal = CALENDAR_EVENTS[monthOf(isoDate)];
  if (cal && state.lastCalendarKey !== calKey) {
    state.lastCalendarKey = calKey;
    calendarImpacts = cal.impacts;
    pushNews(state, { id: `${month}:cal-${calKey}`, month, icon: cal.icon, titleHe: cal.titleHe, descriptionHe: cal.descriptionHe, source: 'calendar' });
  }

  state.weather = weather;
  const wl = WEATHER_LABEL[weather.condition];
  if (weather.condition === 'heatwave' || weather.condition === 'storm') {
    pushNews(state, {
      id: `${month}:weather`,
      month,
      icon: wl.icon,
      titleHe: weather.condition === 'heatwave' ? 'שרב בחוץ!' : 'סערה בחוץ!',
      descriptionHe:
        weather.condition === 'heatwave'
          ? 'חם מאוד היום — גלידות, מזגנים ודוכני לימונדה עובדים שעות נוספות.'
          : 'סוער היום — פחות טיולים, יותר חימום בבתים.',
      source: 'weather',
    });
  }

  const impacts = sumImpacts(event?.categoryImpacts ?? {}, weatherImpacts(weather), calendarImpacts);

  for (const asset of state.assets) {
    const trend = trendPrice(asset, month);
    const shock = gaussian(rng) * asset.volatility;
    const impact = impacts[asset.category] ?? 0;
    const raw = asset.currentPrice * (1 + asset.baseDrift + shock + impact);
    const reverted = raw + (trend - raw) * MEAN_REVERSION;
    const bounded = Math.min(trend * PRICE_CEILING, Math.max(trend * PRICE_FLOOR, reverted));
    asset.currentPrice = round2(bounded);
    asset.priceHistory.push(asset.currentPrice);
    if (asset.priceHistory.length > MAX_HISTORY) asset.priceHistory.shift();
  }

  state.currentMonth = month;
}

/**
 * Lazy daily tick (SPEC §4.5): the first visit on a new calendar day advances
 * the market. One game month per real day missed, capped so a long vacation
 * does not produce a wall of surprises. Returns the number of months advanced.
 */
export function ensureMarketTick(state: FamilyGameState, today: string, todaysWeather: WeatherContext): number {
  if (state.lastMarketTickDate === today) return 0;
  const missed = Math.max(1, daysBetween(state.lastMarketTickDate, today));
  const months = Math.min(missed, MAX_CATCHUP_MONTHS);
  for (let i = months - 1; i >= 0; i--) {
    // Only today's weather is real; earlier catch-up months use the seasonal model.
    const w = i === 0 ? todaysWeather : seasonalFallback(today, `${state.familyId}-${i}`);
    advanceMarketOneMonth(state, today, w);
  }
  state.lastMarketTickDate = today;
  return months;
}

export function assetById(state: Pick<FamilyGameState, 'assets'>, id: string): MarketAsset | undefined {
  return state.assets.find((a) => a.id === id);
}

/** Fractional change over the last `months` game months. */
export function priceChange(asset: MarketAsset, months = 1): number {
  const h = asset.priceHistory;
  if (h.length < 2) return 0;
  const from = h[Math.max(0, h.length - 1 - months)];
  return from === 0 ? 0 : asset.currentPrice / from - 1;
}
