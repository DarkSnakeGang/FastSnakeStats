/**
 * Worker thread: read + JSON.parse a daily cache file, return slim categories.
 */
const { parentPort } = require('worker_threads');
const fs = require('fs');
const { slimDailyData } = require('./statistics-explorer-slim');

parentPort.on('message', (msg) => {
    const { id, date, filePath } = msg;
    try {
        if (!fs.existsSync(filePath)) {
            parentPort.postMessage({ id, date, ok: true, missing: true, slim: null });
            return;
        }
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const slim = slimDailyData(date, data);
        parentPort.postMessage({ id, date, ok: true, missing: false, slim });
    } catch (error) {
        parentPort.postMessage({
            id,
            date,
            ok: false,
            missing: false,
            slim: null,
            error: error && error.message ? error.message : String(error)
        });
    }
});
