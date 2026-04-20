import { addonBuilder } from "stremio-addon-sdk";
import express from "express";
import fetch from "node-fetch";

const app = express();
const manifest = {
    id: "org.ghostream.thunder",
    name: "⚡ GHOSTREAM THUNDER",
    description: "Instant torrent streams – as fast as Real‑Debrid",
    version: "11.0.0",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    catalogs: []
};

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async (args) => {
    try {
        // 1. Get streams from Torrentio
        const res = await fetch(`https://torrentio.strem.fun/stream/${args.type}/${args.id}.json`);
        const data = await res.json();
        const streams = data.streams || [];

        // 2. Filter only YTS (fastest, most seeds)
        const yts = streams.filter(s => {
            const title = (s.title || "").toLowerCase();
            return (title.includes("yts") || title.includes("yify")) && !title.includes("2160p");
        });

        if (yts.length === 0) return { streams: [] };

        // 3. Return magnet links + ultra‑aggressive trackers
        const trackers = [
            "udp://tracker.opentrackr.org:1337",
            "udp://tracker.coppersurfer.tk:6969",
            "udp://tracker.leechers-paradise.org:6969",
            "udp://exodus.desync.com:6969",
            "wss://tracker.btorrent.xyz",
            "wss://tracker.openwebtorrent.com"
        ];

        const streamList = yts.slice(0, 5).map(s => {
            const magnet = `magnet:?xt=urn:btih:${s.infoHash}&tr=${trackers.join("&tr=")}`;
            return {
                name: "⚡ THUNDER [YTS]",
                title: s.title,
                url: magnet,
                behaviorHints: {
                    notWebReady: true,       // Stremio uses its own engine
                    bingeGroup: "thunder",
                    videoSize: s.size || 0
                }
            };
        });

        return { streams: streamList };
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
app.listen(PORT, () => console.log(`⚡ Thunder ready on port ${PORT}`));
