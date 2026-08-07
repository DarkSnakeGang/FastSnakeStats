/**
 * Patch missing nameStyle onto runs archive from legacy daily cache,
 * then re-derive timelines.
 *
 *   node scripts/backfill-run-name-styles.js
 */

const fs = require('fs');
const path = require('path');

const RUNS_DIR = path.join('time-travel-cache', 'runs');
const DAILY_DIR = path.join('time-travel-cache', 'daily');
const AVAILABLE = path.join('time-travel-cache', 'metadata', 'available-dates.json');

function collectStylesFromDaily() {
    const byId = new Map();
    let dates = [];
    try {
        dates = JSON.parse(fs.readFileSync(AVAILABLE, 'utf8')).availableDates || [];
    } catch (e) {
        console.warn('No available-dates.json');
        return byId;
    }

    // Sample every Nth day + last 60 days for freshest styles
    const sample = [];
    for (let i = 0; i < dates.length; i += 7) sample.push(dates[i]);
    for (let i = Math.max(0, dates.length - 60); i < dates.length; i++) sample.push(dates[i]);
    const uniq = Array.from(new Set(sample));

    console.log(`Scanning ${uniq.length} daily files for name-styles…`);
    for (let i = 0; i < uniq.length; i++) {
        const date = uniq[i];
        const [y, m] = date.split('-');
        const file = path.join(DAILY_DIR, y, m, `${date}.json`);
        if (!fs.existsSync(file)) continue;
        let data;
        try {
            data = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (e) {
            continue;
        }
        for (const rec of Object.values(data.records || {})) {
            if (!rec || !rec.runs) continue;
            for (const run of rec.runs) {
                const players = (run.players && run.players.data) || [];
                for (const p of players) {
                    if (!p || !p.id) continue;
                    const ns = p['name-style'] || p.nameStyle;
                    if (ns) byId.set(p.id, ns);
                }
            }
        }
        if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${uniq.length} files, ${byId.size} players`);
    }
    console.log(`Collected name-styles for ${byId.size} players`);
    return byId;
}

function patchShards(byId) {
    let patched = 0;
    let runs = 0;
    if (!fs.existsSync(RUNS_DIR)) return { patched, runs };

    for (const mode of fs.readdirSync(RUNS_DIR)) {
        const modeDir = path.join(RUNS_DIR, mode);
        if (!fs.statSync(modeDir).isDirectory()) continue;
        for (const file of fs.readdirSync(modeDir)) {
            if (!file.endsWith('.json')) continue;
            const full = path.join(modeDir, file);
            const data = JSON.parse(fs.readFileSync(full, 'utf8'));
            let dirty = false;
            for (const run of Object.values(data.runs || {})) {
                runs++;
                if (run.nameStyle) continue;
                if (run.guest) {
                    run.nameStyle = { style: 'solid', color: { dark: '#9e9e9e', light: '#9e9e9e' } };
                    dirty = true;
                    patched++;
                    continue;
                }
                const ns = byId.get(run.playerId);
                if (ns) {
                    run.nameStyle = ns;
                    dirty = true;
                    patched++;
                }
            }
            if (dirty) fs.writeFileSync(full, JSON.stringify(data));
        }
    }
    return { patched, runs };
}

function main() {
    const byId = collectStylesFromDaily();
    const { patched, runs } = patchShards(byId);
    console.log(`Patched nameStyle on ${patched}/${runs} runs`);
    console.log('Re-deriving timelines…');
    const { spawnSync } = require('child_process');
    const r = spawnSync(process.execPath, [path.join(__dirname, 'derive-runs-timelines.js')], {
        stdio: 'inherit'
    });
    process.exit(r.status || 0);
}

if (require.main === module) main();
