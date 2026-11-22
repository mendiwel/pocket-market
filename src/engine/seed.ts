import type { AgeTier, ChildProfile, FamilyGameState } from '../types';
import { DEFAULT_ALLOWANCE, DEFAULT_BILLS, STARTING_CASH } from './catalog';
import { createInitialAssets } from './market';
import { DEFAULT_LOCATION, seasonalFallback } from './weather';

export function tierForAge(age: number): AgeTier {
  if (age <= 7) return 'early';
  if (age <= 10) return 'intermediate';
  return 'advanced';
}

export const TIER_LABEL_HE: Record<AgeTier, string> = {
  early: 'צעירים (5–7)',
  intermediate: 'ביניים (8–10)',
  advanced: 'מתקדמים (11–12)',
};

export function createChild(
  init: { id: string; name: string; age: number; avatarId: string; tier?: AgeTier },
  currentMonth: number,
): ChildProfile {
  const bills = DEFAULT_BILLS.map((b) => ({ ...b }));
  return {
    id: init.id,
    name: init.name,
    age: init.age,
    tier: init.tier ?? tierForAge(init.age),
    avatarId: init.avatarId,
    cash: STARTING_CASH,
    savingsTreeBalance: 0,
    savingsStreakMonths: 0,
    holdings: {},
    watchlist: [],
    passiveAssets: [],
    bills,
    fixedMonthlyExpenses: bills.reduce((s, b) => s + b.amount, 0),
    inbox: [],
    xp: 0,
    dailyStreak: 0,
    unlockedCosmetics: [],
    equippedAccessory: null,
    achievements: [],
    completedMissions: [],
    stats: {
      // One month "owed" so the very first Morning Briefing pays an allowance.
      lastSettledMonth: currentMonth - 1,
      passiveChoices: 0,
      newsReads: 0,
      cashStreak: 0,
      diverseStreak: 0,
      negotiationWins: 0,
      benchmarkUnits: STARTING_CASH / 100, // index starts at 100 ₪
      watchSince: {},
      boughtAfterWatching: false,
      savingsDeposits: 0,
      streakBonusesPaid: 0,
      turnsPlayed: 0,
    },
    lastTurnDate: null,
    netWorthHistory: [{ month: currentMonth, totalValue: STARTING_CASH, indexBenchmark: STARTING_CASH }],
  };
}

/** Default local seed family (SPEC §3): 7 children across the three tiers. */
export const SEED_CHILDREN = [
  { id: 'yoel', name: 'יואל', age: 5, avatarId: 'lion' },
  { id: 'eliyahu', name: 'אליהו', age: 6, avatarId: 'bear' },
  { id: 'yosef', name: 'יוסף', age: 8, avatarId: 'fox' },
  { id: 'malki', name: 'מלכי', age: 9, avatarId: 'rabbit' },
  { id: 'dvora', name: 'דבורה', age: 10, avatarId: 'owl' },
  { id: 'chani', name: 'חני', age: 11, avatarId: 'koala' },
  { id: 'tzafrir', name: 'צפריר', age: 12, avatarId: 'turtle' },
];

export function createFamily(opts: {
  familyId: string;
  familyNameHe: string;
  today: string;
  parentPinHash: string;
  children: { id: string; name: string; age: number; avatarId: string; tier?: AgeTier }[];
}): FamilyGameState {
  return {
    schemaVersion: 1,
    familyId: opts.familyId,
    familyNameHe: opts.familyNameHe,
    parentPinHash: opts.parentPinHash,
    currentMonth: 0,
    lastMarketTickDate: opts.today,
    weather: seasonalFallback(opts.today, opts.familyId),
    assets: createInitialAssets(),
    activeMacroEvent: null,
    lastHighSeverityMonth: -99,
    lastMacroSeverity: null,
    nextMacroEventMonth: 3,
    news: [
      {
        id: '0:welcome',
        month: 0,
        icon: '🎉',
        titleHe: 'השוק נפתח!',
        descriptionHe: 'ברוכים הבאים לשוק הכיס. כל יום אמיתי הוא חודש במשחק — בואו נראה איך הכסף שלנו גדל.',
        source: 'family',
      },
    ],
    settings: {
      monthlyAllowance: DEFAULT_ALLOWANCE,
      latitude: DEFAULT_LOCATION.latitude,
      longitude: DEFAULT_LOCATION.longitude,
      locationNameHe: DEFAULT_LOCATION.nameHe,
    },
    children: opts.children.map((c) => createChild(c, 0)),
  };
}
