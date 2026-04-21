const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 7860;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const UPSTREAM_URLS = [
  'https://torrentio.strem.fun',
];

const MIN_SEEDERS = 1;

const QUALITY_KEYWORDS = [
  '480p', '540p', '576p', '720p', '1080p',
  'web', 'webdl', 'webrip', 'bluray', 'hdtv', 'hdrip'
];

const FORBIDDEN_TERMS = ['cam', 'ts', 'hdts', 'tc', 'screener', 'hdcam', 'hd-ts', '2160p', '4k', 'uhd'];

const SOURCE_CONFIG = [
  { name: 'yts', display: 'YTS', order: 1 },
  { name: 'thepiratebay', display: 'TPB', order: 2 },
  { name: 'tpb', display: 'TPB', order: 2 },
  { name: 'torrentgalaxy', display: 'TGx', order: 3 },
  { name: '1337x', display: '1337x', order: 4 },
  { name: 'rutor', display: 'Rutor', order: 5 },
  { name: 'eztv', display: 'EZTV', order: 6 },
  { name: 'rarbg', display: 'RARBG', order: 7 },
  { name: 'nyaasi', display: 'Nyaa', order: 8 },
  { name: 'torrent9', display: 'Torrent9', order: 9 }
];

const LINKS_PER_QUALITY = 2;

function isAllowedQuality(title = '') {
  const lower = title.toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    if (lower.includes(term)) return false;
  }
  for (const q of QUALITY_KEYWORDS) {
    if (lower.includes(q)) return true;
  }
  return false;
}

function getQuality(title = '') {
  const lower = title.toLowerCase();
  if (lower.includes('720p')) return '720p';
  if (lower.includes('1080p')) return '1080p';
  if (lower.includes('480p')) return '480p';
  if (lower.includes('540p')) return '540p';
  if (lower.includes('576p')) return '576p';
  // No 2160p / 4K detection
  const resMatch = lower.match(/(\d{3,4})x(\d{3,4})/);
  if (resMatch) {
    const height = parseInt(resMatch[2], 10);
    if (height >= 1080) return '1080p';
    if (height >= 720) return '720p';
    if (height >= 540) return '540p';
    if (height >= 480) return '480p';
  }
  return 'other';
}

function getSeeders(stream) {
  if (stream.behaviorHints?.seeders) return stream.behaviorHints.seeders;
  const match = stream.title?.match(/👤\s*(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function detectSource(title = '') {
  const lower = title.toLowerCase();
  for (const src of SOURCE_CONFIG) {
    if (lower.includes(src.name)) return src.name;
  }
  return 'other';
}

function getSourceOrder(sourceName) {
  const config = SOURCE_CONFIG.find(c => c.name === sourceName);
  return config ? config.order : 999;
}

function filterStream(stream) {
  const title = stream.title || '';
  if (!stream.url && !stream.infoHash) return false;
  if (!isAllowedQuality(title)) return false;
  if (getSeeders(stream) < MIN_SEEDERS) return false;
  const source = detectSource(title);
  if (source === 'other') return false;
  return true;
}

async function fetchUpstream(type, id) {
  for (const baseUrl of UPSTREAM_URLS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${baseUrl}/stream/${type}/${id}.json`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data.streams?.length) return data.streams;
      }
    } catch (e) {}
  }
  return [];
}

function categorizeAndLimit(streams) {
  const filtered = streams.filter(filterStream);
  
  const grouped = {};
  filtered.forEach(stream => {
    const source = detectSource(stream.title);
    const quality = getQuality(stream.title);
    const key = `${source}-${quality}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(stream);
  });
  
  const result = [];
  for (const key in grouped) {
    const groupStreams = grouped[key];
    groupStreams.sort((a, b) => getSeeders(b) - getSeeders(a));
    const topLinks = groupStreams.slice(0, LINKS_PER_QUALITY);
    result.push(...topLinks);
  }
  
  return result.sort((a, b) => {
    const sourceA = detectSource(a.title);
    const sourceB = detectSource(b.title);
    const orderA = getSourceOrder(sourceA);
    const orderB = getSourceOrder(sourceB);
    if (orderA !== orderB) return orderA - orderB;
    
    const qualityA = getQuality(a.title);
    const qualityB = getQuality(b.title);
    const qualityRank = {
      '720p': 1,
      '1080p': 2,
      '480p': 3,
      '540p': 4,
      '576p': 5,
      'other': 999
    };
    const rankA = qualityRank[qualityA] || 999;
    const rankB = qualityRank[qualityB] || 999;
    if (rankA !== rankB) return rankA - rankB;
    
    return getSeeders(b) - getSeeders(a);
  });
}

app.get('/manifest.json', (req, res) => {
  res.json({
    id: 'org.ghostream.platinum',
    name: 'Ghostream Platinum 🚀',
    description: 'Made With 🧡 By VAN',
    version: '5.1.0',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    catalogs: []
  });
});

app.get('/stream/:type/:id.json', async (req, res) => {
  const { type, id } = req.params;
  try {
    const streams = await fetchUpstream(type, id);
    const categorized = categorizeAndLimit(streams);
    res.json({ streams: categorized });
  } catch (e) {
    res.json({ streams: [] });
  }
});

app.get('/debug/:type/:id.json', async (req, res) => {
  const { type, id } = req.params;
  try {
    const streams = await fetchUpstream(type, id);
    res.json({ streams });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Ghostream 🚀 on ${PORT}`));
