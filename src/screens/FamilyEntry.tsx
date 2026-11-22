import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DataRepository } from '../data/DataRepository';
import { isFirebaseConfigured } from '../data/firebase';
import { LocalStorageRepository } from '../data/LocalStorageRepository';
import { toISODate } from '../engine/date';
import { DEFAULT_PIN, hashPin } from '../engine/pin';
import { createFamily, SEED_CHILDREN } from '../engine/seed';
import { useToday } from '../hooks/useFamilyGame';
import { GameApp } from './GameApp';

const getToday = () => toISODate(new Date());

export function FamilyEntry() {
  const today = useToday(getToday);
  const local = useMemo(() => new LocalStorageRepository(), []);
  const [cloud, setCloud] = useState<DataRepository | null>(null);
  const [useLocal, setUseLocal] = useState(!isFirebaseConfigured);
  const [err, setErr] = useState('');

  useEffect(() => {
    document.title = 'שוק הכיס — המשפחה שלי';
  }, []);

  const repo = cloud ?? (useLocal ? local : null);
  const createInitial = useCallback(async () => {
    if (repo?.kind === 'firestore') {
      const id = (repo as unknown as { familyId: string }).familyId;
      return createFamily({ familyId: id, familyNameHe: 'שלנו', today, parentPinHash: await hashPin(id, DEFAULT_PIN), children: [] });
    }
    const id = 'local-family';
    return createFamily({ familyId: id, familyNameHe: 'שלנו', today, parentPinHash: await hashPin(id, DEFAULT_PIN), children: SEED_CHILDREN });
  }, [repo, today]);

  if (!repo) {
    return (
      <section className="card pin-card" aria-labelledby="signin-h">
        <h1 id="signin-h">כניסת הורים</h1>
        <p>התחברו עם חשבון Google כדי לשמור את המשפחה בענן ולשחק מכל מחשב.</p>
        <button
          type="button"
          className="btn btn--primary btn--lg"
          onClick={async () => {
            try {
              const { FirestoreRepository } = await import('../data/FirestoreRepository');
              setCloud(await FirestoreRepository.signIn());
            } catch (e) {
              setErr(e instanceof Error ? e.message : String(e));
            }
          }}
        >
          התחברות עם Google
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setUseLocal(true)}>
          להמשיך במחשב הזה בלבד (בלי חשבון)
        </button>
        {err && <p className="down" role="alert">{err}</p>}
      </section>
    );
  }

  return <GameApp repo={repo} mode={repo.kind === 'firestore' ? 'firestore' : 'local'} today={today} createInitial={createInitial} />;
}
