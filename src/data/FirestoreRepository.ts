import type { Firestore } from 'firebase/firestore';
import type { Auth, User } from 'firebase/auth';
import type { FamilyGameState, FeedbackReport } from '../types';
import { migrate, type DataRepository } from './DataRepository';
import { firebaseConfig } from './firebase';

/**
 * Phase 2: multi-tenant Firestore storage. Each family lives at
 * `families/{familyId}` where familyId is the parent's Firebase Auth uid,
 * which the security rules (firestore.rules) enforce.
 */
export class FirestoreRepository implements DataRepository {
  readonly kind = 'firestore' as const;

  private constructor(
    private readonly db: Firestore,
    readonly user: User,
    private readonly fs: typeof import('firebase/firestore'),
  ) {}

  get familyId() {
    return this.user.uid;
  }

  /** Initialises Firebase, signs the parent in with Google, returns a repository. */
  static async signIn(): Promise<FirestoreRepository> {
    const [{ initializeApp, getApps }, authMod, fs] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ]);
    const app = getApps()[0] ?? initializeApp(firebaseConfig);
    const auth: Auth = authMod.getAuth(app);
    const user = auth.currentUser ?? (await authMod.signInWithPopup(auth, new authMod.GoogleAuthProvider())).user;
    return new FirestoreRepository(fs.getFirestore(app), user, fs);
  }

  async signOut() {
    const authMod = await import('firebase/auth');
    await authMod.signOut(authMod.getAuth());
  }

  private familyDoc() {
    return this.fs.doc(this.db, 'families', this.familyId);
  }

  async loadFamily(): Promise<FamilyGameState | null> {
    const snap = await this.fs.getDoc(this.familyDoc());
    return snap.exists() ? migrate(snap.data() as FamilyGameState) : null;
  }

  async saveFamily(state: FamilyGameState): Promise<void> {
    // Firestore rejects `undefined`; JSON round-trip strips it.
    const clean = JSON.parse(JSON.stringify({ ...state, familyId: this.familyId })) as FamilyGameState;
    await this.fs.setDoc(this.familyDoc(), { ...clean, ownerUid: this.familyId });
  }

  async submitFeedback(report: FeedbackReport): Promise<void> {
    await this.fs.addDoc(this.fs.collection(this.db, 'feedback'), {
      ...report,
      familyId: this.familyId,
      createdAt: this.fs.serverTimestamp(),
      clientCreatedAt: report.createdAt,
    });
  }

  async resetFamily(): Promise<void> {
    await this.fs.deleteDoc(this.familyDoc());
  }
}
