import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { DataRepository } from '../data/DataRepository';
import { ensureMarketTick } from '../engine/market';
import { fetchWeather, seasonalFallback } from '../engine/weather';
import type { FamilyGameState } from '../types';

export type GameMode = 'demo' | 'local' | 'firestore';

export interface GameApi {
  family: FamilyGameState;
  repo: DataRepository;
  mode: GameMode;
  today: string;
  /** Apply a mutation to a draft copy, then persist it. */
  update: (mutator: (draft: FamilyGameState) => void) => FamilyGameState;
  saveError: string | null;
}

export const GameContext = createContext<GameApi | null>(null);

export function useGame(): GameApi {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame outside GameContext');
  return ctx;
}

interface Options {
  repo: DataRepository;
  mode: GameMode;
  today: string;
  createInitial: () => Promise<FamilyGameState>;
  offlineWeather?: boolean;
}

/** Loads the family, runs the lazy daily market tick, and exposes `update`. */
export function useFamilyGameLoader({ repo, today, createInitial, offlineWeather }: Options) {
  const [family, setFamily] = useState<FamilyGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const familyRef = useRef<FamilyGameState | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flush = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = undefined;
    const s = familyRef.current;
    if (!s) return;
    repo.saveFamily(s).then(
      () => setSaveError(null),
      (e: unknown) => setSaveError(e instanceof Error ? e.message : String(e)),
    );
  }, [repo]);

  // Debounced persistence: typing in the parent portal or rapid trades
  // coalesce into one write (matters for Firestore's free-tier quotas).
  const persist = useCallback(
    (next: FamilyGameState) => {
      familyRef.current = next;
      setFamily(next);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, repo.kind === 'firestore' ? 800 : 150);
    },
    [flush, repo],
  );

  useEffect(() => {
    const onHide = () => saveTimer.current && flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      if (saveTimer.current) flush();
    };
  }, [flush]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let state = familyRef.current ?? (await repo.loadFamily());
        let dirty = false;
        if (!state) {
          state = await createInitial();
          dirty = true;
        }
        if (state.lastMarketTickDate !== today) {
          const weather = offlineWeather
            ? seasonalFallback(today, state.familyId)
            : await fetchWeather(today, state.familyId, state.settings.latitude, state.settings.longitude);
          state = structuredClone(state);
          ensureMarketTick(state, today, weather);
          dirty = true;
        }
        if (cancelled) return;
        if (dirty) persist(state);
        else {
          familyRef.current = state;
          setFamily(state);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, today]);

  const update = useCallback(
    (mutator: (draft: FamilyGameState) => void) => {
      const current = familyRef.current;
      if (!current) throw new Error('family not loaded');
      const draft = structuredClone(current);
      mutator(draft);
      persist(draft);
      return draft;
    },
    [persist],
  );

  return { family, error, saveError, update };
}

/** Re-render when the calendar day rolls over or the tab becomes visible again. */
export function useToday(getToday: () => string): string {
  const [today, setToday] = useState(getToday);
  useEffect(() => {
    const check = () => setToday(getToday());
    const id = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [getToday]);
  return today;
}
