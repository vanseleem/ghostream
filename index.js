import { addonBuilder } from "stremio-addon-sdk";
import express from "express";
import fetch from "node-fetch";

const app = express();

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

const manifest = {
    id: "org.ghostream.railway.final.v5",
    name: "🚀 GHOSTREAM (FIXED)",
    description: "Direct torrent streams via Stremio engine",
    version: "50.0.0",
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
            return !t.includes("2160p") &&
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
            infoHash: s.infoHash,
            fileIdx: 0
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

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
