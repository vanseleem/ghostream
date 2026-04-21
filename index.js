const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const TorrentSearchApi = require('torrent-search-api');
const magnet = require('magnet-uri');
const manifest = require("./manifest");

// Setup Providers
TorrentSearchApi.enableProvider('Yts');
TorrentSearchApi.enableProvider('1337x');
TorrentSearchApi.enableProvider('Rutracker');

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async ({ type, id }) => {
    try {
        // Search multiple sources
        const results = await TorrentSearchApi.search(id, type === 'movie' ? 'Movies' : 'TV', 30);

        const streams = results
            .filter(t => {
                const name = t.title.toLowerCase();
                // FILTER: Only 720p or 1080p
                const isQuality = name.includes("720p") || name.includes("1080p");
                // FILTER: High Seeders only (Threshold: 20)
                const isHighSeed = (parseInt(t.seeds) || 0) >= 20;
                return isQuality && isHighSeed;
            })
            .map(t => {
                // Extract infoHash from magnet if available
                const parsed = t.magnet ? magnet.decode(t.magnet) : {};
                const infoHash = t.infoHash || parsed.infoHash;

                return {
                    name: `Ghostream Platinum`,
                    title: `${t.title}\n👤 Seeds: ${t.seeds} | Provider: ${t.provider}`,
                    infoHash: infoHash,
                    sources: t.magnet ? [t.magnet] : []
                };
            })
            // Sort by seeders (highest first)
            .sort((a, b) => b.title.match(/\d+/)[0] - a.title.match(/\d+/)[0]);

        return { streams: streams.slice(0, 15) };
    } catch (e) {
        console.error(e);
        return { streams: [] };
    }
});

serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
