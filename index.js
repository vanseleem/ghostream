const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 7000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const UPSTREAM_URLS = [
  'https://torrentio.strem.fun',
  'https://torrentio.stremio.my.id'
];

const MIN_SEEDERS = 3;
const ALLOWED_QUALITIES = ['720p', '1080p'];

const SOURCE_PRIORITY = [
  { source: 'yts', quality: '1080p' },
  { source: 'yts', quality: '720p' },
  { source: 'thepiratebay', quality: '1080p' },
  { source: 'tpb', quality: '1080p' },
  { source: 'thepiratebay', quality: '720p' },
  { source: 'tpb', quality: '720p' },
  { source: '1337x', quality: '1080p' },
  { source: '1337x', quality: '720p' },
  { source: 'rutor', quality: '1080p' },
  { source: 'rutor', quality: '720p' }
];

function getQuality(title = '') {
  const lower = title.toLowerCase();
  if (lower.includes('1080p')) return '1080p';
  if (lower.includes('720p')) return '720p';
  return null;
}

function getSeeders(stream) {
  if (stream.behaviorHints?.seeders) return stream.behaviorHints.seeders;
  const match = stream.title?.match(/👤\s*(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function detectSource(title = '') {
  const lower = title.toLowerCase();
  if (lower.includes('yts')) return 'yts';
  if (lower.includes('1337x')) return '1337x';
  if (lower.includes('eztv')) return 'eztv';
  if (lower.includes('rutor')) return 'rutor';
  if (lower.includes('thepiratebay') || lower.includes('tpb')) return 'thepiratebay';
  return 'other';
}

function getPriorityScore(stream) {
  const title = stream.title || '';
  const source = detectSource(title);
  const quality = getQuality(title);
  if (!quality) return 999;
  const index = SOURCE_PRIORITY.findIndex(p => 
    p.source === source && p.quality === quality
  );
  return index >= 0 ? index : 500;
}

function filterStream(stream) {
  const title = stream.title || '';
  if (!stream.url && !stream.infoHash) return false;
  const quality = getQuality(title);
  if (!ALLOWED_QUALITIES.includes(quality)) return false;
  if (getSeeders(stream) < MIN_SEEDERS) return false;
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

function sortStreams(streams) {
  const filtered = streams.filter(filterStream);
  
  filtered.sort((a, b) => {
    const scoreA = getPriorityScore(a);
    const scoreB = getPriorityScore(b);
    if (scoreA !== scoreB) return scoreA - scoreB;
    
    const seedsA = getSeeders(a);
    const seedsB = getSeeders(b);
    if (seedsA !== seedsB) return seedsB - seedsA;
    
    return 0;
  });
  
  return filtered;
}

app.get('/manifest.json', (req, res) => {
  res.json({
    id: 'org.ghostream.platinum',
    name: 'Ghostream Platinum 🚀',
    description: 'YTS→TPB→1337x→Rutor • 720p/1080p • ≥3 seeds',
    version: '3.8.1',
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
    const sorted = sortStreams(streams);
    res.json({ streams: sorted });
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
