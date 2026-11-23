import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DataRepository } from '../data/DataRepository';
import { setTtsConfig, stopSpeaking } from '../hooks/tts';
import { GameContext, useFamilyGameLoader, type GameMode } from '../hooks/useFamilyGame';
import type { FamilyGameState } from '../types';
import { FamilySelector } from './FamilySelector';
import { ParentPortal } from './ParentPortal';
import { TurnScreen } from './turn/TurnScreen';

type Screen = { name: 'selector' } | { name: 'turn'; childId: string } | { name: 'parent' };

export function GameApp({
  repo,
  mode,
  today,
  createInitial,
  offlineWeather,
  toolbar,
  forcedChildId,
}: {
  repo: DataRepository;
  mode: GameMode;
  today: string;
  createInitial: () => Promise<FamilyGameState>;
  offlineWeather?: boolean;
  /** Extra controls rendered above the selector (demo tier switcher). */
  toolbar?: (api: { family: FamilyGameState; openChild: (id: string) => void }) => ReactNode;
  forcedChildId?: string;
}) {
  const { family, error, saveError, update } = useFamilyGameLoader({ repo, mode, today, createInitial, offlineWeather });
  const [screen, setScreen] = useState<Screen>(forcedChildId ? { name: 'turn', childId: forcedChildId } : { name: 'selector' });
  useEffect(() => {
    if (family?.settings?.tts) {
      setTtsConfig(family.settings.tts);
    }
  }, [family?.settings?.tts]);
  const api = useMemo(() => (family ? { family, repo, mode, today, update, saveError } : null), [family, repo, mode, today, update, saveError]);
  const openChild = useCallback((childId: string) => {
    stopSpeaking();
    setScreen({ name: 'turn', childId });
  }, []);
  const backHome = useCallback(() => {
    stopSpeaking();
    setScreen({ name: 'selector' });
  }, []);

  if (error) return <p className="card down" role="alert">שגיאה בטעינת המשחק: {error}</p>;
  if (!api) return <p className="loading" aria-busy="true">טוען את השוק… 🌱</p>;

  return (
    <GameContext.Provider value={api}>
      {saveError && <p className="gentle-warn" role="alert">השמירה נכשלה: {saveError}</p>}
      {screen.name === 'selector' && (
        <>
          {toolbar?.({ family: api.family, openChild })}
          <FamilySelector
            onPick={openChild}
            onParent={() => {
              stopSpeaking();
              setScreen({ name: 'parent' });
            }}
          />
        </>
      )}
      {screen.name === 'turn' && <TurnScreen key={screen.childId + today} childId={screen.childId} onExit={backHome} />}
      {screen.name === 'parent' && <ParentPortal onExit={backHome} />}
    </GameContext.Provider>
  );
}
