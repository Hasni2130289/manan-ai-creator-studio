// Template-based content generation (honest fallback when no AI key is set).
// All functions are deterministic and clearly labelled source:"template".

const STOPWORDS = new Set(
  'a an the and or but of to in on for with at by from as is are was were be been it its this that these those you your we our they he she his her not no do does did will would can could should have has had i me my so if then than when where what who which how all any some more most very just about into over after before between through during each other'.split(' '),
);

export function splitSentences(text) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

export function extractKeywords(text, limit = 8) {
  const counts = new Map();
  for (const word of text.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').split(/\s+/)) {
    const w = word.replace(/'/g, '');
    if (w.length < 3 || STOPWORDS.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}

const LENGTH_WORDS = { short: 150, medium: 400, long: 800 };

export function templateIdeas(topic) {
  const t = topic.trim();
  return [
    { title: `${t}: The Truth Nobody Tells You`, hook: `Most people get ${t} completely wrong — here's why.` },
    { title: `I Tried ${t} So You Don't Have To`, hook: `I spent a week on ${t}. The result surprised me.` },
    { title: `${t} in 2026: What Actually Works`, hook: `Forget the old advice. This is what works for ${t} now.` },
    { title: `5 Mistakes Everyone Makes With ${t}`, hook: `Mistake number 3 costs people the most — and almost everyone makes it.` },
    { title: `The Beginner's Guide to ${t}`, hook: `If you're starting ${t} from zero, start here.` },
  ];
}

export function templateScript(transcript, language, length) {
  const sentences = splitSentences(transcript);
  const keywords = extractKeywords(transcript);
  const targetWords = LENGTH_WORDS[length] || LENGTH_WORDS.medium;
  const keyPoints = sentences.slice(0, Math.min(5, sentences.length));
  const summarySentences = sentences.slice(0, 3);
  const summary = summarySentences.join(' ') || transcript.slice(0, 300);

  const intro =
    language === 'ur'
      ? 'آج ہم ایک اہم موضوع پر بات کریں گے۔'
      : language === 'roman-ur'
        ? 'Aaj hum aik ahem topic par baat karenge.'
        : 'Today we are talking about something that matters.';
  const outro =
    language === 'ur'
      ? 'اگر ویڈیو پسند آئی تو لائک اور سبسکرائب کریں۔'
      : language === 'roman-ur'
        ? 'Agar video pasand aayi to like aur subscribe karein.'
        : 'If you found this useful, like and subscribe for more.';

  const body = [];
  let words = 0;
  for (const s of sentences) {
    if (words >= targetWords) break;
    body.push(s);
    words += s.split(/\s+/).length;
  }
  if (!body.length) body.push(transcript.slice(0, 500));

  const script = [
    `HOOK: ${summarySentences[0] || 'Here is what you need to know.'}`,
    '',
    `INTRO: ${intro}`,
    '',
    ...body.map((s, i) => `PART ${i + 1}: ${s}`),
    '',
    `OUTRO: ${outro}`,
  ].join('\n');

  const hooks = [
    summarySentences[0] || 'You need to hear this.',
    keywords.length
      ? `The truth about ${keywords.slice(0, 3).join(', ')} — explained simply.`
      : 'Watch till the end — the last point changes everything.',
    'Most people miss this. Don’t be one of them.',
  ];
  const ctas = [
    language === 'ur'
      ? 'سبسکرائب کریں اور بیل آئیکن دبائیں۔'
      : language === 'roman-ur'
        ? 'Subscribe karein aur bell icon dabayein.'
        : 'Subscribe and hit the bell icon so you never miss an upload.',
    'Drop a comment with your biggest takeaway.',
    'Share this with someone who needs to hear it.',
  ];
  return { summary, keyPoints, script, hooks, ctas, source: 'template' };
}

const PLATFORM_STYLE = {
  youtube: { title: true, caption: true, hooks: true },
  shorts: { title: true, caption: true, hooks: true },
  facebook: { title: false, caption: true, hooks: false },
  instagram: { title: false, caption: true, hooks: true },
  tiktok: { title: false, caption: true, hooks: true },
};

const TONE_LINES = {
  casual: ['No fluff, just the good stuff.', 'You already know this one hits different.'],
  professional: ['A clear, practical breakdown.', 'Built for people who want results, not hype.'],
  funny: ['Yes, it is exactly as chaotic as it sounds.', 'Warning: may cause sudden laughter.'],
  inspirational: ['Start where you are. Use what you have.', 'Small steps, done daily, change everything.'],
};

export function templatePosts(topic, platforms, language, tone) {
  const t = topic.trim();
  const toneLines = TONE_LINES[tone] || TONE_LINES.casual;
  const variations = [];
  for (const platform of platforms) {
    const style = PLATFORM_STYLE[platform];
    const baseTags = [
      t.toLowerCase().replace(/[^a-z0-9]+/g, ''),
      platform,
      'creator',
      'viral',
    ].filter(Boolean);
    const count = platform === 'youtube' ? 2 : 3;
    for (let i = 0; i < count; i++) {
      const hook =
        i === 0
          ? `Stop scrolling — ${t} just changed everything.`
          : i === 1
            ? `Nobody is talking about this side of ${t}.`
            : `I wish someone told me this about ${t} sooner.`;
      const variation = {
        platform,
        caption:
          language === 'roman-ur'
            ? `${hook} ${toneLines[i % toneLines.length]} ${t} ke baare mein mukammal tafseel — video dekhein!`
            : language === 'ur'
              ? `${hook} ${t} کے بارے میں مکمل تفصیل — ویڈیو دیکھیں!`
              : `${hook} ${toneLines[i % toneLines.length]} Full breakdown of ${t} — watch now!`,
        hashtags: baseTags.map((x) => `#${x}`),
      };
      if (style.title) {
        variation.title =
          i === 0
            ? `${t}: What Nobody Tells You`
            : i === 1
              ? `The Truth About ${t} (2026)`
              : `${t} Explained in 60 Seconds`;
      }
      if (style.hooks) variation.hooks = [hook];
      variations.push(variation);
    }
  }
  return { source: 'template', variations };
}

export const THUMBNAIL_STYLES = {
  gaming: {
    notes: 'Bold neon colours, dramatic character close-up, one big curiosity element, high-contrast text.',
    promptSuffix: 'vibrant neon gaming style, dramatic lighting, bold composition, high contrast, YouTube thumbnail style',
  },
  storytelling: {
    notes: 'Moody cinematic light, single emotional face, dark background, minimal text, mystery and tension.',
    promptSuffix: 'cinematic moody lighting, dark atmospheric background, emotional close-up, mystery, YouTube thumbnail style',
  },
  documentary: {
    notes: 'Realistic, clean composition, strong subject, factual tone, readable title space.',
    promptSuffix: 'realistic documentary photography style, clean composition, strong central subject, natural light',
  },
  education: {
    notes: 'Bright, clean, friendly, clear focal point, simple bold text, trustworthy feel.',
    promptSuffix: 'bright clean educational style, friendly, clear focal point, simple bold design, high readability',
  },
};

export function thumbnailPrompt(topic, title, style) {
  const preset = THUMBNAIL_STYLES[style] || THUMBNAIL_STYLES.storytelling;
  const prompt = `High-CTR 16:9 YouTube thumbnail for "${title || topic}": ${topic}. ${preset.promptSuffix}. One dramatic curiosity element, big emotional face, bold readable title text, no clutter.`;
  return { prompt, styleNotes: preset.notes };
}
