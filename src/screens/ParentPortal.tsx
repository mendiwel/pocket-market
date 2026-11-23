import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Avatar, resizeAvatarFile } from '../components/Avatar';
import { ACHIEVEMENTS } from '../engine/rewards';
import { AVATARS } from '../engine/catalog';
import { money } from '../engine/format';
import { categoriesHeld, netWorth } from '../engine/portfolio';
import { DEFAULT_PIN, hashPin, verifyPin } from '../engine/pin';
import { uid } from '../engine/rng';
import { createChild, DEFAULT_TTS_SETTINGS, inferGenderFromName, TIER_LABEL_HE, tierForAge } from '../engine/seed';
import { GEMINI_VOICES, setTtsConfig, speak } from '../hooks/tts';
import { useGame } from '../hooks/useFamilyGame';
import type { AgeTier, ChildGender, FeedbackReport, GeminiVoiceName, TtsSettings } from '../types';

declare const __APP_VERSION__: string;

type Tab = 'kids' | 'budget' | 'analytics' | 'feedback' | 'settings';

const CITIES = [
  { nameHe: 'ירושלים', latitude: 31.7683, longitude: 35.2137 },
  { nameHe: 'תל אביב', latitude: 32.0853, longitude: 34.7818 },
  { nameHe: 'חיפה', latitude: 32.794, longitude: 34.9896 },
  { nameHe: 'בני ברק', latitude: 32.0807, longitude: 34.8338 },
  { nameHe: 'באר שבע', latitude: 31.2518, longitude: 34.7913 },
  { nameHe: 'אילת', latitude: 29.5577, longitude: 34.9519 },
];

export function ParentPortal({ onExit }: { onExit: () => void }) {
  const { family, mode } = useGame();
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<Tab>('kids');

  async function tryUnlock(e: FormEvent) {
    e.preventDefault();
    if (await verifyPin(family.familyId, pin, family.parentPinHash)) {
      setUnlocked(true);
      setErr('');
    } else setErr('קוד שגוי');
  }

  if (!unlocked) {
    return (
      <section className="portal portal--gate" aria-labelledby="gate-h">
        <form className="card pin-card" onSubmit={tryUnlock}>
          <h1 id="gate-h">🔒 אזור הורים</h1>
          <label className="field">
            <span>קוד הורים</span>
            <input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus />
          </label>
          {err && <p className="down" role="alert">{err}</p>}
          {(mode === 'demo' || family.parentPinHash === '') && <p className="muted">בדמו הקוד הוא {DEFAULT_PIN}</p>}
          {mode !== 'demo' && <p className="muted">קוד ברירת המחדל הוא {DEFAULT_PIN} — מומלץ להחליף בהגדרות.</p>}
          <div className="row">
            <button type="submit" className="btn btn--primary">כניסה</button>
            <button type="button" className="btn btn--ghost" onClick={onExit}>חזרה</button>
          </div>
        </form>
      </section>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'kids', label: '👨‍👩‍👧‍👦 ילדים' },
    { id: 'budget', label: '💰 תקציב ובונוסים' },
    { id: 'analytics', label: '📊 התקדמות' },
    { id: 'feedback', label: '🐞 משוב ותקלות' },
    { id: 'settings', label: '⚙️ הגדרות' },
  ];

  return (
    <section className="portal" aria-labelledby="portal-h">
      <header className="selector__head">
        <h1 id="portal-h">אזור הורים — משפחת {family.familyNameHe}</h1>
        <button type="button" className="btn" onClick={onExit}>חזרה למשחק</button>
      </header>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" className="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'kids' && <KidsTab />}
        {tab === 'budget' && <BudgetTab />}
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'feedback' && <FeedbackTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </section>
  );
}

function KidsTab() {
  const { family, update } = useGame();
  const [name, setName] = useState('');
  const [age, setAge] = useState(8);
  const [gender, setGender] = useState<ChildGender>('male');
  const [avatar, setAvatar] = useState('panda');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoErr, setPhotoErr] = useState('');

  async function handleKidPhoto(childId: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeAvatarFile(file);
      update((f) => {
        const kid = f.children.find((x) => x.id === childId);
        if (kid) kid.photoDataUrl = dataUrl;
      });
      setPhotoErr('');
    } catch {
      setPhotoErr('לא ניתן היה לטעון את התמונה');
    }
    e.target.value = '';
  }

  async function handleNewPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setPhoto(await resizeAvatarFile(file));
      setPhotoErr('');
    } catch {
      setPhotoErr('לא ניתן היה לטעון את התמונה');
    }
    e.target.value = '';
  }

  function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    update((f) => {
      f.children.push(createChild({ id: uid('kid'), name: name.trim(), age, gender, avatarId: avatar, photoDataUrl: photo }, f.currentMonth));
    });
    setName('');
    setPhoto(null);
  }

  return (
    <div className="stack">
      {photoErr && <p className="down" role="alert">{photoErr}</p>}
      <ul className="parent-kids">
        {family.children.map((c) => (
          <li key={c.id} className="card parent-kid">
            <div className="avatar-upload">
              <Avatar avatarId={c.avatarId} photoDataUrl={c.photoDataUrl} size={64} />
              <div className="avatar-upload__actions">
                <label className="btn btn--sm">
                  📷 תמונה
                  <input type="file" accept="image/*" hidden onChange={(e) => handleKidPhoto(c.id, e)} />
                </label>
                {c.photoDataUrl && (
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={() => update((f) => void (f.children.find((x) => x.id === c.id)!.photoDataUrl = null))}
                    title="חזרה לדמות המצוירת"
                  >
                    איפוס תמונה
                  </button>
                )}
              </div>
            </div>
            <label className="field">
              <span>שם</span>
              <input value={c.name} onChange={(e) => update((f) => void (f.children.find((x) => x.id === c.id)!.name = e.target.value))} />
            </label>
            <label className="field field--narrow">
              <span>גיל</span>
              <input type="number" min={4} max={14} value={c.age} onChange={(e) => update((f) => void (f.children.find((x) => x.id === c.id)!.age = Number(e.target.value)))} />
            </label>
            <label className="field field--narrow">
              <span>לשון הקראה</span>
              <select
                value={c.gender ?? inferGenderFromName(c.name)}
                onChange={(e) => update((f) => void (f.children.find((x) => x.id === c.id)!.gender = e.target.value as ChildGender))}
              >
                <option value="male">בן (זכר)</option>
                <option value="female">בת (נקבה)</option>
              </select>
            </label>
            <label className="field">
              <span>מסלול</span>
              <select value={c.tier} onChange={(e) => update((f) => void (f.children.find((x) => x.id === c.id)!.tier = e.target.value as AgeTier))}>
                {(Object.keys(TIER_LABEL_HE) as AgeTier[]).map((t) => (
                  <option key={t} value={t}>{TIER_LABEL_HE[t]}</option>
                ))}
              </select>
            </label>
            <div className="row">
              <button type="button" className="btn btn--sm" disabled={!c.lastTurnDate} onClick={() => update((f) => void (f.children.find((x) => x.id === c.id)!.lastTurnDate = null))}>
                🔓 לאפשר תור נוסף היום
              </button>
              <button
                type="button"
                className="btn btn--sm btn--danger"
                onClick={() => {
                  if (confirm(`למחוק את ${c.name}? כל ההתקדמות תימחק.`)) update((f) => void (f.children = f.children.filter((x) => x.id !== c.id)));
                }}
              >
                🗑️ הסרה
              </button>
            </div>
          </li>
        ))}
      </ul>
      <form className="card" onSubmit={add}>
        <h2>הוספת ילד/ה</h2>
        <div className="row row--wrap">
          <label className="field">
            <span>שם</span>
            <input
              value={name}
              onChange={(e) => {
                const v = e.target.value;
                setName(v);
                if (v.trim()) setGender(inferGenderFromName(v));
              }}
              required
            />
          </label>
          <label className="field field--narrow">
            <span>גיל</span>
            <input type="number" min={4} max={14} value={age} onChange={(e) => setAge(Number(e.target.value))} />
          </label>
          <label className="field field--narrow">
            <span>לשון הקראה</span>
            <select value={gender} onChange={(e) => setGender(e.target.value as ChildGender)}>
              <option value="male">בן (זכר)</option>
              <option value="female">בת (נקבה)</option>
            </select>
          </label>
          <span className="muted">מסלול: {TIER_LABEL_HE[tierForAge(age)]}</span>
        </div>
        <fieldset className="avatar-pick">
          <legend>דמות או תמונה אישית</legend>
          {Object.keys(AVATARS).map((id) => (
            <label key={id} className="avatar-pick__opt">
              <input type="radio" name="avatar" value={id} checked={!photo && avatar === id} onChange={() => { setAvatar(id); setPhoto(null); }} />
              <Avatar avatarId={id} size={44} />
            </label>
          ))}
        </fieldset>
        <div className="row row--wrap" style={{ marginBlockEnd: 12 }}>
          <label className="btn btn--sm">
            📷 העלאת תמונה של הילד/ה
            <input type="file" accept="image/*" hidden onChange={handleNewPhoto} />
          </label>
          {photo && (
            <>
              <Avatar avatarId={avatar} photoDataUrl={photo} size={52} />
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => setPhoto(null)}>
                הסרת תמונה
              </button>
            </>
          )}
        </div>
        <button type="submit" className="btn btn--primary">הוספה</button>
      </form>
    </div>
  );
}

function BudgetTab() {
  const { family, update } = useGame();
  const [kid, setKid] = useState(family.children[0]?.id ?? '');
  const [bonus, setBonus] = useState(30);
  const [reason, setReason] = useState('');
  const [newsTitle, setNewsTitle] = useState('');
  const [newsBody, setNewsBody] = useState('');
  const [msg, setMsg] = useState('');

  function award(e: FormEvent) {
    e.preventDefault();
    const amount = Math.max(1, Math.min(100, bonus));
    update((f) => {
      const c = f.children.find((x) => x.id === kid);
      c?.inbox.push({
        id: uid('bonus'),
        kind: 'parent_bonus',
        icon: '🧹',
        titleHe: 'בונוס מההורים',
        bodyHe: reason.trim() || 'תודה על העזרה בבית!',
        amount,
        createdMonth: f.currentMonth,
        resolved: false,
      });
    });
    setMsg('הבונוס יחכה בתיבת הדואר של הילד/ה בתור הבא.');
    setReason('');
  }

  function addNews(e: FormEvent) {
    e.preventDefault();
    if (!newsTitle.trim()) return;
    update((f) => {
      f.news.push({ id: `${f.currentMonth}:${uid('fam')}`, month: f.currentMonth, icon: '🏠', titleHe: newsTitle.trim(), descriptionHe: newsBody.trim(), source: 'family' });
    });
    setNewsTitle('');
    setNewsBody('');
    setMsg('החדשה תופיע בתדריך הבוקר של כל הילדים.');
  }

  const expenses = family.children[0]?.fixedMonthlyExpenses ?? 50;
  return (
    <div className="stack">
      {msg && <p className="gentle-warn" role="status">{msg}</p>}
      <article className="card">
        <h2>דמי כיס חודשיים</h2>
        <label className="field field--narrow">
          <span>₪ לחודש משחק</span>
          <input type="number" min={50} max={400} step={10} value={family.settings.monthlyAllowance} onChange={(e) => update((f) => void (f.settings.monthlyAllowance = Math.max(0, Number(e.target.value))))} />
        </label>
        <p className="muted">
          ברירת המחדל 150 ₪. עם הוצאות קבועות של כ-{money(expenses)} נשארים לילדים כ-{money(family.settings.monthlyAllowance - expenses)} לחיסכון והשקעה בכל חודש. ערך גבוה מדי יוצר אינפלציה במשחק.
        </p>
      </article>
      <form className="card" onSubmit={award}>
        <h2>🧹 בונוס על עזרה אמיתית בבית</h2>
        <div className="row row--wrap">
          <label className="field">
            <span>ילד/ה</span>
            <select value={kid} onChange={(e) => setKid(e.target.value)}>
              {family.children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field field--narrow">
            <span>סכום (עד 100)</span>
            <input type="number" min={1} max={100} value={bonus} onChange={(e) => setBonus(Number(e.target.value))} />
          </label>
          <label className="field">
            <span>על מה?</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="סידור החדר, עזרה במטבח..." />
          </label>
        </div>
        <button type="submit" className="btn btn--primary">שליחת בונוס</button>
      </form>
      <form className="card" onSubmit={addNews}>
        <h2>🏠 חדשה משפחתית</h2>
        <label className="field">
          <span>כותרת</span>
          <input value={newsTitle} onChange={(e) => setNewsTitle(e.target.value)} placeholder="סבא וסבתא מגיעים לשבת!" />
        </label>
        <label className="field">
          <span>פירוט</span>
          <textarea rows={2} value={newsBody} onChange={(e) => setNewsBody(e.target.value)} />
        </label>
        <button type="submit" className="btn btn--primary">פרסום</button>
      </form>
    </div>
  );
}

function AnalyticsTab() {
  const { family } = useGame();
  return (
    <div className="card table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">ילד/ה</th>
            <th scope="col">שווי כולל</th>
            <th scope="col">מזומן</th>
            <th scope="col">עץ חיסכון</th>
            <th scope="col">תרומות 💝</th>
            <th scope="col">פיזור</th>
            <th scope="col">רצף</th>
            <th scope="col">⭐</th>
            <th scope="col">הישגים</th>
          </tr>
        </thead>
        <tbody>
          {family.children.map((c) => (
            <tr key={c.id}>
              <th scope="row">{c.name}</th>
              <td>{money(netWorth(c, family.assets))}</td>
              <td>{money(c.cash)}</td>
              <td>{money(c.savingsTreeBalance)}</td>
              <td>{money(c.stats.totalDonated ?? 0)}</td>
              <td>{categoriesHeld(c, family.assets).length} סוגים</td>
              <td>🔥 {c.dailyStreak}</td>
              <td>{c.xp}</td>
              <td>
                {c.achievements.length === 0
                  ? '—'
                  : c.achievements.map((id) => {
                      const a = ACHIEVEMENTS.find((x) => x.id === id);
                      return a ? <span key={id} title={a.nameHe}>{a.icon}</span> : null;
                    })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeedbackTab() {
  const { family, repo } = useGame();
  const [type, setType] = useState<FeedbackReport['type']>('bug');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setStatus('sending');
    const report: FeedbackReport = {
      id: uid('fb'),
      familyId: family.familyId,
      type,
      message: message.trim().slice(0, 2000),
      createdAt: new Date().toISOString(),
      // Non-PII diagnostics only.
      metadata: { appVersion: __APP_VERSION__, route: location.hash || '/', userAgent: navigator.userAgent },
    };
    try {
      await repo.submitFeedback(report);
      setStatus('sent');
      setMessage('');
    } catch {
      setStatus('error');
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>🐞 משוב, תקלות והצעות</h2>
      <label className="field">
        <span>סוג</span>
        <select value={type} onChange={(e) => setType(e.target.value as FeedbackReport['type'])}>
          <option value="bug">תקלה</option>
          <option value="improvement">הצעה לשיפור</option>
          <option value="difficulty">רמת קושי</option>
          <option value="other">אחר</option>
        </select>
      </label>
      <label className="field">
        <span>מה קרה? מה הייתם רוצים?</span>
        <textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} required maxLength={2000} />
      </label>
      <p className="muted">נשלחים גם: גרסת האפליקציה ({__APP_VERSION__}), המסך הנוכחי וסוג הדפדפן. לא נשלח מידע אישי.</p>
      <button type="submit" className="btn btn--primary" disabled={status === 'sending'}>שליחה</button>
      {status === 'sent' && <p className="up" role="status">תודה! המשוב נשמר.</p>}
      {status === 'error' && <p className="down" role="alert">השליחה נכשלה, נסו שוב.</p>}
    </form>
  );
}

function SettingsTab() {
  const { family, update, repo, mode } = useGame();
  const [newPin, setNewPin] = useState('');
  const [msg, setMsg] = useState('');
  const tts: TtsSettings = { ...DEFAULT_TTS_SETTINGS, ...family.settings.tts };

  function updateTts(patch: Partial<TtsSettings>) {
    const next: TtsSettings = { ...tts, ...patch };
    setTtsConfig(next);
    update((f) => {
      f.settings.tts = next;
    });
  }

  async function changePin(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{4,8}$/.test(newPin)) {
      setMsg('קוד של 4–8 ספרות');
      return;
    }
    const h = await hashPin(family.familyId, newPin);
    update((f) => void (f.parentPinHash = h));
    setNewPin('');
    setMsg('הקוד עודכן');
  }

  return (
    <div className="stack">
      {msg && <p className="gentle-warn" role="status">{msg}</p>}
      <article className="card stack">
        <h2>🎙️ קול והקראה</h2>
        <div className="row row--wrap" style={{ alignItems: 'flex-end' }}>
          <label className="field">
            <span>בחירת קול הקראה</span>
            <select value={tts.geminiVoice} onChange={(e) => updateTts({ geminiVoice: e.target.value as GeminiVoiceName })}>
              {GEMINI_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.labelHe} — {v.descHe}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() =>
              speak('בוקר טוב! במכולת השכונה המחירים יציבים. קיבלת דמי כיס של מאה וחמישים שקלים, ושילמת הוצאות חמישים שקלים.', {
                gender: 'male',
              })
            }
          >
            🔊 השמעת דוגמה (בן)
          </button>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() =>
              speak('בוקר טוב! במכולת השכונה המחירים יציבים. קיבלת דמי כיס של מאה וחמישים שקלים, ושילמת הוצאות חמישים שקלים.', {
                gender: 'female',
              })
            }
          >
            🔊 השמעת דוגמה (בת)
          </button>
        </div>
      </article>

      <article className="card">
        <h2>שם המשפחה</h2>
        <label className="field">
          <span>משפחת…</span>
          <input value={family.familyNameHe} onChange={(e) => update((f) => void (f.familyNameHe = e.target.value))} />
        </label>
      </article>
      <article className="card">
        <h2>📍 מיקום למזג האוויר</h2>
        <label className="field">
          <span>עיר</span>
          <select
            value={family.settings.locationNameHe}
            onChange={(e) => {
              const c = CITIES.find((x) => x.nameHe === e.target.value)!;
              update((f) => void Object.assign(f.settings, { locationNameHe: c.nameHe, latitude: c.latitude, longitude: c.longitude }));
            }}
          >
            {CITIES.map((c) => <option key={c.nameHe}>{c.nameHe}</option>)}
          </select>
        </label>
        <p className="muted">מזג האוויר מגיע מ-Open-Meteo (ללא הרשמה). בלי אינטרנט — תחזית עונתית.</p>
      </article>
      <form className="card" onSubmit={changePin}>
        <h2>🔑 החלפת קוד הורים</h2>
        <label className="field field--narrow">
          <span>קוד חדש</span>
          <input type="password" inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value)} autoComplete="new-password" />
        </label>
        <button type="submit" className="btn btn--primary">שמירה</button>
      </form>
      {mode !== 'demo' && (
        <article className="card">
          <h2>⚠️ התחלה מחדש</h2>
          <p className="muted">מוחק את כל נתוני המשפחה במכשיר/בחשבון זה.</p>
          <button
            type="button"
            className="btn btn--danger"
            onClick={async () => {
              if (confirm('למחוק את כל ההתקדמות של כל הילדים? אין דרך חזרה.')) {
                await repo.resetFamily();
                location.reload();
              }
            }}
          >
            מחיקת כל הנתונים
          </button>
        </article>
      )}
    </div>
  );
}
