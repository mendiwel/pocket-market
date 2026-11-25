import { useState, type FormEvent, type ReactNode } from 'react';

// Site-wide authorization gate + AES-256-GCM key vault:
// 1. Blocks access to the entire application until the user enters the authorization code.
// 2. The Gemini API key is NEVER stored in plaintext in the production JavaScript bundle;
//    it is AES-256-GCM encrypted at build time with PBKDF2-SHA256 derived from the access code,
//    and can only be decrypted in memory after the valid authorization code is entered.

declare const __ENCRYPTED_GEMINI_VAULT__: string;
declare const __ACCESS_CODE_HASH__: string;

const ACCESS_STORAGE_KEY = 'pocket-market.site.accessCode.v1';

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

export function normalizeAccessCode(input: string): string {
  return input.trim();
}

export async function hashAccessCode(code: string): Promise<string> {
  const normalized = normalizeAccessCode(code);
  const data = new TextEncoder().encode(`pocket-market-access-v1:${normalized}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
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
        iterations: 100_000,
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

export async function verifyAndUnlockAccessCode(code: string): Promise<boolean> {
  const normalized = normalizeAccessCode(code);
  if (!normalized) return false;

  // 1. Verify against build-time SHA-256 access code hash
  const expectedHash = typeof __ACCESS_CODE_HASH__ !== 'undefined' ? __ACCESS_CODE_HASH__ : '';
  if (expectedHash) {
    const actualHash = await hashAccessCode(normalized);
    if (actualHash !== expectedHash) {
      return false;
    }
  }

  // 2. Decrypt the Gemini API key vault if present
  const decryptedKey = await decryptGeminiVault(normalized);
  if (decryptedKey) {
    unlockedRuntimeGeminiKey = decryptedKey;
  } else if (!expectedHash) {
    return false;
  }

  try {
    window.localStorage.setItem(ACCESS_STORAGE_KEY, normalized);
  } catch {
    // ignore storage errors
  }
  return true;
}

export function lockSiteAccess(): void {
  unlockedRuntimeGeminiKey = '';
  try {
    window.localStorage.removeItem(ACCESS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getSavedAccessCode(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(ACCESS_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function AccessGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'locked' | 'unlocked'>('checking');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Check on mount if a previously saved access code or URL ?code= param unlocks the site
  useState(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlCode = params.get('code') ?? params.get('access');
        if (urlCode && (await verifyAndUnlockAccessCode(urlCode))) {
          // Strip the code query parameter from the address bar so it isn't left exposed
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
    setSubmitting(true);
    setErr('');
    const ok = await verifyAndUnlockAccessCode(code);
    setSubmitting(false);
    if (ok) {
      setCode('');
      setStatus('unlocked');
    } else {
      setErr('קוד ההרשאה שגוי. הגישה לאתר מוגבלת למשתמשים מורשים בלבד.');
    }
  }

  if (status === 'checking') {
    return (
      <div className="page" style={{ display: 'grid', placeItems: 'center', minHeight: '75vh' }}>
        <p className="loading">בודק הרשאת גישה… 🔒</p>
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
                autoComplete="current-password"
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
              {submitting ? 'מאמת קוד…' : '🔓 כניסה לאתר'}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
