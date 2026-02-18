/**
 * Client-side video renderer using Canvas API + MediaRecorder
 * Generates WebM videos directly in the browser — no external API costs
 */

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

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
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
  align: CanvasTextAlign = 'center'
) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = color;
  ctx.font = `${font} ${fontSize}px "Inter", "Segoe UI", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';

  if (maxWidth) {
    // Word wrap
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);

    const lineHeight = fontSize * 1.3;
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
  topAlpha: number, bottomAlpha: number
) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, `rgba(0,0,0,${topAlpha})`);
  grad.addColorStop(0.35, 'rgba(0,0,0,0)');
  grad.addColorStop(0.65, 'rgba(0,0,0,0)');
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

// ─── Template definitions ──────────────────────────────────

interface TemplateRenderFn {
  (
    ctx: CanvasRenderingContext2D,
    images: HTMLImageElement[],
    t: number,
    opts: RenderOptions,
    w: number, h: number
  ): void;
}

function getSlideIndex(t: number, count: number): { index: number; slideT: number; transitionT: number } {
  const slideTime = 1 / count;
  const index = Math.min(Math.floor(t / slideTime), count - 1);
  const slideT = (t - index * slideTime) / slideTime;
  const transitionDuration = 0.15;
  const transitionT = slideT < transitionDuration ? slideT / transitionDuration : 1;
  return { index, slideT, transitionT };
}

// Template 1: Elegante — smooth crossfade, centered text
const templateElegante: TemplateRenderFn = (ctx, images, t, opts, w, h) => {
  const { index, transitionT } = getSlideIndex(t, images.length);
  const prevIndex = index > 0 ? index - 1 : images.length - 1;

  // Draw previous image
  if (transitionT < 1) {
    drawCover(ctx, images[prevIndex], 0, 0, w, h);
  }
  // Draw current image with fade
  ctx.globalAlpha = easeInOut(transitionT);
  drawCover(ctx, images[index], 0, 0, w, h);
  ctx.globalAlpha = 1;

  // Gradient overlay
  drawGradientOverlay(ctx, w, h, 0.4, 0.7);

  // Headline — appears in first 30% then stays
  const headlineAlpha = t < 0.05 ? t / 0.05 : t > 0.85 ? (1 - t) / 0.15 : 1;
  const headlineY = h * 0.15 + (1 - easeOut(Math.min(t / 0.1, 1))) * 30;
  drawText(ctx, opts.headline, w / 2, headlineY, w * 0.045, '#ffffff', headlineAlpha, 'bold', w * 0.8);

  // Subtext
  if (opts.subtext) {
    const subAlpha = t < 0.1 ? 0 : t < 0.2 ? (t - 0.1) / 0.1 : t > 0.85 ? (1 - t) / 0.15 : 1;
    drawText(ctx, opts.subtext, w / 2, h * 0.82, w * 0.032, '#ffffff', subAlpha, '500', w * 0.75);
  }

  // Restaurant name — subtle at bottom
  drawText(ctx, opts.restaurantName, w / 2, h * 0.93, w * 0.025, 'rgba(255,255,255,0.7)', 0.8, '600');

  // CTA — last 20%
  if (opts.cta && t > 0.8) {
    const ctaAlpha = easeOut((t - 0.8) / 0.15);
    const ctaY = h * 0.75;
    ctx.save();
    ctx.globalAlpha = ctaAlpha;
    drawRoundedRect(ctx, w * 0.15, ctaY - w * 0.035, w * 0.7, w * 0.07, w * 0.015);
    ctx.fillStyle = '#e11d48';
    ctx.fill();
    drawText(ctx, opts.cta, w / 2, ctaY, w * 0.03, '#ffffff', 1, 'bold');
    ctx.restore();
  }
};

// Template 2: Dinâmico — slide transitions, bottom bar
const templateDinamico: TemplateRenderFn = (ctx, images, t, opts, w, h) => {
  const { index, transitionT } = getSlideIndex(t, images.length);
  const prevIndex = index > 0 ? index - 1 : images.length - 1;

  // Slide transition
  const offset = (1 - easeInOut(transitionT)) * w;
  if (transitionT < 1) {
    ctx.save();
    ctx.translate(-offset * 0.3, 0);
    drawCover(ctx, images[prevIndex], 0, 0, w, h);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(transitionT < 1 ? w - offset : 0, 0);
  drawCover(ctx, images[index], 0, 0, w, h);
  ctx.restore();

  // Bottom bar
  const barH = h * 0.22;
  const barGrad = ctx.createLinearGradient(0, h - barH, 0, h);
  barGrad.addColorStop(0, 'rgba(0,0,0,0)');
  barGrad.addColorStop(0.3, 'rgba(0,0,0,0.85)');
  barGrad.addColorStop(1, 'rgba(0,0,0,0.95)');
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, h - barH, w, barH);

  // Headline from bottom
  const headlineAlpha = t < 0.08 ? t / 0.08 : 1;
  const slideUp = (1 - easeOut(Math.min(t / 0.12, 1))) * 40;
  drawText(ctx, opts.headline, w * 0.08, h - barH * 0.55 + slideUp, w * 0.042, '#ffffff', headlineAlpha, 'bold', w * 0.84, 'left');

  if (opts.subtext) {
    const subAlpha = t < 0.15 ? 0 : t < 0.25 ? (t - 0.15) / 0.1 : 1;
    drawText(ctx, opts.subtext, w * 0.08, h - barH * 0.25, w * 0.028, 'rgba(255,255,255,0.8)', subAlpha, '400', w * 0.84, 'left');
  }

  // Top accent line
  ctx.fillStyle = '#e11d48';
  ctx.fillRect(0, 0, w, h * 0.005);

  // Restaurant name top-left
  drawText(ctx, opts.restaurantName, w * 0.08, h * 0.05, w * 0.028, '#ffffff', 0.9, '700', undefined, 'left');

  // CTA
  if (opts.cta && t > 0.75) {
    const ctaAlpha = easeOut((t - 0.75) / 0.15);
    ctx.save();
    ctx.globalAlpha = ctaAlpha;
    const ctaW = w * 0.55;
    const ctaH = w * 0.065;
    const ctaX = w * 0.08;
    const ctaY = h - barH * 0.55;
    drawRoundedRect(ctx, ctaX, ctaY - ctaH / 2, ctaW, ctaH, ctaH / 2);
    ctx.fillStyle = '#e11d48';
    ctx.fill();
    drawText(ctx, opts.cta, ctaX + ctaW / 2, ctaY, w * 0.026, '#ffffff', 1, 'bold');
    ctx.restore();
  }
};

// Template 3: Ken Burns — slow zoom/pan
const templateKenBurns: TemplateRenderFn = (ctx, images, t, opts, w, h) => {
  const { index, slideT } = getSlideIndex(t, images.length);
  const prevIndex = index > 0 ? index - 1 : images.length - 1;

  // Ken Burns effect: slow zoom + pan
  const zoomStart = 1.0;
  const zoomEnd = 1.18;
  const directions = [
    { px: -30, py: -20 }, { px: 30, py: -15 },
    { px: -20, py: 25 }, { px: 25, py: 20 },
    { px: -15, py: -30 }, { px: 30, py: 10 },
    { px: -25, py: 15 }, { px: 20, py: -25 },
  ];

  const transThreshold = 0.12;
  if (slideT < transThreshold && index > 0) {
    const fadeT = slideT / transThreshold;
    const prevDir = directions[prevIndex % directions.length];
    drawCover(ctx, images[prevIndex], 0, 0, w, h, zoomEnd, prevDir.px, prevDir.py);
    ctx.globalAlpha = easeInOut(fadeT);
  }

  const dir = directions[index % directions.length];
  const zoom = zoomStart + (zoomEnd - zoomStart) * slideT;
  const px = dir.px * slideT;
  const py = dir.py * slideT;
  drawCover(ctx, images[index], 0, 0, w, h, zoom, px, py);
  ctx.globalAlpha = 1;

  // Cinematic bars
  drawGradientOverlay(ctx, w, h, 0.5, 0.65);

  // Headline
  const headAlpha = t < 0.08 ? t / 0.08 : t > 0.88 ? (1 - t) / 0.12 : 1;
  drawText(ctx, opts.headline, w / 2, h * 0.12, w * 0.048, '#ffffff', headAlpha, 'bold', w * 0.8);

  // Subtext
  if (opts.subtext) {
    const sa = t < 0.12 ? 0 : t < 0.22 ? (t - 0.12) / 0.1 : t > 0.88 ? (1 - t) / 0.12 : 1;
    drawText(ctx, opts.subtext, w / 2, h * 0.85, w * 0.03, '#ffffff', sa, '500', w * 0.75);
  }

  // Restaurant signature line
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.3, h * 0.92);
  ctx.lineTo(w * 0.7, h * 0.92);
  ctx.stroke();
  ctx.restore();
  drawText(ctx, opts.restaurantName, w / 2, h * 0.95, w * 0.022, 'rgba(255,255,255,0.7)', 0.7, '500');

  // CTA
  if (opts.cta && t > 0.78) {
    const ctaA = easeOut((t - 0.78) / 0.12);
    const ctaY = h * 0.72;
    ctx.save();
    ctx.globalAlpha = ctaA;
    drawRoundedRect(ctx, w * 0.18, ctaY - w * 0.03, w * 0.64, w * 0.06, w * 0.01);
    ctx.fillStyle = 'rgba(225,29,72,0.9)';
    ctx.fill();
    drawText(ctx, opts.cta, w / 2, ctaY, w * 0.028, '#ffffff', 1, 'bold');
    ctx.restore();
  }
};

// Template 4: Moderno — zoom scale transitions, geometric
const templateModerno: TemplateRenderFn = (ctx, images, t, opts, w, h) => {
  const { index, transitionT } = getSlideIndex(t, images.length);
  const prevIndex = index > 0 ? index - 1 : images.length - 1;

  // Scale zoom transition
  if (transitionT < 1) {
    ctx.save();
    const s = 1 + (1 - transitionT) * 0.05;
    ctx.translate(w / 2, h / 2);
    ctx.scale(s, s);
    ctx.translate(-w / 2, -h / 2);
    ctx.globalAlpha = 1 - easeInOut(transitionT);
    drawCover(ctx, images[prevIndex], 0, 0, w, h);
    ctx.restore();
  }

  const scale = 0.95 + easeOut(transitionT) * 0.05;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-w / 2, -h / 2);
  ctx.globalAlpha = easeInOut(transitionT);
  drawCover(ctx, images[index], 0, 0, w, h);
  ctx.restore();
  ctx.globalAlpha = 1;

  // Geometric accent
  ctx.save();
  ctx.fillStyle = 'rgba(225,29,72,0.85)';
  ctx.fillRect(0, h * 0.02, w * 0.12, h * 0.005);
  ctx.fillRect(w * 0.88, h * 0.02, w * 0.12, h * 0.005);
  ctx.restore();

  // Gradient for text area
  const tGrad = ctx.createLinearGradient(0, h * 0.6, 0, h);
  tGrad.addColorStop(0, 'rgba(0,0,0,0)');
  tGrad.addColorStop(0.4, 'rgba(0,0,0,0.7)');
  tGrad.addColorStop(1, 'rgba(0,0,0,0.9)');
  ctx.fillStyle = tGrad;
  ctx.fillRect(0, h * 0.6, w, h * 0.4);

  // Headline
  const ha = t < 0.06 ? t / 0.06 : t > 0.9 ? (1 - t) / 0.1 : 1;
  drawText(ctx, opts.headline.toUpperCase(), w / 2, h * 0.78, w * 0.04, '#ffffff', ha, '900', w * 0.85);

  if (opts.subtext) {
    const sa = t < 0.15 ? 0 : t < 0.25 ? (t - 0.15) / 0.1 : t > 0.9 ? (1 - t) / 0.1 : 1;
    drawText(ctx, opts.subtext, w / 2, h * 0.86, w * 0.028, 'rgba(255,255,255,0.85)', sa, '400', w * 0.8);
  }

  // Restaurant name
  drawText(ctx, opts.restaurantName.toUpperCase(), w / 2, h * 0.05, w * 0.022, 'rgba(255,255,255,0.9)', 0.9, '700');

  // CTA
  if (opts.cta && t > 0.8) {
    const ctaA = easeOut((t - 0.8) / 0.12);
    ctx.save();
    ctx.globalAlpha = ctaA;
    const bw = w * 0.6;
    const bh = w * 0.07;
    const bx = (w - bw) / 2;
    const by = h * 0.7 - bh / 2;
    drawRoundedRect(ctx, bx, by, bw, bh, bh / 2);
    ctx.fillStyle = '#e11d48';
    ctx.fill();
    drawText(ctx, opts.cta.toUpperCase(), w / 2, h * 0.7, w * 0.025, '#ffffff', 1, '800');
    ctx.restore();
  }
};

// Template 5: Minimalista — clean crossfade, minimal text
const templateMinimalista: TemplateRenderFn = (ctx, images, t, opts, w, h) => {
  const { index, transitionT } = getSlideIndex(t, images.length);
  const prevIndex = index > 0 ? index - 1 : images.length - 1;

  // Simple crossfade
  drawCover(ctx, images[prevIndex], 0, 0, w, h);
  ctx.globalAlpha = easeInOut(transitionT);
  drawCover(ctx, images[index], 0, 0, w, h);
  ctx.globalAlpha = 1;

  // Subtle vignette
  const vignette = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.9);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  // Headline — center, clean
  const ha = t < 0.08 ? t / 0.08 : t > 0.88 ? (1 - t) / 0.12 : 1;
  const yOff = (1 - easeOut(Math.min(t / 0.15, 1))) * 20;
  drawText(ctx, opts.headline, w / 2, h * 0.48 + yOff, w * 0.05, '#ffffff', ha, '300', w * 0.8);

  // Thin divider
  if (opts.subtext) {
    ctx.save();
    ctx.globalAlpha = ha * 0.4;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(w * 0.4, h * 0.54, w * 0.2, 1);
    ctx.restore();
    const sa = t < 0.12 ? 0 : t < 0.22 ? (t - 0.12) / 0.1 : t > 0.88 ? (1 - t) / 0.12 : 1;
    drawText(ctx, opts.subtext, w / 2, h * 0.58, w * 0.025, 'rgba(255,255,255,0.85)', sa, '300', w * 0.7);
  }

  // Restaurant name
  drawText(ctx, opts.restaurantName, w / 2, h * 0.93, w * 0.02, 'rgba(255,255,255,0.5)', 0.6, '400');

  // CTA
  if (opts.cta && t > 0.82) {
    const ctaA = easeOut((t - 0.82) / 0.12);
    ctx.save();
    ctx.globalAlpha = ctaA;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    const bw = w * 0.5;
    const bh = w * 0.06;
    drawRoundedRect(ctx, (w - bw) / 2, h * 0.68 - bh / 2, bw, bh, bh / 2);
    ctx.stroke();
    drawText(ctx, opts.cta, w / 2, h * 0.68, w * 0.024, '#ffffff', 1, '400');
    ctx.restore();
  }
};

const TEMPLATES: Record<string, { name: string; description: string; render: TemplateRenderFn }> = {
  elegante: { name: 'Elegante', description: 'Fade suave, texto centralizado', render: templateElegante },
  dinamico: { name: 'Dinâmico', description: 'Transições deslizantes, barra inferior', render: templateDinamico },
  kenburns: { name: 'Ken Burns', description: 'Zoom lento panorâmico, cinema', render: templateKenBurns },
  moderno: { name: 'Moderno', description: 'Zoom geométrico, texto bold', render: templateModerno },
  minimalista: { name: 'Minimalista', description: 'Crossfade limpo, tipografia clean', render: templateMinimalista },
};

export function getTemplateList() {
  return Object.entries(TEMPLATES).map(([id, t]) => ({
    id,
    name: t.name,
    description: t.description,
  }));
}

// ─── Main render function ──────────────────────────────────
export async function renderVideo(options: RenderOptions): Promise<Blob> {
  const { format, duration, templateId } = options;

  const width = 1080;
  const height = format === 'vertical' ? 1920 : 1080;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Load all images
  const loadedImages = await Promise.all(options.images.map(loadImage));

  // Determine template
  const template = TEMPLATES[templateId] || TEMPLATES.elegante;

  // Setup MediaRecorder
  const stream = canvas.captureStream(30);

  // Check supported mimeTypes
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
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
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };

    recorder.onerror = (e) => {
      reject(new Error('MediaRecorder error: ' + (e as any).error?.message || 'unknown'));
    };

    recorder.start(100); // Collect data every 100ms

    const totalMs = duration * 1000;
    const startTime = performance.now();
    let lastProgress = 0;

    function renderFrame() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / totalMs, 1);

      // Clear
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // Render template
      template.render(ctx, loadedImages, t, options, width, height);

      // Progress callback
      const progress = Math.round(t * 100);
      if (progress !== lastProgress) {
        lastProgress = progress;
        options.onProgress?.(progress);
      }

      if (t >= 1) {
        // Render a few more frames to ensure recorder captures the last frame
        setTimeout(() => {
          recorder.stop();
        }, 200);
        return;
      }

      requestAnimationFrame(renderFrame);
    }

    renderFrame();
  });
}

// ─── Generate thumbnail from first frame ───────────────────
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
