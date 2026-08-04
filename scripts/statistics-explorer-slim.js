/**
 * Slim extraction from a daily cache file for the statistics explorer.
 * Keeps only fields the analyzer needs so worker→main transfer stays small
 * and JSON.parse can run in parallel worker threads.
 */

const { isIgnoredPlayer, isIgnoredRun, filterIgnoredRuns } = require('../ignored-players');

function extractPlayerId(playerData) {
    if (!playerData) return null;
    if (isIgnoredPlayer(playerData)) return null;
    return playerData.id || null;
}

function extractPlayerName(playerData) {
    if (!playerData) return 'Unknown';
    if (playerData.names && playerData.names.international) {
        return playerData.names.international;
    }
    if (playerData.name) return playerData.name;
    return 'Unknown';
}

function extractRunKey(topRun) {
    if (!topRun) return 'unknown';
    if (topRun.id) return `id:${topRun.id}`;
    if (topRun.weblink) return `link:${topRun.weblink}`;
    const primary = (topRun.times && topRun.times.primary) || '';
    const playerData = topRun.players && topRun.players.data && topRun.players.data[0];
    const playerId = extractPlayerId(playerData) || 'unknown';
    return `fallback:${playerId}|${primary}`;
}

function extractWeblink(topRun) {
    if (!topRun) return null;
    if (topRun.weblink) return topRun.weblink;
    if (topRun.id) return `https://www.speedrun.com/snake_game/run/${topRun.id}`;
    return null;
}

/**
 * @param {string} date YYYY-MM-DD of this cache file
 * @param {object} data parsed daily JSON
 * @returns {{ categories: object[], newWrs: number }}
 */
function slimDailyData(date, data) {
    const records = (data && data.records) || {};
    const categories = [];
    let newWrs = 0;

    for (const categoryKey of Object.keys(records)) {
        const categoryData = records[categoryKey];
        if (!categoryData || !categoryData.success || !categoryData.runs || categoryData.runs.length === 0) {
            continue;
        }

        const runs = filterIgnoredRuns(categoryData.runs);
        if (runs.length === 0) {
            continue;
        }

        const topRun = runs[0];
        const primary = (topRun.times && topRun.times.primary) || '';
        const playerData = topRun.players && topRun.players.data && topRun.players.data[0];
        if (!playerData || isIgnoredPlayer(playerData)) {
            continue;
        }
        const playerId = extractPlayerId(playerData) || 'unknown';
        const playerName = extractPlayerName(playerData);
        const runKey = extractRunKey(topRun);
        const weblink = extractWeblink(topRun);

        /** @type {{ id: string, name: string, weblink: string|null }[]} */
        const tied = [];
        const seenTied = new Set();
        for (let i = 0; i < runs.length; i++) {
            const run = runs[i];
            if (isIgnoredRun(run)) continue;
            const t = (run.times && run.times.primary) || '';
            if (t !== primary) break;
            if (!run.players || !run.players.data) continue;
            for (const p of run.players.data) {
                if (isIgnoredPlayer(p)) continue;
                const pid = extractPlayerId(p);
                if (!pid || seenTied.has(pid)) continue;
                seenTied.add(pid);
                tied.push({
                    id: pid,
                    name: extractPlayerName(p),
                    weblink: extractWeblink(run)
                });
            }
        }
        if (tied.length === 0) {
            continue;
        }

        const tiedIds = tied.map((t) => t.id);

        /** @type {Record<string, { n: number, name: string }>} */
        const playerIncrements = Object.create(null);
        for (let i = 0; i < runs.length; i++) {
            const run = runs[i];
            if (run.date === date) newWrs++;
            if (!run.players || !run.players.data) continue;
            for (const p of run.players.data) {
                const pid = extractPlayerId(p);
                if (!pid) continue;
                const pname = extractPlayerName(p);
                const prev = playerIncrements[pid];
                if (prev) {
                    prev.n += 1;
                    prev.name = pname;
                } else {
                    playerIncrements[pid] = { n: 1, name: pname };
                }
            }
        }

        categories.push({
            key: categoryKey,
            primary,
            playerId,
            playerName,
            runKey,
            weblink,
            tied,
            tiedIds,
            tiedHolderCount: tied.length,
            playerIncrements
        });
    }

    return { categories, newWrs };
}

module.exports = {
    slimDailyData,
    extractPlayerId,
    extractPlayerName,
    extractRunKey,
    extractWeblink
};
