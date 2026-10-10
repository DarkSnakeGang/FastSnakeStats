/**
 * Verified runs archive for FastSnakeStats (unique by run id).
 *
 * Uses GET /runs (not /leaderboards). Play date (`run.date`) is semantic;
 * verify-date is the incremental ingest watermark only.
 *
 * Board runs go to time-travel-cache/runs/<mode>/<category>.json (WR derivation input).
 * Every other verified run (non-board categories, archived categories, board rejects,
 * ignored/missing players) goes to time-travel-cache/runs-other/<game-slug>/<category>[__<level>].json
 * so the archive covers every verified run of both games.
 *
 * Usage:
 *   node scripts/runs-archive-fetcher.js --from=2026-07-01 --to=2026-07-31 --modes=Classic,Wall
 *   node scripts/runs-archive-fetcher.js --full
 *   node scripts/runs-archive-fetcher.js --incremental
 *   node scripts/runs-archive-fetcher.js --other-backfill   (rebuild runs-other/ only; boards untouched)
 *   node scripts/runs-archive-fetcher.js --repair-boards    (re-scan boards, add runs missing from runs/)
 *   node scripts/runs-archive-fetcher.js --backfill-examiners (set examiner on existing records only)
 */

const crypto = require('crypto');
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
const OTHER_RUNS_DIR = path.join('time-travel-cache', 'runs-other');
const STATE_FILE = path.join(META_DIR, 'runs-archive-state.json');
const INDEX_FILE = path.join(META_DIR, 'runs-archive-index.json');
/** examiner user id -> display name (null for deleted accounts) */
const EXAMINERS_FILE = path.join(META_DIR, 'examiners.json');
/** --backfill-examiners re-fetches leftover runs by id only when there are at most this many */
const EXAMINER_REFETCH_LIMIT = 1500;

const ARCHIVE_VERSION = 1;
const EARLIEST_MONTH = '2018-01';

const GAME_SLUGS = { [GAME_ID]: 'snake_game', [CE_GAME_ID]: 'snake_game_ce' };
/** Archived SRC categories: v1 /categories/{id} returns 404, so the name can't be looked up */
const ARCHIVED_CATEGORY_NAMES = { n2y9egzd: '69 Apples', '82430zwd': 'Cheese High Score' };

/** classify() results: run belongs to another stream / excluded by --modes / store in runs-other */
const SKIP = 'skip';
const FILTERED = 'filtered';
const OTHER = { other: true };

function parseArgs(argv) {
    const out = {
        full: false,
        incremental: false,
        otherBackfill: false,
        repairBoards: false,
        backfillExaminers: false,
        from: null,
        to: null,
        modes: null,
        categories: null
    };
    for (const a of argv) {
        if (a === '--full') out.full = true;
        else if (a === '--incremental') out.incremental = true;
        else if (a === '--other-backfill') out.otherBackfill = true;
        else if (a === '--repair-boards') out.repairBoards = true;
        else if (a === '--backfill-examiners') out.backfillExaminers = true;
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
    if (
        !out.full && !out.incremental && !out.otherBackfill && !out.repairBoards &&
        !out.backfillExaminers && !out.from
    ) {
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

function cleanLevelName(name) {
    return String(name).trim().replace(/\s*\(Modded\)$/i, '').replace(/\s+Mode$/i, '').trim();
}

function runCategoryId(run) {
    if (!run.category) return null;
    return typeof run.category === 'string' ? run.category : (run.category.data && run.category.data.id) || null;
}

function runLevelId(run) {
    if (!run.level) return null;
    return typeof run.level === 'string' ? run.level : (run.level.data && run.level.data.id) || null;
}

function comboKey(gameId, categoryId, levelId) {
    return `${gameId}|${categoryId}|${levelId || '-'}`;
}

function recordGameId(record) {
    if (record.game) return record.game;
    return String(record.weblink || '').includes('/snake_game_ce/') ? CE_GAME_ID : GAME_ID;
}

class RunsArchiveFetcher {
    constructor() {
        this.lastFailureTime = 0;
        this.failureDelay = 0;
        this.apiCalls = 0;
        this.maps = null;
        /** @type {Map<string, Object>} shard file path -> { runs: { id: record } } */
        this.shardCache = new Map();
        this.dirtyShards = new Set();
        this.locationsData = null;
        this.locationsDirty = false;
        /** --other-backfill: write runs-other/ only, never board shards */
        this.otherOnly = false;
        /** --repair-boards: write board runs missing from runs/ only */
        this.repairBoards = false;
        this.boardRunIds = new Set();
        this.boardMissing = new Set();
        /** gameId -> Set of examiner user ids seen while paging (partitions for full sweeps) */
        this.examinersByGame = {};
        this.coveredCombos = new Set();
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
                    const httpErr = new Error(`HTTP ${response.status}: ${response.statusText}`);
                    httpErr.status = response.status;
                    throw httpErr;
                }
                this.lastFailureTime = 0;
                this.failureDelay = 0;
                return await response.json();
            } catch (err) {
                if (err.status === 404) throw err;
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
        const gameMeta = {
            [GAME_ID]: { categories: categories.data || [], levels: levels.data || [] }
        };
        try {
            const [ceVars, ceCategories, ceLevels] = await Promise.all([
                this.fetchAPI(`${BASE}/games/${CE_GAME_ID}/variables`),
                this.fetchAPI(`${BASE}/games/${CE_GAME_ID}/categories`),
                this.fetchAPI(`${BASE}/games/${CE_GAME_ID}/levels`)
            ]);
            gameMeta[CE_GAME_ID] = {
                categories: ceCategories.data || [],
                levels: ceLevels.data || []
            };
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

        const categoryNameById = Object.assign({}, ARCHIVED_CATEGORY_NAMES);
        const levelNameById = {};
        for (const meta of Object.values(gameMeta)) {
            for (const c of meta.categories) categoryNameById[c.id] = c.name;
            for (const l of meta.levels) levelNameById[l.id] = cleanLevelName(l.name);
        }

        this.maps = {
            gameMeta,
            categoryNameById,
            levelNameById,
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
        if (state.scratch) return; // throwaway state for read-only passes must never replace the real one
        if (!fs.existsSync(META_DIR)) fs.mkdirSync(META_DIR, { recursive: true });
        fs.writeFileSync(STATE_FILE, JSON.stringify(state));
    }

    shardPath(mode, category) {
        const dir = path.join(RUNS_DIR, safeFilePart(mode));
        return path.join(dir, `${safeFilePart(category)}.json`);
    }

    otherShardPath(gameId, category, level) {
        const dir = path.join(OTHER_RUNS_DIR, GAME_SLUGS[gameId] || gameId);
        const name = safeFilePart(category) + (level ? `__${safeFilePart(level)}` : '');
        return path.join(dir, `${name}.json`);
    }

    loadShardFile(file, makeEmpty) {
        if (this.shardCache.has(file)) return this.shardCache.get(file);
        let data = makeEmpty();
        if (fs.existsSync(file)) {
            try {
                data = JSON.parse(fs.readFileSync(file, 'utf8'));
                if (!data.runs) data.runs = {};
            } catch (e) {
                console.warn(`⚠️ Corrupt shard ${file}, resetting`);
            }
        }
        this.shardCache.set(file, data);
        return data;
    }

    loadShard(mode, category) {
        return this.loadShardFile(this.shardPath(mode, category), () => ({ mode, category, runs: {} }));
    }

    loadOtherShard(gameId, categoryId, category, levelId, level) {
        return this.loadShardFile(this.otherShardPath(gameId, category, level), () => ({
            game: gameId,
            category,
            categoryId,
            level,
            levelId,
            runs: {}
        }));
    }

    flushShards() {
        for (const file of this.dirtyShards) {
            const data = this.shardCache.get(file);
            if (!data) continue;
            const dir = path.dirname(file);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(file, JSON.stringify(data));
        }
        this.dirtyShards.clear();
    }

    loadExaminerNames() {
        if (!fs.existsSync(EXAMINERS_FILE)) return {};
        try {
            return JSON.parse(fs.readFileSync(EXAMINERS_FILE, 'utf8')).examiners || {};
        } catch (e) {
            console.warn('⚠️ Corrupt examiners.json, rebuilding');
            return {};
        }
    }

    /** Look up display names for examiner ids not in examiners.json yet (one call per new id) */
    async resolveExaminerNames(ids) {
        const names = this.loadExaminerNames();
        const todo = Array.from(ids).filter((id) => id && !Object.prototype.hasOwnProperty.call(names, id));
        if (!todo.length) return names;
        console.log(`👤 Resolving ${todo.length} examiner name(s)`);
        for (const id of todo.sort()) {
            try {
                const user = await this.fetchAPI(`${BASE}/users/${id}`);
                const n = user && user.data && user.data.names;
                names[id] = (n && (n.international || n.japanese)) || null;
            } catch (e) {
                if (e.status !== 404) throw e;
                names[id] = null; // deleted account
            }
            await sleep(120);
        }
        if (!fs.existsSync(META_DIR)) fs.mkdirSync(META_DIR, { recursive: true });
        fs.writeFileSync(
            EXAMINERS_FILE,
            JSON.stringify({ lastUpdated: new Date().toISOString(), examiners: names }, null, 2)
        );
        return names;
    }

    /** Board run ids already archived — --other-backfill must never duplicate them */
    loadBoardRunIds() {
        const ids = new Set();
        if (!fs.existsSync(RUNS_DIR)) return ids;
        for (const mode of fs.readdirSync(RUNS_DIR)) {
            const modeDir = path.join(RUNS_DIR, mode);
            if (!fs.statSync(modeDir).isDirectory()) continue;
            for (const file of fs.readdirSync(modeDir)) {
                if (!file.endsWith('.json')) continue;
                const data = JSON.parse(fs.readFileSync(path.join(modeDir, file), 'utf8'));
                for (const id of Object.keys(data.runs || {})) ids.add(id);
            }
        }
        return ids;
    }

    writeIndex(state, officialTotals) {
        let totalRuns = 0;
        const shards = [];
        const totalsByGame = { [GAME_ID]: 0, [CE_GAME_ID]: 0 };
        const listShard = (full, entryFor) => {
            const raw = fs.readFileSync(full);
            const data = JSON.parse(raw.toString('utf8'));
            const records = Object.values(data.runs || {});
            for (const record of records) {
                const g = recordGameId(record);
                totalsByGame[g] = (totalsByGame[g] || 0) + 1;
            }
            totalRuns += records.length;
            shards.push(Object.assign(entryFor(data), {
                path: full.replace(/\\/g, '/'),
                count: records.length,
                sha: crypto.createHash('sha1').update(raw).digest('hex')
            }));
        };
        const walk = (rootDir, entryFor) => {
            if (!fs.existsSync(rootDir)) return;
            for (const sub of fs.readdirSync(rootDir)) {
                const subDir = path.join(rootDir, sub);
                if (!fs.statSync(subDir).isDirectory()) continue;
                for (const file of fs.readdirSync(subDir)) {
                    if (!file.endsWith('.json')) continue;
                    listShard(path.join(subDir, file), (data) => entryFor(data, sub, file));
                }
            }
        };
        walk(RUNS_DIR, (data, mode, file) => ({
            mode: data.mode || mode,
            category: data.category || file.replace(/\.json$/, ''),
            board: true
        }));
        walk(OTHER_RUNS_DIR, (data) => ({
            game: data.game,
            category: data.category,
            level: data.level || null,
            board: false
        }));

        let previous = null;
        try {
            if (fs.existsSync(INDEX_FILE)) previous = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
        } catch (e) { /* rebuilt below */ }

        const index = {
            lastUpdated: new Date().toISOString(),
            version: ARCHIVE_VERSION,
            backfillComplete: !!state.backfillComplete,
            otherBackfillComplete: !!(state.otherBackfill && state.otherBackfill.completedAt),
            lastVerifyDate: state.lastVerifyDate || null,
            seenRuns: Object.keys(state.seenRunIds || {}).length,
            totalRuns,
            totalsByGame,
            officialTotalsByGame: officialTotals || (previous && previous.officialTotalsByGame) || null,
            examiners: Object.fromEntries(
                Object.entries(this.loadExaminerNames()).filter(([, name]) => name)
            ),
            shards
        };
        if (!fs.existsSync(META_DIR)) fs.mkdirSync(META_DIR, { recursive: true });
        fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
        console.log(
            `💾 Index ${INDEX_FILE} · totalRuns=${totalRuns} shards=${shards.length} · ` +
                Object.entries(totalsByGame).map(([g, n]) => `${GAME_SLUGS[g] || g}=${n}`).join(' ')
        );
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

    /** First player of a run, including ignored players (flagged); null when none */
    describePlayer(run) {
        const players = run.players;
        let list = [];
        if (Array.isArray(players)) list = players;
        else if (players && Array.isArray(players.data)) list = players.data;
        const p = list[0];
        if (!p) return null;
        const nameStyle = p['name-style'] || p.nameStyle || null;
        if (p.rel === 'guest' || (!p.id && p.name)) {
            const name = (p.name && String(p.name).trim()) || 'Anonymous';
            return {
                playerId: `guest:${name}`,
                playerName: name,
                guest: true,
                ignored: isIgnoredPlayerName(name),
                nameStyle: nameStyle || { style: 'solid', color: { dark: '#9e9e9e', light: '#9e9e9e' } },
                raw: p
            };
        }
        const id = p.id;
        if (!id) return null;
        const name =
            (p.names && (p.names.international || p.names.japanese)) ||
            p.name ||
            id;
        return { playerId: id, playerName: name, guest: false, ignored: isIgnoredPlayerName(name), nameStyle, raw: p };
    }

    /** Board player: null for ignored or missing players (WR derivation excludes them) */
    extractPlayer(run) {
        const d = this.describePlayer(run);
        if (!d || d.ignored) return null;
        if (!d.guest) {
            // Opportunistic country upsert from embedded player (when SRC includes location)
            try {
                const locs = this.touchLocations();
                if (upsertLocationFromPlayer(locs, d.playerId, d.raw)) this.locationsDirty = true;
            } catch (e) { /* non-fatal */ }
        }
        return { playerId: d.playerId, playerName: d.playerName, guest: d.guest, nameStyle: d.nameStyle };
    }

    /**
     * Route one fetched run: board shard when the board classifier accepts it and the
     * player counts, otherwise runs-other/. Returns true when a record was written.
     */
    ingestRun(state, run, stream) {
        if (!run || !run.id) return false;
        if (!run.status || run.status.status !== 'verified') return false;

        const classified = stream.classify(run);
        if (classified === SKIP || classified === FILTERED) return false;

        if (classified && !classified.other) {
            const player = this.extractPlayer(run);
            if (player) {
                if (this.otherOnly) {
                    if (!this.boardRunIds.has(run.id)) this.boardMissing.add(run.id);
                    return false;
                }
                return this.upsertBoardRun(state, run, classified, player, stream.gameId);
            }
        }
        if (this.repairBoards) return false;
        return this.upsertOtherRun(state, run, stream.gameId);
    }

    upsertBoardRun(state, run, classified, player, gameId) {
        if (this.repairBoards ? this.boardRunIds.has(run.id) : state.seenRunIds[run.id]) return false;

        const playDate = runPlayDate(run);
        const primary = (run.times && run.times.primary) || null;
        const primaryT = (run.times && typeof run.times.primary_t === 'number')
            ? run.times.primary_t
            : null;

        const record = {
            id: run.id,
            game: gameId,
            category: classified.category,
            date: playDate,
            verifyDate: (run.status && run.status['verify-date']) || null,
            submitted: run.submitted || null,
            time: primary,
            timeT: primaryT,
            weblink: run.weblink || `https://www.speedrun.com/${GAME_SLUGS[gameId]}/run/${run.id}`,
            playerId: player.playerId,
            playerName: player.playerName,
            guest: !!player.guest,
            nameStyle: player.nameStyle || null,
            examiner: (run.status && run.status.examiner) || null
        };
        if (classified.source) record.source = classified.source;

        const shard = this.loadShard(classified.mode, classified.runCategory);
        shard.runs[run.id] = record;
        this.dirtyShards.add(this.shardPath(classified.mode, classified.runCategory));
        state.seenRunIds[run.id] = 1;
        if (this.repairBoards) {
            this.boardRunIds.add(run.id);
            console.log(`   🩹 ${run.id} ${run.date} → ${classified.mode}/${classified.runCategory}`);
        }
        return true;
    }

    upsertOtherRun(state, run, gameId) {
        if (this.otherOnly) {
            if (this.boardRunIds.has(run.id)) return false;
        } else if (state.seenRunIds[run.id]) {
            return false;
        }

        const categoryId = runCategoryId(run);
        const levelId = runLevelId(run);
        const category = this.maps.categoryNameById[categoryId] || categoryId || 'unknown';
        const level = levelId ? (this.maps.levelNameById[levelId] || levelId) : null;
        const shard = this.loadOtherShard(gameId, categoryId, category, levelId, level);
        state.seenRunIds[run.id] = 1;
        if (shard.runs[run.id]) return false;

        const player = this.describePlayer(run);
        const times = run.times || {};
        shard.runs[run.id] = {
            id: run.id,
            game: gameId,
            category,
            level,
            date: runPlayDate(run),
            verifyDate: (run.status && run.status['verify-date']) || null,
            submitted: run.submitted || null,
            time: times.primary || null,
            timeT: typeof times.primary_t === 'number' ? times.primary_t : null,
            weblink: run.weblink || `https://www.speedrun.com/${GAME_SLUGS[gameId]}/run/${run.id}`,
            playerId: player ? player.playerId : null,
            playerName: player ? player.playerName : null,
            guest: !!(player && player.guest),
            ignoredPlayer: !!(player && player.ignored),
            examiner: (run.status && run.status.examiner) || null
        };
        this.dirtyShards.add(this.otherShardPath(gameId, category, level));
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
                (stream.categoryId ? `&category=${stream.categoryId}` : '') +
                (stream.levelId ? `&level=${stream.levelId}` : '') +
                (stream.examiner ? `&examiner=${stream.examiner}` : '') +
                `&status=verified&embed=players&max=200` +
                `&orderby=${orderby}&direction=${direction}&offset=${offset}`;

            const payload = await this.fetchAPI(url);
            const runs = (payload && payload.data) || [];
            pages++;
            if (!runs.length) break;

            for (const run of runs) {
                examined++;
                const examiner = run.status && run.status.examiner;
                if (examiner) {
                    if (!this.examinersByGame[stream.gameId]) this.examinersByGame[stream.gameId] = new Set();
                    this.examinersByGame[stream.gameId].add(examiner);
                }
                const stamp = runVerifyStamp(run);
                if (stamp && (!maxVerifySeen || stamp > maxVerifySeen)) {
                    maxVerifySeen = stamp;
                }

                const playDate = runPlayDate(run);

                if (mode === 'incremental') {
                    if (state.lastVerifyDate && stamp && stamp <= state.lastVerifyDate) {
                        stopStream = true;
                        break;
                    }
                    if (this.ingestRun(state, run, stream)) stored++;
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

                if (this.ingestRun(state, run, stream)) stored++;
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
                    if (modeFilter && modeFilter.length && !modeFilter.includes(c.mode)) return FILTERED;
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

    /**
     * Catch-all streams for runs-other/: every listed (category, level) of both games that
     * no board stream covers, plus one game-wide sweep per game for archived categories and
     * level-less runs in per-level categories. Combos owned by another stream are skipped.
     */
    buildOtherStreams() {
        const covered = new Set(
            this.buildStreams(null, null).map((s) => comboKey(s.gameId, s.categoryId, s.levelId))
        );
        const streams = [];
        const games = Object.keys(this.maps.gameMeta);

        for (const gameId of games) {
            const { categories, levels } = this.maps.gameMeta[gameId];
            const slug = GAME_SLUGS[gameId] || gameId;
            for (const cat of categories) {
                const levelIds = cat.type === 'per-level' ? levels.map((l) => l.id) : [null];
                for (const levelId of levelIds) {
                    const key = comboKey(gameId, cat.id, levelId);
                    if (covered.has(key)) continue;
                    covered.add(key);
                    const levelLabel = levelId ? `/${this.maps.levelNameById[levelId] || levelId}` : '';
                    streams.push({
                        label: `Other/${slug}/${cat.name}${levelLabel}`,
                        gameId,
                        categoryId: cat.id,
                        levelId,
                        other: true,
                        classify: () => OTHER
                    });
                }
            }
        }

        this.coveredCombos = covered;
        for (const gameId of games) {
            streams.push(this.sweepStream(gameId, null));
        }
        return streams;
    }

    sweepStream(gameId, examiner) {
        const covered = this.coveredCombos;
        return {
            label: `Other/${GAME_SLUGS[gameId] || gameId}/sweep${examiner ? `/examiner:${examiner}` : ''}`,
            gameId,
            categoryId: null,
            levelId: null,
            examiner,
            other: true,
            classify: (run) =>
                covered.has(comboKey(gameId, runCategoryId(run), runLevelId(run))) ? SKIP : OTHER
        };
    }

    /**
     * Archived categories can't be filtered by id (v1 returns 404), and a game-wide listing
     * stops at ~10k offset (Google Snake has ~48k runs). Full rebuilds therefore re-sweep
     * per examiner (every examiner seen while paging the other streams); each examiner's
     * history fits the asc+desc window, and date ordering pages stably.
     */
    buildExaminerSweeps() {
        const streams = [];
        for (const [gameId, examiners] of Object.entries(this.examinersByGame)) {
            for (const examiner of Array.from(examiners).sort()) {
                streams.push(this.sweepStream(gameId, examiner));
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

    async resolveSeenExaminers() {
        const ids = new Set();
        for (const set of Object.values(this.examinersByGame)) set.forEach((id) => ids.add(id));
        try {
            await this.resolveExaminerNames(ids);
        } catch (e) {
            console.warn(`⚠️ Examiner name lookup failed (ids kept, names next run): ${e.message}`);
        }
    }

    /**
     * Set `examiner` on archived records from SRC, changing nothing else (no watermark,
     * seenRunIds or other record fields). Re-lists every stream (each listed run carries
     * status.examiner, including runs by deleted examiners), then re-fetches leftovers by id.
     */
    async backfillExaminers() {
        const t0 = Date.now();
        if (!fs.existsSync(STATE_FILE)) {
            console.log('ℹ️ No runs-archive-state.json — nothing to backfill.');
            return null;
        }
        const state = this.loadState();
        /** run id -> { file, record } across board and other shards */
        const byId = new Map();
        for (const root of [RUNS_DIR, OTHER_RUNS_DIR]) {
            if (!fs.existsSync(root)) continue;
            for (const sub of fs.readdirSync(root)) {
                const dir = path.join(root, sub);
                if (!fs.statSync(dir).isDirectory()) continue;
                for (const file of fs.readdirSync(dir)) {
                    if (!file.endsWith('.json')) continue;
                    const full = path.join(dir, file);
                    const data = this.loadShardFile(full, () => ({ runs: {} }));
                    for (const record of Object.values(data.runs)) byId.set(record.id, { file: full, record });
                }
            }
        }
        console.log(`🔎 Examiner backfill for ${byId.size} archived runs`);

        const resolved = new Set();
        let changed = 0;
        const apply = (run) => {
            const entry = byId.get(run.id);
            if (!entry) return;
            resolved.add(run.id);
            const examiner = (run.status && run.status.examiner) || null;
            if (entry.record.examiner === examiner) return;
            entry.record.examiner = examiner;
            this.dirtyShards.add(entry.file);
            changed++;
        };
        this.ingestRun = (_state, run) => {
            if (run && run.id && run.status && run.status.status === 'verified') apply(run);
            return false;
        };

        const scratch = { scratch: true, seenRunIds: {}, lastVerifyDate: null };
        const streams = this.buildStreams(null, null).concat(this.buildOtherStreams());
        for (const stream of streams) {
            const result = await this.fetchStreamFull(stream, scratch);
            console.log(`   ${stream.label}: examined=${result.examined} · resolved=${resolved.size}/${byId.size}`);
            this.flushShards();
            await sleep(150);
        }

        const leftover = Array.from(byId.keys()).filter((id) => !resolved.has(id));
        console.log(`ℹ️ ${leftover.length} runs not listed by any stream`);
        // Leftovers that SRC deleted or no longer lists as verified keep no examiner
        let gone = 0;
        let notVerified = 0;
        const clear = (runId) => {
            const entry = byId.get(runId);
            if (!('examiner' in entry.record)) return;
            delete entry.record.examiner;
            this.dirtyShards.add(entry.file);
        };
        if (leftover.length && leftover.length <= EXAMINER_REFETCH_LIMIT) {
            for (let i = 0; i < leftover.length; i++) {
                try {
                    const payload = await this.fetchAPI(`${BASE}/runs/${leftover[i]}`);
                    const run = payload && payload.data;
                    if (run && run.status && run.status.status === 'verified') {
                        apply(run);
                    } else {
                        notVerified++;
                        clear(leftover[i]);
                    }
                } catch (e) {
                    if (e.status !== 404) throw e;
                    gone++;
                    clear(leftover[i]);
                }
                if ((i + 1) % 100 === 0) {
                    console.log(`  … by id ${i + 1}/${leftover.length}`);
                    this.flushShards();
                }
                await sleep(120);
            }
            console.log(`ℹ️ Leftovers: ${gone} deleted on SRC, ${notVerified} no longer verified (archive still has them)`);
        } else if (leftover.length) {
            console.warn(`⚠️ Over ${EXAMINER_REFETCH_LIMIT} leftovers — left without examiner`);
        }
        this.flushShards();

        const ids = new Set();
        let withExaminer = 0;
        const perGame = {};
        for (const { record } of byId.values()) {
            const g = GAME_SLUGS[recordGameId(record)];
            if (!perGame[g]) perGame[g] = { withExaminer: 0, without: 0 };
            if (record.examiner) {
                ids.add(record.examiner);
                withExaminer++;
                perGame[g].withExaminer++;
            } else {
                perGame[g].without++;
            }
        }
        await this.resolveExaminerNames(ids);
        const index = this.writeIndex(state, null);
        const sec = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`📊 ${JSON.stringify(perGame)} · examiners=${ids.size}`);
        console.log(
            `✅ Done in ${sec}s · API=${this.apiCalls} · records changed=${changed} · ` +
                `with examiner=${withExaminer}/${byId.size} · totalRuns=${index.totalRuns}`
        );
        return index;
    }

    async run(opts) {
        const t0 = Date.now();
        await this.initMaps();
        if (opts.backfillExaminers) return this.backfillExaminers();

        let mode = 'incremental';
        if (opts.full) mode = 'full';
        else if (opts.otherBackfill) mode = 'other-backfill';
        else if (opts.repairBoards) mode = 'repair-boards';
        else if (opts.from || opts.to) mode = 'range';

        if ((mode === 'other-backfill' || mode === 'repair-boards') && !fs.existsSync(STATE_FILE)) {
            console.log('ℹ️ No runs-archive-state.json — run --full first (it also fills runs-other/).');
            return null;
        }

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
            for (const dir of [RUNS_DIR, OTHER_RUNS_DIR]) {
                if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
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
        } else if (mode === 'other-backfill') {
            console.log('📚 Rebuilding runs-other/ (board shards and watermark untouched)');
            state = this.loadState();
            if (fs.existsSync(OTHER_RUNS_DIR)) {
                fs.rmSync(OTHER_RUNS_DIR, { recursive: true, force: true });
            }
            this.otherOnly = true;
            this.boardRunIds = this.loadBoardRunIds();
            console.log(`ℹ️ ${this.boardRunIds.size} board runs already archived`);
        } else if (mode === 'repair-boards') {
            console.log('🩹 Re-scanning board streams for runs missing from runs/ (watermark untouched)');
            state = this.loadState();
            this.repairBoards = true;
            this.boardRunIds = this.loadBoardRunIds();
            console.log(`ℹ️ ${this.boardRunIds.size} board runs already archived`);
        } else {
            console.log(`🔁 Incremental since ${this.loadState().lastVerifyDate || '(none)'}`);
            state = this.loadState();
        }
        if (!state.otherStreamsDone) state.otherStreamsDone = {};

        const filtered = !!((opts.modes && opts.modes.length) || (opts.categories && opts.categories.length));
        const partitioned = mode === 'full' || mode === 'other-backfill';
        let streams;
        if (mode === 'other-backfill') {
            streams = this.buildStreams(null, null).concat(this.buildOtherStreams());
        } else if (mode === 'repair-boards') {
            streams = this.buildStreams(opts.modes, opts.categories);
        } else {
            streams = this.buildStreams(opts.modes, opts.categories)
                .concat(filtered ? [] : this.buildOtherStreams());
        }
        const examinerSweeps = partitioned && !filtered;
        console.log(`▶️ ${streams.length} streams${examinerSweeps ? ' + examiner sweeps' : ''}`);

        let totalStored = 0;
        let globalMaxVerify = state.lastVerifyDate || null;

        for (let i = 0; i < streams.length; i++) {
            const stream = streams[i];
            console.log(`▶️ ${stream.label}`);
            let result;
            if (stream.examiner) {
                try {
                    result = await this.fetchStreamFull(stream, state);
                } catch (e) {
                    if (e.status !== 404) throw e;
                    console.warn(`   ⚠️ ${stream.label}: examiner account no longer exists, skipped`);
                    continue;
                }
            } else if (mode === 'full' || mode === 'other-backfill' || mode === 'repair-boards') {
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
            if (result.hitOffsetLimit && stream.other && (stream.examiner || !examinerSweeps)) {
                console.warn(`   ⚠️ ${stream.label}: over ~20k runs, middle of the history is not reachable`);
            }
            if (result.maxVerifySeen && (!globalMaxVerify || result.maxVerifySeen > globalMaxVerify)) {
                globalMaxVerify = result.maxVerifySeen;
            }
            const done = stream.other ? state.otherStreamsDone : state.streamsDone;
            if ((mode !== 'other-backfill' || stream.other) && mode !== 'repair-boards') {
                done[stream.label] = {
                    at: new Date().toISOString(),
                    stored: result.stored,
                    examined: result.examined,
                    hitOffsetLimit: !!result.hitOffsetLimit
                };
            }
            this.flushShards();
            this.saveState(state);
            this.flushLocations();
            await sleep(150);

            if (examinerSweeps && i === streams.length - 1 && !stream.examiner) {
                const extra = this.buildExaminerSweeps();
                console.log(`▶️ ${extra.length} examiner sweeps`);
                streams.push(...extra);
            }
        }

        let officialTotals = null;
        if (mode === 'other-backfill') {
            // Board runs keep the incremental watermark; this pass only rebuilt runs-other/
            state.otherBackfill = {
                completedAt: new Date().toISOString(),
                boardRunsMissingFromBoards: this.boardMissing.size
            };
            if (this.boardMissing.size) {
                console.warn(
                    `⚠️ ${this.boardMissing.size} board-eligible runs are not in runs/ ` +
                        '(not counted anywhere; a --full rebuild would add them)'
                );
            }
            officialTotals = await this.fetchOfficialTotals();
        } else if (mode === 'repair-boards') {
            state.boardRepair = { completedAt: new Date().toISOString(), added: totalStored };
        } else {
            if (globalMaxVerify) state.lastVerifyDate = globalMaxVerify;
            if (mode === 'full') state.backfillComplete = true;
        }
        this.flushShards();
        this.saveState(state);
        this.flushLocations();
        await this.resolveSeenExaminers();
        const index = this.writeIndex(state, officialTotals);
        if (officialTotals) {
            for (const [gameId, official] of Object.entries(officialTotals.games)) {
                console.log(
                    `📊 ${GAME_SLUGS[gameId]}: archive=${index.totalsByGame[gameId] || 0} official=${official.totalRuns}`
                );
            }
        }
        const sec = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(
            `✅ Done in ${sec}s · API=${this.apiCalls} · stored≈${totalStored} · totalRuns=${index.totalRuns}`
        );
        return index;
    }

    /** Official verified totals from SRC's game summary, for drift checks (manual backfill only) */
    async fetchOfficialTotals() {
        const games = {};
        for (const [gameId, slug] of Object.entries(GAME_SLUGS)) {
            try {
                const summary = await this.fetchAPI(
                    `https://www.speedrun.com/api/v2/GetGameSummary?gameUrl=${slug}`
                );
                const stats = (summary && summary.stats) || {};
                games[gameId] = {
                    totalRuns: Number(stats.totalRuns),
                    totalRunsFG: Number(stats.totalRunsFG),
                    totalRunsIL: Number(stats.totalRunsIL)
                };
            } catch (e) {
                console.warn(`⚠️ Official total for ${slug} unavailable: ${e.message}`);
            }
        }
        return { checkedAt: new Date().toISOString(), games };
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
module.exports.OTHER_RUNS_DIR = OTHER_RUNS_DIR;
module.exports.STATE_FILE = STATE_FILE;
module.exports.INDEX_FILE = INDEX_FILE;
