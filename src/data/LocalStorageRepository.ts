import type { FamilyGameState, FeedbackReport } from '../types';
import { migrate, type DataRepository } from './DataRepository';

const FAMILY_KEY = 'pocket-market:family:v1';
const FEEDBACK_KEY = 'pocket-market:feedback:v1';

/** Phase 1: single-family, single-device persistence. */
export class LocalStorageRepository implements DataRepository {
  readonly kind = 'local' as const;

  constructor(private readonly storage: Storage = window.localStorage) {}

  async loadFamily(): Promise<FamilyGameState | null> {
    try {
      const raw = this.storage.getItem(FAMILY_KEY);
      return raw ? migrate(JSON.parse(raw) as FamilyGameState) : null;
    } catch {
      return null;
    }
  }

  async saveFamily(state: FamilyGameState): Promise<void> {
    this.storage.setItem(FAMILY_KEY, JSON.stringify(state));
  }

  async submitFeedback(report: FeedbackReport): Promise<void> {
    const list = this.listFeedback();
    list.push(report);
    this.storage.setItem(FEEDBACK_KEY, JSON.stringify(list.slice(-100)));
  }

  listFeedback(): FeedbackReport[] {
    try {
      return JSON.parse(this.storage.getItem(FEEDBACK_KEY) ?? '[]') as FeedbackReport[];
    } catch {
      return [];
    }
  }

  async resetFamily(): Promise<void> {
    this.storage.removeItem(FAMILY_KEY);
  }
}
