import { speak, ttsSupported } from '../hooks/tts';

export function Speak({ text, label = 'הקראה' }: { text: string; label?: string }) {
  if (!ttsSupported) return null;
  return (
    <button type="button" className="speak-btn" onClick={() => speak(text)} aria-label={label} title={label}>
      🔊
    </button>
  );
}
