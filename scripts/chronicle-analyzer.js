/**
 * Build Chronicle narrative data from runs-derived timelines.
 *
 * Output: time-travel-cache/metadata/chronicle.json
 *   - eras: loudest days (flips + new WRs) with board handoffs + net movers
 *   - empires: sparse WR-count arcs + peak/latest + turning points
 *   - wars: contested board event reels (incl. ties)
 *
 * Usage:
 *   node scripts/chronicle-analyzer.js
 */

const fs = require('fs');
const path = require('path');
const { TIMELINES_FILE, AVAILABLE_DATES_FILE, loadAllRuns } = require('./derive-runs-timelines');
const StatisticsExplorerAnalyzer = require('./statistics-explorer-analyzer');

const OUT_FILE = path.join('time-travel-cache', 'metadata', 'chronicle.json');
const PLAYER_STATS_FILE = path.join('time-travel-cache', 'metadata', 'player-stats.json');
const EXPLORER_FILE = path.join('time-travel-cache', 'metadata', 'statistics-explorer.json');

const ERA_LIMIT = 80;
const ERA_FLIP_CAP = 10;
const ERA_MOVER_CAP = 10;
const WAR_LIMIT = 40;
const WAR_TAIL = 25;
const TURNING_POINTS = 5;
const INTRO_SCORE_BOOST = 40;

const difficultyScorer = new StatisticsExplorerAnalyzer();

function scoreFlipCategory(category) {
    try {
        const scored = difficultyScorer.scoreCategory(category);
        return {
            score: Math.round((scored.score || 0) * 10) / 10,
            tier: scored.tier || null
        };
    } catch (e) {
        return { score: 0, tier: null };
    }
}

function sortFlipsHardestFirst(flips) {
    return flips.slice().sort((a, b) => {
        const sa = a.score != null ? a.score : scoreFlipCategory(a.category).score;
        const sb = b.score != null ? b.score : scoreFlipCategory(b.category).score;
        if (sb !== sa) return sb - sa;
        return Number(b.tied) - Number(a.tied) || String(a.category).localeCompare(String(b.category));
    });
}

function dateOnly(isoOrDate) {
    if (!isoOrDate) return null;
    const m = String(isoOrDate).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
}

/**
 * First verified submission of each count / speed / size / mode / run type.
 * Stamp = submitted date (fallback play date) — when the setting entered SRC.
 */
function detectIntroductions(byBoard) {
    const buckets = {
        count: new Map(),
        speed: new Map(),
        size: new Map(),
        mode: new Map(),
        run: new Map()
    };
    const kindLabel = {
        count: 'Count',
        speed: 'Speed',
        size: 'Size',
        mode: 'Mode',
        run: 'Run'
    };

    for (const [category, runs] of byBoard) {
        const parts = String(category).split('|');
        if (parts.length < 5) continue;
        const dims = {
            count: parts[0],
            speed: parts[1],
            size: parts[2],
            mode: parts[3],
            run: parts.slice(4).join('|')
        };
        for (const run of runs) {
            const stamp = dateOnly(run.submitted) || dateOnly(run.date);
            if (!stamp) continue;
            for (const kind of Object.keys(dims)) {
                const value = dims[kind];
                if (!value) continue;
                const prev = buckets[kind].get(value);
                if (prev && prev.date < stamp) continue;
                if (prev && prev.date === stamp && String(prev.runId || '') <= String(run.id || '')) continue;
                buckets[kind].set(value, {
                    kind,
                    kindLabel: kindLabel[kind],
                    value,
                    date: stamp,
                    playDate: dateOnly(run.date) || stamp,
                    player: run.playerName || run.playerId || null,
                    playerId: run.playerId || null,
                    category,
                    runId: run.id || null,
                    time: run.time || null
                });
            }
        }
    }

    const list = [];
    for (const kind of Object.keys(buckets)) {
        for (const intro of buckets[kind].values()) list.push(intro);
    }
    list.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || String(a.value).localeCompare(String(b.value)));

    const byDate = new Map();
    for (const intro of list) {
        if (!byDate.has(intro.date)) byDate.set(intro.date, []);
        byDate.get(intro.date).push(intro);
    }
    return { list, byDate };
}

function slimNs(ns) {
    if (!ns || typeof ns !== 'object') return undefined;
    if (ns.style === 'gradient' && ns['color-from'] && ns['color-to']) {
        return {
            style: 'gradient',
            'color-from': ns['color-from'],
            'color-to': ns['color-to']
        };
    }
    if (ns.style === 'solid' && ns.color) {
        return { style: 'solid', color: ns.color };
    }
    return undefined;
}

function slimRun(r) {
    const out = {
        n: r.n || r.p || 'Unknown',
        p: r.p || null,
        t: r.t || null
    };
    if (r.pt != null) out.pt = r.pt;
    if (r.id) out.id = r.id;
    if (r.w) out.w = r.w;
    if (r.g) out.g = true;
    const ns = slimNs(r.ns);
    if (ns) out.ns = ns;
    return out;
}

function holderLabel(runs) {
    if (!runs || !runs.length) return null;
    if (runs.length === 1) return runs[0].n || runs[0].p || 'Unknown';
    return runs.map((r) => r.n || r.p || '?').join(' / ');
}

function loadJson(file, label) {
    if (!fs.existsSync(file)) throw new Error(`Missing ${label}: ${file}`);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function buildSparseSeries(countsMap, datesAsc) {
    const series = [];
    let last = 0;
    let have = false;
    for (const d of datesAsc) {
        if (countsMap.has(d)) {
            last = countsMap.get(d);
            have = true;
        }
        if (!have) continue;
        if (!series.length || series[series.length - 1].c !== last) {
            series.push({ d, c: last });
        }
    }
    return series;
}

function turningPointsFromSeries(series, limit) {
    if (!series || series.length < 2) return [];
    const deltas = [];
    for (let i = 1; i < series.length; i++) {
        const delta = series[i].c - series[i - 1].c;
        if (delta === 0) continue;
        deltas.push({
            date: series[i].d,
            delta,
            from: series[i - 1].c,
            to: series[i].c
        });
    }
    deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.date.localeCompare(a.date));
    return deltas.slice(0, limit);
}

function buildChronicle() {
    const t0 = Date.now();
    console.log('Building Chronicle from runs timelines…');

    const timelines = loadJson(TIMELINES_FILE, 'wr-timelines');
    const datesMeta = loadJson(AVAILABLE_DATES_FILE, 'available-dates-runs');
    const dates = datesMeta.availableDates || [];
    if (!dates.length) throw new Error('No available dates in runs metadata');

    let playerStats = { players: [] };
    try {
        playerStats = loadJson(PLAYER_STATS_FILE, 'player-stats');
    } catch (e) {
        console.warn('player-stats missing — empires will lack peak/latest mirrors');
    }

    let contested = [];
    try {
        const explorer = loadJson(EXPLORER_FILE, 'statistics-explorer');
        contested = explorer.contested || [];
    } catch (e) {
        console.warn('statistics-explorer missing — wars will rank by flip count from timelines');
    }

    const boards = timelines.boards || {};
    const boardKeys = Object.keys(boards);
    const ptr = {};
    for (const key of boardKeys) ptr[key] = -1;

    console.log('Detecting setting introductions from runs archive…');
    let introductions = { list: [], byDate: new Map() };
    try {
        const byBoard = loadAllRuns();
        introductions = detectIntroductions(byBoard);
        console.log(`  ${introductions.list.length} first-seen settings across ${introductions.byDate.size} days`);
    } catch (e) {
        console.warn('Introduction scan failed:', e.message);
    }

    /** @type {Map<string, { name: string, counts: Map<string, number> }>} */
    const playerDaily = new Map();
    /** @type {Map<string, number>} */
    let prevCounts = new Map();
    /** date -> era draft */
    const eraByDate = new Map();
    /** category -> flip count (fallback war ranking) */
    const flipCounts = new Map();

    for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        const dayFlips = [];
        let newWrs = 0;
        /** @type {Map<string, { name: string, n: number }>} */
        const dayCounts = new Map();

        for (const key of boardKeys) {
            const tl = boards[key];
            const prev = ptr[key];
            while (ptr[key] + 1 < tl.length && tl[ptr[key] + 1].d <= date) {
                ptr[key]++;
            }
            if (ptr[key] < 0) continue;

            const curRuns = tl[ptr[key]].runs || [];
            for (const r of curRuns) {
                if (!r.p) continue;
                const prevEntry = dayCounts.get(r.p);
                if (prevEntry) {
                    prevEntry.n += 1;
                    prevEntry.name = r.n || prevEntry.name;
                } else {
                    dayCounts.set(r.p, { name: r.n || r.p, n: 1 });
                }
            }

            if (ptr[key] !== prev && tl[ptr[key]].d === date) {
                newWrs += curRuns.length;
                const fromRuns = prev >= 0 ? tl[prev].runs || [] : [];
                dayFlips.push({
                    category: key,
                    from: holderLabel(fromRuns.map(slimRun)),
                    to: holderLabel(curRuns.map(slimRun)),
                    time: curRuns[0] ? curRuns[0].t : null,
                    tied: curRuns.length > 1,
                    ...scoreFlipCategory(key)
                });
                flipCounts.set(key, (flipCounts.get(key) || 0) + 1);
            }
        }

        for (const [pid, info] of dayCounts) {
            if (!playerDaily.has(pid)) {
                playerDaily.set(pid, { name: info.name, counts: new Map() });
            } else {
                playerDaily.get(pid).name = info.name;
            }
            playerDaily.get(pid).counts.set(date, info.n);
        }

        const movers = [];
        const seen = new Set([...dayCounts.keys(), ...prevCounts.keys()]);
        for (const pid of seen) {
            const before = prevCounts.get(pid) || 0;
            // Absent from today's holdings ⇒ 0 (lost remaining boards)
            const next = dayCounts.has(pid) ? dayCounts.get(pid).n : 0;
            const delta = next - before;
            if (delta === 0) continue;
            const name = (dayCounts.get(pid) && dayCounts.get(pid).name) ||
                (playerDaily.get(pid) && playerDaily.get(pid).name) ||
                pid;
            movers.push({ id: pid, name, delta, from: before, to: next });
            if (!dayCounts.has(pid) && before > 0) {
                if (!playerDaily.has(pid)) {
                    playerDaily.set(pid, { name, counts: new Map() });
                }
                playerDaily.get(pid).counts.set(date, 0);
            }
        }

        // Rebuild prevCounts for next day from current holdings
        prevCounts = new Map();
        for (const [pid, info] of dayCounts) {
            prevCounts.set(pid, info.n);
        }

        if (dayFlips.length || newWrs) {
            movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
            const gainers = movers.filter((m) => m.delta > 0).slice(0, ERA_MOVER_CAP)
                .map((m) => ({ id: m.id, name: m.name, delta: m.delta, to: m.to }));
            const losers = movers.filter((m) => m.delta < 0).slice(0, ERA_MOVER_CAP)
                .map((m) => ({ id: m.id, name: m.name, delta: m.delta, to: m.to }));
            const debuts = (introductions.byDate.get(date) || []).map((d) => ({
                kind: d.kind,
                kindLabel: d.kindLabel,
                value: d.value,
                player: d.player,
                category: d.category
            }));
            eraByDate.set(date, {
                date,
                flips: dayFlips.length,
                newWrs,
                topFlips: sortFlipsHardestFirst(dayFlips).slice(0, ERA_FLIP_CAP),
                netGainers: gainers,
                netLosers: losers,
                debuts,
                score: dayFlips.length + newWrs + (debuts.length ? INTRO_SCORE_BOOST + debuts.length * 5 : 0)
            });
        }

        if ((i + 1) % 200 === 0 || i + 1 === dates.length) {
            console.log(`  Chronicle scan ${i + 1}/${dates.length}`);
        }
    }

    // Ensure every introduction day is in the era mix (even quiet days)
    for (const [date, debutsRaw] of introductions.byDate) {
        const debuts = debutsRaw.map((d) => ({
            kind: d.kind,
            kindLabel: d.kindLabel,
            value: d.value,
            player: d.player,
            category: d.category
        }));
        if (eraByDate.has(date)) {
            const existing = eraByDate.get(date);
            if (!existing.debuts || !existing.debuts.length) {
                existing.debuts = debuts;
                existing.score = (existing.score || 0) + INTRO_SCORE_BOOST + debuts.length * 5;
            }
        } else {
            eraByDate.set(date, {
                date,
                flips: 0,
                newWrs: 0,
                topFlips: [],
                netGainers: [],
                netLosers: [],
                debuts,
                score: INTRO_SCORE_BOOST + debuts.length * 5
            });
        }
    }

    const eras = Array.from(eraByDate.values())
        .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date))
        .slice(0, ERA_LIMIT)
        .map(({ score, ...rest }) => rest);

    // Prefer chronological among top eras for UI scrubber: keep ranked list but also sort copy by date for default “latest big”
    const erasByDate = eras.slice().sort((a, b) => a.date.localeCompare(b.date));

    const statsById = new Map();
    for (const p of playerStats.players || []) {
        if (p && p.id) statsById.set(p.id, p);
    }

    const empires = [];
    for (const [pid, info] of playerDaily) {
        const series = buildSparseSeries(info.counts, dates);
        if (!series.length) continue;
        const ps = statsById.get(pid);
        const peak = ps && ps.peakRecords
            ? { date: ps.peakRecords.date, count: ps.peakRecords.count }
            : series.reduce((best, pt) => (!best || pt.c > best.count ? { date: pt.d, count: pt.c } : best), null);
        const peakPct = ps && ps.peakPercentage
            ? { date: ps.peakPercentage.date, percentage: ps.peakPercentage.percentage }
            : null;
        const latest = ps && ps.latest
            ? { date: ps.latest.date, count: ps.latest.count, percentage: ps.latest.percentage }
            : { date: series[series.length - 1].d, count: series[series.length - 1].c, percentage: null };
        const peakCount = peak ? peak.count : 0;
        const latestCount = latest ? latest.count : 0;
        empires.push({
            id: pid,
            name: (ps && ps.name) || info.name || pid,
            series,
            peak,
            peakPercentage: peakPct,
            latest,
            peakDrop: Math.max(0, peakCount - latestCount),
            turningPoints: turningPointsFromSeries(series, TURNING_POINTS)
        });
    }

    empires.sort(
        (a, b) =>
            b.peakDrop - a.peakDrop ||
            (b.peak && b.peak.count) - (a.peak && a.peak.count) ||
            String(a.name).localeCompare(String(b.name))
    );

    const warCategories = [];
    if (contested.length) {
        for (const row of contested.slice(0, WAR_LIMIT)) {
            if (row && row.category) warCategories.push(row.category);
        }
    } else {
        warCategories.push(
            ...Array.from(flipCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, WAR_LIMIT)
                .map(([k]) => k)
        );
    }

    const wars = [];
    for (const category of warCategories) {
        const tl = boards[category];
        if (!tl || !tl.length) continue;
        const full = tl.map((ev) => ({
            d: ev.d,
            runs: (ev.runs || []).map(slimRun)
        }));
        let events = full;
        if (full.length > WAR_TAIL + 1) {
            events = [full[0], ...full.slice(-(WAR_TAIL))];
        }
        wars.push({
            category,
            flips: full.length > 0 ? full.length - 1 : 0,
            eventCount: full.length,
            truncated: full.length > events.length,
            events
        });
    }

    const defaultEra = erasByDate.length ? erasByDate[erasByDate.length - 1].date : dates[dates.length - 1];
    const defaultEmpire = empires.length ? empires[0].id : null;
    const defaultWar = wars.length ? wars[0].category : null;

    const output = {
        meta: {
            lastUpdated: new Date().toISOString(),
            source: 'runs-derived',
            totalDates: dates.length,
            dateRange: { earliest: dates[0], latest: dates[dates.length - 1] },
            eraCount: eras.length,
            empireCount: empires.length,
            warCount: wars.length,
            introductionCount: introductions.list.length,
            defaults: {
                eraDate: defaultEra,
                empireId: defaultEmpire,
                warCategory: defaultWar
            }
        },
        eras,
        empires,
        wars,
        introductions: introductions.list.map((d) => ({
            kind: d.kind,
            kindLabel: d.kindLabel,
            value: d.value,
            date: d.date,
            playDate: d.playDate,
            player: d.player,
            playerId: d.playerId,
            category: d.category,
            runId: d.runId
        }))
    };

    const outDir = path.dirname(OUT_FILE);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(OUT_FILE, JSON.stringify(output));
    const sizeMb = (fs.statSync(OUT_FILE).size / (1024 * 1024)).toFixed(2);
    console.log(`Saved ${OUT_FILE} (${sizeMb} MB)`);
    console.log(
        `Eras: ${eras.length}, Empires: ${empires.length}, Wars: ${wars.length}, ` +
        `Intros: ${introductions.list.length} (${((Date.now() - t0) / 1000).toFixed(1)}s)`
    );
    return output;
}

if (require.main === module) {
    try {
        buildChronicle();
    } catch (e) {
        console.error('Chronicle build failed:', e);
        process.exit(1);
    }
}

module.exports = { buildChronicle, OUT_FILE };
