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
    id: "org.ghostream.platinum.v1",
    name: "🏆 GHOSTREAM PLATINUM v1.0",
    description: "YTS + 1337x + TPB | 720p/1080p | High seeders",
    version: "1.0.0",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    catalogs: []
};

const builder = new addonBuilder(manifest);

// ---------- YTS API (most reliable) ----------
async function getYTS(imdbId) {
    try {
        const url = `https://yts.mx/api/v2/list_movies.json?query_term=${imdbId}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data.data?.movies?.length) return [];
        const movie = data.data.movies[0];
        const torrents = movie.torrents || [];
        return torrents
            .filter(t => t.quality === '1080p' || t.quality === '720p')
            .map(t => ({
                name: `🎬 YTS [${t.quality}] ${movie.title} (${movie.year}) - ${t.size}`,
                magnet: t.url,
                seeds: t.seeds || 200,
                quality: t.quality
            }));
    } catch (e) { return []; }
}

// ---------- 1337x via public proxy ----------
async function get1337x(imdbId) {
    try {
        // Use a 1337x search API that returns JSON (unofficial)
        const url = `https://1337x-proxy.com/search/${imdbId}/1/`;
        const res = await fetch(url);
        const html = await res.text();
        const magnetLinks = [];
        // Regex to extract magnet + title + seeders
        const magnetRegex = /href="(magnet:\?xt=urn:btih:[^"]+)".*?<td class="name">.*?<a[^>]*>([^<]+)<\/a>.*?<td class="seeds">(\d+)</gs;
        let match;
        while ((match = magnetRegex.exec(html)) !== null) {
            const seeds = parseInt(match[3]);
            if (seeds > 0) {
                magnetLinks.push({
                    name: `🔥 1337x ${match[2].trim()}`,
                    magnet: match[1],
                    seeds: seeds
                });
            }
        }
        // Filter 720p/1080p (heuristic)
        return magnetLinks
            .filter(m => /1080p|720p|bluray|web-dl/i.test(m.name))
            .slice(0, 5);
    } catch (e) { return []; }
}

// ---------- ThePirateBay (apibay.org) ----------
async function getTPB(imdbId) {
    try {
        // First get movie title via OMDB (free, no key for basic)
        const titleRes = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=apikey`); // no key? Let's use YTS for title
        let movieTitle = imdbId;
        try {
            const ytsTitle = await fetch(`https://yts.mx/api/v2/list_movies.json?query_term=${imdbId}`);
            const ytsData = await ytsTitle.json();
            if (ytsData.data?.movies?.[0]) movieTitle = ytsData.data.movies[0].title;
        } catch(e) {}
        
        const searchUrl = `https://apibay.org/q.php?q=${encodeURIComponent(movieTitle)}&cat=200`;
        const res = await fetch(searchUrl);
        const data = await res.json();
        if (!data.length) return [];
        return data
            .filter(t => {
                const name = t.name.toLowerCase();
                return (name.includes('1080p') || name.includes('720p')) && !name.includes('2160p');
            })
            .map(t => ({
                name: `🏴‍☠️ TPB ${t.name}`,
                magnet: `magnet:?xt=urn:btih:${t.info_hash}&dn=${encodeURIComponent(t.name)}`,
                seeds: t.seeders || 0
            }))
            .sort((a,b) => b.seeds - a.seeds)
            .slice(0, 5);
    } catch (e) { return []; }
}

// ---------- Stream handler ----------
builder.defineStreamHandler(async (args) => {
    const imdbId = args.id;
    try {
        const [yts, tpb, leet] = await Promise.all([
            getYTS(imdbId),
            getTPB(imdbId),
            get1337x(imdbId)
        ]);
        
        // Combine all, sort by seeds (if available)
        let all = [...yts, ...tpb, ...leet];
        all.sort((a,b) => (b.seeds || 0) - (a.seeds || 0));
        
        // Build final stream objects
        const streams = all.slice(0, 12).map(s => ({
            name: s.name,
            title: s.name,
            url: s.magnet,
            behaviorHints: { notWebReady: true }
        }));
        
        return { streams };
    } catch (err) {
        console.error(err);
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
app.listen(PORT, () => console.log(`🏆 Platinum v1.0 running on port ${PORT}`));
