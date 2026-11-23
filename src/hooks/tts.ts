import { useEffect, useRef, useState } from 'react';
import { DEFAULT_TTS_SETTINGS } from '../engine/seed';
import type { BrowserVoiceStyle, ChildGender, GeminiVoiceName, TtsSettings } from '../types';

// Friendly Hebrew Text-to-Speech (TTS) engine:
// 1. Phonetic Hebrew normalization + Nikud (vowelization) dictionary, child gender inflection,
//    and automatic Beged-Kefet (בג״ד כפ״ת — ב/כ/פ Dagesh vs. Rafe) disambiguation
//    (e.g. מכולת -> מַכּוֹלֶת with hard Kaf, לבית הספר -> לְבֵית הַסֵּפֶר with soft Vet, etc.).
// 2. Multi-persona Voice Styles ('warm_female', 'friendly_kid', 'calm_male', 'storyteller')
//    that apply distinct pitch/rate/voice profiles — and Web Audio pitch-shifting for online streams —
//    so changing the voice setting ALWAYS produces an audibly distinct voice even on dev machines
//    where Windows only has a single local SAPI voice installed.
// 3. Optional Gemini 3.8 Flash-Lite TTS ('gemini-3.8-flash-lite-tts') with warm storytelling persona,
//    persistent IndexedDB + memory audio caching, and strict daily & per-minute quota guards.

export const ttsSupported = typeof window !== 'undefined';

export const GEMINI_VOICES: { id: GeminiVoiceName; labelHe: string; descHe: string }[] = [
  { id: 'Aoede', labelHe: 'אאודה (Aoede)', descHe: 'קול נשי קליל, נעים וחם' },
  { id: 'Sulafat', labelHe: 'סולאפאט (Sulafat)', descHe: 'קול חם, רגוע ומעודד' },
  { id: 'Leda', labelHe: 'לדה (Leda)', descHe: 'קול צעיר וידידותי לילדים' },
  { id: 'Achird', labelHe: 'אכירד (Achird)', descHe: 'קול חברותי ומאיר פנים' },
  { id: 'Puck', labelHe: 'פאק (Puck)', descHe: 'קול גברי אנרגטי ושמח' },
  { id: 'Kore', labelHe: 'קורה (Kore)', descHe: 'קול ברור ובטוח' },
];

export const BROWSER_VOICE_STYLES: {
  id: BrowserVoiceStyle;
  labelHe: string;
  preferredGender: 'female' | 'male';
  pitch: number;
  rate: number;
  cloudPlaybackRate: number;
  preservePitch: boolean;
}[] = [
  {
    id: 'warm_female',
    labelHe: 'מדריכה חמה ונעימה (מומלץ)',
    preferredGender: 'female',
    pitch: 1.14,
    rate: 0.96,
    cloudPlaybackRate: 1.0,
    preservePitch: true,
  },
  {
    id: 'friendly_kid',
    labelHe: 'חבר צעיר ושמח (קול גבוה וידידותי)',
    preferredGender: 'female',
    pitch: 1.32,
    rate: 1.04,
    cloudPlaybackRate: 1.14,
    preservePitch: false,
  },
  {
    id: 'storyteller',
    labelHe: 'מספר סיפורים רגוע ואיטי',
    preferredGender: 'female',
    pitch: 1.04,
    rate: 0.88,
    cloudPlaybackRate: 0.91,
    preservePitch: true,
  },
  {
    id: 'calm_male',
    labelHe: 'מדריך רגוע (קול עמוק)',
    preferredGender: 'male',
    pitch: 0.86,
    rate: 0.94,
    cloudPlaybackRate: 0.88,
    preservePitch: false,
  },
];

const QUOTA_STORAGE_KEY = 'pocket-market.tts.quota.v2';
const API_KEY_STORAGE_KEY = 'pocket-market.tts.geminiApiKey.v1';
const IDB_NAME = 'pocket-market-tts-cache-v1';
const IDB_STORE = 'audio_wav';
const MAX_IDB_ENTRIES = 120;

let activeChildGender: ChildGender = 'male';
let activeTtsSettings: TtsSettings = { ...DEFAULT_TTS_SETTINGS };
let lastUsedBackendLabel = 'מוכן להקראה';

let cachedVoicesList: SpeechSynthesisVoice[] = [];
let currentText: string | null = null;
let currentSessionId = 0;
let lastSpeakStartAt = 0;
let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;
let currentAbort: AbortController | null = null;
let speakTimer: ReturnType<typeof setTimeout> | null = null;
let resumeInterval: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

// In-memory LRU cache of WAV audio buffers
const memoryAudioCache = new Map<string, ArrayBuffer>();

function notifyListeners() {
  for (const fn of listeners) fn();
}

export function subscribeTts(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getSpeakingText(): string | null {
  return currentText;
}

export function getLastUsedBackendLabel(): string {
  return lastUsedBackendLabel;
}

export function useSpeakingText(): string | null {
  const [active, setActive] = useState<string | null>(currentText);
  useEffect(() => subscribeTts(() => setActive(currentText)), []);
  return active;
}

/** Set the currently active child's grammatical gender so second-person Hebrew verbs are vocalized accurately. */
export function setTtsChildGender(gender: ChildGender | undefined): void {
  activeChildGender = gender ?? 'male';
}

export function getTtsChildGender(): ChildGender {
  return activeChildGender;
}

/** Update active TTS configuration from FamilySettings. */
export function setTtsConfig(settings: Partial<TtsSettings> | undefined): void {
  activeTtsSettings = {
    ...DEFAULT_TTS_SETTINGS,
    ...settings,
    // Always prioritize Gemini AI + clean online fallback when an embedded API key exists
    engine: hasEnvGeminiApiKey() ? 'auto' : (settings?.engine ?? DEFAULT_TTS_SETTINGS.engine),
    dailyQuotaLimit: Math.max(settings?.dailyQuotaLimit ?? 0, DEFAULT_TTS_SETTINGS.dailyQuotaLimit),
    perMinuteLimit: Math.max(settings?.perMinuteLimit ?? 0, DEFAULT_TTS_SETTINGS.perMinuteLimit),
  };
  notifyListeners();
}

export function getTtsConfig(): TtsSettings {
  return activeTtsSettings;
}

// ---------------------------------------------------------------------------
// Gemini API Key management (env var or parent-configured localStorage key)
// ---------------------------------------------------------------------------
// Hardcoded model constant — only Gemini 3.8 Flash-Lite TTS is ever permitted by this application.
export const ALLOWED_GEMINI_TTS_MODEL = 'gemini-3.8-flash-lite-tts' as const;
const MAX_GEMINI_TTS_CHARS = 450;

export function sanitizeGeminiApiKey(rawKey: string | undefined | null): string {
  if (!rawKey) return '';
  // Remove any accidental surrounding or embedded quotes, commas, or whitespace from .env or user paste
  return rawKey.replace(/["',;\s]/g, '').trim();
}

export function getGeminiApiKey(): string {
  const envKey = sanitizeGeminiApiKey(import.meta.env?.VITE_GEMINI_API_KEY as string | undefined);
  if (envKey) return envKey;
  if (typeof window === 'undefined') return '';
  try {
    return sanitizeGeminiApiKey(window.localStorage.getItem(API_KEY_STORAGE_KEY));
  } catch {
    return '';
  }
}

export function setCustomGeminiApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    const clean = sanitizeGeminiApiKey(key);
    if (clean) window.localStorage.setItem(API_KEY_STORAGE_KEY, clean);
    else window.localStorage.removeItem(API_KEY_STORAGE_KEY);
    notifyListeners();
  } catch {
    // ignore storage errors
  }
}

export function hasEnvGeminiApiKey(): boolean {
  return Boolean(sanitizeGeminiApiKey(import.meta.env?.VITE_GEMINI_API_KEY as string | undefined));
}

// ---------------------------------------------------------------------------
// Strict Quota Guard (Daily cap + Per-Minute rate limit + 429 cooldown)
// ---------------------------------------------------------------------------
interface QuotaState {
  date: string; // YYYY-MM-DD
  usedToday: number;
  recentTimestamps: number[]; // epoch ms within last 60s
  cooldownUntil: number; // epoch ms if a 429 or quota error occurred
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadQuotaState(): QuotaState {
  const today = todayKey();
  if (typeof window === 'undefined') {
    return { date: today, usedToday: 0, recentTimestamps: [], cooldownUntil: 0 };
  }
  try {
    const raw = window.localStorage.getItem(QUOTA_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<QuotaState>;
      if (parsed.date === today) {
        const now = Date.now();
        return {
          date: today,
          usedToday: typeof parsed.usedToday === 'number' ? parsed.usedToday : 0,
          recentTimestamps: Array.isArray(parsed.recentTimestamps)
            ? parsed.recentTimestamps.filter((t) => typeof t === 'number' && now - t < 60_000)
            : [],
          cooldownUntil: typeof parsed.cooldownUntil === 'number' ? parsed.cooldownUntil : 0,
        };
      }
    }
  } catch {
    // ignore
  }
  return { date: today, usedToday: 0, recentTimestamps: [], cooldownUntil: 0 };
}

function saveQuotaState(state: QuotaState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export interface TtsQuotaStatus {
  date: string;
  usedToday: number;
  dailyLimit: number;
  usedLastMinute: number;
  perMinuteLimit: number;
  inCooldown: boolean;
  canCallApi: boolean;
}

export function getTtsQuotaStatus(): TtsQuotaStatus {
  const state = loadQuotaState();
  const now = Date.now();
  const dailyLimit = Math.max(0, activeTtsSettings.dailyQuotaLimit);
  const perMinuteLimit = Math.max(1, activeTtsSettings.perMinuteLimit);
  const inCooldown = state.cooldownUntil > now;
  const canCallApi =
    !inCooldown &&
    state.usedToday < dailyLimit &&
    state.recentTimestamps.length < perMinuteLimit;

  return {
    date: state.date,
    usedToday: state.usedToday,
    dailyLimit,
    usedLastMinute: state.recentTimestamps.length,
    perMinuteLimit,
    inCooldown,
    canCallApi,
  };
}

function tryConsumeQuotaSlot(): boolean {
  const state = loadQuotaState();
  const now = Date.now();
  const dailyLimit = Math.max(0, activeTtsSettings.dailyQuotaLimit);
  const perMinuteLimit = Math.max(1, activeTtsSettings.perMinuteLimit);

  if (state.cooldownUntil > now) return false;
  if (state.usedToday >= dailyLimit) return false;
  if (state.recentTimestamps.length >= perMinuteLimit) return false;

  state.usedToday += 1;
  state.recentTimestamps.push(now);
  saveQuotaState(state);
  notifyListeners();
  return true;
}

function markQuotaCooldown(durationMs = 5 * 60_000): void {
  const state = loadQuotaState();
  state.cooldownUntil = Date.now() + durationMs;
  saveQuotaState(state);
  notifyListeners();
}

export function resetDailyTtsQuotaCount(): void {
  const today = todayKey();
  saveQuotaState({ date: today, usedToday: 0, recentTimestamps: [], cooldownUntil: 0 });
  notifyListeners();
}

// ---------------------------------------------------------------------------
// Persistent IndexedDB + Memory Audio Cache (avoids repeated API calls)
// ---------------------------------------------------------------------------
function openCacheDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function getCachedAudio(cacheKey: string): Promise<ArrayBuffer | null> {
  const mem = memoryAudioCache.get(cacheKey);
  if (mem) return mem;

  const db = await openCacheDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(cacheKey);
      req.onsuccess = () => {
        const row = req.result as { key: string; buffer: ArrayBuffer; ts: number } | undefined;
        if (row?.buffer) {
          memoryAudioCache.set(cacheKey, row.buffer);
          resolve(row.buffer);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function putCachedAudio(cacheKey: string, buffer: ArrayBuffer): Promise<void> {
  memoryAudioCache.set(cacheKey, buffer);
  if (memoryAudioCache.size > MAX_IDB_ENTRIES) {
    const firstKey = memoryAudioCache.keys().next().value;
    if (firstKey) memoryAudioCache.delete(firstKey);
  }

  const db = await openCacheDb();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put({ key: cacheKey, buffer, ts: Date.now() });
  } catch {
    // ignore IDB quota errors
  }
}

// ---------------------------------------------------------------------------
// Hebrew Phonetic, Gender & Beged-Kefet (בג״ד כפ״ת - דגוש/רפוי) Engine
// ---------------------------------------------------------------------------
const GENDER_SLASH_MAP: Record<string, { male: string; female: string }> = {
  'תמשוך/י': { male: 'תִּמְשׁוֹךְ', female: 'תִּמְשְׁכִי' },
  'את/ה': { male: 'אַתָּה', female: 'אַתְּ' },
  'ישן/ה': { male: 'יָשֵׁן', female: 'יְשֵׁנָה' },
  'פסיבי/ת': { male: 'פָּסִיבִי', female: 'פָּסִיבִית' },
  'מסכים/ה': { male: 'מַסְכִּים', female: 'מַסְכִּימָה' },
  'לקוח/ה': { male: 'לָקוֹחַ', female: 'לָקוֹחָה' },
  'צודק/ת': { male: 'צוֹדֵק', female: 'צוֹדֶקֶת' },
  'צריך/ה': { male: 'צָרִיךְ', female: 'צְרִיכָה' },
  'נסה/י': { male: 'נַסֵּה', female: 'נַסִּי' },
  'תקבל/י': { male: 'תְּקַבֵּל', female: 'תְּקַבְּלִי' },
  'ילד/ה': { male: 'יֶלֶד', female: 'יַלְדָּה' },
};

// Second-person verbs & common ambiguous Hebrew words in the game
const SECOND_PERSON_VERBS: Record<string, { male: string; female: string }> = {
  'קיבלת': { male: 'קִיבַּלְתָּ', female: 'קִיבַּלְתְּ' },
  'וקיבלת': { male: 'וְקִיבַּלְתָּ', female: 'וְקִיבַּלְתְּ' },
  'שילמת': { male: 'שִׁילַּמְתָּ', female: 'שִׁילַּמְתְּ' },
  'ושילמת': { male: 'וְשִׁילַּמְתָּ', female: 'וְשִׁילַּמְתְּ' },
  'תרמת': { male: 'תָּרַמְתָּ', female: 'תָּרַמְתְּ' },
  'ותרמת': { male: 'וְתָרַמְתָּ', female: 'וְתָרַמְתְּ' },
  'שתלת': { male: 'שָׁתַלְתָּ', female: 'שָׁתַלְתְּ' },
  'קנית': { male: 'קָנִיתָ', female: 'קָנִית' },
  'מכרת': { male: 'מָכַרְתָּ', female: 'מָכַרְתְּ' },
  'הפקדת': { male: 'הִפְקַדְתָּ', female: 'הִפְקַדְתְּ' },
  'משכת': { male: 'מָשַׁכְתָּ', female: 'מָשַׁכְתְּ' },
  'בחרת': { male: 'בָּחַרְתָּ', female: 'בָּחַרְתְּ' },
  'הפרשת': { male: 'הִפְרַשְׁתָּ', female: 'הִפְרַשְׁתְּ' },
  'שלטת': { male: 'שָׁלַטְתָּ', female: 'שָׁלַטְתְּ' },
  'אספת': { male: 'אָסַפְתָּ', female: 'אָסַפְתְּ' },
  'ביצעת': { male: 'בִּיצַּעְתָּ', female: 'בִּיצַּעְתְּ' },
  'פתחת': { male: 'פָּתַחְתָּ', female: 'פָּתַחְתְּ' },
  'ביקשת': { male: 'בִּיקַּשְׁתָּ', female: 'בִּיקַּשְׁתְּ' },
  'שנשארת': { male: 'שֶׁנִּשְׁאַרְתָּ', female: 'שֶׁנִּשְׁאַרְתְּ' },
  'נשארת': { male: 'נִשְׁאַרְתָּ', female: 'נִשְׁאַרְתְּ' },
  'בדקת': { male: 'בָּדַקְתָּ', female: 'בָּדַקְתְּ' },
  'שיחקת': { male: 'שִׂיחַקְתָּ', female: 'שִׂיחַקְתְּ' },
  'עשית': { male: 'עָשִׂיתָ', female: 'עָשִׂית' },
  'עזרת': { male: 'עָזַרְתָּ', female: 'עָזַרְתְּ' },
  'מצאת': { male: 'מָצָאתָ', female: 'מָצָאת' },
  'הוזמנת': { male: 'הוּזְמַנְתָּ', female: 'הוּזְמַנְתְּ' },
  'שלך': { male: 'שֶׁלְּךָ', female: 'שֶׁלָּךְ' },
  'לך': { male: 'לְךָ', female: 'לָךְ' },
  'אותך': { male: 'אוֹתְךָ', female: 'אוֹתָךְ' },
  'איתך': { male: 'אִיתְּךָ', female: 'אִיתָּךְ' },
  'פסיבי': { male: 'פָּסִיבִי', female: 'פָּסִיבִית' },
};

/**
 * Dictionary of Beged-Kefet (ב, כ, פ — Dagesh vs. Rafe) & heteronym words
 * where TTS engines frequently mispronounce hard (בּ/כּ/פּ) vs. soft (ב/כ/פ) consonants
 * or wrong vowel patterns (like מַכּוֹלֶת vs. מְכוֹלֶת).
 *
 * Includes root words; prefixes (ה, ו, ב, ל, מ, כ, ש) are also handled automatically
 * by `applyBegedKefetDisambiguation` below!
 */
const BEGED_KEFET_AND_NIKUD_LEXICON: Record<string, string> = {
  // מכולת (Hard Kaf Dagesh - Makkolet, NOT Mekholet!)
  'מכולת': 'מַכּוֹלֶת',
  'המכולת': 'הַמַּכּוֹלֶת',
  'במכולת': 'בַּמַּכּוֹלֶת',
  'מכולות': 'מַכּוֹלוֹת',
  'המכולות': 'הַמַּכּוֹלוֹת',

  // כיס / כסף / כוכבים / כפתור / כלכלה (Kaf Dagesh & Peh/Bet rules)
  'כיס': 'כִּיס',
  'הכיס': 'הַכִּיס',
  'בכיס': 'בְּכִיס',
  'כסף': 'כֶּסֶף',
  'הכסף': 'הַכֶּסֶף',
  'בכסף': 'בְּכֶסֶף',
  'לכסף': 'לְכֶסֶף',
  'כספת': 'כַּסֶּפֶת',
  'בכספת': 'בַּכַּסֶּפֶת',
  'כוכב': 'כּוֹכָב',
  'כוכבים': 'כּוֹכָבִים',
  'בכוכבים': 'בְּכּוֹכָבִים',
  'כוכבי': 'כּוֹכְבֵי',
  'כפתור': 'כַּפְתּוֹר',
  'הכפתור': 'הַכַּפְתּוֹר',
  'כלכלה': 'כַּלְכָּלָה',
  'כלכלי': 'כַּלְכָּלִי',
  'כלכליות': 'כַּלְכָּלִיּוֹת',
  'כתר': 'כֶּתֶר',
  'כובע': 'כּוֹבַע',
  'כרטיס': 'כַּרְטִיס',
  'כובש': 'כּוֹבֵשׁ',
  'כובשים': 'כּוֹבְשִׁים',
  'כיפת': 'כִּיפַּת',

  // בית / בוקר / ביצים / בקבוק / בגדים (Bet Dagesh vs. Vet Rafe after prepositions)
  'בוקר': 'בּוֹקֶר',
  'הבוקר': 'הַבּוֹקֶר',
  'בבוקר': 'בַּבּוֹקֶר',
  'בית': 'בַּיִת',
  'הבית': 'הַבַּיִת',
  'בבית': 'בַּבַּיִת',
  'לבית': 'לְבֵית', // e.g. חזרה לבית הספר -> Leveit HaSefer (soft Vet!)
  'ספר': 'סֵפֶר',
  'הספר': 'הַסֵּפֶר',
  'ספרייה': 'סִפְרִיָּה',
  'הספרייה': 'הַסִּפְרִיָּה',
  'מהספרייה': 'מֵהַסִּפְרִיָּה',
  'בקבוק': 'בַּקְבּוּק',
  'בניינים': 'בִּנְיָנִים',
  'ביצים': 'בֵּיצִים',
  'הביצים': 'הַבֵּיצִים',
  'בבת': 'בְּבַת',
  'בבהלה': 'בְּבֶהָלָה',
  'ביטחון': 'בִּיטָּחוֹן',
  'ביטחונית': 'בִּיטְחוֹנִית',
  'בלוף': 'בְּלוֹף',
  'הבלוף': 'הַבְּלוֹף',
  'לבלף': 'לְבַלֵּף',
  'בונוס': 'בּוֹנוּס',
  'הבונוס': 'הַבּוֹנוּס',
  'בונוסים': 'בּוֹנוּסִים',

  // פופקורן / פיזור / פסיבי / פירות / פנאי (Peh Dagesh vs. Feh Rafe)
  'פופקורן': 'פּוֹפְּקוֹרְן',
  'פסיבית': 'פָּסִיבִית',
  'פסיביים': 'פָּסִיבִיִּים',
  'פיזור': 'פִּיזּוּר',
  'לפזר': 'לְפַזֵּר',
  'מפוזר': 'מְפּוּזָר',
  'מפזר': 'מְפַזֵּר',
  'פנאי': 'פְּנַאי',
  'פواكه': 'פֵּירוֹת',
  'פריט': 'פָּרִיט',
  'פריטים': 'פְּרִיטִים',
  'הפריטים': 'הַפְּרִיטִים',
  'פחות': 'פָּחוֹת',
  'פעולות': 'פְּעוּלוֹת',
  'לפעולות': 'לִפְעוּלוֹת',
  'לפעמים': 'לִפְעָמִים',
  'בפעם': 'בַּפַּעַם',
  'הפתעה': 'הַפְתָּעָה',
  'הפתעות': 'הַפְתָּעוֹת',
  'להפתעות': 'לְהַפְתָּעוֹת',
  'מהפתעות': 'מֵהַפְתָּעוֹת',
  'פסח': 'פֶּסַח',
  'לפסח': 'לְפֶסַח',

  // מיקוח / מניות / מדד / מעקב / משימות / מעשר / מזומן / מחיר
  'מיקוח': 'מִיקּוּחַ',
  'במיקוח': 'בְּמִיקּוּחַ',
  'המיקוח': 'הַמִּיקּוּחַ',
  'מניה': 'מְנָיָה',
  'מניות': 'מְנָיוֹת',
  'מדד': 'מָדָד',
  'המדד': 'הַמָּדָד',
  'למדד': 'לַמָּדָד',
  'מעקב': 'מַעֲקָב',
  'במעקב': 'בְּמַעֲקָב',
  'ממעקב': 'מִמַּעֲקָב',
  'משימה': 'מְשִׂימָה',
  'משימות': 'מְשִׂימוֹת',
  'מעשר': 'מַעֲשֵׂר',
  'ומעשר': 'וּמַעֲשֵׂר',
  'מזומן': 'מְזוּמָן',
  'במזומן': 'בִּמְזוּמָן',
  'המזומן': 'הַמְּזוּמָן',
  'מהמזומן': 'מֵהַמְּזוּמָן',
  'למזומן': 'לַמְּזוּמָן',
  'מחיר': 'מְחִיר',
  'המחיר': 'הַמְּחִיר',
  'במחיר': 'בִּמְחִיר',
  'למחיר': 'לִמְחִיר',
  'מחירים': 'מְחִירִים',
  'המחירים': 'הַמְּחִירִים',
  'מלונות': 'מְלוֹנוֹת',
  'מפעלים': 'מִפְעָלִים',
  'המפעלים': 'הַמִּפְעָלִים',
  'מתיחות': 'מְתִיחוּת',
  'במתינות': 'בִּמְתִינוּת',
  'מתכתי': 'מַתַּכְתִּי',
  'מדליה': 'מֵדַלְיָה',
  'מצחייה': 'מִצְחִיָּה',
  'משקפי': 'מִשְׁקְפֵי',
  'משקיע': 'מַשְׁקִיעַ',
  'משקיעים': 'מַשְׁקִיעִים',
  'מניב': 'מֵנִיב',
  'מניבים': 'מְנִיבִים',
  'מכניס': 'מַכְנִיס',
  'מכניסים': 'מַכְנִיסִים',
  'מתأخر': 'מִתְעַכְּבִים',
  'מתעכבים': 'מִתְעַכְּבִים',
  'מתקשות': 'מִתְקַשּׁוֹת',
  'מתארחות': 'מִתְאָרְחוֹת',
  'מבקש': 'מְבַקֵּשׁ',
  'מבקשת': 'מְבַקֶּשֶׁת',
  'מבטל': 'מְבַטֵּל',
  'מכסים': 'מְכַסִּים',
  'מזכה': 'מְזַכֶּה',
  'מזנקת': 'מְזַנֶּקֶת',

  // אופניים / שבבים / שכונה / תדריך / תיקון / ריבית / דיבידנד / אינפלציה
  'אופניים': 'אוֹפַנַּיִם',
  'האופניים': 'הָאוֹפַנַּיִם',
  'שבבים': 'שְׁבָבִים',
  'בשבבים': 'בִּשְׁבָבִים',
  'שכונה': 'שְׁכוּנָה',
  'השכונה': 'הַשְּׁכוּנָה',
  'בשכונה': 'בַּשְּׁכוּנָה',
  'שכונתית': 'שְׁכוּנָתִית',
  'השכונתי': 'הַשְּׁכוּנָתִי',
  'שכירות': 'שְׂכִירוּת',
  'שכן': 'שָׁכֵן',
  'לשכן': 'לַשָּׁכֵן',
  'השכן': 'הַשָּׁכֵן',
  'שרב': 'שָׁרָב',
  'בשרב': 'בַּשָּׁרָב',
  'תדריך': 'תַּדְרִיךְ',
  'תיקון': 'תִּיקּוּן',
  'תנודתיות': 'תְּנוּדָתִיּוּת',
  'תנודתית': 'תְּנוּדָתִית',
  'תרומה': 'תְּרוּמָה',
  'תרומות': 'תְּרוּמוֹת',
  'לתרומה': 'לִתְרוּמָה',
  'לתרום': 'לִתְרוֹם',
  'תקציב': 'תַּקְצִיב',
  'ותקציב': 'וְתַקְצִיב',
  'מהתקציב': 'מֵהַתַּקְצִיב',
  'ריבית': 'רִיבִּית',
  'הריבית': 'הָרִיבִּית',
  'דריבית': 'דְּרִיבִּית',
  'דיבידנד': 'דִּיבִידֶנְד',
  'אינפלציה': 'אִינְפְלַצְיָה',
  'ואינפלציה': 'וְאִינְפְלַצְיָה',
  'הכנסה': 'הַכְנָסָה',
  'ההכנסה': 'הַהַכְנָסָה',
  'מההכנסה': 'מֵהַהַכְנָסָה',
  'הכנסות': 'הַכְנָסוֹת',
  'הוצאה': 'הוֹצָאָה',
  'הוצאות': 'הוֹצָאוֹת',
  'ההוצאות': 'הַהוֹצָאוֹת',
  'מההוצאות': 'מֵהַהוֹצָאוֹת',
  'חיסכון': 'חִיסָּכוֹן',
  'החיסכון': 'הַחִיסָּכוֹן',
  'לחיסכון': 'לְחִיסָּכוֹן',
  'השקעה': 'הַשְׁקָעָה',
  'והשקעה': 'וְהַשְׁקָעָה',
  'השקעות': 'הַשְׁקָעוֹת',
  'נכס': 'נֶכֶס',
  'הנכס': 'הַנֶּכֶס',
  'נכסים': 'נְכָסִים',
  'ובנכסים': 'וּבִנְכָסִים',
  'בנכסים': 'בִּנְכָסִים',
  'עשירית': 'עֲשִׂירִית',
  'העשירית': 'הָעֲשִׂירִית',
  'סופגניות': 'סוּפְגָּנִיּוֹת',
  'קונסולות': 'קוֹנְסוֹלוֹת',
  'חופש': 'חוֹפֶשׁ',
  'החופש': 'הַחוֹפֶשׁ',
  'בחופש': 'בְּחוֹפֶשׁ',
  'חודש': 'חוֹדֶשׁ',
  'החודש': 'הַחוֹדֶשׁ',
  'בחודש': 'בְּחוֹדֶשׁ',
  'לחודש': 'לְחוֹדֶשׁ',
  'מהחודש': 'מֵהַחוֹדֶשׁ',
  'חודשים': 'חוֹדָשִׁים',
  'חודשי': 'חוֹדְשִׁי',
  'חודשיים': 'חוֹדְשִׁיִּים',
  'החודשי': 'הַחוֹדְשִׁי',
  'החודשית': 'הַחוֹדְשִׁית',
  'החודשיים': 'הַחוֹדְשִׁיִּים',
};

// Multi-word phrases and acronyms that should be replaced before single-word scanning
const PHONETIC_PHRASES: [RegExp, string][] = [
  [/סה״כ|סה"כ/g, 'סַךְ הַכֹּל'],
  [/נדל״ן|נדל"ן/g, 'נַדְלָן'],
  [/ובנדל״ן|ובנדל"ן/g, 'וּבְנַדְלָן'],
  [/בנדל״ן|בנדל"ן/g, 'בְּנַדְלָן'],
  [/מע״מ|מע"מ/g, 'מַעַם'],
  [/ש״ח|ש"ח/g, 'שְׁקָלִים'],
  [/3\+/g, 'שָׁלוֹשׁ וָמַעְלָה'],
  [/סופר-שכונה/g, 'סוּפֶּר שְׁכוּנָה'],
  [/כיפת-מגן/g, 'כִּיפַּת מָגֵן'],
  [/רפואת-חירום/g, 'רְפוּאַת חֵירוּם'],
  [/לבית הספר/g, 'לְבֵית הַסֵּפֶר'],
  [/בית הספר/g, 'בֵּית הַסֵּפֶר'],
  [/ארוחת עשר/g, 'אֲרוּחַת עֶשֶׂר'],
  [/דמי כיס/g, 'דְּמֵי כִּיס'],
  [/שוק הכיס/g, 'שׁוּק הַכִּיס'],
  [/עץ החיסכון/g, 'עֵץ הַחִיסָּכוֹן'],
  [/עץ חיסכון/g, 'עֵץ חִיסָּכוֹן'],
  [/קרן חירום/g, 'קֶרֶן חֵירוּם'],
  [/רשימת מעקב/g, 'רְשִׁימַת מַעֲקָב'],
  [/הוצאות קבועות/g, 'הוֹצָאוֹת קְבוּעוֹת'],
  [/הכנסה פסיבית/g, 'הַכְנָסָה פָּסִיבִית'],
  [/ריבית דריבית/g, 'רִיבִּית דְּרִיבִּית'],
  [/כוכבי ניקוד/g, 'כּוֹכְבֵי נִיקּוּד'],
];

/**
 * Algorithmic Beged-Kefet (בג״ד כפ״ת) rule for unvocalized Hebrew words:
 * 1. If a word is in BEGED_KEFET_AND_NIKUD_LEXICON, use the exact vocalized entry.
 * 2. If a word starts with an inseparable prefix (ו, ה, ב, כ, ל, מ, ש) + a lexicon word,
 *    combine the proper prefix vocalization with the lexicon word (applying soft Rafe after בְ/כְ/לְ/וּ
 *    or hard Dagesh after הַ/מִ/שֶׁ).
 * 3. For any remaining unvocalized word starting with ב, כ, פ at the beginning of a word,
 *    Hebrew grammar (דגש קל בראש מילה) requires a Dagesh (בּ, כּ, פּ) so TTS never reads
 *    word-initial ב/כ/פ as V/Kh/F!
 */
export function applyBegedKefetDisambiguation(word: string): string {
  // Already contains nikud marks -> keep as is
  if (/[\u0591-\u05C7]/.test(word)) return word;

  const direct = BEGED_KEFET_AND_NIKUD_LEXICON[word];
  if (direct) return direct;

  // Check single-letter prefix (ו, ה, ב, ל, מ, כ, ש) + known lexicon stem
  if (word.length >= 4) {
    const prefix = word[0];
    const stem = word.slice(1);
    const vocalizedStem = BEGED_KEFET_AND_NIKUD_LEXICON[stem];
    if (vocalizedStem) {
      if (prefix === 'ו') return `וְ${vocalizedStem}`;
      if (prefix === 'ה') return `הַ${vocalizedStem}`;
      if (prefix === 'ב') return `בְּ${vocalizedStem}`;
      if (prefix === 'ל') return `לְ${vocalizedStem}`;
      if (prefix === 'כ') return `כְּ${vocalizedStem}`;
      if (prefix === 'מ') return `מֵ${vocalizedStem}`;
      if (prefix === 'ש') return `שֶׁ${vocalizedStem}`;
    }
  }

  // Grammatical rule: Dagesh Kal at the beginning of a Hebrew word (בּ, כּ, פּ)
  // Prevents TTS from reading initial ב/כ/פ as soft v/kh/f.
  if (word.length >= 2) {
    const first = word[0];
    if (first === 'ב' || first === 'כ' || first === 'פ') {
      return `${first}\u05BC${word.slice(1)}`;
    }
  }

  return word;
}

export function normalizeHebrewText(text: string, gender: ChildGender = activeChildGender): string {
  let out = text;

  // 1. Replace slash-gendered words first (e.g. תמשוך/י)
  for (const [slashWord, forms] of Object.entries(GENDER_SLASH_MAP)) {
    if (out.includes(slashWord)) {
      out = out.split(slashWord).join(forms[gender]);
    }
  }

  // 2. Replace currency, math, and punctuation symbols with natural spoken Hebrew
  out = out
    .replace(/₪/g, ' שְׁקָלִים ')
    .replace(/\+(\d+)/g, ' פְּלוּס $1 ')
    .replace(/[−-](\d+)/g, ' מִינוּס $1 ')
    .replace(/\+/g, ' פְּלוּס ')
    .replace(/%/g, ' אָחוּז ')
    .replace(/°/g, ' מַעֲלוֹת ')
    .replace(/[—–·•]/g, ', ')
    // Strip all emojis and decorative pictographs so TTS never reads emoji names aloud
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}▲▼⭐🔥💵💰📬☀️🛒✅🧘🌳🍋📈📉➖✔★☆]/gu, ' ');

  // 3. Apply multi-word phonetic phrases & acronyms
  for (const [pattern, replacement] of PHONETIC_PHRASES) {
    out = out.replace(pattern, replacement);
  }

  // 4. Token-level vocalization: second-person gender verbs + Beged-Kefet (בג״ד כפ״ת) lexicon & Dagesh Kal rule
  out = out.replace(/(^|[\s,.:;!?()"'־-])([א-ת\u0591-\u05C7]+)(?=$|[\s,.:;!?()"'־-])/g, (_full, prefix: string, word: string) => {
    const verbEntry = SECOND_PERSON_VERBS[word];
    if (verbEntry) {
      return `${prefix}${verbEntry[gender]}`;
    }
    const disambiguated = applyBegedKefetDisambiguation(word);
    return `${prefix}${disambiguated}`;
  });

  return out.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Enhanced Browser Voice Selection (Neural / Natural voices + Style Profiles)
// ---------------------------------------------------------------------------
function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) cachedVoicesList = voices;
  return cachedVoicesList;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    cachedVoicesList = window.speechSynthesis.getVoices();
  });
}

function getActiveStyleProfile() {
  const styleId = activeTtsSettings.browserVoiceStyle ?? (activeTtsSettings.browserVoiceGender === 'male' ? 'calm_male' : 'warm_female');
  return BROWSER_VOICE_STYLES.find((s) => s.id === styleId) ?? BROWSER_VOICE_STYLES[0];
}

function scoreHebrewVoice(v: SpeechSynthesisVoice, preferredGender: 'female' | 'male'): number {
  const lang = v.lang.toLowerCase();
  const name = v.name.toLowerCase();
  const isHe =
    lang === 'he-il' ||
    lang.startsWith('he') ||
    lang.startsWith('iw') ||
    /hebrew|עברית|hila|avri|carmit/i.test(name);
  if (!isHe) return -1;

  let score = 10;

  // Strongly prefer Neural / Natural / Online high-quality voices
  if (/natural|neural|online|premium|enhanced|wavenet/i.test(name)) score += 100;
  if (/google/i.test(name)) score += 60;
  if (/hila|avri|carmit/i.test(name)) score += 50;

  // Never use the legacy metallic Windows SAPI voice (Microsoft Asaf) automatically —
  // prefer the clean online Hebrew TTS stream unless the user explicitly selected Asaf.
  if (/asaf/i.test(name)) return -1;

  // Gender preference matching
  const isFemaleVoice = /hila|carmit|female|נקבה/i.test(name);
  const isMaleVoice = /avri|asaf|male|זכר/i.test(name);
  if (preferredGender === 'female' && isFemaleVoice) score += 35;
  if (preferredGender === 'male' && isMaleVoice) score += 35;

  return score;
}

export function selectBestHebrewVoice(preferredGender?: 'female' | 'male'): SpeechSynthesisVoice | null {
  const voices = loadVoices();
  if (!voices.length) return null;

  // If the user explicitly picked an installed voice by name, use it
  if (activeTtsSettings.browserVoiceName) {
    const exact = voices.find((v) => v.name === activeTtsSettings.browserVoiceName);
    if (exact) return exact;
  }

  const targetGender = preferredGender ?? getActiveStyleProfile().preferredGender;
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;

  for (const v of voices) {
    const s = scoreHebrewVoice(v, targetGender);
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }
  return best;
}

export function listAvailableHebrewVoices(): { name: string; lang: string; isNeural: boolean }[] {
  const voices = loadVoices();
  return voices
    .filter((v) => scoreHebrewVoice(v, 'female') >= 0)
    .map((v) => ({
      name: v.name,
      lang: v.lang,
      isNeural: /natural|neural|online|premium|enhanced|google|hila|avri|carmit/i.test(v.name) && !/asaf/i.test(v.name),
    }));
}

function splitChunks(text: string, maxLen = 175): string[] {
  const sentences = text.split(/(?<=[.!?।])\s+/);
  const chunks: string[] = [];
  let buf = '';
  for (const s of sentences) {
    if ((buf + ' ' + s).trim().length <= maxLen) {
      buf = (buf + ' ' + s).trim();
    } else {
      if (buf) chunks.push(buf);
      if (s.length <= maxLen) {
        buf = s;
      } else {
        const words = s.split(' ');
        buf = '';
        for (const w of words) {
          if ((buf + ' ' + w).trim().length <= maxLen) {
            buf = (buf + ' ' + w).trim();
          } else {
            if (buf) chunks.push(buf);
            buf = w;
          }
        }
      }
    }
  }
  if (buf) chunks.push(buf);
  return chunks.length ? chunks : [text.slice(0, maxLen)];
}

function clearTimers() {
  if (speakTimer) {
    clearTimeout(speakTimer);
    speakTimer = null;
  }
  if (resumeInterval) {
    clearInterval(resumeInterval);
    resumeInterval = null;
  }
}

let unlockedAudioContext: AudioContext | null = null;

function ensureAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!unlockedAudioContext) {
    try {
      unlockedAudioContext = new Ctx();
    } catch {
      return null;
    }
  }
  if (unlockedAudioContext.state === 'suspended') {
    unlockedAudioContext.resume().catch(() => {});
  }
  return unlockedAudioContext;
}

let currentSourceNode: AudioBufferSourceNode | null = null;

function cleanupAudioElement() {
  if (currentSourceNode) {
    try {
      currentSourceNode.onended = null;
      currentSourceNode.stop();
      currentSourceNode.disconnect();
    } catch {
      // ignore
    }
    currentSourceNode = null;
  }
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.src = '';
    } catch {
      // ignore
    }
    currentAudio = null;
  }
  if (currentObjectUrl) {
    try {
      URL.revokeObjectURL(currentObjectUrl);
    } catch {
      // ignore
    }
    currentObjectUrl = null;
  }
}

export function stopSpeaking(): void {
  currentSessionId += 1;
  clearTimers();
  if (currentAbort) {
    try {
      currentAbort.abort();
    } catch {
      // ignore
    }
    currentAbort = null;
  }
  cleanupAudioElement();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
  if (currentText !== null) {
    currentText = null;
    notifyListeners();
  }
}

// Global auto-stop listeners:
// Stop active speech immediately whenever the user switches browser tabs, navigates routes,
// or clicks/interacts with any button, link, tab, or form control other than a speaker trigger.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('hashchange', () => stopSpeaking());
  window.addEventListener('pagehide', () => stopSpeaking());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopSpeaking();
  });

  document.addEventListener(
    'click',
    (e) => {
      if (currentText === null) return;
      const target = e.target as Element | null;
      if (!target || typeof target.closest !== 'function') return;

      // Ignore clicks on <Speak /> buttons or elements explicitly marked as TTS triggers
      if (target.closest('.speak-btn, [data-tts-keep]')) return;

      const interactive = target.closest('button, a, [role="tab"], select, summary, input[type="submit"]');
      if (!interactive) return;

      // If this click handler itself just invoked speak(...) synchronously within the last 80ms, keep the new speech!
      if (Date.now() - lastSpeakStartAt < 80) return;

      stopSpeaking();
    },
    false,
  );

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentText !== null) {
      stopSpeaking();
    }
  });
}

// ---------------------------------------------------------------------------
// Gemini 3.8 Flash-Lite TTS Integration (with Cache + Quota Protection)
// ---------------------------------------------------------------------------
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function synthesizeWithGeminiTts(
  cleanText: string,
  voice: GeminiVoiceName,
  gender: ChildGender,
  signal: AbortSignal,
): Promise<{ buffer: ArrayBuffer; fromCache: boolean } | null> {
  const cacheKey = `gemini-3.8-lite:${voice}:${gender}:${cleanText}`;
  const cached = await getCachedAudio(cacheKey);
  if (cached) {
    return { buffer: cached, fromCache: true };
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  // Enforce strict daily and per-minute quota limits before making a network call
  if (!tryConsumeQuotaSlot()) {
    return null;
  }

  const addresseeHint =
    gender === 'female'
      ? 'speaking in Hebrew to a young girl (use feminine second-person Hebrew pronunciation)'
      : 'speaking in Hebrew to a young boy (use masculine second-person Hebrew pronunciation)';

  // Strip nikud marks when sending to Gemini 3.8 TTS so the payload stays compact and fast,
  // while keeping all slash-gender replacements ('תמשכי', 'פסיבית', etc.) and expanded symbols ('שקלים', 'אחוז')!
  const geminiCleanText = cleanText
    .replace(/[\u0591-\u05C7]/g, '')
    .slice(0, MAX_GEMINI_TTS_CHARS);

  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      signal,
      body: JSON.stringify({
        model: ALLOWED_GEMINI_TTS_MODEL,
        store: false,
        input: [
          {
            type: 'user_input',
            content: [
              {
                type: 'text',
                text: geminiCleanText,
                annotations: [
                  {
                    type: 'speech_metadata',
                    style: `warm, friendly, cheerful, encouraging storytelling voice for children, natural Israeli Hebrew pronunciation, ${addresseeHint}`,
                  },
                ],
              },
            ],
          },
        ],
        response_format: {
          type: 'audio',
          mime_type: 'audio/wav',
        },
        generation_config: {
          speech_config: [{ voice }],
        },
      }),
    });

    if (res.status === 429 || res.status === 403) {
      markQuotaCooldown(5 * 60_000);
      return null;
    }

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as {
      output_audio?: { data?: string };
      steps?: { type?: string; content?: { type?: string; data?: string }[] }[];
    };

    let b64 = data.output_audio?.data;
    if (!b64 && Array.isArray(data.steps)) {
      for (let i = data.steps.length - 1; i >= 0; i--) {
        const step = data.steps[i];
        if (step.type === 'model_output' && Array.isArray(step.content)) {
          const audioPart = step.content.find((c) => c.type === 'audio' && c.data);
          if (audioPart?.data) {
            b64 = audioPart.data;
            break;
          }
        }
      }
    }

    if (!b64) return null;
    const buffer = base64ToArrayBuffer(b64);
    await putCachedAudio(cacheKey, buffer);
    return { buffer, fromCache: false };
  } catch {
    return null;
  }
}

function playAudioBuffer(buffer: ArrayBuffer, originalKey: string, sessionId: number, onFallback: () => void): void {
  if (currentText !== originalKey || currentSessionId !== sessionId) return;
  cleanupAudioElement();

  // Play via Web Audio API first (unlocked synchronously on user gesture, so async network delay never triggers autoplay rejection)
  const ctx = ensureAudioContext();
  if (ctx) {
    const copy = buffer.slice(0);
    ctx
      .decodeAudioData(copy)
      .then((audioBuf) => {
        if (currentText !== originalKey || currentSessionId !== sessionId) return;
        const src = ctx.createBufferSource();
        src.buffer = audioBuf;
        src.connect(ctx.destination);
        currentSourceNode = src;
        src.onended = () => {
          if (currentSessionId !== sessionId) return;
          currentSourceNode = null;
          if (currentText === originalKey) {
            currentText = null;
            notifyListeners();
          }
        };
        src.start(0);
      })
      .catch(() => {
        if (currentSessionId !== sessionId || currentText !== originalKey) return;
        playAudioBufferViaElement(buffer, originalKey, sessionId, onFallback);
      });
    return;
  }

  playAudioBufferViaElement(buffer, originalKey, sessionId, onFallback);
}

function playAudioBufferViaElement(buffer: ArrayBuffer, originalKey: string, sessionId: number, onFallback: () => void): void {
  if (currentText !== originalKey || currentSessionId !== sessionId) return;
  const blob = new Blob([buffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  currentObjectUrl = url;
  const audio = new Audio(url);
  currentAudio = audio;
  audio.onended = () => {
    if (currentSessionId !== sessionId) return;
    cleanupAudioElement();
    if (currentText === originalKey) {
      currentText = null;
      notifyListeners();
    }
  };
  audio.onerror = () => {
    if (currentSessionId !== sessionId) return;
    cleanupAudioElement();
    if (currentText === originalKey) {
      onFallback();
    }
  };
  audio.play().catch(() => {
    if (currentSessionId !== sessionId) return;
    cleanupAudioElement();
    if (currentText === originalKey) {
      onFallback();
    }
  });
}

// ---------------------------------------------------------------------------
// Cloud Hebrew Stream & Browser Neural Playback with Distinct Voice Personas
// ---------------------------------------------------------------------------
function applyAudioPitchProfile(audio: HTMLAudioElement, style = getActiveStyleProfile()) {
  // Using preservesPitch = false shifts both pitch and timbre so even a single online TTS stream
  // can produce distinct female / young-kid / deep-male vocal characters!
  const anyAudio = audio as HTMLAudioElement & {
    preservesPitch?: boolean;
    mozPreservesPitch?: boolean;
    webkitPreservesPitch?: boolean;
  };
  if ('preservesPitch' in anyAudio) anyAudio.preservesPitch = style.preservePitch;
  if ('mozPreservesPitch' in anyAudio) anyAudio.mozPreservesPitch = style.preservePitch;
  if ('webkitPreservesPitch' in anyAudio) anyAudio.webkitPreservesPitch = style.preservePitch;
  audio.playbackRate = style.cloudPlaybackRate;
}

function playOnlineHebrewStream(cleanText: string, originalKey: string, sessionId: number, allowSapiFallback = true): void {
  if (currentSessionId !== sessionId || currentText !== originalKey) return;
  const chunks = splitChunks(cleanText, 175);
  let idx = 0;
  const style = getActiveStyleProfile();
  lastUsedBackendLabel = `קול ענן עברי (${style.labelHe})`;
  notifyListeners();

  const playNext = () => {
    if (currentSessionId !== sessionId || currentText !== originalKey || idx >= chunks.length) {
      if (currentSessionId === sessionId && currentText === originalKey) {
        currentText = null;
        notifyListeners();
      }
      return;
    }
    const chunk = chunks[idx++];
    const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=iw&q=${encodeURIComponent(chunk)}`;
    cleanupAudioElement();
    const audio = new Audio(url);
    currentAudio = audio;
    applyAudioPitchProfile(audio, style);
    audio.onended = () => {
      if (currentSessionId !== sessionId) return;
      playNext();
    };
    audio.onerror = () => {
      if (currentSessionId !== sessionId) return;
      if (allowSapiFallback && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(chunk);
        u.lang = 'he-IL';
        u.rate = style.rate;
        u.pitch = style.pitch;
        u.onend = () => {
          if (currentSessionId === sessionId) playNext();
        };
        u.onerror = () => {
          if (currentSessionId === sessionId) {
            currentText = null;
            notifyListeners();
          }
        };
        window.speechSynthesis.speak(u);
      } else {
        currentText = null;
        notifyListeners();
      }
    };
    audio.play().catch(() => {
      if (currentSessionId === sessionId) {
        audio.onerror?.(new Event('error'));
      }
    });
  };

  playNext();
}

function speakWithBrowserVoice(clean: string, rawKey: string, sessionId: number, opts: { rate?: number } = {}): void {
  if (currentSessionId !== sessionId || currentText !== rawKey) return;

  if (activeTtsSettings.engine === 'cloud_hebrew') {
    playOnlineHebrewStream(clean, rawKey, sessionId, true);
    return;
  }

  const style = getActiveStyleProfile();
  const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const v = selectBestHebrewVoice(style.preferredGender);

  // If the only installed OS voice is the old metallic Microsoft Asaf AND the user hasn't explicitly pinned Asaf,
  // check if they prefer the smoother cloud Hebrew voice or apply strong persona pitch/rate shaping.
  if (hasSpeech && v) {
    const synth = window.speechSynthesis;
    try {
      synth.resume();
    } catch {
      // ignore
    }
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = v.lang || 'he-IL';
    u.voice = v;
    u.rate = opts.rate ?? style.rate;
    u.pitch = style.pitch;

    lastUsedBackendLabel = `דפדפן: ${v.name} (${style.labelHe})`;
    notifyListeners();

    resumeInterval = setInterval(() => {
      if (currentSessionId !== sessionId || !synth.speaking) {
        clearTimers();
      } else if (synth.paused) {
        synth.resume();
      }
    }, 3000);

    u.onend = () => {
      if (currentSessionId !== sessionId) return;
      clearTimers();
      if (currentText === rawKey) {
        currentText = null;
        notifyListeners();
      }
    };
    u.onerror = () => {
      if (currentSessionId !== sessionId) return;
      clearTimers();
      if (currentText === rawKey) {
        playOnlineHebrewStream(clean, rawKey, sessionId, false);
      }
    };

    synth.speak(u);
  } else {
    playOnlineHebrewStream(clean, rawKey, sessionId, true);
  }
}

export function speak(text: string, opts: { rate?: number; gender?: ChildGender } = {}): void {
  if (!ttsSupported) return;
  const raw = text.trim();
  if (!raw) return;

  // Toggle behavior: clicking the same active speaker button stops playback
  if (currentText === raw) {
    stopSpeaking();
    return;
  }

  stopSpeaking();
  const sessionId = currentSessionId;
  lastSpeakStartAt = Date.now();
  // Unlock Web Audio API synchronously inside the click gesture
  ensureAudioContext();

  const gender = opts.gender ?? activeChildGender;
  const clean = normalizeHebrewText(raw, gender);
  if (!clean) return;

  currentText = raw;
  notifyListeners();

  const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;
  if (hasSpeech) window.speechSynthesis.getVoices();

  const shouldTryGemini =
    activeTtsSettings.engine === 'auto' &&
    Boolean(getGeminiApiKey()) &&
    activeTtsSettings.dailyQuotaLimit > 0;

  if (shouldTryGemini) {
    const abortCtrl = new AbortController();
    currentAbort = abortCtrl;
    const voice = activeTtsSettings.geminiVoice;
    synthesizeWithGeminiTts(clean, voice, gender, abortCtrl.signal)
      .then((res) => {
        if (currentSessionId !== sessionId || currentText !== raw || abortCtrl.signal.aborted) return;
        if (res) {
          lastUsedBackendLabel = `Gemini AI (${voice}${res.fromCache ? ' · מ-Cache' : ''})`;
          notifyListeners();
          playAudioBuffer(res.buffer, raw, sessionId, () => speakWithBrowserVoice(clean, raw, sessionId, opts));
        } else {
          speakWithBrowserVoice(clean, raw, sessionId, opts);
        }
      })
      .catch(() => {
        if (currentSessionId === sessionId && currentText === raw && !abortCtrl.signal.aborted) {
          speakWithBrowserVoice(clean, raw, sessionId, opts);
        }
      });
    return;
  }

  // Wait 60ms after cancel() so Chromium doesn't drop the new utterance
  speakTimer = setTimeout(() => {
    if (currentSessionId !== sessionId || currentText !== raw) return;
    speakWithBrowserVoice(clean, raw, sessionId, opts);
  }, 60);
}

/** Tier 1: read a screen aloud automatically whenever `text` changes. */
export function useAutoSpeak(text: string, enabled: boolean): void {
  const last = useRef('');
  useEffect(() => {
    if (!enabled || !text.trim() || text === last.current) return;
    last.current = text;
    const t = setTimeout(() => speak(text), 350);
    return () => clearTimeout(t);
  }, [text, enabled]);
  useEffect(() => () => stopSpeaking(), []);
}
