const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const axios = require("axios");
const manifest = require("./manifest");

const builder = new addonBuilder(manifest);

// Using a stable aggregator to feed the proxy
const AGGREGATOR_URL = "https://torrentio.strem.io/streams/"; 

builder.defineStreamHandler(async ({ type, id }) => {
    try {
        const response = await axios.get(`${AGGREGATOR_URL}${type}/${id}.json`, { timeout: 5000 });
        const rawStreams = response.data.streams || [];

        const filtered = rawStreams
            .filter(s => {
                const title = s.title.toLowerCase();
                // ONLY 720p or 1080p
                const isQuality = title.includes("720p") || title.includes("1080p");
                
                // Extract seeders from the title string (looking for 👤 or /s:)
                const seederMatch = title.match(/👤\s*(\d+)/) || title.match(/s:\s*(\d+)/);
                const seeders = seederMatch ? parseInt(seederMatch[1]) : 0;
                
                return isQuality && seeders >= 15; 
            })
            .map(s => {
                // If there's no infoHash but there is a magnet link, extract it manually
                let infoHash = s.infoHash;
                if (!infoHash && s.url && s.url.includes("magnet:")) {
                    const match = s.url.match(/btih:([a-zA-Z0-9]+)/);
                    if (match) infoHash = match[1];
                }

                return {
                    name: "Ghostream Platinum",
                    title: s.title.split('\n')[0] + "\n⚡ High-Speed Verified",
                    infoHash: infoHash,
                    url: s.url
                };
            });

        return { streams: filtered.slice(0, 10) };
    } catch (e) {
        console.error("Fetch Error:", e.message);
        return { streams: [] };
    }
});

serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
