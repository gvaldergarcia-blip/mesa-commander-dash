/**
 * Premium Ambient Music Generator using Web Audio API
 * Three TRULY DISTINCT musical themes + custom MP3 support
 * Each theme has unique chord voicings, rhythms, tempos, and timbres
 */

export type MusicTheme = 'sofisticado' | 'jovem' | 'familiar' | 'auto';

// ─── Cuisine → Theme mapping ───
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

// ─── Reverb impulse ───
function createReverbImpulse(ctx: AudioContext, dur: number, decay: number): AudioBuffer {
  const len = ctx.sampleRate * dur;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

// ═══════════════════════════════════════════════════════════
// SOFISTICADO — Real Jazz: swing, walking bass, Rhodes piano
// Tempo: 68 BPM, ii-V-I progressions, heavy reverb
// ═══════════════════════════════════════════════════════════
function renderSofisticado(
  audioCtx: AudioContext,
  destination: MediaStreamAudioDestinationNode,
  durationSeconds: number,
  narrationSegments?: Array<{ startPercent: number; endPercent: number }>
) {
  const nodes: (OscillatorNode | AudioBufferSourceNode)[] = [];
  const BPM = 68;
  const beat = 60 / BPM;
  const bar = beat * 4;

  // Jazz ii-V-I-VI progression (Dm9 → G13 → Cmaj9 → Am7)
  const chords = [
    [146.83, 174.61, 220.00, 277.18, 329.63], // Dm9
    [196.00, 246.94, 293.66, 349.23, 440.00], // G13
    [130.81, 164.81, 196.00, 246.94, 293.66], // Cmaj9
    [110.00, 130.81, 164.81, 207.65, 261.63], // Am7
  ];

  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.55;
  const compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.2;

  const convolver = audioCtx.createConvolver();
  convolver.buffer = createReverbImpulse(audioCtx, 3.0, 2.5);
  const dryG = audioCtx.createGain(); dryG.gain.value = 0.5;
  const wetG = audioCtx.createGain(); wetG.gain.value = 0.5;
  dryG.connect(masterGain);
  convolver.connect(wetG);
  wetG.connect(masterGain);
  masterGain.connect(compressor);
  compressor.connect(destination);

  const mix = (n: AudioNode) => { n.connect(dryG); n.connect(convolver); };
  const now = audioCtx.currentTime;

  // Master fade
  masterGain.gain.setValueAtTime(0, now);
  masterGain.gain.linearRampToValueAtTime(0.55, now + 2.5);
  masterGain.gain.setValueAtTime(0.55, now + durationSeconds - 2.5);
  masterGain.gain.linearRampToValueAtTime(0, now + durationSeconds);

  // Ducking
  if (narrationSegments) {
    for (const seg of narrationSegments) {
      const s = now + seg.startPercent * durationSeconds;
      const e = now + seg.endPercent * durationSeconds;
      masterGain.gain.setValueAtTime(0.55, s - 0.4);
      masterGain.gain.linearRampToValueAtTime(0.15, s);
      masterGain.gain.setValueAtTime(0.15, e - 0.1);
      masterGain.gain.linearRampToValueAtTime(0.55, e + 0.6);
    }
  }

  // ─── Rhodes-style pad (warm sine + slight detuned layer) ───
  for (let t = 0; t < durationSeconds; t += bar) {
    const ci = Math.floor(t / bar) % chords.length;
    const chord = chords[ci];
    for (const freq of chord) {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() - 0.5) * 8;
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0, now + t);
      g.gain.linearRampToValueAtTime(0.025, now + t + 0.6);
      g.gain.setValueAtTime(0.025, now + t + bar - 0.6);
      g.gain.linearRampToValueAtTime(0, now + t + bar);
      osc.connect(g); mix(g);
      osc.start(now + t); osc.stop(now + t + bar + 0.1);
      nodes.push(osc);

      // Detuned chorus for warmth
      const osc2 = audioCtx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = freq;
      osc2.detune.value = 8 + Math.random() * 4;
      const g2 = audioCtx.createGain();
      g2.gain.setValueAtTime(0, now + t);
      g2.gain.linearRampToValueAtTime(0.012, now + t + 0.8);
      g2.gain.linearRampToValueAtTime(0, now + t + bar);
      osc2.connect(g2); mix(g2);
      osc2.start(now + t); osc2.stop(now + t + bar + 0.1);
      nodes.push(osc2);
    }
  }

  // ─── Walking bass (swing feel) ───
  for (let t = 0; t < durationSeconds; t += beat) {
    const ci = Math.floor(t / bar) % chords.length;
    const chord = chords[ci];
    const beatInBar = Math.floor((t % bar) / beat);
    // Walking: root → 3rd → 5th → chromatic approach
    const walk = [chord[0] / 2, chord[1] / 2, chord[2] / 2, chord[0] / 2 * 1.059];
    const freq = walk[beatInBar % walk.length];

    // Swing: push off-beats slightly late
    const swing = beatInBar % 2 === 1 ? beat * 0.14 : 0;
    const tt = t + swing;
    if (tt >= durationSeconds) continue;

    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = audioCtx.createGain();
    const vel = 0.06 + Math.sin(t * 1.7) * 0.015;
    g.gain.setValueAtTime(0, now + tt);
    g.gain.linearRampToValueAtTime(vel, now + tt + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + tt + beat * 0.85);
    osc.connect(g); mix(g);
    osc.start(now + tt); osc.stop(now + tt + beat);
    nodes.push(osc);
  }

  // ─── Gentle ride cymbal (filtered noise) ───
  for (let t = 1.5; t < durationSeconds - 1.5; t += beat) {
    const swing = Math.floor(t / beat) % 2 === 1 ? beat * 0.12 : 0;
    const tt = t + swing;
    if (tt >= durationSeconds - 1) continue;

    const nLen = 0.06;
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * nLen, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 8000;
    const g = audioCtx.createGain();
    g.gain.value = 0.006;
    src.connect(hp); hp.connect(g); mix(g);
    src.start(now + tt);
    nodes.push(src as any);
  }

  return nodes;
}

// ═══════════════════════════════════════════════════════════
// JOVEM — Lo-fi Chill Beats: slow, dreamy pads, vinyl crackle
// Tempo: 85 BPM, simple minor7 loop, triangle+sine layers
// ═══════════════════════════════════════════════════════════
function renderJovem(
  audioCtx: AudioContext,
  destination: MediaStreamAudioDestinationNode,
  durationSeconds: number,
  narrationSegments?: Array<{ startPercent: number; endPercent: number }>
) {
  const nodes: (OscillatorNode | AudioBufferSourceNode)[] = [];
  const BPM = 85;
  const beat = 60 / BPM;
  const bar = beat * 4;

  // Chill lo-fi chords (Fm7 → Ab → Eb → Bb)
  const chords = [
    [174.61, 220.00, 261.63, 329.63], // Fm7
    [207.65, 261.63, 311.13, 415.30], // Abmaj7
    [155.56, 196.00, 233.08, 311.13], // Ebmaj7
    [116.54, 146.83, 174.61, 233.08], // Bbm7
  ];

  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.5;
  const compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -22;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.3;

  const convolver = audioCtx.createConvolver();
  convolver.buffer = createReverbImpulse(audioCtx, 2.0, 3.5);
  const dryG = audioCtx.createGain(); dryG.gain.value = 0.65;
  const wetG = audioCtx.createGain(); wetG.gain.value = 0.35;
  dryG.connect(masterGain);
  convolver.connect(wetG);
  wetG.connect(masterGain);
  masterGain.connect(compressor);
  compressor.connect(destination);

  const mix = (n: AudioNode) => { n.connect(dryG); n.connect(convolver); };
  const now = audioCtx.currentTime;

  masterGain.gain.setValueAtTime(0, now);
  masterGain.gain.linearRampToValueAtTime(0.5, now + 2.0);
  masterGain.gain.setValueAtTime(0.5, now + durationSeconds - 2.0);
  masterGain.gain.linearRampToValueAtTime(0, now + durationSeconds);

  if (narrationSegments) {
    for (const seg of narrationSegments) {
      const s = now + seg.startPercent * durationSeconds;
      const e = now + seg.endPercent * durationSeconds;
      masterGain.gain.setValueAtTime(0.5, s - 0.4);
      masterGain.gain.linearRampToValueAtTime(0.12, s);
      masterGain.gain.setValueAtTime(0.12, e - 0.1);
      masterGain.gain.linearRampToValueAtTime(0.5, e + 0.6);
    }
  }

  // ─── Dreamy triangle pads (slow attack, long sustain) ───
  for (let t = 0; t < durationSeconds; t += bar) {
    const ci = Math.floor(t / bar) % chords.length;
    const chord = chords[ci];
    for (const freq of chord) {
      const osc = audioCtx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() - 0.5) * 5;
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0, now + t);
      g.gain.linearRampToValueAtTime(0.03, now + t + 1.5); // Slow attack
      g.gain.setValueAtTime(0.03, now + t + bar - 1.2);
      g.gain.linearRampToValueAtTime(0, now + t + bar);
      osc.connect(g); mix(g);
      osc.start(now + t); osc.stop(now + t + bar + 0.1);
      nodes.push(osc);
    }
  }

  // ─── Sub bass (deep sine, very slow) ───
  for (let t = 0; t < durationSeconds; t += bar) {
    const ci = Math.floor(t / bar) % chords.length;
    const root = chords[ci][0] / 2;
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = root;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, now + t);
    g.gain.linearRampToValueAtTime(0.06, now + t + 0.5);
    g.gain.setValueAtTime(0.05, now + t + bar * 0.8);
    g.gain.linearRampToValueAtTime(0, now + t + bar);
    osc.connect(g); mix(g);
    osc.start(now + t); osc.stop(now + t + bar + 0.1);
    nodes.push(osc);
  }

  // ─── Lo-fi crackle texture (vinyl noise) ───
  for (let t = 0; t < durationSeconds; t += 0.15) {
    if (Math.random() > 0.35) continue;
    const nLen = 0.015 + Math.random() * 0.02;
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * nLen, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 4000;
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 9000;
    const g = audioCtx.createGain();
    g.gain.value = 0.004;
    src.connect(hp); hp.connect(lp); lp.connect(g); mix(g);
    src.start(now + t);
    nodes.push(src as any);
  }

  // ─── Gentle melodic plucks (sparse, sine, high register) ───
  for (let t = 3; t < durationSeconds - 3; t += beat * 2) {
    if (Math.random() > 0.6) continue;
    const ci = Math.floor(t / bar) % chords.length;
    const chord = chords[ci];
    const freq = chord[Math.floor(Math.random() * chord.length)] * 2;
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, now + t);
    g.gain.linearRampToValueAtTime(0.018, now + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t + beat * 1.5);
    osc.connect(g); mix(g);
    osc.start(now + t); osc.stop(now + t + beat * 2);
    nodes.push(osc);
  }

  return nodes;
}

// ═══════════════════════════════════════════════════════════
// FAMILIAR — Bossa Nova: characteristic rhythm, nylon guitar feel
// Tempo: 120 BPM, syncopated pattern, warm acoustic feel
// ═══════════════════════════════════════════════════════════
function renderFamiliar(
  audioCtx: AudioContext,
  destination: MediaStreamAudioDestinationNode,
  durationSeconds: number,
  narrationSegments?: Array<{ startPercent: number; endPercent: number }>
) {
  const nodes: (OscillatorNode | AudioBufferSourceNode)[] = [];
  const BPM = 120;
  const beat = 60 / BPM;
  const bar = beat * 4;

  // Bossa nova chords (Cmaj7 → D7(9) → Dm7 → G7(13))
  const chords = [
    [261.63, 329.63, 392.00, 493.88], // Cmaj7
    [293.66, 369.99, 440.00, 523.25], // D7(9)
    [293.66, 349.23, 440.00, 523.25], // Dm7
    [196.00, 246.94, 349.23, 440.00], // G7(13)
  ];

  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.5;
  const compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -22;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.25;

  const convolver = audioCtx.createConvolver();
  convolver.buffer = createReverbImpulse(audioCtx, 1.8, 3.0);
  const dryG = audioCtx.createGain(); dryG.gain.value = 0.7;
  const wetG = audioCtx.createGain(); wetG.gain.value = 0.3;
  dryG.connect(masterGain);
  convolver.connect(wetG);
  wetG.connect(masterGain);
  masterGain.connect(compressor);
  compressor.connect(destination);

  const mix = (n: AudioNode) => { n.connect(dryG); n.connect(convolver); };
  const now = audioCtx.currentTime;

  masterGain.gain.setValueAtTime(0, now);
  masterGain.gain.linearRampToValueAtTime(0.5, now + 1.8);
  masterGain.gain.setValueAtTime(0.5, now + durationSeconds - 1.8);
  masterGain.gain.linearRampToValueAtTime(0, now + durationSeconds);

  if (narrationSegments) {
    for (const seg of narrationSegments) {
      const s = now + seg.startPercent * durationSeconds;
      const e = now + seg.endPercent * durationSeconds;
      masterGain.gain.setValueAtTime(0.5, s - 0.3);
      masterGain.gain.linearRampToValueAtTime(0.12, s);
      masterGain.gain.setValueAtTime(0.12, e - 0.1);
      masterGain.gain.linearRampToValueAtTime(0.5, e + 0.5);
    }
  }

  // ─── Bossa nova syncopated "guitar" chords ───
  // Classic pattern: X.X..X.X..X.X.. (16th note grid)
  const bossaPattern = [true, false, true, false, false, true, false, true, false, false, true, false, true, false, false, false];
  const sixteenth = beat / 4;

  for (let t = 0; t < durationSeconds; t += bar) {
    const ci = Math.floor(t / bar) % chords.length;
    const chord = chords[ci];

    for (let step = 0; step < 16; step++) {
      if (!bossaPattern[step]) continue;
      const tt = t + step * sixteenth;
      if (tt >= durationSeconds - 1) continue;

      for (const freq of chord) {
        const osc = audioCtx.createOscillator();
        osc.type = 'triangle'; // Nylon guitar-like
        osc.frequency.value = freq;
        osc.detune.value = (Math.random() - 0.5) * 3;
        const g = audioCtx.createGain();
        const vel = 0.02 + Math.random() * 0.008;
        g.gain.setValueAtTime(0, now + tt);
        g.gain.linearRampToValueAtTime(vel, now + tt + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, now + tt + sixteenth * 3);
        osc.connect(g); mix(g);
        osc.start(now + tt); osc.stop(now + tt + sixteenth * 4);
        nodes.push(osc);
      }
    }
  }

  // ─── Bass: root on 1, fifth on 3 (bossa pattern) ───
  for (let t = 0; t < durationSeconds; t += bar) {
    const ci = Math.floor(t / bar) % chords.length;
    const root = chords[ci][0] / 2;
    const fifth = chords[ci][2] / 2;

    // Beat 1: root
    const osc1 = audioCtx.createOscillator();
    osc1.type = 'sine'; osc1.frequency.value = root;
    const g1 = audioCtx.createGain();
    g1.gain.setValueAtTime(0, now + t);
    g1.gain.linearRampToValueAtTime(0.065, now + t + 0.02);
    g1.gain.exponentialRampToValueAtTime(0.001, now + t + beat * 1.8);
    osc1.connect(g1); mix(g1);
    osc1.start(now + t); osc1.stop(now + t + beat * 2);
    nodes.push(osc1);

    // Beat 3: fifth
    const tt3 = t + beat * 2;
    if (tt3 < durationSeconds) {
      const osc2 = audioCtx.createOscillator();
      osc2.type = 'sine'; osc2.frequency.value = fifth;
      const g2 = audioCtx.createGain();
      g2.gain.setValueAtTime(0, now + tt3);
      g2.gain.linearRampToValueAtTime(0.055, now + tt3 + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.001, now + tt3 + beat * 1.8);
      osc2.connect(g2); mix(g2);
      osc2.start(now + tt3); osc2.stop(now + tt3 + beat * 2);
      nodes.push(osc2);
    }
  }

  // ─── Soft shaker (bossa rhythm) ───
  for (let t = 1; t < durationSeconds - 1; t += sixteenth) {
    const stepInBar = Math.floor((t % bar) / sixteenth) % 16;
    const accent = stepInBar % 4 === 0;
    const nLen = accent ? 0.03 : 0.015;
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * nLen, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 7000; bp.Q.value = 2;
    const g = audioCtx.createGain();
    g.gain.value = accent ? 0.008 : 0.004;
    src.connect(bp); bp.connect(g); mix(g);
    src.start(now + t);
    nodes.push(src as any);
  }

  return nodes;
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════

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
  let nodes: (OscillatorNode | AudioBufferSourceNode)[] = [];

  function start() {
    if (theme === 'sofisticado') {
      nodes = renderSofisticado(audioCtx, destination, durationSeconds, narrationSegments);
    } else if (theme === 'jovem') {
      nodes = renderJovem(audioCtx, destination, durationSeconds, narrationSegments);
    } else {
      nodes = renderFamiliar(audioCtx, destination, durationSeconds, narrationSegments);
    }
  }

  function stop() {
    nodes.forEach(n => { try { n.stop(); } catch { /* ok */ } });
    audioCtx.close().catch(() => {});
  }

  return { audioCtx, destination, start, stop };
}

/**
 * Load custom MP3 from URL
 */
export async function createMusicFromUrl(
  url: string,
  durationSeconds: number,
  narrationSegments?: Array<{ startPercent: number; endPercent: number }>
): Promise<{
  audioCtx: AudioContext;
  destination: MediaStreamAudioDestinationNode;
  start: () => void;
  stop: () => void;
}> {
  const audioCtx = new AudioContext({ sampleRate: 44100 });
  const destination = audioCtx.createMediaStreamDestination();
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  let sourceNode: AudioBufferSourceNode | null = null;

  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.55;
  const compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -22;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.25;
  masterGain.connect(compressor);
  compressor.connect(destination);

  function start() {
    const now = audioCtx.currentTime;
    sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.loop = audioBuffer.duration < durationSeconds;
    sourceNode.connect(masterGain);
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.55, now + 1.5);
    masterGain.gain.setValueAtTime(0.55, now + durationSeconds - 1.5);
    masterGain.gain.linearRampToValueAtTime(0, now + durationSeconds);
    if (narrationSegments) {
      for (const seg of narrationSegments) {
        const s = now + seg.startPercent * durationSeconds;
        const e = now + seg.endPercent * durationSeconds;
        masterGain.gain.setValueAtTime(0.55, s - 0.3);
        masterGain.gain.linearRampToValueAtTime(0.15, s);
        masterGain.gain.setValueAtTime(0.15, e - 0.1);
        masterGain.gain.linearRampToValueAtTime(0.55, e + 0.6);
      }
    }
    sourceNode.start(now);
    sourceNode.stop(now + durationSeconds + 0.5);
  }

  function stop() {
    try { sourceNode?.stop(); } catch { /* ok */ }
    audioCtx.close().catch(() => {});
  }

  return { audioCtx, destination, start, stop };
}
