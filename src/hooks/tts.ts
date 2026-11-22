import { useEffect, useRef } from 'react';

// Native Web Speech API with Hebrew voice selection and graceful fallback.

export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

let cachedVoice: SpeechSynthesisVoice | null | undefined;

function hebrewVoice(): SpeechSynthesisVoice | null {
  if (!ttsSupported) return null;
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  cachedVoice = voices.find((v) => v.lang === 'he-IL') ?? voices.find((v) => v.lang.startsWith('he')) ?? null;
  return cachedVoice;
}

if (ttsSupported) {
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    cachedVoice = undefined;
  });
}

export function speak(text: string, opts: { rate?: number } = {}): void {
  if (!ttsSupported || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/₪/g, ' שקלים '));
  u.lang = 'he-IL';
  u.rate = opts.rate ?? 0.92;
  const v = hebrewVoice();
  if (v) u.voice = v;
  synth.speak(u);
}

export function stopSpeaking(): void {
  if (ttsSupported) window.speechSynthesis.cancel();
}

/** Tier 1: read a screen aloud automatically whenever `text` changes. */
export function useAutoSpeak(text: string, enabled: boolean): void {
  const last = useRef('');
  useEffect(() => {
    if (!enabled || text === last.current) return;
    last.current = text;
    const t = setTimeout(() => speak(text), 350);
    return () => clearTimeout(t);
  }, [text, enabled]);
  useEffect(() => () => stopSpeaking(), []);
}
