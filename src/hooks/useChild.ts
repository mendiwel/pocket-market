import { useCallback } from 'react';
import type { ChildProfile, FamilyGameState } from '../types';
import { useGame } from './useFamilyGame';

export function useChild(childId: string) {
  const game = useGame();
  const child = game.family.children.find((c) => c.id === childId);
  const mutate = useCallback(
    <T,>(fn: (child: ChildProfile, family: FamilyGameState) => T): T => {
      let result!: T;
      game.update((draft) => {
        const c = draft.children.find((x) => x.id === childId);
        if (!c) throw new Error('child not found');
        result = fn(c, draft);
      });
      return result;
    },
    [game, childId],
  );
  return { ...game, child, mutate };
}
