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
  'https://torrentio.stremio.my.id',
  'https://stremio-rutor-proxy.onrender.com'
];

const MIN_SEEDERS = 5;
const ALLOWED_QUALITIES = ['720p', '1080p'];
const REQUIRED_SOURCES = ['yts', 'thepiratebay', 'tpb', 'torrentgalaxy', '1337x', 'eztv', 'rutor'];

function getQuality(title = '') {
  const lower = title.toLowerCase();
  if (lower.includes('720p')) return '720p';
  if (lower.includes('1080p')) return '1080p';
  return null;
}

function getSeeders(stream) {
  if (stream.behaviorHints?.seeders) return stream.behaviorHints.seeders;
  const match = stream.title?.match(/👤\s*(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function hasRequiredSource(title = '') {
  const lower = title.toLowerCase();
  return REQUIRED_SOURCES.some(src => lower.includes(src));
}

function filterStream(stream) {
  const title = stream.title || '';
  if (!stream.url && !stream.infoHash) return false;
  if (!ALLOWED_QUALITIES.includes(getQuality(title))) return false;
  if (getSeeders(stream) < MIN_SEEDERS) return false;
  if (!hasRequiredSource(title)) return false;
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

app.get('/manifest.json', (req, res) => {
  res.json({
    id: 'org.ghostream.platinum',
    name: 'Ghostream Platinum 🚀',
    description: '720p/1080p only – YTS, 1337x, EZTV, Rutor',
    version: '3.7.0',
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
    const filtered = streams.filter(filterStream);
    res.json({ streams: filtered });
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
