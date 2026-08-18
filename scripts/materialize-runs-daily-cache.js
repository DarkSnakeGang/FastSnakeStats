const fs = require('fs');
const path = require('path');
const {
    buildDaySnapshot,
    loadAllRuns,
    buildTimelineForBoard,
    TIMELINES_FILE
} = require('./derive-runs-timelines');

const DAILY_DIR = path.join('time-travel-cache', 'daily');

function dateOnly(value) {
    return String(value).slice(0, 10);
}

function yesterdayUtc() {
    const now = new Date();
    now.setUTCDate(now.getUTCDate() - 1);
    return now.toISOString().slice(0, 10);
}

function parseArgs(argv) {
    const out = { date: null };
    for (const arg of argv) {
        if (arg === '--yesterday') out.date = yesterdayUtc();
        else if (arg.startsWith('--date=')) out.date = dateOnly(arg.slice(7));
        else if (/^\d{4}-\d{2}-\d{2}$/.test(arg)) out.date = arg;
    }
    if (!out.date) out.date = yesterdayUtc();
    return out;
}

function createDateFilePath(date) {
    const [year, month] = date.split('-');
    const dir = path.join(DAILY_DIR, year, month);
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${date}.json`);
}

function loadTimelines() {
    if (fs.existsSync(TIMELINES_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(TIMELINES_FILE, 'utf8'));
        if (parsed && parsed.boards && typeof parsed.boards === 'object') {
            return parsed.boards;
        }
    }

    console.log('ℹ️ WR timelines file missing; rebuilding boards from runs archive shards');
    const byBoard = loadAllRuns();
    const boards = {};
    for (const [category, runs] of byBoard.entries()) {
        boards[category] = buildTimelineForBoard(runs);
    }
    return boards;
}

function materialize(date) {
    const boards = loadTimelines();
    const snapshot = buildDaySnapshot(boards, date);
    const file = createDateFilePath(date);
    fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
    console.log(`💾 Materialized runs-derived daily cache: ${file}`);
    console.log(`   Boards: ${Object.keys(snapshot.records || {}).length}`);
    console.log(`   Source: ${snapshot.source || 'runs-derived'}`);
    return file;
}

if (require.main === module) {
    try {
        const opts = parseArgs(process.argv.slice(2));
        materialize(opts.date);
    } catch (err) {
        console.error('Failed to materialize runs-derived daily cache:', err);
        process.exit(1);
    }
}

module.exports = {
    materialize,
    parseArgs,
    createDateFilePath,
    yesterdayUtc
};
