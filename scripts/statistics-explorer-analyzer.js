const fs = require('fs');
const path = require('path');
const os = require('os');
const { Worker } = require('worker_threads');
const { slimDailyData } = require('./statistics-explorer-slim');

/**
 * Scans daily time-travel cache and emits compact statistics-explorer.json
 * for the Statistics panel (progression, longevity, improving, contested,
 * popularity, stale, unheld, heatmap).
 *
 * Speed:
 * - Parallel worker threads parse daily JSON and return slim payloads
 * - Incremental resume when available-dates only grew at the end and
 *   analyzer version matches the saved checkpoint
 */

/** Bump whenever scoring / legends / hold logic changes (forces full rebuild). */
const ANALYZER_VERSION = 12;

const DIFFICULTY_TIERS = ['Free', 'Warmup', 'Easy', 'Medium', 'Hard', 'Mythic', 'Lottery', 'Inhuman'];

const MODE_BASE_TIER = {
    Peaceful: 'Free',
    Classic: 'Warmup',
    Cheese: 'Warmup',
    Borderless: 'Warmup',
    Winged: 'Warmup',
    'Yin Yang': 'Warmup',
    Magnet: 'Warmup',
    Dimension: 'Easy',
    Statue: 'Easy',
    Arrow: 'Easy',
    Light: 'Easy',
    Wall: 'Medium',
    Portal: 'Medium',
    Twin: 'Medium',
    Key: 'Medium',
    Poison: 'Medium',
    Minesweeper: 'Medium',
    Shield: 'Medium',
    Hotdog: 'Easy',
    Sokoban: 'Hard',
    Gate: 'Hard',
    Bridge: 'Medium'
};

const COUNT_MORE_EASIER = ['Bomb', '10 Apples', '5 Apples', 'Dice', '3 Apples', '1 Apple'];
const COUNT_LESS_EASIER = ['1 Apple', '3 Apples', 'Dice', '5 Apples', '10 Apples', 'Bomb'];
const COUNT_POISON = ['1 Apple', 'Dice', '3 Apples', '5 Apples', '10 Apples', 'Bomb'];
const COUNT_LESS_EASIER_MODES = new Set([
    'Portal', 'Key', 'Sokoban', 'Minesweeper', 'Shield', 'Hotdog'
]);

const HIGHSCORE_MODES = new Set([
    'Wall', 'Portal', 'Key', 'Sokoban', 'Poison', 'Minesweeper',
    'Statue', 'Shield', 'Hotdog', 'Gate', 'Bridge'
]);

const APPLE_AMOUNTS = ['1 Apple', '3 Apples', '5 Apples', '10 Apples', 'Dice', 'Bomb'];
const SPEED_NAMES = ['Normal', 'Fast', 'Slow'];
const SIZE_NAMES = ['Standard', 'Small', 'Large'];
const MODE_NAMES = [
    'Classic', 'Wall', 'Portal', 'Cheese', 'Borderless', 'Twin', 'Winged', 'Yin Yang',
    'Key', 'Sokoban', 'Poison', 'Dimension', 'Minesweeper', 'Statue', 'Light', 'Shield',
    'Arrow', 'Hotdog', 'Magnet', 'Gate', 'Bridge', 'Peaceful'
];
const APPLE_RUNS = ['25 Apples', '50 Apples', '100 Apples', 'All Apples'];

class StatisticsExplorerAnalyzer {
    constructor() {
        this.cacheDir = 'time-travel-cache/daily';
        this.outputFile = 'time-travel-cache/metadata/statistics-explorer.json';
        this.stateFile = 'time-travel-cache/metadata/statistics-explorer-state.json';
        this.availableDatesFile = 'time-travel-cache/metadata/available-dates.json';
        this.workerScript = path.join(__dirname, 'statistics-explorer-worker.js');

        // categoryKey -> last signature { runKey, primary, playerId, playerName }
        this.prevTop = new Map();
        // categoryKey -> change points [{ d, t, n, i }]
        this.progression = new Map();
        // categoryKey -> { flips, holders: Set, daysWithRecord }
        this.categoryMeta = new Map();
        // categoryKey -> open hold { playerId, playerName, primary, runKey, start }
        this.openHolds = new Map();
        // completed holds for longevity ranking
        this.completedHolds = [];
        // date -> { flips, newWrs }
        this.activityHeatmap = [];
        // playerId -> { name, counts: Map(date -> count) }
        this.playerDaily = new Map();
        // dates already folded into state (for incremental)
        this.datesProcessed = [];
    }

    loadAvailableDates() {
        try {
            const data = JSON.parse(fs.readFileSync(this.availableDatesFile, 'utf8'));
            return data.availableDates || [];
        } catch (error) {
            console.error('Error loading available dates:', error.message);
            return [];
        }
    }

    getCacheFilePath(date) {
        const [year, month] = date.split('-');
        return path.join(this.cacheDir, year, month, `${date}.json`);
    }

    extractPlayerId(playerData) {
        if (!playerData) return null;
        return playerData.id || null;
    }

    extractPlayerName(playerData) {
        if (!playerData) return 'Unknown';
        if (playerData.names && playerData.names.international) {
            return playerData.names.international;
        }
        if (playerData.name) return playerData.name;
        return 'Unknown';
    }

    /**
     * Stable identity for the #1 WR run. Prefer SRC run id / weblink so retimes
     * of the same run do not reset longevity or count as flips.
     */
    extractRunKey(topRun) {
        if (!topRun) return 'unknown';
        if (topRun.id) return `id:${topRun.id}`;
        if (topRun.weblink) return `link:${topRun.weblink}`;
        const primary = (topRun.times && topRun.times.primary) || '';
        const playerData = topRun.players && topRun.players.data && topRun.players.data[0];
        const playerId = this.extractPlayerId(playerData) || 'unknown';
        return `fallback:${playerId}|${primary}`;
    }

    extractWeblink(topRun) {
        if (!topRun) return null;
        if (topRun.weblink) return topRun.weblink;
        if (topRun.id) return `https://www.speedrun.com/snake_game/run/${topRun.id}`;
        return null;
    }

    resetAnalysisState() {
        this.prevTop = new Map();
        this.progression = new Map();
        this.categoryMeta = new Map();
        this.openHolds = new Map();
        this.completedHolds = [];
        this.activityHeatmap = [];
        this.playerDaily = new Map();
        this.datesProcessed = [];
    }

    serializeState() {
        const categoryMeta = {};
        for (const [key, meta] of this.categoryMeta) {
            categoryMeta[key] = {
                flips: meta.flips,
                holders: Array.from(meta.holders),
                daysWithRecord: meta.daysWithRecord,
                currentTiedHolders: meta.currentTiedHolders || 1
            };
        }
        const progression = {};
        for (const [key, points] of this.progression) {
            progression[key] = points;
        }
        const prevTop = {};
        for (const [key, v] of this.prevTop) {
            prevTop[key] = v;
        }
        const openHolds = {};
        for (const [key, byPlayer] of this.openHolds) {
            openHolds[key] = Object.fromEntries(byPlayer);
        }
        const playerDaily = {};
        for (const [pid, info] of this.playerDaily) {
            const counts = {};
            for (const [d, n] of info.counts) counts[d] = n;
            playerDaily[pid] = { name: info.name, counts };
        }
        return {
            version: ANALYZER_VERSION,
            datesProcessed: this.datesProcessed.slice(),
            prevTop,
            openHolds,
            completedHolds: this.completedHolds,
            progression,
            categoryMeta,
            playerDaily,
            activityHeatmap: this.activityHeatmap
        };
    }

    restoreState(state) {
        this.resetAnalysisState();
        this.datesProcessed = (state.datesProcessed || []).slice();
        this.completedHolds = state.completedHolds || [];
        this.activityHeatmap = state.activityHeatmap || [];

        this.prevTop = new Map(Object.entries(state.prevTop || {}));
        this.openHolds = new Map();
        for (const [key, byPlayer] of Object.entries(state.openHolds || {})) {
            // v12+: category -> { playerId: hold }; legacy v11: category -> hold
            if (byPlayer && byPlayer.playerId && byPlayer.start) {
                this.openHolds.set(key, new Map([[byPlayer.playerId, byPlayer]]));
            } else {
                this.openHolds.set(key, new Map(Object.entries(byPlayer || {})));
            }
        }
        this.progression = new Map(Object.entries(state.progression || {}));

        this.categoryMeta = new Map();
        for (const [key, meta] of Object.entries(state.categoryMeta || {})) {
            this.categoryMeta.set(key, {
                flips: meta.flips || 0,
                holders: new Set(meta.holders || []),
                daysWithRecord: meta.daysWithRecord || 0,
                currentTiedHolders: meta.currentTiedHolders || 1
            });
        }

        this.playerDaily = new Map();
        for (const [pid, info] of Object.entries(state.playerDaily || {})) {
            this.playerDaily.set(pid, {
                name: info.name,
                counts: new Map(Object.entries(info.counts || {}))
            });
        }
    }

    /**
     * Resume only when prior dates are an exact prefix of available dates
     * and analyzer version matches. Otherwise full rebuild.
     */
    tryLoadIncremental(dates, forceFull) {
        if (forceFull) return { mode: 'full', startIndex: 0 };
        if (!fs.existsSync(this.stateFile)) return { mode: 'full', startIndex: 0 };
        let state;
        try {
            state = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
        } catch (e) {
            console.warn('Checkpoint unreadable — full rebuild:', e.message);
            return { mode: 'full', startIndex: 0 };
        }
        if (!state || state.version !== ANALYZER_VERSION) {
            console.log('Checkpoint version mismatch — full rebuild');
            return { mode: 'full', startIndex: 0 };
        }
        const processed = state.datesProcessed || [];
        if (processed.length === 0) return { mode: 'full', startIndex: 0 };
        if (processed.length > dates.length) {
            console.log('Checkpoint has more dates than available — full rebuild');
            return { mode: 'full', startIndex: 0 };
        }
        for (let i = 0; i < processed.length; i++) {
            if (processed[i] !== dates[i]) {
                console.log('Available dates diverged from checkpoint — full rebuild');
                return { mode: 'full', startIndex: 0 };
            }
        }
        if (processed.length === dates.length) {
            this.restoreState(state);
            return { mode: 'noop', startIndex: dates.length };
        }
        this.restoreState(state);
        console.log(`Incremental: ${processed.length} dates cached, ${dates.length - processed.length} new`);
        return { mode: 'incremental', startIndex: processed.length };
    }

    saveCheckpoint() {
        const outDir = path.dirname(this.stateFile);
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(this.stateFile, JSON.stringify(this.serializeState()));
    }

    daysBetween(start, end) {
        const a = Date.parse(start + 'T00:00:00Z');
        const b = Date.parse(end + 'T00:00:00Z');
        if (Number.isNaN(a) || Number.isNaN(b)) return 0;
        return Math.max(0, Math.round((b - a) / 86400000));
    }

    addDays(dateStr, delta) {
        const d = new Date(dateStr + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + delta);
        return d.toISOString().slice(0, 10);
    }

    ensureCategoryMeta(key) {
        if (!this.categoryMeta.has(key)) {
            this.categoryMeta.set(key, { flips: 0, holders: new Set(), daysWithRecord: 0 });
        }
        return this.categoryMeta.get(key);
    }

    closePlayerHold(categoryKey, playerId, endDate, stillStanding = false) {
        const byPlayer = this.openHolds.get(categoryKey);
        if (!byPlayer) return;
        const hold = byPlayer.get(playerId);
        if (!hold) return;
        const days = this.daysBetween(hold.start, endDate);
        this.completedHolds.push({
            category: categoryKey,
            playerId: hold.playerId,
            playerName: hold.playerName,
            time: hold.primary,
            weblink: hold.weblink || null,
            start: hold.start,
            end: endDate,
            days,
            stillStanding: !!stillStanding,
            tiedHolders: hold.tiedHolders || 1
        });
        byPlayer.delete(playerId);
        if (byPlayer.size === 0) this.openHolds.delete(categoryKey);
    }

    closeCategoryHolds(categoryKey, endDate, stillStanding = false) {
        const byPlayer = this.openHolds.get(categoryKey);
        if (!byPlayer) return;
        for (const playerId of Array.from(byPlayer.keys())) {
            this.closePlayerHold(categoryKey, playerId, endDate, stillStanding);
        }
    }

    openPlayerHold(categoryKey, holder, primary, tiedHolderCount, date) {
        let byPlayer = this.openHolds.get(categoryKey);
        if (!byPlayer) {
            byPlayer = new Map();
            this.openHolds.set(categoryKey, byPlayer);
        }
        byPlayer.set(holder.id, {
            playerId: holder.id,
            playerName: holder.name,
            primary,
            weblink: holder.weblink || null,
            start: date,
            tiedHolders: tiedHolderCount
        });
    }

    /**
     * Resolve tied holder list from slim category (v12 `tied` or legacy tiedIds).
     */
    getTiedHolders(cat) {
        if (Array.isArray(cat.tied) && cat.tied.length) {
            return cat.tied.filter((t) => t && t.id).map((t) => ({
                id: t.id,
                name: t.name || 'Unknown',
                weblink: t.weblink || null
            }));
        }
        const ids = cat.tiedIds || [];
        if (ids.length) {
            return ids.map((id, i) => ({
                id,
                name: (cat.tiedNames && cat.tiedNames[i]) || cat.playerName || 'Unknown',
                weblink: i === 0 ? (cat.weblink || null) : null
            }));
        }
        return [{
            id: cat.playerId || 'unknown',
            name: cat.playerName || 'Unknown',
            weblink: cat.weblink || null
        }];
    }

    closeHold(key, endDate, stillStanding = false) {
        // Back-compat alias: close every open holder for the category
        this.closeCategoryHolds(key, endDate, stillStanding);
    }

    processDate(date) {
        const filePath = this.getCacheFilePath(date);
        if (!fs.existsSync(filePath)) {
            this.processSlimDate(date, null);
            return;
        }
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            this.processSlimDate(date, slimDailyData(date, data));
        } catch (error) {
            console.error(`Error reading ${date}:`, error.message);
            this.processSlimDate(date, null);
        }
    }

    /**
     * Fold one day's slim categories into analyzer state (chronological).
     * @param {string} date
     * @param {{ categories: object[], newWrs: number } | null} slim
     */
    processSlimDate(date, slim) {
        if (!slim) {
            this.activityHeatmap.push({ date, flips: 0, newWrs: 0 });
            this.datesProcessed.push(date);
            return;
        }

        let flips = 0;
        const playerCounts = new Map();
        const categories = slim.categories || [];

        for (let c = 0; c < categories.length; c++) {
            const cat = categories[c];
            const categoryKey = cat.key;
            const primary = cat.primary;
            const playerId = cat.playerId;
            const playerName = cat.playerName;
            const runKey = cat.runKey;
            const weblink = cat.weblink;

            const meta = this.ensureCategoryMeta(categoryKey);
            meta.daysWithRecord++;

            const tiedHolders = this.getTiedHolders(cat);
            const tiedHolderCount = tiedHolders.length;
            for (let i = 0; i < tiedHolders.length; i++) {
                meta.holders.add(tiedHolders[i].id);
            }
            meta.currentTiedHolders = tiedHolderCount;

            const prev = this.prevTop.get(categoryKey);
            // Flip only when the WR time changes — tied roster churn is not a flip
            const timeChanged = prev && prev.primary !== primary;

            if (!prev) {
                if (!this.progression.has(categoryKey)) this.progression.set(categoryKey, []);
                this.progression.get(categoryKey).push({
                    d: date,
                    t: primary,
                    n: playerName,
                    i: playerId,
                    w: weblink || null
                });
                for (let i = 0; i < tiedHolders.length; i++) {
                    this.openPlayerHold(categoryKey, tiedHolders[i], primary, tiedHolderCount, date);
                }
            } else if (timeChanged) {
                flips++;
                meta.flips++;
                this.closeCategoryHolds(categoryKey, date);
                if (!this.progression.has(categoryKey)) this.progression.set(categoryKey, []);
                this.progression.get(categoryKey).push({
                    d: date,
                    t: primary,
                    n: playerName,
                    i: playerId,
                    w: weblink || null
                });
                for (let i = 0; i < tiedHolders.length; i++) {
                    this.openPlayerHold(categoryKey, tiedHolders[i], primary, tiedHolderCount, date);
                }
            } else {
                // Same WR time: sync per-player holds to current tied roster
                const byPlayer = this.openHolds.get(categoryKey) || new Map();
                const tiedIds = new Set(tiedHolders.map((t) => t.id));
                for (const pid of Array.from(byPlayer.keys())) {
                    if (!tiedIds.has(pid)) this.closePlayerHold(categoryKey, pid, date);
                }
                for (let i = 0; i < tiedHolders.length; i++) {
                    const holder = tiedHolders[i];
                    const existing = (this.openHolds.get(categoryKey) || new Map()).get(holder.id);
                    if (!existing) {
                        this.openPlayerHold(categoryKey, holder, primary, tiedHolderCount, date);
                    } else {
                        existing.playerName = holder.name;
                        existing.primary = primary;
                        existing.tiedHolders = tiedHolderCount;
                        if (holder.weblink) existing.weblink = holder.weblink;
                    }
                }
            }

            this.prevTop.set(categoryKey, { runKey, primary, playerId, playerName });

            const increments = cat.playerIncrements || {};
            for (const pid of Object.keys(increments)) {
                const inc = increments[pid];
                playerCounts.set(pid, (playerCounts.get(pid) || 0) + inc.n);
                if (!this.playerDaily.has(pid)) {
                    this.playerDaily.set(pid, { name: inc.name, counts: new Map() });
                } else {
                    this.playerDaily.get(pid).name = inc.name;
                }
            }
        }

        for (const [pid, count] of playerCounts) {
            this.playerDaily.get(pid).counts.set(date, count);
        }

        this.activityHeatmap.push({ date, flips, newWrs: slim.newWrs || 0 });
        this.datesProcessed.push(date);
    }

    /**
     * Parse dates in parallel workers (bounded waves); fold chronologically.
     */
    async processDatesParallel(dates, startIndex) {
        const toProcess = dates.slice(startIndex);
        if (toProcess.length === 0) return;

        const workerCount = Math.max(1, Math.min(os.cpus().length, 8, toProcess.length));
        const workers = [];
        for (let i = 0; i < workerCount; i++) {
            workers.push(new Worker(this.workerScript));
        }

        const runJob = (worker, id, date) => new Promise((resolve, reject) => {
            const onMsg = (msg) => {
                if (msg.id !== id) return;
                cleanup();
                resolve(msg);
            };
            const onErr = (err) => {
                cleanup();
                reject(err);
            };
            const cleanup = () => {
                worker.off('message', onMsg);
                worker.off('error', onErr);
            };
            worker.on('message', onMsg);
            worker.on('error', onErr);
            worker.postMessage({
                id,
                date,
                filePath: path.resolve(this.getCacheFilePath(date))
            });
        });

        try {
            for (let base = 0; base < toProcess.length; base += workerCount) {
                const batch = [];
                for (let w = 0; w < workerCount && base + w < toProcess.length; w++) {
                    const idx = base + w;
                    batch.push(runJob(workers[w], idx, toProcess[idx]));
                }
                const msgs = await Promise.all(batch);
                msgs.sort((a, b) => a.id - b.id);
                for (const payload of msgs) {
                    if (!payload.ok && payload.error) {
                        console.error(`Error reading ${payload.date}:`, payload.error);
                    }
                    this.processSlimDate(
                        payload.date,
                        payload.missing || !payload.ok ? null : payload.slim
                    );
                }
                const done = startIndex + Math.min(base + workerCount, toProcess.length);
                if (done % 50 < workerCount || done === dates.length) {
                    console.log(`Processed ${done}/${dates.length} dates...`);
                }
            }
        } finally {
            await Promise.all(workers.map((w) => w.terminate()));
        }
    }

    buildContested() {
        return Array.from(this.categoryMeta.entries())
            .map(([category, meta]) => ({
                category,
                flips: meta.flips,
                uniqueHolders: meta.holders.size,
                daysWithRecord: meta.daysWithRecord
            }))
            .sort((a, b) => b.flips - a.flips || b.uniqueHolders - a.uniqueHolders);
    }

    isExcludedFromPopularity(category) {
        const p = this.parseCategoryParts(category);
        // Soft-capped easy HS boards that don't get real competition
        return (
            p.mode === 'Statue' &&
            p.run === 'High Score' &&
            p.size === 'Small' &&
            p.apple === 'Bomb'
        );
    }

    buildPopularity() {
        return Array.from(this.categoryMeta.entries())
            .filter(([category]) => !this.isExcludedFromPopularity(category))
            .map(([category, meta]) => ({
                category,
                uniqueHolders: meta.holders.size,
                daysWithRecord: meta.daysWithRecord,
                flips: meta.flips
            }))
            .sort((a, b) => b.uniqueHolders - a.uniqueHolders || b.daysWithRecord - a.daysWithRecord);
    }

    buildStale(lastDate) {
        return Array.from(this.categoryMeta.entries())
            .filter(([, meta]) => meta.daysWithRecord > 0)
            .map(([category, meta]) => {
                const byPlayer = this.openHolds.get(category);
                let holdStart = null;
                let holdDays = 0;
                if (byPlayer && byPlayer.size) {
                    for (const hold of byPlayer.values()) {
                        if (!holdStart || hold.start < holdStart) holdStart = hold.start;
                    }
                    holdDays = this.daysBetween(holdStart, lastDate);
                }
                const tiedNow = meta.currentTiedHolders || 1;
                // Unique holders over history, with current ties ensuring multi-way WRs aren't undersold
                const holders = Math.max(meta.holders.size, tiedNow);
                return {
                    category,
                    flips: meta.flips,
                    uniqueHolders: holders,
                    tiedHolders: tiedNow,
                    daysWithRecord: meta.daysWithRecord,
                    holdStart,
                    holdDays
                };
            })
            .sort((a, b) =>
                a.flips - b.flips ||
                a.uniqueHolders - b.uniqueHolders ||
                a.tiedHolders - b.tiedHolders ||
                b.holdDays - a.holdDays
            );
    }

    isCheese50Small(category) {
        const p = this.parseCategoryParts(category);
        return p.mode === 'Cheese' && p.run === '50 Apples' && p.size === 'Small';
    }

    isUnicornCategory(category) {
        return this.scoreCategory(category).tier === 'Lottery';
    }

    /**
     * Every hold of a Lottery-tier category — including past holders.
     * Present (still standing) first.
     */
    buildUnicorns(lastDate) {
        const rows = [];

        for (const hold of this.completedHolds) {
            if (!this.isUnicornCategory(hold.category)) continue;
            const scored = this.scoreCategory(hold.category);
            rows.push({
                category: hold.category,
                tier: scored.tier,
                score: Math.round(scored.score * 10) / 10,
                playerId: hold.playerId,
                playerName: hold.playerName,
                time: hold.time,
                weblink: hold.weblink || null,
                start: hold.start,
                end: hold.end,
                days: hold.days,
                stillStanding: false,
                cheese50Small: this.isCheese50Small(hold.category)
            });
        }

        for (const [category, byPlayer] of this.openHolds.entries()) {
            if (!this.isUnicornCategory(category)) continue;
            const scored = this.scoreCategory(category);
            for (const hold of byPlayer.values()) {
                rows.push({
                    category,
                    tier: scored.tier,
                    score: Math.round(scored.score * 10) / 10,
                    playerId: hold.playerId,
                    playerName: hold.playerName,
                    time: hold.primary,
                    weblink: hold.weblink || null,
                    start: hold.start,
                    end: lastDate,
                    days: this.daysBetween(hold.start, lastDate),
                    stillStanding: true,
                    cheese50Small: this.isCheese50Small(category)
                });
            }
        }

        rows.sort((a, b) => {
            if (a.stillStanding !== b.stillStanding) return a.stillStanding ? -1 : 1;
            if (a.stillStanding && b.stillStanding) {
                const byHolder = String(a.playerName || '').localeCompare(String(b.playerName || ''));
                if (byHolder) return byHolder;
                return b.days - a.days;
            }
            return b.days - a.days || a.start.localeCompare(b.start);
        });
        return rows;
    }

    /**
     * High Score apple count from SRC primary (fractional seconds → ms = apples).
     * e.g. PT0.086S → 86, PT0.100S → 100, PT0.224S → 224
     */
    parseHighScoreApples(primary) {
        if (!primary || typeof primary !== 'string') return 0;
        const match = primary.match(/PT(?:(\d+)H)?(?:(\d+)M)?([\d.]+)S/);
        if (match) {
            const seconds = parseFloat(match[3]);
            if (!Number.isFinite(seconds)) return 0;
            return Math.round((seconds - Math.floor(seconds)) * 1000);
        }
        return 0;
    }

    /**
     * Mythic holds only.
     * High Score floors: Small ≥35, Standard >220, Large ≥300 and not Slow.
     */
    qualifiesForLegends(category, time) {
        const scored = this.scoreCategory(category);
        if (scored.tier !== 'Mythic') return false;
        const p = this.parseCategoryParts(category);
        if (p.run === 'High Score') {
            const apples = this.parseHighScoreApples(time);
            if (p.size === 'Large') {
                if (p.speed === 'Slow') return false;
                return apples >= 300;
            }
            if (p.size === 'Standard') return apples > 220;
            if (p.size === 'Small') return apples >= 35;
        }
        return true;
    }

    /**
     * Every hold of a Mythic-tier category — including past holders.
     * Hardest (highest score) first.
     */
    buildLegends(lastDate) {
        const rows = [];

        for (const hold of this.completedHolds) {
            if (!this.qualifiesForLegends(hold.category, hold.time)) continue;
            const scored = this.scoreCategory(hold.category);
            rows.push({
                category: hold.category,
                tier: scored.tier,
                score: Math.round(scored.score * 10) / 10,
                playerId: hold.playerId,
                playerName: hold.playerName,
                time: hold.time,
                weblink: hold.weblink || null,
                start: hold.start,
                end: hold.end,
                days: hold.days,
                stillStanding: false
            });
        }

        for (const [category, byPlayer] of this.openHolds.entries()) {
            for (const hold of byPlayer.values()) {
                if (!this.qualifiesForLegends(category, hold.primary)) continue;
                const scored = this.scoreCategory(category);
                rows.push({
                    category,
                    tier: scored.tier,
                    score: Math.round(scored.score * 10) / 10,
                    playerId: hold.playerId,
                    playerName: hold.playerName,
                    time: hold.primary,
                    weblink: hold.weblink || null,
                    start: hold.start,
                    end: lastDate,
                    days: this.daysBetween(hold.start, lastDate),
                    stillStanding: true
                });
            }
        }

        rows.sort((a, b) =>
            b.score - a.score ||
            (a.stillStanding !== b.stillStanding ? (a.stillStanding ? -1 : 1) : 0) ||
            b.days - a.days ||
            a.start.localeCompare(b.start)
        );
        return rows;
    }

    enumerateExpectedCategories() {
        const keys = [];
        for (const apple of APPLE_AMOUNTS) {
            for (const speed of SPEED_NAMES) {
                for (const size of SIZE_NAMES) {
                    for (const mode of MODE_NAMES) {
                        for (const run of APPLE_RUNS) {
                            if (run === '100 Apples' && size === 'Small') continue;
                            // Yin Yang 50 on Small does not exist
                            if (mode === 'Yin Yang' && run === '50 Apples' && size === 'Small') continue;
                            keys.push(`${apple}|${speed}|${size}|${mode}|${run}`);
                        }
                        if (HIGHSCORE_MODES.has(mode)) {
                            keys.push(`${apple}|${speed}|${size}|${mode}|High Score`);
                        }
                    }
                }
            }
        }
        return keys;
    }

    parseCategoryParts(category) {
        const parts = (category || '').split('|');
        return {
            apple: parts[0] || '',
            speed: parts[1] || '',
            size: parts[2] || '',
            mode: parts[3] || '',
            run: parts[4] || ''
        };
    }

    tierIndex(name) {
        const i = DIFFICULTY_TIERS.indexOf(name);
        return i >= 0 ? i : 0;
    }

    effectiveModeTier(mode, size, speed, run, apple) {
        // Peaceful is always Free — no overrides apply
        if (mode === 'Peaceful') return 'Free';

        let tier = MODE_BASE_TIER[mode] || 'Medium';

        if (mode === 'Wall' && run === 'All Apples') {
            // Fast + above Small (Standard/Large) → Inhuman
            if ((size === 'Standard' || size === 'Large') && speed === 'Fast') {
                tier = 'Inhuman';
            } else if (size === 'Standard' || size === 'Large') {
                tier = 'Lottery';
            } else if (size === 'Small' && speed === 'Normal') {
                tier = 'Hard';
            } else if (size === 'Small' && speed === 'Slow') {
                tier = 'Hard';
            } else if (size === 'Small' && speed === 'Fast') {
                tier = 'Mythic';
            }
        } else if (mode === 'Cheese' && run === '50 Apples' && size === 'Small') {
            // 10a/Bomb → Warmup; all other counts → Lottery
            if (apple === '10 Apples' || apple === 'Bomb') {
                tier = 'Warmup';
            } else {
                tier = 'Lottery'; // 1a, 3a, Dice, 5a
            }
        } else if (mode === 'Statue' && apple === '1 Apple' && run === '50 Apples' && size === 'Small') {
            tier = 'Lottery';
        } else if (mode === 'Statue' && run === '100 Apples' && size === 'Standard' && apple === '1 Apple') {
            // Only 1a Statue 100 Standard is Mythic; 3a+ stay below (even Fast)
            tier = 'Mythic';
        } else if (mode === 'Portal' && apple === 'Bomb') {
            // Portal Bomb: Mythic any size/run; Fast → Inhuman (Slow kept Mythic below)
            tier = speed === 'Fast' ? 'Inhuman' : 'Mythic';
        } else if (mode === 'Poison' && apple === 'Bomb') {
            // Poison Bomb: Mythic any size/run; Fast → Inhuman
            // Slow Small: Mythic only for All Apples (other Slow Small runs stay below)
            if (size === 'Small' && speed === 'Slow' && run !== 'All Apples') {
                // leave base tier
            } else if (!(size === 'Small' && run === '25 Apples')) {
                tier = speed === 'Fast' ? 'Inhuman' : 'Mythic';
            }
        } else if (
            mode === 'Poison' &&
            apple === '5 Apples' &&
            size === 'Standard' &&
            (speed === 'Normal' || speed === 'Fast')
        ) {
            // Poison 5a Standard Normal/Fast → Mythic
            // Exception: Normal 100 / High Score are not Mythic
            if (!(speed === 'Normal' && (run === '100 Apples' || run === 'High Score'))) {
                tier = 'Mythic';
            }
        } else if (
            mode === 'Poison' &&
            apple === '3 Apples' &&
            (size === 'Standard' || size === 'Large')
        ) {
            // Poison 3a Standard/Large → Hard (not Medium)
            tier = 'Hard';
        } else if (
            mode !== 'Borderless' &&
            mode !== 'Classic' &&
            mode !== 'Cheese' &&
            mode !== 'Magnet' &&
            mode !== 'Light' &&
            mode !== 'Yin Yang' &&
            !(mode === 'Statue' && (apple === '10 Apples' || apple === 'Bomb')) &&
            !(mode === 'Arrow' && apple === 'Bomb') &&
            !(mode === 'Portal' && apple === 'Bomb') &&
            !(mode === 'Poison' && apple === 'Bomb') &&
            speed === 'Fast' &&
            size === 'Large' &&
            run === 'All Apples'
        ) {
            // Fast + Large + All Apples → Mythic
            // Classic/Cheese/Borderless/Magnet/Light/Yin Yang stay below;
            // Statue All Apples above 5a (10a/Bomb) and Arrow Bomb stay below
            tier = 'Mythic';
        } else if (mode === 'Portal' && speed === 'Fast' && (size === 'Standard' || size === 'Large')) {
            // Fast Portal on Standard/Large is at least Hard
            tier = 'Hard';
        } else if (mode === 'Winged' && speed === 'Fast') {
            // Fast Winged on Small is Easy; Standard/Large floored to Medium below
            tier = 'Easy';
        }

        // Floor: anything Fast on Standard/Large is at least Medium
        if (speed === 'Fast' && (size === 'Standard' || size === 'Large')) {
            if (this.tierIndex(tier) < this.tierIndex('Medium')) {
                tier = 'Medium';
            }
        }

        // Floor: Large + All Apples is at least Hard (not Medium/Easy)
        if (size === 'Large' && run === 'All Apples') {
            if (this.tierIndex(tier) < this.tierIndex('Hard')) {
                tier = 'Hard';
            }
        }

        // Floor: Gate Standard/Large All Apples is at least Mythic
        // (25/50/100/High Score stay at base Hard; Small All Apples stays Hard)
        if (
            mode === 'Gate' &&
            run === 'All Apples' &&
            (size === 'Standard' || size === 'Large')
        ) {
            if (this.tierIndex(tier) < this.tierIndex('Mythic')) {
                tier = 'Mythic';
            }
        }

        // Slow never reaches Mythic (Lottery/Inhuman and Bomb Mythic exceptions stay)
        if (speed === 'Slow' && tier === 'Mythic') {
            const keepMythic =
                (mode === 'Portal' && apple === 'Bomb') ||
                // Poison Bomb Slow Small: Mythic only on All Apples
                (mode === 'Poison' && apple === 'Bomb' && (size !== 'Small' || run === 'All Apples')) ||
                (mode === 'Gate' && run === 'All Apples' && (size === 'Standard' || size === 'Large'));
            if (!keepMythic) tier = 'Hard';
        }

        // Large 100 Apples is never Mythic (or above), any mode/speed/count
        if (
            size === 'Large' &&
            run === '100 Apples' &&
            this.tierIndex(tier) > this.tierIndex('Hard')
        ) {
            tier = 'Hard';
        }

        // Standard 100 Apples is never Mythic — sole exception: Statue (non-Slow)
        if (size === 'Standard' && run === '100 Apples') {
            const statueOk = mode === 'Statue' && speed !== 'Slow';
            if (!statueOk && this.tierIndex(tier) > this.tierIndex('Hard')) {
                tier = 'Hard';
            }
            if (mode === 'Statue' && speed === 'Slow' && this.tierIndex(tier) >= this.tierIndex('Mythic')) {
                tier = 'Hard';
            }
        }

        // Slow Large High Score is never Mythic (Legends also requires ≥300 + non-Slow)
        if (
            speed === 'Slow' &&
            size === 'Large' &&
            run === 'High Score' &&
            this.tierIndex(tier) >= this.tierIndex('Mythic')
        ) {
            tier = 'Hard';
        }

        // Non-exception Slow + Small is Medium at most
        const slowSmallException =
            (mode === 'Wall' && run === 'All Apples') ||
            (mode === 'Cheese' && run === '50 Apples' && size === 'Small') ||
            (mode === 'Statue' && apple === '1 Apple' && run === '50 Apples' && size === 'Small') ||
            (mode === 'Portal' && apple === 'Bomb') ||
            // Poison Bomb Slow Small: only All Apples may stay above Medium
            (mode === 'Poison' && apple === 'Bomb' && run === 'All Apples');
        if (speed === 'Slow' && size === 'Small' && !slowSmallException) {
            if (this.tierIndex(tier) > this.tierIndex('Medium')) {
                tier = 'Medium';
            }
        }

        // Cap: 25 Apples (any size) and 50 Apples on Standard/Large —
        // Hard at most (never Mythic / Lottery / Inhuman). Small 50 can stay higher.
        if (
            run === '25 Apples' ||
            (run === '50 Apples' && (size === 'Standard' || size === 'Large'))
        ) {
            if (this.tierIndex(tier) > this.tierIndex('Hard')) {
                tier = 'Hard';
            }
        }

        return tier;
    }

    countWeight(mode, apple) {
        if (mode === 'Twin') return 0;
        let order;
        if (mode === 'Poison') order = COUNT_POISON;
        else if (COUNT_LESS_EASIER_MODES.has(mode)) order = COUNT_LESS_EASIER;
        else order = COUNT_MORE_EASIER; // more-is-easier default (incl. unknown)
        const idx = order.indexOf(apple);
        return idx >= 0 ? idx : 0;
    }

    sizeWeight(size) {
        if (size === 'Small') return 0;
        if (size === 'Standard') return 1;
        if (size === 'Large') return 2;
        return 1;
    }

    speedWeight(speed) {
        if (speed === 'Slow') return 0;
        if (speed === 'Normal') return 1;
        if (speed === 'Fast') return 2;
        return 1;
    }

    runWeight(run) {
        if (run === '25 Apples') return 0;
        if (run === '50 Apples') return 1;
        if (run === '100 Apples') return 2;
        if (run === 'High Score') return 3;
        if (run === 'All Apples') return 3.2;
        return 0;
    }

    scoreCategory(category) {
        const { apple, speed, size, mode, run } = this.parseCategoryParts(category);
        const tier = this.effectiveModeTier(mode, size, speed, run, apple);
        const modeW = this.tierIndex(tier);
        const score =
            modeW * 100 +
            this.sizeWeight(size) * 10 +
            this.speedWeight(speed) * 10 +
            this.countWeight(mode, apple) * 1 +
            this.runWeight(run) * 1;
        return { score, tier, apple, speed, size, mode, run };
    }

    buildUnheld() {
        const expected = this.enumerateExpectedCategories();
        const rows = [];
        for (const category of expected) {
            if (this.categoryMeta.has(category)) continue;
            const scored = this.scoreCategory(category);
            rows.push({
                category,
                score: Math.round(scored.score * 10) / 10,
                tier: scored.tier
            });
        }
        rows.sort((a, b) => a.score - b.score || a.category.localeCompare(b.category));
        return {
            tiers: DIFFICULTY_TIERS.slice(),
            total: rows.length,
            rows
        };
    }

    isHighScoreCategory(category) {
        return this.parseCategoryParts(category).run === 'High Score';
    }

    buildLongevity(lastDate) {
        for (const key of Array.from(this.openHolds.keys())) {
            this.closeHold(key, lastDate, true);
        }
        const sorted = this.completedHolds
            .slice()
            .sort((a, b) => b.days - a.days || a.start.localeCompare(b.start));
        const mapRow = (h) => ({
            category: h.category,
            playerId: h.playerId,
            playerName: h.playerName,
            time: h.time,
            weblink: h.weblink || null,
            start: h.start,
            end: h.end,
            days: h.days,
            stillStanding: !!h.stillStanding,
            tiedHolders: h.tiedHolders || 1
        });
        return {
            all: sorted.map(mapRow),
            standing: sorted.filter((h) => h.stillStanding).map(mapRow)
        };
    }

    /**
     * Career WR-days = sum of hold lengths (1 point per day per WR held).
     * Also tracks best all-time / still-standing holds for all / untied / tied.
     * Must run after buildLongevity (open holds closed into completedHolds).
     */
    buildCareer() {
        const map = new Map();

        const mapRow = (h) => ({
            category: h.category,
            playerId: h.playerId,
            playerName: h.playerName,
            time: h.time,
            weblink: h.weblink || null,
            start: h.start,
            end: h.end,
            days: h.days,
            stillStanding: !!h.stillStanding,
            tiedHolders: h.tiedHolders || 1
        });

        const better = (a, b) => {
            if (!a) return b;
            if (!b) return a;
            if (b.days !== a.days) return b.days > a.days ? b : a;
            return String(b.start || '').localeCompare(String(a.start || '')) > 0 ? b : a;
        };

        for (const h of this.completedHolds) {
            if (!h.playerId) continue;
            let p = map.get(h.playerId);
            if (!p) {
                p = {
                    playerId: h.playerId,
                    playerName: h.playerName,
                    wrDays: 0,
                    wrDaysUntied: 0,
                    wrDaysTied: 0,
                    holds: 0,
                    standingHolds: 0,
                    bestAll: null,
                    bestStanding: null,
                    bestAllUntied: null,
                    bestStandingUntied: null,
                    bestAllTied: null,
                    bestStandingTied: null
                };
                map.set(h.playerId, p);
            }
            p.playerName = h.playerName || p.playerName;
            const days = h.days || 0;
            const row = mapRow(h);
            const isTied = (h.tiedHolders || 1) > 1;

            p.wrDays += days;
            p.holds += 1;
            p.bestAll = better(p.bestAll, row);

            if (isTied) {
                p.wrDaysTied += days;
                p.bestAllTied = better(p.bestAllTied, row);
            } else {
                p.wrDaysUntied += days;
                p.bestAllUntied = better(p.bestAllUntied, row);
            }

            if (h.stillStanding) {
                p.standingHolds += 1;
                p.bestStanding = better(p.bestStanding, row);
                if (isTied) p.bestStandingTied = better(p.bestStandingTied, row);
                else p.bestStandingUntied = better(p.bestStandingUntied, row);
            }
        }

        return Array.from(map.values()).sort(
            (a, b) => b.wrDays - a.wrDays || String(a.playerName).localeCompare(String(b.playerName))
        );
    }

    countOnOrBefore(countsMap, targetDate, datesAsc) {
        let last = 0;
        for (const d of datesAsc) {
            if (d > targetDate) break;
            if (countsMap.has(d)) last = countsMap.get(d);
        }
        return last;
    }

    buildImproving(datesAsc, limit = 25) {
        if (datesAsc.length === 0) {
            return { '7d': [], '30d': [], '90d': [], '365d': [] };
        }
        const end = datesAsc[datesAsc.length - 1];
        const windows = [7, 30, 90, 365];
        const result = {};

        for (const days of windows) {
            const start = this.addDays(end, -days);
            const ranked = [];
            for (const [playerId, info] of this.playerDaily) {
                const endCount = this.countOnOrBefore(info.counts, end, datesAsc);
                const startCount = this.countOnOrBefore(info.counts, start, datesAsc);
                const delta = endCount - startCount;
                if (delta <= 0) continue;
                ranked.push({
                    playerId,
                    playerName: info.name,
                    delta,
                    startCount,
                    endCount
                });
            }
            ranked.sort((a, b) => b.delta - a.delta || a.playerName.localeCompare(b.playerName));
            result[days + 'd'] = ranked.slice(0, limit);
        }
        return result;
    }

    buildProgressionObject() {
        const out = {};
        for (const [key, points] of this.progression) {
            if (!points || points.length === 0) continue;
            out[key] = points;
        }
        return out;
    }

    async run(options = {}) {
        const t0 = Date.now();
        console.log('Starting statistics explorer analysis...');
        const dates = this.loadAvailableDates();
        if (dates.length === 0) {
            console.error('No available dates found');
            process.exit(1);
        }

        const forceFull = !!(options.full || process.env.STATS_EXPLORER_FULL === '1');
        const useWorkers = options.workers !== false && process.env.STATS_EXPLORER_SYNC !== '1';

        console.log(`Found ${dates.length} dates`);
        const plan = this.tryLoadIncremental(dates, forceFull);

        if (plan.mode === 'noop') {
            console.log('Checkpoint already covers all dates — rebuilding outputs only');
        } else if (plan.mode === 'full') {
            this.resetAnalysisState();
            if (useWorkers) {
                await this.processDatesParallel(dates, 0);
            } else {
                for (let i = 0; i < dates.length; i++) {
                    this.processDate(dates[i]);
                    if ((i + 1) % 50 === 0 || i + 1 === dates.length) {
                        console.log(`Processed ${i + 1}/${dates.length} dates...`);
                    }
                }
            }
        } else {
            // incremental
            if (useWorkers) {
                await this.processDatesParallel(dates, plan.startIndex);
            } else {
                for (let i = plan.startIndex; i < dates.length; i++) {
                    this.processDate(dates[i]);
                    if ((i + 1) % 50 === 0 || i + 1 === dates.length) {
                        console.log(`Processed ${i + 1}/${dates.length} dates...`);
                    }
                }
            }
        }

        console.log(`Processed all ${dates.length} dates (${((Date.now() - t0) / 1000).toFixed(1)}s scan)`);

        // Snapshot state BEFORE longevity closes open holds
        this.saveCheckpoint();

        const lastDate = dates[dates.length - 1];
        const firstDate = dates[0];

        const output = {
            meta: {
                lastUpdated: new Date().toISOString(),
                totalDates: dates.length,
                dateRange: { earliest: firstDate, latest: lastDate },
                analyzerVersion: ANALYZER_VERSION
            },
            activityHeatmap: this.activityHeatmap,
            contested: this.buildContested(),
            // Before longevity closes open holds — need current hold age
            stale: this.buildStale(lastDate),
            popularity: this.buildPopularity(),
            unicorns: this.buildUnicorns(lastDate),
            legends: this.buildLegends(lastDate),
            longevity: this.buildLongevity(lastDate),
            career: this.buildCareer(),
            improving: this.buildImproving(dates, 25),
            unheld: this.buildUnheld(),
            progression: this.buildProgressionObject()
        };

        const outDir = path.dirname(this.outputFile);
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }

        fs.writeFileSync(this.outputFile, JSON.stringify(output));
        const sizeMb = (fs.statSync(this.outputFile).size / (1024 * 1024)).toFixed(2);
        console.log(`Saved ${this.outputFile} (${sizeMb} MB)`);
        console.log(
            `Contested: ${output.contested.length}, Stale: ${output.stale.length}, ` +
            `Unicorns: ${output.unicorns.length}, Legends: ${output.legends.length}, ` +
            `Unheld: ${output.unheld.rows.length}/${output.unheld.total}, ` +
            `Longevity all: ${output.longevity.all.length}, standing: ${output.longevity.standing.length}, ` +
            `Career players: ${output.career.length}, ` +
            `Progression keys: ${Object.keys(output.progression).length}`
        );
        console.log(`Statistics explorer analysis complete in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
    }
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const full = args.includes('--full');
    const sync = args.includes('--sync');
    const analyzer = new StatisticsExplorerAnalyzer();
    analyzer.run({ full, workers: !sync }).catch((error) => {
        console.error('Analysis failed:', error);
        process.exit(1);
    });
}

module.exports = StatisticsExplorerAnalyzer;
module.exports.ANALYZER_VERSION = ANALYZER_VERSION;
