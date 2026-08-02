const fs = require('fs');
const path = require('path');

/**
 * Scans daily time-travel cache and emits compact statistics-explorer.json
 * for the Statistics panel (progression, longevity, improving, contested, popularity, heatmap).
 */
class StatisticsExplorerAnalyzer {
    constructor() {
        this.cacheDir = 'time-travel-cache/daily';
        this.outputFile = 'time-travel-cache/metadata/statistics-explorer.json';
        this.availableDatesFile = 'time-travel-cache/metadata/available-dates.json';

        // categoryKey -> last signature { primary, playerId, playerName }
        this.prevTop = new Map();
        // categoryKey -> change points [{ d, t, n, i }]
        this.progression = new Map();
        // categoryKey -> { flips, holders: Set, daysWithRecord }
        this.categoryMeta = new Map();
        // categoryKey -> open hold { playerId, playerName, primary, start }
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
            start: hold.start,
            end: endDate,
            days,
            stillStanding: !!stillStanding
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

            const meta = this.ensureCategoryMeta(categoryKey);
            meta.daysWithRecord++;
            meta.holders.add(playerId);

            const prev = this.prevTop.get(categoryKey);
            const changed = !prev || prev.primary !== primary || prev.playerId !== playerId;

            if (!prev) {
                if (!this.progression.has(categoryKey)) this.progression.set(categoryKey, []);
                this.progression.get(categoryKey).push({
                    d: date,
                    t: primary,
                    n: playerName,
                    i: playerId
                });
                this.openHolds.set(categoryKey, {
                    playerId,
                    playerName,
                    primary,
                    start: date
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
                    i: playerId
                });
                this.openHolds.set(categoryKey, {
                    playerId,
                    playerName,
                    primary,
                    start: date
                });
            }

            this.prevTop.set(categoryKey, { primary, playerId, playerName });

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

    buildContested(limit = 50) {
        return Array.from(this.categoryMeta.entries())
            .map(([category, meta]) => ({
                category,
                flips: meta.flips,
                uniqueHolders: meta.holders.size,
                daysWithRecord: meta.daysWithRecord
            }))
            .sort((a, b) => b.flips - a.flips || b.uniqueHolders - a.uniqueHolders)
            .slice(0, limit);
    }

    buildPopularity(limit = 50) {
        return Array.from(this.categoryMeta.entries())
            .map(([category, meta]) => ({
                category,
                uniqueHolders: meta.holders.size,
                daysWithRecord: meta.daysWithRecord,
                flips: meta.flips
            }))
            .sort((a, b) => b.uniqueHolders - a.uniqueHolders || b.daysWithRecord - a.daysWithRecord)
            .slice(0, limit);
    }

    buildLongevity(lastDate, limit = 50) {
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
            start: h.start,
            end: h.end,
            days: h.days,
            stillStanding: !!h.stillStanding
        });
        return {
            all: sorted.slice(0, limit).map(mapRow),
            standing: sorted.filter((h) => h.stillStanding).slice(0, limit).map(mapRow)
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
            contested: this.buildContested(50),
            popularity: this.buildPopularity(50),
            longevity: this.buildLongevity(lastDate, 50),
            improving: this.buildImproving(dates, 25),
            progression: this.buildProgressionObject()
        };

        const outDir = path.dirname(this.outputFile);
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }

        fs.writeFileSync(this.outputFile, JSON.stringify(output));
        const sizeMb = (fs.statSync(this.outputFile).size / (1024 * 1024)).toFixed(2);
        console.log(`Saved ${this.outputFile} (${sizeMb} MB)`);
        console.log(`Contested: ${output.contested.length}, Longevity all: ${output.longevity.all.length}, standing: ${output.longevity.standing.length}, Progression keys: ${Object.keys(output.progression).length}`);
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
