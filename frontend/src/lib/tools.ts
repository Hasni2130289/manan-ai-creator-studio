export interface StudioTool {
  id: string;
  name: string;
  short: string;
  description: string;
  category: string;
  icon: string;
  route: string;
  status: 'live' | 'setup';
  statusLabel: string;
  external?: boolean;
  externalUrl?: string;
}

export const CATEGORIES = [
  'All',
  'Research & SEO',
  'AI Graphics & Thumbnails',
  'Script & Content Writing',
  'Video & Clipping',
  'Social Media Content',
  'My Projects',
  'Account & Settings',
] as const;

export const TOOLS: StudioTool[] = [
  {
    id: 'clipping',
    name: 'Manan Clipping Tool',
    short: 'Clip long videos into viral Shorts',
    description: 'Turn long videos into short, shareable clips with captions and hooks. Opens the existing live Manan Clipping Tool.',
    category: 'Video & Clipping',
    icon: '✂️',
    route: '/tools/clipping',
    status: 'live',
    statusLabel: 'Live — opens external tool',
    external: true,
    externalUrl: 'https://manan-clipping-tool-production.up.railway.app/',
  },
  {
    id: 'research',
    name: 'Manan Viral Research',
    short: 'Find viral topics & trending videos',
    description: 'Search any topic or YouTube URL to find trending videos, analyse what works, and generate title and hook ideas.',
    category: 'Research & SEO',
    icon: '🔍',
    route: '/tools/research',
    status: 'setup',
    statusLabel: 'Setup required',
  },
  {
    id: 'thumbnails',
    name: 'Manan AI Thumbnail Maker',
    short: 'Design high-CTR thumbnails',
    description: 'Build scroll-stopping thumbnails with style presets, editable text and canvas export. Prompt mode works without any key.',
    category: 'AI Graphics & Thumbnails',
    icon: '🖼️',
    route: '/tools/thumbnails',
    status: 'live',
    statusLabel: 'Live',
  },
  {
    id: 'scripts',
    name: 'Manan Video-to-Script AI',
    short: 'Turn any video into a script',
    description: 'Paste a transcript or a video URL and get a summary, key points, a full script, hooks and CTAs in English, Urdu or Roman Urdu.',
    category: 'Script & Content Writing',
    icon: '📝',
    route: '/tools/scripts',
    status: 'setup',
    statusLabel: 'Setup required',
  },
  {
    id: 'faceless',
    name: 'Manan Faceless Video Maker',
    short: 'Create faceless videos step by step',
    description: 'From topic to rendered video: script, format, voice, narration, visuals, captions and storyboard — then download the result.',
    category: 'Video & Clipping',
    icon: '🎬',
    route: '/tools/faceless',
    status: 'setup',
    statusLabel: 'Setup required',
  },
  {
    id: 'posts',
    name: 'Manan Multi-Platform Post Maker',
    short: 'One topic, posts for every platform',
    description: 'Generate tailored captions, titles and hashtags for YouTube, Shorts, Facebook, Instagram and TikTok in one go.',
    category: 'Social Media Content',
    icon: '📣',
    route: '/tools/posts',
    status: 'setup',
    statusLabel: 'Setup required',
  },
];

export const LINKS = {
  whatsapp: 'https://wa.me/923714675373',
  whatsappChannel: 'https://whatsapp.com/channel/0029VbDjt8KElagtzfMOaS1x',
  whatsappGroup: 'https://chat.whatsapp.com/Ck1PQHKwNzUBWgOCmYgT6x',
  facebook: 'https://www.facebook.com/share/1GNAaoYFco/',
  tiktok: 'https://www.tiktok.com/@mananautomation',
  instagram: 'https://www.instagram.com/mananautomationofficial',
  youtube: 'https://youtube.com/@mananautomation-28',
  smm: 'https://manansmm.com',
  store: 'https://onlinestore.manansmm.com',
  clippingTool: 'https://manan-clipping-tool-production.up.railway.app/',
  phoneDisplay: '+92 371 4675373',
};
