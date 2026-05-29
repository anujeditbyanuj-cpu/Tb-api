# TeraBoxFast — Vercel Deployment Guide

## Project Structure

```
teraboxfast/
├── api/
│   ├── fetch.js      ← Serverless: TeraBox link → file info + download URL
│   └── stream.js     ← Serverless: Proxy video stream (bypasses CORS)
├── public/
│   └── index.html    ← Frontend UI
├── vercel.json       ← Routing config
└── package.json
```

## Deploy to Vercel (Step by Step)

### Option A — GitHub + Vercel (Recommended)

1. Create a new GitHub repo and upload all files
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import your GitHub repo
4. Leave all settings as default → Click **Deploy**
5. Done! Your site will be live at `https://yourproject.vercel.app`

### Option B — Vercel CLI

```bash
npm install -g vercel
cd teraboxfast
vercel
# Follow the prompts
```

## How It Works

1. User pastes TeraBox link → Frontend calls `/api/fetch?url=...`
2. `api/fetch.js` scrapes TeraBox share page → gets jsToken → calls TeraBox API
3. Returns filename, size, thumbnail, download URL
4. For video streaming: `/api/stream?url=...` proxies video bytes through Vercel

## Notes

- TeraBox sometimes blocks direct links for private/login-required files
- The stream proxy uses Vercel's serverless functions (max 10s timeout on free plan)
- For large files, direct download link works better than streaming proxy
- Works best with public TeraBox share links
