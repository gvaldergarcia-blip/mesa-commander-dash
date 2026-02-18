/**
 * Presenter Video Renderer
 * Canvas-based animated avatar with subtitles, background music, and TTS narration
 */

import { createAmbientMusic } from './audioGenerator';

export interface PresenterRenderOptions {
  sections: { tag: string; text: string }[];
  fullScript: string;
  restaurantName: string;
  dishName: string;
  tone: string;
  duration: number; // 15, 30, or 45
  images: string[];
  logoUrl?: string;
  onProgress?: (progress: number) => void;
}

// ─── Image loading ────────────────────────────────────────
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${url}`));
    img.src = url;
  });
}

// ─── Easing ───────────────────────────────────────────────
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ─── Tone colors ──────────────────────────────────────────
const TONE_THEMES: Record<string, { primary: string; accent: string; bg: string; avatarGradient: string[] }> = {
  sofisticado: { primary: '#c9a96e', accent: '#8b7355', bg: '#1a1a2e', avatarGradient: ['#c9a96e', '#8b7355'] },
  jovem: { primary: '#ff6b6b', accent: '#ffa94d', bg: '#1a1a2e', avatarGradient: ['#ff6b6b', '#ffa94d'] },
  familiar: { primary: '#51cf66', accent: '#69db7c', bg: '#1a2e1a', avatarGradient: ['#51cf66', '#339958'] },
  gourmet: { primary: '#e64980', accent: '#be4bdb', bg: '#2e1a2e', avatarGradient: ['#e64980', '#be4bdb'] },
};

// ─── Draw avatar (animated silhouette) ────────────────────
function drawAvatar(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  t: number, isSpeaking: boolean,
  theme: typeof TONE_THEMES.sofisticado
) {
  const cx = w * 0.5;
  const cy = h * 0.42;
  const headR = w * 0.08;

  // Subtle breathing/speaking animation
  const breathe = Math.sin(t * 4) * 2;
  const speakPulse = isSpeaking ? Math.sin(t * 25) * 3 : 0;

  // Glow behind avatar
  ctx.save();
  const glow = ctx.createRadialGradient(cx, cy, headR, cx, cy, headR * 4);
  glow.addColorStop(0, theme.primary + '30');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Body
  ctx.save();
  ctx.translate(0, breathe);
  const bodyGrad = ctx.createLinearGradient(cx - w * 0.12, cy + headR, cx + w * 0.12, cy + h * 0.25);
  bodyGrad.addColorStop(0, theme.avatarGradient[0]);
  bodyGrad.addColorStop(1, theme.avatarGradient[1]);

  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.1, cy + headR * 1.5);
  ctx.quadraticCurveTo(cx - w * 0.15, cy + h * 0.22, cx - w * 0.12, cy + h * 0.3);
  ctx.lineTo(cx + w * 0.12, cy + h * 0.3);
  ctx.quadraticCurveTo(cx + w * 0.15, cy + h * 0.22, cx + w * 0.1, cy + headR * 1.5);
  ctx.closePath();
  ctx.fill();

  // Head
  ctx.fillStyle = '#e8d5c4';
  ctx.beginPath();
  ctx.arc(cx, cy, headR + speakPulse * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = '#2c2c2c';
  ctx.beginPath();
  ctx.arc(cx, cy - headR * 0.2, headR * 1.05, Math.PI, 0);
  ctx.fill();

  // Eyes
  const eyeY = cy - headR * 0.1;
  const blinkProgress = (Math.sin(t * 0.8) + 1) / 2;
  const eyeH = blinkProgress > 0.95 ? 1 : headR * 0.12;
  ctx.fillStyle = '#2c2c2c';
  ctx.beginPath();
  ctx.ellipse(cx - headR * 0.3, eyeY, headR * 0.08, eyeH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + headR * 0.3, eyeY, headR * 0.08, eyeH, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mouth (animated when speaking)
  const mouthY = cy + headR * 0.35;
  const mouthOpen = isSpeaking ? Math.abs(Math.sin(t * 20)) * headR * 0.15 : headR * 0.03;
  ctx.fillStyle = '#c4736e';
  ctx.beginPath();
  ctx.ellipse(cx, mouthY, headR * 0.2, mouthOpen, 0, 0, Math.PI * 2);
  ctx.fill();

  // Smile line
  if (!isSpeaking) {
    ctx.strokeStyle = '#b0736e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, mouthY - headR * 0.05, headR * 0.18, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }

  ctx.restore();
}

// ─── Draw subtitle bar ───────────────────────────────────
function drawSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  w: number, h: number,
  alpha: number,
  theme: typeof TONE_THEMES.sofisticado
) {
  if (!text || alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  const barY = h * 0.78;
  const barH = h * 0.12;
  const padding = w * 0.06;

  // Frosted glass bar
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  const r = 16;
  const bx = padding;
  const bw = w - padding * 2;
  ctx.beginPath();
  ctx.moveTo(bx + r, barY);
  ctx.lineTo(bx + bw - r, barY);
  ctx.quadraticCurveTo(bx + bw, barY, bx + bw, barY + r);
  ctx.lineTo(bx + bw, barY + barH - r);
  ctx.quadraticCurveTo(bx + bw, barY + barH, bx + bw - r, barY + barH);
  ctx.lineTo(bx + r, barY + barH);
  ctx.quadraticCurveTo(bx, barY + barH, bx, barY + barH - r);
  ctx.lineTo(bx, barY + r);
  ctx.quadraticCurveTo(bx, barY, bx + r, barY);
  ctx.closePath();
  ctx.fill();

  // Border accent
  ctx.strokeStyle = theme.primary + '60';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Text
  const fontSize = w * 0.032;
  ctx.font = `600 ${fontSize}px "Inter", system-ui, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 8;

  // Word wrap
  const maxW = bw - w * 0.06;
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  lines.push(line);

  const lineH = fontSize * 1.4;
  const startY = barY + barH / 2 - ((lines.length - 1) * lineH) / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], w / 2, startY + i * lineH);
  }

  ctx.restore();
}

// ─── Draw background with images ─────────────────────────
function drawBackground(
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  w: number, h: number,
  t: number,
  theme: typeof TONE_THEMES.sofisticado
) {
  // Dark background
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, w, h);

  if (images.length > 0) {
    const slideTime = 1 / Math.max(images.length, 1);
    const idx = Math.min(Math.floor(t / slideTime), images.length - 1);
    const img = images[idx];

    // Draw blurred background image
    ctx.save();
    ctx.globalAlpha = 0.25;
    const imgRatio = img.width / img.height;
    const areaRatio = w / h;
    let sw, sh, sx, sy;
    if (imgRatio > areaRatio) {
      sh = img.height;
      sw = sh * areaRatio;
      sx = (img.width - sw) / 2;
      sy = 0;
    } else {
      sw = img.width;
      sh = sw / areaRatio;
      sx = 0;
      sy = (img.height - sh) / 2;
    }
    const scale = 1.1 + Math.sin(t * 2) * 0.02;
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-w / 2, -h / 2);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    ctx.restore();

    // Overlay gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, theme.bg + 'dd');
    grad.addColorStop(0.3, theme.bg + '99');
    grad.addColorStop(0.7, theme.bg + '99');
    grad.addColorStop(1, theme.bg + 'ee');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // Subtle particles
  ctx.save();
  for (let i = 0; i < 12; i++) {
    const seed = i * 137.508;
    const px = ((seed * 7.31 + t * 40) % (w + 20)) - 10;
    const py = ((seed * 3.17 + t * 20) % (h + 20)) - 10;
    ctx.globalAlpha = 0.08 + Math.sin(t * 3 + seed) * 0.04;
    ctx.fillStyle = theme.primary;
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─── Draw header ─────────────────────────────────────────
function drawHeader(
  ctx: CanvasRenderingContext2D,
  restaurantName: string,
  dishName: string,
  w: number, h: number,
  t: number,
  theme: typeof TONE_THEMES.sofisticado
) {
  const alpha = t < 0.05 ? t / 0.05 : 1;

  // Restaurant name
  ctx.save();
  ctx.globalAlpha = alpha * 0.9;
  ctx.font = `700 ${w * 0.028}px "Inter", system-ui, sans-serif`;
  ctx.fillStyle = theme.primary;
  ctx.textAlign = 'center';
  ctx.fillText(restaurantName.toUpperCase(), w / 2, h * 0.06);

  // Accent line
  const lineW = ctx.measureText(restaurantName.toUpperCase()).width;
  ctx.strokeStyle = theme.primary + '60';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w / 2 - lineW / 2, h * 0.075);
  ctx.lineTo(w / 2 + lineW / 2, h * 0.075);
  ctx.stroke();
  ctx.restore();

  // Dish name (if in PRATO section)
  if (t > 0.2 && t < 0.8) {
    const dishAlpha = t < 0.25 ? (t - 0.2) / 0.05 : t > 0.75 ? (0.8 - t) / 0.05 : 1;
    ctx.save();
    ctx.globalAlpha = dishAlpha * 0.7;
    ctx.font = `500 ${w * 0.022}px "Inter", system-ui, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`✦ ${dishName} ✦`, w / 2, h * 0.1);
    ctx.restore();
  }
}

// ─── Draw CTA ────────────────────────────────────────────
function drawCTA(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  t: number,
  theme: typeof TONE_THEMES.sofisticado
) {
  if (t < 0.82) return;
  const alpha = easeOut((t - 0.82) / 0.12);

  ctx.save();
  ctx.globalAlpha = alpha;

  const bw = w * 0.7;
  const bh = w * 0.065;
  const bx = (w - bw) / 2;
  const by = h * 0.92;
  const r = bh / 2;

  // Button
  const grad = ctx.createLinearGradient(bx, by, bx + bw, by);
  grad.addColorStop(0, theme.primary);
  grad.addColorStop(1, theme.accent);
  ctx.fillStyle = grad;
  ctx.shadowColor = theme.primary + '80';
  ctx.shadowBlur = 20;

  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + bw - r, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
  ctx.lineTo(bx + bw, by + bh - r);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
  ctx.lineTo(bx + r, by + bh);
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
  ctx.lineTo(bx, by + r);
  ctx.quadraticCurveTo(bx, by, bx + r, by);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.font = `700 ${w * 0.026}px "Inter", system-ui, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Reserve agora pelo MesaClik', w / 2, by + bh / 2);

  ctx.restore();
}

// ─── Get current subtitle text ───────────────────────────
function getCurrentSubtitle(
  sections: { tag: string; text: string }[],
  t: number
): string {
  if (sections.length === 0) return '';
  const sectionTime = 1 / sections.length;
  const idx = Math.min(Math.floor(t / sectionTime), sections.length - 1);
  const section = sections[idx];
  const localT = (t - idx * sectionTime) / sectionTime;

  // Progressive word reveal
  const words = section.text.split(' ');
  const visibleWords = Math.ceil(words.length * Math.min(localT * 1.5, 1));
  return words.slice(0, visibleWords).join(' ');
}

// ─── TTS using Web Speech API ────────────────────────────
function speakSection(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    utterance.pitch = 1;

    const voices = window.speechSynthesis.getVoices();
    const ptVoice =
      voices.find((v) => v.lang.startsWith('pt') && v.lang.includes('BR')) ||
      voices.find((v) => v.lang.startsWith('pt'));
    if (ptVoice) utterance.voice = ptVoice;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

// ─── Main presenter render ──────────────────────────────
export async function renderPresenterVideo(
  options: PresenterRenderOptions
): Promise<Blob> {
  const { sections, restaurantName, dishName, tone, duration, images } = options;
  const w = 1080;
  const h = 1920; // Always vertical 9:16

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const theme = TONE_THEMES[tone] || TONE_THEMES.sofisticado;
  const loadedImages = await Promise.all(images.map(loadImage)).catch(() => [] as HTMLImageElement[]);

  // Preload voices
  window.speechSynthesis?.getVoices();

  const stream = canvas.captureStream(30);

  // Add background music
  let audioCleanup: (() => void) | null = null;
  try {
    const moodMap: Record<string, 'elegant' | 'upbeat' | 'chill' | 'dramatic'> = {
      sofisticado: 'elegant',
      jovem: 'upbeat',
      familiar: 'chill',
      gourmet: 'dramatic',
    };
    const music = createAmbientMusic(duration, moodMap[tone] || 'elegant');
    const audioTrack = music.destination.stream.getAudioTracks()[0];
    if (audioTrack) stream.addTrack(audioTrack);
    music.start();
    audioCleanup = () => music.stop();
  } catch {
    // Music is optional
  }

  // Add TTS audio - capture via AudioContext destination
  let ttsDestination: MediaStreamAudioDestinationNode | null = null;
  try {
    const ttsCtx = new AudioContext();
    ttsDestination = ttsCtx.createMediaStreamDestination();
    const ttsTrack = ttsDestination.stream.getAudioTracks()[0];
    if (ttsTrack) stream.addTrack(ttsTrack);
  } catch {
    // TTS audio capture optional
  }

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  // Start TTS narration async
  const fullText = sections.map((s) => s.text).join('. ');
  setTimeout(() => {
    speakSection(fullText).catch(() => {});
  }, 500);

  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      audioCleanup?.();
      window.speechSynthesis?.cancel();
      resolve(new Blob(chunks, { type: 'video/webm' }));
    };

    recorder.onerror = (e) => {
      audioCleanup?.();
      window.speechSynthesis?.cancel();
      reject(new Error('MediaRecorder error'));
    };

    recorder.start(100);

    const totalMs = duration * 1000;
    const startTime = performance.now();
    let lastProgress = 0;

    function renderFrame() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / totalMs, 1);

      // Is TTS currently speaking?
      const isSpeaking = window.speechSynthesis?.speaking || false;

      // Clear
      ctx.clearRect(0, 0, w, h);

      // Background with images
      drawBackground(ctx, loadedImages, w, h, t, theme);

      // Header
      drawHeader(ctx, restaurantName, dishName, w, h, t, theme);

      // Avatar
      drawAvatar(ctx, w, h, t * duration, isSpeaking, theme);

      // Subtitle
      const subtitle = getCurrentSubtitle(sections, t);
      const subAlpha = t < 0.03 ? t / 0.03 : t > 0.95 ? (1 - t) / 0.05 : 1;
      drawSubtitle(ctx, subtitle, w, h, subAlpha, theme);

      // CTA
      drawCTA(ctx, w, h, t, theme);

      // Progress
      const progress = Math.round(t * 100);
      if (progress !== lastProgress) {
        lastProgress = progress;
        options.onProgress?.(progress);
      }

      if (t >= 1) {
        setTimeout(() => recorder.stop(), 300);
        return;
      }

      requestAnimationFrame(renderFrame);
    }

    renderFrame();
  });
}
