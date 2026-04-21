const { addonBuilder } = require("stremio-addon-sdk");
const fetch = require("node-fetch");

const builder = new addonBuilder({
    id: "org.ghostream.addon",
    version: "1.0.0",
    name: "Ghostream",
    description: "Filtered fast torrent streams (720p/1080p only)",
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"]
});

builder.defineStreamHandler(async ({ type, id }) => {
    try {
        const url = `https://torrentio.strem.fun/sort=seeders/stream/${type}/${id}.json`;
        const res = await fetch(url);
        const data = await res.json();

        let streams = data.streams || [];

        // FILTER LOGIC
        streams = streams
            .filter(s => {
                const name = s.title.toLowerCase();

                // remove 4K
                if (name.includes("2160") || name.includes("4k")) return false;

                // keep 720/1080 only
                if (!name.includes("720") && !name.includes("1080")) return false;

                return true;
            })
            .slice(0, 20); // limit results

        return { streams };
    } catch (err) {
        return { streams: [] };
    }
});

module.exports = builder.getInterface();
