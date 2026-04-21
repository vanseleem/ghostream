import { addonBuilder } from "stremio-addon-sdk";
import express from "express";
import fetch from "node-fetch";

const app = express();

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

const manifest = {
    id: "org.ghostream.railway.final.v4",
    name: "🚀 GHOSTREAM (STABLE)",
    description: "Optimized magnets for fast Stremio playback",
    version: "40.0.0",
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
            return !t.includes("2160p") && (
                t.includes("1080p") ||
                t.includes("720p")
            ) && (
                t.includes("yts") ||
                t.includes("rarbg") ||
                t.includes("1337") ||
                t.includes("ettv") ||
                t.includes("eztv")
            );
        });

        const sorted = filtered.sort((a, b) => {
            const a720 = (a.title || "").includes("720p");
            const b720 = (b.title || "").includes("720p");
            if (a720 !== b720) return a720 ? -1 : 1;

            const aYTS = (a.title || "").toLowerCase().includes("yts");
            const bYTS = (b.title || "").toLowerCase().includes("yts");
            if (aYTS !== bYTS) return aYTS ? -1 : 1;

            return 0;
        });

        const trackers = [
            "udp://tracker.opentrackr.org:1337/announce",
            "udp://tracker.openbittorrent.com:6969/announce",
            "udp://tracker.torrent.eu.org:451/announce",
            "udp://explodie.org:6969/announce",
            "wss://tracker.btorrent.xyz",
            "wss://tracker.openwebtorrent.com"
        ];

        const trackerParam = trackers.map(t => `tr=${encodeURIComponent(t)}`).join('&');

        const proxied = sorted.slice(0, 10).map(s => ({
            name: (s.title || "").toLowerCase().includes("yts") ? "🚀 GHOSTREAM [YTS]" : "🚀 GHOSTREAM",
            title: s.title,
            url: `magnet:?xt=urn:btih:${s.infoHash}&${trackerParam}`,
            behaviorHints: { notWebReady: true }
        }));

        return { streams: proxied };
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

app.get("/", (req, res) => res.json(addonInterface.manifest));
app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
