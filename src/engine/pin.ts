/** SHA-256 of "familyId:pin" as hex. Kid-proofing, not bank-grade security. */
export async function hashPin(familyId: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(`${familyId}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPin(familyId: string, pin: string, hash: string): Promise<boolean> {
  return (await hashPin(familyId, pin)) === hash;
}

export const DEFAULT_PIN = '1234';
