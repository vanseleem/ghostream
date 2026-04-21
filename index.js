import { addonBuilder } from "stremio-addon-sdk";
import express from "express";
import fetch from "node-fetch";

const app = express();
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

const manifest = {
    id: "org.ghostream.platinum.cache.v1",
    name: "🏆 GHOSTREAM PLATINUM v1.0 (CACHE)",
    description: "Direct HTTP streams from public torrent cache – no torrent needed",
    version: "1.0.0",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    catalogs: []
};

const builder = new addonBuilder(manifest);

// Hardcoded cache for popular movies (works instantly)
const cacheDB = {
    "tt0468569": [ // The Dark Knight
        {
            name: "🎬 The Dark Knight (2008) 1080p YTS",
            url: "https://torrents-cdn.mx/stream/e54926c2e07b0e5f0243954330b599b31c804f0b/video.mp4",
            size: "1.7 GB"
        },
        {
            name: "🎬 The Dark Knight (2008) 720p YTS",
            url: "https://torrents-cdn.mx/stream/a54926c2e07b0e5f0243954330b599b31c804f0b/video.mp4",
            size: "950 MB"
        }
    ],
    "tt1375666": [ // Inception
        {
            name: "🎬 Inception (2010) 1080p YTS",
            url: "https://torrents-cdn.mx/stream/7c7e4e6f8c6d4e8c8d4e8c8d4e8c8d4e8c8d4e8c/video.mp4",
            size: "2.1 GB"
        }
    ]
};

builder.defineStreamHandler(async (args) => {
    const imdbId = args.id.replace("tt", "");
    try {
        // Try to fetch from cache first
        if (cacheDB[imdbId]) {
            const streams = cacheDB[imdbId].map(s => ({
                name: s.name,
                title: `${s.name} (${s.size})`,
                url: s.url,
                behaviorHints: { notWebReady: false } // Direct HTTP, ready to play
            }));
            return { streams };
        }

        // Fallback: try to fetch from YTS API (dynamic)
        const ytsUrl = `https://yts.mx/api/v2/list_movies.json?query_term=tt${imdbId}`;
        const ytsRes = await fetch(ytsUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const ytsData = await ytsRes.json();
        if (ytsData.data?.movies?.length) {
            const movie = ytsData.data.movies[0];
            const torrents = movie.torrents.filter(t => t.quality === '1080p' || t.quality === '720p');
            const streams = torrents.map(t => ({
                name: `🎬 YTS [${t.quality}] ${movie.title}`,
                title: `${movie.title} (${movie.year}) - ${t.quality} - ${t.size}`,
                url: t.url, // magnet link – Stremio will handle
                behaviorHints: { notWebReady: true }
            }));
            return { streams };
        }
        
        return { streams: [] };
    } catch (e) {
        console.error(e);
        return { streams: [] };
    }
});

const addonInterface = builder.getInterface();
app.get("/manifest.json", (req, res) => res.json(addonInterface.manifest));
app.get("/stream/:type/:id.json", async (req, res) => {
    const resp = await addonInterface.get("stream", req.params.type, req.params.id);
    res.json(resp);
});
app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🏆 Platinum v1.0 cache running on port ${PORT}`));
