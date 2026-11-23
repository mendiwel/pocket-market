import { AVATARS, COSMETICS } from '../engine/catalog';

export function Avatar({
  avatarId,
  photoDataUrl,
  accessory,
  size = 64,
}: {
  avatarId: string;
  photoDataUrl?: string | null;
  accessory?: string | null;
  size?: number;
}) {
  const a = AVATARS[avatarId] ?? AVATARS.lion;
  const acc = accessory ? COSMETICS.find((c) => c.id === accessory)?.icon : null;
  return (
    <span
      className={`avatar${photoDataUrl ? ' avatar--photo' : ''}`}
      style={{ inlineSize: size, blockSize: size, background: a.color, fontSize: size * 0.55 }}
      aria-hidden="true"
    >
      {photoDataUrl ? <img src={photoDataUrl} alt="" className="avatar__img" /> : a.emoji}
      {acc && (
        <span className="avatar__acc" style={{ fontSize: size * 0.36 }}>
          {acc}
        </span>
      )}
    </span>
  );
}

/** Resize an uploaded image file to a compact square JPEG data URL (<= ~25 KB). */
export function resizeAvatarFile(file: File, maxSize = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('קריאת הקובץ נכשלה'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('התמונה אינה תקינה'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('שגיאת עיבוד תמונה'));
          return;
        }
        // Center-crop to square
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
