import { addonBuilder } from "stremio-addon-sdk";
import express from "express";
import fetch from "node-fetch";
import WebTorrent from "webtorrent";

const app = express();
const client = new WebTorrent({ 
    maxConns: 100,
    uploadLimit: 0,
    dht: true,
    tracker: true
});
const torrentCache = new Map();

// CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

const manifest = {
    id: "org.ghostream.render",
    name: "🔥 GHOSTREAM ULTIMATE",
    description: "Optimized for Railway - Instant Streaming",
    version: "9.2.0",
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
                url: `https://ghostream-production.up.railway.app/stream/${infoHash}/video.mp4`,
                behaviorHints: { 
                    notWebReady: false, 
                    proxyHeaders: true,
                    videoSize: s.size || 0
                }
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
    
    // CHECK if torrent already exists and is ready
    let torrent = torrentCache.get(infoHash);
    
    // If torrent exists but is destroyed, remove it
    if (torrent && torrent.destroyed) {
        torrentCache.delete(infoHash);
        torrent = null;
    }

    const sendVideo = (torrent) => {
        const videoFile = torrent.files
            .filter(f => /\.(mp4|mkv|avi|mov)$/i.test(f.name))
            .sort((a, b) => b.length - a.length)[0];
        
        if (!videoFile) {
            res.status(404).send("No video file found");
            return;
        }

        console.log(`Streaming: ${videoFile.name} (${videoFile.length} bytes)`);

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
            const stream = videoFile.createReadStream({ start, end });
            stream.pipe(res);
            req.on('close', () => stream.destroy());
        } else {
            res.writeHead(200, {
                'Content-Length': videoFile.length,
                'Content-Type': 'video/mp4',
                'Accept-Ranges': 'bytes'
            });
            const stream = videoFile.createReadStream();
            stream.pipe(res);
            req.on('close', () => stream.destroy());
        }
    };

    // If torrent is ready, stream it
    if (torrent && torrent.ready) {
        sendVideo(torrent);
        return;
    }
    
    // If torrent exists but not ready, wait for it
    if (torrent && !torrent.ready) {
        console.log(`Waiting for existing torrent: ${infoHash} (${Math.round(torrent.progress * 100)}%)`);
        
        const checkReady = setInterval(() => {
            if (torrent.ready) {
                clearInterval(checkReady);
                sendVideo(torrent);
            }
        }, 1000);
        
        req.on('close', () => clearInterval(checkReady));
        return;
    }

    // NEW TORRENT - Add it
    const trackers = [
        'wss://tracker.btorrent.xyz',
        'wss://tracker.openwebtorrent.com',
        'wss://tracker.fastcast.nz',
        'udp://tracker.opentrackr.org:1337',
        'udp://tracker.coppersurfer.tk:6969',
        'udp://tracker.leechers-paradise.org:6969',
        'udp://exodus.desync.com:6969',
        'udp://open.demonii.com:1337',
        'udp://tracker.internetwarriors.net:1337'
    ];

    console.log(`Starting NEW torrent: ${infoHash}`);
    
    torrent = client.add(infoHash, { announce: trackers });
    torrentCache.set(infoHash, torrent);

    // Send progress updates
    torrent.on('download', () => {
        if (!torrent.ready) {
            const percent = Math.round(torrent.progress * 100);
            if (percent % 10 === 0) { // Log every 10%
                console.log(`Downloading ${infoHash}: ${percent}% - ${(torrent.downloadSpeed/1000000).toFixed(2)} MB/s`);
            }
        }
    });

    torrent.on('ready', () => {
        console.log(`Torrent READY: ${infoHash} - ${torrent.name}`);
        sendVideo(torrent);
    });
    
    torrent.on('error', (err) => {
        console.error(`Torrent error: ${err.message}`);
        if (!res.headersSent) {
            res.status(500).send(`Torrent error: ${err.message}`);
        }
        torrentCache.delete(infoHash);
    });

    // Timeout after 90 seconds
    const timeout = setTimeout(() => {
        if (!torrent.ready && !res.headersSent) {
            console.log(`Timeout for ${infoHash}`);
            res.status(408).send("Torrent taking too long. Try another source.");
            if (torrent) torrent.destroy();
            torrentCache.delete(infoHash);
        }
    }, 90000);

    req.on('close', () => {
        clearTimeout(timeout);
        // Don't destroy torrent immediately - keep in cache for next user
    });
});

// Cleanup old torrents every hour
setInterval(() => {
    const now = Date.now();
    for (const [hash, torrent] of torrentCache.entries()) {
        if (torrent.ready && torrent.numPeers === 0) {
            // Remove old torrents that are not being used
            torrent.destroy();
            torrentCache.delete(hash);
            console.log(`Cleaned up: ${hash}`);
        }
    }
}, 3600000);

const addonInterface = builder.getInterface();
app.get("/manifest.json", (req, res) => res.json(addonInterface.manifest));
app.get("/stream/:type/:id.json", async (req, res) => {
    const resp = await addonInterface.get("stream", req.params.type, req.params.id);
    res.json(resp);
});
app.get("/", (req, res) => res.json(addonInterface.manifest));
app.get("/health", (req, res) => res.json({ status: "ok", torrents: torrentCache.size }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
