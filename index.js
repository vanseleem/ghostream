import { addonBuilder } from "stremio-addon-sdk";
import express from "express";
import fetch from "node-fetch";

const app = express();

const manifest = {
    id: "org.ghostream.railway.final.v9",
    name: "🚀 GHOSTREAM (CLEAN)",
    description: "Stable Torrentio passthrough",
    version: "90.0.0",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    catalogs: []
};

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async (args) => {
    try {
        const response = await fetch(
            `https://torrentio.strem.fun/stream/${args.type}/${args.id}.json`
        );

        const data = await response.json();
        const streams = data.streams || [];

        const filtered = streams.filter(s => {
            const t = (s.title || "").toLowerCase();
            return !t.includes("2160p");
        });

        return { streams: filtered.slice(0, 10) };
    } catch (e) {
        console.error(e);
        return { streams: [] };
    }
});

const addonInterface = builder.getInterface();

app.get("/manifest.json", (req, res) => {
    res.json(addonInterface.manifest);
});

app.get("/stream/:type/:id.json", (req, res) => {
    addonInterface.get("stream", req.params.type, req.params.id)
        .then(data => res.json(data))
        .catch(() => res.json({ streams: [] }));
});

app.get("/", (req, res) => res.json(addonInterface.manifest));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Running on ${PORT}`));
