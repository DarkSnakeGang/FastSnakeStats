/**
 * Tally apple-amount + dual-source High Score board helpers.
 * CE Tally HS category is addressed by id only (name may change).
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        var api = factory();
        root.TYPICAL_HIGHSCORE_MODES = api.TYPICAL_HIGHSCORE_MODES;
        root.TALLY_CE_HIGHSCORE_MODES = api.TALLY_CE_HIGHSCORE_MODES;
        root.CE_GAME_ID = api.CE_GAME_ID;
        root.CE_TALLY_HS_CATEGORY_ID = api.CE_TALLY_HS_CATEGORY_ID;
        root.CE_VAR_SPEED = api.CE_VAR_SPEED;
        root.CE_VAR_SIZE = api.CE_VAR_SIZE;
        root.CE_VAR_MODE = api.CE_VAR_MODE;
        root.COUNT_NAMES = api.COUNT_NAMES;
        root.isTypicalHighscoreMode = api.isTypicalHighscoreMode;
        root.isTallyCeHighscoreMode = api.isTallyCeHighscoreMode;
        root.shouldShowHighScoreColumn = api.shouldShowHighScoreColumn;
        root.isTallyCount = api.isTallyCount;
        root.CE_LEVEL_HIGHSCORE_MODES = api.CE_LEVEL_HIGHSCORE_MODES;
        root.isCeLevelHighscoreMode = api.isCeLevelHighscoreMode;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    var COUNT_NAMES = [
        '1 Apple', '3 Apples', '5 Apples', '10 Apples', 'Dice', 'Bomb', 'Tally'
    ];

    var TYPICAL_HIGHSCORE_MODES = [
        'Wall', 'Portal', 'Key', 'Sokoban', 'Poison', 'Minesweeper',
        'Statue', 'Shield', 'Hotdog', 'Gate', 'Bridge'
    ];

    /** Modes whose Tally High Score lives on snake_game_ce category rkl4elqd */
    var TALLY_CE_HIGHSCORE_MODES = [
        'Classic', 'Cheese', 'Borderless', 'Twin', 'Winged', 'Yin Yang',
        'Dimension', 'Light', 'Arrow', 'Magnet'
    ];

    /** CE level modes (Chess/Burger) — full HS columns like typical HS modes */
    var CE_LEVEL_HIGHSCORE_MODES = ['Chess', 'Burger'];

    var CE_GAME_ID = '9dow0go1';
    var CE_TALLY_HS_CATEGORY_ID = 'rkl4elqd';
    var CE_VAR_SPEED = 'gnx3m4gn';
    var CE_VAR_SIZE = 'ql6mkzw8';
    var CE_VAR_MODE = 'onvxz158';

    function isTallyCount(count) {
        return count === 'Tally';
    }

    function isTypicalHighscoreMode(mode) {
        return TYPICAL_HIGHSCORE_MODES.indexOf(mode) !== -1;
    }

    function isTallyCeHighscoreMode(mode) {
        return TALLY_CE_HIGHSCORE_MODES.indexOf(mode) !== -1;
    }

    function isCeLevelHighscoreMode(mode) {
        return CE_LEVEL_HIGHSCORE_MODES.indexOf(mode) !== -1;
    }

    /** Whether the table should render a High Score column for this count+mode */
    function shouldShowHighScoreColumn(count, mode) {
        if (isTypicalHighscoreMode(mode) || isCeLevelHighscoreMode(mode)) return true;
        return isTallyCount(count) && isTallyCeHighscoreMode(mode);
    }

    return {
        COUNT_NAMES: COUNT_NAMES,
        TYPICAL_HIGHSCORE_MODES: TYPICAL_HIGHSCORE_MODES,
        TALLY_CE_HIGHSCORE_MODES: TALLY_CE_HIGHSCORE_MODES,
        CE_LEVEL_HIGHSCORE_MODES: CE_LEVEL_HIGHSCORE_MODES,
        CE_GAME_ID: CE_GAME_ID,
        CE_TALLY_HS_CATEGORY_ID: CE_TALLY_HS_CATEGORY_ID,
        CE_VAR_SPEED: CE_VAR_SPEED,
        CE_VAR_SIZE: CE_VAR_SIZE,
        CE_VAR_MODE: CE_VAR_MODE,
        isTallyCount: isTallyCount,
        isTypicalHighscoreMode: isTypicalHighscoreMode,
        isTallyCeHighscoreMode: isTallyCeHighscoreMode,
        isCeLevelHighscoreMode: isCeLevelHighscoreMode,
        shouldShowHighScoreColumn: shouldShowHighScoreColumn
    };
});
