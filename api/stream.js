// api/stream.js — Vercel Serverless Function
// Proxies video stream OR fetches + proxies M3U8 playlist with rewritten segment URLs

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, type } = req.query;
  if (!url) return res.status(400).send('No URL');

  const decoded = decodeURIComponent(url);

  // ── M3U8 playlist proxy: rewrite segment URLs to go through /api/stream too ──
  if (type === 'm3u8') {
    return proxyM3U8(decoded, req, res);
  }

  // ── TS segment or direct MP4 proxy with range support ──
  return proxyMedia(decoded, req, res);
}

async function proxyM3U8(m3u8Url, req, res) {
  try {
    const upstream = await fetch(m3u8Url, {
      headers: {
        'User-Agent': 'Dubox/4.16.1 Android 13 OPPO CPH2371',
        'Referer': 'https://www.nephobox.com/',
      }
    });

    if (!upstream.ok) return res.status(upstream.status).send('M3U8 fetch failed');

    const text = await upstream.text();

    // Rewrite segment URLs to go via our proxy (avoids CORS on .ts files)
    const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
    const rewritten = text.split('\n').map(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return line;
      // Absolute URL
      const segUrl = line.startsWith('http') ? line : baseUrl + line;
      return `/api/stream?url=${encodeURIComponent(segUrl)}`;
    }).join('\n');

    res.setHeader('Content-Type', 'application/x-mpegURL');
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).send(rewritten);
  } catch (err) {
    return res.status(500).send('M3U8 proxy error: ' + err.message);
  }
}

async function proxyMedia(mediaUrl, req, res) {
  try {
    const range = req.headers.range || '';
    const upstream = await fetch(mediaUrl, {
      headers: {
        'User-Agent': 'Dubox/4.16.1 Android 13 OPPO CPH2371',
        'Referer': 'https://www.nephobox.com/',
        ...(range ? { Range: range } : {}),
      }
    });

    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status).send('Upstream error: ' + upstream.status);
    }

    const contentType   = upstream.headers.get('content-type') || 'video/mp4';
    const contentLength = upstream.headers.get('content-length');
    const contentRange  = upstream.headers.get('content-range');
    const acceptRanges  = upstream.headers.get('accept-ranges') || 'bytes';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', acceptRanges);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange)  res.setHeader('Content-Range', contentRange);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(range ? 206 : 200);

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) { res.end(); break; }
      res.write(Buffer.from(value));
    }
  } catch (err) {
    res.status(500).send('Stream error: ' + err.message);
  }
}

export const config = {
  api: { responseLimit: false, bodyParser: false }
};
