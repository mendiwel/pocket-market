import { useState, type FormEvent, type ReactNode } from 'react';

// Site-wide authorization gate + AES-256-GCM key vault (OWASP 2026 Hardened):
// 1. Blocks access to the entire application until the user enters the authorization code.
// 2. The Gemini API key is NEVER stored in plaintext in the production JavaScript bundle;
//    it is AES-256-GCM encrypted at build time with PBKDF2-SHA256 (310,000 iterations + 128-bit random salt)
//    derived from the access code, and can only be decrypted in memory after the valid authorization code is entered.
// 3. Enforces brute-force lockout (max 5 attempts before a 15-minute cooldown) and uses sessionStorage by default.

declare const __ENCRYPTED_GEMINI_VAULT__: string;
declare const __ACCESS_CODE_VERIFIER__: string;

const ACCESS_SESSION_KEY = 'pocket-market.site.accessCode.session.v2';
const LOCKOUT_STORAGE_KEY = 'pocket-market.site.lockout.v1';
const PBKDF2_ITERATIONS = 310_000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60_000; // 15 minutes

let unlockedRuntimeGeminiKey = '';

export function getUnlockedRuntimeGeminiKey(): string {
  return unlockedRuntimeGeminiKey;
}

export function setUnlockedRuntimeGeminiKey(key: string): void {
  unlockedRuntimeGeminiKey = key;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  if (clean.length % 2 !== 0) return new Uint8Array(0);
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string comparison to prevent timing side-channel attacks. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function normalizeAccessCode(input: string): string {
  return input.trim();
}

export async function derivePbkdf2Hex(code: string, saltHex: string): Promise<string> {
  const normalized = normalizeAccessCode(code);
  const salt = hexToBytes(saltHex);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(normalized),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

export async function verifySaltedAccessVerifier(code: string, verifierStr?: string): Promise<boolean> {
  const verifier = verifierStr ?? (typeof __ACCESS_CODE_VERIFIER__ !== 'undefined' ? __ACCESS_CODE_VERIFIER__ : '');
  if (!verifier || !verifier.includes(':')) return false;
  const [saltHex, expectedHex] = verifier.split(':');
  if (!saltHex || !expectedHex) return false;

  const actualHex = await derivePbkdf2Hex(code, saltHex);
  return constantTimeEqual(actualHex, expectedHex);
}

/**
 * Decrypts the build-time AES-256-GCM vault (`saltHex:ivHex:cipherHex`) using the user's access code.
 * Returns the decrypted API key on success, or null if the access code is wrong.
 */
export async function decryptGeminiVault(code: string, vaultStr?: string): Promise<string | null> {
  const vault = vaultStr ?? (typeof __ENCRYPTED_GEMINI_VAULT__ !== 'undefined' ? __ENCRYPTED_GEMINI_VAULT__ : '');
  if (!vault || !vault.includes(':')) return null;

  const parts = vault.split(':');
  if (parts.length !== 3) return null;

  const [saltHex, ivHex, cipherHex] = parts;
  const salt = hexToBytes(saltHex);
  const iv = hexToBytes(ivHex);
  const cipherBytes = hexToBytes(cipherHex);
  if (!salt.length || !iv.length || !cipherBytes.length) return null;

  try {
    const normalized = normalizeAccessCode(code);
    const baseKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(normalized),
      { name: 'PBKDF2' },
      false,
      ['deriveKey'],
    );
    const aesKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    const decryptedBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      aesKey,
      cipherBytes as BufferSource,
    );
    const plain = new TextDecoder().decode(decryptedBuf).trim();
    return plain || null;
  } catch {
    return null;
  }
}

interface LockoutState {
  failedAttempts: number;
  lockedUntil: number;
}

function loadLockoutState(): LockoutState {
  if (typeof window === 'undefined') return { failedAttempts: 0, lockedUntil: 0 };
  try {
    const raw = window.localStorage.getItem(LOCKOUT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LockoutState>;
      return {
        failedAttempts: typeof parsed.failedAttempts === 'number' ? parsed.failedAttempts : 0,
        lockedUntil: typeof parsed.lockedUntil === 'number' ? parsed.lockedUntil : 0,
      };
    }
  } catch {
    // ignore
  }
  return { failedAttempts: 0, lockedUntil: 0 };
}

function saveLockoutState(state: LockoutState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function getRemainingLockoutSeconds(): number {
  const state = loadLockoutState();
  const now = Date.now();
  if (state.lockedUntil > now) {
    return Math.ceil((state.lockedUntil - now) / 1000);
  }
  return 0;
}

export function resetAccessLockout(): void {
  saveLockoutState({ failedAttempts: 0, lockedUntil: 0 });
}

export async function verifyAndUnlockAccessCode(code: string): Promise<boolean> {
  if (getRemainingLockoutSeconds() > 0) {
    return false;
  }

  const normalized = normalizeAccessCode(code);
  if (!normalized) return false;

  const hasVerifier = typeof __ACCESS_CODE_VERIFIER__ !== 'undefined' && Boolean(__ACCESS_CODE_VERIFIER__);
  if (hasVerifier) {
    const valid = await verifySaltedAccessVerifier(normalized);
    if (!valid) {
      recordFailedAttempt();
      return false;
    }
  }

  const decryptedKey = await decryptGeminiVault(normalized);
  if (decryptedKey) {
    unlockedRuntimeGeminiKey = decryptedKey;
  } else if (!hasVerifier) {
    recordFailedAttempt();
    return false;
  }

  resetAccessLockout();
  try {
    window.sessionStorage.setItem(ACCESS_SESSION_KEY, normalized);
  } catch {
    // ignore storage errors
  }
  return true;
}

function recordFailedAttempt(): void {
  const state = loadLockoutState();
  const nextAttempts = state.failedAttempts + 1;
  if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
    saveLockoutState({
      failedAttempts: nextAttempts,
      lockedUntil: Date.now() + LOCKOUT_DURATION_MS,
    });
  } else {
    saveLockoutState({
      failedAttempts: nextAttempts,
      lockedUntil: 0,
    });
  }
}

export function lockSiteAccess(): void {
  unlockedRuntimeGeminiKey = '';
  try {
    window.sessionStorage.removeItem(ACCESS_SESSION_KEY);
    window.localStorage.removeItem('pocket-market.site.accessCode.v1');
  } catch {
    // ignore
  }
}

export function getSavedAccessCode(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(ACCESS_SESSION_KEY) ?? '';
  } catch {
    return '';
  }
}

export function AccessGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'locked' | 'unlocked'>('checking');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Check on mount if an active session or URL ?code= param unlocks the site
  useState(() => {
    (async () => {
      try {
        // Clear any legacy localStorage access code from older versions
        window.localStorage.removeItem('pocket-market.site.accessCode.v1');

        const params = new URLSearchParams(window.location.search);
        const urlCode = params.get('code') ?? params.get('access');
        if (urlCode && (await verifyAndUnlockAccessCode(urlCode))) {
          params.delete('code');
          params.delete('access');
          const cleanSearch = params.toString();
          const cleanUrl = `${window.location.pathname}${cleanSearch ? `?${cleanSearch}` : ''}${window.location.hash}`;
          window.history.replaceState({}, '', cleanUrl);
          setStatus('unlocked');
          return;
        }

        const saved = getSavedAccessCode();
        if (saved && (await verifyAndUnlockAccessCode(saved))) {
          setStatus('unlocked');
          return;
        }
      } catch {
        // ignore
      }
      setStatus('locked');
    })();
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim() || submitting) return;

    const lockoutSec = getRemainingLockoutSeconds();
    if (lockoutSec > 0) {
      const mins = Math.ceil(lockoutSec / 60);
      setErr(`יותר מדי ניסיונות שגויים. הגישה נחסמה זמנית — נסו שוב בעוד כ-${mins} דקות.`);
      return;
    }

    setSubmitting(true);
    setErr('');
    const ok = await verifyAndUnlockAccessCode(code);
    setSubmitting(false);
    if (ok) {
      setCode('');
      setStatus('unlocked');
    } else {
      const newLockoutSec = getRemainingLockoutSeconds();
      if (newLockoutSec > 0) {
        setErr('יותר מדי ניסיונות שגויים. הגישה נחסמה ל-15 דקות מטעמי אבטחה.');
      } else {
        setErr('קוד ההרשאה שגוי. הגישה לאתר מוגבלת למשתמשים מורשים בלבד.');
      }
    }
  }

  if (status === 'checking') {
    return (
      <div className="page" style={{ display: 'grid', placeItems: 'center', minHeight: '75vh' }}>
        <p className="loading">בודק הרשאת גישה מאובטחת… 🔒</p>
      </div>
    );
  }

  if (status === 'locked') {
    return (
      <main className="page" style={{ display: 'grid', placeItems: 'center', minHeight: '85vh', padding: '1.5rem' }}>
        <section className="card pin-card stack" aria-labelledby="access-gate-title" style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
            <img src="/favicon.svg" width="42" height="42" alt="" />
            <h1 id="access-gate-title" style={{ margin: 0 }}>שוק הכיס 🔒</h1>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            האתר מוגן ופתוח למשתמשים מורשים בלבד.
            <br />
            יש להזין קוד הרשאה כדי להיכנס לאפליקציה.
          </p>
          <form className="stack" onSubmit={handleSubmit}>
            <label className="field" style={{ textAlign: 'right' }}>
              <span>קוד הרשאה</span>
              <input
                type="password"
                autoComplete="off"
                placeholder="הזינו קוד הרשאה..."
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (err) setErr('');
                }}
                autoFocus
                required
              />
            </label>
            {err && (
              <p className="down" role="alert" style={{ margin: 0 }}>
                {err}
              </p>
            )}
            <button type="submit" className="btn btn--primary btn--lg" disabled={submitting}>
              {submitting ? 'מאמת הצפנה…' : '🔓 כניסה מאובטחת'}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
