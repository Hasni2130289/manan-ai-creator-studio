# Manan AI Creator Studio

**By Manan Automation — All Your Creator Tools in One Place**

WhatsApp: +92 371 4675373

Manan AI Creator Studio is a single web app that brings the creator tools of
Manan Automation together in one place: AI-assisted video creation, research,
voice and image tools, and a link out to the existing Manan Clipping Tool.

> **Status (26 Nov 2026):** all six tools below are built and the production
> build + server tests pass (frontend `npm run build` ✓, server `npm test`
> 14/14 ✓). Tools that need a provider key show an honest setup message
> until the key is configured — nothing is faked.

## Tools

| Tool | What it does | Status |
| ---- | ------------ | ------ |
| **Manan Clipping Tool** | The existing clipping app (separate repo, separate deployment). The Studio links out to it — it is **not** embedded or modified here. | Live at https://manan-clipping-tool-production.up.railway.app/ |
| **Manan Viral Research** | Real YouTube search (titles, thumbnails, channel, views, dates) via the YouTube Data API v3; save to a research board; export CSV/JSON; title + hook ideas. | Setup required — needs `YOUTUBE_API_KEY` for search; ideas fall back to labelled templates without `OPENAI_API_KEY`. |
| **Manan AI Thumbnail Maker** | Canvas workspace: topic/title input, style presets (gaming, storytelling, documentary, education), image upload, editable text/size/position/colours, preview, PNG/JPEG export, save to My Projects. | Live (prompt mode + canvas editor). AI image generation needs `IMAGE_API_KEY`; background removal needs `BGREMOVE_API_KEY`. |
| **Manan Video-to-Script AI** | Summary, key points, script, hooks and CTAs from a pasted transcript or uploaded file, in English, Urdu or Roman Urdu. | Live (template extraction). Accepts a YouTube URL only when a transcript can actually be fetched — otherwise it returns an honest `transcript_unavailable` error. AI output needs `OPENAI_API_KEY`. |
| **Manan Faceless Video Maker** | 9-step workflow (topic/script → format → language/voice → narration → visuals → captions → storyboard → render → download), vertical + horizontal, async jobs with progress. | Needs setup — rendering requires a TTS key (`ELEVENLABS_API_KEY` or `OPENAI_API_KEY`); FFmpeg is installed in the Docker image. Without a TTS key the job reports `needs_setup` — no fake video is ever shown. |
| **Manan Multi-Platform Post Maker** | YouTube/Shorts/Facebook/Instagram/TikTok captions, hooks, hashtags, polls, content calendar; topic + platform + language + tone; multiple variations; save/export. | Live (template generator). AI output needs `OPENAI_API_KEY`. No external publishing — publishing needs an authorized integration. |

Any tool whose provider key is missing runs in
template / setup-required mode (see [What still needs keys](#what-still-needs-keys)).

## Design reference

The UI follows the Manan Digital Store look the user approved for the
Clipping Tool redesign (24 Nov 2026): premium dark theme, orange/gold
gradient accents, rounded cards, bold headings.

## Local setup

### Prerequisites

- Node.js 20+ (the Docker image uses Node 24)
- npm
- FFmpeg — only needed locally if you run the Faceless Video Maker render
  path outside Docker (the Docker image installs it for you)

### Install and run

```bash
# Install dependencies and build the frontend
npm run build

# Development: frontend (Vite, port 5173) + server (port 5000) together
npm run dev

# Production: build the frontend, then start the server
npm run build
npm start

# Server tests
npm test
```

The `dev` script runs both processes with a single shell `&` (no extra
dependency). This works on Linux/macOS; on Windows use WSL or run the two
commands separately:

```bash
npm --prefix frontend run dev
npm --prefix server run dev
```

### How serving works

The server (Express) serves the frontend production build from
`../frontend/dist` when it is present, listens on `process.env.PORT || 5000`,
and exposes `GET /api/health` (used by the Docker healthcheck and Railway).

## Environment variables

Copy `.env.example` to `.env` and fill in your own values. **Never commit a
real `.env`** — all secrets are server-side only and must never be exposed to
the browser or shipped in the frontend build.

| Variable | Purpose | Required? |
| -------- | ------- | --------- |
| `PORT` | Port the server listens on (Railway sets this automatically) | Optional (default 5000) |
| `NODE_ENV` | `development` / `production` | Optional |
| `JWT_SECRET` | Signs auth tokens — generate a long random string | Yes (auth) |
| `DATABASE_URL` | PostgreSQL connection string; when unset, a local JSON file store (`server/data/`) is used | Optional |
| `ADMIN_EMAIL` | Email of the first admin account | Yes (first setup) |
| `ADMIN_SETUP_TOKEN` | Token for the setup-admin endpoint | Yes (first setup) |
| `YOUTUBE_API_KEY` | YouTube Data API v3 — Viral Research | Optional* |
| `OPENAI_API_KEY` | AI text / image / TTS provider | Optional* |
| `IMAGE_API_KEY` | Image generation; defaults to `OPENAI_API_KEY` if unset | Optional |
| `ELEVENLABS_API_KEY` | TTS narration (ElevenLabs) | Optional* |
| `STT_API_KEY` | Speech-to-text provider | Optional* |
| `BGREMOVE_API_KEY` | Background removal provider | Optional* |
| `CLIPPING_TOOL_URL` | URL of the external Clipping Tool (default https://manan-clipping-tool-production.up.railway.app/) | Optional |

\* Optional for the app to start, but the tool that needs it stays in
template / setup-required mode without it.

## Railway deployment

The app deploys from this repo with the included `Dockerfile`
(`railway.json` selects the Dockerfile builder).

### Repository

The code lives at https://github.com/Hasni2130289/manan-ai-creator-studio
(public, branch `main`). To push later changes from the local checkout:

```bash
cd ~/workspace/manan-ai-creator-studio
GIT_SSH_COMMAND="ssh -i /home/hatch/.ssh/id_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o ProxyCommand='nc -X connect -x 198.19.0.1:3128 %h %p'" git push origin main
```

### Deploying on Railway

1. Create a new Railway project → **Deploy from GitHub repo** → pick this repo.
2. In the service settings, set the environment variables from the table
   above (at minimum `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_SETUP_TOKEN`).
3. Deploy. Railway builds the Docker image (frontend build + server +
   FFmpeg), starts it, and checks `GET /api/health` (healthcheck timeout
   300 s, restart on failure).

The Dockerfile is multi-stage: stage 1 builds the frontend with Node 24,
stage 2 (Node 24-slim) installs FFmpeg, installs production server
dependencies, copies in the built frontend, and serves everything on port
5000.

## Hostinger compatibility

**Hostinger Business SHARED hosting does NOT run this app.** Shared hosting
has no Node.js runtime and no FFmpeg, and this app needs both (Node for the
server, FFmpeg for the Faceless Video Maker render path). Do not deploy the
Studio to a Hostinger shared plan.

What works instead:

- **Railway** (recommended) — the Dockerfile-based deployment above.
- **A Hostinger VPS** (or any VPS) — the same Dockerfile runs there with
  `docker build` / `docker run -p 5000:5000 --env-file .env ...`.

## Clipping Tool integration

The Manan Clipping Tool is a **separate app in a separate repo**
(`manan-clipping-tool`, live on Railway). The Studio links out to it at
`CLIPPING_TOOL_URL` (default
https://manan-clipping-tool-production.up.railway.app/). It is never
modified, embedded, or re-implemented from this repo.

## Project structure

```
manan-ai-creator-studio/
├── Dockerfile            # Multi-stage build (frontend + server + ffmpeg)
├── railway.json          # Railway: Dockerfile builder, /api/health check
├── .env.example          # Every env var, empty values, with comments
├── .gitignore
├── package.json          # Root scripts: dev / build / start / test
├── README.md
├── frontend/             # Vite + React + TypeScript (dev: vite --port 5173)
│   └── dist/             # Production build, served by the server
└── server/               # Node + Express (plain JS)
    ├── src/
    │   └── index.js      # Entry point; serves frontend + GET /api/health
    ├── test/             # node --test
    └── data/             # Local JSON file store (when DATABASE_URL is unset)
```

## Testing

```bash
npm test        # runs the server test suite (node --test test/)
```

## What still needs keys

Until a key is set, the tool that needs it stays in template /
setup-required mode — the app still starts and the rest of the Studio works.

| Provider | Env var | Without it |
| -------- | ------- | ---------- |
| YouTube Data API v3 | `YOUTUBE_API_KEY` | Viral Research cannot fetch YouTube data |
| OpenAI | `OPENAI_API_KEY` | AI text / image / TTS features unavailable |
| Image generation | `IMAGE_API_KEY` (or `OPENAI_API_KEY`) | Image generation unavailable |
| ElevenLabs | `ELEVENLABS_API_KEY` | TTS narration unavailable |
| Speech-to-text provider | `STT_API_KEY` | Transcription unavailable |
| Background removal provider | `BGREMOVE_API_KEY` | Background removal unavailable |

Also required for first setup (not provider keys): `JWT_SECRET`,
`ADMIN_EMAIL`, `ADMIN_SETUP_TOKEN`.
