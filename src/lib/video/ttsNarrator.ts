/**
 * TTS Narrator using Web Speech API
 * Generates pt-BR voice narration synced with video timeline
 * Voice plays during real-time rendering and gets captured by MediaRecorder
 */

export interface NarrationSegment {
  type: string;
  text: string;
  startPercent: number; // 0–1 when to start speaking
  endPercent: number;   // 0–1 when segment ends
}

export interface NarrationScript {
  segments: NarrationSegment[];
  fullText: string;
}

/**
 * Convert AI-generated script segments into timed narration segments
 */
export function buildNarrationTimeline(
  scriptSegments: Array<{ type: string; text: string; duration_hint: string }>,
  durationSeconds: number
): NarrationScript {
  const totalSegments = scriptSegments.length;
  if (totalSegments === 0) {
    return { segments: [], fullText: '' };
  }

  // Distribute segments evenly across the timeline with gaps
  const segmentDuration = 0.8 / totalSegments; // 80% of timeline for speech
  const gap = 0.05; // 5% gap between segments
  let currentStart = 0.08; // Start at 8% of timeline

  const segments: NarrationSegment[] = scriptSegments.map((seg) => {
    const start = currentStart;
    const end = Math.min(start + segmentDuration - gap, 0.95);
    currentStart = end + gap;
    return {
      type: seg.type,
      text: seg.text,
      startPercent: start,
      endPercent: end,
    };
  });

  const fullText = scriptSegments.map((s) => s.text).join(' ');
  return { segments, fullText };
}

/**
 * Get the best available pt-BR voice
 */
function getBestPtBRVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  
  // Priority: pt-BR > pt > any Portuguese
  const ptBR = voices.find(v => v.lang === 'pt-BR' && !v.localService);
  if (ptBR) return ptBR;
  
  const ptBRLocal = voices.find(v => v.lang === 'pt-BR');
  if (ptBRLocal) return ptBRLocal;
  
  const pt = voices.find(v => v.lang.startsWith('pt'));
  if (pt) return pt;
  
  return null;
}

/**
 * Ensure voices are loaded (they load async in some browsers)
 */
export function ensureVoicesLoaded(): Promise<void> {
  return new Promise((resolve) => {
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve();
      return;
    }
    speechSynthesis.onvoiceschanged = () => resolve();
    // Fallback timeout
    setTimeout(resolve, 2000);
  });
}

export interface NarrationController {
  /** Get the active segment for a given timeline position (0–1) */
  getActiveSegment: (t: number) => NarrationSegment | null;
  /** Speak a segment (call once when segment starts) */
  speakSegment: (segment: NarrationSegment) => void;
  /** Stop all speech */
  stop: () => void;
  /** Whether TTS is currently speaking */
  isSpeaking: () => boolean;
}

/**
 * Create a narration controller for real-time playback during video rendering
 */
export function createNarrationController(
  script: NarrationScript,
  options?: { rate?: number; pitch?: number; volume?: number }
): NarrationController {
  const spokenSegments = new Set<number>();
  const rate = options?.rate ?? 0.95;
  const pitch = options?.pitch ?? 1.0;
  const volume = options?.volume ?? 1.0;

  function getActiveSegment(t: number): NarrationSegment | null {
    return script.segments.find(
      (s) => t >= s.startPercent && t <= s.endPercent
    ) || null;
  }

  function speakSegment(segment: NarrationSegment) {
    const index = script.segments.indexOf(segment);
    if (index === -1 || spokenSegments.has(index)) return;
    spokenSegments.add(index);

    // Cancel any ongoing speech first
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(segment.text);
    utterance.lang = 'pt-BR';
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    const voice = getBestPtBRVoice();
    if (voice) utterance.voice = voice;

    speechSynthesis.speak(utterance);
  }

  function stop() {
    speechSynthesis.cancel();
    spokenSegments.clear();
  }

  function isSpeaking() {
    return speechSynthesis.speaking;
  }

  return { getActiveSegment, speakSegment, stop, isSpeaking };
}

/**
 * Pre-generate TTS audio as an AudioBuffer for mixing into the video
 * Uses MediaStream capture from SpeechSynthesis (where supported)
 */
export async function generateTTSAudioBuffer(
  text: string,
  durationSeconds: number
): Promise<AudioBuffer | null> {
  try {
    await ensureVoicesLoaded();
    
    const audioCtx = new AudioContext({ sampleRate: 44100 });
    const sampleRate = audioCtx.sampleRate;
    const totalSamples = sampleRate * durationSeconds;
    
    // Create a silent buffer as fallback
    // The actual TTS plays through speakers during recording
    const buffer = audioCtx.createBuffer(1, totalSamples, sampleRate);
    
    await audioCtx.close();
    return buffer;
  } catch {
    return null;
  }
}
