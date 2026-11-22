import type { AssetCategory, Bill, MacroEvent, MarketAsset, PassiveAssetDef } from '../types';

// ---------------------------------------------------------------------------
// Market assets (SPEC §5.3). Prices start in the 50–120 ₪ band.
// ---------------------------------------------------------------------------
type AssetSeed = Omit<MarketAsset, 'currentPrice' | 'priceHistory'>;

export const ASSET_SEEDS: AssetSeed[] = [
  {
    id: 'market_index',
    nameHe: 'סל השוק הכללי',
    icon: '🧺',
    descriptionHe: 'סל שיש בו קצת מכל החברות. עולה לאט ובטוח לאורך זמן.',
    category: 'index',
    basePrice: 100,
    baseDrift: 0.007,
    volatility: 0.02,
  },
  {
    id: 'super_shchuna',
    nameHe: 'סופר-שכונה',
    icon: '🛒',
    descriptionHe: 'מכולת השכונה. אנשים תמיד קונים לחם וחלב — יציב גם בזמנים קשים.',
    category: 'staples',
    basePrice: 60,
    baseDrift: 0.004,
    volatility: 0.012,
  },
  {
    id: 'power_fuel',
    nameHe: 'חשמל ואנרגיה',
    icon: '⚡',
    descriptionHe: 'חברת החשמל והדלק. עולה כשחם מאוד או קר מאוד וכולם מדליקים מזגן.',
    category: 'energy',
    basePrice: 80,
    baseDrift: 0.005,
    volatility: 0.035,
  },
  {
    id: 'shield_medcare',
    nameHe: 'כיפת-מגן ורפואת-חירום',
    icon: '🛡️',
    descriptionHe: 'מגינים ומטפלים בזמני חירום. עולה כשיש מתיחות, יורדת מעט כשרגוע.',
    category: 'crisis',
    basePrice: 70,
    baseDrift: 0.004,
    volatility: 0.03,
  },
  {
    id: 'icecream_tourism',
    nameHe: 'גלידות ותיירות',
    icon: '🍦',
    descriptionHe: 'גלידריות, מלונות וטיולים. מזנקת בקיץ ובימים שקטים, צונחת בסערות.',
    category: 'leisure_tech',
    basePrice: 90,
    baseDrift: 0.009,
    volatility: 0.055,
  },
  {
    id: 'gaming',
    nameHe: 'גיימינג',
    icon: '🎮',
    descriptionHe: 'חברת משחקים. יכולה לגדול מהר — וגם ליפול מהר.',
    category: 'leisure_tech',
    basePrice: 110,
    baseDrift: 0.01,
    volatility: 0.06,
  },
];

export const INDEX_ASSET_ID = 'market_index';

export const CATEGORY_LABEL_HE: Record<AssetCategory, string> = {
  index: 'מדד כללי',
  staples: 'מוצרי יסוד',
  energy: 'אנרגיה',
  crisis: 'חירום והגנה',
  leisure_tech: 'פנאי וטכנולוגיה',
};

/** Simplified picks shown to Tier 1 kids (3–4 core actions per turn). */
export const EARLY_TIER_ASSETS = ['market_index', 'super_shchuna', 'icecream_tourism'];

// ---------------------------------------------------------------------------
// Passive income assets (SPEC §5.2): 400–800 ₪, ~4–6 % per month.
// ---------------------------------------------------------------------------
export const PASSIVE_ASSETS: PassiveAssetDef[] = [
  {
    id: 'lemonade_stand',
    nameHe: 'דוכן לימונדה',
    icon: '🍋',
    descriptionHe: 'מכניס כסף כל חודש. בימים חמים מוכרים יותר!',
    price: 400,
    baseMonthlyIncome: 20,
    weatherSensitive: true,
  },
  {
    id: 'popcorn_cart',
    nameHe: 'עגלת פופקורן',
    icon: '🍿',
    descriptionHe: 'פופקורן נמכר בכל מזג אוויר — הכנסה יציבה.',
    price: 550,
    baseMonthlyIncome: 25,
    weatherSensitive: false,
  },
  {
    id: 'slushie_machine',
    nameHe: 'מכונת ברד',
    icon: '🧊',
    descriptionHe: 'ברד קר ומתוק. בשרב — מכירות שיא, בחורף — שקט.',
    price: 700,
    baseMonthlyIncome: 38,
    weatherSensitive: true,
  },
];

/** Selling a passive business back returns less than you paid — it is not cash. */
export const PASSIVE_RESALE_FACTOR = 0.8;

// ---------------------------------------------------------------------------
// Economy constants (SPEC §5.1)
// ---------------------------------------------------------------------------
export const STARTING_CASH = 1000;
export const DEFAULT_ALLOWANCE = 150;
export const SAVINGS_TREE_MONTHLY_RATE = 0.006;
export const SAFETY_NET_THRESHOLD = 150;
export const MAX_CATCHUP_MONTHS = 6;
export const STREAK_BONUS = 20;
export const MISSION_BONUS = 15;
export const TURN_MINUTES = 15;

export const DEFAULT_BILLS: Bill[] = [
  { id: 'bill_snack', nameHe: 'ארוחת עשר', icon: '🥪', amount: 15, essential: true },
  { id: 'bill_bus', nameHe: 'כרטיס הסעה', icon: '🚌', amount: 15, essential: true },
  { id: 'bill_art', nameHe: 'חוג יצירה', icon: '🎨', amount: 20, essential: false },
];

// ---------------------------------------------------------------------------
// Macro events — kid-friendly translations of real-world themes (SPEC §6.2)
// ---------------------------------------------------------------------------
export const MACRO_EVENTS: MacroEvent[] = [
  {
    id: 'chip_shortage',
    icon: '🔌',
    titleHe: 'מחסור עולמי בשבבים',
    descriptionHe: 'המפעלים שמייצרים שבבים קטנים למחשבים מתעכבים. קשה יותר לייצר קונסולות משחק.',
    ttsTextHe: 'יש מחסור בשבבים למחשבים. חברות המשחקים מתקשות לייצר.',
    categoryImpacts: { leisure_tech: -0.06, index: -0.01 },
    severity: 'medium',
  },
  {
    id: 'energy_prices_up',
    icon: '⛽',
    titleHe: 'מחירי האנרגיה עולים',
    descriptionHe: 'בכל העולם צריכים יותר חשמל ודלק. חברות האנרגיה מרוויחות יותר החודש.',
    ttsTextHe: 'מחירי האנרגיה עולים. חברות החשמל מרוויחות יותר.',
    categoryImpacts: { energy: 0.07, staples: -0.01 },
    severity: 'low',
  },
  {
    id: 'security_tension',
    icon: '🛡️',
    titleHe: 'תקופה מתוחה',
    descriptionHe: 'יש מתיחות ביטחונית. אנשים נשארים יותר בבית, וחברות ההגנה והרפואה עסוקות מאוד.',
    ttsTextHe: 'יש תקופה מתוחה. חברות ההגנה עולות, והתיירות יורדת.',
    categoryImpacts: { crisis: 0.09, leisure_tech: -0.08, index: -0.03, staples: 0.01 },
    severity: 'high',
  },
  {
    id: 'market_correction',
    icon: '🌧️',
    titleHe: 'תיקון בשוק',
    descriptionHe: 'אחרי תקופה של עליות, המחירים בשוק יורדים קצת. זה קורה מדי פעם — ובדרך כלל זה עובר.',
    ttsTextHe: 'השוק ירד קצת. זה קורה מדי פעם, ובדרך כלל זה עובר. לא צריך להיבהל.',
    categoryImpacts: { index: -0.08, leisure_tech: -0.1, energy: -0.05, staples: -0.02, crisis: -0.02 },
    severity: 'high',
    isCorrection: true,
  },
  {
    id: 'calm_growth',
    icon: '☀️',
    titleHe: 'תקופה שקטה וטובה',
    descriptionHe: 'אנשים רגועים, יוצאים לטייל וקונים יותר. רוב החברות מרוויחות.',
    ttsTextHe: 'תקופה שקטה וטובה. אנשים יוצאים לטייל, ורוב החברות מרוויחות.',
    categoryImpacts: { leisure_tech: 0.07, index: 0.03, crisis: -0.03 },
    severity: 'low',
  },
  {
    id: 'new_game_hit',
    icon: '🕹️',
    titleHe: 'משחק חדש הפך ללהיט',
    descriptionHe: 'משחק חדש כובש את העולם. חברת הגיימינג מוכרת המון.',
    ttsTextHe: 'משחק חדש הפך ללהיט. חברת הגיימינג מוכרת המון.',
    categoryImpacts: { leisure_tech: 0.08 },
    severity: 'low',
  },
  {
    id: 'harvest_drought',
    icon: '🌾',
    titleHe: 'יבול חלש בשדות',
    descriptionHe: 'מעט גשם השנה, ולכן יש פחות חיטה. המחירים במכולת עולים קצת.',
    ttsTextHe: 'היה מעט גשם, ויש פחות חיטה. המכולת מעלה מחירים.',
    categoryImpacts: { staples: 0.04, index: -0.01 },
    severity: 'medium',
  },
  {
    id: 'big_storm_season',
    icon: '🌪️',
    titleHe: 'עונת סערות',
    descriptionHe: 'סערות חזקות סוגרות אתרי טיולים, אבל כולם מדליקים חימום.',
    ttsTextHe: 'יש סערות חזקות. התיירות יורדת, והחשמל עולה.',
    categoryImpacts: { leisure_tech: -0.06, energy: 0.05 },
    severity: 'medium',
  },
];

// ---------------------------------------------------------------------------
// Calendar milestones by Gregorian month (approximate, soft impacts)
// ---------------------------------------------------------------------------
export const CALENDAR_EVENTS: Record<number, { icon: string; titleHe: string; descriptionHe: string; impacts: Partial<Record<AssetCategory, number>> }> = {
  4: { icon: '🫓', titleHe: 'ההכנות לפסח', descriptionHe: 'משפחות קונות הרבה לחג — המכולות עמוסות.', impacts: { staples: 0.015 } },
  7: { icon: '🏖️', titleHe: 'החופש הגדול התחיל', descriptionHe: 'ילדים בחופש, משפחות יוצאות לטייל ולאכול גלידה.', impacts: { leisure_tech: 0.02 } },
  8: { icon: '🏖️', titleHe: 'שיא הקיץ', descriptionHe: 'עוד חודש של חופש — חוף, גלידה ומזגנים.', impacts: { leisure_tech: 0.015, energy: 0.01 } },
  9: { icon: '🎒', titleHe: 'חזרה לבית הספר', descriptionHe: 'קונים ציוד ומחברות. פחות טיולים, יותר מכולת.', impacts: { staples: 0.01, leisure_tech: -0.01 } },
  10: { icon: '🍂', titleHe: 'חגי תשרי', descriptionHe: 'משפחות מתארחות וקונות לחג.', impacts: { staples: 0.01 } },
  12: { icon: '🕎', titleHe: 'חנוכה', descriptionHe: 'סופגניות, מתנות ומשחקים — חנויות המשחקים שמחות.', impacts: { leisure_tech: 0.01, staples: 0.005 } },
};

// ---------------------------------------------------------------------------
// Personal life events (SPEC §6.3) — delivered to the child's inbox.
// ---------------------------------------------------------------------------
export interface LifeEventDef {
  id: string;
  kind: 'expense' | 'income';
  icon: string;
  titleHe: string;
  bodyHe: string;
  amount: number;
}

export const LIFE_EVENTS: LifeEventDef[] = [
  { id: 'bike_chain', kind: 'expense', icon: '🚲', titleHe: 'שרשרת האופניים נקרעה', bodyHe: 'צריך לתקן את האופניים כדי להגיע לחוג.', amount: 40 },
  { id: 'lost_book', kind: 'expense', icon: '📕', titleHe: 'ספר מהספרייה אבד', bodyHe: 'הספרייה מבקשת לשלם על ספר חדש.', amount: 25 },
  { id: 'gift_friend', kind: 'expense', icon: '🎁', titleHe: 'יום הולדת לחבר', bodyHe: 'הוזמנת ליום הולדת — קונים מתנה קטנה.', amount: 30 },
  { id: 'broken_bottle', kind: 'expense', icon: '🧴', titleHe: 'בקבוק המים נשבר', bodyHe: 'צריך בקבוק חדש לבית הספר.', amount: 20 },
  { id: 'neighbor_garden', kind: 'income', icon: '🌻', titleHe: 'עזרת לשכן בגינה', bodyHe: 'השכן מודה לך ומשלם על העזרה.', amount: 60 },
  { id: 'art_fair', kind: 'income', icon: '🖼️', titleHe: 'מכרת ציורים ביריד', bodyHe: 'הציורים שלך מצאו חן בעיני הקונים!', amount: 40 },
  { id: 'found_coins', kind: 'income', icon: '🪙', titleHe: 'מצאת מטבעות בכיס המעיל', bodyHe: 'הפתעה קטנה מהחורף שעבר.', amount: 15 },
];

// ---------------------------------------------------------------------------
// Cosmetics (zero-inflation rewards, SPEC §9.1) — unlocked by XP.
// ---------------------------------------------------------------------------
export interface CosmeticDef {
  id: string;
  icon: string;
  nameHe: string;
  xpRequired: number;
}

export const COSMETICS: CosmeticDef[] = [
  { id: 'cap', icon: '🧢', nameHe: 'כובע מצחייה', xpRequired: 40 },
  { id: 'glasses', icon: '🕶️', nameHe: 'משקפי שמש', xpRequired: 100 },
  { id: 'medal', icon: '🏅', nameHe: 'מדליה', xpRequired: 200 },
  { id: 'tophat', icon: '🎩', nameHe: 'כובע משקיע', xpRequired: 350 },
  { id: 'crown', icon: '👑', nameHe: 'כתר', xpRequired: 600 },
];

export const AVATARS: Record<string, { emoji: string; color: string }> = {
  lion: { emoji: '🦁', color: '#f6c453' },
  bear: { emoji: '🐻', color: '#c8936b' },
  fox: { emoji: '🦊', color: '#f29a5b' },
  panda: { emoji: '🐼', color: '#c9d4dc' },
  owl: { emoji: '🦉', color: '#b79ad8' },
  koala: { emoji: '🐨', color: '#9fb7c9' },
  frog: { emoji: '🐸', color: '#8fd18f' },
  turtle: { emoji: '🐢', color: '#7cc7a8' },
  rabbit: { emoji: '🐰', color: '#f3b8c8' },
};
