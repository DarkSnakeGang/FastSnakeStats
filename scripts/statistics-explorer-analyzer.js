const fs = require('fs');
const path = require('path');

/**
 * Scans daily time-travel cache and emits compact statistics-explorer.json
 * for the Statistics panel (progression, longevity, improving, contested,
 * popularity, stale, unheld, heatmap).
 */

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
        this.availableDatesFile = 'time-travel-cache/metadata/available-dates.json';

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

    closeHold(key, endDate, stillStanding = false) {
        const hold = this.openHolds.get(key);
        if (!hold) return;
        const days = this.daysBetween(hold.start, endDate);
        this.completedHolds.push({
            category: key,
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
        this.openHolds.delete(key);
    }

    processDate(date) {
        const filePath = this.getCacheFilePath(date);
        if (!fs.existsSync(filePath)) {
            this.activityHeatmap.push({ date, flips: 0, newWrs: 0 });
            return;
        }

        let data;
        try {
            data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (error) {
            console.error(`Error reading ${date}:`, error.message);
            this.activityHeatmap.push({ date, flips: 0, newWrs: 0 });
            return;
        }

        const records = data.records || {};
        let flips = 0;
        let newWrs = 0;
        const playerCounts = new Map();

        for (const [categoryKey, categoryData] of Object.entries(records)) {
            if (!categoryData || !categoryData.success || !categoryData.runs || categoryData.runs.length === 0) {
                continue;
            }

            const topRun = categoryData.runs[0];
            const primary = (topRun.times && topRun.times.primary) || '';
            const playerData = topRun.players && topRun.players.data && topRun.players.data[0];
            const playerId = this.extractPlayerId(playerData) || 'unknown';
            const playerName = this.extractPlayerName(playerData);
            const runKey = this.extractRunKey(topRun);
            const weblink = this.extractWeblink(topRun);

            const meta = this.ensureCategoryMeta(categoryKey);
            meta.daysWithRecord++;

            // Count every player tied for WR (same primary as #1) toward holders
            let tiedHolderCount = 0;
            for (const run of categoryData.runs) {
                const t = (run.times && run.times.primary) || '';
                if (t !== primary) break;
                if (!run.players || !run.players.data) continue;
                for (const p of run.players.data) {
                    const pid = this.extractPlayerId(p);
                    if (!pid) continue;
                    meta.holders.add(pid);
                    tiedHolderCount++;
                }
            }
            if (tiedHolderCount === 0) {
                meta.holders.add(playerId);
                tiedHolderCount = 1;
            }
            meta.currentTiedHolders = tiedHolderCount;

            const prev = this.prevTop.get(categoryKey);
            // WR change = different player or time. Do not use SRC run id — duplicate
            // board entries with the same time/player oscillate ids and inflate flips.
            const changed = !prev || prev.primary !== primary || prev.playerId !== playerId;

            if (!prev) {
                if (!this.progression.has(categoryKey)) this.progression.set(categoryKey, []);
                this.progression.get(categoryKey).push({
                    d: date,
                    t: primary,
                    n: playerName,
                    i: playerId,
                    w: weblink || null
                });
                this.openHolds.set(categoryKey, {
                    playerId,
                    playerName,
                    primary,
                    weblink,
                    runKey,
                    start: date,
                    tiedHolders: tiedHolderCount
                });
            } else if (changed) {
                flips++;
                meta.flips++;
                this.closeHold(categoryKey, date);
                if (!this.progression.has(categoryKey)) this.progression.set(categoryKey, []);
                this.progression.get(categoryKey).push({
                    d: date,
                    t: primary,
                    n: playerName,
                    i: playerId,
                    w: weblink || null
                });
                this.openHolds.set(categoryKey, {
                    playerId,
                    playerName,
                    primary,
                    weblink,
                    runKey,
                    start: date,
                    tiedHolders: tiedHolderCount
                });
            } else {
                // Same player+time (retime/id swap): keep hold, refresh display fields
                const hold = this.openHolds.get(categoryKey);
                if (hold) {
                    hold.primary = primary;
                    hold.playerName = playerName;
                    hold.playerId = playerId;
                    hold.runKey = runKey;
                    hold.tiedHolders = tiedHolderCount;
                    if (weblink) hold.weblink = weblink;
                }
            }

            this.prevTop.set(categoryKey, { runKey, primary, playerId, playerName });

            for (const run of categoryData.runs) {
                if (run.date === date) newWrs++;
                if (!run.players || !run.players.data) continue;
                for (const p of run.players.data) {
                    const pid = this.extractPlayerId(p);
                    if (!pid) continue;
                    const pname = this.extractPlayerName(p);
                    playerCounts.set(pid, (playerCounts.get(pid) || 0) + 1);
                    if (!this.playerDaily.has(pid)) {
                        this.playerDaily.set(pid, { name: pname, counts: new Map() });
                    } else {
                        this.playerDaily.get(pid).name = pname;
                    }
                }
            }
        }

        for (const [pid, count] of playerCounts) {
            this.playerDaily.get(pid).counts.set(date, count);
        }

        this.activityHeatmap.push({ date, flips, newWrs });
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
                const hold = this.openHolds.get(category);
                const holdStart = hold ? hold.start : null;
                const holdDays = hold ? this.daysBetween(hold.start, lastDate) : 0;
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

        for (const [category, hold] of this.openHolds.entries()) {
            if (!this.isUnicornCategory(category)) continue;
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
                stillStanding: true,
                cheese50Small: this.isCheese50Small(category)
            });
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
     * Every hold of a Mythic-tier category — including past holders.
     * Hardest (highest score) first.
     */
    buildLegends(lastDate) {
        const rows = [];

        for (const hold of this.completedHolds) {
            const scored = this.scoreCategory(hold.category);
            if (scored.tier !== 'Mythic') continue;
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

        for (const [category, hold] of this.openHolds.entries()) {
            const scored = this.scoreCategory(category);
            if (scored.tier !== 'Mythic') continue;
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
            // Exception: Small 25 is not Mythic (stays base / other floors)
            if (!(size === 'Small' && run === '25 Apples')) {
                tier = speed === 'Fast' ? 'Inhuman' : 'Mythic';
            }
        } else if (
            mode === 'Poison' &&
            apple === '5 Apples' &&
            size === 'Standard' &&
            (speed === 'Normal' || speed === 'Fast')
        ) {
            // Poison 5a Standard Normal+ → Mythic
            tier = 'Mythic';
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
                (mode === 'Poison' && apple === 'Bomb' && !(size === 'Small' && run === '25 Apples')) ||
                (mode === 'Gate' && run === 'All Apples' && (size === 'Standard' || size === 'Large'));
            if (!keepMythic) tier = 'Hard';
        }

        // Non-exception Slow + Small is Medium at most
        const slowSmallException =
            (mode === 'Wall' && run === 'All Apples') ||
            (mode === 'Cheese' && run === '50 Apples' && size === 'Small') ||
            (mode === 'Statue' && apple === '1 Apple' && run === '50 Apples' && size === 'Small') ||
            (mode === 'Portal' && apple === 'Bomb') ||
            (mode === 'Poison' && apple === 'Bomb' && !(size === 'Small' && run === '25 Apples'));
        if (speed === 'Slow' && size === 'Small' && !slowSmallException) {
            if (this.tierIndex(tier) > this.tierIndex('Medium')) {
                tier = 'Medium';
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

    async run() {
        console.log('Starting statistics explorer analysis...');
        const dates = this.loadAvailableDates();
        if (dates.length === 0) {
            console.error('No available dates found');
            process.exit(1);
        }

        console.log(`Found ${dates.length} dates`);
        let processed = 0;
        for (const date of dates) {
            this.processDate(date);
            processed++;
            if (processed % 50 === 0) {
                console.log(`Processed ${processed}/${dates.length} dates...`);
            }
        }
        console.log(`Processed all ${dates.length} dates`);

        const lastDate = dates[dates.length - 1];
        const firstDate = dates[0];

        const output = {
            meta: {
                lastUpdated: new Date().toISOString(),
                totalDates: dates.length,
                dateRange: { earliest: firstDate, latest: lastDate }
            },
            activityHeatmap: this.activityHeatmap,
            contested: this.buildContested(),
            // Before longevity closes open holds — need current hold age
            stale: this.buildStale(lastDate),
            popularity: this.buildPopularity(),
            unicorns: this.buildUnicorns(lastDate),
            legends: this.buildLegends(lastDate),
            longevity: this.buildLongevity(lastDate),
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
            `Progression keys: ${Object.keys(output.progression).length}`
        );
        console.log('Statistics explorer analysis complete.');
    }
}

if (require.main === module) {
    const analyzer = new StatisticsExplorerAnalyzer();
    analyzer.run().catch((error) => {
        console.error('Analysis failed:', error);
        process.exit(1);
    });
}

module.exports = StatisticsExplorerAnalyzer;
