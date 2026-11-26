// Provider configuration + live clipping-tool health check (cached ~60 s).
import { info, warn } from './logger.js';

export const CLIPPING_TOOL_URL =
  'https://manan-clipping-tool-production.up.railway.app/';
const CLIPPING_HEALTH_URL = `${CLIPPING_TOOL_URL}api/health`;
const CACHE_MS = 60_000;
const FETCH_TIMEOUT_MS = 5000;

let cache = { at: 0, status: 'down' };

export async function checkClippingTool() {
  const now = Date.now();
  if (now - cache.at < CACHE_MS) return cache.status;
  let status = 'down';
  try {
    const res = await fetch(CLIPPING_HEALTH_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.ok) status = 'ok';
  } catch (err) {
    warn('clipping tool health check failed', {
      error: String(err?.message || err),
    });
  }
  cache = { at: now, status };
  return status;
}

export function providerConfigured() {
  return {
    youtube: { configured: !!process.env.YOUTUBE_API_KEY },
    openai: { configured: !!process.env.OPENAI_API_KEY },
    image: { configured: !!process.env.IMAGE_API_KEY },
    tts: { configured: !!(process.env.ELEVENLABS_API_KEY || process.env.OPENAI_API_KEY) },
    stt: { configured: !!process.env.OPENAI_API_KEY },
    bgremove: { configured: !!process.env.BGREMOVE_API_KEY },
  };
}

export const PROVIDER_DEFS = [
  {
    id: 'youtube',
    name: 'YouTube Data API',
    envVar: 'YOUTUBE_API_KEY',
    instructions:
      'Create a project in Google Cloud Console (console.cloud.google.com), enable the YouTube Data API v3, then create an API key under APIs & Services > Credentials and set it as YOUTUBE_API_KEY.',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    instructions:
      'Create an API key at platform.openai.com > API keys and set it as OPENAI_API_KEY. Used for AI ideas, scripts, posts and (optionally) narration.',
  },
  {
    id: 'image',
    name: 'Image generation (OpenAI Images)',
    envVar: 'IMAGE_API_KEY',
    instructions:
      'Create an API key at platform.openai.com > API keys and set it as IMAGE_API_KEY. Used for AI thumbnail generation.',
  },
  {
    id: 'tts',
    name: 'Text-to-speech (ElevenLabs or OpenAI)',
    envVar: 'ELEVENLABS_API_KEY',
    instructions:
      'Get a key from ElevenLabs (elevenlabs.io > Profile > API Keys) and set it as ELEVENLABS_API_KEY, or set OPENAI_API_KEY which also provides TTS. Required for faceless-video narration.',
  },
  {
    id: 'stt',
    name: 'Speech-to-text (OpenAI Whisper)',
    envVar: 'OPENAI_API_KEY',
    instructions:
      'Create an API key at platform.openai.com > API keys and set it as OPENAI_API_KEY. Used for transcription.',
  },
  {
    id: 'bgremove',
    name: 'Background removal (remove.bg)',
    envVar: 'BGREMOVE_API_KEY',
    instructions:
      'Create an account at remove.bg, copy your API key from your dashboard and set it as BGREMOVE_API_KEY.',
  },
];

export function providersStatus() {
  const cfg = providerConfigured();
  return PROVIDER_DEFS.map((d) => ({
    id: d.id,
    name: d.name,
    configured: !!cfg[d.id]?.configured,
    envVar: d.envVar,
    instructions: d.instructions,
  }));
}

export const TOOL_DEFS = [
  {
    id: 'research',
    name: 'Research',
    category: 'research',
    description: 'Search YouTube for trending videos and analyse competitors.',
  },
  {
    id: 'script',
    name: 'Script Studio',
    category: 'writing',
    description: 'Turn a transcript or idea into a structured video script.',
  },
  {
    id: 'thumbnail',
    name: 'Thumbnail Studio',
    category: 'design',
    description: 'Generate thumbnail prompts and AI thumbnail images.',
  },
  {
    id: 'video',
    name: 'Faceless Video',
    category: 'video',
    description: 'Render a narrated faceless video from a script.',
  },
  {
    id: 'posts',
    name: 'Post Generator',
    category: 'social',
    description: 'Generate captions, titles and hashtags for every platform.',
  },
  {
    id: 'clipping',
    name: 'Clipping Tool',
    category: 'video',
    description: 'Clip long videos into short vertical clips.',
    url: CLIPPING_TOOL_URL,
  },
];

// Tool status: clipping from the live check; others live if they work
// without keys, setup_required if they need a provider key.
export async function toolsStatus(store) {
  const cfg = providerConfigured();
  const clipping = await checkClippingTool();
  const needsKey = {
    research: !cfg.youtube.configured,
    script: false, // template fallback works without a key
    thumbnail: false, // prompt generation works without a key
    video: !cfg.tts.configured,
    posts: false, // template generator works without a key
  };
  const out = [];
  for (const t of TOOL_DEFS) {
    let status;
    if (t.id === 'clipping') {
      status = clipping === 'ok' ? 'live' : 'down';
    } else if (needsKey[t.id]) {
      status = 'setup_required';
    } else {
      status = 'live';
    }
    const enabled = store ? await store.isToolEnabled(t.id) : true;
    if (!enabled) status = 'disabled';
    out.push({ ...t, status });
  }
  return out;
}

export function logStartupProviders() {
  const cfg = providerConfigured();
  info('providers configured', cfg);
}
