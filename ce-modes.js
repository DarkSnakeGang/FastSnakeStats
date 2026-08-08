/**
 * Category Extensions level modes (Chess, Burger) + display gating.
 * Distinct from Tally CE High Score (rkl4elqd) for non-typical main modes.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        var api = factory();
        root.CE_LEVEL_MODES = api.CE_LEVEL_MODES;
        root.CE_LEVEL_BY_NAME = api.CE_LEVEL_BY_NAME;
        root.CE_LEVEL_CATEGORY_IDS = api.CE_LEVEL_CATEGORY_IDS;
        root.CE_LEVEL_VAR_COUNT = api.CE_LEVEL_VAR_COUNT;
        root.CE_LEVEL_VAR_SIZE = api.CE_LEVEL_VAR_SIZE;
        root.CE_LEVEL_VAR_SPEED = api.CE_LEVEL_VAR_SPEED;
        root.CE_HIGHSCORE_CATEGORY_ID = api.CE_HIGHSCORE_CATEGORY_ID;
        root.CE_GAME_ID = root.CE_GAME_ID || api.CE_GAME_ID;
        root.isCeLevelMode = api.isCeLevelMode;
        root.getCeDisplayMode = api.getCeDisplayMode;
        root.setCeDisplayMode = api.setCeDisplayMode;
        root.isModeDisplayed = api.isModeDisplayed;
        root.filterDisplayedModes = api.filterDisplayedModes;
        root.normalizeCeCountLabel = api.normalizeCeCountLabel;
        root.normalizeCeRunLabel = api.normalizeCeRunLabel;
        root.ceDisplayModeLabel = api.ceDisplayModeLabel;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    var CE_GAME_ID = '9dow0go1';

    /** Modded CE levels — full timed + High Score matrix */
    var CE_LEVEL_MODES = ['Chess', 'Burger'];

    var CE_LEVEL_BY_NAME = {
        Chess: 'd1j51lyd',
        Burger: 'wkk1rmqw'
    };

    /** Per-level category ids on snake_game_ce */
    var CE_LEVEL_CATEGORY_IDS = {
        '25 Apples': '02qm9qzd',
        '50 Apples': '824jly32',
        '100 Apples': '9d8eo7qd',
        'All Apples': 'xd14168d',
        'High Score': '8243lxgd'
    };

    var CE_HIGHSCORE_CATEGORY_ID = '8243lxgd';

    /** Variables on CE level boards (distinct size id from Tally CE HS) */
    var CE_LEVEL_VAR_COUNT = 'onvjo65n';
    var CE_LEVEL_VAR_SIZE = 'e8mpx9x8';
    var CE_LEVEL_VAR_SPEED = 'gnx3m4gn';

    function isCeLevelMode(name) {
        return CE_LEVEL_MODES.indexOf(name) !== -1;
    }

    function getCeDisplayMode() {
        if (typeof ceDisplayMode !== 'undefined' && ceDisplayMode) return ceDisplayMode;
        return 'off';
    }

    function setCeDisplayMode(mode) {
        if (mode !== 'off' && mode !== 'mix' && mode !== 'only') mode = 'off';
        if (typeof ceDisplayMode !== 'undefined') {
            ceDisplayMode = mode;
        }
        return mode;
    }

    function ceDisplayModeLabel(mode) {
        var m = mode || getCeDisplayMode();
        if (m === 'mix') return 'CE: Mix';
        if (m === 'only') return 'CE: Only';
        return 'CE: Off';
    }

    function modeVisibleFlag(name) {
        if (typeof gamemodes === 'undefined' || !gamemodes[name]) return true;
        return !!gamemodes[name].visible;
    }

    /**
     * Whether a mode should appear in tables / chips / fetch lists.
     * CE Off → hide Chess/Burger. CE Only → hide main modes.
     */
    function isModeDisplayed(name) {
        var ce = isCeLevelMode(name);
        var dm = getCeDisplayMode();
        if (ce) {
            if (dm === 'off') return false;
            return modeVisibleFlag(name);
        }
        if (dm === 'only') return false;
        return modeVisibleFlag(name);
    }

    function filterDisplayedModes(names) {
        if (!names || !names.length) return [];
        return names.filter(isModeDisplayed);
    }

    function normalizeCeCountLabel(label) {
        if (!label) return null;
        if (label === '10a' || label === '10A') return '10 Apples';
        return label;
    }

    function normalizeCeRunLabel(catName) {
        if (!catName) return catName;
        if (/^high\s*score$/i.test(catName) || catName === 'Highscore') return 'High Score';
        return catName;
    }

    return {
        CE_GAME_ID: CE_GAME_ID,
        CE_LEVEL_MODES: CE_LEVEL_MODES,
        CE_LEVEL_BY_NAME: CE_LEVEL_BY_NAME,
        CE_LEVEL_CATEGORY_IDS: CE_LEVEL_CATEGORY_IDS,
        CE_HIGHSCORE_CATEGORY_ID: CE_HIGHSCORE_CATEGORY_ID,
        CE_LEVEL_VAR_COUNT: CE_LEVEL_VAR_COUNT,
        CE_LEVEL_VAR_SIZE: CE_LEVEL_VAR_SIZE,
        CE_LEVEL_VAR_SPEED: CE_LEVEL_VAR_SPEED,
        isCeLevelMode: isCeLevelMode,
        getCeDisplayMode: getCeDisplayMode,
        setCeDisplayMode: setCeDisplayMode,
        isModeDisplayed: isModeDisplayed,
        filterDisplayedModes: filterDisplayedModes,
        normalizeCeCountLabel: normalizeCeCountLabel,
        normalizeCeRunLabel: normalizeCeRunLabel,
        ceDisplayModeLabel: ceDisplayModeLabel
    };
});
