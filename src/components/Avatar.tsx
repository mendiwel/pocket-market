import { AVATARS, COSMETICS } from '../engine/catalog';

export function Avatar({ avatarId, accessory, size = 64 }: { avatarId: string; accessory?: string | null; size?: number }) {
  const a = AVATARS[avatarId] ?? AVATARS.lion;
  const acc = accessory ? COSMETICS.find((c) => c.id === accessory)?.icon : null;
  return (
    <span className="avatar" style={{ inlineSize: size, blockSize: size, background: a.color, fontSize: size * 0.55 }} aria-hidden="true">
      {a.emoji}
      {acc && <span className="avatar__acc" style={{ fontSize: size * 0.36 }}>{acc}</span>}
    </span>
  );
}
