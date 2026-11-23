import type { AgeTier, ChildGender, ChildProfile, FamilyGameState, TtsSettings } from '../types';
import { DEFAULT_ALLOWANCE, DEFAULT_BILLS, STARTING_CASH } from './catalog';
import { createInitialAssets } from './market';
import { DEFAULT_LOCATION, seasonalFallback } from './weather';

export const DEFAULT_TTS_SETTINGS: TtsSettings = {
  engine: 'auto',
  geminiVoice: 'Aoede',
  browserVoiceGender: 'female',
  browserVoiceStyle: 'warm_female',
  browserVoiceName: '',
  dailyQuotaLimit: 120,
  perMinuteLimit: 15,
};

const FEMALE_NAMES = new Set([
  'תמר',
  'מאיה',
  'יעל',
  'נועה',
  'שירה',
  'טליה',
  'אביגיל',
  'איילה',
  'שרה',
  'רחל',
  'לאה',
  'רבקה',
  'מיכל',
  'דנה',
  'גפן',
  'עלמה',
  'אלה',
  'הדס',
  'רותם',
  'עדי',
  'נגה',
  'ליבי',
  'אסתר',
  'חנה',
  'מרים',
]);

export function inferGenderFromName(name: string): ChildGender {
  const clean = name.trim();
  if (FEMALE_NAMES.has(clean)) return 'female';
  return 'male';
}

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
  init: { id: string; name: string; age: number; gender?: ChildGender; avatarId: string; photoDataUrl?: string | null; tier?: AgeTier },
  currentMonth: number,
): ChildProfile {
  const bills = DEFAULT_BILLS.map((b) => ({ ...b }));
  return {
    id: init.id,
    name: init.name,
    age: init.age,
    gender: init.gender ?? inferGenderFromName(init.name),
    tier: init.tier ?? tierForAge(init.age),
    avatarId: init.avatarId,
    photoDataUrl: init.photoDataUrl ?? null,
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
      totalDonated: 0,
      donatedThisMonth: 0,
      lastDonationMonth: -1,
      donationTurns: 0,
    },
    lastTurnDate: null,
    netWorthHistory: [{ month: currentMonth, totalValue: STARTING_CASH, indexBenchmark: STARTING_CASH }],
  };
}

/** Default local seed family (SPEC §3): generic random sample children across the three tiers. */
export const SEED_CHILDREN: { id: string; name: string; age: number; gender: ChildGender; avatarId: string }[] = [
  { id: 'noam', name: 'נועם', age: 6, gender: 'male', avatarId: 'lion' },
  { id: 'tamar', name: 'תמר', age: 7, gender: 'female', avatarId: 'bear' },
  { id: 'itai', name: 'איתי', age: 8, gender: 'male', avatarId: 'fox' },
  { id: 'maya', name: 'מאיה', age: 9, gender: 'female', avatarId: 'rabbit' },
  { id: 'yael', name: 'יעל', age: 10, gender: 'female', avatarId: 'owl' },
  { id: 'roni', name: 'רוני', age: 11, gender: 'female', avatarId: 'koala' },
  { id: 'ori', name: 'אורי', age: 12, gender: 'male', avatarId: 'turtle' },
];

export function createFamily(opts: {
  familyId: string;
  familyNameHe: string;
  today: string;
  parentPinHash: string;
  children: { id: string; name: string; age: number; gender?: ChildGender; avatarId: string; tier?: AgeTier }[];
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
      tts: { ...DEFAULT_TTS_SETTINGS },
    },
    children: opts.children.map((c) => createChild(c, 0)),
  };
}
