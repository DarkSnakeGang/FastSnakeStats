/**
 * Verified runs archive for FastSnakeStats (unique by run id).
 *
 * Uses GET /runs (not /leaderboards). Play date (`run.date`) is semantic;
 * verify-date is the incremental ingest watermark only.
 *
 * Usage:
 *   node scripts/runs-archive-fetcher.js --from=2026-07-01 --to=2026-07-31 --modes=Classic,Wall
 *   node scripts/runs-archive-fetcher.js --full
 *   node scripts/runs-archive-fetcher.js --incremental
 */

const fs = require('fs');
const path = require('path');
const {
    TALLY_CE_HIGHSCORE_MODES,
    TYPICAL_HIGHSCORE_MODES,
    CE_GAME_ID,
    CE_TALLY_HS_CATEGORY_ID
} = require('../tally-boards');
const {
    CE_LEVEL_MODES,
    CE_LEVEL_BY_NAME,
    CE_LEVEL_CATEGORY_IDS,
    CE_LEVEL_VAR_COUNT,
    CE_LEVEL_VAR_SIZE,
    CE_LEVEL_VAR_SPEED,
    normalizeCeCountLabel,
    normalizeCeRunLabel,
    isCeLevelMode
} = require('../ce-modes');
const { isIgnoredPlayerName, shouldSkipBoardFetch } = require('../ignored-players');
const {
    loadLocations,
    saveLocations,
    upsertLocationFromPlayer
} = require('./player-locations-fetcher');

const GAME_ID = 'o1y9pyk6';
const BASE = 'https://www.speedrun.com/api/v1';
const USER_AGENT = 'FastSnakeStats-RunsArchive/1.0';

const MODE_NAMES = [
    'Classic', 'Wall', 'Portal', 'Cheese', 'Borderless', 'Twin', 'Winged', 'Yin Yang',
    'Key', 'Sokoban', 'Poison', 'Dimension', 'Minesweeper', 'Statue', 'Light', 'Shield',
    'Arrow', 'Hotdog', 'Magnet', 'Gate', 'Bridge', 'Peaceful'
];
const SPEED_NAMES = ['Normal', 'Fast', 'Slow'];
const APPLE_AMOUNTS = ['1 Apple', '3 Apples', '5 Apples', '10 Apples', 'Dice', 'Bomb', 'Tally'];
const SIZE_NAMES = ['Standard', 'Small', 'Large'];
const CATEGORY_NAMES = ['25 Apples', '50 Apples', '100 Apples', 'All Apples', 'High Score'];

const META_DIR = path.join('time-travel-cache', 'metadata');
const RUNS_DIR = path.join('time-travel-cache', 'runs');
const STATE_FILE = path.join(META_DIR, 'runs-archive-state.json');
const INDEX_FILE = path.join(META_DIR, 'runs-archive-index.json');

const ARCHIVE_VERSION = 1;
const EARLIEST_MONTH = '2018-01';

function parseArgs(argv) {
    const out = { full: false, incremental: false, from: null, to: null, modes: null, categories: null };
    for (const a of argv) {
        if (a === '--full') out.full = true;
        else if (a === '--incremental') out.incremental = true;
        else if (a.startsWith('--from=')) out.from = a.slice(7);
        else if (a.startsWith('--to=')) out.to = a.slice(5);
        else if (a.startsWith('--modes=')) {
            out.modes = a.slice(8).split(',').map((s) => s.trim()).filter(Boolean);
        }         else if (a.startsWith('--categories=')) {
            out.categories = a.slice(13).split(',').map((s) => {
                const t = s.trim().replace(/_/g, ' ');
                if (/^all\s*apples$/i.test(t) || t === 'AllApples') return 'All Apples';
                if (/^25\s*apples$/i.test(t) || t === '25Apples') return '25 Apples';
                if (/^50\s*apples$/i.test(t) || t === '50Apples') return '50 Apples';
                if (/^100\s*apples$/i.test(t) || t === '100Apples') return '100 Apples';
                if (/^high\s*score$/i.test(t) || t === 'HighScore') return 'High Score';
                return t;
            }).filter(Boolean);
        }
    }
    if (!out.full && !out.incremental && !out.from) {
        out.incremental = true;
    }
    return out;
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function dateOnly(isoOrDate) {
    if (!isoOrDate) return null;
    const m = String(isoOrDate).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
}

function runPlayDate(run) {
    return dateOnly(run.date);
}

function runVerifyStamp(run) {
    return (
        (run.status && run.status['verify-date']) ||
        run.submitted ||
        (run.date ? `${run.date}T00:00:00Z` : null) ||
        null
    );
}

function monthKey(dateStr) {
    return dateStr ? dateStr.slice(0, 7) : null;
}

function addMonths(ym, n) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthRange(fromDate, toDate) {
    let cur = monthKey(fromDate) || EARLIEST_MONTH;
    const end = monthKey(toDate) || monthKey(new Date().toISOString().slice(0, 10));
    const out = [];
    while (cur <= end) {
        out.push(cur);
        cur = addMonths(cur, 1);
    }
    return out;
}

function monthBounds(ym) {
    const [y, m] = ym.split('-').map(Number);
    const from = `${ym}-01`;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const to = `${ym}-${String(last).padStart(2, '0')}`;
    return { from, to };
}

function safeFilePart(name) {
    return String(name).replace(/[^\w.-]+/g, '_');
}

class RunsArchiveFetcher {
    constructor() {
        this.lastFailureTime = 0;
        this.failureDelay = 0;
        this.apiCalls = 0;
        this.maps = null;
        /** @type {Map<string, Object>} shardKey -> { runs: { id: record } } */
        this.shardCache = new Map();
        this.dirtyShards = new Set();
        this.locationsData = null;
        this.locationsDirty = false;
    }

    touchLocations() {
        if (!this.locationsData) this.locationsData = loadLocations();
        return this.locationsData;
    }

    flushLocations() {
        if (!this.locationsDirty || !this.locationsData) return;
        saveLocations(this.locationsData);
        this.locationsDirty = false;
    }

    async fetchAPI(url) {
        const now = Date.now();
        if (now - this.lastFailureTime < this.failureDelay) {
            await sleep(this.failureDelay - (now - this.lastFailureTime));
        }
        let attempt = 1;
        while (true) {
            try {
                this.apiCalls++;
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
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                this.lastFailureTime = 0;
                this.failureDelay = 0;
                return await response.json();
            } catch (err) {
                console.error(`❌ API attempt ${attempt}: ${err.message}`);
                this.lastFailureTime = Date.now();
                this.failureDelay = 2000;
                await sleep(2000);
                attempt++;
                if (attempt > 25) throw err;
            }
        }
    }

    async initMaps() {
        const [variables, levels, categories] = await Promise.all([
            this.fetchAPI(`${BASE}/games/${GAME_ID}/variables`),
            this.fetchAPI(`${BASE}/games/${GAME_ID}/levels`),
            this.fetchAPI(`${BASE}/games/${GAME_ID}/categories`)
        ]);

        const categoryByName = {};
        for (const name of CATEGORY_NAMES) {
            if (name === 'High Score') continue; // per-mode HS categories below
            const cat = categories.data.find(
                (c) => c.name === name || c.name.includes(name)
            );
            if (cat) categoryByName[name] = cat.id;
            else console.warn(`⚠️ Category not found: ${name}`);
        }

        // Typical HS modes: "Wall High Score", "Portal High Score", …
        const highScoreCategoryByMode = {};
        for (const mode of TYPICAL_HIGHSCORE_MODES) {
            const cat = categories.data.find(
                (c) => c.name === `${mode} High Score` || (c.name.includes(mode) && c.name.includes('High Score'))
            );
            if (cat) highScoreCategoryByMode[mode] = cat.id;
            else console.warn(`⚠️ HS category not found for ${mode}`);
        }

        const levelByMode = {};
        for (const mode of MODE_NAMES) {
            const level = levels.data.find((l) => l.name.includes(mode));
            if (level) levelByMode[mode] = level.id;
            else console.warn(`⚠️ No level for mode ${mode}`);
        }

        const valueLabelById = {};
        const ingest = (variable) => {
            if (!variable || !variable.values || !variable.values.values) return;
            for (const [id, val] of Object.entries(variable.values.values)) {
                valueLabelById[id] = val.label;
            }
        };
        ingest(variables.data.find((v) => v.name === 'Multi Apple Amount'));
        ingest(variables.data.find((v) => v.name === 'Board Size'));
        variables.data.filter((v) => v.name === 'Speed').forEach(ingest);

        // CE Tally HS metadata (optional) + CE level board vars (Chess/Burger)
        let ceModeLabelById = {};
        let ceSpeedLabelById = {};
        let ceSizeLabelById = {};
        let ceLevelCountLabelById = {};
        let ceLevelSizeLabelById = {};
        try {
            const ceVars = await this.fetchAPI(`${BASE}/games/${CE_GAME_ID}/variables`);
            for (const v of ceVars.data || []) {
                const map = {};
                if (v.values && v.values.values) {
                    for (const [id, val] of Object.entries(v.values.values)) {
                        map[id] = val.label;
                    }
                }
                if (v.name === 'Mode' || v.id === 'onvxz158') ceModeLabelById = map;
                if (v.name === 'Speed' || v.id === CE_LEVEL_VAR_SPEED || v.id === 'gnx3m4gn') {
                    Object.assign(ceSpeedLabelById, map);
                }
                // Tally CE HS board size (distinct from level boards)
                if (v.name === 'Board Size' || v.id === 'ql6mkzw8') {
                    if (v.id === 'ql6mkzw8' || !Object.keys(ceSizeLabelById).length) {
                        Object.assign(ceSizeLabelById, map);
                    }
                }
                if (v.id === CE_LEVEL_VAR_COUNT) {
                    for (const [id, label] of Object.entries(map)) {
                        ceLevelCountLabelById[id] = normalizeCeCountLabel(label) || label;
                    }
                }
                if (v.id === CE_LEVEL_VAR_SIZE) {
                    ceLevelSizeLabelById = map;
                }
            }
        } catch (e) {
            console.warn('⚠️ CE metadata load failed:', e.message);
        }

        this.maps = {
            categoryByName,
            highScoreCategoryByMode,
            levelByMode,
            modeByLevelId: Object.fromEntries(
                Object.entries(levelByMode).map(([mode, id]) => [id, mode])
            ),
            valueLabelById,
            appleSet: new Set(APPLE_AMOUNTS),
            speedSet: new Set(SPEED_NAMES),
            sizeSet: new Set(SIZE_NAMES),
            ceModeLabelById,
            ceSpeedLabelById,
            ceSizeLabelById,
            ceLevelCountLabelById,
            ceLevelSizeLabelById
        };
        console.log(
            `✅ Metadata: categories=${Object.keys(categoryByName).length} HS=${Object.keys(highScoreCategoryByMode).length} modes=${Object.keys(levelByMode).length}`
        );
    }

    loadState() {
        if (!fs.existsSync(STATE_FILE)) {
            return {
                version: ARCHIVE_VERSION,
                lastVerifyDate: null,
                backfillComplete: false,
                seenRunIds: {},
                streamsDone: {}
            };
        }
        const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        if (!raw.seenRunIds) raw.seenRunIds = {};
        if (!raw.streamsDone) raw.streamsDone = {};
        return raw;
    }

    saveState(state) {
        if (!fs.existsSync(META_DIR)) fs.mkdirSync(META_DIR, { recursive: true });
        fs.writeFileSync(STATE_FILE, JSON.stringify(state));
    }

    shardPath(mode, category) {
        const dir = path.join(RUNS_DIR, safeFilePart(mode));
        return path.join(dir, `${safeFilePart(category)}.json`);
    }

    shardKey(mode, category) {
        return `${mode}||${category}`;
    }

    loadShard(mode, category) {
        const key = this.shardKey(mode, category);
        if (this.shardCache.has(key)) return this.shardCache.get(key);
        const file = this.shardPath(mode, category);
        let data = { mode, category, runs: {} };
        if (fs.existsSync(file)) {
            try {
                data = JSON.parse(fs.readFileSync(file, 'utf8'));
                if (!data.runs) data.runs = {};
            } catch (e) {
                console.warn(`⚠️ Corrupt shard ${file}, resetting`);
            }
        }
        this.shardCache.set(key, data);
        return data;
    }

    flushShards() {
        for (const key of this.dirtyShards) {
            const [mode, category] = key.split('||');
            const data = this.shardCache.get(key);
            if (!data) continue;
            const file = this.shardPath(mode, category);
            const dir = path.dirname(file);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(file, JSON.stringify(data));
        }
        this.dirtyShards.clear();
    }

    writeIndex(state) {
        let totalRuns = 0;
        const shards = [];
        if (fs.existsSync(RUNS_DIR)) {
            for (const mode of fs.readdirSync(RUNS_DIR)) {
                const modeDir = path.join(RUNS_DIR, mode);
                if (!fs.statSync(modeDir).isDirectory()) continue;
                for (const file of fs.readdirSync(modeDir)) {
                    if (!file.endsWith('.json')) continue;
                    const full = path.join(modeDir, file);
                    const data = JSON.parse(fs.readFileSync(full, 'utf8'));
                    const n = data.runs ? Object.keys(data.runs).length : 0;
                    totalRuns += n;
                    shards.push({
                        mode: data.mode || mode,
                        category: data.category || file.replace(/\.json$/, ''),
                        path: full.replace(/\\/g, '/'),
                        count: n
                    });
                }
            }
        }
        const index = {
            lastUpdated: new Date().toISOString(),
            version: ARCHIVE_VERSION,
            backfillComplete: !!state.backfillComplete,
            lastVerifyDate: state.lastVerifyDate || null,
            seenRuns: Object.keys(state.seenRunIds || {}).length,
            totalRuns,
            shards
        };
        if (!fs.existsSync(META_DIR)) fs.mkdirSync(META_DIR, { recursive: true });
        fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
        console.log(`💾 Index ${INDEX_FILE} · totalRuns=${totalRuns} shards=${shards.length}`);
        return index;
    }

    classifyMainRun(run, expectedCategoryName, expectedMode) {
        const values = run.values || {};
        let apple = null;
        let speed = null;
        let size = null;
        for (const valueId of Object.values(values)) {
            const label = this.maps.valueLabelById[valueId];
            if (!label) continue;
            if (this.maps.appleSet.has(label)) apple = label;
            else if (this.maps.speedSet.has(label)) speed = label;
            else if (this.maps.sizeSet.has(label)) size = label;
        }
        if (!apple || !speed || !size) return null;
        if (shouldSkipBoardFetch(apple, expectedMode, expectedCategoryName)) return null;

        const levelId = typeof run.level === 'string' ? run.level : (run.level && run.level.id);
        const mode = expectedMode || this.maps.modeByLevelId[levelId];
        if (!mode) return null;

        return {
            category: `${apple}|${speed}|${size}|${mode}|${expectedCategoryName}`,
            mode,
            runCategory: expectedCategoryName,
            apple,
            speed,
            size
        };
    }

    classifyCeTallyRun(run) {
        const values = run.values || {};
        let mode = null;
        let speed = null;
        let size = null;
        for (const [varId, valueId] of Object.entries(values)) {
            if (this.maps.ceModeLabelById[valueId]) mode = this.maps.ceModeLabelById[valueId];
            if (this.maps.ceSpeedLabelById[valueId]) speed = this.maps.ceSpeedLabelById[valueId];
            if (this.maps.ceSizeLabelById[valueId]) size = this.maps.ceSizeLabelById[valueId];
            // also try by var id maps mixed
            void varId;
        }
        // Fallback: scan all CE label maps
        for (const valueId of Object.values(values)) {
            if (!mode && this.maps.ceModeLabelById[valueId]) mode = this.maps.ceModeLabelById[valueId];
            if (!speed && this.maps.ceSpeedLabelById[valueId]) speed = this.maps.ceSpeedLabelById[valueId];
            if (!size && this.maps.ceSizeLabelById[valueId]) size = this.maps.ceSizeLabelById[valueId];
        }
        if (!mode || !speed || !size) return null;
        if (TALLY_CE_HIGHSCORE_MODES.indexOf(mode) === -1) return null;
        if (!this.maps.speedSet.has(speed) || !this.maps.sizeSet.has(size)) return null;
        return {
            category: `Tally|${speed}|${size}|${mode}|High Score`,
            mode,
            runCategory: 'High Score',
            apple: 'Tally',
            speed,
            size
        };
    }

    /**
     * Chess / Burger full-matrix runs on snake_game_ce levels.
     * Category keys: {Count}|{Speed}|{Size}|{Chess|Burger}|{25|50|100|All Apples|High Score}
     */
    classifyCeLevelRun(run, expectedMode, expectedCategoryName) {
        if (!isCeLevelMode(expectedMode)) return null;
        const values = run.values || {};
        let apple = null;
        let speed = null;
        let size = null;

        for (const [varId, valueId] of Object.entries(values)) {
            if (varId === CE_LEVEL_VAR_COUNT || this.maps.ceLevelCountLabelById[valueId]) {
                const label = this.maps.ceLevelCountLabelById[valueId];
                if (label && this.maps.appleSet.has(label)) apple = label;
            }
            if (varId === CE_LEVEL_VAR_SPEED || this.maps.ceSpeedLabelById[valueId]) {
                const label = this.maps.ceSpeedLabelById[valueId];
                if (label && this.maps.speedSet.has(label)) speed = label;
            }
            if (varId === CE_LEVEL_VAR_SIZE || this.maps.ceLevelSizeLabelById[valueId]) {
                const label = this.maps.ceLevelSizeLabelById[valueId];
                if (label && this.maps.sizeSet.has(label)) size = label;
            }
        }
        // Fallback: scan CE level maps by value id only
        for (const valueId of Object.values(values)) {
            if (!apple && this.maps.ceLevelCountLabelById[valueId]) {
                const label = this.maps.ceLevelCountLabelById[valueId];
                if (this.maps.appleSet.has(label)) apple = label;
            }
            if (!speed && this.maps.ceSpeedLabelById[valueId]) {
                const label = this.maps.ceSpeedLabelById[valueId];
                if (this.maps.speedSet.has(label)) speed = label;
            }
            if (!size && this.maps.ceLevelSizeLabelById[valueId]) {
                const label = this.maps.ceLevelSizeLabelById[valueId];
                if (this.maps.sizeSet.has(label)) size = label;
            }
        }

        if (!apple || !speed || !size) return null;
        if (shouldSkipBoardFetch(apple, expectedMode, expectedCategoryName)) return null;

        const runCategory = normalizeCeRunLabel(expectedCategoryName) || expectedCategoryName;
        return {
            category: `${apple}|${speed}|${size}|${expectedMode}|${runCategory}`,
            mode: expectedMode,
            runCategory,
            apple,
            speed,
            size,
            source: 'ce'
        };
    }

    extractPlayer(run) {
        const players = run.players;
        let list = [];
        if (Array.isArray(players)) list = players;
        else if (players && Array.isArray(players.data)) list = players.data;
        const p = list[0];
        if (!p) return null;
        const nameStyle = p['name-style'] || p.nameStyle || null;
        if (p.rel === 'guest' || (!p.id && p.name)) {
            const name = (p.name && String(p.name).trim()) || 'Anonymous';
            if (isIgnoredPlayerName(name)) return null;
            return {
                playerId: `guest:${name}`,
                playerName: name,
                guest: true,
                nameStyle: nameStyle || { style: 'solid', color: { dark: '#9e9e9e', light: '#9e9e9e' } }
            };
        }
        const id = p.id;
        const name =
            (p.names && (p.names.international || p.names.japanese)) ||
            p.name ||
            id;
        if (!id) return null;
        if (isIgnoredPlayerName(name)) return null;
        // Opportunistic country upsert from embedded player (when SRC includes location)
        try {
            const locs = this.touchLocations();
            if (upsertLocationFromPlayer(locs, id, p)) this.locationsDirty = true;
        } catch (e) { /* non-fatal */ }
        return { playerId: id, playerName: name, guest: false, nameStyle };
    }

    upsertRun(state, run, classified) {
        if (!run || !run.id || !classified) return false;
        if (state.seenRunIds[run.id]) return false;
        if (!run.status || run.status.status !== 'verified') return false;

        const player = this.extractPlayer(run);
        if (!player) {
            state.seenRunIds[run.id] = 1;
            return false;
        }

        const playDate = runPlayDate(run);
        const primary = (run.times && run.times.primary) || null;
        const primaryT = (run.times && typeof run.times.primary_t === 'number')
            ? run.times.primary_t
            : null;

        const record = {
            id: run.id,
            category: classified.category,
            date: playDate,
            verifyDate: (run.status && run.status['verify-date']) || null,
            submitted: run.submitted || null,
            time: primary,
            timeT: primaryT,
            weblink: run.weblink || `https://www.speedrun.com/snake_game/run/${run.id}`,
            playerId: player.playerId,
            playerName: player.playerName,
            guest: !!player.guest,
            nameStyle: player.nameStyle || null
        };
        if (classified.source) record.source = classified.source;

        const shard = this.loadShard(classified.mode, classified.runCategory);
        shard.runs[run.id] = record;
        this.dirtyShards.add(this.shardKey(classified.mode, classified.runCategory));
        state.seenRunIds[run.id] = 1;
        return true;
    }

    /**
     * Page one SRC stream with optional play-date window (client filter).
     */
    async fetchStream(stream, state, opts) {
        const { from, to, mode } = opts;
        let offset = 0;
        let pages = 0;
        let stored = 0;
        let examined = 0;
        let stopStream = false;
        let maxVerifySeen = state.lastVerifyDate || null;

        const orderby = mode === 'incremental' ? 'verify-date' : 'date';
        const direction = mode === 'full' ? 'asc' : 'desc';

        while (!stopStream) {
            if (offset + 200 > 10000) {
                console.warn(
                    `⚠️ ${stream.label}: approaching SRC ~10k offset at offset=${offset}`
                );
                break;
            }

            const url =
                `${BASE}/runs?game=${stream.gameId}` +
                `&category=${stream.categoryId}` +
                (stream.levelId ? `&level=${stream.levelId}` : '') +
                `&status=verified&embed=players&max=200` +
                `&orderby=${orderby}&direction=${direction}&offset=${offset}`;

            const payload = await this.fetchAPI(url);
            const runs = (payload && payload.data) || [];
            pages++;
            if (!runs.length) break;

            for (const run of runs) {
                examined++;
                const stamp = runVerifyStamp(run);
                if (stamp && (!maxVerifySeen || stamp > maxVerifySeen)) {
                    maxVerifySeen = stamp;
                }

                const classified = stream.classify(run);
                const playDate = runPlayDate(run);

                if (mode === 'incremental') {
                    if (state.lastVerifyDate && stamp && stamp <= state.lastVerifyDate) {
                        stopStream = true;
                        break;
                    }
                    if (classified && this.upsertRun(state, run, classified)) stored++;
                    else if (!classified && run.id) state.seenRunIds[run.id] = 1;
                    continue;
                }

                // full / range — filter by play date
                if (!playDate) continue;
                if (to && playDate > to) {
                    if (direction === 'desc') continue;
                    // asc: past window end
                    if (mode === 'range' || mode === 'full') {
                        stopStream = true;
                        break;
                    }
                }
                if (from && playDate < from) {
                    if (direction === 'desc') {
                        stopStream = true;
                        break;
                    }
                    continue;
                }
                if (to && playDate > to && direction === 'asc') {
                    stopStream = true;
                    break;
                }

                if (classified && this.upsertRun(state, run, classified)) stored++;
                else if (!classified && run.id) state.seenRunIds[run.id] = 1;
            }

            if (stopStream) break;
            if (runs.length < 200) break;
            offset += 200;
            if (pages % 5 === 0) {
                console.log(`  … ${stream.label}: pages=${pages} offset=${offset} stored=${stored}`);
                this.flushShards();
                this.saveState(state);
            }
            await sleep(120);
        }

        return { pages, stored, examined, maxVerifySeen, hitOffsetLimit: offset + 200 > 10000 };
    }

    buildStreams(modeFilter, categoryFilter) {
        const modes = modeFilter && modeFilter.length
            ? MODE_NAMES.filter((m) => modeFilter.includes(m))
            : MODE_NAMES;
        const wantTimed = !categoryFilter || categoryFilter.some((c) => c !== 'High Score');
        const wantHS = !categoryFilter || categoryFilter.includes('High Score');
        const timedCategories = (categoryFilter && categoryFilter.length
            ? CATEGORY_NAMES.filter((c) => c !== 'High Score' && categoryFilter.includes(c))
            : CATEGORY_NAMES.filter((c) => c !== 'High Score'));

        const streams = [];
        if (wantTimed) {
            for (const modeName of modes) {
                const levelId = this.maps.levelByMode[modeName];
                if (!levelId) continue;
                for (const catName of timedCategories) {
                    const categoryId = this.maps.categoryByName[catName];
                    if (!categoryId) continue;
                    streams.push({
                        label: `${modeName}/${catName}`,
                        gameId: GAME_ID,
                        categoryId,
                        levelId,
                        modeName,
                        catName,
                        classify: (run) => this.classifyMainRun(run, catName, modeName)
                    });
                }
            }
        }

        if (wantHS) {
            for (const modeName of modes) {
                if (TYPICAL_HIGHSCORE_MODES.indexOf(modeName) === -1) continue;
                const categoryId = this.maps.highScoreCategoryByMode[modeName];
                if (!categoryId) continue;
                streams.push({
                    label: `${modeName}/High Score`,
                    gameId: GAME_ID,
                    categoryId,
                    levelId: null, // per-game HS category
                    modeName,
                    catName: 'High Score',
                    classify: (run) => this.classifyMainRun(run, 'High Score', modeName)
                });
            }
        }

        // CE Tally High Score (single category stream; filter modes client-side)
        if (
            wantHS &&
            (!modeFilter || modeFilter.some((m) => TALLY_CE_HIGHSCORE_MODES.includes(m)))
        ) {
            streams.push({
                label: `CE/Tally High Score`,
                gameId: CE_GAME_ID,
                categoryId: CE_TALLY_HS_CATEGORY_ID,
                levelId: null,
                modeName: '_CE_',
                catName: 'High Score',
                classify: (run) => {
                    const c = this.classifyCeTallyRun(run);
                    if (!c) return null;
                    if (modeFilter && modeFilter.length && !modeFilter.includes(c.mode)) return null;
                    return c;
                }
            });
        }

        // CE level modes (Chess / Burger) — full timed + High Score matrix
        const ceModes = modeFilter && modeFilter.length
            ? CE_LEVEL_MODES.filter((m) => modeFilter.includes(m))
            : CE_LEVEL_MODES.slice();
        for (const modeName of ceModes) {
            const levelId = CE_LEVEL_BY_NAME[modeName];
            if (!levelId) continue;
            if (wantTimed) {
                for (const catName of timedCategories) {
                    const categoryId = CE_LEVEL_CATEGORY_IDS[catName];
                    if (!categoryId) continue;
                    streams.push({
                        label: `CE/${modeName}/${catName}`,
                        gameId: CE_GAME_ID,
                        categoryId,
                        levelId,
                        modeName,
                        catName,
                        classify: (run) => this.classifyCeLevelRun(run, modeName, catName)
                    });
                }
            }
            if (wantHS) {
                const hsCatId = CE_LEVEL_CATEGORY_IDS['High Score'];
                if (hsCatId) {
                    streams.push({
                        label: `CE/${modeName}/High Score`,
                        gameId: CE_GAME_ID,
                        categoryId: hsCatId,
                        levelId,
                        modeName,
                        catName: 'High Score',
                        classify: (run) => this.classifyCeLevelRun(run, modeName, 'High Score')
                    });
                }
            }
        }

        return streams;
    }

    async fetchStreamFull(stream, state) {
        // Oldest→newest first; if SRC ~10k offset caps us, also pull newest→oldest and merge.
        const asc = await this.fetchStream(stream, state, {
            from: null,
            to: null,
            mode: 'full'
        });
        let maxVerifySeen = asc.maxVerifySeen;
        let stored = asc.stored;
        let examined = asc.examined;
        let pages = asc.pages;

        if (asc.hitOffsetLimit) {
            console.warn(`  ⚠️ ${stream.label}: asc hit 10k — merging desc pass`);
            const desc = await this.fetchStream(stream, state, {
                from: null,
                to: null,
                mode: 'range' // date desc, no window → ingest all until offset cap
            });
            stored += desc.stored;
            examined += desc.examined;
            pages += desc.pages;
            if (desc.maxVerifySeen && (!maxVerifySeen || desc.maxVerifySeen > maxVerifySeen)) {
                maxVerifySeen = desc.maxVerifySeen;
            }
        }
        return { pages, stored, examined, maxVerifySeen, hitOffsetLimit: asc.hitOffsetLimit };
    }

    async runMonthWindows(stream, state, fromDate, toDate) {
        // For bounded range tests: date-desc scan, client-filter to [from,to].
        // Recent windows are cheap; older windows may scan many newer pages first.
        console.log(`  📅 ${stream.label} ${fromDate}→${toDate}`);
        return this.fetchStream(stream, state, {
            from: fromDate,
            to: toDate,
            mode: 'range'
        });
    }

    async run(opts) {
        const t0 = Date.now();
        await this.initMaps();

        let mode = 'incremental';
        if (opts.full) mode = 'full';
        else if (opts.from || opts.to) mode = 'range';

        if (mode === 'incremental' && !fs.existsSync(STATE_FILE)) {
            console.log('ℹ️ No runs-archive-state.json — incremental no-op. Run range/full first.');
            return null;
        }
        if (mode === 'incremental') {
            const existing = this.loadState();
            if (!existing.backfillComplete) {
                console.log('ℹ️ Runs archive backfill not complete — incremental no-op.');
                return null;
            }
        }

        let state;
        if (mode === 'full') {
            console.log('📚 Full historical runs archive (fresh state)');
            // Wipe prior shards for a clean full rebuild
            if (fs.existsSync(RUNS_DIR)) {
                fs.rmSync(RUNS_DIR, { recursive: true, force: true });
            }
            this.shardCache.clear();
            this.dirtyShards.clear();
            state = {
                version: ARCHIVE_VERSION,
                lastVerifyDate: null,
                backfillComplete: false,
                seenRunIds: {},
                streamsDone: {}
            };
        } else if (mode === 'range') {
            console.log(`🧪 Range ${opts.from || '…'} → ${opts.to || '…'}`);
            state = this.loadState();
            // Keep prior backfillComplete — range is additive fill, not a reset
        } else {
            console.log(`🔁 Incremental since ${this.loadState().lastVerifyDate || '(none)'}`);
            state = this.loadState();
        }

        const streams = this.buildStreams(opts.modes, opts.categories);
        console.log(`▶️ ${streams.length} streams`);

        let totalStored = 0;
        let globalMaxVerify = state.lastVerifyDate || null;

        for (const stream of streams) {
            console.log(`▶️ ${stream.label}`);
            let result;
            if (mode === 'full') {
                result = await this.fetchStreamFull(stream, state);
            } else if (mode === 'range') {
                result = await this.runMonthWindows(
                    stream,
                    state,
                    opts.from || `${EARLIEST_MONTH}-01`,
                    opts.to || new Date().toISOString().slice(0, 10)
                );
            } else {
                result = await this.fetchStream(stream, state, { mode: 'incremental' });
            }
            totalStored += result.stored;
            console.log(
                `   ${stream.label}: pages=${result.pages} examined=${result.examined} stored=${result.stored}`
            );
            if (result.maxVerifySeen && (!globalMaxVerify || result.maxVerifySeen > globalMaxVerify)) {
                globalMaxVerify = result.maxVerifySeen;
            }
            state.streamsDone[stream.label] = {
                at: new Date().toISOString(),
                stored: result.stored,
                examined: result.examined,
                hitOffsetLimit: !!result.hitOffsetLimit
            };
            this.flushShards();
            this.saveState(state);
            this.flushLocations();
            await sleep(150);
        }

        if (globalMaxVerify) state.lastVerifyDate = globalMaxVerify;
        if (mode === 'full') state.backfillComplete = true;
        this.flushShards();
        this.saveState(state);
        this.flushLocations();
        const index = this.writeIndex(state);
        const sec = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(
            `✅ Done in ${sec}s · API=${this.apiCalls} · stored≈${totalStored} · totalRuns=${index.totalRuns}`
        );
        return index;
    }
}

if (require.main === module) {
    const opts = parseArgs(process.argv.slice(2));
    const fetcher = new RunsArchiveFetcher();
    fetcher.run(opts).catch((err) => {
        console.error('Runs archive fetch failed:', err);
        process.exit(1);
    });
}

module.exports = RunsArchiveFetcher;
module.exports.MODE_NAMES = MODE_NAMES;
module.exports.CATEGORY_NAMES = CATEGORY_NAMES;
module.exports.RUNS_DIR = RUNS_DIR;
module.exports.STATE_FILE = STATE_FILE;
module.exports.INDEX_FILE = INDEX_FILE;
