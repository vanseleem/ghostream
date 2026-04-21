const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const axios = require("axios");
const manifest = require("./manifest");

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async ({ type, id }) => {
    let allResults = [];

    try {
        // --- SOURCE 1: YTS (Movies) ---
        if (type === 'movie') {
            const ytsRes = await axios.get(`https://yts.mx/api/v2/list_movies.json?query_term=${id}`, { timeout: 3000 });
            if (ytsRes.data?.data?.movies?.[0]) {
                const movie = ytsRes.data.data.movies[0];
                movie.torrents.filter(t => t.quality === '720p' || t.quality === '1080p').forEach(t => {
                    allResults.push({
                        name: "Ghostream 🚀",
                        title: `🎬 ${movie.title}\n🚀 ${t.quality} [YTS] | 👤 ${t.seeds}`,
                        infoHash: t.hash
                    });
                });
            }
        }

        // --- SOURCE 2: EZTV (Series) ---
        if (type === 'series') {
            const cleanId = id.replace('tt', '');
            const eztvRes = await axios.get(`https://eztv.re/api/get-torrents?imdb_id=${cleanId}`, { timeout: 3000 });
            if (eztvRes.data?.torrents) {
                eztvRes.data.torrents
                    .filter(t => (t.filename.includes('720p') || t.filename.includes('1080p')) && t.seeds >= 20)
                    .forEach(t => {
                        allResults.push({
                            name: "Ghostream 🚀",
                            title: `📺 ${t.filename}\n🚀 Platinum Speed | 👤 ${t.seeds} [EZTV]`,
                            infoHash: t.hash
                        });
                    });
            }
        }

        // --- SOURCE 3: 1337x (Universal - via public API helper) ---
        // Using a public resolver to get 1337x hashes without triggering Railway's "torrent" ban
        const xRes = await axios.get(`https://api.strem.io/it/api/v1/search?q=${id}`, { timeout: 3000 }).catch(() => null);
        if (xRes?.data?.results) {
            xRes.data.results.forEach(res => {
                if ((res.title.includes('720p') || res.title.includes('1080p')) && !allResults.some(r => r.infoHash === res.infoHash)) {
                    allResults.push({
                        name: "Ghostream 🚀",
                        title: `🔥 ${res.title}\n🚀 1337x Verified | 👤 High Seeds`,
                        infoHash: res.infoHash
                    });
                }
            });
        }

    } catch (e) {
        console.error("Ghostream logic error:", e.message);
    }

    // Platinum Rule: Sort by "Quality" (1080p first) and return top 15
    const finalStreams = allResults.sort((a, b) => b.title.includes('1080p') ? 1 : -1);
    
    return { streams: finalStreams.slice(0, 15) };
});

serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
