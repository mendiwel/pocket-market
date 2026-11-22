// Core data models — follows SPEC.md §12, extended with the fields the
// gameplay systems (inbox, missions, stats, settings) need.

export type AgeTier = 'early' | 'intermediate' | 'advanced';

export type WeatherCondition = 'sunny' | 'heatwave' | 'mild' | 'rainy' | 'storm';
export type Season = 'summer' | 'autumn' | 'winter' | 'spring';

export interface WeatherContext {
  date: string; // YYYY-MM-DD
  temperatureC: number;
  condition: WeatherCondition;
  season: Season;
  source: 'open-meteo' | 'seasonal-fallback';
}

export type AssetCategory = 'index' | 'staples' | 'energy' | 'crisis' | 'leisure_tech';

export interface MarketAsset {
  id: string;
  nameHe: string;
  icon: string;
  descriptionHe: string;
  category: AssetCategory;
  currentPrice: number;
  basePrice: number;
  baseDrift: number; // expected monthly growth, e.g. 0.006 = 0.6%
  volatility: number; // monthly std-dev
  priceHistory: number[]; // one entry per game month, oldest first
}

export interface MacroEvent {
  id: string;
  titleHe: string;
  descriptionHe: string;
  ttsTextHe: string;
  icon: string;
  categoryImpacts: Partial<Record<AssetCategory, number>>;
  severity: 'low' | 'medium' | 'high';
  /** A broad market correction — used by the "Calm in the Storm" achievement. */
  isCorrection?: boolean;
}

export interface NewsItem {
  id: string;
  month: number;
  icon: string;
  titleHe: string;
  descriptionHe: string;
  source: 'macro' | 'calendar' | 'weather' | 'family';
}

export interface Bill {
  id: string;
  nameHe: string;
  icon: string;
  amount: number;
  /** Essential bills cannot really be cancelled — bluffing about it backfires. */
  essential: boolean;
}

export type InboxKind = 'expense' | 'income' | 'price_hike' | 'parent_bonus';

export interface InboxItem {
  id: string;
  kind: InboxKind;
  icon: string;
  titleHe: string;
  bodyHe: string;
  amount: number;
  billId?: string;
  createdMonth: number;
  resolved: boolean;
}

export interface ChildStats {
  lastSettledMonth: number;
  passiveChoices: number;
  newsReads: number;
  cashStreak: number; // consecutive turns ending with >= 150 ₪ cash
  diverseStreak: number; // consecutive turns holding >= 3 categories
  negotiationWins: number;
  benchmarkUnits: number; // hypothetical "everything in the index" portfolio
  watchSince: Record<string, number>; // assetId -> month it was starred
  boughtAfterWatching: boolean;
  savingsDeposits: number;
  streakBonusesPaid: number;
  turnsPlayed: number;
}

export interface ChildProfile {
  id: string;
  name: string;
  age: number;
  tier: AgeTier;
  avatarId: string;
  cash: number;
  savingsTreeBalance: number;
  savingsStreakMonths: number;
  holdings: Record<string, number>; // assetId -> units (fractional allowed)
  watchlist: string[];
  passiveAssets: string[]; // passive-asset catalog ids (duplicates = several owned)
  fixedMonthlyExpenses: number; // always equals sum(bills)
  bills: Bill[];
  inbox: InboxItem[];
  xp: number;
  dailyStreak: number;
  unlockedCosmetics: string[];
  equippedAccessory: string | null;
  achievements: string[];
  completedMissions: string[];
  stats: ChildStats;
  lastTurnDate: string | null; // YYYY-MM-DD
  netWorthHistory: { month: number; totalValue: number; indexBenchmark: number }[];
}

export interface FamilySettings {
  monthlyAllowance: number;
  latitude: number;
  longitude: number;
  locationNameHe: string;
}

export interface FamilyGameState {
  schemaVersion: number;
  familyId: string;
  familyNameHe: string;
  parentPinHash: string;
  currentMonth: number;
  lastMarketTickDate: string; // YYYY-MM-DD
  weather: WeatherContext;
  assets: MarketAsset[];
  activeMacroEvent: MacroEvent | null;
  lastHighSeverityMonth: number;
  lastMacroSeverity: MacroEvent['severity'] | null;
  nextMacroEventMonth: number;
  lastCalendarKey?: string;
  news: NewsItem[];
  settings: FamilySettings;
  children: ChildProfile[];
}

export interface FeedbackReport {
  id: string;
  familyId: string;
  type: 'bug' | 'improvement' | 'difficulty' | 'other';
  message: string;
  createdAt: string;
  metadata: {
    appVersion: string;
    route: string;
    userAgent: string;
  };
}

export interface PassiveAssetDef {
  id: string;
  nameHe: string;
  icon: string;
  descriptionHe: string;
  price: number;
  baseMonthlyIncome: number;
  weatherSensitive: boolean;
}
