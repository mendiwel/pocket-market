import crypto from 'node:crypto';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const PBKDF2_ITERATIONS = 310_000;

function sanitizeKey(raw: string | undefined): string {
  if (!raw) return '';
  return raw.replace(/["',;\s]/g, '').trim();
}

function computeSaltedAccessVerifier(code: string): string {
  const normalized = code.trim();
  if (!normalized) return '';
  const salt = crypto.randomBytes(16);
  const derived = crypto.pbkdf2Sync(normalized, salt, PBKDF2_ITERATIONS, 32, 'sha256');
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

function encryptGeminiKeyVault(apiKey: string, accessCode: string): string {
  const cleanKey = sanitizeKey(apiKey);
  const cleanCode = accessCode.trim();
  if (!cleanKey || !cleanCode) return '';

  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const derivedKey = crypto.pbkdf2Sync(cleanCode, salt, PBKDF2_ITERATIONS, 32, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(cleanKey, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const cipherWithTag = Buffer.concat([encrypted, authTag]);

  return `${salt.toString('hex')}:${iv.toString('hex')}:${cipherWithTag.toString('hex')}`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const siteAccessCode = (env.SITE_ACCESS_CODE || env.VITE_SITE_ACCESS_CODE || 'PM-7704-K9X2').trim();
  const rawGeminiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '';

  const accessCodeVerifier = computeSaltedAccessVerifier(siteAccessCode);
  const encryptedVault = encryptGeminiKeyVault(rawGeminiKey, siteAccessCode);

  return {
    plugins: [react()],
    build: {
      sourcemap: false,
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
      __ACCESS_CODE_VERIFIER__: JSON.stringify(accessCodeVerifier),
      __ENCRYPTED_GEMINI_VAULT__: JSON.stringify(encryptedVault),
      // Never embed the plaintext Gemini key into the client bundle
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(''),
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});


