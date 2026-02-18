/**
 * Ambient background music generator using Web Audio API
 * Creates pleasant, royalty-free ambient tracks procedurally
 * 3 themes: Sofisticado, Jovem, Familiar + auto-detection by cuisine
 */

export type MusicTheme = 'sofisticado' | 'jovem' | 'familiar' | 'auto';

interface MusicConfig {
  bpm: number;
  chords: number[][];
  padVolume: number;
  bassVolume: number;
  arpVolume: number;
  padType: OscillatorType;
  arpType: OscillatorType;
  harmonic2Volume: number;
}

// ─── Sofisticado: Piano minimalista / jazz leve / lounge instrumental ───
// BPM 70–95, atmosfera elegante e discreta
const SOFISTICADO_CONFIG: MusicConfig = {
  bpm: 78,
  chords: [
    [261.63, 329.63, 392.00], // Cmaj
    [293.66, 369.99, 440.00], // Dmaj
    [349.23, 440.00, 523.25], // Fmaj
    [392.00, 493.88, 587.33], // Gmaj
  ],
  padVolume: 0.06,
  bassVolume: 0.04,
  arpVolume: 0.025,
  padType: 'sine',
  arpType: 'sine',
  harmonic2Volume: 0.25,
};

// ─── Jovem: Pop instrumental moderno / lo-fi upbeat ───
// BPM 100–120, energia leve e animada
const JOVEM_CONFIG: MusicConfig = {
  bpm: 112,
  chords: [
    [261.63, 329.63, 392.00], // C
    [349.23, 440.00, 523.25], // F
    [392.00, 493.88, 587.33], // G
    [220.00, 277.18, 329.63], // Am
  ],
  padVolume: 0.05,
  bassVolume: 0.07,
  arpVolume: 0.045,
  padType: 'triangle',
  arpType: 'square',
  harmonic2Volume: 0.2,
};

// ─── Familiar: Violão acústico / MPB instrumental leve ───
// BPM 80–105, atmosfera acolhedora e tradicional
const FAMILIAR_CONFIG: MusicConfig = {
  bpm: 92,
  chords: [
    [261.63, 329.63, 392.00], // C
    [220.00, 277.18, 329.63], // Am
    [349.23, 440.00, 523.25], // F
    [392.00, 493.88, 587.33], // G
  ],
  padVolume: 0.06,
  bassVolume: 0.05,
  arpVolume: 0.035,
  padType: 'triangle',
  arpType: 'sine',
  harmonic2Volume: 0.3,
};

const THEME_CONFIGS: Record<Exclude<MusicTheme, 'auto'>, MusicConfig> = {
  sofisticado: SOFISTICADO_CONFIG,
  jovem: JOVEM_CONFIG,
  familiar: FAMILIAR_CONFIG,
};

// ─── Auto-detection by cuisine ───
const CUISINE_TO_THEME: Record<string, Exclude<MusicTheme, 'auto'>> = {
  // Sofisticado
  'Japonesa': 'sofisticado',
  'Italiana': 'sofisticado',
  'Francesa': 'sofisticado',
  'Contemporânea': 'sofisticado',
  'Oriental': 'sofisticado',
  'Mediterrânea': 'sofisticado',
  'Espanhola': 'sofisticado',
  'Grega': 'sofisticado',
  'Peruana': 'sofisticado',
  'Indiana': 'sofisticado',
  'Tailandesa': 'sofisticado',
  'Frutos do Mar': 'sofisticado',
  'Steakhouse': 'sofisticado',
  'Asiática': 'sofisticado',
  // Jovem
  'Hamburgueria': 'jovem',
  'Bar': 'jovem',
  'Pizzaria': 'jovem',
  'Cervejaria': 'jovem',
  'Mexicana': 'jovem',
  'Havaiana': 'jovem',
  'Sorveteria': 'jovem',
  // Familiar
  'Churrascaria': 'familiar',
  'Brasileira': 'familiar',
  'Padaria': 'familiar',
  'Cafeteria': 'familiar',
  'Doceria': 'familiar',
  'Árabe': 'familiar',
  'Portuguesa': 'familiar',
  'Alemã': 'familiar',
  'Argentina': 'familiar',
  'Uruguaia': 'familiar',
  'Latino Americana': 'familiar',
  'Saudável': 'familiar',
};

export function resolveTheme(theme: MusicTheme, cuisine?: string): Exclude<MusicTheme, 'auto'> {
  if (theme !== 'auto') return theme;
  if (cuisine && CUISINE_TO_THEME[cuisine]) return CUISINE_TO_THEME[cuisine];
  return 'sofisticado'; // fallback
}

// Legacy mapping for template-based mood (still used by videoRenderer)
const TEMPLATE_MOOD_MAP: Record<string, Exclude<MusicTheme, 'auto'>> = {
  elegante: 'sofisticado',
  dinamico: 'jovem',
  kenburns: 'sofisticado',
  moderno: 'jovem',
  minimalista: 'sofisticado',
};

export function getThemeForTemplate(templateId: string): Exclude<MusicTheme, 'auto'> {
  return TEMPLATE_MOOD_MAP[templateId] || 'sofisticado';
}

/**
 * Creates an AudioContext with ambient music and returns a MediaStreamDestination
 * that can be added to a MediaRecorder stream.
 */
export function createAmbientMusic(
  durationSeconds: number,
  theme: Exclude<MusicTheme, 'auto'> = 'sofisticado'
): { audioCtx: AudioContext; destination: MediaStreamAudioDestinationNode; start: () => void; stop: () => void } {
  const audioCtx = new AudioContext({ sampleRate: 44100 });
  const destination = audioCtx.createMediaStreamDestination();
  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.7;
  masterGain.connect(destination);

  const config = THEME_CONFIGS[theme];
  const nodes: OscillatorNode[] = [];

  function start() {
    const now = audioCtx.currentTime;
    const beatDuration = 60 / config.bpm;
    const chordDuration = beatDuration * 4;

    // Fade in / fade out (1.5s each)
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.7, now + 1.5);
    masterGain.gain.setValueAtTime(0.7, now + durationSeconds - 1.5);
    masterGain.gain.linearRampToValueAtTime(0, now + durationSeconds);

    // === PAD (warm sustained chords) ===
    for (let t = 0; t < durationSeconds; t += chordDuration) {
      const chordIndex = Math.floor(t / chordDuration) % config.chords.length;
      const chord = config.chords[chordIndex];

      for (const freq of chord) {
        const osc = audioCtx.createOscillator();
        osc.type = config.padType;
        osc.frequency.value = freq;

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0, now + t);
        gain.gain.linearRampToValueAtTime(config.padVolume, now + t + 0.5);
        gain.gain.setValueAtTime(config.padVolume, now + t + chordDuration - 0.5);
        gain.gain.linearRampToValueAtTime(0, now + t + chordDuration);

        // Warmth with slight detune
        osc.detune.value = (Math.random() - 0.5) * 8;

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + t);
        osc.stop(now + t + chordDuration + 0.1);
        nodes.push(osc);

        // Second harmonic for richness
        const osc2 = audioCtx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.value = freq * 2;
        const gain2 = audioCtx.createGain();
        gain2.gain.setValueAtTime(0, now + t);
        gain2.gain.linearRampToValueAtTime(config.padVolume * config.harmonic2Volume, now + t + 0.8);
        gain2.gain.setValueAtTime(config.padVolume * config.harmonic2Volume, now + t + chordDuration - 0.6);
        gain2.gain.linearRampToValueAtTime(0, now + t + chordDuration);
        osc2.connect(gain2);
        gain2.connect(masterGain);
        osc2.start(now + t);
        osc2.stop(now + t + chordDuration + 0.1);
        nodes.push(osc2);
      }
    }

    // === BASS ===
    for (let t = 0; t < durationSeconds; t += chordDuration) {
      const chordIndex = Math.floor(t / chordDuration) % config.chords.length;
      const bassFreq = config.chords[chordIndex][0] / 2;

      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = bassFreq;

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0, now + t);
      gain.gain.linearRampToValueAtTime(config.bassVolume, now + t + 0.2);
      gain.gain.setValueAtTime(config.bassVolume, now + t + chordDuration - 0.3);
      gain.gain.linearRampToValueAtTime(0, now + t + chordDuration);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now + t);
      osc.stop(now + t + chordDuration + 0.1);
      nodes.push(osc);
    }

    // === ARPEGGIOS ===
    const arpBeat = beatDuration;
    for (let t = 2; t < durationSeconds - 2; t += arpBeat) {
      const chordIndex = Math.floor(t / chordDuration) % config.chords.length;
      const chord = config.chords[chordIndex];
      const noteIndex = Math.floor(t / arpBeat) % chord.length;
      const freq = chord[noteIndex] * 2;

      const osc = audioCtx.createOscillator();
      osc.type = config.arpType;
      osc.frequency.value = freq;

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0, now + t);
      gain.gain.linearRampToValueAtTime(config.arpVolume, now + t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + arpBeat * 0.8);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now + t);
      osc.stop(now + t + arpBeat);
      nodes.push(osc);
    }
  }

  function stop() {
    nodes.forEach((n) => {
      try { n.stop(); } catch { /* already stopped */ }
    });
    audioCtx.close().catch(() => {});
  }

  return { audioCtx, destination, start, stop };
}
