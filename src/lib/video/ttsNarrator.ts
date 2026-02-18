/**
 * TTS Narrator — fetches real audio from edge function
 * Generates pt-BR voice narration that gets mixed into the video file
 */

import { supabase } from '@/integrations/supabase/client';

export interface NarrationSegment {
  type: string;
  text: string;
  startPercent: number; // 0–1 when to start speaking
  endPercent: number;   // 0–1 when segment ends
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
  if (totalSegments === 0) {
    return { segments: [], fullText: '' };
  }

  // Distribute segments evenly across the timeline with gaps
  const segmentDuration = 0.8 / totalSegments; // 80% of timeline for speech
  const gap = 0.05; // 5% gap between segments
  let currentStart = 0.08; // Start at 8% of timeline

  const segments: NarrationSegment[] = scriptSegments.map((seg) => {
    const start = currentStart;
    const end = Math.min(start + segmentDuration - gap, 0.95);
    currentStart = end + gap;
    return {
      type: seg.type,
      text: seg.text,
      startPercent: start,
      endPercent: end,
    };
  });

  const fullText = scriptSegments.map((s) => s.text).join(' ');
  return { segments, fullText };
}

/**
 * Fetch TTS audio from the edge function (Google Translate TTS — free, no API key)
 * Returns raw MP3 audio as ArrayBuffer ready for Web Audio API decoding
 */
export async function fetchTTSAudio(text: string): Promise<ArrayBuffer> {
  // Use the supabase client's internal URL and key for the edge function call
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
