// Outbound provider calls (OpenAI, YouTube Data API, remove.bg).
// All calls have a 10 s timeout. No secrets are ever logged.
import { fetchWithTimeout } from './validate.js';
import { warn } from './logger.js';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

export async function openaiChat(messages, { model = 'gpt-4o-mini', maxTokens = 1200 } = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetchWithTimeout(
    OPENAI_CHAT_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.8 }),
    },
    10_000,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    warn('openai chat call failed', { status: res.status, body: text.slice(0, 200) });
    throw new Error(`OpenAI request failed with status ${res.status}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

export function parseIdeasJson(text, topic) {
  try {
    const parsed = JSON.parse(text);
    const arr = Array.isArray(parsed) ? parsed : parsed.ideas;
    if (Array.isArray(arr)) {
      return arr
        .filter((i) => i && typeof i.title === 'string')
        .slice(0, 5)
        .map((i) => ({ title: i.title, hook: String(i.hook || '') }));
    }
  } catch {
    // fall through to line parsing
  }
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*[-*\d.)\s]+/, '').trim())
    .filter((l) => l.length > 5)
    .slice(0, 5)
    .map((title) => ({ title, hook: `Why ${topic} matters — explained.` }));
}

// YouTube returns titles with HTML entities (e.g. You&#39;re). Decode the
// common ones so results read naturally instead of showing raw entities.
function decodeHtml(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/&#(\d+);/g, (_m, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// --- Free built-in providers (no API key needed) ---
// Muse has no API key to paste into Railway, so the studio uses free
// no-key services as its default providers. They were verified live
// (Nov 2026): Pollinations text + image, Google Translate TTS.
// Paid keys, when set, always win over the free providers.
const POLLINATIONS_TEXT_URL = 'https://text.pollinations.ai/';
const POLLINATIONS_IMAGE_URL = 'https://image.pollinations.ai/prompt/';
const GOOGLE_TTS_URL = 'https://translate.google.com/translate_tts';

// Free text chat (Pollinations). POST with OpenAI-style messages.
// Slow on a cold start (~20 s), so callers use a 60 s timeout and fall
// back to templates on failure. Retries once on 5xx — the free service
// 503s under load fairly often.
export async function freeChat(messages) {
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(
        POLLINATIONS_TEXT_URL,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages }),
        },
        60_000,
      );
      if (!res.ok) {
        throw new Error(`Free text provider failed with status ${res.status}`);
      }
      const text = (await res.text()).trim();
      if (!text) throw new Error('Free text provider returned no text');
      return text;
    } catch (err) {
      lastErr = err;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw lastErr;
}

// Text generation: paid OpenAI key first, free provider otherwise.
export async function aiChat(messages, opts) {
  if (process.env.OPENAI_API_KEY) return openaiChat(messages, opts);
  return freeChat(messages);
}

// Free image generation (Pollinations). Returns a data URL so the
// thumbnail canvas editor never hits cross-origin issues. Tries the
// flux model first, then the faster turbo model if flux 503s.
export async function freeImage(prompt) {
  const seed = Math.floor(Math.random() * 1_000_000);
  let lastErr = null;
  for (const model of ['flux', 'turbo']) {
    try {
      const url =
        `${POLLINATIONS_IMAGE_URL}${encodeURIComponent(prompt)}` +
        `?width=1280&height=720&model=${model}&nologo=true&seed=${seed}`;
      const res = await fetchWithTimeout(url, {}, 90_000);
      if (!res.ok) {
        throw new Error(`Free image provider failed with status ${res.status}`);
      }
      const type = res.headers.get('content-type') || 'image/jpeg';
      if (!type.startsWith('image/')) {
        throw new Error('Free image provider returned no image');
      }
      const buf = Buffer.from(await res.arrayBuffer());
      return { imageUrl: `data:${type};base64,${buf.toString('base64')}` };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

// Image generation: paid OpenAI key first, free provider otherwise.
export async function generateImage(prompt) {
  if (process.env.IMAGE_API_KEY) return openaiImage(prompt);
  return freeImage(prompt);
}

// Free narration (Google Translate TTS, no key). Splits text into
// ~180-char chunks (the endpoint's per-request limit) and concatenates
// the MP3 frames; ffmpeg re-encodes on mux, so frame boundaries are fine.
const TTS_LANG = { en: 'en', ur: 'ur', 'roman-ur': 'ur' };

function ttsChunks(text, maxLen = 180) {
  const sentences = String(text).split(/(?<=[.!?])\s+/);
  const chunks = [];
  let current = '';
  const pushWords = (piece) => {
    for (const word of piece.split(/\s+/).filter(Boolean)) {
      if ((current + ' ' + word).trim().length > maxLen && current) {
        chunks.push(current.trim());
        current = word;
      } else {
        current = (current + ' ' + word).trim();
      }
    }
  };
  for (const s of sentences) {
    if ((current + ' ' + s).trim().length > maxLen && current) {
      chunks.push(current.trim());
      current = '';
    }
    pushWords(s);
  }
  if (current) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

export async function freeTtsAudio(text, language = 'en') {
  const tl = TTS_LANG[language] || 'en';
  const chunks = ttsChunks(String(text || '').replace(/\s+/g, ' ').trim()).slice(0, 40);
  if (!chunks.length) throw new Error('Nothing to narrate');
  const parts = [];
  for (const chunk of chunks) {
    const url =
      `${GOOGLE_TTS_URL}?ie=UTF-8&client=gtx&tl=${tl}` +
      `&q=${encodeURIComponent(chunk)}&total=1&idx=0&textlen=${chunk.length}`;
    const res = await fetchWithTimeout(
      url,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
      15_000,
    );
    if (!res.ok) {
      throw new Error(`Free TTS failed with status ${res.status}`);
    }
    parts.push(Buffer.from(await res.arrayBuffer()));
  }
  return Buffer.concat(parts);
}

export async function youtubeSearch(query, maxResults = 5) {
  const key = process.env.YOUTUBE_API_KEY;
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('type', 'video');
  searchUrl.searchParams.set('order', 'relevance');
  searchUrl.searchParams.set('maxResults', String(maxResults));
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('key', key);
  const searchRes = await fetchWithTimeout(searchUrl.toString(), {}, 10_000);
  if (!searchRes.ok) {
    throw new Error(`YouTube search failed with status ${searchRes.status}`);
  }
  const searchData = await searchRes.json();
  const items = searchData.items || [];
  const ids = items.map((i) => i.id?.videoId).filter(Boolean);
  let views = {};
  if (ids.length) {
    const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    videosUrl.searchParams.set('part', 'statistics');
    videosUrl.searchParams.set('id', ids.join(','));
    videosUrl.searchParams.set('key', key);
    const vRes = await fetchWithTimeout(videosUrl.toString(), {}, 10_000);
    if (vRes.ok) {
      const vData = await vRes.json();
      for (const v of vData.items || []) {
        views[v.id] = Number(v.statistics?.viewCount || 0);
      }
    }
  }
  return items.map((i) => ({
    videoId: i.id.videoId,
    title: decodeHtml(i.snippet.title),
    channelTitle: decodeHtml(i.snippet.channelTitle),
    channelId: i.snippet.channelId,
    thumbnail: i.snippet.thumbnails?.medium?.url || i.snippet.thumbnails?.default?.url || '',
    views: views[i.id.videoId] ?? null,
    publishedAt: i.snippet.publishedAt,
    url: `https://www.youtube.com/watch?v=${i.id.videoId}`,
  }));
}

export async function openaiImage(prompt) {
  const key = process.env.IMAGE_API_KEY;
  const res = await fetchWithTimeout(
    'https://api.openai.com/v1/images/generations',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1024', n: 1 }),
    },
    10_000,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    warn('openai image call failed', { status: res.status, body: text.slice(0, 200) });
    throw new Error(`Image generation failed with status ${res.status}`);
  }
  const data = await res.json();
  const item = data?.data?.[0];
  if (item?.url) return { imageUrl: item.url };
  if (item?.b64_json) return { imageUrl: `data:image/png;base64,${item.b64_json}` };
  throw new Error('Image generation returned no image');
}

export async function removeBg(imageDataUrl) {
  const key = process.env.BGREMOVE_API_KEY;
  const res = await fetchWithTimeout(
    'https://api.remove.bg/v1.0/removebg',
    {
      method: 'POST',
      headers: { 'X-Api-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_file_b64: imageDataUrl.split(',')[1] || imageDataUrl, size: 'auto' }),
    },
    10_000,
  );
  if (!res.ok) {
    throw new Error(`Background removal failed with status ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { imageUrl: `data:image/png;base64,${buf.toString('base64')}` };
}

// --- Transcript fetching (legitimate methods only) ---
// For a YouTube URL we try the public timedtext caption tracks listed on
// the watch page. For any other URL, or if no captions exist, we give up
// and the caller returns 422 — we never fabricate a transcript.
export function extractYouTubeId(url) {
  const m = String(url).match(
    /(?:youtube\.com\/(?:watch\?[^#]*v=|shorts\/|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return m ? m[1] : null;
}

export async function fetchYouTubeTranscript(url) {
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;
  const pageRes = await fetchWithTimeout(
    `https://www.youtube.com/watch?v=${videoId}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } },
    10_000,
  );
  if (!pageRes.ok) return null;
  const html = await pageRes.text();
  const m = html.match(/"captionTracks":(\[.*?\])/);
  if (!m) return null;
  let tracks;
  try {
    tracks = JSON.parse(m[1]);
  } catch {
    return null;
  }
  const track = tracks.find((t) => t.languageCode?.startsWith('en')) || tracks[0];
  if (!track?.baseUrl) return null;
  const capRes = await fetchWithTimeout(`${track.baseUrl}&fmt=json3`, {}, 10_000);
  if (!capRes.ok) return null;
  const cap = await capRes.json();
  const text = (cap.events || [])
    .flatMap((e) => (e.segs || []).map((s) => s.utf8 || ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 50 ? text : null;
}
