// Faceless video rendering: real ffmpeg renders only.
// Narration via OpenAI TTS (OPENAI_API_KEY) or ElevenLabs (ELEVENLABS_API_KEY).
// Slides: solid-colour frames with burned-in captions from the script,
// one slide per script line. Output: server/data/renders/<jobId>.mp4
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { DATA_DIR } from './store.js';
import { fetchWithTimeout } from './validate.js';
import { freeTtsAudio } from './providersApi.js';
import { info, warn } from './logger.js';

const execFileAsync = promisify(execFile);

export async function ffmpegAvailable() {
  try {
    await execFileAsync('ffmpeg', ['-version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// Narration always works: paid keys first, free built-in TTS otherwise.
export function ttsConfigured() {
  return true;
}

function scriptLines(script) {
  return String(script)
    .split('\n')
    .map((l) => l.replace(/^(HOOK|INTRO|OUTRO|PART \d+):\s*/i, '').trim())
    .filter((l) => l.length > 0)
    .slice(0, 30);
}

async function generateNarration(text, language, voice, outPath) {
  if (process.env.ELEVENLABS_API_KEY) {
    const voiceId = voice || '21m00Tcm4TlvDq8ikWAM'; // ElevenLabs default "Rachel"
    const res = await fetchWithTimeout(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text.slice(0, 5000),
          model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      },
      10_000,
    );
    if (!res.ok) throw new Error(`ElevenLabs TTS failed with status ${res.status}`);
    fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
    return;
  }
  // OpenAI TTS fallback
  if (process.env.OPENAI_API_KEY) {
    const res = await fetchWithTimeout(
      'https://api.openai.com/v1/audio/speech',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: voice || 'alloy',
          input: text.slice(0, 4096),
        }),
      },
      10_000,
    );
    if (!res.ok) throw new Error(`OpenAI TTS failed with status ${res.status}`);
    fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
    return;
  }
  // Free built-in narration (Google Translate TTS, no key needed).
  const audio = await freeTtsAudio(text.slice(0, 7000), language);
  fs.writeFileSync(outPath, audio);
}

// Escape text for ffmpeg drawtext via a text file (avoids shell quoting).
function writeCaptionFile(dir, index, text) {
  const file = path.join(dir, `caption_${index}.txt`);
  fs.writeFileSync(file, text.slice(0, 280));
  return file;
}

export async function renderVideo(job, onProgress) {
  const workDir = path.join(DATA_DIR, 'renders', job.id);
  const rendersDir = path.join(DATA_DIR, 'renders');
  fs.mkdirSync(workDir, { recursive: true });
  const lines = scriptLines(job.script || job.title);
  const dims = job.format === 'horizontal' ? '1280x720' : '720x1280';
  const [w, h] = dims.split('x').map(Number);
  const audioPath = path.join(workDir, 'narration.mp3');
  const outPath = path.join(rendersDir, `${job.id}.mp4`);

  onProgress?.(10);
  await generateNarration(lines.join(' '), job.language, job.voice, audioPath);
  onProgress?.(30);

  // One slide image per line: solid colour + burned-in caption.
  const palette = ['0x1a1a2e', '0x16213e', '0x0f3460', '0x533483', '0x1f3b2c', '0x3d0c11'];
  const slideFiles = [];
  const concatLines = [];
  for (let i = 0; i < lines.length; i++) {
    const captionFile = writeCaptionFile(workDir, i, lines[i]);
    const slide = path.join(workDir, `slide_${i}.png`);
    const words = lines[i].split(/\s+/).length;
    const duration = Math.max(2, Math.min(8, words / 2.5));
    const color = palette[i % palette.length];
    await execFileAsync('ffmpeg', [
      '-y', '-f', 'lavfi', '-i', `color=c=${color}:s=${dims}:d=1`,
      '-vf', `drawtext=textfile='${captionFile}':fontcolor=white:fontsize=${job.format === 'horizontal' ? 36 : 32}:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=black@0.5:boxborderw=20`,
      '-frames:v', '1', slide,
    ]);
    slideFiles.push({ slide, duration });
    concatLines.push(`file '${slide}'`, `duration ${duration}`);
  }
  // Last file repeated so concat keeps its duration.
  concatLines.push(`file '${slideFiles[slideFiles.length - 1].slide}'`);
  const concatFile = path.join(workDir, 'concat.txt');
  fs.writeFileSync(concatFile, concatLines.join('\n'));
  onProgress?.(60);

  const videoOnly = path.join(workDir, 'video_only.mp4');
  await execFileAsync('ffmpeg', [
    '-y', '-f', 'concat', '-safe', '0', '-i', concatFile,
    '-vf', `scale=${w}:${h},format=yuv420p`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', videoOnly,
  ]);
  onProgress?.(80);

  await execFileAsync('ffmpeg', [
    '-y', '-i', videoOnly, '-i', audioPath,
    '-c:v', 'copy', '-c:a', 'aac', '-shortest', outPath,
  ]);
  onProgress?.(100);
  info('video job rendered', { jobId: job.id, output: outPath });
  return outPath;
}

export function renderOutputPath(jobId) {
  return path.join(DATA_DIR, 'renders', `${jobId}.mp4`);
}
