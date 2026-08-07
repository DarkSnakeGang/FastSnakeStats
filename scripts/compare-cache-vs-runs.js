/**
 * Compare legacy daily WR cache vs runs-derived WR-as-of (play date).
 *
 * Usage:
 *   node scripts/compare-cache-vs-runs.js
 *   node scripts/compare-cache-vs-runs.js --dates=2024-01-15,2026-07-01 --limit=30
 */

const fs = require('fs');
const path = require('path');
const { wrAsOf, TIMELINES_FILE, buildDaySnapshot } = require('./derive-runs-timelines');

function parseArgs(argv) {
    const out = { dates: null, limit: 40 };
    for (const a of argv) {
        if (a.startsWith('--dates=')) out.dates = a.slice(8).split(',').map((s) => s.trim()).filter(Boolean);
        else if (a.startsWith('--limit=')) out.limit = parseInt(a.slice(8), 10) || 40;
    }
    return out;
}

function dailyPath(date) {
    const [y, m] = date.split('-');
    return path.join('time-travel-cache', 'daily', y, m, `${date}.json`);
}

function topIds(record) {
    if (!record || !record.success || !record.runs) return [];
    return record.runs.map((r) => r.id).filter(Boolean).sort();
}

function topTime(record) {
    if (!record || !record.runs || !record.runs[0]) return null;
    return (record.runs[0].times && record.runs[0].times.primary) || null;
}

function pickSampleDates() {
    const available = JSON.parse(
        fs.readFileSync(path.join('time-travel-cache', 'metadata', 'available-dates.json'), 'utf8')
    ).availableDates || [];
    if (!available.length) return [];
    const picks = new Set();
    picks.add(available[0]);
    picks.add(available[Math.floor(available.length / 2)]);
    picks.add(available[available.length - 1]);
    // a few more spread out
    for (let i = 1; i <= 4; i++) {
        picks.add(available[Math.floor((available.length * i) / 5)]);
    }
    return Array.from(picks).filter((d) => fs.existsSync(dailyPath(d))).sort();
}

function compareDate(date, timelines, limit) {
    const cache = JSON.parse(fs.readFileSync(dailyPath(date), 'utf8'));
    const cacheRecords = cache.records || {};
    const derived = buildDaySnapshot(timelines.boards || {}, date).records;

    const allKeys = new Set([...Object.keys(cacheRecords), ...Object.keys(derived)]);
    let match = 0;
    let differ = 0;
    let onlyCache = 0;
    let onlyRuns = 0;
    const examples = { differ: [], onlyCache: [], onlyRuns: [] };

    for (const key of allKeys) {
        const c = cacheRecords[key];
        const r = derived[key];
        const cIds = topIds(c);
        const rIds = topIds(r);
        const cHas = cIds.length > 0;
        const rHas = rIds.length > 0;

        if (cHas && rHas) {
            const same =
                cIds.join(',') === rIds.join(',') ||
                (topTime(c) && topTime(c) === topTime(r));
            if (same) match++;
            else {
                differ++;
                if (examples.differ.length < limit) {
                    examples.differ.push({
                        category: key,
                        cacheIds: cIds,
                        runsIds: rIds,
                        cacheTime: topTime(c),
                        runsTime: topTime(r)
                    });
                }
            }
        } else if (cHas && !rHas) {
            onlyCache++;
            if (examples.onlyCache.length < limit) {
                examples.onlyCache.push({ category: key, cacheIds: cIds, cacheTime: topTime(c) });
            }
        } else if (!cHas && rHas) {
            onlyRuns++;
            if (examples.onlyRuns.length < limit) {
                examples.onlyRuns.push({ category: key, runsIds: rIds, runsTime: topTime(r) });
            }
        }
    }

    return {
        date,
        boardsCompared: allKeys.size,
        match,
        differ,
        onlyCache,
        onlyRuns,
        examples
    };
}

function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (!fs.existsSync(TIMELINES_FILE)) {
        console.error('Missing wr-timelines.json — run derive-runs-timelines.js first');
        process.exit(1);
    }
    const timelines = JSON.parse(fs.readFileSync(TIMELINES_FILE, 'utf8'));
    const dates = opts.dates && opts.dates.length ? opts.dates : pickSampleDates();
    if (!dates.length) {
        console.error('No dates to compare');
        process.exit(1);
    }

    const perDate = dates.map((d) => {
        console.log(`Comparing ${d}…`);
        return compareDate(d, timelines, opts.limit);
    });

    // Player-stats inflation note from files if present
    let playerStatsNote = null;
    const psPath = path.join('time-travel-cache', 'metadata', 'player-stats.json');
    if (fs.existsSync(psPath)) {
        const ps = JSON.parse(fs.readFileSync(psPath, 'utf8'));
        playerStatsNote = {
            source: ps.source || 'unknown',
            topPlayer: ps.players && ps.players[0]
                ? {
                      name: ps.players[0].name,
                      totalRecords: ps.players[0].totalRecords,
                      peak: ps.players[0].peakRecords
                  }
                : null
        };
    }

    const report = {
        generatedAt: new Date().toISOString(),
        summary:
            'Legacy daily/ is /leaderboards?date= snapshots (WR each day). Runs-derived uses unique verified runs with WR-as-of by play date. Differences are expected.',
        expectedDifferenceClasses: [
            'Verify lag — play date vs leaderboard date= snapshot',
            'Deleted / rejected / vanished runs still in old daily files',
            'Guests / ignored players filter differences',
            'Duplicate day counting in legacy player-stats vs unique run ids',
            'Coverage gaps (Dice/Bomb/Tally cutoffs, CE Tally HS, backfill holes)',
            'Ties / ordering',
            'High Score / CE routing'
        ],
        playerStats: playerStatsNote,
        dates: perDate
    };

    const outDir = path.join('time-travel-cache', 'metadata');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'cache-vs-runs-report.json');
    fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

    console.log('\n=== Cache vs Runs ===');
    for (const d of perDate) {
        console.log(
            `${d.date}: match=${d.match} differ=${d.differ} onlyCache=${d.onlyCache} onlyRuns=${d.onlyRuns}`
        );
    }
    console.log(`\n💾 ${outFile}`);
}

if (require.main === module) {
    main();
}

module.exports = { compareDate, pickSampleDates };
