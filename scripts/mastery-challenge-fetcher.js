/**
 * Mastery Challenge — All Apples completions (any verified run).
 *
 * Uses GET /runs (not /leaderboards). Client-filters to all board sizes +
 * all apple amounts + Normal/Fast/Slow across all modes.
 *
 * Usage:
 *   node scripts/mastery-challenge-fetcher.js --from=2026-07-01 --to=2026-07-31
 *   node scripts/mastery-challenge-fetcher.js --full
 *   node scripts/mastery-challenge-fetcher.js --incremental
 */

const fs = require('fs');
const path = require('path');

const GAME_ID = 'o1y9pyk6';
const BASE = 'https://www.speedrun.com/api/v1';
const USER_AGENT = 'FastSnakeStats-Mastery/1.0';

const MODE_NAMES = [
    'Classic', 'Wall', 'Portal', 'Cheese', 'Borderless', 'Twin', 'Winged', 'Yin Yang',
    'Key', 'Sokoban', 'Poison', 'Dimension', 'Minesweeper', 'Statue', 'Light', 'Shield',
    'Arrow', 'Hotdog', 'Magnet', 'Gate', 'Bridge', 'Peaceful'
];
const SPEED_NAMES = ['Normal', 'Fast', 'Slow'];
const APPLE_AMOUNTS = ['1 Apple', '3 Apples', '5 Apples', '10 Apples', 'Dice', 'Bomb', 'Tally'];
const SIZE_NAMES = ['Standard', 'Small', 'Large'];
const RUN_NAME = 'All Apples';
const BOARD_COUNT = MODE_NAMES.length * SPEED_NAMES.length * APPLE_AMOUNTS.length * SIZE_NAMES.length; // 1386

const META_DIR = path.join('time-travel-cache', 'metadata');
const STATE_FILE = path.join(META_DIR, 'mastery-challenge-state.json');
const OUTPUT_FILE = path.join(META_DIR, 'mastery-challenge.json');

function parseArgs(argv) {
    const out = { full: false, incremental: false, from: null, to: null, modes: null };
    for (const a of argv) {
        if (a === '--full') out.full = true;
        else if (a === '--incremental') out.incremental = true;
        else if (a.startsWith('--from=')) out.from = a.slice(7);
        else if (a.startsWith('--to=')) out.to = a.slice(5);
        else if (a.startsWith('--modes=')) {
            out.modes = a.slice(8).split(',').map((s) => s.trim()).filter(Boolean);
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
    const s = String(isoOrDate);
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
}

function runSortDate(run) {
    return (
        dateOnly(run.date) ||
        dateOnly(run.submitted) ||
        dateOnly(run.status && run.status['verify-date']) ||
        null
    );
}

function runVerifyStamp(run) {
    return (
        (run.status && run.status['verify-date']) ||
        run.submitted ||
        (run.date ? `${run.date}T00:00:00Z` : null) ||
        null
    );
}

class MasteryChallengeFetcher {
    constructor() {
        this.lastFailureTime = 0;
        this.failureDelay = 0;
        this.apiCalls = 0;
        this.maps = null; // filled after metadata init
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
                    headers: {
                        Accept: 'application/json',
                        'User-Agent': USER_AGENT
                    }
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

        const allApples = categories.data.find((c) => c.name === 'All Apples' || c.name.includes('All Apples'));
        if (!allApples) throw new Error('All Apples category not found');

        const levelByMode = {};
        for (const mode of MODE_NAMES) {
            const level = levels.data.find((l) => l.name.includes(mode));
            if (!level) {
                console.warn(`⚠️ No SRC level for mode ${mode}`);
                continue;
            }
            levelByMode[mode] = level.id;
        }

        const valueLabelById = {}; // valueId -> label
        const countVar = variables.data.find((v) => v.name === 'Multi Apple Amount');
        const sizeVar = variables.data.find((v) => v.name === 'Board Size');
        const speedVars = variables.data.filter((v) => v.name === 'Speed');

        const ingest = (variable) => {
            if (!variable || !variable.values || !variable.values.values) return;
            for (const [id, val] of Object.entries(variable.values.values)) {
                valueLabelById[id] = val.label;
            }
        };
        ingest(countVar);
        ingest(sizeVar);
        speedVars.forEach(ingest);

        const appleSet = new Set(APPLE_AMOUNTS);
        const speedSet = new Set(SPEED_NAMES);
        const sizeSet = new Set(SIZE_NAMES);

        this.maps = {
            allApplesId: allApples.id,
            levelByMode,
            valueLabelById,
            appleSet,
            speedSet,
            sizeSet,
            modeByLevelId: Object.fromEntries(
                Object.entries(levelByMode).map(([mode, id]) => [id, mode])
            )
        };
        console.log(`✅ Metadata: All Apples=${allApples.id}, modes=${Object.keys(levelByMode).length}`);
    }

    loadState() {
        if (!fs.existsSync(STATE_FILE)) {
            return {
                version: 1,
                lastVerifyDate: null,
                seenRunIds: {},
                // playerId -> { playerName, boards: { boardKey: true } }
                players: {}
            };
        }
        const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        if (!raw.seenRunIds) raw.seenRunIds = {};
        if (!raw.players) raw.players = {};
        return raw;
    }

    saveState(state) {
        if (!fs.existsSync(META_DIR)) fs.mkdirSync(META_DIR, { recursive: true });
        fs.writeFileSync(STATE_FILE, JSON.stringify(state));
    }

    classifyRun(run) {
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
        if (!size || !this.maps.sizeSet.has(size)) return null;
        if (!apple || !this.maps.appleSet.has(apple)) return null;
        if (!speed || !this.maps.speedSet.has(speed)) return null;

        const levelId = typeof run.level === 'string' ? run.level : (run.level && run.level.id);
        const mode = this.maps.modeByLevelId[levelId];
        if (!mode) return null;

        return {
            boardKey: `${apple}|${speed}|${size}|${mode}|${RUN_NAME}`,
            apple,
            speed,
            size,
            mode
        };
    }

    extractPlayer(run) {
        const players = run.players;
        let list = [];
        if (Array.isArray(players)) list = players;
        else if (players && Array.isArray(players.data)) list = players.data;
        const p = list[0];
        if (!p) return null;
        if (p.rel === 'guest' || (!p.id && p.name)) {
            const name = (p.name && String(p.name).trim()) || 'Anonymous';
            return { playerId: `guest:${name}`, playerName: name };
        }
        const id = p.id;
        const name =
            (p.names && (p.names.international || p.names.japanese)) ||
            p.name ||
            id;
        if (!id) return null;
        return { playerId: id, playerName: name };
    }

    creditRun(state, run) {
        if (!run || !run.id) return false;
        if (state.seenRunIds[run.id]) return false;
        if (!run.status || run.status.status !== 'verified') return false;

        const classified = this.classifyRun(run);
        if (!classified) {
            state.seenRunIds[run.id] = 1; // seen but not mastery-relevant
            return false;
        }
        const player = this.extractPlayer(run);
        if (!player) {
            state.seenRunIds[run.id] = 1;
            return false;
        }

        state.seenRunIds[run.id] = 1;
        if (!state.players[player.playerId]) {
            state.players[player.playerId] = {
                playerName: player.playerName,
                boards: {}
            };
        } else {
            state.players[player.playerId].playerName = player.playerName;
        }
        // Keep fastest verified run per board (time + link)
        const primary = (run.times && run.times.primary) || null;
        const primaryT = (run.times && typeof run.times.primary_t === 'number')
            ? run.times.primary_t
            : null;
        const existing = state.players[player.playerId].boards[classified.boardKey];
        const payload = {
            runId: run.id,
            weblink: run.weblink || `https://www.speedrun.com/snake_game/run/${run.id}`,
            time: primary,
            timeT: primaryT
        };
        if (!existing) {
            state.players[player.playerId].boards[classified.boardKey] = payload;
        } else if (
            primaryT != null &&
            (existing.timeT == null || primaryT < existing.timeT)
        ) {
            state.players[player.playerId].boards[classified.boardKey] = payload;
        }
        return true;
    }

    buildOutput(state) {
        const byPlayer = {};
        const leaderboard = [];

        for (const [playerId, info] of Object.entries(state.players)) {
            const boardEntries = Object.entries(info.boards || {});
            if (!boardEntries.length) continue;
            const bySpeed = { Normal: 0, Fast: 0, Slow: 0 };
            const bySize = { Standard: 0, Small: 0, Large: 0 };
            const byMode = {};
            for (const mode of MODE_NAMES) byMode[mode] = 0;
            const completed = [];
            for (const [key, meta] of boardEntries) {
                const parts = key.split('|');
                const speed = parts[1];
                const size = parts[2];
                const mode = parts[3];
                if (bySpeed[speed] != null) bySpeed[speed]++;
                if (bySize[size] != null) bySize[size]++;
                if (byMode[mode] != null) byMode[mode]++;
                const linkMeta = meta && typeof meta === 'object' ? meta : null;
                completed.push({
                    category: key,
                    runId: linkMeta && linkMeta.runId ? linkMeta.runId : null,
                    weblink: linkMeta && linkMeta.weblink ? linkMeta.weblink : null,
                    time: linkMeta && linkMeta.time ? linkMeta.time : null,
                    tier: this.tierForBoard(key)
                });
            }
            completed.sort((a, b) => String(a.category).localeCompare(String(b.category)));
            const total = completed.length;
            byPlayer[playerId] = {
                playerName: info.playerName,
                total,
                bySpeed,
                bySize,
                byMode,
                completed
            };
            leaderboard.push({
                playerId,
                playerName: info.playerName,
                total,
                bySpeed,
                bySize,
                byMode
            });
        }

        leaderboard.sort(
            (a, b) =>
                b.total - a.total ||
                String(a.playerName).localeCompare(String(b.playerName))
        );

        const inhumanBoards = this.listInhumanMasteryBoards();

        return {
            meta: {
                lastUpdated: new Date().toISOString(),
                boardCount: BOARD_COUNT,
                modes: MODE_NAMES.slice(),
                speeds: SPEED_NAMES.slice(),
                appleAmounts: APPLE_AMOUNTS.slice(),
                sizes: SIZE_NAMES.slice(),
                run: RUN_NAME,
                inhumanBoards,
                inhumanBoardCount: inhumanBoards.length,
                rules:
                    'Verified All Apples completions across all modes, sizes, speeds, and apple amounts. Time ignored for ranking; one credit per board per player (best time kept).',
                lastVerifyDate: state.lastVerifyDate || null,
                seenRuns: Object.keys(state.seenRunIds).length
            },
            leaderboard,
            byPlayer
        };
    }

    getDifficultyAnalyzer() {
        if (!this._difficultyAnalyzer) {
            const StatisticsExplorerAnalyzer = require('./statistics-explorer-analyzer');
            this._difficultyAnalyzer = new StatisticsExplorerAnalyzer();
        }
        return this._difficultyAnalyzer;
    }

    tierForBoard(boardKey) {
        try {
            return this.getDifficultyAnalyzer().scoreCategory(boardKey).tier;
        } catch (e) {
            return null;
        }
    }

    listInhumanMasteryBoards() {
        const out = [];
        for (const mode of MODE_NAMES) {
            for (const speed of SPEED_NAMES) {
                for (const size of SIZE_NAMES) {
                    for (const apple of APPLE_AMOUNTS) {
                        const key = `${apple}|${speed}|${size}|${mode}|${RUN_NAME}`;
                        if (this.tierForBoard(key) === 'Inhuman') out.push(key);
                    }
                }
            }
        }
        return out;
    }

    saveOutput(state) {
        if (!fs.existsSync(META_DIR)) fs.mkdirSync(META_DIR, { recursive: true });
        const output = this.buildOutput(state);
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output));
        const sizeMb = (fs.statSync(OUTPUT_FILE).size / (1024 * 1024)).toFixed(2);
        console.log(
            `💾 Saved ${OUTPUT_FILE} (${sizeMb} MB) · ${output.leaderboard.length} players · ` +
                `top=${output.leaderboard[0] ? output.leaderboard[0].playerName + ' ' + output.leaderboard[0].total : '—'}`
        );
        return output;
    }

    /**
     * Paginate /runs for one mode.
     * @param {'range'|'full'|'incremental'} mode
     */
    async fetchModeStream(modeName, levelId, state, opts) {
        const { from, to, mode } = opts;
        let offset = 0;
        let pages = 0;
        let credited = 0;
        let examined = 0;
        let stopStream = false;
        let maxVerifySeen = state.lastVerifyDate || null;

        const orderby = mode === 'incremental' ? 'verify-date' : 'date';
        // range: newest-first so a recent month test does not scan all history
        const direction = mode === 'full' ? 'asc' : 'desc';

        while (!stopStream) {
            if (offset + 200 > 10000) {
                console.warn(
                    `⚠️ ${modeName}: approaching SRC ~10k offset limit at offset=${offset}; stopping this stream`
                );
                break;
            }

            const url =
                `${BASE}/runs?game=${GAME_ID}` +
                `&category=${this.maps.allApplesId}` +
                `&level=${levelId}` +
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

                if (mode === 'incremental') {
                    if (state.lastVerifyDate && stamp && stamp <= state.lastVerifyDate) {
                        stopStream = true;
                        break;
                    }
                    if (this.creditRun(state, run)) credited++;
                    continue;
                }

                if (mode === 'range') {
                    // date desc: skip newer than `to`, stop once older than `from`
                    const d =
                        runSortDate(run) ||
                        dateOnly(run.submitted) ||
                        dateOnly(run.status && run.status['verify-date']);
                    if (!d) continue;
                    if (to && d > to) continue;
                    if (from && d < from) {
                        stopStream = true;
                        break;
                    }
                    if (this.creditRun(state, run)) credited++;
                    continue;
                }

                // full — date asc, no window
                if (this.creditRun(state, run)) credited++;
            }

            if (stopStream) break;
            if (runs.length < 200) break;
            offset += 200;
            if (pages % 5 === 0) {
                console.log(`  … ${modeName}: pages=${pages} offset=${offset} credited=${credited}`);
            }
            await sleep(150);
        }

        return { pages, credited, examined, maxVerifySeen };
    }

    async run(opts) {
        const t0 = Date.now();
        await this.initMaps();

        let mode = 'incremental';
        if (opts.full) mode = 'full';
        else if (opts.from || opts.to) mode = 'range';

        if (mode === 'incremental' && !fs.existsSync(STATE_FILE)) {
            console.log(
                'ℹ️ No mastery-challenge-state.json — incremental no-op. ' +
                    'Run a range/full backfill first.'
            );
            return null;
        }

        if (mode === 'incremental') {
            const existing = this.loadState();
            if (!existing.backfillComplete) {
                console.log(
                    'ℹ️ Mastery state exists but full backfill is not marked complete — incremental no-op.'
                );
                return null;
            }
        }

        const state =
            mode === 'full' || mode === 'range'
                ? {
                      version: 1,
                      lastVerifyDate: null,
                      backfillComplete: mode === 'full',
                      seenRunIds: {},
                      players: {}
                  }
                : this.loadState();

        if (mode === 'range') {
            console.log(`🧪 Range backfill ${opts.from || '…'} → ${opts.to || '…'} (fresh state for test)`);
            state.backfillComplete = false;
        } else if (mode === 'full') {
            console.log('📚 Full historical backfill (fresh state)');
            state.backfillComplete = true;
        } else {
            console.log(`🔁 Incremental since watermark ${state.lastVerifyDate || '(none)'}`);
        }

        const modes = opts.modes && opts.modes.length
            ? MODE_NAMES.filter((m) => opts.modes.includes(m))
            : MODE_NAMES;

        let totalCredited = 0;
        let globalMaxVerify = state.lastVerifyDate || null;

        for (const modeName of modes) {
            const levelId = this.maps.levelByMode[modeName];
            if (!levelId) continue;
            console.log(`▶️ ${modeName}`);
            const result = await this.fetchModeStream(modeName, levelId, state, {
                from: opts.from,
                to: opts.to,
                mode
            });
            totalCredited += result.credited;
            console.log(
                `   ${modeName}: pages=${result.pages} examined=${result.examined} credited=${result.credited}`
            );
            if (result.maxVerifySeen && (!globalMaxVerify || result.maxVerifySeen > globalMaxVerify)) {
                globalMaxVerify = result.maxVerifySeen;
            }
            await sleep(200);
        }

        if (mode === 'incremental' || mode === 'full') {
            if (globalMaxVerify) state.lastVerifyDate = globalMaxVerify;
        } else if (mode === 'range' && globalMaxVerify) {
            // Still record watermark so incremental can continue after a deliberate keep
            state.lastVerifyDate = globalMaxVerify;
        }

        this.saveState(state);
        const output = this.saveOutput(state);
        const sec = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(
            `✅ Done in ${sec}s · API calls=${this.apiCalls} · new credits this run≈${totalCredited} · ` +
                `players=${output.leaderboard.length}`
        );
        return output;
    }
}

if (require.main === module) {
    const opts = parseArgs(process.argv.slice(2));
    const fetcher = new MasteryChallengeFetcher();
    fetcher.run(opts).catch((err) => {
        console.error('Mastery fetch failed:', err);
        process.exit(1);
    });
}

module.exports = MasteryChallengeFetcher;
module.exports.BOARD_COUNT = BOARD_COUNT;
module.exports.MODE_NAMES = MODE_NAMES;
