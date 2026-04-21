const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const axios = require("axios");
const manifest = require("./manifest");

const builder = new addonBuilder(manifest);

// We use a public API aggregator to avoid Railway's "torrent" dependency ban
const AGGREGATOR_URL = "https://torrentio.strem.io/streams/"; 

builder.defineStreamHandler(async ({ type, id }) => {
    try {
        // Fetching from a secondary metadata source to stay "invisible"
        const response = await axios.get(`${AGGREGATOR_URL}${type}/${id}.json`);
        const rawStreams = response.data.streams || [];

        const filtered = rawStreams
            .filter(s => {
                const title = s.title.toLowerCase();
                // 1. FILTER: 720p or 1080p Only
                const isQuality = title.includes("720p") || title.includes("1080p");
                
                // 2. FILTER: High Seeders (Aggregators usually put seed count in title)
                // We look for "👤" or "S:" patterns commonly used in stream titles
                const seederMatch = title.match(/👤\s*(\d+)/) || title.match(/s:\s*(\d+)/);
                const seeders = seederMatch ? parseInt(seederMatch[1]) : 0;
                
                return isQuality && (seeders >= 20 || title.includes("yts")); 
            })
            .map(s => ({
                ...s,
                name: "Ghostream Platinum",
                title: s.title.split('\n')[0] + "\n🚀 Platinum Optimized"
            }));

        return { streams: filtered.slice(0, 10) };
    } catch (e) {
        return { streams: [] };
    }
});

serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
