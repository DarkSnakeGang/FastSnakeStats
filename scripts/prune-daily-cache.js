/**
 * Keep only the newest date file under time-travel-cache/daily/.
 * Does not touch runs archive or other metadata.
 *
 * Usage:
 *   node scripts/prune-daily-cache.js
 *   node scripts/prune-daily-cache.js --keep=2026-08-06
 */

const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join('time-travel-cache', 'daily');
const DATE_FILE_RE = /^\d{4}-\d{2}-\d{2}\.json$/;

function parseArgs(argv) {
    let keep = null;
    for (const a of argv) {
        if (a.startsWith('--keep=')) keep = a.slice(7);
    }
    return { keep };
}

function listDateFiles(cacheDir) {
    const out = [];
    if (!fs.existsSync(cacheDir)) return out;

    for (const year of fs.readdirSync(cacheDir)) {
        if (!/^\d{4}$/.test(year)) continue;
        const yearPath = path.join(cacheDir, year);
        if (!fs.statSync(yearPath).isDirectory()) continue;

        for (const month of fs.readdirSync(yearPath)) {
            if (!/^\d{2}$/.test(month)) continue;
            const monthPath = path.join(yearPath, month);
            if (!fs.statSync(monthPath).isDirectory()) continue;

            for (const file of fs.readdirSync(monthPath)) {
                if (!DATE_FILE_RE.test(file)) continue;
                const date = file.replace(/\.json$/, '');
                out.push({
                    date,
                    filePath: path.join(monthPath, file)
                });
            }
        }
    }
    out.sort((a, b) => a.date.localeCompare(b.date));
    return out;
}

function removeEmptyDirs(cacheDir) {
    if (!fs.existsSync(cacheDir)) return;
    for (const year of fs.readdirSync(cacheDir)) {
        if (!/^\d{4}$/.test(year)) continue;
        const yearPath = path.join(cacheDir, year);
        if (!fs.statSync(yearPath).isDirectory()) continue;

        for (const month of fs.readdirSync(yearPath)) {
            if (!/^\d{2}$/.test(month)) continue;
            const monthPath = path.join(yearPath, month);
            if (!fs.statSync(monthPath).isDirectory()) continue;
            if (fs.readdirSync(monthPath).length === 0) {
                fs.rmdirSync(monthPath);
            }
        }
        if (fs.readdirSync(yearPath).length === 0) {
            fs.rmdirSync(yearPath);
        }
    }
}

function main() {
    const { keep } = parseArgs(process.argv.slice(2));
    const files = listDateFiles(CACHE_DIR);
    if (!files.length) {
        console.log('ℹ️ No daily cache date files found — nothing to prune');
        return;
    }

    const keepDate = keep || files[files.length - 1].date;
    const keepEntry = files.find((f) => f.date === keepDate);
    if (!keepEntry) {
        console.error(`❌ Keep date not found: ${keepDate}`);
        process.exit(1);
    }

    let deleted = 0;
    for (const entry of files) {
        if (entry.date === keepDate) continue;
        fs.unlinkSync(entry.filePath);
        deleted++;
    }

    removeEmptyDirs(CACHE_DIR);
    console.log(`✅ Kept ${keepDate} (${keepEntry.filePath})`);
    console.log(`🗑️  Deleted ${deleted} older daily file(s)`);
}

if (require.main === module) {
    main();
}

module.exports = { listDateFiles, main };
