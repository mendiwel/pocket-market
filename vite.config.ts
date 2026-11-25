import crypto from 'node:crypto';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

function sanitizeKey(raw: string | undefined): string {
  if (!raw) return '';
  return raw.replace(/["',;\s]/g, '').trim();
}

function computeAccessCodeHash(code: string): string {
  const normalized = code.trim();
  if (!normalized) return '';
  return crypto.createHash('sha256').update(`pocket-market-access-v1:${normalized}`, 'utf8').digest('hex');
}

function encryptGeminiKeyVault(apiKey: string, accessCode: string): string {
  const cleanKey = sanitizeKey(apiKey);
  const cleanCode = accessCode.trim();
  if (!cleanKey || !cleanCode) return '';

  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const derivedKey = crypto.pbkdf2Sync(cleanCode, salt, 100_000, 32, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(cleanKey, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const cipherWithTag = Buffer.concat([encrypted, authTag]);

  return `${salt.toString('hex')}:${iv.toString('hex')}:${cipherWithTag.toString('hex')}`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const siteAccessCode = (env.SITE_ACCESS_CODE || env.VITE_SITE_ACCESS_CODE || '7704').trim();
  const rawGeminiKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '';

  const accessCodeHash = computeAccessCodeHash(siteAccessCode);
  const encryptedVault = encryptGeminiKeyVault(rawGeminiKey, siteAccessCode);

  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
      __ACCESS_CODE_HASH__: JSON.stringify(accessCodeHash),
      __ENCRYPTED_GEMINI_VAULT__: JSON.stringify(encryptedVault),
      // Prevent Vite from embedding the plaintext Gemini key into the client bundle
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(''),
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  };
});

