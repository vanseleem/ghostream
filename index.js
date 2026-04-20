import { addonBuilder } from "stremio-addon-sdk";
import express from "express";
import fetch from "node-fetch";

const app = express();

// Force CORS headers on every response
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// NEW addon ID – forces Stremio to treat it as a fresh addon
const manifest = {
    id: "org.ghostream.railway.installable.v2",
    name: "🚀 GHOSTREAM (RAILWAY)",
    description: "Magnet links – Stremio torrent engine",
    version: "30.0.0",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    catalogs: []
};

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async (args) => {
    try {
        const response = await fetch(`https://torrentio.strem.fun/stream/${args.type}/${args.id}.json`);
        const data = await response.json();
        const streams = data.streams || [];

        const filtered = streams.filter(s => {
            const t = (s.title || "").toLowerCase();
            return (t.includes("yts") || t.includes("thepiratebay") || t.includes("tpb")) && !t.includes("2160p");
        });

        const sorted = filtered.sort((a, b) => {
            const aYTS = (a.title || "").toLowerCase().includes("yts");
            const bYTS = (b.title || "").toLowerCase().includes("yts");
            return aYTS === bYTS ? 0 : aYTS ? -1 : 1;
        });

        const trackers = [
            "udp://tracker.opentrackr.org:1337",
            "udp://tracker.coppersurfer.tk:6969",
            "wss://tracker.btorrent.xyz"
        ];
        const trackerParam = trackers.map(t => `tr=${encodeURIComponent(t)}`).join('&');

        const proxied = sorted.slice(0, 10).map(s => ({
            name: (s.title || "").toLowerCase().includes("yts") ? "🚀 GHOSTREAM [YTS]" : "🚀 GHOSTREAM [TPB]",
            title: s.title,
            url: `magnet:?xt=urn:btih:${s.infoHash}&${trackerParam}`,
            behaviorHints: { notWebReady: true }
        }));

        return { streams: proxied };
    } catch (e) {
        return { streams: [] };
    }
});

const addonInterface = builder.getInterface();
app.get("/manifest.json", (req, res) => res.json(addonInterface.manifest));
app.get("/stream/:type/:id.json", async (req, res) => {
    const resp = await addonInterface.get("stream", req.params.type, req.params.id);
    res.json(resp);
});
app.get("/", (req, res) => res.json(addonInterface.manifest));
app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
