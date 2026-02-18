/**
 * Premium Ambient Music Generator using Web Audio API
 * Rich jazz/lounge procedural audio with reverb, harmonics, and dynamics
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
  reverbMix: number;
  swingFactor: number;
  walkingBass: boolean;
  chorusDetune: number;
}

// ─── Sofisticado: Jazz piano / bossa nova / lounge elegante ───
const SOFISTICADO_CONFIG: MusicConfig = {
  bpm: 76,
  chords: [
    [261.63, 311.13, 369.99, 440.00], // Cmaj7
    [293.66, 349.23, 415.30, 493.88], // Dm7
    [329.63, 392.00, 466.16, 554.37], // Em7
    [349.23, 440.00, 523.25, 622.25], // Fmaj7
    [392.00, 466.16, 554.37, 659.25], // G7
    [261.63, 329.63, 392.00, 493.88], // Cmaj7 (repeat)
  ],
  padVolume: 0.04,
  bassVolume: 0.05,
  arpVolume: 0.018,
  padType: 'sine',
  arpType: 'sine',
  harmonic2Volume: 0.15,
  reverbMix: 0.45,
  swingFactor: 0.12,
  walkingBass: true,
  chorusDetune: 6,
};

// ─── Jovem: Lo-fi chill / pop instrumental ───
const JOVEM_CONFIG: MusicConfig = {
  bpm: 108,
  chords: [
    [261.63, 329.63, 392.00, 493.88], // Cmaj7
    [349.23, 440.00, 523.25, 659.25], // Fmaj7
    [392.00, 493.88, 587.33, 698.46], // Gmaj7
    [220.00, 261.63, 329.63, 415.30], // Am7
  ],
  padVolume: 0.035,
  bassVolume: 0.06,
  arpVolume: 0.03,
  padType: 'triangle',
  arpType: 'triangle',
  harmonic2Volume: 0.12,
  reverbMix: 0.35,
  swingFactor: 0.08,
  walkingBass: false,
  chorusDetune: 4,
};

// ─── Familiar: Bossa / MPB instrumental acolhedor ───
const FAMILIAR_CONFIG: MusicConfig = {
  bpm: 88,
  chords: [
    [261.63, 329.63, 392.00, 493.88], // Cmaj7
    [220.00, 261.63, 329.63, 392.00], // Am7
    [349.23, 440.00, 523.25, 659.25], // Fmaj7
    [392.00, 466.16, 554.37, 659.25], // G7
  ],
  padVolume: 0.04,
  bassVolume: 0.045,
  arpVolume: 0.025,
  padType: 'triangle',
  arpType: 'sine',
  harmonic2Volume: 0.2,
  reverbMix: 0.4,
  swingFactor: 0.1,
  walkingBass: true,
  chorusDetune: 5,
};

const THEME_CONFIGS: Record<Exclude<MusicTheme, 'auto'>, MusicConfig> = {
  sofisticado: SOFISTICADO_CONFIG,
  jovem: JOVEM_CONFIG,
  familiar: FAMILIAR_CONFIG,
};

// ─── Auto-detection by cuisine ───
const CUISINE_TO_THEME: Record<string, Exclude<MusicTheme, 'auto'>> = {
  'Japonesa': 'sofisticado', 'Italiana': 'sofisticado', 'Francesa': 'sofisticado',
  'Contemporânea': 'sofisticado', 'Oriental': 'sofisticado', 'Mediterrânea': 'sofisticado',
  'Espanhola': 'sofisticado', 'Grega': 'sofisticado', 'Peruana': 'sofisticado',
  'Indiana': 'sofisticado', 'Tailandesa': 'sofisticado', 'Frutos do Mar': 'sofisticado',
  'Steakhouse': 'sofisticado', 'Asiática': 'sofisticado',
  'Hamburgueria': 'jovem', 'Bar': 'jovem', 'Pizzaria': 'jovem',
  'Cervejaria': 'jovem', 'Mexicana': 'jovem', 'Havaiana': 'jovem', 'Sorveteria': 'jovem',
  'Churrascaria': 'familiar', 'Brasileira': 'familiar', 'Padaria': 'familiar',
  'Cafeteria': 'familiar', 'Doceria': 'familiar', 'Árabe': 'familiar',
  'Portuguesa': 'familiar', 'Alemã': 'familiar', 'Argentina': 'familiar',
  'Uruguaia': 'familiar', 'Latino Americana': 'familiar', 'Saudável': 'familiar',
};

export function resolveTheme(theme: MusicTheme, cuisine?: string): Exclude<MusicTheme, 'auto'> {
  if (theme !== 'auto') return theme;
  if (cuisine && CUISINE_TO_THEME[cuisine]) return CUISINE_TO_THEME[cuisine];
  return 'sofisticado';
}

const TEMPLATE_MOOD_MAP: Record<string, Exclude<MusicTheme, 'auto'>> = {
  elegante: 'sofisticado', dinamico: 'jovem', kenburns: 'sofisticado',
  moderno: 'jovem', minimalista: 'sofisticado',
};

export function getThemeForTemplate(templateId: string): Exclude<MusicTheme, 'auto'> {
  return TEMPLATE_MOOD_MAP[templateId] || 'sofisticado';
}

/**
 * Generate a synthetic reverb impulse response
 */
function createReverbImpulse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
  const length = ctx.sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

/**
 * Creates premium ambient music with reverb, ducking support, and rich harmonics
 */
export function createAmbientMusic(
  durationSeconds: number,
  theme: Exclude<MusicTheme, 'auto'> = 'sofisticado',
  narrationSegments?: Array<{ startPercent: number; endPercent: number }>
): {
  audioCtx: AudioContext;
  destination: MediaStreamAudioDestinationNode;
  start: () => void;
  stop: () => void;
} {
  const audioCtx = new AudioContext({ sampleRate: 44100 });
  const destination = audioCtx.createMediaStreamDestination();
  const config = THEME_CONFIGS[theme];
  const nodes: (OscillatorNode | AudioBufferSourceNode)[] = [];

  // ─── Audio graph: instruments → dryGain/wetGain → masterGain → compressor → destination
  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.65;

  // Compressor for smooth leveling
  const compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;

  // Reverb
  const convolver = audioCtx.createConvolver();
  convolver.buffer = createReverbImpulse(audioCtx, 2.5, 2.8);
  const dryGain = audioCtx.createGain();
  dryGain.gain.value = 1 - config.reverbMix;
  const wetGain = audioCtx.createGain();
  wetGain.gain.value = config.reverbMix;

  // Routing
  dryGain.connect(masterGain);
  convolver.connect(wetGain);
  wetGain.connect(masterGain);
  masterGain.connect(compressor);
  compressor.connect(destination);

  function connectToMix(node: AudioNode) {
    node.connect(dryGain);
    node.connect(convolver);
  }

  function start() {
    const now = audioCtx.currentTime;
    const beatDuration = 60 / config.bpm;
    const chordDuration = beatDuration * 4;

    // ─── Master fade in/out ───
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.65, now + 2.0);
    masterGain.gain.setValueAtTime(0.65, now + durationSeconds - 2.0);
    masterGain.gain.linearRampToValueAtTime(0, now + durationSeconds);

    // ─── Ducking during narration ───
    if (narrationSegments && narrationSegments.length > 0) {
      for (const seg of narrationSegments) {
        const segStart = now + seg.startPercent * durationSeconds;
        const segEnd = now + seg.endPercent * durationSeconds;
        // Smooth duck down to 30% volume
        masterGain.gain.setValueAtTime(0.65, segStart - 0.3);
        masterGain.gain.linearRampToValueAtTime(0.2, segStart);
        masterGain.gain.setValueAtTime(0.2, segEnd - 0.1);
        masterGain.gain.linearRampToValueAtTime(0.65, segEnd + 0.5);
      }
    }

    // ═══ PAD: Warm sustained chords with chorus effect ═══
    for (let t = 0; t < durationSeconds; t += chordDuration) {
      const chordIndex = Math.floor(t / chordDuration) % config.chords.length;
      const chord = config.chords[chordIndex];

      for (const freq of chord) {
        // Main voice
        const osc = audioCtx.createOscillator();
        osc.type = config.padType;
        osc.frequency.value = freq;
        osc.detune.value = (Math.random() - 0.5) * config.chorusDetune;

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0, now + t);
        gain.gain.linearRampToValueAtTime(config.padVolume, now + t + 0.8);
        gain.gain.setValueAtTime(config.padVolume, now + t + chordDuration - 0.8);
        gain.gain.linearRampToValueAtTime(0, now + t + chordDuration);

        osc.connect(gain);
        connectToMix(gain);
        osc.start(now + t);
        osc.stop(now + t + chordDuration + 0.1);
        nodes.push(osc);

        // Chorus voice (detuned copy for width)
        const osc2 = audioCtx.createOscillator();
        osc2.type = config.padType;
        osc2.frequency.value = freq;
        osc2.detune.value = config.chorusDetune + (Math.random() - 0.5) * 3;
        const gain2 = audioCtx.createGain();
        gain2.gain.setValueAtTime(0, now + t);
        gain2.gain.linearRampToValueAtTime(config.padVolume * 0.5, now + t + 1.0);
        gain2.gain.setValueAtTime(config.padVolume * 0.5, now + t + chordDuration - 1.0);
        gain2.gain.linearRampToValueAtTime(0, now + t + chordDuration);
        osc2.connect(gain2);
        connectToMix(gain2);
        osc2.start(now + t);
        osc2.stop(now + t + chordDuration + 0.1);
        nodes.push(osc2);

        // Octave harmonic for warmth
        const osc3 = audioCtx.createOscillator();
        osc3.type = 'triangle';
        osc3.frequency.value = freq * 2;
        const gain3 = audioCtx.createGain();
        gain3.gain.setValueAtTime(0, now + t);
        gain3.gain.linearRampToValueAtTime(config.padVolume * config.harmonic2Volume, now + t + 1.2);
        gain3.gain.setValueAtTime(config.padVolume * config.harmonic2Volume, now + t + chordDuration - 1.0);
        gain3.gain.linearRampToValueAtTime(0, now + t + chordDuration);
        osc3.connect(gain3);
        connectToMix(gain3);
        osc3.start(now + t);
        osc3.stop(now + t + chordDuration + 0.1);
        nodes.push(osc3);
      }
    }

    // ═══ BASS: Walking bass or sustained root ═══
    for (let t = 0; t < durationSeconds; t += config.walkingBass ? beatDuration : chordDuration) {
      const chordIndex = Math.floor(t / chordDuration) % config.chords.length;
      const rootFreq = config.chords[chordIndex][0] / 2;

      let bassFreq = rootFreq;
      if (config.walkingBass) {
        const beatInChord = Math.floor((t % chordDuration) / beatDuration);
        const chord = config.chords[chordIndex];
        // Walking bass pattern: root, 3rd, 5th, approach
        const walkNotes = [chord[0] / 2, chord[1] / 2, chord[2] / 2, chord[0] / 2 * 1.06];
        bassFreq = walkNotes[beatInChord % walkNotes.length];
      }

      const noteDuration = config.walkingBass ? beatDuration : chordDuration;
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = bassFreq;

      // Sub-octave for depth
      const sub = audioCtx.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = bassFreq / 2;

      const gain = audioCtx.createGain();
      const attackTime = config.walkingBass ? 0.05 : 0.3;
      gain.gain.setValueAtTime(0, now + t);
      gain.gain.linearRampToValueAtTime(config.bassVolume, now + t + attackTime);
      gain.gain.setValueAtTime(config.bassVolume * 0.8, now + t + noteDuration * 0.7);
      gain.gain.linearRampToValueAtTime(0, now + t + noteDuration);

      const subGain = audioCtx.createGain();
      subGain.gain.setValueAtTime(0, now + t);
      subGain.gain.linearRampToValueAtTime(config.bassVolume * 0.3, now + t + attackTime);
      subGain.gain.linearRampToValueAtTime(0, now + t + noteDuration);

      osc.connect(gain);
      sub.connect(subGain);
      connectToMix(gain);
      connectToMix(subGain);
      osc.start(now + t);
      osc.stop(now + t + noteDuration + 0.1);
      sub.start(now + t);
      sub.stop(now + t + noteDuration + 0.1);
      nodes.push(osc, sub);
    }

    // ═══ ARPEGGIOS: Gentle melodic sparkle ═══
    const arpBeat = beatDuration * (config.swingFactor > 0.08 ? 0.75 : 1);
    for (let t = 3; t < durationSeconds - 3; t += arpBeat) {
      const chordIndex = Math.floor(t / chordDuration) % config.chords.length;
      const chord = config.chords[chordIndex];
      const noteIndex = Math.floor(t / arpBeat) % chord.length;
      const freq = chord[noteIndex] * 2;

      // Swing timing
      const swing = (Math.floor(t / arpBeat) % 2 === 1) ? config.swingFactor * arpBeat : 0;
      const actualT = t + swing;
      if (actualT >= durationSeconds - 3) continue;

      const osc = audioCtx.createOscillator();
      osc.type = config.arpType;
      osc.frequency.value = freq;

      // Soft velocity variation
      const velocity = 0.7 + Math.sin(t * 2.1) * 0.3;
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0, now + actualT);
      gain.gain.linearRampToValueAtTime(config.arpVolume * velocity, now + actualT + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + actualT + arpBeat * 0.85);

      osc.connect(gain);
      connectToMix(gain);
      osc.start(now + actualT);
      osc.stop(now + actualT + arpBeat);
      nodes.push(osc);
    }

    // ═══ GHOST NOTES: Subtle percussive texture (noise bursts) ═══
    for (let t = 2; t < durationSeconds - 2; t += beatDuration * 2) {
      const noiseLength = 0.03;
      const noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * noiseLength, audioCtx.sampleRate);
      const noiseData = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = (Math.random() * 2 - 1) * 0.5;
      }
      const noiseSrc = audioCtx.createBufferSource();
      noiseSrc.buffer = noiseBuf;

      const hipass = audioCtx.createBiquadFilter();
      hipass.type = 'highpass';
      hipass.frequency.value = 6000;

      const noiseGain = audioCtx.createGain();
      noiseGain.gain.value = 0.008;

      noiseSrc.connect(hipass);
      hipass.connect(noiseGain);
      connectToMix(noiseGain);
      noiseSrc.start(now + t);
      nodes.push(noiseSrc as any);
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
