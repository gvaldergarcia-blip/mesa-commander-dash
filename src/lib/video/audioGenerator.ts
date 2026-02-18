/**
 * Ambient background music generator using Web Audio API
 * Creates pleasant, royalty-free ambient tracks procedurally
 */

export type MusicMood = 'elegant' | 'upbeat' | 'chill' | 'dramatic';

interface MusicConfig {
  bpm: number;
  chords: number[][];
  padVolume: number;
  bassVolume: number;
  arpVolume: number;
}

const MUSIC_CONFIGS: Record<MusicMood, MusicConfig> = {
  elegant: {
    bpm: 72,
    chords: [
      [261.63, 329.63, 392.00], // C major
      [293.66, 369.99, 440.00], // D major
      [349.23, 440.00, 523.25], // F major
      [392.00, 493.88, 587.33], // G major
    ],
    padVolume: 0.08,
    bassVolume: 0.06,
    arpVolume: 0.03,
  },
  upbeat: {
    bpm: 110,
    chords: [
      [261.63, 329.63, 392.00],
      [349.23, 440.00, 523.25],
      [392.00, 493.88, 587.33],
      [261.63, 329.63, 392.00],
    ],
    padVolume: 0.06,
    bassVolume: 0.08,
    arpVolume: 0.05,
  },
  chill: {
    bpm: 85,
    chords: [
      [261.63, 311.13, 392.00], // Cm
      [233.08, 293.66, 349.23], // Bb
      [220.00, 261.63, 329.63], // Am
      [246.94, 311.13, 369.99], // Bm-ish
    ],
    padVolume: 0.07,
    bassVolume: 0.05,
    arpVolume: 0.02,
  },
  dramatic: {
    bpm: 90,
    chords: [
      [220.00, 261.63, 329.63], // Am
      [196.00, 246.94, 293.66], // G
      [174.61, 220.00, 261.63], // F
      [164.81, 207.65, 261.63], // E
    ],
    padVolume: 0.09,
    bassVolume: 0.07,
    arpVolume: 0.04,
  },
};

const MOOD_MAP: Record<string, MusicMood> = {
  elegante: 'elegant',
  dinamico: 'upbeat',
  kenburns: 'dramatic',
  moderno: 'upbeat',
  minimalista: 'chill',
};

export function getMoodForTemplate(templateId: string): MusicMood {
  return MOOD_MAP[templateId] || 'elegant';
}

/**
 * Creates an AudioContext with ambient music and returns a MediaStreamDestination
 * that can be added to a MediaRecorder stream.
 */
export function createAmbientMusic(
  durationSeconds: number,
  mood: MusicMood = 'elegant'
): { audioCtx: AudioContext; destination: MediaStreamAudioDestinationNode; start: () => void; stop: () => void } {
  const audioCtx = new AudioContext({ sampleRate: 44100 });
  const destination = audioCtx.createMediaStreamDestination();
  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.7;
  masterGain.connect(destination);

  const config = MUSIC_CONFIGS[mood];
  const nodes: OscillatorNode[] = [];

  function start() {
    const now = audioCtx.currentTime;
    const beatDuration = 60 / config.bpm;
    const chordDuration = beatDuration * 4;

    // Fade in
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.7, now + 1.5);
    // Fade out
    masterGain.gain.setValueAtTime(0.7, now + durationSeconds - 2);
    masterGain.gain.linearRampToValueAtTime(0, now + durationSeconds);

    // === PAD (warm sustained chords) ===
    for (let t = 0; t < durationSeconds; t += chordDuration) {
      const chordIndex = Math.floor(t / chordDuration) % config.chords.length;
      const chord = config.chords[chordIndex];

      for (const freq of chord) {
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0, now + t);
        gain.gain.linearRampToValueAtTime(config.padVolume, now + t + 0.5);
        gain.gain.setValueAtTime(config.padVolume, now + t + chordDuration - 0.5);
        gain.gain.linearRampToValueAtTime(0, now + t + chordDuration);

        // Add warmth with slight detune
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
        gain2.gain.linearRampToValueAtTime(config.padVolume * 0.3, now + t + 0.8);
        gain2.gain.setValueAtTime(config.padVolume * 0.3, now + t + chordDuration - 0.6);
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

    // === ARPEGGIOS (subtle high notes) ===
    const arpBeat = beatDuration;
    for (let t = 2; t < durationSeconds - 2; t += arpBeat) {
      const chordIndex = Math.floor(t / chordDuration) % config.chords.length;
      const chord = config.chords[chordIndex];
      const noteIndex = Math.floor(t / arpBeat) % chord.length;
      const freq = chord[noteIndex] * 2;

      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
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
