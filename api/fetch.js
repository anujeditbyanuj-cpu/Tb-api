// api/fetch.js — Vercel Serverless Function
// Supports ALL TeraBox domains and URL formats

const APP_ID     = '250528';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
const MOB_UA     = 'Dubox/4.16.1 Android 13 OPPO CPH2371';
const CHANNEL    = 'android_13_CPH2371_bd-dubox_1024074a';
const VERSION    = '4.16.1';

// ── Sab API domains (try order mein) ──
const API_DOMAINS = [
  'www.1024tera.com',
  'www.terabox.com',
  'www.teraboxapp.com',
  'www.nephobox.com',
  'www.1024terabox.com',
  'www.freeterabox.com',
  'www.mirrobox.com',
  'www.momerybox.com',
  '4funbox.com',
  'tibibox.com',
];

// ── Sab valid TeraBox domains regex ──
const TERABOX_DOMAIN_REGEX = /terabox|nephobox|1024tera|4funbox|mirrobox|momerybox|freeterabox|tibibox|terashare|teraboxurl|teraboxfree|teraboxlink|terasharefile/i;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  if (!TERABOX_DOMAIN_REGEX.test(url)) {
    return res.status(400).json({ error: 'Not a valid TeraBox link' });
  }

  const accountCookie = process.env.TERABOX_COOKIE || '';

  try {
    const surl = extractSurl(url);

    // ── Public link ──
    if (surl) {
      const result = await handlePublicLink(surl, accountCookie);
      if (result) return res.status(200).json(result);
    }

    // ── Private link ya public fail ──
    if (accountCookie) {
      const result = await handlePrivateLink(url, accountCookie);
      if (result) return res.status(200).json(result);
    }

    return res.status(404).json({
      error: 'File not found. Check link or set TERABOX_COOKIE in Vercel env variables.',
    });

  } catch (err) {
    console.error('fetch error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}

// ──────────────────────────────────────────
// PUBLIC link handler
// ──────────────────────────────────────────
async function handlePublicLink(surl, cookie = '') {
  for (const domain of API_DOMAINS) {
    try {
      const pageData = await getSharePageData(domain, surl, cookie);
      if (!pageData) continue;

      const fileList = await getFileList(domain, surl, pageData);
      if (!fileList.length) continue;

      const file  = fileList[0];
      const fsid  = file.fs_id || file.fsid;
      const dlData = await getDirectLink(domain, fsid, surl, pageData);
      if (!dlData.dlink) continue;

      const isVideo = isVideoFile(file.server_filename);
      const m3u8Url = isVideo
        ? await getM3U8Stream(file.path || `/${file.server_filename}`, pageData.jsToken, pageData.cookies)
        : null;

      return {
        success:      true,
        filename:     file.server_filename,
        size:         formatSize(file.size),
        size_bytes:   file.size,
        thumbnail:    file.thumbs?.url3 || file.thumbs?.url2 || null,
        isVideo,
        download_url: dlData.dlink,
        stream_url:   dlData.dlink,
        m3u8_url:     m3u8Url,
        link_type:    'public',
      };
    } catch (_) { continue; }
  }
  return null;
}

// ──────────────────────────────────────────
// PRIVATE link handler (cookie se)
// ──────────────────────────────────────────
async function handlePrivateLink(url, cookie) {
  let filePath = '';
  try { filePath = new URL(url).pathname; } catch {}

  for (const domain of API_DOMAINS) {
    try {
      const homeRes = await fetch(`https://${domain}/`, {
        headers: { 'User-Agent': USER_AGENT, 'Cookie': cookie },
      });
      const homeHtml    = await homeRes.text();
      const jsToken     = extractRegex(homeHtml, /window\.jsToken\s*=\s*["']([^"']+)["']/) || '';
      const bdstoken    = extractRegex(homeHtml, /"bdstoken"\s*:\s*"([^"]+)"/) || '';
      const homeCookies = mergeCookies(cookie, parseCookies(homeRes.headers.get('set-cookie') || ''));

      if (!jsToken && !bdstoken) continue;

      const listParams = new URLSearchParams({
        app_id: APP_ID, web: '1', channel: 'dubox', clienttype: '0',
        jsToken, bdstoken, dir: filePath || '/',
        order: 'time', desc: '1', showempty: '0', num: '100', page: '1',
      });

      const listRes  = await fetch(`https://${domain}/api/list?${listParams}`, {
        headers: { 'User-Agent': USER_AGENT, 'Cookie': homeCookies, 'Referer': `https://${domain}/` },
      });
      const listData = await listRes.json();
      if (listData.errno !== 0 || !listData.list?.length) continue;

      const file  = listData.list[0];
      const fsid  = file.fs_id || file.fsid;

      const dlParams = new URLSearchParams({
        app_id: APP_ID, fs_idlist: JSON.stringify([String(fsid)]),
        web: '1', channel: 'dubox', clienttype: '0', jsToken, bdstoken,
      });
      const dlRes  = await fetch(`https://${domain}/api/download?${dlParams}`, {
        headers: { 'User-Agent': USER_AGENT, 'Cookie': homeCookies, 'Referer': `https://${domain}/` },
      });
      const dlData = await dlRes.json();
      const dlink  = dlData?.list?.[0]?.dlink || null;
      if (!dlink) continue;

      const isVideo = isVideoFile(file.server_filename);
      const m3u8Url = isVideo
        ? await getM3U8Stream(file.path, jsToken, homeCookies)
        : null;

      return {
        success:      true,
        filename:     file.server_filename,
        size:         formatSize(file.size),
        size_bytes:   file.size,
        thumbnail:    file.thumbs?.url3 || file.thumbs?.url2 || null,
        isVideo,
        download_url: dlink,
        stream_url:   dlink,
        m3u8_url:     m3u8Url,
        link_type:    'private',
      };
    } catch (_) { continue; }
  }
  return null;
}

// ──────────────────────────────────────────
// Share page data
// ──────────────────────────────────────────
async function getSharePageData(domain, surl, cookie = '') {
  try {
    const r = await fetch(`https://${domain}/sharing/link?surl=${surl}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        ...(cookie ? { 'Cookie': cookie } : {}),
      },
      redirect: 'follow',
    });
    if (!r.ok) return null;
    const html    = await r.text();
    if (html.length < 500) return null;
    const cookies = mergeCookies(cookie, parseCookies(r.headers.get('set-cookie') || ''));

    return {
      jsToken:   extractRegex(html, /window\.jsToken\s*=\s*["']([^"']+)["']/) || '',
      sign:      extractRegex(html, /"sign"\s*:\s*"([^"]+)"/) || '',
      timestamp: extractRegex(html, /"timestamp"\s*:\s*"?(\d+)"?/) || String(Math.floor(Date.now() / 1000)),
      cookies,
    };
  } catch { return null; }
}

// ──────────────────────────────────────────
// File list
// ──────────────────────────────────────────
async function getFileList(domain, surl, pageData) {
  try {
    const params = new URLSearchParams({
      app_id: APP_ID, shorturl: surl, root: '1',
      jsToken: pageData.jsToken || '',
    });
    const r    = await fetch(`https://${domain}/api/shorturlinfo?${params}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer':    `https://${domain}/sharing/link?surl=${surl}`,
        'Cookie':     pageData.cookies,
      },
    });
    const data = await r.json();
    return (data.errno === 0 && data.list?.length) ? data.list : [];
  } catch { return []; }
}

// ──────────────────────────────────────────
// Direct download link
// ──────────────────────────────────────────
async function getDirectLink(domain, fsid, surl, pageData) {
  try {
    const params = new URLSearchParams({
      app_id: APP_ID, fs_idlist: JSON.stringify([String(fsid)]),
      target_path: '/', sign: pageData.sign || '',
      timestamp: pageData.timestamp || '',
      vip: '0', jsToken: pageData.jsToken || '', shorturl: surl,
    });
    const r    = await fetch(`https://${domain}/api/download?${params}`, {
      headers: {
        'User-Agent': MOB_UA,
        'Referer':    `https://${domain}/sharing/link?surl=${surl}`,
        'Cookie':     pageData.cookies,
      },
    });
    const data = await r.json();
    return { dlink: data?.list?.[0]?.dlink || null };
  } catch { return { dlink: null }; }
}

// ──────────────────────────────────────────
// M3U8 stream
// ──────────────────────────────────────────
async function getM3U8Stream(filePath, jsToken, cookies) {
  try {
    const params = new URLSearchParams({
      resolution: '480p', app_id: APP_ID, type: 'M3U8_SUBTITLE_SRT',
      path: filePath, ehps: '0', isplayer: '1', clienttype: '1',
      channel: CHANNEL, version: VERSION, network_type: 'www',
      carrier_country: 'in', device_country: 'in', phone_brand: 'OPPO',
      trans: 'dash:1', lang: 'en', time: String(Math.floor(Date.now() / 1000)),
    });
    const r = await fetch(`https://dm.1024tera.com/api/streaming?${params}`, {
      headers: {
        'User-Agent': MOB_UA, 'Cookie': cookies,
        ...(jsToken ? { Authorization: `Bearer ${jsToken}` } : {}),
      },
    });
    if (!r.ok) return null;
    const text = await r.text();
    if (text.includes('#EXTM3U')) return `data:application/x-mpegURL;base64,${Buffer.from(text).toString('base64')}`;
    try { const j = JSON.parse(text); return j.url || j.m3u8 || null; } catch { return null; }
  } catch { return null; }
}

// ──────────────────────────────────────────
// surl extractor — sab URL formats support
// ──────────────────────────────────────────
function extractSurl(url) {
  try {
    const u = new URL(url);

    // /s/XXXX format
    const m = u.pathname.match(/\/s\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];

    // ?surl=XXXX format
    const surl = u.searchParams.get('surl');
    if (surl) return surl;

    // /wap/share/filelist?surl=XXXX
    // /share/link?surl=XXXX
    // /sharing/link?surl=XXXX
    // already handled above via searchParams

    return null;
  } catch { return null; }
}

// ──────────────────────────────────────────
// Utils
// ──────────────────────────────────────────
function extractRegex(str, regex) { const m = str.match(regex); return m ? m[1] : null; }

function parseCookies(raw) {
  if (!raw) return '';
  return raw.split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
}

function mergeCookies(...parts) {
  const map = new Map();
  parts.filter(Boolean).forEach(part => {
    part.split(';').forEach(pair => {
      const [k, ...v] = pair.trim().split('=');
      if (k) map.set(k.trim(), v.join('='));
    });
  });
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function formatSize(bytes) {
  if (!bytes) return 'Unknown';
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB';
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(2) + ' MB';
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(2) + ' KB';
  return bytes + ' B';
}

function isVideoFile(name) {
  return /\.(mp4|mkv|avi|mov|webm|flv|wmv|m4v|3gp|ts)$/i.test(name || '');
}
