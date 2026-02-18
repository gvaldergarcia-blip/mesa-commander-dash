/**
 * Text-to-Speech Edge Function
 * Uses Google Translate TTS (free, no API key required)
 * Returns raw MP3 audio bytes
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, lang = 'pt-BR' } = await req.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const chunks = splitTextIntoChunks(text.trim(), 180);
    const audioChunks: Uint8Array[] = [];

    for (const chunk of chunks) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(lang)}&client=tw-ob&q=${encodeURIComponent(chunk)}`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://translate.google.com/',
        },
      });

      if (!res.ok) {
        console.error(`TTS chunk failed: ${res.status} for "${chunk.substring(0, 40)}..."`);
        continue;
      }

      const ab = await res.arrayBuffer();
      if (ab.byteLength > 0) {
        audioChunks.push(new Uint8Array(ab));
      }
    }

    if (audioChunks.length === 0) {
      return new Response(JSON.stringify({ error: 'Failed to generate audio' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Concatenate MP3 chunks
    const totalLen = audioChunks.reduce((s, c) => s + c.length, 0);
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of audioChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return new Response(combined.buffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(totalLen),
      },
    });
  } catch (err) {
    console.error('TTS error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function splitTextIntoChunks(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length + 1 > maxLen && current.length > 0) {
      chunks.push(current.trim());
      current = trimmed;
    } else {
      current += (current ? ' ' : '') + trimmed;
    }
  }

  if (current.trim()) {
    if (current.length > maxLen) {
      const words = current.split(' ');
      let wordChunk = '';
      for (const word of words) {
        if (wordChunk.length + word.length + 1 > maxLen && wordChunk.length > 0) {
          chunks.push(wordChunk.trim());
          wordChunk = word;
        } else {
          wordChunk += (wordChunk ? ' ' : '') + word;
        }
      }
      if (wordChunk.trim()) chunks.push(wordChunk.trim());
    } else {
      chunks.push(current.trim());
    }
  }

  return chunks;
}
