import type { FamilyGameState, FeedbackReport } from '../types';
import type { DataRepository } from './DataRepository';

/** Ephemeral sandbox for the zero-login demo. Never touches the network. */
export class InMemoryDemoRepository implements DataRepository {
  readonly kind = 'demo' as const;
  private state: FamilyGameState | null;
  readonly feedback: FeedbackReport[] = [];

  constructor(initial: FamilyGameState | null = null) {
    this.state = initial ? structuredClone(initial) : null;
  }

  async loadFamily() {
    return this.state ? structuredClone(this.state) : null;
  }

  async saveFamily(state: FamilyGameState) {
    this.state = structuredClone(state);
  }

  async submitFeedback(report: FeedbackReport) {
    this.feedback.push(report);
  }

  async resetFamily() {
    this.state = null;
  }
}
