import type { ChildProfile, FamilyGameState } from '../types';
import { COSMETICS, MISSION_BONUS, SAFETY_NET_THRESHOLD, STREAK_BONUS, type CosmeticDef } from './catalog';
import { addDays } from './date';
import { round2 } from './format';
import { categoriesHeld, hasStocks, recordNetWorth } from './portfolio';

/** What happened during a single turn — tracked in memory by the turn screen. */
export interface TurnSession {
  readNews: boolean;
  stayedPassive: boolean;
  soldStock: boolean;
  trades: number;
}

export const emptySession = (): TurnSession => ({ readNews: false, stayedPassive: false, soldStock: false, trades: 0 });

interface Ctx {
  child: ChildProfile;
  family: FamilyGameState;
  session: TurnSession;
}

export interface AchievementDef {
  id: string;
  icon: string;
  nameHe: string;
  criteriaHe: string;
  lessonHe: string;
  check: (c: Ctx) => boolean;
}

// SPEC §9.2
export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'calm_storm',
    icon: '🌊',
    nameHe: 'רגוע בסערה',
    criteriaHe: 'לא למכור מניות בזמן תיקון בשוק',
    lessonHe: 'לא מוכרים בבהלה — ירידות הן חלק מהדרך.',
    check: ({ child, family, session }) => !!family.activeMacroEvent?.isCorrection && hasStocks(child) && !session.soldStock,
  },
  {
    id: 'patience',
    icon: '🐢',
    nameHe: 'כוח הסבלנות',
    criteriaHe: 'לבחור "נשארים פסיביים היום" 3 פעמים',
    lessonHe: 'לא צריך לקנות ולמכור כל יום.',
    check: ({ child }) => child.stats.passiveChoices >= 3,
  },
  {
    id: 'safety_net',
    icon: '🥅',
    nameHe: 'רשת ביטחון',
    criteriaHe: 'להחזיק לפחות 150 ₪ במזומן 3 תורות ברצף',
    lessonHe: 'קרן חירום שומרת עליך מהפתעות.',
    check: ({ child }) => child.stats.cashStreak >= 3,
  },
  {
    id: 'tree_grower',
    icon: '🌳',
    nameHe: 'מגדל עצים',
    criteriaHe: 'לקבל ריבית בעץ החיסכון 5 חודשים ברצף בלי למשוך',
    lessonHe: 'ריבית דריבית — הכסף גדל על הכסף.',
    check: ({ child }) => child.savingsStreakMonths >= 5,
  },
  {
    id: 'negotiator',
    icon: '🤝',
    nameHe: 'אלוף המיקוח',
    criteriaHe: 'להוריד חשבון חודשי בשיחה עם נציג',
    lessonHe: 'שווה לבקש — הוצאות קבועות אפשר לשנות.',
    check: ({ child }) => child.stats.negotiationWins >= 1,
  },
  {
    id: 'passive_builder',
    icon: '🌙',
    nameHe: 'הכנסה בזמן שינה',
    criteriaHe: 'לקנות עסק ראשון שמכניס כסף כל חודש',
    lessonHe: 'נכסים שמייצרים הכנסה עובדים בשבילך.',
    check: ({ child }) => child.passiveAssets.length >= 1,
  },
  {
    id: 'diversifier',
    icon: '🧩',
    nameHe: 'פיזור חכם',
    criteriaHe: 'להחזיק לפחות 3 סוגי נכסים שונים בבת אחת',
    lessonHe: 'לא שמים את כל הביצים בסל אחד.',
    check: ({ child, family }) => categoriesHeld(child, family.assets).length >= 3,
  },
];

export interface MissionDef {
  id: string;
  icon: string;
  titleHe: string;
  progress: (child: ChildProfile) => [current: number, target: number];
}

// SPEC §7.4 — Guided Missions
export const MISSIONS: MissionDef[] = [
  {
    id: 'm_news',
    icon: '📰',
    titleHe: 'לקרוא את חדשות השוק 3 פעמים',
    progress: (c) => [Math.min(c.stats.newsReads, 3), 3],
  },
  {
    id: 'm_watch',
    icon: '⭐',
    titleHe: 'לעקוב אחרי מניה 2 תורות לפני שקונים אותה',
    progress: (c) => [c.stats.boughtAfterWatching ? 1 : 0, 1],
  },
  {
    id: 'm_tree',
    icon: '🌱',
    titleHe: 'להפקיד בעץ החיסכון ולתת לו לגדול 3 חודשים',
    progress: (c) => [Math.min(c.savingsTreeBalance > 0 ? c.savingsStreakMonths : 0, 3), 3],
  },
  {
    id: 'm_diverse',
    icon: '🧺',
    titleHe: 'להחזיק 3 סוגי נכסים במשך 5 תורות',
    progress: (c) => [Math.min(c.stats.diverseStreak, 5), 5],
  },
];

export interface TurnResult {
  xpGained: number;
  newStreak: number;
  bonusCash: number;
  newAchievements: AchievementDef[];
  newMissions: MissionDef[];
  newCosmetics: CosmeticDef[];
}

export function achievementById(id: string) {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/** Step 4 — End Turn: XP, streaks, achievements, missions and the turn lock. */
export function finishTurn(child: ChildProfile, family: FamilyGameState, session: TurnSession, today: string): TurnResult {
  const yesterday = addDays(today, -1);
  const newStreak = child.lastTurnDate === yesterday ? child.dailyStreak + 1 : child.lastTurnDate === today ? child.dailyStreak : 1;
  child.dailyStreak = newStreak;

  let xp = 10;
  if (session.readNews) xp += 5;
  if (session.stayedPassive) {
    xp += 10;
    child.stats.passiveChoices += 1;
  }
  xp += Math.min(newStreak, 5);
  child.xp += xp;

  child.stats.cashStreak = child.cash >= SAFETY_NET_THRESHOLD ? child.stats.cashStreak + 1 : 0;
  child.stats.diverseStreak = categoriesHeld(child, family.assets).length >= 3 ? child.stats.diverseStreak + 1 : 0;
  child.stats.turnsPlayed += 1;

  let bonusCash = 0;
  // Capped micro-cash: once per completed 5-day streak block.
  const blocks = Math.floor(newStreak / 5);
  if (newStreak > 0 && newStreak % 5 === 0 && blocks > 0) {
    bonusCash += STREAK_BONUS;
    child.stats.streakBonusesPaid += 1;
  }

  const ctx: Ctx = { child, family, session };
  const newAchievements = ACHIEVEMENTS.filter((a) => !child.achievements.includes(a.id) && a.check(ctx));
  child.achievements.push(...newAchievements.map((a) => a.id));

  const newMissions = MISSIONS.filter((m) => {
    if (child.completedMissions.includes(m.id)) return false;
    const [cur, target] = m.progress(child);
    return cur >= target;
  });
  child.completedMissions.push(...newMissions.map((m) => m.id));
  bonusCash += newMissions.length * MISSION_BONUS;
  child.cash = round2(child.cash + bonusCash);

  const newCosmetics = COSMETICS.filter((c) => child.xp >= c.xpRequired && !child.unlockedCosmetics.includes(c.id));
  child.unlockedCosmetics.push(...newCosmetics.map((c) => c.id));
  if (newCosmetics.length > 0) child.equippedAccessory = newCosmetics.at(-1)!.id;

  child.lastTurnDate = today;
  recordNetWorth(child, family);
  return { xpGained: xp, newStreak, bonusCash, newAchievements, newMissions, newCosmetics };
}
