import { addonBuilder } from "stremio-addon-sdk";
import express from "express";
import fetch from "node-fetch";

const app = express();

// CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

const manifest = {
    id: "org.ghostream.yts.1337x",
    name: "🎬 GHOSTREAM YTS + 1337x",
    description: "720p/1080p only – YTS & 1337x",
    version: "33.0.0",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    catalogs: []
};

const builder = new addonBuilder(manifest);

// 1337x API proxy (using public API)
async function search1337x(imdbId) {
    try {
        // Using 1337x public API endpoint
        const response = await fetch(`https://1337x.to/cat/Movies/${imdbId}/1/`);
        const html = await response.text();
        
        // Simple regex to extract magnet links and titles
        const magnetRegex = /href="(magnet:\?xt=urn:btih:[^"]+)"[^>]*>([^<]+)/gi;
        const matches = [];
        let match;
        
        while ((match = magnetRegex.exec(html)) !== null) {
            matches.push({
                name: match[2],
                magnet: match[1],
                seeds: parseInt(match[2].match(/(\d+) seeder/)?.[1] || 0)
            });
        }
        
        return matches.slice(0, 5);
    } catch (e) {
        return [];
    }
}

// YTS API (more reliable)
async function searchYTS(imdbId) {
    try {
        const response = await fetch(`https://yts.mx/api/v2/list_movies.json?query_term=${imdbId}`);
        const data = await response.json();
        
        if (!data.data?.movies?.[0]) return [];
        
        const movie = data.data.movies[0];
        const torrents = movie.torrents || [];
        
        // Filter 720p/1080p only
        return torrents
            .filter(t => t.quality === '1080p' || t.quality === '720p')
            .map(t => ({
                name: `${movie.title} (${movie.year}) - ${t.quality} - ${t.size}`,
                magnet: t.url,
                quality: t.quality,
                seeds: t.seeds || 100
            }));
    } catch (e) {
        return [];
    }
}

builder.defineStreamHandler(async (args) => {
    try {
        const imdbId = args.id;
        const trackers = ["udp://tracker.opentrackr.org:1337", "udp://tracker.coppersurfer.tk:6969"];
        const trackerParam = trackers.map(t => `tr=${encodeURIComponent(t)}`).join('&');
        
        // Fetch from both sources in parallel
        const [ytsResults, tpbResults] = await Promise.all([
            searchYTS(imdbId),
            search1337x(imdbId)
        ]);
        
        const streams = [];
        
        // Add YTS results first (prioritize YTS)
        for (const result of ytsResults) {
            streams.push({
                name: `🎬 YTS ${result.quality || ''}`,
                title: result.name,
                url: result.magnet.includes('magnet:') ? result.magnet : `magnet:?xt=urn:btih:${result.magnet}&${trackerParam}`,
                behaviorHints: { notWebReady: true }
            });
        }
        
        // Add 1337x results (limit to 3)
        for (const result of tpbResults.slice(0, 3)) {
            streams.push({
                name: "🔥 1337x",
                title: result.name,
                url: result.magnet,
                behaviorHints: { notWebReady: true }
            });
        }
        
        return { streams: streams.slice(0, 8) };
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
app.get("/", (req, res) => res.json(addonInterface.manifest));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
