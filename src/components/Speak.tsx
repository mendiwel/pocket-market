import { speak, useSpeakingText } from '../hooks/tts';

export function Speak({
  text,
  label = 'הקראה קולית',
  showText = false,
}: {
  text: string;
  label?: string;
  showText?: boolean;
}) {
  const activeText = useSpeakingText();
  const isSpeaking = activeText !== null && activeText === text.trim();

  return (
    <button
      type="button"
      className={`speak-btn${isSpeaking ? ' speak-btn--active' : ''}${showText ? ' speak-btn--pill' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
      aria-label={isSpeaking ? 'עצור הקראה' : label}
      aria-pressed={isSpeaking}
      title={isSpeaking ? 'עצור הקראה' : label}
    >
      <span className="speak-btn__icon" aria-hidden="true">
        {isSpeaking ? '⏹️' : '🔊'}
      </span>
      {showText && <span className="speak-btn__label">{isSpeaking ? 'עצור' : label}</span>}
    </button>
  );
}
