/**
 * Build / refresh player → country map from Speedrun.com user profiles.
 *
 * Usage:
 *   node scripts/player-locations-fetcher.js --full
 *   node scripts/player-locations-fetcher.js --incremental
 *
 * Output: time-travel-cache/metadata/player-locations.json
 */

const fs = require('fs');
const path = require('path');

const BASE = 'https://www.speedrun.com/api/v1';
const USER_AGENT = 'FastSnakeStats-PlayerLocations/1.0';
const META_DIR = path.join('time-travel-cache', 'metadata');
const LOCATIONS_FILE = path.join(META_DIR, 'player-locations.json');
const PLAYER_STATS_FILE = path.join(META_DIR, 'player-stats.json');
const RUNS_DIR = path.join('time-travel-cache', 'runs');
const INDEX_FILE = path.join(META_DIR, 'runs-archive-index.json');

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv) {
    const out = { full: false, incremental: false };
    for (const a of argv) {
        if (a === '--full') out.full = true;
        else if (a === '--incremental') out.incremental = true;
    }
    if (!out.full && !out.incremental) out.incremental = true;
    return out;
}

function loadLocations() {
    if (!fs.existsSync(LOCATIONS_FILE)) {
        return { lastUpdated: null, players: {} };
    }
    try {
        const raw = JSON.parse(fs.readFileSync(LOCATIONS_FILE, 'utf8'));
        if (!raw.players || typeof raw.players !== 'object') raw.players = {};
        return raw;
    } catch (e) {
        console.warn('⚠️ Corrupt player-locations.json, starting fresh');
        return { lastUpdated: null, players: {} };
    }
}

function saveLocations(data) {
    if (!fs.existsSync(META_DIR)) fs.mkdirSync(META_DIR, { recursive: true });
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(LOCATIONS_FILE, JSON.stringify(data));
}

function extractCountryFromUser(user) {
    if (!user || !user.location || !user.location.country) return null;
    const c = user.location.country;
    const code = (c.code && String(c.code).toLowerCase()) || null;
    if (!code) return null;
    const name =
        (c.names && (c.names.international || c.names.japanese)) ||
        code.toUpperCase();
    return { code, name };
}

/**
 * Upsert from an already-fetched SRC user / embedded player object.
 * Returns true if the sidecar was changed.
 */
function upsertLocationFromPlayer(locations, playerId, playerObj) {
    if (!playerId || String(playerId).indexOf('guest:') === 0) return false;
    if (!locations.players) locations.players = {};
    const country = extractCountryFromUser(playerObj);
    const prev = locations.players[playerId];
    const next = country; // null means known-but-unset
    // Always record the id once seen (null or country)
    const same =
        prev === next ||
        (prev &&
            next &&
            prev.code === next.code &&
            prev.name === next.name) ||
        (prev === null && next === null && Object.prototype.hasOwnProperty.call(locations.players, playerId));
    if (same && Object.prototype.hasOwnProperty.call(locations.players, playerId)) {
        return false;
    }
    locations.players[playerId] = next;
    return true;
}

function collectPlayerIds() {
    const ids = new Set();

    if (fs.existsSync(PLAYER_STATS_FILE)) {
        try {
            const stats = JSON.parse(fs.readFileSync(PLAYER_STATS_FILE, 'utf8'));
            const list = stats.players || [];
            for (const p of list) {
                if (p && p.id && String(p.id).indexOf('guest:') !== 0) ids.add(p.id);
            }
        } catch (e) {
            console.warn('⚠️ Could not read player-stats.json:', e.message);
        }
    }

    if (fs.existsSync(INDEX_FILE)) {
        try {
            const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
            for (const shard of index.shards || []) {
                const full = shard.path;
                if (!full || !fs.existsSync(full)) continue;
                const data = JSON.parse(fs.readFileSync(full, 'utf8'));
                for (const run of Object.values(data.runs || {})) {
                    if (run.playerId && String(run.playerId).indexOf('guest:') !== 0) {
                        ids.add(run.playerId);
                    }
                }
            }
        } catch (e) {
            console.warn('⚠️ Could not scan runs index:', e.message);
        }
    } else if (fs.existsSync(RUNS_DIR)) {
        for (const mode of fs.readdirSync(RUNS_DIR)) {
            const modeDir = path.join(RUNS_DIR, mode);
            if (!fs.statSync(modeDir).isDirectory()) continue;
            for (const file of fs.readdirSync(modeDir)) {
                if (!file.endsWith('.json')) continue;
                try {
                    const data = JSON.parse(fs.readFileSync(path.join(modeDir, file), 'utf8'));
                    for (const run of Object.values(data.runs || {})) {
                        if (run.playerId && String(run.playerId).indexOf('guest:') !== 0) {
                            ids.add(run.playerId);
                        }
                    }
                } catch (e) { /* skip corrupt shard */ }
            }
        }
    }

    return Array.from(ids).sort();
}

async function fetchAPI(url) {
    let attempt = 1;
    while (true) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { Accept: 'application/json', 'User-Agent': USER_AGENT }
            });
            if (response.status === 429 || response.status === 420) {
                const wait = Math.min(30000, 2000 * attempt);
                console.log(`⏳ SRC ${response.status}, waiting ${wait}ms…`);
                await sleep(wait);
                attempt++;
                continue;
            }
            if (response.status === 404) return null;
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (err) {
            console.error(`❌ API attempt ${attempt}: ${err.message}`);
            await sleep(2000);
            attempt++;
            if (attempt > 20) throw err;
        }
    }
}

async function run(opts) {
    const t0 = Date.now();
    const locations = opts.full
        ? { lastUpdated: null, players: {} }
        : loadLocations();

    const allIds = collectPlayerIds();
    console.log(`👤 Known non-guest players: ${allIds.length}`);

    const todo = opts.full
        ? allIds
        : allIds.filter((id) => !Object.prototype.hasOwnProperty.call(locations.players, id));

    console.log(
        opts.full
            ? `📚 Full backfill: ${todo.length} users`
            : `🔁 Incremental: ${todo.length} new users (${Object.keys(locations.players).length} already mapped)`
    );

    if (!todo.length) {
        saveLocations(locations);
        console.log('✅ Nothing to fetch');
        return locations;
    }

    let fetched = 0;
    let withCountry = 0;
    for (let i = 0; i < todo.length; i++) {
        const id = todo[i];
        const payload = await fetchAPI(`${BASE}/users/${id}`);
        const user = payload && payload.data;
        const country = extractCountryFromUser(user);
        locations.players[id] = country;
        fetched++;
        if (country) withCountry++;
        if ((i + 1) % 25 === 0 || i === todo.length - 1) {
            console.log(`  … ${i + 1}/${todo.length} (with country: ${withCountry})`);
            saveLocations(locations);
        }
        await sleep(120);
    }

    saveLocations(locations);
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(
        `✅ Done in ${sec}s · fetched=${fetched} · withCountry=${withCountry} · totalMapped=${Object.keys(locations.players).length}`
    );
    return locations;
}

module.exports = {
    LOCATIONS_FILE,
    loadLocations,
    saveLocations,
    extractCountryFromUser,
    upsertLocationFromPlayer,
    collectPlayerIds,
    run
};

if (require.main === module) {
    const opts = parseArgs(process.argv.slice(2));
    run(opts).catch((err) => {
        console.error('Player locations fetch failed:', err);
        process.exit(1);
    });
}
