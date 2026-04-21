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

const SOURCE_ORDER = ['yts', 'thepiratebay', 'tpb', '1337x', 'eztv', 'rutor'];

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

function getSourceRank(title = '') {
  const lower = title.toLowerCase();
  for (let i = 0; i < SOURCE_ORDER.length; i++) {
    if (lower.includes(SOURCE_ORDER[i])) return i;
  }
  return SOURCE_ORDER.length; // others go last
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
  return streams
    .filter(filterStream)
    .sort((a, b) => {
      const rankA = getSourceRank(a.title);
      const rankB = getSourceRank(b.title);
      if (rankA !== rankB) return rankA - rankB;
      
      const qualityA = getQuality(a.title);
      const qualityB = getQuality(b.title);
      if (qualityA === '1080p' && qualityB === '720p') return -1;
      if (qualityA === '720p' && qualityB === '1080p') return 1;
      
      return getSeeders(b) - getSeeders(a);
    });
}

app.get('/manifest.json', (req, res) => {
  res.json({
    id: 'org.ghostream.platinum',
    name: 'Ghostream Platinum 🚀',
    description: 'YTS→TPB→1337x→EZTV→Rutor • 720p/1080p • ≥3 seeds',
    version: '3.9.0',
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
