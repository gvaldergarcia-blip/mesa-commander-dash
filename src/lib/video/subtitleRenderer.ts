/**
 * Premium Subtitle Renderer for Marketing Videos
 * Cinematic word-by-word karaoke-style animated subtitles
 * Glassmorphism bar with progressive reveal
 */

import type { NarrationSegment } from './ttsNarrator';

interface SubtitleStyle {
  barColor: string;
  barBorder: string;
  textColor: string;
  highlightColor: string;
  fontSize: number;
  fontWeight: string;
  barHeight: number;
  barY: number;
  barPadX: number;
  borderRadius: number;
  shadowBlur: number;
}

function getSubtitleStyle(w: number, h: number): SubtitleStyle {
  return {
    barColor: 'rgba(0,0,0,0.6)',
    barBorder: 'rgba(255,255,255,0.12)',
    textColor: 'rgba(255,255,255,0.65)',
    highlightColor: '#ffffff',
    fontSize: Math.round(w * 0.03),
    fontWeight: '500',
    barHeight: Math.round(h * 0.075),
    barY: Math.round(h * 0.83),
    barPadX: Math.round(w * 0.07),
    borderRadius: Math.round(h * 0.025),
    shadowBlur: 6,
  };
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

/**
 * Render a premium animated subtitle with word-by-word reveal
 */
export function drawAnimatedSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  w: number,
  h: number,
  segmentProgress: number, // 0–1 progress within this segment
  barAlpha: number // overall fade alpha
) {
  if (!text || barAlpha <= 0) return;

  const style = getSubtitleStyle(w, h);
  const words = text.split(' ');
  const totalWords = words.length;

  ctx.save();
  ctx.globalAlpha = Math.min(1, barAlpha);

  // ─── Glassmorphism bar ───
  const barW = w - style.barPadX * 2;
  drawRoundedRect(ctx, style.barPadX, style.barY, barW, style.barHeight, style.borderRadius);

  // Frosted glass fill
  ctx.fillStyle = style.barColor;
  ctx.fill();

  // Subtle inner glow at top
  const innerGlow = ctx.createLinearGradient(0, style.barY, 0, style.barY + style.barHeight * 0.4);
  innerGlow.addColorStop(0, 'rgba(255,255,255,0.06)');
  innerGlow.addColorStop(1, 'rgba(255,255,255,0)');
  drawRoundedRect(ctx, style.barPadX, style.barY, barW, style.barHeight, style.borderRadius);
  ctx.fillStyle = innerGlow;
  ctx.fill();

  // Border
  drawRoundedRect(ctx, style.barPadX, style.barY, barW, style.barHeight, style.borderRadius);
  ctx.strokeStyle = style.barBorder;
  ctx.lineWidth = 1;
  ctx.stroke();

  // ─── Word-by-word text rendering ───
  ctx.font = `${style.fontWeight} ${style.fontSize}px "Inter", "Segoe UI", system-ui, sans-serif`;
  ctx.textBaseline = 'middle';

  // Measure words for layout
  const spaceWidth = ctx.measureText(' ').width;
  const wordWidths = words.map(word => ctx.measureText(word).width);

  // Line-wrap into lines
  const maxTextW = barW * 0.88;
  const lines: { words: string[]; widths: number[]; startIdx: number }[] = [];
  let currentLine: string[] = [];
  let currentWidths: number[] = [];
  let currentWidth = 0;
  let lineStartIdx = 0;

  for (let i = 0; i < words.length; i++) {
    const wordW = wordWidths[i];
    if (currentLine.length > 0 && currentWidth + spaceWidth + wordW > maxTextW) {
      lines.push({ words: currentLine, widths: currentWidths, startIdx: lineStartIdx });
      currentLine = [words[i]];
      currentWidths = [wordW];
      currentWidth = wordW;
      lineStartIdx = i;
    } else {
      currentLine.push(words[i]);
      currentWidths.push(wordW);
      currentWidth += (currentLine.length > 1 ? spaceWidth : 0) + wordW;
    }
  }
  if (currentLine.length > 0) {
    lines.push({ words: currentLine, widths: currentWidths, startIdx: lineStartIdx });
  }

  const lineH = style.fontSize * 1.35;
  const totalTextH = lines.length * lineH;
  const textStartY = style.barY + (style.barHeight - totalTextH) / 2 + lineH / 2;

  // How many words have been "revealed"
  const revealedCount = Math.floor(segmentProgress * totalWords) + 1;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineY = textStartY + lineIdx * lineH;

    // Center each line
    let lineWidth = 0;
    for (let i = 0; i < line.words.length; i++) {
      lineWidth += line.widths[i] + (i > 0 ? spaceWidth : 0);
    }
    let x = w / 2 - lineWidth / 2;

    for (let i = 0; i < line.words.length; i++) {
      const globalIdx = line.startIdx + i;
      const isRevealed = globalIdx < revealedCount;

      // Word color: revealed = bright white, unrevealed = dim
      ctx.fillStyle = isRevealed ? style.highlightColor : style.textColor;

      // Subtle shadow on revealed words
      if (isRevealed) {
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = style.shadowBlur;
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      ctx.textAlign = 'left';
      ctx.fillText(line.words[i], x, lineY);
      x += line.widths[i] + spaceWidth;
    }
  }

  // ─── Progress indicator (thin line at bottom of bar) ───
  const progressW = barW * 0.92;
  const progressX = style.barPadX + (barW - progressW) / 2;
  const progressY = style.barY + style.barHeight - 4;
  
  // Track background
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(progressX, progressY, progressW, 2);
  
  // Progress fill
  const progGrad = ctx.createLinearGradient(progressX, 0, progressX + progressW * segmentProgress, 0);
  progGrad.addColorStop(0, 'rgba(255,255,255,0.3)');
  progGrad.addColorStop(1, 'rgba(255,255,255,0.5)');
  ctx.fillStyle = progGrad;
  ctx.fillRect(progressX, progressY, progressW * segmentProgress, 2);

  ctx.restore();
}

/**
 * Find the active narration segment at timeline position t (0–1)
 * and compute segment-local progress + fade alpha
 */
export function getSubtitleState(
  segments: NarrationSegment[],
  t: number
): { segment: NarrationSegment; progress: number; alpha: number } | null {
  const active = segments.find(s => t >= s.startPercent && t <= s.endPercent);
  if (!active) return null;

  const segDuration = active.endPercent - active.startPercent;
  const segProgress = (t - active.startPercent) / segDuration;

  // Smooth fade in/out (0.12 = 12% of segment duration for fade)
  const fadeIn = Math.min(segProgress / 0.12, 1);
  const fadeOut = Math.min((1 - segProgress) / 0.12, 1);
  const alpha = Math.min(fadeIn, fadeOut);

  return { segment: active, progress: segProgress, alpha };
}
