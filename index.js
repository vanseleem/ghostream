const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const axios = require("axios");
const manifest = require("./manifest");

const builder = new addonBuilder(manifest);

// Stealth Headers to bypass cloud blocks
const stealthHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json'
};

builder.defineStreamHandler(async ({ type, id }) => {
    let streams = [];

    try {
        // --- SOURCE 1: YTS (Movies) ---
        if (type === 'movie') {
            const ytsUrl = `https://yts.mx/api/v2/list_movies.json?query_term=${id}`;
            const res = await axios.get(ytsUrl, { headers: stealthHeaders, timeout: 3500 });
            const movie = res.data?.data?.movies?.[0];
            if (movie && movie.torrents) {
                movie.torrents.forEach(t => {
                    if (t.quality === '720p' || t.quality === '1080p') {
                        streams.push({
                            name: "Ghostream \uD83D\uDE80",
                            title: `\uD83C\uDFAC ${movie.title}\n\uD83D\uDE80 ${t.quality} [YTS] | \uD83D\uDC64 ${t.seeds}`,
                            infoHash: t.hash
                        });
                    }
                });
            }
        }

        // --- SOURCE 2: EZTV (Series) ---
        if (type === 'series') {
            const cleanId = id.replace('tt', '');
            const eztvUrl = `https://eztv.re/api/get-torrents?imdb_id=${cleanId}`;
            const res = await axios.get(eztvUrl, { headers: stealthHeaders, timeout: 3500 });
            if (res.data?.torrents) {
                res.data.torrents.forEach(t => {
                    const isQual = t.filename.includes('720p') || t.filename.includes('1080p');
                    if (isQual && t.seeds >= 15) {
                        streams.push({
                            name: "Ghostream \uD83D\uDE80",
                            title: `\uD83D\uDCFA ${t.filename}\n\uD83D\uDE80 Platinum Speed | \uD83D\uDC64 ${t.seeds} [EZTV]`,
                            infoHash: t.hash
                        });
                    }
                });
            }
        }

        // --- SOURCE 3: 1337x Fallback ---
        // Using a public API resolver to get 1337x hashes without triggering blocks
        const xUrl = `https://api.strem.io/it/api/v1/search?q=${id}`;
        const xRes = await axios.get(xUrl, { headers: stealthHeaders, timeout: 3500 }).catch(() => null);
        if (xRes?.data?.results) {
            xRes.data.results.forEach(r => {
                const isQual = r.title.includes('720p') || r.title.includes('1080p');
                if (isQual && !streams.some(s => s.infoHash === r.infoHash)) {
                    streams.push({
                        name: "Ghostream \uD83D\uDE80",
                        title: `\uD83D\uDD25 ${r.title}\n\uD83D\uDE80 1337x Extra | \uD83D\uDC64 High Seeds`,
                        infoHash: r.infoHash
                    });
                }
            });
        }

    } catch (error) {
        console.error("Ghostream Fetch Error");
    }

    // Clean and Limit: 1080p at the top
    const finalSelection = streams
        .sort((a, b) => b.title.includes('1080p') ? 1 : -1)
        .slice(0, 15);

    return { streams: finalSelection };
});

serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
