/**
 * TTS Narrator — fetches audio SEGMENT BY SEGMENT for perfect subtitle sync
 * Each segment gets its own audio buffer, played at the exact subtitle time
 */

import { supabase } from '@/integrations/supabase/client';

export interface NarrationSegment {
  type: string;
  text: string;
  startPercent: number;
  endPercent: number;
}

export interface NarrationScript {
  segments: NarrationSegment[];
  fullText: string;
}

/**
 * Convert AI-generated script segments into timed narration segments
 */
export function buildNarrationTimeline(
  scriptSegments: Array<{ type: string; text: string; duration_hint: string }>,
  durationSeconds: number
): NarrationScript {
  const totalSegments = scriptSegments.length;
  if (totalSegments === 0) return { segments: [], fullText: '' };

  const segmentDuration = 0.8 / totalSegments;
  const gap = 0.05;
  let currentStart = 0.08;

  const segments: NarrationSegment[] = scriptSegments.map((seg) => {
    const start = currentStart;
    const end = Math.min(start + segmentDuration - gap, 0.95);
    currentStart = end + gap;
    return { type: seg.type, text: seg.text, startPercent: start, endPercent: end };
  });

  const fullText = scriptSegments.map((s) => s.text).join(' ');
  return { segments, fullText };
}

/**
 * Fetch TTS audio for each segment individually.
 * Returns an array of ArrayBuffers, one per segment.
 */
export async function fetchTTSSegments(segments: NarrationSegment[]): Promise<(ArrayBuffer | null)[]> {
  const supabaseUrl = (supabase as any).supabaseUrl as string;
  const supabaseKey = (supabase as any).supabaseKey as string;

  const segmentTexts = segments.map(s => s.text);

  const response = await fetch(`${supabaseUrl}/functions/v1/text-to-speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
    },
    body: JSON.stringify({ segments: segmentTexts, lang: 'pt-BR' }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'Unknown error');
    throw new Error(`TTS segments failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const segmentAudios: (ArrayBuffer | null)[] = new Array(segments.length).fill(null);

  for (const item of data.segmentAudios) {
    const binary = atob(item.audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    segmentAudios[item.index] = bytes.buffer;
  }

  return segmentAudios;
}

/**
 * Legacy: Fetch full text as one audio (kept for compatibility)
 */
export async function fetchTTSAudio(text: string): Promise<ArrayBuffer> {
  const supabaseUrl = (supabase as any).supabaseUrl as string;
  const supabaseKey = (supabase as any).supabaseKey as string;

  const response = await fetch(`${supabaseUrl}/functions/v1/text-to-speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
    },
    body: JSON.stringify({ text, lang: 'pt-BR' }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`TTS failed (${response.status}): ${errorText}`);
  }

  return response.arrayBuffer();
}
