const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const axios = require("axios");
const manifest = require("./manifest");

const builder = new addonBuilder(manifest);

// Standard stealth headers
const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' };

builder.defineStreamHandler(async ({ type, id }) => {
    let streams = [];
    console.log(`[Ghostream] Searching for: ${id} (${type})`);

    try {
        // --- SOURCE 1: SolidTorrents (Powerful Universal Indexer) ---
        // This covers 1337x and others via a cloud-friendly API
        const solidUrl = `https://solidtorrents.to/api/v1/search?q=${id}&category=all&sort=seeders`;
        const solidRes = await axios.get(solidUrl, { headers, timeout: 4000 }).catch(() => null);
        
        if (solidRes?.data?.results) {
            solidRes.data.results.forEach(r => {
                const title = r.title.toLowerCase();
                const isQual = title.includes('720p') || title.includes('1080p');
                if (isQual && r.swarm.seeders >= 10) {
                    streams.push({
                        name: "Ghostream \uD83D\uDE80",
                        title: `\uD83D\uDE80 ${r.title}\n\uD83D\uDC64 Seeds: ${r.swarm.seeders} | \uD83D\uDCE6 ${Math.round(r.size/1024/1024)}MB`,
                        infoHash: r.infohash
                    });
                }
            });
        }

        // --- SOURCE 2: YTS (Movies Only) ---
        if (type === 'movie') {
            const ytsRes = await axios.get(`https://yts.mx/api/v2/list_movies.json?query_term=${id}`, { headers, timeout: 3000 }).catch(() => null);
            const movie = ytsRes?.data?.data?.movies?.[0];
            if (movie?.torrents) {
                movie.torrents.forEach(t => {
                    if (t.quality === '720p' || t.quality === '1080p') {
                        streams.push({
                            name: "Ghostream \uD83D\uDE80",
                            title: `\uD83C\uDFAC ${movie.title}\n\uD83D\uDE80 ${t.quality} [YTS] | \uD83D\uDC64 Seeds: ${t.seeds}`,
                            infoHash: t.hash
                        });
                    }
                });
            }
        }

        // --- SOURCE 3: EZTV (Series Only) ---
        if (type === 'series') {
            const cleanId = id.replace('tt', '');
            const eztvRes = await axios.get(`https://eztv.re/api/get-torrents?imdb_id=${cleanId}`, { headers, timeout: 3000 }).catch(() => null);
            if (eztvRes?.data?.torrents) {
                eztvRes.data.torrents.forEach(t => {
                    const isQual = t.filename.includes('720p') || t.filename.includes('1080p');
                    if (isQual && t.seeds >= 10) {
                        streams.push({
                            name: "Ghostream \uD83D\uDE80",
                            title: `\uD83D\uDCFA ${t.filename}\n\uD83D\uDE80 Platinum Speed | \uD83D\uDC64 Seeds: ${t.seeds}`,
                            infoHash: t.hash
                        });
                    }
                });
            }
        }

    } catch (err) {
        console.error("[Ghostream] Error fetching sources:", err.message);
    }

    // Sort: 1080p first
    const final = streams.sort((a, b) => b.title.includes('1080p') ? 1 : -1);
    console.log(`[Ghostream] Found ${final.length} streams.`);

    return { streams: final.slice(0, 15) };
});

serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
