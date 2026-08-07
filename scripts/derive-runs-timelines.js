/**
 * Build WR timelines + available dates from the runs archive.
 *
 * Output:
 *   time-travel-cache/runs-derived/wr-timelines.json
 *   time-travel-cache/metadata/available-dates-runs.json
 *
 * WR-as-of day D = best verified run with play date <= D (High Score: higher
 * primary_t wins; timed: lower primary_t wins). Ties keep all equal bests.
 *
 * Usage:
 *   node scripts/derive-runs-timelines.js
 */

const fs = require('fs');
const path = require('path');

const RUNS_DIR = path.join('time-travel-cache', 'runs');
const OUT_DIR = path.join('time-travel-cache', 'runs-derived');
const TIMELINES_FILE = path.join(OUT_DIR, 'wr-timelines.json');
const AVAILABLE_DATES_FILE = path.join('time-travel-cache', 'metadata', 'available-dates-runs.json');

function isHighScoreCategory(category) {
    return String(category).endsWith('|High Score');
}

function betterThan(a, b, highScore) {
    if (a.timeT == null && b.timeT == null) return false;
    if (a.timeT == null) return false;
    if (b.timeT == null) return true;
    if (highScore) return a.timeT > b.timeT;
    return a.timeT < b.timeT;
}

function equalTime(a, b) {
    if (a.timeT == null || b.timeT == null) return a.time === b.time;
    return a.timeT === b.timeT;
}

function loadAllRuns() {
    const byBoard = new Map(); // category -> run[]
    if (!fs.existsSync(RUNS_DIR)) {
        throw new Error(`Runs archive missing: ${RUNS_DIR}`);
    }
    for (const mode of fs.readdirSync(RUNS_DIR)) {
        const modeDir = path.join(RUNS_DIR, mode);
        if (!fs.statSync(modeDir).isDirectory()) continue;
        for (const file of fs.readdirSync(modeDir)) {
            if (!file.endsWith('.json')) continue;
            const data = JSON.parse(fs.readFileSync(path.join(modeDir, file), 'utf8'));
            for (const run of Object.values(data.runs || {})) {
                if (!run.category || !run.date) continue;
                if (!byBoard.has(run.category)) byBoard.set(run.category, []);
                byBoard.get(run.category).push(run);
            }
        }
    }
    return byBoard;
}

function buildTimelineForBoard(runs) {
    const highScore = runs.length && isHighScoreCategory(runs[0].category);
    const sorted = runs.slice().sort((a, b) => {
        const dd = String(a.date).localeCompare(String(b.date));
        if (dd) return dd;
        // Same day: better time first so it becomes WR immediately
        if (betterThan(a, b, highScore)) return -1;
        if (betterThan(b, a, highScore)) return 1;
        return String(a.id).localeCompare(String(b.id));
    });

    // Simulate chronological WR changes
    let current = []; // tied WR holders
    const events = []; // { d, runs: [{id,t,pt,p,n,w,g}] }

    for (const run of sorted) {
        const slim = {
            id: run.id,
            t: run.time,
            pt: run.timeT,
            p: run.playerId,
            n: run.playerName,
            w: run.weblink,
            g: !!run.guest,
            ns: run.nameStyle || null
        };

        if (!current.length) {
            current = [slim];
            events.push({ d: run.date, runs: current.slice() });
            continue;
        }

        const best = current[0];
        const cand = { timeT: run.timeT, time: run.time };
        const bestCmp = { timeT: best.pt, time: best.t };

        if (betterThan(cand, bestCmp, highScore)) {
            current = [slim];
            events.push({ d: run.date, runs: current.slice() });
        } else if (equalTime(cand, bestCmp)) {
            // Tie — add if new run id
            if (!current.some((r) => r.id === slim.id)) {
                current = current.concat([slim]);
                events.push({ d: run.date, runs: current.slice() });
            }
        }
        // else worse — ignore for WR timeline
    }

    // Compact consecutive identical tops (same ids)
    const compact = [];
    for (const ev of events) {
        const sig = ev.runs.map((r) => r.id).sort().join(',');
        if (compact.length && compact[compact.length - 1]._sig === sig) continue;
        compact.push({ d: ev.d, runs: ev.runs, _sig: sig });
    }
    return compact.map(({ d, runs }) => ({ d, runs }));
}

function enumerateDates(minDate, maxDate) {
    const out = [];
    const cur = new Date(minDate + 'T00:00:00Z');
    const end = new Date(maxDate + 'T00:00:00Z');
    while (cur <= end) {
        out.push(cur.toISOString().slice(0, 10));
        cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return out;
}

function wrAsOf(timeline, date) {
    if (!timeline || !timeline.length) return [];
    let lo = 0;
    let hi = timeline.length - 1;
    let best = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (timeline[mid].d <= date) {
            best = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    return best >= 0 ? timeline[best].runs : [];
}

function toDailyRecordShape(category, slimRuns, date) {
    const parts = category.split('|');
    // apple|speed|size|mode|run
    const settings = [
        parts[0],
        parts[1],
        parts[2],
        // mode index unused by convertCacheFormat
        0,
        parts[4] === 'High Score' ? 'H' : String(parts[4] || '').replace(/ Apples$/, '')
    ];
    return {
        success: slimRuns.length > 0,
        settings,
        runs: slimRuns.map((r) => ({
            id: r.id,
            date: date,
            weblink: r.w,
            times: { primary: r.t, primary_t: r.pt },
            players: {
                data: [
                    r.g || String(r.p).startsWith('guest:')
                        ? {
                              rel: 'guest',
                              name: r.n,
                              'name-style': r.ns || { style: 'solid', color: { dark: '#9e9e9e', light: '#9e9e9e' } }
                          }
                        : {
                              rel: 'user',
                              id: r.p,
                              names: { international: r.n },
                              weblink: `https://www.speedrun.com/user/${r.p}`,
                              'name-style': r.ns || undefined
                          }
                ]
            },
            values: {}
        }))
    };
}

function buildDaySnapshot(boards, date) {
    const records = {};
    for (const [category, timeline] of Object.entries(boards)) {
        const top = wrAsOf(timeline, date);
        records[category] = toDailyRecordShape(category, top, date);
    }
    return {
        date,
        timestamp: new Date().toISOString(),
        source: 'runs-derived',
        records
    };
}

function main() {
    console.log('Loading runs archive…');
    const byBoard = loadAllRuns();
    console.log(`Boards with runs: ${byBoard.size}`);

    const boards = {};
    let minDate = null;
    let maxDate = null;
    let eventCount = 0;

    for (const [category, runs] of byBoard) {
        const timeline = buildTimelineForBoard(runs);
        boards[category] = timeline;
        eventCount += timeline.length;
        for (const ev of timeline) {
            if (!minDate || ev.d < minDate) minDate = ev.d;
            if (!maxDate || ev.d > maxDate) maxDate = ev.d;
        }
        for (const r of runs) {
            if (r.date && (!minDate || r.date < minDate)) minDate = r.date;
            if (r.date && (!maxDate || r.date > maxDate)) maxDate = r.date;
        }
    }

    if (!minDate || !maxDate) {
        throw new Error('No dated runs in archive');
    }

    // Extend max to today so calendar includes recent empty days after last WR flip
    const today = new Date().toISOString().slice(0, 10);
    if (today > maxDate) maxDate = today;

    const availableDates = enumerateDates(minDate, maxDate);

    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
    const payload = {
        meta: {
            lastUpdated: new Date().toISOString(),
            boardCount: Object.keys(boards).length,
            eventCount,
            dateMin: minDate,
            dateMax: maxDate,
            totalDates: availableDates.length
        },
        boards
    };
    fs.writeFileSync(TIMELINES_FILE, JSON.stringify(payload));
    const mb = (fs.statSync(TIMELINES_FILE).size / (1024 * 1024)).toFixed(2);
    console.log(`💾 ${TIMELINES_FILE} (${mb} MB)`);

    const metaDir = path.dirname(AVAILABLE_DATES_FILE);
    if (!fs.existsSync(metaDir)) fs.mkdirSync(metaDir, { recursive: true });
    fs.writeFileSync(
        AVAILABLE_DATES_FILE,
        JSON.stringify(
            {
                lastUpdated: new Date().toISOString(),
                source: 'runs-derived',
                totalDates: availableDates.length,
                availableDates,
                dateRange: { earliest: minDate, latest: maxDate }
            },
            null,
            2
        )
    );
    console.log(`💾 ${AVAILABLE_DATES_FILE} (${availableDates.length} dates)`);

    // Also write a helper module path note for day materialization
    const helper = {
        timelinesFile: TIMELINES_FILE.replace(/\\/g, '/'),
        availableDatesFile: AVAILABLE_DATES_FILE.replace(/\\/g, '/')
    };
    fs.writeFileSync(path.join(OUT_DIR, 'README.json'), JSON.stringify(helper, null, 2));
    console.log('✅ Derive complete');
}

module.exports = {
    loadAllRuns,
    buildTimelineForBoard,
    wrAsOf,
    buildDaySnapshot,
    toDailyRecordShape,
    isHighScoreCategory,
    TIMELINES_FILE,
    AVAILABLE_DATES_FILE,
    OUT_DIR
};

if (require.main === module) {
    try {
        main();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
