import { addonBuilder, serveHTTP } from "stremio-addon-sdk";
import fetch from "node-fetch";

const manifest = {
    id: "org.ghostream.platinum",
    name: "Ghostream Platinum \uD83D\uDE80",
    description: "High-speed 720p/1080p Filter (YTS & TPB)",
    version: "3.5.0",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    catalogs: []
};

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async (args) => {
    try {
        // Use the robust aggregator as the source to avoid IP blocks
        const response = await fetch(`https://torrentio.strem.io/stream/${args.type}/${args.id}.json`);
        const { streams } = await response.json();

        if (!streams || streams.length === 0) return { streams: [] };

        const filtered = streams
            .filter(s => {
                const title = s.title.toLowerCase();
                // 1. FILTER: Only 720p or 1080p
                const isQuality = title.includes("720p") || title.includes("1080p");
                
                // 2. FILTER: Only our preferred "Platinum" sources
                const isSource = title.includes("yts") || title.includes("tpb") || title.includes("thepiratebay") || title.includes("1337x");
                
                return isQuality && isSource;
            })
            .map(s => {
                // Determine source for the label
                let sourceLabel = "TPB";
                if (s.title.toLowerCase().includes("yts")) sourceLabel = "YTS";
                if (s.title.toLowerCase().includes("1337x")) sourceLabel = "1337x";

                return {
                    name: `Ghostream \uD83D\uDE80`,
                    title: `${s.title.split('\n')[0]}\n\uD83D\uDE80 [${sourceLabel}] Platinum Speed`,
                    infoHash: s.infoHash,
                    url: s.url // Direct link to the stream
                };
            });

        // Priority Sort: Put YTS at the top because it's usually 1080p and smaller file size
        const sorted = filtered.sort((a, b) => a.title.includes("YTS") ? -1 : 1);

        return { streams: sorted.slice(0, 15) };
    } catch (e) {
        console.error("Ghostream Error:", e.message);
        return { streams: [] };
    }
});

serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
