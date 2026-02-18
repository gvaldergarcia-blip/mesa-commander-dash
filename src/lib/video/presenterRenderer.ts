/**
 * Premium Commercial Video Renderer
 * Cinematic photo transitions, animated text, subtitles, music — no avatar
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

function easeInOutQuart(t: number): number {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

// ─── Tone themes ──────────────────────────────────────────
const TONE_THEMES: Record<string, {
  primary: string; accent: string; bg: string;
  gradientStart: string; gradientEnd: string;
  textAccent: string;
}> = {
  sofisticado: {
    primary: '#c9a96e', accent: '#8b7355', bg: '#0d0d14',
    gradientStart: '#c9a96e', gradientEnd: '#8b7355',
    textAccent: '#e8d5b0',
  },
  jovem: {
    primary: '#ff6b6b', accent: '#ffa94d', bg: '#0d0d14',
    gradientStart: '#ff6b6b', gradientEnd: '#ffa94d',
    textAccent: '#ffd4a8',
  },
  familiar: {
    primary: '#51cf66', accent: '#339958', bg: '#0a130a',
    gradientStart: '#51cf66', gradientEnd: '#339958',
    textAccent: '#a8e6b0',
  },
  gourmet: {
    primary: '#e64980', accent: '#be4bdb', bg: '#140a14',
    gradientStart: '#e64980', gradientEnd: '#be4bdb',
    textAccent: '#f0b0d0',
  },
};

type Theme = typeof TONE_THEMES.sofisticado;

// ─── Draw cover image with Ken Burns ─────────────────────
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
  scale = 1, panX = 0, panY = 0
) {
  const imgRatio = img.width / img.height;
  const areaRatio = w / h;
  let sw: number, sh: number, sx: number, sy: number;

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

  ctx.save();
  ctx.translate(x + w / 2 + panX, y + h / 2 + panY);
  ctx.scale(scale, scale);
  ctx.translate(-(x + w / 2), -(y + h / 2));
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

// ─── Rounded rect helper ─────────────────────────────────
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Text with word wrap ─────────────────────────────────
function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  fontSize: number,
  color: string,
  alpha: number,
  fontWeight = 'bold',
  maxWidth?: number,
  align: CanvasTextAlign = 'center'
) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = color;
  ctx.font = `${fontWeight} ${fontSize}px "Inter", "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = fontSize * 0.35;

  if (maxWidth) {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
    const lineH = fontSize * 1.4;
    const startY = y - ((lines.length - 1) * lineH) / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, startY + i * lineH);
    }
  } else {
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}

// ─── Cinematic gradient overlays ─────────────────────────
function drawGradientOverlay(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  topAlpha: number, bottomAlpha: number
) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, `rgba(0,0,0,${topAlpha})`);
  grad.addColorStop(0.35, 'rgba(0,0,0,0.05)');
  grad.addColorStop(0.65, 'rgba(0,0,0,0.05)');
  grad.addColorStop(1, `rgba(0,0,0,${bottomAlpha})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

// ─── Light particles ─────────────────────────────────────
function drawParticles(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, theme: Theme) {
  ctx.save();
  for (let i = 0; i < 18; i++) {
    const seed = i * 137.508;
    const px = ((seed * 7.31 + t * 50 * (0.4 + (i % 3) * 0.25)) % (w + 30)) - 15;
    const py = ((seed * 3.17 + t * 25 * (0.3 + (i % 4) * 0.2)) % (h + 30)) - 15;
    const size = 1.2 + (i % 4) * 0.6;
    ctx.globalAlpha = 0.1 + Math.sin(t * 3 + seed) * 0.06;
    ctx.fillStyle = theme.primary;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─── Cinematic light leak ────────────────────────────────
function drawLightLeak(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, theme: Theme) {
  ctx.save();
  const cx = w * (0.7 + Math.sin(t * 1.8) * 0.2);
  const cy = h * (0.2 + Math.cos(t * 1.3) * 0.12);
  const r = w * 0.5;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, theme.primary + '18');
  grad.addColorStop(0.5, theme.accent + '08');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// ─── Accent line animation ───────────────────────────────
function drawAccentLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y: number, x2: number,
  progress: number, theme: Theme
) {
  const p = easeInOut(Math.min(progress, 1));
  const currentX2 = x1 + (x2 - x1) * p;
  ctx.save();
  const grad = ctx.createLinearGradient(x1, y, x2, y);
  grad.addColorStop(0, theme.gradientStart);
  grad.addColorStop(1, theme.gradientEnd);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.shadowColor = theme.primary + '60';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(currentX2, y);
  ctx.stroke();
  ctx.restore();
}

// ─── Ken Burns directions ────────────────────────────────
const KB_DIRS = [
  { px: -30, py: -20 }, { px: 30, py: -15 },
  { px: -20, py: 25 }, { px: 25, py: 20 },
  { px: -15, py: -30 }, { px: 28, py: 10 },
];

// ─── Draw cinematic slide with Ken Burns ─────────────────
function drawSlide(
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  w: number, h: number,
  t: number, theme: Theme
) {
  // Dark base
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, w, h);

  if (images.length === 0) return;

  const slideTime = 1 / images.length;
  const idx = Math.min(Math.floor(t / slideTime), images.length - 1);
  const slideT = (t - idx * slideTime) / slideTime;
  const prevIdx = idx > 0 ? idx - 1 : images.length - 1;

  const transThreshold = 0.18;
  const dir = KB_DIRS[idx % KB_DIRS.length];
  const prevDir = KB_DIRS[prevIdx % KB_DIRS.length];

  // Ken Burns zoom/pan
  const zoomStart = 1.0;
  const zoomEnd = 1.15;

  // Previous slide fading out
  if (slideT < transThreshold && idx > 0) {
    const fadeT = slideT / transThreshold;
    drawCover(ctx, images[prevIdx], 0, 0, w, h, zoomEnd, prevDir.px, prevDir.py);
    ctx.globalAlpha = easeInOutQuart(fadeT);
  }

  // Current slide with zoom/pan
  const zoom = zoomStart + (zoomEnd - zoomStart) * easeInOut(slideT);
  const px = dir.px * slideT;
  const py = dir.py * slideT;
  drawCover(ctx, images[idx], 0, 0, w, h, zoom, px, py);
  ctx.globalAlpha = 1;

  // Cinematic overlays
  drawGradientOverlay(ctx, w, h, 0.55, 0.75);
  drawLightLeak(ctx, w, h, t, theme);
  drawParticles(ctx, w, h, t, theme);
}

// ─── Draw header (restaurant name + dish) ────────────────
function drawHeader(
  ctx: CanvasRenderingContext2D,
  restaurantName: string,
  dishName: string,
  w: number, h: number,
  t: number, theme: Theme
) {
  // Restaurant name - elegant entrance
  const nameAlpha = t < 0.06 ? t / 0.06 : t > 0.92 ? (1 - t) / 0.08 : 1;
  const nameY = h * 0.06 + (1 - easeOut(Math.min(t / 0.1, 1))) * 30;

  ctx.save();
  ctx.globalAlpha = nameAlpha * 0.85;
  ctx.font = `300 ${w * 0.02}px "Inter", system-ui, sans-serif`;
  ctx.fillStyle = theme.textAccent;
  ctx.textAlign = 'center';
  ctx.letterSpacing = '4px';
  ctx.fillText(restaurantName.toUpperCase(), w / 2, nameY);
  ctx.restore();

  // Accent line below name
  drawAccentLine(ctx, w * 0.35, nameY + w * 0.018, w * 0.65, t * 6, theme);

  // Dish name - appears after intro
  if (t > 0.08 && t < 0.88) {
    const dishAlpha = t < 0.14 ? (t - 0.08) / 0.06 : t > 0.82 ? (0.88 - t) / 0.06 : 1;
    const dishY = h * 0.12 + (1 - easeOut(Math.min((t - 0.08) / 0.08, 1))) * 25;
    drawText(ctx, dishName, w / 2, dishY, w * 0.04, '#ffffff', dishAlpha, '600', w * 0.8);
  }
}

// ─── Draw subtitle bar (frosted glass) ───────────────────
function drawSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  w: number, h: number,
  alpha: number, theme: Theme
) {
  if (!text || alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  const barY = h * 0.72;
  const barH = h * 0.1;
  const padding = w * 0.05;
  const bx = padding;
  const bw = w - padding * 2;
  const r = 14;

  // Frosted glass background
  drawRoundedRect(ctx, bx, barY, bw, barH, r);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();

  // Subtle border
  ctx.strokeStyle = theme.primary + '30';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Text
  const fontSize = w * 0.03;
  ctx.font = `500 ${fontSize}px "Inter", system-ui, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 6;

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

  const lineH = fontSize * 1.35;
  const startY = barY + barH / 2 - ((lines.length - 1) * lineH) / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], w / 2, startY + i * lineH);
  }

  ctx.restore();
}

// ─── Draw CTA button ─────────────────────────────────────
function drawCTA(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  t: number, theme: Theme
) {
  if (t < 0.82) return;
  const alpha = easeOut((t - 0.82) / 0.12);

  ctx.save();
  ctx.globalAlpha = alpha;

  const bw = w * 0.72;
  const bh = w * 0.07;
  const bx = (w - bw) / 2;
  const by = h * 0.88;
  const r = bh / 2;

  // Button with gradient
  const grad = ctx.createLinearGradient(bx, by, bx + bw, by);
  grad.addColorStop(0, theme.gradientStart);
  grad.addColorStop(1, theme.gradientEnd);

  drawRoundedRect(ctx, bx, by, bw, bh, r);
  ctx.fillStyle = grad;
  ctx.shadowColor = theme.primary + '70';
  ctx.shadowBlur = 25;
  ctx.fill();

  // Button text
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.font = `700 ${w * 0.028}px "Inter", system-ui, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Reserve agora pelo MesaClik', w / 2, by + bh / 2);

  ctx.restore();
}

// ─── Section tag badge ───────────────────────────────────
function drawSectionBadge(
  ctx: CanvasRenderingContext2D,
  tag: string,
  w: number, h: number,
  alpha: number, theme: Theme
) {
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha * 0.7;

  const text = tag.replace(/[\[\]]/g, '').toUpperCase();
  const fontSize = w * 0.016;
  ctx.font = `600 ${fontSize}px "Inter", system-ui, sans-serif`;
  const textW = ctx.measureText(text).width;

  const bx = w / 2 - (textW + w * 0.03) / 2;
  const by = h * 0.67;
  const bw = textW + w * 0.03;
  const bh = fontSize * 2;

  drawRoundedRect(ctx, bx, by, bw, bh, bh / 2);
  ctx.fillStyle = theme.primary + '25';
  ctx.fill();
  ctx.strokeStyle = theme.primary + '50';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = theme.textAccent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, by + bh / 2);

  ctx.restore();
}

// ─── Get current subtitle text ───────────────────────────
function getCurrentSection(
  sections: { tag: string; text: string }[],
  t: number
): { tag: string; text: string; localT: number } | null {
  if (sections.length === 0) return null;
  const sectionTime = 1 / sections.length;
  const idx = Math.min(Math.floor(t / sectionTime), sections.length - 1);
  const section = sections[idx];
  const localT = (t - idx * sectionTime) / sectionTime;

  // Progressive word reveal
  const words = section.text.split(' ');
  const visibleWords = Math.ceil(words.length * Math.min(localT * 1.5, 1));
  return {
    tag: section.tag,
    text: words.slice(0, visibleWords).join(' '),
    localT,
  };
}

// ─── TTS using Web Speech API ────────────────────────────
function speakSection(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve(); return; }
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

// ─── Main render function ────────────────────────────────
export async function renderPresenterVideo(
  options: PresenterRenderOptions
): Promise<Blob> {
  const { sections, restaurantName, dishName, tone, duration, images } = options;
  const w = 1080;
  const h = 1920;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const theme = TONE_THEMES[tone] || TONE_THEMES.sofisticado;
  const loadedImages = await Promise.all(images.map(loadImage)).catch(() => [] as HTMLImageElement[]);

  // Preload voices
  window.speechSynthesis?.getVoices();

  const stream = canvas.captureStream(30);

  // Background music
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
  } catch { /* music optional */ }

  // TTS narration
  const fullText = sections.map((s) => s.text).join('. ');
  setTimeout(() => { speakSection(fullText).catch(() => {}); }, 500);

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

  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      audioCleanup?.();
      window.speechSynthesis?.cancel();
      resolve(new Blob(chunks, { type: 'video/webm' }));
    };

    recorder.onerror = () => {
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

      ctx.clearRect(0, 0, w, h);

      // 1. Cinematic slide with Ken Burns
      drawSlide(ctx, loadedImages, w, h, t, theme);

      // 2. Header (restaurant + dish)
      drawHeader(ctx, restaurantName, dishName, w, h, t, theme);

      // 3. Section badge + subtitle
      const current = getCurrentSection(sections, t);
      if (current) {
        const subAlpha = t < 0.04 ? t / 0.04 : t > 0.94 ? (1 - t) / 0.06 : 1;
        drawSectionBadge(ctx, current.tag, w, h, subAlpha, theme);
        drawSubtitle(ctx, current.text, w, h, subAlpha, theme);
      }

      // 4. CTA final
      drawCTA(ctx, w, h, t, theme);

      // 5. Cinematic letterbox bars
      const barH = h * 0.025;
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, w, barH);
      ctx.fillRect(0, h - barH, w, barH);

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
