import { addonBuilder } from "stremio-addon-sdk";
import express from "express";
import fetch from "node-fetch";
import WebTorrent from "webtorrent";

const app = express();
const client = new WebTorrent({ maxConns: 50, uploadLimit: 0 });
const torrentCache = new Map();

const manifest = {
    id: "org.ghostream.render",
    name: "🔥 GHOSTREAM ULTIMATE",
    description: "Optimized for Railway - Instant Streaming",
    version: "9.0.0",
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
            const title = (s.title || "").toLowerCase();
            return (title.includes("yts") || title.includes("yify") || title.includes("thepiratebay")) 
                   && !title.includes("2160p") && !title.includes("4k");
        });

        const sorted = filtered.sort((a, b) => {
            const aYTS = (a.title || "").toLowerCase().includes("yts");
            const bYTS = (b.title || "").toLowerCase().includes("yts");
            return aYTS === bYTS ? 0 : aYTS ? -1 : 1;
        });

        const proxied = sorted.slice(0, 8).map(s => {
            const isYTS = (s.title || "").toLowerCase().includes("yts");
            const infoHash = s.infoHash;
            return {
                name: isYTS ? "💎 GHOSTREAM [YTS]" : "💎 GHOSTREAM [TPB]",
                title: s.title,
                url: `https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost'}/stream/${infoHash}/video.mp4`,
                behaviorHints: { notWebReady: false, proxyHeaders: true }
            };
        });

        return { streams: proxied };
    } catch (e) {
        console.error("Error:", e);
        return { streams: [] };
    }
});

app.get("/stream/:infoHash/video.mp4", (req, res) => {
    const { infoHash } = req.params;
    let torrent = torrentCache.get(infoHash);

    const sendVideo = (torrent) => {
        const videoFile = torrent.files.filter(f => /\.(mp4|mkv|avi)$/i.test(f.name)).sort((a, b) => b.length - a.length)[0];
        if (!videoFile) return res.status(404).send("No video file found");

        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : videoFile.length - 1;
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${videoFile.length}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': (end - start) + 1,
                'Content-Type': 'video/mp4'
            });
            videoFile.createReadStream({ start, end }).pipe(res);
        } else {
            res.writeHead(200, {
                'Content-Length': videoFile.length,
                'Content-Type': 'video/mp4',
                'Accept-Ranges': 'bytes'
            });
            videoFile.createReadStream().pipe(res);
        }
    };

    if (torrent && torrent.ready) return sendVideo(torrent);

    torrent = client.add(infoHash, {
        announce: ['wss://tracker.btorrent.xyz', 'wss://tracker.openwebtorrent.com', 'udp://tracker.opentrackr.org:1337']
    });
    torrentCache.set(infoHash, torrent);
    setTimeout(() => {
        if (torrentCache.get(infoHash) === torrent && torrent.numPeers === 0) {
            torrent.destroy();
            torrentCache.delete(infoHash);
        }
    }, 3600000);

    torrent.on('ready', () => sendVideo(torrent));
    torrent.on('error', (err) => {
        console.error(err);
        if (!res.headersSent) res.status(500).send("Torrent error");
    });
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
