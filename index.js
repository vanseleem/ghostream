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
const MIN_SEEDERS = 5;
const ALLOWED_QUALITIES = ['720p', '1080p'];

function getQuality(title = '') {
  const lower = title.toLowerCase();
  if (lower.includes('1080p')) return '1080p';
  if (lower.includes('720p')) return '720p';
  return null;
}

function getSeeders(stream) {
  if (stream.behaviorHints?.seeders && stream.behaviorHints.seeders > 0) return stream.behaviorHints.seeders;
  const match = stream.title?.match(/👤\s*(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function filterStream(stream) {
  const title = stream.title || '';
  if (!stream.url && !stream.infoHash) return false;
  const quality = getQuality(title);
  if (!ALLOWED_QUALITIES.includes(quality)) return false;
  const seeders = getSeeders(stream);
  if (seeders < MIN_SEEDERS) return false;
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
    } catch (e) {
      console.error(`Upstream ${baseUrl} failed:`, e.message);
    }
  }
  return [];
}

app.get('/manifest.json', (req, res) => {
  res.json({
    id: 'org.ghostream.platinum',
    name: 'Ghostream Platinum',
    description: '720p/1080p only, min 5 seeds',
    version: '3.6.0',
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

app.listen(PORT, () => console.log(`Ghostream on ${PORT}`));
