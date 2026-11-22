import type { FamilyGameState, FeedbackReport } from '../types';

/**
 * All persistence goes through this interface (SPEC §11.3) so the game runs
 * unchanged on the zero-login demo, on a single local device, or on Firestore.
 */
export interface DataRepository {
  readonly kind: 'demo' | 'local' | 'firestore';
  /** Returns null when no family exists yet. */
  loadFamily(): Promise<FamilyGameState | null>;
  saveFamily(state: FamilyGameState): Promise<void>;
  submitFeedback(report: FeedbackReport): Promise<void>;
  /** Wipes the family (parent portal "start over"). */
  resetFamily(): Promise<void>;
}

/** Bump with a migration when FamilyGameState changes shape. */
export const SCHEMA_VERSION = 1;

export function migrate(state: FamilyGameState): FamilyGameState {
  // v1 is the first persisted schema; future migrations go here.
  return { ...state, schemaVersion: SCHEMA_VERSION };
}
