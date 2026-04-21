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
  'https://torrentio.stremio.my.id'
];

const MIN_SEEDERS = 1;
const ALLOWED_QUALITIES = ['480p', '576p', '720p', '1080p', 'webrip', 'webdl'];
const MAX_SIZE_GB = 8;

// Source order within each quality
const SOURCE_CONFIG = [
  { name: 'yts', display: 'YTS', order: 1 },
  { name: 'yify', display: 'YTS', order: 1 },
  { name: 'torrentgalaxy', display: 'TGx', order: 2 },
  { name: 'thepiratebay', display: 'TPB', order: 3 },
  { name: 'tpb', display: 'TPB', order: 3 },
  { name: '1337x', display: '1337x', order: 4 },
  { name: 'rutor', display: 'Rutor', order: 5 },
  { name: 'eztv', display: 'EZTV', order: 6 },
  { name: 'rarbg', display: 'RARBG', order: 7 },
  { name: 'nyaasi', display: 'Nyaa', order: 8 },
  { name: 'torrent9', display: 'Torrent9', order: 9 }
];

// Quality ranking (highest priority first)
const QUALITY_RANK = {
  '720p': 1,
  'webrip': 2,
  'webdl': 3,
  '1080p': 4,
  '576p': 5,
  '480p': 6
};

function getQuality(title = '') {
  const lower = title.toLowerCase();
  if (lower.includes('1080p')) return '1080p';
  if (lower.includes('720p')) return '720p';
  if (lower.includes('480p')) return '480p';
  if (lower.includes('576p')) return '576p';
  if (lower.includes('webrip')) return 'webrip';
  if (lower.includes('webdl') || lower.includes('web-dl')) return 'webdl';
  return null;
}

function getSeeders(stream) {
  if (stream.behaviorHints?.seeders) return stream.behaviorHints.seeders;
  const match = stream.title?.match(/👤\s*(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function getSizeInGB(stream) {
  const title = stream.title || '';
  const sizeMatch = title.match(/💾\s*([\d.]+)\s*(GB|MB)/i) || 
                    title.match(/([\d.]+)\s*(GB|MB)/i);
  if (!sizeMatch) return null;
  
  const value = parseFloat(sizeMatch[1]);
  const unit = sizeMatch[2].toUpperCase();
  
  if (unit === 'GB') return value;
  if (unit === 'MB') return value / 1024;
  return null;
}

function detectSource(title = '') {
  const lower = title.toLowerCase();
  for (const src of SOURCE_CONFIG) {
    if (lower.includes(src.name)) return src.name;
  }
  return null;
}

function getSourceOrder(sourceName) {
  const config = SOURCE_CONFIG.find(c => c.name === sourceName);
  return config ? config.order : 999;
}

function filterStream(stream) {
  const title = stream.title || '';
  if (!stream.url && !stream.infoHash) return false;
  
  const quality = getQuality(title);
  if (!ALLOWED_QUALITIES.includes(quality)) return false;
  
  if (getSeeders(stream) < MIN_SEEDERS) return false;
  
  if (!detectSource(title)) return false;
  
  const sizeGB = getSizeInGB(stream);
  if (sizeGB !== null && sizeGB > MAX_SIZE_GB) return false;
  
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

function sortAndGroup(streams) {
  const filtered = streams.filter(filterStream);
  
  // Group by QUALITY only (ignore source for top-level grouping)
  const byQuality = {};
  filtered.forEach(stream => {
    const quality = getQuality(stream.title);
    if (!byQuality[quality]) byQuality[quality] = [];
    byQuality[quality].push(stream);
  });
  
  // For each quality group, sort by source order, then seeders
  for (const quality in byQuality) {
    byQuality[quality].sort((a, b) => {
      const sourceA = detectSource(a.title);
      const sourceB = detectSource(b.title);
      const orderA = getSourceOrder(sourceA);
      const orderB = getSourceOrder(sourceB);
      if (orderA !== orderB) return orderA - orderB;
      return getSeeders(b) - getSeeders(a);
    });
  }
  
  // Flatten in quality rank order
  const result = [];
  const sortedQualities = Object.keys(byQuality).sort((a, b) => {
    const rankA = QUALITY_RANK[a] || 999;
    const rankB = QUALITY_RANK[b] || 999;
    return rankA - rankB;
  });
  
  sortedQualities.forEach(quality => {
    result.push(...byQuality[quality]);
  });
  
  return result;
}

app.get('/manifest.json', (req, res) => {
  res.json({
    id: 'org.ghostream.platinum',
    name: 'Ghostream Platinum 🚀',
    description: 'Made With 🧡 By VAN',
    version: '7.2.0',
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
    const sorted = sortAndGroup(streams);
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
