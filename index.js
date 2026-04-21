const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 7000;

// ========== CORS MIDDLEWARE (REQUIRED FOR STREMIO) ==========
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ========== CONFIGURATION ==========
const UPSTREAM_URL = 'https://torrentio.strem.fun';   // Public Torrentio instance
const MIN_SEEDERS = 10;
const ALLOWED_QUALITIES = ['720p', '1080p'];
const PREFERRED_SOURCES = ['yts', '1337x', 'thepiratebay', 'tpb'];

// ========== HELPER FUNCTIONS ==========
function getQuality(title = '') {
  const lower = title.toLowerCase();
  if (lower.includes('1080p')) return '1080p';
  if (lower.includes('720p')) return '720p';
  return null;
}

function getSeeders(stream) {
  // Torrentio provides seeders in behaviorHints
  if (stream.behaviorHints?.seeders) return stream.behaviorHints.seeders;
  // Fallback: parse from title like "👤 150"
  const match = stream.title?.match(/👤\s*(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function isPreferredSource(title = '') {
  const lower = title.toLowerCase();
  return PREFERRED_SOURCES.some(src => lower.includes(src));
}

function filterStream(stream) {
  const title = stream.title || '';

  // Must have a valid link
  if (!stream.url && !stream.infoHash) {
    console.log(`   ❌ Filtered out: no URL/infoHash – ${title}`);
    return false;
  }

  const quality = getQuality(title);
  if (!ALLOWED_QUALITIES.includes(quality)) {
    console.log(`   ❌ Filtered out: wrong quality (${quality || 'none'}) – ${title}`);
    return false;
  }

  const seeders = getSeeders(stream);
  if (seeders < MIN_SEEDERS) {
    console.log(`   ❌ Filtered out: low seeds (${seeders}) – ${title}`);
    return false;
  }

  // Optional: strict source filter – uncomment to ONLY allow preferred sources
  // if (!isPreferredSource(title)) {
  //   console.log(`   ❌ Filtered out: not preferred source – ${title}`);
  //   return false;
  // }

  console.log(`   ✅ KEPT: ${quality} | ${seeders} seeds | ${title}`);
  return true;
}

// ========== MANIFEST ==========
app.get('/manifest.json', (req, res) => {
  res.json({
    id: 'org.ghostream.platinum',
    name: 'Ghostream Platinum 🚀',
    description: 'High-speed 720p/1080p Filter (YTS, 1337x, TPB)',
    version: '3.5.2',  // Bump version to force Stremio refresh
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    catalogs: []
  });
});

// ========== STREAM ENDPOINT ==========
app.get('/stream/:type/:id.json', async (req, res) => {
  const { type, id } = req.params;
  console.log(`\n📡 Request: ${type}/${id}`);

  try {
    const upstreamUrl = `${UPSTREAM_URL}/stream/${type}/${id}.json`;
    console.log(`🔗 Fetching upstream: ${upstreamUrl}`);

    const response = await fetch(upstreamUrl);
    if (!response.ok) {
      console.error(`❌ Upstream HTTP error: ${response.status}`);
      return res.json({ streams: [] });
    }

    const data = await response.json();
    const originalStreams = data.streams || [];
    console.log(`📦 Upstream returned ${originalStreams.length} streams`);

    // Log a few sample titles for inspection
    if (originalStreams.length > 0) {
      console.log('   Sample titles:');
      originalStreams.slice(0, 3).forEach(s => console.log(`      - ${s.title}`));
    }

    const filtered = originalStreams.filter(filterStream);
    console.log(`🎯 Filtered down to ${filtered.length} streams`);

    res.json({ streams: filtered });
  } catch (error) {
    console.error('🔥 Proxy error:', error.message);
    res.json({ streams: [] });
  }
});

// ========== DEBUG ENDPOINT ==========
// Visit this to see raw upstream response without filtering
app.get('/debug/:type/:id.json', async (req, res) => {
  const { type, id } = req.params;
  try {
    const upstreamUrl = `${UPSTREAM_URL}/stream/${type}/${id}.json`;
    const response = await fetch(upstreamUrl);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== STATUS ENDPOINT ==========
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    upstream: UPSTREAM_URL,
    minSeeders: MIN_SEEDERS,
    allowedQualities: ALLOWED_QUALITIES
  });
});

app.get('/', (req, res) => res.send('Ghostream is running. Use /manifest.json to install.'));

app.listen(PORT, () => {
  console.log(`👻 Ghostream listening on port ${PORT}`);
  console.log(`🌐 Upstream: ${UPSTREAM_URL}`);
  console.log(`📏 Min seeders: ${MIN_SEEDERS}`);
});
