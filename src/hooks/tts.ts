import { useEffect, useRef, useState } from 'react';

// Robust Hebrew Text-to-Speech (TTS) with Web Speech API + online Hebrew audio fallback.
// Fixes:
// 1. Chrome/Edge on Windows pause/stall bugs & cancel() race condition before speak().
// 2. Missing local Hebrew voices on Windows/desktop by falling back to a Hebrew TTS audio stream.
// 3. Observable active state so <Speak /> buttons animate and allow click-to-stop.

export const ttsSupported = typeof window !== 'undefined';

let cachedVoice: SpeechSynthesisVoice | null | undefined;
let currentText: string | null = null;
let currentAudio: HTMLAudioElement | null = null;
let speakTimer: ReturnType<typeof setTimeout> | null = null;
let resumeInterval: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const fn of listeners) fn();
}

export function subscribeTts(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getSpeakingText(): string | null {
  return currentText;
}

export function useSpeakingText(): string | null {
  const [active, setActive] = useState<string | null>(currentText);
  useEffect(() => subscribeTts(() => setActive(currentText)), []);
  return active;
}

function hebrewVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  if (cachedVoice !== undefined) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  cachedVoice =
    voices.find((v) => v.lang.toLowerCase() === 'he-il') ??
    voices.find((v) => v.lang.toLowerCase().startsWith('he') || v.lang.toLowerCase().startsWith('iw')) ??
    voices.find((v) => /hebrew|עברית|hila|avri|carmit/i.test(v.name)) ??
    null;
  return cachedVoice;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    cachedVoice = undefined;
  });
}

function normalizeHebrewText(text: string): string {
  return text
    .replace(/₪/g, ' שקלים ')
    .replace(/\+/g, ' פלוס ')
    .replace(/%/g, ' אחוז ')
    .replace(/[▲▼⭐🔥💵💰📬☀️🛒✅🧘🌳🍋📈📉➖]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitChunks(text: string, maxLen = 175): string[] {
  const sentences = text.split(/(?<=[.!?।])\s+/);
  const chunks: string[] = [];
  let buf = '';
  for (const s of sentences) {
    if ((buf + ' ' + s).trim().length <= maxLen) {
      buf = (buf + ' ' + s).trim();
    } else {
      if (buf) chunks.push(buf);
      if (s.length <= maxLen) {
        buf = s;
      } else {
        const words = s.split(' ');
        buf = '';
        for (const w of words) {
          if ((buf + ' ' + w).trim().length <= maxLen) {
            buf = (buf + ' ' + w).trim();
          } else {
            if (buf) chunks.push(buf);
            buf = w;
          }
        }
      }
    }
  }
  if (buf) chunks.push(buf);
  return chunks.length ? chunks : [text.slice(0, maxLen)];
}

function clearTimers() {
  if (speakTimer) {
    clearTimeout(speakTimer);
    speakTimer = null;
  }
  if (resumeInterval) {
    clearInterval(resumeInterval);
    resumeInterval = null;
  }
}

export function stopSpeaking(): void {
  clearTimers();
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.src = '';
    } catch {
      // ignore
    }
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
  if (currentText !== null) {
    currentText = null;
    notifyListeners();
  }
}

function playOnlineHebrewFallback(cleanText: string, originalKey: string): void {
  const chunks = splitChunks(cleanText, 175);
  let idx = 0;

  const playNext = () => {
    if (currentText !== originalKey || idx >= chunks.length) {
      if (currentText === originalKey) {
        currentText = null;
        notifyListeners();
      }
      return;
    }
    const chunk = chunks[idx++];
    const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=iw&q=${encodeURIComponent(chunk)}`;
    const audio = new Audio(url);
    currentAudio = audio;
    audio.playbackRate = 0.96;
    audio.onended = () => playNext();
    audio.onerror = () => {
      // If online stream is blocked (e.g. offline), attempt unvoiced native utterance as last resort
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(chunk);
        u.lang = 'he-IL';
        u.rate = 0.92;
        u.onend = () => playNext();
        u.onerror = () => {
          currentText = null;
          notifyListeners();
        };
        window.speechSynthesis.speak(u);
      } else {
        currentText = null;
        notifyListeners();
      }
    };
    audio.play().catch(() => {
      audio.onerror?.(new Event('error'));
    });
  };

  playNext();
}

export function speak(text: string, opts: { rate?: number } = {}): void {
  if (!ttsSupported) return;
  const raw = text.trim();
  if (!raw) return;

  // Toggle behavior: clicking the same active speaker button stops playback
  if (currentText === raw) {
    stopSpeaking();
    return;
  }

  stopSpeaking();
  const clean = normalizeHebrewText(raw);
  if (!clean) return;

  currentText = raw;
  notifyListeners();

  const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;
  // Trigger getVoices() early in case browser loads them lazily
  if (hasSpeech) window.speechSynthesis.getVoices();

  // Wait 60ms after cancel() so Chromium doesn't drop the new utterance
  speakTimer = setTimeout(() => {
    if (currentText !== raw) return;
    const v = hebrewVoice();

    if (hasSpeech && v) {
      const synth = window.speechSynthesis;
      try {
        synth.resume();
      } catch {
        // ignore
      }
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = v.lang || 'he-IL';
      u.voice = v;
      u.rate = opts.rate ?? 0.92;

      // Chrome bug workaround: long utterances get paused after ~14s unless resume() is poked
      resumeInterval = setInterval(() => {
        if (!synth.speaking) {
          clearTimers();
        } else if (synth.paused) {
          synth.resume();
        }
      }, 3000);

      u.onend = () => {
        clearTimers();
        if (currentText === raw) {
          currentText = null;
          notifyListeners();
        }
      };
      u.onerror = () => {
        clearTimers();
        if (currentText === raw) {
          playOnlineHebrewFallback(clean, raw);
        }
      };

      synth.speak(u);
    } else {
      // No native Hebrew voice installed on this OS/browser -> use online Hebrew TTS fallback
      playOnlineHebrewFallback(clean, raw);
    }
  }, 60);
}

/** Tier 1: read a screen aloud automatically whenever `text` changes. */
export function useAutoSpeak(text: string, enabled: boolean): void {
  const last = useRef('');
  useEffect(() => {
    if (!enabled || !text.trim() || text === last.current) return;
    last.current = text;
    const t = setTimeout(() => speak(text), 350);
    return () => clearTimeout(t);
  }, [text, enabled]);
  useEffect(() => () => stopSpeaking(), []);
}
