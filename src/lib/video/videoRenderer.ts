/**
 * Client-side video renderer using Canvas API + MediaRecorder
 * Premium templates with cinematic effects — no external API costs
 */

import type { MusicTheme } from './audioGenerator';
import type { NarrationScript } from './ttsNarrator';
import { drawAnimatedSubtitle, getSubtitleState } from './subtitleRenderer';

export interface RenderOptions {
  images: string[];
  format: 'vertical' | 'square';
  duration: 7 | 15 | 30;
  templateId: string;
  headline: string;
  subtext?: string;
  cta?: string;
  restaurantName: string;
  logoUrl?: string;
  musicTheme?: Exclude<MusicTheme, 'auto'>;
  customMusicUrl?: string;
  narrationScript?: NarrationScript;
  enableNarration?: boolean;
  onProgress?: (progress: number) => void;
}

// ─── Image loading ────────────────────────────────────────
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

// ─── Easing functions ─────────────────────────────────────
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutQuart(t: number): number {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

// ─── Draw helpers ─────────────────────────────────────────
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

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  fontSize: number,
  color: string,
  alpha: number,
  font = 'bold',
  maxWidth?: number,
  align: CanvasTextAlign = 'center',
  shadow = true
) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = color;
  ctx.font = `${font} ${fontSize}px "Inter", "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';

  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = fontSize * 0.3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = fontSize * 0.05;
  }

  if (maxWidth) {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);
    const lineHeight = fontSize * 1.35;
    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, startY + i * lineHeight);
    }
  } else {
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}

function drawGradientOverlay(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  topAlpha: number, bottomAlpha: number,
  midStop = 0.4
) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, `rgba(0,0,0,${topAlpha})`);
  grad.addColorStop(midStop, 'rgba(0,0,0,0)');
  grad.addColorStop(1 - midStop + 0.2, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(0,0,0,${bottomAlpha})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

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

// ─── Premium effects ──────────────────────────────────────

/** Floating light particles with depth-of-field blur effect */
function drawParticles(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, count = 20) {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const seed = i * 137.508;
    const speed = 0.3 + (i % 5) * 0.15;
    const px = ((seed * 7.31 + t * 60 * speed) % (w + 80)) - 40;
    const py = ((seed * 3.17 + t * 25 * (0.3 + (i % 4) * 0.15) + Math.sin(t * 2 + seed) * 30) % (h + 80)) - 40;
    const baseSize = 1.2 + (i % 6) * 0.6;
    const breathe = Math.sin(t * 2.5 + seed * 0.7) * 0.5 + 0.5;
    const size = baseSize * (0.7 + breathe * 0.6);
    const alpha = (0.08 + breathe * 0.12) * (py < h * 0.3 ? 0.7 : 1);
    ctx.globalAlpha = alpha;
    
    // Soft glow halo
    const glow = ctx.createRadialGradient(px, py, 0, px, py, size * 3);
    glow.addColorStop(0, 'rgba(255,245,230,0.3)');
    glow.addColorStop(0.5, 'rgba(255,220,180,0.08)');
    glow.addColorStop(1, 'rgba(255,200,150,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(px - size * 3, py - size * 3, size * 6, size * 6);
    
    // Core dot
    ctx.fillStyle = 'rgba(255,250,240,0.9)';
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Cinematic light leak / lens flare with color shift */
function drawLightLeak(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.save();
  // Primary warm leak
  const cx = w * (0.65 + Math.sin(t * 1.3) * 0.25);
  const cy = h * (0.15 + Math.cos(t * 0.9) * 0.12);
  const r = w * 0.65;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, 'rgba(255,210,120,0.14)');
  grad.addColorStop(0.3, 'rgba(255,160,60,0.06)');
  grad.addColorStop(0.7, 'rgba(255,120,40,0.02)');
  grad.addColorStop(1, 'rgba(255,100,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  
  // Secondary cooler leak (opposite corner)
  const cx2 = w * (0.3 + Math.cos(t * 1.7) * 0.2);
  const cy2 = h * (0.8 + Math.sin(t * 1.1) * 0.1);
  const grad2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, w * 0.5);
  grad2.addColorStop(0, 'rgba(180,140,255,0.06)');
  grad2.addColorStop(0.5, 'rgba(140,100,220,0.02)');
  grad2.addColorStop(1, 'rgba(100,80,180,0)');
  ctx.fillStyle = grad2;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Subtle film grain for cinematic texture */
function drawFilmGrain(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, intensity = 0.03) {
  ctx.save();
  ctx.globalAlpha = intensity;
  const imageData = ctx.getImageData(0, 0, Math.min(w, 540), Math.min(h, 540));
  const data = imageData.data;
  const seed = Math.floor(t * 24) * 1000;
  for (let i = 0; i < data.length; i += 16) {
    const noise = ((seed + i * 9301 + 49297) % 233280) / 233280 * 2 - 1;
    const val = noise * 40;
    data[i] += val;
    data[i + 1] += val;
    data[i + 2] += val;
  }
  ctx.putImageData(imageData, 0, 0);
  ctx.restore();
}

/** Animated accent line with glow */
function drawAccentLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y: number, x2: number,
  t: number, color = '#e11d48', lineW = 3
) {
  const progress = easeInOut(Math.min(t * 3.5, 1));
  const currentX2 = x1 + (x2 - x1) * progress;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineW;
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(currentX2, y);
  ctx.stroke();
  ctx.restore();
}

/** Premium CTA button with glow */
function drawCTAButton(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number, w: number, h: number,
  alpha: number, fontSize: number,
  style: 'filled' | 'outlined' | 'glass' = 'filled'
) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const r = h / 2;
  drawRoundedRect(ctx, x, y, w, h, r);

  if (style === 'filled') {
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, '#e11d48');
    grad.addColorStop(1, '#be123c');
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(225,29,72,0.5)';
    ctx.shadowBlur = 20;
    ctx.fill();
  } else if (style === 'glass') {
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Inner glow
    const gGrad = ctx.createLinearGradient(x, y, x, y + h);
    gGrad.addColorStop(0, 'rgba(255,255,255,0.15)');
    gGrad.addColorStop(1, 'rgba(255,255,255,0)');
    drawRoundedRect(ctx, x, y, w, h, r);
    ctx.fillStyle = gGrad;
    ctx.fill();
  } else {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  drawText(ctx, text, x + w / 2, y + h / 2, fontSize, '#ffffff', 1, 'bold', undefined, 'center', false);
  ctx.restore();
}

// ─── Template definitions ──────────────────────────────────

interface TemplateRenderFn {
  (ctx: CanvasRenderingContext2D, images: HTMLImageElement[], t: number, opts: RenderOptions, w: number, h: number): void;
}

function getSlideIndex(t: number, count: number): { index: number; slideT: number; transitionT: number } {
  const slideTime = 1 / count;
  const index = Math.min(Math.floor(t / slideTime), count - 1);
  const slideT = (t - index * slideTime) / slideTime;
  const transitionDuration = 0.22; // Longer, smoother transitions
  const transitionT = slideT < transitionDuration ? slideT / transitionDuration : 1;
  return { index, slideT, transitionT };
}

// ═══ Template 1: Elegante — Cinematic crossfade, particles, film look ═══
const templateElegante: TemplateRenderFn = (ctx, images, t, opts, w, h) => {
  const { index, slideT, transitionT } = getSlideIndex(t, images.length);
  const prevIndex = index > 0 ? index - 1 : images.length - 1;

  // Continuous Ken Burns — each slide gets unique direction
  const dirs = [
    { sx: 1.0, ex: 1.08, px: -20, py: -15 },
    { sx: 1.04, ex: 1.0, px: 25, py: -10 },
    { sx: 1.0, ex: 1.06, px: -15, py: 20 },
    { sx: 1.06, ex: 1.0, px: 20, py: 15 },
  ];
  const dir = dirs[index % dirs.length];
  const prevDir = dirs[prevIndex % dirs.length];
  const kbScale = dir.sx + (dir.ex - dir.sx) * easeInOut(slideT);
  const kbPanX = dir.px * easeInOut(slideT);
  const kbPanY = dir.py * easeInOut(slideT);

  if (transitionT < 1) {
    const prevKb = prevDir.ex; // Previous slide ends at its end scale
    drawCover(ctx, images[prevIndex], 0, 0, w, h, prevKb, prevDir.px, prevDir.py);
  }
  ctx.globalAlpha = easeInOutQuart(transitionT);
  drawCover(ctx, images[index], 0, 0, w, h, kbScale, kbPanX, kbPanY);
  ctx.globalAlpha = 1;

  // Cinematic overlay
  drawGradientOverlay(ctx, w, h, 0.55, 0.8, 0.3);
  drawLightLeak(ctx, w, h, t);
  drawParticles(ctx, w, h, t, 18);

  // Top accent line
  drawAccentLine(ctx, w * 0.35, h * 0.08, w * 0.65, t);

  // Headline with smooth entrance
  const headAlpha = t < 0.06 ? t / 0.06 : t > 0.85 ? (1 - t) / 0.15 : 1;
  const headY = h * 0.14 + (1 - easeOut(Math.min(t / 0.12, 1))) * 40;
  drawText(ctx, opts.headline, w / 2, headY, w * 0.046, '#ffffff', headAlpha, 'bold', w * 0.78);

  // Subtext with delay
  if (opts.subtext) {
    const subAlpha = t < 0.12 ? 0 : t < 0.22 ? (t - 0.12) / 0.1 : t > 0.85 ? (1 - t) / 0.15 : 1;
    drawText(ctx, opts.subtext, w / 2, h * 0.82, w * 0.03, 'rgba(255,255,255,0.9)', subAlpha, '500', w * 0.72);
  }

  // Restaurant name with line
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.32, h * 0.925);
  ctx.lineTo(w * 0.68, h * 0.925);
  ctx.stroke();
  ctx.restore();
  drawText(ctx, opts.restaurantName, w / 2, h * 0.95, w * 0.022, 'rgba(255,255,255,0.7)', 0.8, '600');

  // CTA
  if (opts.cta && t > 0.78) {
    const ctaAlpha = easeOut((t - 0.78) / 0.15);
    const bw = w * 0.6;
    const bh = w * 0.065;
    drawCTAButton(ctx, opts.cta, (w - bw) / 2, h * 0.72 - bh / 2, bw, bh, ctaAlpha, w * 0.026, 'filled');
  }

  // Film grain
  drawFilmGrain(ctx, w, h, t, 0.02);
};

// ═══ Template 2: Dinâmico — Slide transitions, modern bar, energetic ═══
const templateDinamico: TemplateRenderFn = (ctx, images, t, opts, w, h) => {
  const { index, slideT, transitionT } = getSlideIndex(t, images.length);
  const prevIndex = index > 0 ? index - 1 : images.length - 1;

  // Slide with parallax + subtle Ken Burns
  const kbScale = 1.02 + Math.sin(t * 1.2) * 0.02;
  const offset = (1 - easeInOutQuart(transitionT)) * w;
  if (transitionT < 1) {
    ctx.save();
    ctx.translate(-offset * 0.4, 0);
    drawCover(ctx, images[prevIndex], 0, 0, w, h, 1.05);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(transitionT < 1 ? w - offset : 0, 0);
  drawCover(ctx, images[index], 0, 0, w, h, kbScale);
  ctx.restore();

  // Bottom gradient bar
  const barH = h * 0.25;
  const barGrad = ctx.createLinearGradient(0, h - barH, 0, h);
  barGrad.addColorStop(0, 'rgba(0,0,0,0)');
  barGrad.addColorStop(0.25, 'rgba(0,0,0,0.7)');
  barGrad.addColorStop(1, 'rgba(0,0,0,0.95)');
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, h - barH, w, barH);

  // Top gradient
  const topGrad = ctx.createLinearGradient(0, 0, 0, h * 0.15);
  topGrad.addColorStop(0, 'rgba(0,0,0,0.6)');
  topGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, w, h * 0.15);

  // Accent stripe top
  const stripeGrad = ctx.createLinearGradient(0, 0, w, 0);
  stripeGrad.addColorStop(0, '#e11d48');
  stripeGrad.addColorStop(1, '#f97316');
  ctx.fillStyle = stripeGrad;
  ctx.fillRect(0, 0, w, h * 0.006);

  // Restaurant name top-left
  drawText(ctx, opts.restaurantName, w * 0.07, h * 0.045, w * 0.026, '#ffffff', 0.95, '700', undefined, 'left');

  // Headline from bottom
  const headAlpha = t < 0.08 ? t / 0.08 : 1;
  const slideUp = (1 - easeOut(Math.min(t / 0.14, 1))) * 50;
  drawText(ctx, opts.headline, w * 0.07, h - barH * 0.6 + slideUp, w * 0.042, '#ffffff', headAlpha, 'bold', w * 0.82, 'left');

  if (opts.subtext) {
    const subAlpha = t < 0.16 ? 0 : t < 0.26 ? (t - 0.16) / 0.1 : 1;
    drawText(ctx, opts.subtext, w * 0.07, h - barH * 0.28, w * 0.026, 'rgba(255,255,255,0.8)', subAlpha, '400', w * 0.82, 'left');
  }

  drawParticles(ctx, w, h, t, 12);
  drawLightLeak(ctx, w, h, t);

  // CTA
  if (opts.cta && t > 0.75) {
    const ctaAlpha = easeOut((t - 0.75) / 0.15);
    const bw = w * 0.5;
    const bh = w * 0.06;
    drawCTAButton(ctx, opts.cta, w * 0.07, h - barH * 0.6 - bh / 2, bw, bh, ctaAlpha, w * 0.024, 'filled');
  }

  drawFilmGrain(ctx, w, h, t, 0.015);
};

// ═══ Template 3: Ken Burns — Deep cinematic zoom/pan, film look ═══
const templateKenBurns: TemplateRenderFn = (ctx, images, t, opts, w, h) => {
  const { index, slideT } = getSlideIndex(t, images.length);
  const prevIndex = index > 0 ? index - 1 : images.length - 1;

  // More dramatic zoom range
  const zoomStart = 1.0;
  const zoomEnd = 1.25;
  const directions = [
    { px: -45, py: -30 }, { px: 40, py: -22 },
    { px: -30, py: 35 }, { px: 35, py: 28 },
    { px: -22, py: -40 }, { px: 38, py: 15 },
    { px: -35, py: 22 }, { px: 28, py: -35 },
  ];

  const transThreshold = 0.2;
  if (slideT < transThreshold && index > 0) {
    const fadeT = slideT / transThreshold;
    const prevDir = directions[prevIndex % directions.length];
    drawCover(ctx, images[prevIndex], 0, 0, w, h, zoomEnd, prevDir.px, prevDir.py);
    ctx.globalAlpha = easeInOutQuart(fadeT);
  }

  const dir = directions[index % directions.length];
  const zoom = zoomStart + (zoomEnd - zoomStart) * easeInOut(slideT);
  const px = dir.px * easeInOut(slideT);
  const py = dir.py * easeInOut(slideT);
  drawCover(ctx, images[index], 0, 0, w, h, zoom, px, py);
  ctx.globalAlpha = 1;

  // Cinematic bars (letterbox effect)
  const barSize = h * 0.05;
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.fillRect(0, 0, w, barSize);
  ctx.fillRect(0, h - barSize, w, barSize);

  drawGradientOverlay(ctx, w, h, 0.5, 0.7, 0.28);
  drawLightLeak(ctx, w, h, t);

  // Headline
  const headAlpha = t < 0.08 ? t / 0.08 : t > 0.86 ? (1 - t) / 0.14 : 1;
  const headY = h * 0.12 + (1 - easeOut(Math.min(t / 0.12, 1))) * 30;
  drawText(ctx, opts.headline, w / 2, headY, w * 0.048, '#ffffff', headAlpha, 'bold', w * 0.78);

  if (opts.subtext) {
    const sa = t < 0.12 ? 0 : t < 0.22 ? (t - 0.12) / 0.1 : t > 0.86 ? (1 - t) / 0.14 : 1;
    drawText(ctx, opts.subtext, w / 2, h * 0.84, w * 0.028, 'rgba(255,255,255,0.9)', sa, '500', w * 0.72);
  }

  // Signature
  drawAccentLine(ctx, w * 0.35, h * 0.91, w * 0.65, t, 'rgba(255,255,255,0.3)', 1);
  drawText(ctx, opts.restaurantName, w / 2, h * 0.94, w * 0.02, 'rgba(255,255,255,0.65)', 0.7, '500');

  drawParticles(ctx, w, h, t, 14);

  // CTA
  if (opts.cta && t > 0.78) {
    const ctaA = easeOut((t - 0.78) / 0.14);
    const bw = w * 0.58;
    const bh = w * 0.06;
    drawCTAButton(ctx, opts.cta, (w - bw) / 2, h * 0.73 - bh / 2, bw, bh, ctaA, w * 0.026, 'glass');
  }

  // Film grain for cinema feel
  drawFilmGrain(ctx, w, h, t, 0.025);
};

// ═══ Template 4: Moderno — Bold typography, geometric, high contrast ═══
const templateModerno: TemplateRenderFn = (ctx, images, t, opts, w, h) => {
  const { index, slideT, transitionT } = getSlideIndex(t, images.length);
  const prevIndex = index > 0 ? index - 1 : images.length - 1;

  // Scale zoom transition with subtle Ken Burns
  const kbPan = Math.sin(t * 0.8) * 12;
  if (transitionT < 1) {
    ctx.save();
    const s = 1 + (1 - transitionT) * 0.06;
    ctx.translate(w / 2, h / 2);
    ctx.scale(s, s);
    ctx.translate(-w / 2, -h / 2);
    ctx.globalAlpha = 1 - easeInOutQuart(transitionT);
    drawCover(ctx, images[prevIndex], 0, 0, w, h, 1.03, -kbPan);
    ctx.restore();
  }

  const scale = 0.94 + easeOut(transitionT) * 0.06;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);
  ctx.globalAlpha = easeInOutQuart(transitionT);
  drawCover(ctx, images[index], 0, 0, w, h, 1.03, kbPan);
  ctx.restore();
  ctx.globalAlpha = 1;

  // Geometric accents — top corners
  const accentGrad = ctx.createLinearGradient(0, 0, w * 0.15, 0);
  accentGrad.addColorStop(0, '#e11d48');
  accentGrad.addColorStop(1, '#f97316');
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, h * 0.02, w * 0.12, h * 0.005);
  
  const accentGrad2 = ctx.createLinearGradient(w * 0.88, 0, w, 0);
  accentGrad2.addColorStop(0, '#f97316');
  accentGrad2.addColorStop(1, '#e11d48');
  ctx.fillStyle = accentGrad2;
  ctx.fillRect(w * 0.88, h * 0.02, w * 0.12, h * 0.005);

  // Bottom gradient
  const tGrad = ctx.createLinearGradient(0, h * 0.55, 0, h);
  tGrad.addColorStop(0, 'rgba(0,0,0,0)');
  tGrad.addColorStop(0.3, 'rgba(0,0,0,0.6)');
  tGrad.addColorStop(1, 'rgba(0,0,0,0.92)');
  ctx.fillStyle = tGrad;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);

  // Restaurant name top
  drawText(ctx, opts.restaurantName.toUpperCase(), w / 2, h * 0.055, w * 0.02, 'rgba(255,255,255,0.85)', 0.9, '700', undefined, 'center', true);

  // Headline
  const ha = t < 0.06 ? t / 0.06 : t > 0.88 ? (1 - t) / 0.12 : 1;
  const headSlide = (1 - easeOut(Math.min(t / 0.1, 1))) * 35;
  drawText(ctx, opts.headline.toUpperCase(), w / 2, h * 0.77 + headSlide, w * 0.042, '#ffffff', ha, '900', w * 0.82);

  // Accent under headline
  if (ha > 0.5) {
    drawAccentLine(ctx, w * 0.3, h * 0.82 + headSlide, w * 0.7, t * 1.2, '#e11d48', 2.5);
  }

  if (opts.subtext) {
    const sa = t < 0.15 ? 0 : t < 0.25 ? (t - 0.15) / 0.1 : t > 0.88 ? (1 - t) / 0.12 : 1;
    drawText(ctx, opts.subtext, w / 2, h * 0.87, w * 0.026, 'rgba(255,255,255,0.85)', sa, '400', w * 0.78);
  }

  drawLightLeak(ctx, w, h, t);

  // CTA
  if (opts.cta && t > 0.8) {
    const ctaA = easeOut((t - 0.8) / 0.12);
    const bw = w * 0.55;
    const bh = w * 0.065;
    drawCTAButton(ctx, opts.cta.toUpperCase(), (w - bw) / 2, h * 0.68 - bh / 2, bw, bh, ctaA, w * 0.022, 'filled');
  }

  drawFilmGrain(ctx, w, h, t, 0.015);
};

// ═══ Template 5: Minimalista — Clean, refined, editorial ═══
const templateMinimalista: TemplateRenderFn = (ctx, images, t, opts, w, h) => {
  const { index, slideT, transitionT } = getSlideIndex(t, images.length);
  const prevIndex = index > 0 ? index - 1 : images.length - 1;

  // Smooth crossfade with subtle Ken Burns drift
  const driftX = Math.sin(t * 0.6) * 10;
  const driftY = Math.cos(t * 0.4) * 6;
  const zoomCurrent = 1.01 + (1 - easeInOut(transitionT)) * 0.03;
  drawCover(ctx, images[prevIndex], 0, 0, w, h, 1.04, -driftX, -driftY);
  ctx.globalAlpha = easeInOutQuart(transitionT);
  drawCover(ctx, images[index], 0, 0, w, h, zoomCurrent, driftX, driftY);
  ctx.globalAlpha = 1;

  // Soft vignette
  const vignette = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.9);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(0.7, 'rgba(0,0,0,0.15)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  // Headline centered
  const ha = t < 0.08 ? t / 0.08 : t > 0.86 ? (1 - t) / 0.14 : 1;
  const yOff = (1 - easeOut(Math.min(t / 0.15, 1))) * 25;
  drawText(ctx, opts.headline, w / 2, h * 0.47 + yOff, w * 0.048, '#ffffff', ha, '300', w * 0.78);

  // Thin divider line
  if (opts.subtext) {
    const lineAlpha = ha * 0.4;
    ctx.save();
    ctx.globalAlpha = lineAlpha;
    const lineGrad = ctx.createLinearGradient(w * 0.35, 0, w * 0.65, 0);
    lineGrad.addColorStop(0, 'rgba(255,255,255,0)');
    lineGrad.addColorStop(0.2, 'rgba(255,255,255,1)');
    lineGrad.addColorStop(0.8, 'rgba(255,255,255,1)');
    lineGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lineGrad;
    ctx.fillRect(w * 0.35, h * 0.535, w * 0.3, 1);
    ctx.restore();
    
    const sa = t < 0.12 ? 0 : t < 0.22 ? (t - 0.12) / 0.1 : t > 0.86 ? (1 - t) / 0.14 : 1;
    drawText(ctx, opts.subtext, w / 2, h * 0.575, w * 0.024, 'rgba(255,255,255,0.85)', sa, '300', w * 0.68);
  }

  // Restaurant name
  drawText(ctx, opts.restaurantName, w / 2, h * 0.935, w * 0.018, 'rgba(255,255,255,0.5)', 0.6, '400');

  drawParticles(ctx, w, h, t, 10);

  // CTA
  if (opts.cta && t > 0.82) {
    const ctaA = easeOut((t - 0.82) / 0.12);
    const bw = w * 0.48;
    const bh = w * 0.055;
    drawCTAButton(ctx, opts.cta, (w - bw) / 2, h * 0.67 - bh / 2, bw, bh, ctaA, w * 0.022, 'glass');
  }

  drawFilmGrain(ctx, w, h, t, 0.018);
};

const TEMPLATES: Record<string, { name: string; description: string; emoji: string; render: TemplateRenderFn }> = {
  elegante: { name: 'Elegante', description: 'Crossfade cinematográfico com partículas e luz', emoji: '✨', render: templateElegante },
  dinamico: { name: 'Dinâmico', description: 'Transições rápidas, barra moderna, energia', emoji: '⚡', render: templateDinamico },
  kenburns: { name: 'Ken Burns', description: 'Zoom panorâmico, letterbox, cinema', emoji: '🎬', render: templateKenBurns },
  moderno: { name: 'Moderno', description: 'Tipografia bold, geométrico, alto contraste', emoji: '💎', render: templateModerno },
  minimalista: { name: 'Minimalista', description: 'Editorial limpo, vinheta suave, refinado', emoji: '🤍', render: templateMinimalista },
};

export function getTemplateList() {
  return Object.entries(TEMPLATES).map(([id, t]) => ({
    id,
    name: t.name,
    description: t.description,
    emoji: t.emoji,
  }));
}

// Subtitle rendering is now handled by subtitleRenderer.ts

// ─── Main render function ──────────────────────────────────
export async function renderVideo(options: RenderOptions): Promise<Blob> {
  // Cancel any browser speech synthesis to prevent duplicate voices
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }

  const { format, duration, templateId } = options;

  const width = 1080;
  const height = format === 'vertical' ? 1920 : 1080;
  const FPS = 30;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const loadedImages = await Promise.all(options.images.map(loadImage));
  const template = TEMPLATES[templateId] || TEMPLATES.elegante;

  const stream = canvas.captureStream(FPS);

  // ─── Audio setup: music + real TTS narration ───
  let audioCleanup: (() => void) | null = null;
  let musicCtx: { audioCtx: AudioContext; destination: MediaStreamAudioDestinationNode; start: () => void; stop: () => void } | null = null;

  try {
    // First, fetch TTS audio if narration is enabled (we need its duration for ducking)
    let ttsAudioBuffer: AudioBuffer | null = null;
    let ttsDuckingSegments: Array<{ startPercent: number; endPercent: number }> | undefined;

    if (options.enableNarration && options.narrationScript?.fullText) {
      try {
        const { fetchTTSAudio } = await import('./ttsNarrator');
        const tempCtx = new AudioContext({ sampleRate: 44100 });
        const audioData = await fetchTTSAudio(options.narrationScript.fullText);
        ttsAudioBuffer = await tempCtx.decodeAudioData(audioData.slice(0));
        await tempCtx.close();

        // Calculate precise ducking window based on actual TTS audio duration
        const narrationStartPct = 0.06;
        const narrationEndPct = Math.min(narrationStartPct + ttsAudioBuffer.duration / duration, 0.95);
        ttsDuckingSegments = [{ startPercent: narrationStartPct, endPercent: narrationEndPct }];

        // ── CRITICAL: Recalculate subtitle segment timings to match actual audio ──
        // The TTS plays the full text as one continuous track. Each segment's subtitle
        // timing must be proportional to its character count within the audio window.
        const segments = options.narrationScript.segments;
        const totalChars = segments.reduce((sum, s) => sum + s.text.length, 0);
        const audioWindow = narrationEndPct - narrationStartPct;
        let cursor = narrationStartPct;
        for (const seg of segments) {
          const proportion = seg.text.length / totalChars;
          const segDuration = audioWindow * proportion;
          seg.startPercent = cursor;
          seg.endPercent = cursor + segDuration;
          cursor += segDuration;
        }

        console.log(`TTS: audio decoded (${ttsAudioBuffer.duration.toFixed(1)}s), ducking ${(narrationStartPct * 100).toFixed(0)}%-${(narrationEndPct * 100).toFixed(0)}%, segments synced`);
      } catch (e) {
        console.warn('TTS audio failed, rendering with subtitles only:', e);
      }
    }

    // Create music source with precise ducking based on actual TTS duration
    if (options.customMusicUrl) {
      const { createMusicFromUrl } = await import('./audioGenerator');
      musicCtx = await createMusicFromUrl(options.customMusicUrl, duration, ttsDuckingSegments);
    } else {
      const { createAmbientMusic, getThemeForTemplate } = await import('./audioGenerator');
      const resolvedTheme = options.musicTheme || getThemeForTemplate(templateId);
      musicCtx = createAmbientMusic(duration, resolvedTheme, ttsDuckingSegments);
    }

    const audioTrack = musicCtx.destination.stream.getAudioTracks()[0];
    if (audioTrack) {
      stream.addTrack(audioTrack);
    }

    // Schedule the single TTS narration through the music AudioContext
    musicCtx.start();

    if (ttsAudioBuffer) {
      const baseTime = musicCtx.audioCtx.currentTime;
      const source = musicCtx.audioCtx.createBufferSource();
      source.buffer = ttsAudioBuffer;

      // Voice processing chain: gain → compressor → destination
      const ttsGain = musicCtx.audioCtx.createGain();
      ttsGain.gain.value = 1.4; // Voice prominence

      const voiceCompressor = musicCtx.audioCtx.createDynamicsCompressor();
      voiceCompressor.threshold.value = -18;
      voiceCompressor.knee.value = 8;
      voiceCompressor.ratio.value = 3;
      voiceCompressor.attack.value = 0.005;
      voiceCompressor.release.value = 0.15;

      source.connect(ttsGain);
      ttsGain.connect(voiceCompressor);
      voiceCompressor.connect(musicCtx.destination);

      // Smooth voice fade in/out
      ttsGain.gain.setValueAtTime(0, baseTime + 0.06 * duration);
      ttsGain.gain.linearRampToValueAtTime(1.4, baseTime + 0.06 * duration + 0.3);
      const narrationEnd = 0.06 * duration + ttsAudioBuffer.duration;
      if (narrationEnd > 0.8) {
        ttsGain.gain.setValueAtTime(1.4, baseTime + narrationEnd - 0.5);
        ttsGain.gain.linearRampToValueAtTime(0, baseTime + narrationEnd);
      }

      source.start(baseTime + 0.06 * duration);
      console.log(`TTS: single narration scheduled at ${(0.06 * duration).toFixed(1)}s`);
    }

    audioCleanup = () => musicCtx!.stop();
  } catch (e) {
    console.warn('Audio generation failed, rendering without audio:', e);
  }

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : 'video/webm';

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 16_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      audioCleanup?.();
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };

    recorder.onerror = (e) => {
      audioCleanup?.();
      reject(new Error('MediaRecorder error: ' + ((e as any).error?.message || 'unknown')));
    };

    recorder.start(100);

    const totalMs = duration * 1000;
    const startTime = performance.now();
    let lastProgress = 0;

    function renderFrame() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / totalMs, 1);

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      template.render(ctx, loadedImages, t, options, width, height);

      // Render premium animated subtitles + trigger TTS
      if (options.narrationScript && options.narrationScript.segments.length > 0) {
        const subtitleState = getSubtitleState(options.narrationScript.segments, t);
        
        if (subtitleState) {
          drawAnimatedSubtitle(
            ctx,
            subtitleState.segment.text,
            width,
            height,
            subtitleState.progress,
            subtitleState.alpha
          );

        }
      }

      const progress = Math.round(t * 100);
      if (progress !== lastProgress) {
        lastProgress = progress;
        options.onProgress?.(progress);
      }

      if (t >= 1) {
        setTimeout(() => recorder.stop(), 200);
        return;
      }

      requestAnimationFrame(renderFrame);
    }

    renderFrame();
  });
}

// ─── Preview render (single frame) ─────────────────────────
export function renderPreviewFrame(
  canvas: HTMLCanvasElement,
  images: HTMLImageElement[],
  t: number,
  opts: RenderOptions
) {
  const ctx = canvas.getContext('2d');
  if (!ctx || images.length === 0) return;

  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);

  const template = TEMPLATES[opts.templateId] || TEMPLATES.elegante;
  template.render(ctx, images, t, opts, w, h);
}

// ─── Generate thumbnail ───────────────────────────────────
export async function generateThumbnail(options: RenderOptions): Promise<string> {
  const width = 540;
  const height = options.format === 'vertical' ? 960 : 540;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const loadedImages = await Promise.all(options.images.slice(0, 1).map(loadImage));
  const template = TEMPLATES[options.templateId] || TEMPLATES.elegante;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  template.render(ctx, loadedImages, 0.15, options, width, height);

  return canvas.toDataURL('image/jpeg', 0.85);
}
