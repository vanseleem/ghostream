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
    id: "org.ghostream.railway.final.v6",
    name: "🚀 GHOSTREAM (FINAL)",
    description: "Clean magnet streams for Stremio",
    version: "60.0.0",
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
            return s.infoHash &&
                s.infoHash.length === 40 &&
                !t.includes("2160p") &&
                (t.includes("1080p") || t.includes("720p"));
        });

        const sorted = filtered.sort((a, b) => {
            const a720 = (a.title || "").includes("720p");
            const b720 = (b.title || "").includes("720p");
            if (a720 !== b720) return a720 ? -1 : 1;
            return 0;
        });

        const proxied = sorted.slice(0, 10).map(s => ({
            name: "🚀 GHOSTREAM",
            title: s.title,
            url: `magnet:?xt=urn:btih:${s.infoHash}`,
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
