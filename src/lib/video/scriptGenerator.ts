/**
 * Script/Narration generator for slideshow videos
 * Generates a timed script based on form data for display and subtitles
 */

export interface ScriptSegment {
  startPercent: number;  // 0–1 timeline position
  endPercent: number;
  text: string;
  type: 'intro' | 'headline' | 'subtext' | 'cta' | 'outro';
}

export interface VideoScript {
  segments: ScriptSegment[];
  fullText: string;
}

export function generateScript(params: {
  headline: string;
  subtext?: string;
  cta?: string;
  restaurantName: string;
  duration: number;
}): VideoScript {
  const { headline, subtext, cta, restaurantName } = params;
  const segments: ScriptSegment[] = [];

  // Intro: restaurant name (0% – 15%)
  segments.push({
    startPercent: 0.02,
    endPercent: 0.15,
    text: restaurantName,
    type: 'intro',
  });

  // Headline (18% – 50%)
  segments.push({
    startPercent: 0.18,
    endPercent: 0.50,
    text: headline,
    type: 'headline',
  });

  // Subtext (52% – 72%)
  if (subtext) {
    segments.push({
      startPercent: 0.52,
      endPercent: 0.72,
      text: subtext,
      type: 'subtext',
    });
  }

  // CTA (78% – 92%)
  if (cta) {
    segments.push({
      startPercent: 0.78,
      endPercent: 0.92,
      text: cta,
      type: 'cta',
    });
  }

  // Outro (93% – 99%)
  segments.push({
    startPercent: 0.93,
    endPercent: 0.99,
    text: restaurantName,
    type: 'outro',
  });

  const fullText = segments.map((s) => s.text).join(' · ');

  return { segments, fullText };
}

/**
 * Get the active segment for a given timeline position (0–1)
 */
export function getActiveSegment(script: VideoScript, t: number): ScriptSegment | null {
  return script.segments.find((s) => t >= s.startPercent && t <= s.endPercent) || null;
}
