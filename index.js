import { addonBuilder } from "stremio-addon-sdk";
import express from "express";
import fetch from "node-fetch";

const app = express();

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
});

const manifest = {
    id: "org.ghostream.clean",
    version: "1.0.0",
    name: "Ghostream Clean",
    description: "Fast 720p/1080p streams",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"]
};

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async ({ type, id }) => {
    try {
        const url = `https://torrentio.strem.fun/sort=seeders/stream/${type}/${id}.json`;
        const res = await fetch(url);
        const data = await res.json();

        let streams = data.streams || [];

        streams = streams
            .filter(s => {
                const name = (s.title || "").toLowerCase();
                if (name.includes("2160") || name.includes("4k")) return false;
                if (!name.includes("720") && !name.includes("1080")) return false;
                return true;
            })
            .slice(0, 15);

        return { streams };
    } catch {
        return { streams: [] };
    }
});

const addonInterface = builder.getInterface();

app.get("/manifest.json", (req, res) => {
    res.json(addonInterface.manifest);
});

app.get("/stream/:type/:id.json", async (req, res) => {
    try {
        const data = await addonInterface.get("stream", req.params.type, req.params.id);
        res.json(data);
    } catch {
        res.json({ streams: [] });
    }
});

app.get("/", (req, res) => {
    res.send("Ghostream running");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT);
