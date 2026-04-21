import pkg from 'stremio-addon-sdk';
const { addonBuilder } = pkg;
import express from 'express';
import fetch from 'node-fetch';

const app = express();

const manifest = {
    id: "org.ghostream.platinum",
    name: "Ghostream Platinum \uD83D\uDE80",
    description: "High-speed 720p/1080p Filter (YTS, 1337x, TPB)",
    version: "3.5.0",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    catalogs: []
};

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async (args) => {
    try {
        const response = await fetch(`https://torrentio.strem.io/stream/${args.type}/${args.id}.json`);
        const { streams } = await response.json();

        if (!streams || streams.length === 0) return { streams: [] };

        const filtered = streams
            .filter(s => {
                const title = s.title.toLowerCase();
                // 1. Quality Filter: ONLY 720p or 1080p
                const isCorrectQuality = title.includes("720p") || title.includes("1080p");
                
                // 2. Source Filter: Only Platinum Sources
                const isPlatinumSource = title.includes("yts") || 
                                         title.includes("tpb") || 
                                         title.includes("thepiratebay") || 
                                         title.includes("1337x");
                
                return isCorrectQuality && isPlatinumSource;
            })
            .map(s => {
                // Branding the labels with your Rocket
                let sourceLabel = "TPB";
                if (s.title.toLowerCase().includes("yts")) sourceLabel = "YTS";
                if (s.title.toLowerCase().includes("1337x")) sourceLabel = "1337x";

                return {
                    name: `Ghostream \uD83D\uDE80`,
                    title: `${s.title.split('\n')[0]}\n\uD83D\uDE80 [${sourceLabel}] Platinum | 🚀 Clean Link`,
                    infoHash: s.infoHash,
                    url: s.url
                };
            });

        // Priority Sort: YTS first for speed
        const sorted = filtered.sort((a, b) => a.title.includes("YTS") ? -1 : 1);

        return { streams: sorted.slice(0, 15) };
    } catch (e) {
        console.error("Ghostream Error:", e.message);
        return { streams: [] };
    }
});

const addonInterface = builder.getInterface();

// Routes for Stremio
app.get("/manifest.json", (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(addonInterface.manifest);
});

app.get("/stream/:type/:id.json", async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const resp = await addonInterface.get("stream", req.params.type, req.params.id);
    res.json(resp);
});

// Root for health check
app.get("/", (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(addonInterface.manifest);
});

const port = process.env.PORT || 7000;
app.listen(port, () => {
    console.log(`Ghostream Platinum \uD83D\uDE80 is live on port ${port}`);
});
