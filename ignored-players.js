/**
 * Players / boards that must never appear in cache, UI, or stats.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        var api = factory();
        root.isIgnoredPlayerName = api.isIgnoredPlayerName;
        root.isIgnoredPlayer = api.isIgnoredPlayer;
        root.isIgnoredRun = api.isIgnoredRun;
        root.filterIgnoredRuns = api.filterIgnoredRuns;
        root.shouldSkipBoardFetch = api.shouldSkipBoardFetch;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    var COUNT_NAMES = ['1 Apple', '3 Apples', '5 Apples', '10 Apples', 'Dice', 'Bomb'];
    var MODE_NAMES = [
        'Classic', 'Wall', 'Portal', 'Cheese', 'Borderless', 'Twin', 'Winged',
        'Yin Yang', 'Key', 'Sokoban', 'Poison', 'Dimension', 'Minesweeper',
        'Statue', 'Light', 'Shield', 'Arrow', 'Hotdog', 'Magnet', 'Gate',
        'Bridge', 'Peaceful'
    ];

    function getPlayerDisplayName(player) {
        if (!player) return '';
        if (player.names && player.names.international) {
            return String(player.names.international);
        }
        if (player.name) return String(player.name);
        return '';
    }

    function isIgnoredPlayerName(name) {
        if (name == null) return false;
        return /^n\/a$/i.test(String(name).trim());
    }

    function isIgnoredPlayer(player) {
        if (!player) return false;
        const id = player.id != null ? String(player.id) : '';
        if (/^guest:n\/a$/i.test(id)) return true;
        return isIgnoredPlayerName(getPlayerDisplayName(player));
    }

    /** Cache / SRC run with players.data[], or live fetcher shape with .player */
    function isIgnoredRun(run) {
        if (!run) return false;
        if (run.player && isIgnoredPlayer(run.player)) return true;
        if (run.players && Array.isArray(run.players.data)) {
            if (run.players.data.length === 0) return false;
            return isIgnoredPlayer(run.players.data[0]);
        }
        return false;
    }

    function filterIgnoredRuns(runs) {
        if (!Array.isArray(runs)) return [];
        return runs.filter(function (run) {
            return !isIgnoredRun(run);
        });
    }

    /**
     * Boards that do not accept submissions — never hit SRC for these.
     * Currently: Statue High Score with 10 Apples or Bomb (all speeds/sizes).
     * @param {string|number} count apple-amount label or index
     * @param {string|number} mode mode name or index
     * @param {string} level "H", "High Score", "50", "50 Apples", etc.
     */
    function shouldSkipBoardFetch(count, mode, level) {
        var countLabel = typeof count === 'number' ? COUNT_NAMES[count] : String(count || '');
        var modeLabel = String(mode == null ? '' : mode);
        if (/^\d+$/.test(modeLabel)) {
            modeLabel = MODE_NAMES[+modeLabel] || modeLabel;
        }
        var levelLabel = String(level == null ? '' : level);
        var isHighScore = levelLabel === 'H' || /^high\s*score$/i.test(levelLabel);
        if (!isHighScore || modeLabel !== 'Statue') return false;
        return countLabel === '10 Apples' || countLabel === 'Bomb';
    }

    return {
        isIgnoredPlayerName: isIgnoredPlayerName,
        isIgnoredPlayer: isIgnoredPlayer,
        isIgnoredRun: isIgnoredRun,
        filterIgnoredRuns: filterIgnoredRuns,
        shouldSkipBoardFetch: shouldSkipBoardFetch,
        getPlayerDisplayName: getPlayerDisplayName
    };
});
