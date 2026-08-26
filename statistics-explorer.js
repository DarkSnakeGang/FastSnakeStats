// Statistics Explorer — collapsible right panel + analytics views
// Data: time-travel-cache/metadata/statistics-explorer.json (precomputed)

var statsExplorerData = null;
var statsExplorerLoading = false;
var statsExplorerLoadPromise = null;
var masteryChallengeData = null;
var masteryChallengeLoadPromise = null;
var chronicleData = null;
var chronicleLoadPromise = null;
var chronicleEraDate = null;
var chronicleEmpireId = null;
var chronicleWarApple = '1 Apple';
var chronicleWarSpeed = 'Normal';
var chronicleWarSize = 'Standard';
var chronicleWarGamemode = 'Classic';
var chronicleWarRunMode = '25 Apples';
var chronicleWarFiltersReady = false;
var statsExplorerActiveTab = 'progression';
var statsExplorerImproveWindow = '30d';
var statsExplorerHeatMetric = 'flips';
var statsExplorerHeatYear = null; // set from data
var statsExplorerLongevityMode = 'standing'; // 'all' | 'standing'
var statsExplorerLongevityTiedMode = 'untied'; // 'all' | 'untied' | 'tied'
var statsExplorerPopularityTiedMode = 'untied'; // 'all' | 'untied' | 'tied'
var statsExplorerUnheldTier = 'All'; // 'All' | Free…Inhuman
var statsExplorerLegendsFilter = 'all'; // 'all' | 'legends' | 'unicorns'
var statsExplorerPlayerId = null;
var statsExplorerPlayerName = '';
var statsExplorerPlayerHoldMode = 'present'; // 'all' | 'present' | 'old' | 'latest' | 'mastery'
var statsExplorerPlayerTiedMode = 'all'; // 'all' | 'untied' | 'tied' — present only
var statsExplorerPlayerDefaultApplied = false;
var statsExplorerPlayerShowMeme = false;
var statsExplorerPlayersCache = null;
// Independent progression filters (not Category Settings)
var statsProgApple = '1 Apple';
var statsProgSpeed = 'Normal';
var statsProgSize = 'Standard';
var statsProgGamemode = 'Classic';
var statsProgRunMode = '25 Apples';
// Shared list filters for contested / stale / popularity / unheld ("All" = no filter)
var statsListApple = 'All';
var statsListSpeed = 'All';
var statsListSize = 'All';
var statsListGamemode = 'All';
var statsListRunMode = 'All';
var STATS_LIST_DISPLAY_LIMIT = 50;
var statsWasMasteryFilterContext = false;

var STATS_MASTERY_MODE_GROUPS = ['High score modes only', 'Excluding Peaceful'];
var STATS_LIST_MODE_GROUPS = ['High score modes only']; // shared Mode filter on list-filter tabs
var STATS_HIGHSCORE_MODES = ['Wall', 'Portal', 'Key', 'Sokoban', 'Poison', 'Minesweeper', 'Statue', 'Shield', 'Hotdog', 'Gate', 'Bridge', 'Chess', 'Burger'];

function getDisplayedGamemodeNames() {
    var names = typeof gamemodes !== 'undefined' ? Object.keys(gamemodes) : [];
    if (typeof filterDisplayedModes === 'function') return filterDisplayedModes(names);
    return names;
}

function isStatsHighscoreMode(name) {
    return STATS_HIGHSCORE_MODES.indexOf(name) !== -1;
}

var STATS_TABS = [
    { id: 'progression', label: 'Progression' },
    { id: 'longevity', label: 'Longevity' },
    { id: 'career', label: 'Career' },
    { id: 'chronicle', label: 'Chronicle' },
    { id: 'player', label: 'Player' },
    { id: 'mastery', label: 'Mastery' },
    { id: 'improving', label: 'Improving' },
    { id: 'contested', label: 'Contested' },
    { id: 'stale', label: 'Stale' },
    { id: 'popularity', label: 'Popularity' },
    { id: 'legends', label: 'Legends' },
    { id: 'unheld', label: 'Unheld' },
    { id: 'heatmap', label: 'Heatmap' }
];

function parseCategoryKey(key) {
    if (!key) return null;
    var parts = key.split('|');
    if (parts.length < 5) return null;
    return {
        apple: parts[0],
        speed: parts[1],
        size: parts[2],
        gamemode: parts[3],
        runMode: parts.slice(4).join('|'),
        raw: key
    };
}

function buildProgressionKey() {
    return statsProgApple + '|' + statsProgSpeed + '|' + statsProgSize + '|' + statsProgGamemode + '|' + statsProgRunMode;
}

function getProgressionGamemodeOptions() {
    var names = getDisplayedGamemodeNames();
    if (statsProgRunMode === 'High Score') {
        return names.filter(function (n) { return isStatsHighscoreMode(n); });
    }
    return names;
}

function normalizeProgressionFilters() {
    if (statsProgRunMode === '100 Apples' && statsProgSize === 'Small') {
        statsProgSize = 'Standard';
    }
    var modes = getProgressionGamemodeOptions();
    if (modes.indexOf(statsProgGamemode) === -1) {
        statsProgGamemode = modes[0] || 'Classic';
    }
}

function createStatsSelect(labelText, value, options, onChange, compact) {
    var wrap = document.createElement('label');
    wrap.className = 'stats-explorer-select-wrap' + (compact ? ' stats-explorer-select-wrap--compact' : '');
    var lab = document.createElement('span');
    lab.className = 'stats-explorer-select-label';
    lab.textContent = labelText;
    wrap.appendChild(lab);
    var sel = document.createElement('select');
    sel.className = 'stats-explorer-select';
    options.forEach(function (opt) {
        var o = document.createElement('option');
        if (opt && typeof opt === 'object') {
            o.value = opt.value;
            o.textContent = opt.label;
            if (opt.value === value) o.selected = true;
        } else {
            o.value = opt;
            o.textContent = opt;
            if (opt === value) o.selected = true;
        }
        sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
        onChange(sel.value);
    });
    wrap.appendChild(sel);
    return wrap;
}

function isMasteryFilterContext() {
    return statsExplorerActiveTab === 'mastery' ||
        (statsExplorerActiveTab === 'player' && statsExplorerPlayerHoldMode === 'mastery');
}

function ensureMasteryModeDefault() {
    var now = isMasteryFilterContext();
    if (now && !statsWasMasteryFilterContext) {
        if (statsListGamemode === 'All') {
            statsListGamemode = 'High score modes only';
        }
        if (statsListSize === 'All') {
            statsListSize = 'Small';
        }
        // Mastery is All Apples only — ignore leftover Run filters from other tabs
        statsListRunMode = 'All Apples';
    }
    statsWasMasteryFilterContext = now;
}

function getListGamemodeOptions() {
    var names = getDisplayedGamemodeNames();
    if (statsListRunMode === 'High Score') {
        return names.filter(function (n) { return isStatsHighscoreMode(n); });
    }
    return names;
}

function normalizeListFilters() {
    if (statsListRunMode === '100 Apples' && statsListSize === 'Small') {
        statsListSize = 'Standard';
    }
    if (statsListGamemode !== 'All') {
        var modes = getListGamemodeOptions();
        var ok = modes.indexOf(statsListGamemode) !== -1 ||
            STATS_LIST_MODE_GROUPS.indexOf(statsListGamemode) !== -1 ||
            (isMasteryFilterContext() && STATS_MASTERY_MODE_GROUPS.indexOf(statsListGamemode) !== -1);
        if (!ok) {
            statsListGamemode = 'All';
        }
    }
}

function appendListFilters(body) {
    ensureMasteryModeDefault();
    normalizeListFilters();

    var mastery = isMasteryFilterContext();
    var appleOpts = ['All'].concat(typeof appleAmounts !== 'undefined' ? Object.keys(appleAmounts) : ['1 Apple', '3 Apples', '5 Apples', '10 Apples', 'Dice', 'Bomb', 'Tally']);
    var speedOpts = ['All'].concat(typeof speeds !== 'undefined' ? Object.keys(speeds) : ['Normal', 'Fast', 'Slow']);
    var sizeOpts = ['All'].concat(typeof sizes !== 'undefined' ? Object.keys(sizes) : ['Standard', 'Small', 'Large']);
    if (statsListRunMode === '100 Apples') {
        sizeOpts = sizeOpts.filter(function (s) { return s !== 'Small'; });
    }
    var runOpts = ['All', 'Timed'].concat(typeof runModes !== 'undefined' ? Object.keys(runModes) : ['25 Apples', '50 Apples', '100 Apples', 'All Apples', 'High Score']);
    var modeOpts = ['All'].concat(STATS_LIST_MODE_GROUPS);
    if (mastery) {
        // Excluding Peaceful is mastery-only; High score modes only already in STATS_LIST_MODE_GROUPS
        STATS_MASTERY_MODE_GROUPS.forEach(function (g) {
            if (modeOpts.indexOf(g) === -1) modeOpts.push(g);
        });
    }
    modeOpts = modeOpts.concat(getListGamemodeOptions());

    var filters = document.createElement('div');
    filters.className = 'stats-explorer-filters';
    filters.appendChild(createStatsSelect('Count', statsListApple, appleOpts, function (v) {
        statsListApple = v;
        renderStatisticsExplorerContent(body);
    }));
    filters.appendChild(createStatsSelect('Speed', statsListSpeed, speedOpts, function (v) {
        statsListSpeed = v;
        renderStatisticsExplorerContent(body);
    }));
    filters.appendChild(createStatsSelect('Size', statsListSize, sizeOpts, function (v) {
        statsListSize = v;
        renderStatisticsExplorerContent(body);
    }));
    if (!mastery) {
        filters.appendChild(createStatsSelect('Run', statsListRunMode, runOpts, function (v) {
            statsListRunMode = v;
            normalizeListFilters();
            renderStatisticsExplorerContent(body);
        }));
    }
    filters.appendChild(createStatsSelect('Mode', statsListGamemode, modeOpts, function (v) {
        statsListGamemode = v;
        renderStatisticsExplorerContent(body);
    }));
    body.appendChild(filters);
}

function gamemodeMatchesListFilter(gamemode) {
    if (typeof isModeDisplayed === 'function' && !isModeDisplayed(gamemode)) return false;
    if (statsListGamemode === 'All') return true;
    if (statsListGamemode === 'High score modes only') {
        return isStatsHighscoreMode(gamemode);
    }
    if (statsListGamemode === 'Excluding Peaceful') {
        return gamemode !== 'Peaceful';
    }
    return gamemode === statsListGamemode;
}

function rowMatchesListFilters(row) {
    var parsed = parseCategoryKey(row.category);
    if (!parsed) return false;
    if (statsListApple !== 'All' && parsed.apple !== statsListApple) return false;
    if (statsListSpeed !== 'All' && parsed.speed !== statsListSpeed) return false;
    if (statsListSize !== 'All' && parsed.size !== statsListSize) return false;
    if (statsListRunMode === 'Timed') {
        if (parsed.runMode === 'High Score') return false;
    } else if (statsListRunMode !== 'All' && parsed.runMode !== statsListRunMode) {
        return false;
    }
    if (!gamemodeMatchesListFilter(parsed.gamemode)) return false;
    return true;
}

function filterRowsByListFilters(rows) {
    if (
        statsListApple === 'All' &&
        statsListSpeed === 'All' &&
        statsListSize === 'All' &&
        statsListRunMode === 'All' &&
        statsListGamemode === 'All'
    ) {
        return rows;
    }
    return rows.filter(rowMatchesListFilters);
}

function parsePrimaryToSeconds(primary) {
    if (!primary || typeof primary !== 'string') return 0;
    var m = primary.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
    if (!m) return 0;
    var h = parseFloat(m[1] || 0);
    var min = parseFloat(m[2] || 0);
    var s = parseFloat(m[3] || 0);
    return h * 3600 + min * 60 + s;
}

function formatPrimaryDisplay(primary, isHighScore) {
    if (!primary) return '-';
    if (isHighScore) {
        var frac = primary.match(/PT0\.(\d+)S/);
        if (frac) return (frac[1].replace(/^0+/, '') || '0') + ' apples';
        return primary.replace(/^PT/, '').replace(/S$/, '');
    }
    if (typeof createTimeElement === 'function') {
        try {
            var el = createTimeElement({ primary: primary }, false);
            return el.textContent || primary;
        } catch (e) { /* fall through */ }
    }
    var total = parsePrimaryToSeconds(primary);
    var m = Math.floor(total / 60);
    var s = total - m * 60;
    var ms = Math.round((s % 1) * 1000);
    s = Math.floor(s);
    if (m > 0) return m + 'm ' + s + 's ' + ms + 'ms';
    return s + 's ' + ms + 'ms';
}

function formatHoldTimeCell(row, parsed) {
    var isHS = parsed && parsed.runMode === 'High Score';
    var text = formatPrimaryDisplay(row.time, isHS);
    if (row.weblink) {
        return '<a class="stats-run-link" href="' + escapeAttr(row.weblink) +
            '" target="_blank" rel="noopener noreferrer">' + escapeHtml(text) + '</a>';
    }
    return escapeHtml(text);
}

async function loadStatisticsExplorerData() {
    if (statsExplorerData) return statsExplorerData;
    if (statsExplorerLoadPromise) return statsExplorerLoadPromise;

    statsExplorerLoading = true;
    statsExplorerLoadPromise = (async function () {
        try {
            var localRes = await fetch('time-travel-cache/metadata/statistics-explorer.json');
            if (localRes.ok) {
                statsExplorerData = await localRes.json();
                statsExplorerPlayersCache = null;
                return statsExplorerData;
            }
        } catch (e) { /* try remote */ }
        try {
            var base = (window.githubCacheFetcher && window.githubCacheFetcher.baseURL) ||
                'https://raw.githubusercontent.com/DarkSnakeGang/FastSnakeStats/refs/heads/main';
            var remoteRes = await fetch(base + '/time-travel-cache/metadata/statistics-explorer.json');
            if (remoteRes.ok) {
                statsExplorerData = await remoteRes.json();
                statsExplorerPlayersCache = null;
                return statsExplorerData;
            }
        } catch (e2) {
            console.error('Failed to load statistics explorer data', e2);
        }
        return null;
    })();

    try {
        return await statsExplorerLoadPromise;
    } finally {
        statsExplorerLoading = false;
        statsExplorerLoadPromise = null;
    }
}

async function loadMasteryChallengeData() {
    if (masteryChallengeData) return masteryChallengeData;
    if (masteryChallengeLoadPromise) return masteryChallengeLoadPromise;

    masteryChallengeLoadPromise = (async function () {
        try {
            var localRes = await fetch('time-travel-cache/metadata/mastery-challenge.json');
            if (localRes.ok) {
                masteryChallengeData = await localRes.json();
                return masteryChallengeData;
            }
        } catch (e) { /* try remote */ }
        try {
            var base = (window.githubCacheFetcher && window.githubCacheFetcher.baseURL) ||
                'https://raw.githubusercontent.com/DarkSnakeGang/FastSnakeStats/refs/heads/main';
            var remoteRes = await fetch(base + '/time-travel-cache/metadata/mastery-challenge.json');
            if (remoteRes.ok) {
                masteryChallengeData = await remoteRes.json();
                return masteryChallengeData;
            }
        } catch (e2) {
            console.error('Failed to load mastery challenge data', e2);
        }
        return null;
    })();

    try {
        return await masteryChallengeLoadPromise;
    } finally {
        masteryChallengeLoadPromise = null;
    }
}

async function loadChronicleData() {
    if (chronicleData) return chronicleData;
    if (chronicleLoadPromise) return chronicleLoadPromise;

    chronicleLoadPromise = (async function () {
        try {
            var localRes = await fetch('time-travel-cache/metadata/chronicle.json');
            if (localRes.ok) {
                chronicleData = await localRes.json();
                return chronicleData;
            }
        } catch (e) { /* try remote */ }
        try {
            var base = (window.githubCacheFetcher && window.githubCacheFetcher.baseURL) ||
                'https://raw.githubusercontent.com/DarkSnakeGang/FastSnakeStats/refs/heads/main';
            var remoteRes = await fetch(base + '/time-travel-cache/metadata/chronicle.json');
            if (remoteRes.ok) {
                chronicleData = await remoteRes.json();
                return chronicleData;
            }
        } catch (e2) {
            console.error('Failed to load chronicle data', e2);
        }
        return null;
    })();

    try {
        return await chronicleLoadPromise;
    } finally {
        chronicleLoadPromise = null;
    }
}

function ensureChronicleDefaults() {
    if (!chronicleData || !chronicleData.meta) return;
    var d = chronicleData.meta.defaults || {};
    if (!chronicleEraDate) chronicleEraDate = d.eraDate || null;
    if (!chronicleEmpireId) chronicleEmpireId = d.empireId || null;
    if (!chronicleWarFiltersReady && d.warCategory) {
        var parts = String(d.warCategory).split('|');
        if (parts.length >= 5) {
            chronicleWarApple = parts[0];
            chronicleWarSpeed = parts[1];
            chronicleWarSize = parts[2];
            chronicleWarGamemode = parts[3];
            chronicleWarRunMode = parts.slice(4).join('|');
            chronicleWarFiltersReady = true;
        }
    }
}

function buildChronicleWarKey() {
    return chronicleWarApple + '|' + chronicleWarSpeed + '|' + chronicleWarSize + '|' +
        chronicleWarGamemode + '|' + chronicleWarRunMode;
}

function getChronicleWarModeOptions() {
    var names = getDisplayedGamemodeNames();
    if (chronicleWarRunMode === 'High Score') {
        return names.filter(function (n) { return isStatsHighscoreMode(n); });
    }
    return names;
}

function normalizeChronicleWarFilters() {
    if (chronicleWarRunMode === '100 Apples' && chronicleWarSize === 'Small') {
        chronicleWarSize = 'Standard';
    }
    var modes = getChronicleWarModeOptions();
    if (modes.indexOf(chronicleWarGamemode) === -1) {
        chronicleWarGamemode = modes[0] || 'Classic';
    }
}

function chronicleTravelTo(date) {
    if (!date) return;
    var isMobile = document.body.classList.contains('mobile-mode') ||
        (window.innerWidth <= 1023 && document.getElementById('mobileDatePicker'));
    if (isMobile && typeof setMobileTimeTravelDate === 'function') {
        setMobileTimeTravelDate(date);
        return;
    }
    if (typeof setTimeTravelDate === 'function') {
        setTimeTravelDate(date);
        return;
    }
    if (typeof window.setTimeTravelDate === 'function') {
        window.setTimeTravelDate(date);
    }
}

function createChronicleTravelBtn(date, label) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stats-chronicle-travel';
    btn.textContent = label || 'Travel here';
    btn.title = date ? ('Time travel to ' + date) : '';
    btn.disabled = !date;
    btn.addEventListener('click', function () {
        chronicleTravelTo(date);
    });
    return btn;
}

function createChronicleNameSpan(name, ns) {
    var span = document.createElement('span');
    span.className = 'stats-chronicle-player-name';
    span.textContent = name || 'Unknown';
    if (typeof applyUsernameColors === 'function' && ns) {
        applyUsernameColors(span, ns);
    }
    return span;
}

function applyStatsExplorerCollapseState() {
    document.body.classList.toggle('stats-explorer-collapsed', !!isStatsExplorerCollapsed);
    var btn = document.getElementById('statsExplorerCollapseBtn');
    if (btn) {
        btn.textContent = '▶';
        btn.setAttribute('title', 'Hide Statistics');
        btn.setAttribute('aria-expanded', String(!isStatsExplorerCollapsed));
        btn.setAttribute('aria-label', 'Hide Statistics');
        btn.hidden = !!isStatsExplorerCollapsed;
    }
    var title = document.querySelector('.stats-explorer-title');
    if (title) {
        title.textContent = isStatsExplorerCollapsed ? '📈' : 'Statistics';
        title.setAttribute('aria-label', isStatsExplorerCollapsed ? 'Show Statistics' : 'Statistics');
        title.setAttribute('title', isStatsExplorerCollapsed ? 'Show Statistics' : 'Statistics');
    }
    var wrap = document.querySelector('.stats-explorer-wrapper');
    if (wrap) wrap.classList.toggle('collapsed', !!isStatsExplorerCollapsed);
    syncRightPanelsSideBySide();
}

function syncRightPanelsSideBySide() {
    var bothOpen = !isSummaryCollapsed && !isStatsExplorerCollapsed;
    if (!bothOpen) {
        document.body.style.removeProperty('--ranglist-panel-width');
        document.body.style.removeProperty('--stats-panel-width');
        if (window.__ranglistPanelResizeObserver) {
            window.__ranglistPanelResizeObserver.disconnect();
            window.__ranglistPanelResizeObserver = null;
        }
        return;
    }
    var applyWidth = function () {
        if (isSummaryCollapsed || isStatsExplorerCollapsed) return;
        var rankings = document.querySelector('.ranglist-wrapper');
        if (!rankings) return;
        var rankingsW = Math.ceil(rankings.offsetWidth);
        if (rankingsW < 1) {
            var table = rankings.querySelector('table');
            if (table) rankingsW = Math.ceil(table.offsetWidth) + 24;
        }
        if (rankingsW < 1) return;
        document.body.style.setProperty('--ranglist-panel-width', rankingsW + 'px');
    };
    requestAnimationFrame(function () {
        requestAnimationFrame(applyWidth);
    });
    var rankings = document.querySelector('.ranglist-wrapper');
    if (rankings && typeof ResizeObserver !== 'undefined') {
        if (!window.__ranglistPanelResizeObserver) {
            window.__ranglistPanelResizeObserver = new ResizeObserver(function () {
                applyWidth();
            });
        } else {
            window.__ranglistPanelResizeObserver.disconnect();
        }
        window.__ranglistPanelResizeObserver.observe(rankings);
    }
}

function ensureStatisticsExplorer() {
    // Mobile uses #mobileStatsExplorerBody — skip desktop panel + eager JSON fetch
    if (typeof window !== 'undefined' && window.innerWidth <= 1023) {
        return;
    }
    if (document.querySelector('.stats-explorer-wrapper')) {
        applyStatsExplorerCollapseState();
        return;
    }

    var wrap = document.createElement('div');
    wrap.className = 'stats-explorer-wrapper';

    var header = document.createElement('div');
    header.className = 'stats-explorer-header';

    var title = document.createElement('h3');
    title.className = 'stats-explorer-title';
    title.textContent = 'Statistics';
    header.appendChild(title);

    var collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.id = 'statsExplorerCollapseBtn';
    collapseBtn.className = 'panel-collapse-btn stats-explorer-collapse-btn';
    collapseBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleStatsExplorerCollapsed();
    });
    header.appendChild(collapseBtn);
    wrap.appendChild(header);

    var tabs = document.createElement('div');
    tabs.className = 'stats-explorer-tabs';
    STATS_TABS.forEach(function (tab) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'stats-explorer-tab' + (tab.id === statsExplorerActiveTab ? ' active' : '');
        b.dataset.tab = tab.id;
        b.textContent = tab.label;
        b.addEventListener('click', function (e) {
            e.stopPropagation();
            statsExplorerActiveTab = tab.id;
            Array.prototype.forEach.call(tabs.querySelectorAll('.stats-explorer-tab'), function (el) {
                el.classList.toggle('active', el.dataset.tab === tab.id);
            });
            if (typeof b.scrollIntoView === 'function') {
                b.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
            }
            renderStatisticsExplorerContent(document.getElementById('statsExplorerBody'));
        });
        tabs.appendChild(b);
    });
    wrap.appendChild(tabs);

    var body = document.createElement('div');
    body.className = 'stats-explorer-body';
    body.id = 'statsExplorerBody';
    body.innerHTML = '<div class="stats-explorer-loading">Loading statistics…</div>';
    wrap.appendChild(body);

    wrap.addEventListener('click', function (e) {
        if (!isStatsExplorerCollapsed) return;
        if (e.target.closest('#statsExplorerCollapseBtn')) return;
        toggleStatsExplorerCollapsed();
    });

    var container = document.querySelector('.container');
    if (container && container.parentNode) {
        container.parentNode.insertBefore(wrap, container.nextSibling);
    } else {
        document.body.appendChild(wrap);
    }

    applyStatsExplorerCollapseState();
    loadStatisticsExplorerData().then(function () {
        return Promise.all([loadMasteryChallengeData(), loadChronicleData()]);
    }).then(function () {
        renderStatisticsExplorerContent();
    });
}

function renderStatisticsExplorerContent(targetBody) {
    var body = targetBody || document.getElementById('statsExplorerBody');
    if (!body) return;

    if (!statsExplorerData) {
        body.innerHTML = '<div class="stats-explorer-empty">Statistics data not available yet. Run <code>node scripts/statistics-explorer-analyzer.js</code> or wait for the daily cache job.</div>';
        return;
    }

    body.innerHTML = '';
    switch (statsExplorerActiveTab) {
        case 'progression':
            renderProgressionView(body);
            break;
        case 'longevity':
            renderLongevityView(body);
            break;
        case 'career':
            renderCareerView(body);
            break;
        case 'chronicle':
            renderChronicleView(body);
            break;
        case 'player':
            renderPlayerView(body);
            break;
        case 'mastery':
            renderMasteryView(body);
            break;
        case 'improving':
            renderImprovingView(body);
            break;
        case 'contested':
            renderFilteredListTab(body, statsExplorerData.contested || [], 'contested', 'most flips first');
            break;
        case 'stale':
            renderFilteredListTab(body, statsExplorerData.stale || [], 'stale', 'least contested first');
            break;
        case 'popularity':
            renderPopularityView(body);
            break;
        case 'unicorns':
            // Legacy tab id → merged Legends tab
            statsExplorerActiveTab = 'legends';
            renderLegendsView(body);
            break;
        case 'legends':
            renderLegendsView(body);
            break;
        case 'unheld':
            renderUnheldView(body);
            break;
        case 'heatmap':
            renderHeatmapView(body);
            break;
        default:
            body.textContent = 'Unknown view';
    }
}

function renderEmpireSparkline(series, peakDate) {
    var wrap = document.createElement('div');
    wrap.className = 'stats-explorer-chart stats-chronicle-sparkline';
    if (!series || !series.length) {
        wrap.textContent = 'No arc data.';
        return wrap;
    }
    var w = 720, h = 160, padL = 44, padR = 16, padT = 12, padB = 28;
    var values = series.map(function (p) { return p.c; });
    var minV = 0;
    var maxV = Math.max.apply(null, values);
    if (maxV <= 0) maxV = 1;
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('class', 'stats-line-svg');
    function xAt(i) {
        if (series.length === 1) return padL + (w - padL - padR) / 2;
        return padL + (i / (series.length - 1)) * (w - padL - padR);
    }
    function yAt(v) {
        return padT + (1 - (v - minV) / (maxV - minV)) * (h - padT - padB);
    }
    var axis2 = document.createElementNS(svgNS, 'line');
    axis2.setAttribute('x1', padL);
    axis2.setAttribute('x2', w - padR);
    axis2.setAttribute('y1', h - padB);
    axis2.setAttribute('y2', h - padB);
    axis2.setAttribute('class', 'stats-axis');
    svg.appendChild(axis2);
    var d = '';
    series.forEach(function (p, i) {
        var x = xAt(i), y = yAt(p.c);
        d += (i === 0 ? 'M' : 'L') + x + ' ' + y + ' ';
    });
    var path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', d.trim());
    path.setAttribute('class', 'stats-line');
    svg.appendChild(path);
    series.forEach(function (p, i) {
        if (peakDate && p.d === peakDate) {
            var crown = document.createElementNS(svgNS, 'circle');
            crown.setAttribute('cx', xAt(i));
            crown.setAttribute('cy', yAt(p.c));
            crown.setAttribute('r', 5);
            crown.setAttribute('class', 'stats-chronicle-peak-dot');
            svg.appendChild(crown);
        }
    });
    var startLab = document.createElementNS(svgNS, 'text');
    startLab.setAttribute('x', padL);
    startLab.setAttribute('y', h - 8);
    startLab.setAttribute('class', 'stats-axis-label');
    startLab.textContent = series[0].d;
    svg.appendChild(startLab);
    var endLab = document.createElementNS(svgNS, 'text');
    endLab.setAttribute('x', w - padR);
    endLab.setAttribute('y', h - 8);
    endLab.setAttribute('text-anchor', 'end');
    endLab.setAttribute('class', 'stats-axis-label');
    endLab.textContent = series[series.length - 1].d;
    svg.appendChild(endLab);
    wrap.appendChild(svg);
    return wrap;
}

function fillChronicleEraDetails(container, era, travelSlot) {
    container.innerHTML = '';
    if (travelSlot) {
        travelSlot.innerHTML = '';
        if (era) travelSlot.appendChild(createChronicleTravelBtn(era.date, 'Travel here'));
    }
    if (!era) {
        var empty = document.createElement('div');
        empty.className = 'stats-explorer-empty';
        empty.textContent = 'No loud days in Chronicle yet.';
        container.appendChild(empty);
        return;
    }

    var headline = document.createElement('div');
    headline.className = 'stats-chronicle-headline';
    var bits = [];
    bits.push(era.flips + ' flip' + (era.flips === 1 ? '' : 's'));
    bits.push(era.newWrs + ' new WR' + (era.newWrs === 1 ? '' : 's'));
    if (era.debuts && era.debuts.length) {
        bits.push(era.debuts.length + ' setting debut' + (era.debuts.length === 1 ? '' : 's'));
    }
    headline.innerHTML = '<strong>' + escapeHtml(era.date) + '</strong> — ' + bits.join(', ');
    container.appendChild(headline);

    if (era.debuts && era.debuts.length) {
        var debutHead = document.createElement('div');
        debutHead.className = 'stats-chronicle-subhead';
        debutHead.textContent = 'Setting debuts';
        container.appendChild(debutHead);
        var debutList = document.createElement('ul');
        debutList.className = 'stats-chronicle-list stats-chronicle-debuts';
        era.debuts.forEach(function (d) {
            var li = document.createElement('li');
            li.className = 'stats-chronicle-list-item is-debut';
            li.innerHTML = '<span class="stats-chronicle-debut-kind">' + escapeHtml(d.kindLabel || d.kind) + '</span> ' +
                '<strong>' + escapeHtml(d.value) + '</strong>' +
                (d.player ? ' — first verified run: ' + escapeHtml(d.player) : '');
            debutList.appendChild(li);
        });
        container.appendChild(debutList);
    }

    if (era.topFlips && era.topFlips.length) {
        var flipHead = document.createElement('div');
        flipHead.className = 'stats-chronicle-subhead';
        flipHead.textContent = 'WR flips that day';
        container.appendChild(flipHead);
        var flipHint = document.createElement('div');
        flipHint.className = 'stats-chronicle-hint';
        flipHint.textContent = 'Boards where the world record changed that day, hardest first — previous holder → new holder.';
        container.appendChild(flipHint);
        var flipList = document.createElement('ul');
        flipList.className = 'stats-chronicle-list';
        var flipsSorted = (era.topFlips || []).slice().sort(function (a, b) {
            var sa = a.score != null ? a.score : 0;
            var sb = b.score != null ? b.score : 0;
            if (sb !== sa) return sb - sa;
            return Number(b.tied) - Number(a.tied);
        });
        flipsSorted.forEach(function (f) {
            var li = document.createElement('li');
            li.className = 'stats-chronicle-list-item' + (f.tied ? ' is-tied' : '');
            var cat = document.createElement('div');
            cat.className = 'stats-chronicle-cat';
            var parsedCat = parseCategoryKey(f.category);
            if (typeof formatCategoryInlineHtml === 'function' && parsedCat) {
                cat.innerHTML = formatCategoryInlineHtml(parsedCat);
            } else {
                cat.textContent = (f.category || '').replace(/\|/g, ' · ') || 'Unknown board';
            }
            if (f.tier) {
                var tierBadge = document.createElement('span');
                tierBadge.className = 'stats-chronicle-tier-badge';
                tierBadge.textContent = f.tier;
                cat.appendChild(document.createTextNode(' '));
                cat.appendChild(tierBadge);
            }
            li.appendChild(cat);
            var handoff = document.createElement('div');
            handoff.className = 'stats-chronicle-handoff';
            var fromLabel = f.from || 'unset';
            var toLabel = f.to || 'unset';
            handoff.textContent = fromLabel === toLabel
                ? ('Still ' + toLabel + (f.tied ? ' (new tie)' : ' (same name, new run)'))
                : ('Was ' + fromLabel + ' → now ' + toLabel);
            if (f.tied) {
                var tie = document.createElement('span');
                tie.className = 'stats-chronicle-tie-badge';
                tie.textContent = 'tie';
                handoff.appendChild(document.createTextNode(' '));
                handoff.appendChild(tie);
            }
            li.appendChild(handoff);
            flipList.appendChild(li);
        });
        container.appendChild(flipList);
    }

    var movers = document.createElement('div');
    movers.className = 'stats-chronicle-movers';
    var gainCol = document.createElement('div');
    gainCol.innerHTML = '<div class="stats-chronicle-subhead">Net gainers</div>';
    (era.netGainers || []).forEach(function (m) {
        var row = document.createElement('div');
        row.className = 'stats-chronicle-mover up';
        row.textContent = m.name + ' +' + m.delta + ' → ' + m.to;
        gainCol.appendChild(row);
    });
    if (!(era.netGainers || []).length) gainCol.appendChild(document.createTextNode('—'));
    var loseCol = document.createElement('div');
    loseCol.innerHTML = '<div class="stats-chronicle-subhead">Net losers</div>';
    (era.netLosers || []).forEach(function (m) {
        var row = document.createElement('div');
        row.className = 'stats-chronicle-mover down';
        row.textContent = m.name + ' ' + m.delta + ' → ' + m.to;
        loseCol.appendChild(row);
    });
    if (!(era.netLosers || []).length) loseCol.appendChild(document.createTextNode('—'));
    movers.appendChild(gainCol);
    movers.appendChild(loseCol);
    container.appendChild(movers);
}

function slimTimelineRunForChronicle(r) {
    return {
        n: r.n || r.p || 'Unknown',
        p: r.p || null,
        t: r.t || null,
        pt: r.pt,
        id: r.id,
        w: r.w,
        g: !!r.g,
        ns: r.ns || undefined
    };
}

function buildChronicleWarEventsFromTimeline(tl) {
    if (!tl || !tl.length) return [];
    var full = tl.map(function (ev) {
        return { d: ev.d, runs: (ev.runs || []).map(slimTimelineRunForChronicle) };
    });
    if (full.length <= 26) return { events: full, eventCount: full.length, truncated: false };
    return {
        events: [full[0]].concat(full.slice(-25)),
        eventCount: full.length,
        truncated: true
    };
}

function renderChronicleWarReel(slot, category) {
    slot.innerHTML = '';
    var loading = document.createElement('div');
    loading.className = 'stats-explorer-empty';
    loading.textContent = 'Loading board history…';
    slot.appendChild(loading);

    var fetcher = window.githubCacheFetcher;
    if (!fetcher || typeof fetcher.loadTimelines !== 'function') {
        slot.innerHTML = '';
        var missing = document.createElement('div');
        missing.className = 'stats-explorer-empty';
        missing.textContent = 'Timelines unavailable — cannot build war reel.';
        slot.appendChild(missing);
        return;
    }

    fetcher.loadTimelines().then(function (timelines) {
        if (buildChronicleWarKey() !== category) return;
        slot.innerHTML = '';
        var boards = (timelines && timelines.boards) || {};
        var tl = boards[category];
        var meta = document.createElement('div');
        meta.className = 'stats-chronicle-headline';
        var catHtml = typeof formatCategoryInlineHtml === 'function'
            ? formatCategoryInlineHtml(category)
            : escapeHtml(category);
        if (!tl || !tl.length) {
            meta.innerHTML = catHtml + ' — no WR events yet.';
            slot.appendChild(meta);
            return;
        }
        var built = buildChronicleWarEventsFromTimeline(tl);
        meta.innerHTML = catHtml + ' — ' + built.eventCount + ' events' +
            (built.truncated ? ' (showing first + last 25)' : '');
        slot.appendChild(meta);

        var reel = document.createElement('ul');
        reel.className = 'stats-chronicle-list stats-chronicle-reel';
        built.events.forEach(function (ev, idx) {
            var li = document.createElement('li');
            var tied = ev.runs && ev.runs.length > 1;
            li.className = 'stats-chronicle-list-item stats-chronicle-reel-item' + (tied ? ' is-tied' : '');
            var top = document.createElement('div');
            top.className = 'stats-chronicle-reel-top';
            var when = document.createElement('span');
            when.className = 'stats-chronicle-date-chip';
            when.textContent = ev.d + (idx === 0 ? ' (first)' : '');
            top.appendChild(when);
            if (tied) {
                var badge = document.createElement('span');
                badge.className = 'stats-chronicle-tie-badge';
                badge.textContent = ev.runs.length + '-way tie';
                top.appendChild(badge);
            }
            top.appendChild(createChronicleTravelBtn(ev.d, 'Travel'));
            li.appendChild(top);
            var holders = document.createElement('div');
            holders.className = 'stats-chronicle-holders';
            (ev.runs || []).forEach(function (r, ri) {
                if (ri) holders.appendChild(document.createTextNode(' · '));
                holders.appendChild(createChronicleNameSpan(r.n, r.ns));
                if (r.t) {
                    var t = document.createElement('span');
                    t.className = 'stats-chronicle-time';
                    t.textContent = ' ' + formatPrimaryDisplay(r.t, /\|High Score$/.test(category));
                    holders.appendChild(t);
                }
            });
            li.appendChild(holders);
            reel.appendChild(li);
        });
        slot.appendChild(reel);
    }).catch(function () {
        if (buildChronicleWarKey() !== category) return;
        slot.innerHTML = '';
        var err = document.createElement('div');
        err.className = 'stats-explorer-empty';
        err.textContent = 'Failed to load timelines for this board.';
        slot.appendChild(err);
    });
}

function renderChronicleView(body) {
    ensureChronicleDefaults();
    if (!chronicleData) {
        var empty = document.createElement('div');
        empty.className = 'stats-explorer-empty';
        empty.textContent = 'Chronicle data not available yet. Run node scripts/chronicle-analyzer.js after the runs-derived stats rebuild.';
        body.appendChild(empty);
        return;
    }

    var eras = chronicleData.eras || [];
    var empires = chronicleData.empires || [];
    var erasChrono = eras.slice().sort(function (a, b) { return a.date.localeCompare(b.date); });

    if (!chronicleEraDate && erasChrono.length) {
        chronicleEraDate = erasChrono[erasChrono.length - 1].date;
    }
    if (!chronicleEmpireId && empires.length) chronicleEmpireId = empires[0].id;

    var eraIdx = 0;
    for (var ei = 0; ei < erasChrono.length; ei++) {
        if (erasChrono[ei].date === chronicleEraDate) { eraIdx = ei; break; }
    }
    var era = erasChrono[eraIdx] || erasChrono[erasChrono.length - 1] || null;

    var empire = null;
    for (var pi = 0; pi < empires.length; pi++) {
        if (empires[pi].id === chronicleEmpireId) { empire = empires[pi]; break; }
    }
    if (!empire && empires.length) empire = empires[0];

    normalizeChronicleWarFilters();

    var root = document.createElement('div');
    root.className = 'stats-chronicle';

    // —— Empire arcs (first) ——
    var empPane = document.createElement('section');
    empPane.className = 'stats-chronicle-pane stats-chronicle-empire';
    var empHead = document.createElement('div');
    empHead.className = 'stats-chronicle-pane-head';
    var empTitle = document.createElement('h3');
    empTitle.className = 'stats-chronicle-pane-title';
    empTitle.textContent = 'Empire arcs';
    empHead.appendChild(empTitle);
    empPane.appendChild(empHead);

    var empFilters = document.createElement('div');
    empFilters.className = 'stats-explorer-filters';
    var empOpts = empires.map(function (e) {
        var drop = e.peakDrop || 0;
        var peakC = e.peak ? e.peak.count : 0;
        return {
            value: e.id,
            label: e.name + ' (−' + drop + ' from peak ' + peakC + ')'
        };
    });
    empFilters.appendChild(createStatsSelect('Player', chronicleEmpireId || (empire && empire.id) || '', empOpts, function (v) {
        chronicleEmpireId = v;
        renderStatisticsExplorerContent(body);
    }));
    empPane.appendChild(empFilters);

    if (!empire) {
        var noEmp = document.createElement('div');
        noEmp.className = 'stats-explorer-empty';
        noEmp.textContent = 'No empire data.';
        empPane.appendChild(noEmp);
    } else {
        var empSummary = document.createElement('div');
        empSummary.className = 'stats-chronicle-headline';
        var peakStr = empire.peak
            ? (empire.peak.count + ' on ' + empire.peak.date)
            : '—';
        var latestStr = empire.latest
            ? (empire.latest.count + ' on ' + empire.latest.date +
                (empire.latest.percentage != null ? ' (' + empire.latest.percentage + '%)' : ''))
            : '—';
        empSummary.innerHTML = '<strong>' + escapeHtml(empire.name) + '</strong> — peak ' +
            escapeHtml(String(peakStr)) + ', now ' + escapeHtml(String(latestStr)) +
            ', drop <strong>' + escapeHtml(String(empire.peakDrop || 0)) + '</strong>';
        empPane.appendChild(empSummary);

        var empActions = document.createElement('div');
        empActions.className = 'stats-chronicle-actions';
        if (empire.peak && empire.peak.date) {
            empActions.appendChild(createChronicleTravelBtn(empire.peak.date, 'Travel to peak'));
        }
        if (empire.latest && empire.latest.date) {
            empActions.appendChild(createChronicleTravelBtn(empire.latest.date, 'Travel to latest'));
        }
        empPane.appendChild(empActions);

        empPane.appendChild(renderEmpireSparkline(empire.series, empire.peak && empire.peak.date));

        if (empire.turningPoints && empire.turningPoints.length) {
            var tpHead = document.createElement('div');
            tpHead.className = 'stats-chronicle-subhead';
            tpHead.textContent = 'Turning points';
            empPane.appendChild(tpHead);
            var tpList = document.createElement('ul');
            tpList.className = 'stats-chronicle-list';
            empire.turningPoints.forEach(function (tp) {
                var li = document.createElement('li');
                li.className = 'stats-chronicle-list-item stats-chronicle-tp';
                var sign = tp.delta > 0 ? '+' : '';
                li.innerHTML = '<span>' + escapeHtml(tp.date) + '</span> ' +
                    '<span class="' + (tp.delta >= 0 ? 'up' : 'down') + '">' +
                    sign + tp.delta + '</span> ' +
                    '<span>' + tp.from + ' → ' + tp.to + '</span>';
                li.appendChild(createChronicleTravelBtn(tp.date, 'Travel'));
                tpList.appendChild(li);
            });
            empPane.appendChild(tpList);
        }
    }
    root.appendChild(empPane);

    // —— Era newspaper ——
    var eraPane = document.createElement('section');
    eraPane.className = 'stats-chronicle-pane stats-chronicle-era';
    var eraHead = document.createElement('div');
    eraHead.className = 'stats-chronicle-pane-head';
    var eraTitle = document.createElement('h3');
    eraTitle.className = 'stats-chronicle-pane-title';
    eraTitle.textContent = 'Era newspaper';
    eraHead.appendChild(eraTitle);
    var eraTravelSlot = document.createElement('div');
    eraTravelSlot.className = 'stats-chronicle-travel-slot';
    eraHead.appendChild(eraTravelSlot);
    eraPane.appendChild(eraHead);

    var eraBlurb = document.createElement('div');
    eraBlurb.className = 'stats-chronicle-hint';
    eraBlurb.textContent = 'Biggest story days in Snake WR history — flips, debuts, and who gained or lost records.';
    eraPane.appendChild(eraBlurb);

    var eraDetails = document.createElement('div');
    eraDetails.className = 'stats-chronicle-era-details';

    if (!erasChrono.length) {
        fillChronicleEraDetails(eraDetails, null, eraTravelSlot);
    } else {
        var scrub = document.createElement('div');
        scrub.className = 'stats-chronicle-scrub';
        var scrubLab = document.createElement('label');
        scrubLab.className = 'stats-chronicle-scrub-label';
        scrubLab.textContent = 'Story days';
        scrub.appendChild(scrubLab);
        var range = document.createElement('input');
        range.type = 'range';
        range.min = '0';
        range.max = String(Math.max(0, erasChrono.length - 1));
        range.value = String(eraIdx);
        range.step = '1';
        range.className = 'stats-chronicle-range';
        var dateChip = document.createElement('span');
        dateChip.className = 'stats-chronicle-date-chip';
        dateChip.textContent = era ? era.date : '';
        range.addEventListener('input', function () {
            var idx = Number(range.value);
            var next = erasChrono[idx];
            if (!next) return;
            chronicleEraDate = next.date;
            dateChip.textContent = next.date;
            fillChronicleEraDetails(eraDetails, next, eraTravelSlot);
        });
        scrub.appendChild(range);
        scrub.appendChild(dateChip);
        eraPane.appendChild(scrub);
        fillChronicleEraDetails(eraDetails, era, eraTravelSlot);
    }
    eraPane.appendChild(eraDetails);
    root.appendChild(eraPane);

    // —— Board war reel (5 filters) ——
    var warPane = document.createElement('section');
    warPane.className = 'stats-chronicle-pane stats-chronicle-war';
    var warHead = document.createElement('div');
    warHead.className = 'stats-chronicle-pane-head';
    var warTitle = document.createElement('h3');
    warTitle.className = 'stats-chronicle-pane-title';
    warTitle.textContent = 'Board war reel';
    warHead.appendChild(warTitle);
    warPane.appendChild(warHead);

    var warFilters = document.createElement('div');
    warFilters.className = 'stats-explorer-filters';
    var warSlot = document.createElement('div');
    warSlot.className = 'stats-chronicle-war-slot';

    function refreshWarFiltersAndReel() {
        normalizeChronicleWarFilters();
        warFilters.innerHTML = '';
        var appleOpts2 = typeof appleAmounts !== 'undefined' ? Object.keys(appleAmounts) : ['1 Apple', '3 Apples', '5 Apples', '10 Apples', 'Dice', 'Bomb', 'Tally'];
        var speedOpts2 = typeof speeds !== 'undefined' ? Object.keys(speeds) : ['Normal', 'Fast', 'Slow'];
        var sizeOpts2 = typeof sizes !== 'undefined' ? Object.keys(sizes) : ['Standard', 'Small', 'Large'];
        if (chronicleWarRunMode === '100 Apples') {
            sizeOpts2 = sizeOpts2.filter(function (s) { return s !== 'Small'; });
        }
        var runOpts2 = typeof runModes !== 'undefined' ? Object.keys(runModes) : ['25 Apples', '50 Apples', '100 Apples', 'All Apples', 'High Score'];
        var modeOpts2 = getChronicleWarModeOptions();
        warFilters.appendChild(createStatsSelect('Count', chronicleWarApple, appleOpts2, function (v) {
            chronicleWarApple = v;
            refreshWarFiltersAndReel();
        }));
        warFilters.appendChild(createStatsSelect('Speed', chronicleWarSpeed, speedOpts2, function (v) {
            chronicleWarSpeed = v;
            refreshWarFiltersAndReel();
        }));
        warFilters.appendChild(createStatsSelect('Size', chronicleWarSize, sizeOpts2, function (v) {
            chronicleWarSize = v;
            refreshWarFiltersAndReel();
        }));
        warFilters.appendChild(createStatsSelect('Run', chronicleWarRunMode, runOpts2, function (v) {
            chronicleWarRunMode = v;
            refreshWarFiltersAndReel();
        }));
        warFilters.appendChild(createStatsSelect('Mode', chronicleWarGamemode, modeOpts2, function (v) {
            chronicleWarGamemode = v;
            refreshWarFiltersAndReel();
        }));
        renderChronicleWarReel(warSlot, buildChronicleWarKey());
    }

    refreshWarFiltersAndReel();
    warPane.appendChild(warFilters);
    warPane.appendChild(warSlot);
    root.appendChild(warPane);

    body.appendChild(root);
}

function renderProgressionView(body) {
    normalizeProgressionFilters();

    var appleOpts = typeof appleAmounts !== 'undefined' ? Object.keys(appleAmounts) : ['1 Apple', '3 Apples', '5 Apples', '10 Apples', 'Dice', 'Bomb', 'Tally'];
    var speedOpts = typeof speeds !== 'undefined' ? Object.keys(speeds) : ['Normal', 'Fast', 'Slow'];
    var sizeOpts = typeof sizes !== 'undefined' ? Object.keys(sizes) : ['Standard', 'Small', 'Large'];
    if (statsProgRunMode === '100 Apples') {
        sizeOpts = sizeOpts.filter(function (s) { return s !== 'Small'; });
    }
    var runOpts = typeof runModes !== 'undefined' ? Object.keys(runModes) : ['25 Apples', '50 Apples', '100 Apples', 'All Apples', 'High Score'];
    var modeOpts = getProgressionGamemodeOptions();

    var filters = document.createElement('div');
    filters.className = 'stats-explorer-filters';
    filters.appendChild(createStatsSelect('Count', statsProgApple, appleOpts, function (v) {
        statsProgApple = v;
        renderStatisticsExplorerContent(body);
    }));
    filters.appendChild(createStatsSelect('Speed', statsProgSpeed, speedOpts, function (v) {
        statsProgSpeed = v;
        renderStatisticsExplorerContent(body);
    }));
    filters.appendChild(createStatsSelect('Size', statsProgSize, sizeOpts, function (v) {
        statsProgSize = v;
        renderStatisticsExplorerContent(body);
    }));
    filters.appendChild(createStatsSelect('Run', statsProgRunMode, runOpts, function (v) {
        statsProgRunMode = v;
        normalizeProgressionFilters();
        renderStatisticsExplorerContent(body);
    }));
    filters.appendChild(createStatsSelect('Mode', statsProgGamemode, modeOpts, function (v) {
        statsProgGamemode = v;
        renderStatisticsExplorerContent(body);
    }));
    body.appendChild(filters);

    var key = buildProgressionKey();
    var points = (statsExplorerData.progression && statsExplorerData.progression[key]) || [];
    if (!points.length) {
        var empty = document.createElement('div');
        empty.className = 'stats-explorer-empty';
        empty.textContent = 'No WR progression history for this combination (all-time).';
        body.appendChild(empty);
        return;
    }

    var caption = document.createElement('div');
    caption.className = 'stats-explorer-meta';
    caption.textContent = key.replace(/\|/g, ' · ') + ' — ' + points.length + ' change' + (points.length === 1 ? '' : 's');
    body.appendChild(caption);

    var isHs = statsProgRunMode === 'High Score';
    body.appendChild(buildLineChart(points, isHs));
}

function formatChartAxisSeconds(sec, isHighScore) {
    if (!isFinite(sec)) return '';
    if (isHighScore) {
        return String(Math.round(sec * 1000));
    }
    if (sec >= 60) {
        var m = Math.floor(sec / 60);
        var s = sec - m * 60;
        var sStr = s < 10 ? '0' + s.toFixed(1) : s.toFixed(1);
        if (sStr.indexOf('.0') === sStr.length - 2) sStr = sStr.slice(0, -2);
        return m + ':' + sStr;
    }
    if (sec >= 10) return sec.toFixed(1) + 's';
    return sec.toFixed(2) + 's';
}

function buildLineChart(points, isHighScore) {
    var wrap = document.createElement('div');
    wrap.className = 'stats-explorer-chart';
    wrap.style.position = 'relative';
    if (!points.length) {
        wrap.textContent = 'No data points.';
        return wrap;
    }

    var w = 720, h = 260, padL = 72, padR = 28, padT = 16, padB = 36;
    var values = points.map(function (p) { return parsePrimaryToSeconds(p.t); });
    var minV = Math.min.apply(null, values);
    var maxV = Math.max.apply(null, values);
    if (minV === maxV) { minV -= 1; maxV += 1; }

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('class', 'stats-line-svg');

    var plotW = w - padL - padR;
    var times = points.map(function (p) {
        var ms = Date.parse(String(p.d) + 'T00:00:00Z');
        return isFinite(ms) ? ms : NaN;
    });
    var tMin = Infinity;
    var tMax = -Infinity;
    for (var ti0 = 0; ti0 < times.length; ti0++) {
        if (!isFinite(times[ti0])) continue;
        if (times[ti0] < tMin) tMin = times[ti0];
        if (times[ti0] > tMax) tMax = times[ti0];
    }
    var hasTimeSpan = isFinite(tMin) && isFinite(tMax) && tMax > tMin;

    // X by calendar date (not evenly spaced by improvement index)
    function xAt(i) {
        if (points.length === 1) {
            return padL + plotW / 2;
        }
        if (!hasTimeSpan) {
            return padL + (i / (points.length - 1)) * plotW;
        }
        var t = times[i];
        if (!isFinite(t)) {
            return padL + (i / (points.length - 1)) * plotW;
        }
        return padL + ((t - tMin) / (tMax - tMin)) * plotW;
    }
    function yAt(v) {
        return padT + (1 - (v - minV) / (maxV - minV)) * (h - padT - padB);
    }

    var axis = document.createElementNS(svgNS, 'line');
    axis.setAttribute('x1', padL); axis.setAttribute('x2', padL);
    axis.setAttribute('y1', padT); axis.setAttribute('y2', h - padB);
    axis.setAttribute('class', 'stats-axis');
    svg.appendChild(axis);
    var axis2 = document.createElementNS(svgNS, 'line');
    axis2.setAttribute('x1', padL); axis2.setAttribute('x2', w - padR);
    axis2.setAttribute('y1', h - padB); axis2.setAttribute('y2', h - padB);
    axis2.setAttribute('class', 'stats-axis');
    svg.appendChild(axis2);

    // Y-axis time ticks (top = max, bottom = min)
    var tickCount = 4;
    for (var ti = 0; ti <= tickCount; ti++) {
        var frac = ti / tickCount;
        var v = maxV - frac * (maxV - minV);
        var y = yAt(v);
        var grid = document.createElementNS(svgNS, 'line');
        grid.setAttribute('x1', padL);
        grid.setAttribute('x2', w - padR);
        grid.setAttribute('y1', y);
        grid.setAttribute('y2', y);
        grid.setAttribute('class', 'stats-axis-grid');
        svg.appendChild(grid);
        var lab = document.createElementNS(svgNS, 'text');
        lab.setAttribute('x', padL - 6);
        lab.setAttribute('y', y + 3);
        lab.setAttribute('text-anchor', 'end');
        lab.setAttribute('class', 'stats-axis-label stats-axis-y-label');
        lab.textContent = formatChartAxisSeconds(v, isHighScore);
        svg.appendChild(lab);
    }

    var d = '';
    points.forEach(function (p, i) {
        var x = xAt(i), y = yAt(parsePrimaryToSeconds(p.t));
        d += (i === 0 ? 'M' : 'L') + x + ' ' + y + ' ';
    });
    var path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', d.trim());
    path.setAttribute('class', 'stats-line');
    svg.appendChild(path);

    var tip = document.createElement('div');
    tip.className = 'stats-explorer-tooltip';
    tip.hidden = true;
    tip.style.pointerEvents = 'auto';
    tip.addEventListener('mouseenter', function () { tip.hidden = false; });
    tip.addEventListener('mouseleave', function () { tip.hidden = true; });

    points.forEach(function (p, i) {
        var cx = xAt(i), cy = yAt(parsePrimaryToSeconds(p.t));
        var c = document.createElementNS(svgNS, 'circle');
        c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', 3.5);
        c.setAttribute('class', 'stats-point' + (p.w ? ' stats-point--link' : ''));
        if (p.w) {
            c.style.cursor = 'pointer';
        }
        (function (pt) {
            c.addEventListener('mouseenter', function () {
                tip.hidden = false;
                var timeText = formatPrimaryDisplay(pt.t, isHighScore);
                var timeHtml = pt.w
                    ? '<a class="stats-run-link" href="' + escapeAttr(pt.w) +
                        '" target="_blank" rel="noopener noreferrer">' + escapeHtml(timeText) + '</a>'
                    : escapeHtml(timeText);
                tip.innerHTML = '<strong>' + pt.d + '</strong><br>' + escapeHtml(pt.n || '') + '<br>' + timeHtml;
                // Place tooltip inside chart bounds (flip left/down if needed) — no overflow scroll
                var wrapRect = wrap.getBoundingClientRect();
                var cRect = c.getBoundingClientRect();
                var tipW = tip.offsetWidth || 140;
                var tipH = tip.offsetHeight || 56;
                var left = cRect.left - wrapRect.left + 10;
                var top = cRect.top - wrapRect.top - tipH - 6;
                if (left + tipW > wrapRect.width - 4) {
                    left = cRect.left - wrapRect.left - tipW - 8;
                }
                if (left < 4) left = 4;
                if (top < 4) {
                    top = cRect.top - wrapRect.top + 14;
                }
                if (top + tipH > wrapRect.height - 4) {
                    top = Math.max(4, wrapRect.height - tipH - 4);
                }
                tip.style.left = left + 'px';
                tip.style.top = top + 'px';
            });
            c.addEventListener('mouseleave', function () { tip.hidden = true; });
            if (pt.w) {
                c.addEventListener('click', function (e) {
                    e.preventDefault();
                    window.open(pt.w, '_blank', 'noopener,noreferrer');
                });
            }
        })(p);
        svg.appendChild(c);
    });

    var t0 = document.createElementNS(svgNS, 'text');
    t0.setAttribute('x', padL); t0.setAttribute('y', h - 10);
    t0.setAttribute('class', 'stats-axis-label');
    t0.textContent = points[0].d;
    svg.appendChild(t0);
    var t1 = document.createElementNS(svgNS, 'text');
    t1.setAttribute('x', w - padR); t1.setAttribute('y', h - 10);
    t1.setAttribute('text-anchor', 'end');
    t1.setAttribute('class', 'stats-axis-label');
    t1.textContent = points[points.length - 1].d;
    svg.appendChild(t1);

    // Mid-span date when the range is long enough that first/last alone mislead
    var TWO_YEARS_MS = 2 * 365.25 * 24 * 60 * 60 * 1000;
    if (hasTimeSpan && points.length >= 3 && (tMax - tMin) >= TWO_YEARS_MS) {
        var midT = tMin + (tMax - tMin) / 2;
        var midDate = new Date(midT).toISOString().slice(0, 10);
        var tMid = document.createElementNS(svgNS, 'text');
        tMid.setAttribute('x', padL + plotW / 2);
        tMid.setAttribute('y', h - 10);
        tMid.setAttribute('text-anchor', 'middle');
        tMid.setAttribute('class', 'stats-axis-label');
        tMid.textContent = midDate;
        svg.appendChild(tMid);
    }

    wrap.appendChild(svg);
    wrap.appendChild(tip);
    return wrap;
}

function filterRowsByTiedMode(rows) {
    if (!rows || !rows.length) return [];
    if (statsExplorerLongevityTiedMode === 'untied') {
        return rows.filter(function (r) { return (r.tiedHolders || 1) <= 1; });
    }
    if (statsExplorerLongevityTiedMode === 'tied') {
        return rows.filter(function (r) { return (r.tiedHolders || 1) > 1; });
    }
    return rows;
}

function appendLongevityTiedChips(body, onChange) {
    var bar = document.createElement('div');
    bar.className = 'stats-explorer-chips stats-longevity-chips';
    [
        { group: 'mode', id: 'all', label: 'All-time' },
        { group: 'mode', id: 'standing', label: 'Still standing' },
        { group: 'tied', id: 'all', label: 'All holds' },
        { group: 'tied', id: 'untied', label: 'Untied only' },
        { group: 'tied', id: 'tied', label: 'Tied only' }
    ].forEach(function (opt) {
        // Longevity has mode chips; Career only wants tied chips
        if (onChange === 'career' && opt.group === 'mode') return;
        var chip = document.createElement('button');
        chip.type = 'button';
        var active = opt.group === 'mode'
            ? opt.id === statsExplorerLongevityMode
            : opt.id === statsExplorerLongevityTiedMode;
        chip.className = 'stats-explorer-chip' + (active ? ' active' : '');
        chip.textContent = opt.label;
        chip.addEventListener('click', function () {
            if (opt.group === 'mode') {
                statsExplorerLongevityMode = opt.id;
            } else {
                statsExplorerLongevityTiedMode = opt.id;
            }
            renderStatisticsExplorerContent(body);
        });
        bar.appendChild(chip);
    });
    body.appendChild(bar);
}

function getLongevityRows() {
    var raw = statsExplorerData && statsExplorerData.longevity;
    if (!raw) return [];
    // New shape: { all, standing }; legacy: flat array or timed variants
    var rows;
    if (Array.isArray(raw)) {
        rows = statsExplorerLongevityMode === 'standing'
            ? raw.filter(function (r) { return r.stillStanding; })
            : raw;
    } else if (statsExplorerLongevityMode === 'standing') {
        rows = raw.standing || [];
    } else {
        rows = raw.all || [];
    }
    return filterRowsByTiedMode(rows);
}

function renderLongevityView(body) {
    appendLongevityTiedChips(body, 'longevity');

    appendListFilters(body);

    var allRows = getLongevityRows();
    var filtered = filterRowsByListFilters(allRows);
    var meta = document.createElement('div');
    meta.className = 'stats-explorer-meta';
    var shown = Math.min(filtered.length, STATS_LIST_DISPLAY_LIMIT);
    meta.textContent = shown + ' shown' +
        (filtered.length > STATS_LIST_DISPLAY_LIMIT ? ' · ' + filtered.length + ' match' : '') +
        (filtered.length !== allRows.length ? ' · ' + allRows.length + ' total' : '') +
        ' · longest first';
    body.appendChild(meta);

    renderListView(body, filtered, 'longevity');
}

function getStatsExplorerPlayers() {
    if (statsExplorerPlayersCache) return statsExplorerPlayersCache;
    var byId = {};
    var raw = statsExplorerData && statsExplorerData.longevity;
    var rows = (raw && Array.isArray(raw.all))
        ? raw.all
        : (Array.isArray(raw) ? raw : []);
    rows.forEach(function (r) {
        if (!r || !r.playerId) return;
        byId[r.playerId] = r.playerName || r.playerId;
    });
    (statsExplorerData.career || []).forEach(function (r) {
        if (!r || !r.playerId) return;
        if (!byId[r.playerId]) byId[r.playerId] = r.playerName || r.playerId;
    });
    statsExplorerPlayersCache = Object.keys(byId).map(function (id) {
        return { id: id, name: byId[id] };
    }).sort(function (a, b) {
        return String(a.name).localeCompare(String(b.name));
    });
    return statsExplorerPlayersCache;
}

function getPlayerHoldRows(playerId) {
    if (!playerId) return [];
    var raw = statsExplorerData && statsExplorerData.longevity;
    var rows = (raw && Array.isArray(raw.all))
        ? raw.all
        : (Array.isArray(raw) ? raw : []);
    var latestMode = statsExplorerPlayerHoldMode === 'latest';
    var oldMode = statsExplorerPlayerHoldMode === 'old';
    return rows.filter(function (r) {
        if (!r || r.playerId !== playerId) return false;
        if (statsExplorerPlayerHoldMode === 'present') {
            if (!r.stillStanding) return false;
            if (statsExplorerPlayerTiedMode === 'untied') return (r.tiedHolders || 1) <= 1;
            if (statsExplorerPlayerTiedMode === 'tied') return (r.tiedHolders || 1) > 1;
            return true;
        }
        if (oldMode) return !r.stillStanding;
        // 'all' and 'latest' — every hold
        return true;
    }).slice().sort(function (a, b) {
        if (oldMode) {
            // Most recently taken WR first (end date closest to today)
            return String(b.end || '').localeCompare(String(a.end || '')) ||
                (b.days || 0) - (a.days || 0) ||
                String(a.start || '').localeCompare(String(b.start || ''));
        }
        if (latestMode) {
            // Most recently acquired WR first (start date)
            var byStart = String(b.start || '').localeCompare(String(a.start || ''));
            if (byStart) return byStart;
            if (!!a.stillStanding !== !!b.stillStanding) return a.stillStanding ? -1 : 1;
            return (b.days || 0) - (a.days || 0);
        }
        return (b.days || 0) - (a.days || 0) ||
            String(a.start || '').localeCompare(String(b.start || ''));
    });
}

function filterPlayerSuggestions(query, limit) {
    var q = String(query || '').trim().toLowerCase();
    var players = getStatsExplorerPlayers();
    if (!q) return players.slice(0, limit || 12);
    var starts = [];
    var contains = [];
    for (var i = 0; i < players.length; i++) {
        var name = String(players[i].name || '').toLowerCase();
        if (name === q) {
            starts.unshift(players[i]);
        } else if (name.indexOf(q) === 0) {
            starts.push(players[i]);
        } else if (name.indexOf(q) !== -1) {
            contains.push(players[i]);
        }
        if (starts.length + contains.length >= (limit || 12) * 2) break;
    }
    return starts.concat(contains).slice(0, limit || 12);
}

function selectStatsExplorerPlayer(player) {
    if (!player) {
        statsExplorerPlayerId = null;
        statsExplorerPlayerName = '';
        return;
    }
    statsExplorerPlayerId = player.id;
    statsExplorerPlayerName = player.name || '';
}

/** Player with the most currently standing WR holds (present rankings #1). */
function getTopPresentWrPlayer() {
    var rows = (statsExplorerData && statsExplorerData.career) || [];
    var best = null;
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (!row || !row.playerId) continue;
        var n = row.standingHolds || 0;
        if (!best || n > best.standingHolds ||
            (n === best.standingHolds && String(row.playerName || '').localeCompare(String(best.name || '')) < 0)) {
            best = {
                id: row.playerId,
                name: row.playerName || row.playerId,
                standingHolds: n
            };
        }
    }
    return best && best.standingHolds > 0 ? { id: best.id, name: best.name } : null;
}

function applyPlayerTabDefault() {
    if (statsExplorerPlayerDefaultApplied || statsExplorerPlayerId) return;
    statsExplorerPlayerDefaultApplied = true;
    // 1/16: empty state meme; otherwise preselect current #1 by present WR count
    if (Math.random() < 1 / 16) {
        statsExplorerPlayerShowMeme = true;
        return;
    }
    statsExplorerPlayerShowMeme = false;
    var top = getTopPresentWrPlayer();
    if (top) selectStatsExplorerPlayer(top);
}

function renderPlayerView(body) {
    applyPlayerTabDefault();

    var searchWrap = document.createElement('div');
    searchWrap.className = 'stats-player-search';

    var label = document.createElement('label');
    label.className = 'stats-explorer-select-label';
    label.setAttribute('for', 'statsPlayerSearch');
    label.textContent = 'Player';
    searchWrap.appendChild(label);

    var inputWrap = document.createElement('div');
    inputWrap.className = 'stats-player-search-input-wrap';

    var input = document.createElement('input');
    input.type = 'text';
    input.id = 'statsPlayerSearch';
    input.className = 'stats-player-search-input';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    input.placeholder = 'Search player…';
    input.value = statsExplorerPlayerName || '';
    inputWrap.appendChild(input);

    var suggestions = document.createElement('div');
    suggestions.className = 'stats-player-suggestions';
    suggestions.hidden = true;
    inputWrap.appendChild(suggestions);
    searchWrap.appendChild(inputWrap);
    body.appendChild(searchWrap);

    function hideSuggestions() {
        suggestions.hidden = true;
        suggestions.innerHTML = '';
    }

    function showSuggestions(list) {
        suggestions.innerHTML = '';
        if (!list.length) {
            hideSuggestions();
            return;
        }
        list.forEach(function (p) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'stats-player-suggestion';
            btn.textContent = p.name;
            btn.addEventListener('mousedown', function (e) {
                e.preventDefault();
                selectStatsExplorerPlayer(p);
                statsExplorerPlayerShowMeme = false;
                input.value = p.name;
                hideSuggestions();
                renderStatisticsExplorerContent(body);
            });
            suggestions.appendChild(btn);
        });
        suggestions.hidden = false;
    }

    input.addEventListener('input', function () {
        var q = input.value;
        if (statsExplorerPlayerId && q !== statsExplorerPlayerName) {
            statsExplorerPlayerId = null;
            statsExplorerPlayerName = '';
        }
        showSuggestions(filterPlayerSuggestions(q, 12));
    });
    input.addEventListener('focus', function () {
        showSuggestions(filterPlayerSuggestions(input.value, 12));
    });
    input.addEventListener('blur', function () {
        setTimeout(hideSuggestions, 150);
    });
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            var list = filterPlayerSuggestions(input.value, 1);
            if (list.length) {
                selectStatsExplorerPlayer(list[0]);
                statsExplorerPlayerShowMeme = false;
                input.value = list[0].name;
                hideSuggestions();
                renderStatisticsExplorerContent(body);
            }
        } else if (e.key === 'Escape') {
            hideSuggestions();
        }
    });

    if (!statsExplorerPlayerId) {
        var emptyWrap = document.createElement('div');
        emptyWrap.className = 'stats-player-empty';

        if (statsExplorerPlayerShowMeme) {
            var memeWrap = document.createElement('div');
            memeWrap.className = 'stats-player-empty-meme';
            var meme = document.createElement('img');
            meme.src = 'assets/player-search-sacrifice.gif';
            meme.alt = 'Sacrifice your physical and mental health for Google Snake world records';
            memeWrap.appendChild(meme);
            emptyWrap.appendChild(memeWrap);
        }

        var hint = document.createElement('div');
        hint.className = 'stats-explorer-meta';
        hint.textContent = 'Search and select a player to see all WR holds, longest first.';
        emptyWrap.appendChild(hint);

        body.appendChild(emptyWrap);
        return;
    }

    var chipBar = document.createElement('div');
    chipBar.className = 'stats-explorer-chips stats-longevity-chips';
    [
        { group: 'hold', id: 'all', label: 'All' },
        { group: 'hold', id: 'present', label: 'Present' },
        { group: 'hold', id: 'old', label: 'Old' },
        { group: 'hold', id: 'latest', label: 'Latest activity' },
        { group: 'hold', id: 'mastery', label: 'Mastery' },
        { group: 'tied', id: 'all', label: 'All holds' },
        { group: 'tied', id: 'untied', label: 'Untied only' },
        { group: 'tied', id: 'tied', label: 'Tied only' }
    ].forEach(function (opt) {
        // Tied/untied only apply to present WR records
        if (opt.group === 'tied' && statsExplorerPlayerHoldMode !== 'present') return;
        var chip = document.createElement('button');
        chip.type = 'button';
        var active = opt.group === 'hold'
            ? opt.id === statsExplorerPlayerHoldMode
            : opt.id === statsExplorerPlayerTiedMode;
        chip.className = 'stats-explorer-chip' + (active ? ' active' : '');
        chip.textContent = opt.label;
        chip.addEventListener('click', function () {
            if (opt.group === 'hold') {
                statsExplorerPlayerHoldMode = opt.id;
                if (opt.id !== 'present') statsExplorerPlayerTiedMode = 'all';
            } else {
                statsExplorerPlayerTiedMode = opt.id;
            }
            renderStatisticsExplorerContent(body);
        });
        chipBar.appendChild(chip);
    });
    body.appendChild(chipBar);

    if (statsExplorerPlayerHoldMode === 'mastery') {
        renderPlayerMasteryView(body);
        return;
    }

    appendListFilters(body);

    var allRows = getPlayerHoldRows(statsExplorerPlayerId);
    var rows = filterRowsByListFilters(allRows);
    var modeLabel = statsExplorerPlayerHoldMode === 'present'
        ? 'present'
        : (statsExplorerPlayerHoldMode === 'old'
            ? 'old'
            : (statsExplorerPlayerHoldMode === 'latest' ? 'latest' : 'all'));
    var tiedLabel = '';
    if (statsExplorerPlayerHoldMode === 'present' && statsExplorerPlayerTiedMode === 'untied') {
        tiedLabel = ' · untied';
    } else if (statsExplorerPlayerHoldMode === 'present' && statsExplorerPlayerTiedMode === 'tied') {
        tiedLabel = ' · tied';
    }
    var sortHint = statsExplorerPlayerHoldMode === 'old'
        ? 'most recently taken first'
        : (statsExplorerPlayerHoldMode === 'latest' ? 'newest first' : 'longest first');
    var meta = document.createElement('div');
    meta.className = 'stats-explorer-meta';
    meta.textContent = statsExplorerPlayerName + ' · ' + rows.length + ' ' +
        modeLabel + ' hold' + (rows.length === 1 ? '' : 's') + tiedLabel +
        (rows.length !== allRows.length ? ' · ' + allRows.length + ' before filters' : '') +
        ' · ' + sortHint;
    body.appendChild(meta);

    if (!rows.length) {
        var empty = document.createElement('div');
        empty.className = 'stats-explorer-empty';
        empty.textContent = allRows.length
            ? 'No holds match these filters.'
            : (statsExplorerPlayerHoldMode === 'present'
                ? (statsExplorerPlayerTiedMode === 'untied'
                    ? 'No untied present holds for this player.'
                    : (statsExplorerPlayerTiedMode === 'tied'
                        ? 'No tied present holds for this player.'
                        : 'No present holds for this player.'))
                : (statsExplorerPlayerHoldMode === 'old'
                    ? 'No old holds for this player.'
                    : 'No holds found for this player.'));
        body.appendChild(empty);
        return;
    }

    renderListView(body, rows, 'player', true);
}

function renderPlayerMasteryView(body) {
    appendListFilters(body);

    var boardCount = getMasteryBoardCount();
    var entry = getMasteryPlayerEntry(statsExplorerPlayerId);
    var allRows = (entry && entry.completed ? entry.completed : []).map(function (item) {
        if (typeof item === 'string') {
            return { category: item, weblink: null, time: null };
        }
        return {
            category: item.category || item,
            weblink: item.weblink || null,
            runId: item.runId || null,
            time: item.time || null
        };
    });
    var rows = filterRowsByListFilters(allRows).slice().sort(function (a, b) {
        return String(a.category).localeCompare(String(b.category));
    });

    var filteredMetrics = summarizeMasteryRows(rows);
    var meta = document.createElement('div');
    meta.className = 'stats-explorer-meta';
    meta.textContent = statsExplorerPlayerName + ' · Mastery ' +
        rows.length + ' / ' + countMasteryFilterUniverse() +
        ' · N ' + filteredMetrics.bySpeed.Normal +
        ' · F ' + filteredMetrics.bySpeed.Fast +
        ' · S ' + filteredMetrics.bySpeed.Slow +
        ' · Std ' + filteredMetrics.bySize.Standard +
        ' · Sm ' + filteredMetrics.bySize.Small +
        ' · Lg ' + filteredMetrics.bySize.Large +
        (rows.length !== allRows.length ? ' · ' + allRows.length + ' unfiltered' : '') +
        ' · All Apples';
    body.appendChild(meta);

    if (!masteryChallengeData) {
        var missing = document.createElement('div');
        missing.className = 'stats-explorer-empty';
        missing.textContent = 'Mastery data not loaded yet.';
        body.appendChild(missing);
        return;
    }

    if (!rows.length) {
        var empty = document.createElement('div');
        empty.className = 'stats-explorer-empty';
        empty.textContent = allRows.length
            ? 'No mastery boards match these filters.'
            : 'No mastery completions for this player.';
        body.appendChild(empty);
        return;
    }

    renderListView(body, rows, 'mastery', true);
}

function getMasteryAllModeNames() {
    var all = (masteryChallengeData && masteryChallengeData.meta && masteryChallengeData.meta.modes) ||
        ['Classic', 'Wall', 'Portal', 'Cheese', 'Borderless', 'Twin', 'Winged', 'Yin Yang',
            'Key', 'Sokoban', 'Poison', 'Dimension', 'Minesweeper', 'Statue', 'Light', 'Shield',
            'Arrow', 'Hotdog', 'Magnet', 'Gate', 'Bridge', 'Peaceful', 'Chess', 'Burger'];
    if (typeof filterDisplayedModes === 'function') return filterDisplayedModes(all);
    return all;
}

function getMasteryModesForFilter() {
    var all = getMasteryAllModeNames();
    if (statsListGamemode === 'High score modes only') {
        return all.filter(function (m) { return isStatsHighscoreMode(m); });
    }
    if (statsListGamemode === 'Excluding Peaceful') {
        return all.filter(function (m) { return m !== 'Peaceful'; });
    }
    if (statsListGamemode === 'All') {
        return all.slice();
    }
    return all.indexOf(statsListGamemode) !== -1 ? [statsListGamemode] : [];
}

function summarizeMasteryRows(rows) {
    var bySpeed = { Normal: 0, Fast: 0, Slow: 0 };
    var bySize = { Standard: 0, Small: 0, Large: 0 };
    (rows || []).forEach(function (row) {
        var p = parseCategoryKey(row.category);
        if (!p) return;
        if (bySpeed[p.speed] != null) bySpeed[p.speed]++;
        if (bySize[p.size] != null) bySize[p.size]++;
    });
    return { bySpeed: bySpeed, bySize: bySize, total: (rows || []).length };
}

function countMasteryFilterUniverse() {
    var apples = statsListApple === 'All'
        ? ((masteryChallengeData && masteryChallengeData.meta && masteryChallengeData.meta.appleAmounts) ||
            ['1 Apple', '3 Apples', '5 Apples', '10 Apples', 'Dice', 'Bomb', 'Tally'])
        : [statsListApple];
    var speeds = statsListSpeed === 'All'
        ? ((masteryChallengeData && masteryChallengeData.meta && masteryChallengeData.meta.speeds) ||
            ['Normal', 'Fast', 'Slow'])
        : [statsListSpeed];
    var sizes = statsListSize === 'All'
        ? ((masteryChallengeData && masteryChallengeData.meta && masteryChallengeData.meta.sizes) ||
            ['Standard', 'Small', 'Large'])
        : [statsListSize];
    var modes = getMasteryModesForFilter();
    if (statsListRunMode !== 'All' && statsListRunMode !== 'All Apples' && statsListRunMode !== 'Timed') {
        return 0;
    }
    return apples.length * speeds.length * sizes.length * modes.length;
}

function buildFilteredMasteryLeaderboard() {
    var byPlayer = (masteryChallengeData && masteryChallengeData.byPlayer) || {};
    var rows = [];
    Object.keys(byPlayer).forEach(function (playerId) {
        var entry = byPlayer[playerId];
        var completed = (entry.completed || []).map(function (item) {
            if (typeof item === 'string') return { category: item };
            return item;
        });
        var matched = filterRowsByListFilters(completed);
        if (!matched.length) return;
        var metrics = summarizeMasteryRows(matched);
        rows.push({
            playerId: playerId,
            playerName: entry.playerName,
            total: matched.length,
            bySpeed: metrics.bySpeed,
            bySize: metrics.bySize
        });
    });
    rows.sort(function (a, b) {
        return b.total - a.total || String(a.playerName).localeCompare(String(b.playerName));
    });
    return rows;
}

function getMasteryAppleFilterOptions() {
    return statsListApple === 'All'
        ? ((masteryChallengeData && masteryChallengeData.meta && masteryChallengeData.meta.appleAmounts) ||
            ['1 Apple', '3 Apples', '5 Apples', '10 Apples', 'Dice', 'Bomb', 'Tally'])
        : [statsListApple];
}

function buildCommunityMasteryRow() {
    var byPlayer = (masteryChallengeData && masteryChallengeData.byPlayer) || {};
    var seen = {};
    Object.keys(byPlayer).forEach(function (playerId) {
        var completed = (byPlayer[playerId].completed || []).map(function (item) {
            if (typeof item === 'string') return { category: item };
            return item;
        });
        filterRowsByListFilters(completed).forEach(function (row) {
            if (row.category) seen[row.category] = true;
        });
    });
    var unionRows = Object.keys(seen).map(function (category) {
        return { category: category };
    });
    var metrics = summarizeMasteryRows(unionRows);
    return {
        playerId: null,
        playerName: 'Community Mastery',
        community: true,
        total: unionRows.length,
        bySpeed: metrics.bySpeed,
        bySize: metrics.bySize,
        categories: seen
    };
}

function countInhumanMasteryUniverse() {
    var list = (masteryChallengeData && masteryChallengeData.meta && masteryChallengeData.meta.inhumanBoards) || [];
    return list.filter(function (category) {
        return rowMatchesListFilters({ category: category });
    }).length;
}

function countCommunityInhumanMastery(categorySet) {
    var list = (masteryChallengeData && masteryChallengeData.meta && masteryChallengeData.meta.inhumanBoards) || [];
    var n = 0;
    list.forEach(function (category) {
        if (categorySet && categorySet[category]) n++;
    });
    return n;
}

function renderMasteryView(body) {
    if (!masteryChallengeData) {
        var empty = document.createElement('div');
        empty.className = 'stats-explorer-empty';
        empty.textContent = 'Mastery data not available yet. Run node scripts/mastery-challenge-fetcher.js (range or full backfill).';
        body.appendChild(empty);
        return;
    }

    appendListFilters(body);

    var boardCount = countMasteryFilterUniverse();
    var community = buildCommunityMasteryRow();
    var inhumanMax = countInhumanMasteryUniverse();
    var inhumanHave = countCommunityInhumanMastery(community.categories);
    var rows = buildFilteredMasteryLeaderboard();

    var meta = document.createElement('div');
    meta.className = 'stats-explorer-meta';
    meta.textContent = 'All Apples completions · ' + rows.length + ' players · max ' + boardCount +
        ' for current filters · Inhuman: ' + inhumanHave + ' / ' + inhumanMax;
    body.appendChild(meta);

    if (!rows.length && !community.total) {
        var none = document.createElement('div');
        none.className = 'stats-explorer-empty';
        none.textContent = 'No mastery completions match these filters.';
        body.appendChild(none);
        return;
    }

    var table = document.createElement('table');
    table.className = 'stats-explorer-table';
    var thead = document.createElement('thead');
    var hr = document.createElement('tr');
    ['#', 'Player', 'Total', 'Normal', 'Fast', 'Slow', 'Std', 'Small', 'Large'].forEach(function (h) {
        var th = document.createElement('th');
        th.textContent = h;
        hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = document.createElement('tbody');

    function appendMasteryLeaderRow(row, rankLabel) {
        var tr = document.createElement('tr');
        if (row.community) tr.className = 'stats-mastery-community-row';
        var rankTd = document.createElement('td');
        rankTd.textContent = rankLabel;
        tr.appendChild(rankTd);

        var nameTd = document.createElement('td');
        if (row.community) {
            nameTd.textContent = row.playerName;
            nameTd.className = 'stats-mastery-community-name';
        } else {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'stats-run-link stats-mastery-player-link';
            btn.textContent = row.playerName || '—';
            btn.addEventListener('click', function () {
                openMasteryPlayer(row.playerId, row.playerName);
            });
            nameTd.appendChild(btn);
        }
        tr.appendChild(nameTd);

        var bs = row.bySpeed || {};
        var bz = row.bySize || {};
        var totalTd = document.createElement('td');
        totalTd.textContent = String(row.total) + ' / ' + boardCount;
        tr.appendChild(totalTd);
        ['Normal', 'Fast', 'Slow'].forEach(function (key) {
            var td = document.createElement('td');
            td.textContent = String(bs[key] || 0);
            tr.appendChild(td);
        });
        ['Standard', 'Small', 'Large'].forEach(function (key) {
            var td = document.createElement('td');
            td.textContent = String(bz[key] || 0);
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    }

    appendMasteryLeaderRow(community, '0');
    rows.forEach(function (row, idx) {
        appendMasteryLeaderRow(row, String(idx + 1));
    });
    table.appendChild(tbody);
    var scroll = document.createElement('div');
    scroll.className = 'stats-table-scroll';
    scroll.appendChild(table);
    body.appendChild(scroll);
}

function getCareerMetrics(row) {
    if (!row) {
        return { wrDays: 0, bestAll: null, bestStanding: null };
    }
    if (statsExplorerLongevityTiedMode === 'untied') {
        return {
            wrDays: row.wrDaysUntied || 0,
            bestAll: row.bestAllUntied || null,
            bestStanding: row.bestStandingUntied || null
        };
    }
    if (statsExplorerLongevityTiedMode === 'tied') {
        return {
            wrDays: row.wrDaysTied || 0,
            bestAll: row.bestAllTied || null,
            bestStanding: row.bestStandingTied || null
        };
    }
    return {
        wrDays: row.wrDays || 0,
        bestAll: row.bestAll || null,
        bestStanding: row.bestStanding || null
    };
}

function formatCategoryPartHtml(map, value) {
    if (!value || value === '-') return escapeHtml(value || '—');
    var useIcons = typeof getCategoryUseIcons === 'function' ? getCategoryUseIcons() : true;
    var setting = map && map[value];
    if (useIcons && setting && setting.icon) {
        return '<img class="stats-cat-icon" src="' + escapeAttr(setting.icon) +
            '" alt="' + escapeAttr(value) + '" title="' + escapeAttr(value) + '">';
    }
    return escapeHtml(value);
}

function formatCategoryInlineHtml(parsed) {
    if (!parsed) return '—';
    if (typeof parsed === 'string') {
        parsed = parseCategoryKey(parsed);
        if (!parsed) return '—';
    }
    var parts = [
        formatCategoryPartHtml(typeof gamemodes !== 'undefined' ? gamemodes : null, parsed.gamemode),
        formatCategoryPartHtml(typeof appleAmounts !== 'undefined' ? appleAmounts : null, parsed.apple),
        formatCategoryPartHtml(typeof speeds !== 'undefined' ? speeds : null, parsed.speed),
        formatCategoryPartHtml(typeof sizes !== 'undefined' ? sizes : null, parsed.size),
        escapeHtml(parsed.runMode || '')
    ].filter(function (p) { return p && p !== ''; });
    return parts.join('<span class="stats-cat-sep">·</span>');
}

function formatCategoryFiveCellsHtml(parsed) {
    return '<td class="stats-cat-cell">' +
        formatCategoryPartHtml(typeof gamemodes !== 'undefined' ? gamemodes : null, parsed.gamemode) + '</td>' +
        '<td class="stats-cat-cell">' +
        formatCategoryPartHtml(typeof appleAmounts !== 'undefined' ? appleAmounts : null, parsed.apple) + '</td>' +
        '<td class="stats-cat-cell">' +
        formatCategoryPartHtml(typeof speeds !== 'undefined' ? speeds : null, parsed.speed) + '</td>' +
        '<td class="stats-cat-cell">' +
        formatCategoryPartHtml(typeof sizes !== 'undefined' ? sizes : null, parsed.size) + '</td>' +
        '<td>' + escapeHtml(parsed.runMode || '—') + '</td>';
}

function formatCareerHoldCell(hold) {
    if (!hold) return '—';
    var parsed = parseCategoryKey(hold.category);
    var labelHtml = parsed
        ? formatCategoryInlineHtml(parsed)
        : escapeHtml(hold.category || '—');
    var range = hold.stillStanding
        ? (hold.start || '?') + ' → present'
        : (hold.start || '?') + ' → ' + (hold.end || '?');
    var isHS = parsed && parsed.runMode === 'High Score';
    var timeText = formatPrimaryDisplay(hold.time, isHS);
    var timeHtml = hold.weblink
        ? '<a class="stats-run-link" href="' + escapeAttr(hold.weblink) +
            '" target="_blank" rel="noopener noreferrer">' + escapeHtml(timeText) + '</a>'
        : escapeHtml(timeText);
    return '<div class="stats-career-hold">' +
        '<div class="stats-career-hold-cats"><strong>' + escapeHtml(String(hold.days)) + 'd</strong>' +
        '<span class="stats-cat-sep">·</span>' + labelHtml + '</div>' +
        '<div class="stats-career-hold-meta">' + escapeHtml(range) + ' · ' + timeHtml + '</div>' +
        '</div>';
}

function renderCareerView(body) {
    appendLongevityTiedChips(body, 'career');

    var rows = (statsExplorerData.career || []).map(function (row) {
        var m = getCareerMetrics(row);
        return {
            playerId: row.playerId,
            playerName: row.playerName,
            wrDays: m.wrDays,
            bestAll: m.bestAll,
            bestStanding: m.bestStanding
        };
    }).filter(function (r) {
        return r.wrDays > 0 || r.bestAll || r.bestStanding;
    }).sort(function (a, b) {
        return b.wrDays - a.wrDays || String(a.playerName).localeCompare(String(b.playerName));
    });

    var meta = document.createElement('div');
    meta.className = 'stats-explorer-meta';
    var shown = Math.min(rows.length, STATS_LIST_DISPLAY_LIMIT);
    meta.textContent = shown + ' shown' +
        (rows.length > STATS_LIST_DISPLAY_LIMIT ? ' · ' + rows.length + ' players' : '') +
        ' · career WR-days (1 per day per WR held) · best longevity included';
    body.appendChild(meta);

    if (!rows.length) {
        var empty = document.createElement('div');
        empty.className = 'stats-explorer-empty';
        empty.textContent = 'No career data for this tied filter.';
        body.appendChild(empty);
        return;
    }

    var table = document.createElement('table');
    table.className = 'stats-explorer-table';
    var thead = document.createElement('thead');
    var hr = document.createElement('tr');
    ['#', 'Player', 'WR-days', 'Best all-time', 'Best still standing'].forEach(function (h) {
        var th = document.createElement('th');
        th.textContent = h;
        hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    rows.slice(0, STATS_LIST_DISPLAY_LIMIT).forEach(function (row, idx) {
        var tr = document.createElement('tr');
        tr.innerHTML =
            '<td>' + (idx + 1) + '</td>' +
            '<td>' + escapeHtml(row.playerName || '—') + '</td>' +
            '<td>' + row.wrDays + '</td>' +
            '<td>' + formatCareerHoldCell(row.bestAll) + '</td>' +
            '<td>' + formatCareerHoldCell(row.bestStanding) + '</td>';
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    var scroll = document.createElement('div');
    scroll.className = 'stats-table-scroll';
    scroll.appendChild(table);
    body.appendChild(scroll);
}

function getMasteryBoardCount() {
    return (masteryChallengeData && masteryChallengeData.meta && masteryChallengeData.meta.boardCount) || 1386;
}

function getMasteryPlayerEntry(playerId) {
    if (!masteryChallengeData || !playerId) return null;
    var by = masteryChallengeData.byPlayer || {};
    return by[playerId] || null;
}

function openMasteryPlayer(playerId, playerName) {
    selectStatsExplorerPlayer({ id: playerId, name: playerName || playerId });
    statsExplorerPlayerShowMeme = false;
    statsExplorerPlayerHoldMode = 'mastery';
    statsExplorerPlayerTiedMode = 'all';
    statsExplorerActiveTab = 'player';
    var wrap = document.querySelector('.stats-explorer-wrapper');
    if (wrap) {
        Array.prototype.forEach.call(wrap.querySelectorAll('.stats-explorer-tab'), function (el) {
            el.classList.toggle('active', el.dataset.tab === 'player');
        });
    }
    var mobileTabs = document.getElementById('mobileStatsTabs');
    if (mobileTabs) {
        Array.prototype.forEach.call(mobileTabs.querySelectorAll('.stats-explorer-tab'), function (el) {
            el.classList.toggle('active', el.dataset.tab === 'player');
        });
    }
    var body = document.getElementById('statsExplorerBody') ||
        document.getElementById('mobileStatsExplorerBody');
    renderStatisticsExplorerContent(body);
}

function renderFilteredListTab(body, allRows, kind, sortHint) {
    appendListFilters(body);
    var filtered = filterRowsByListFilters(allRows);
    var meta = document.createElement('div');
    meta.className = 'stats-explorer-meta';
    var shown = Math.min(filtered.length, STATS_LIST_DISPLAY_LIMIT);
    meta.textContent = shown + ' shown' +
        (filtered.length > STATS_LIST_DISPLAY_LIMIT ? ' · ' + filtered.length + ' match' : '') +
        (filtered.length !== allRows.length ? ' · ' + allRows.length + ' total' : '') +
        (sortHint ? ' · ' + sortHint : '');
    body.appendChild(meta);
    renderListView(body, filtered, kind);
}

function appendPopularityTiedChips(body) {
    var bar = document.createElement('div');
    bar.className = 'stats-explorer-chips stats-longevity-chips';
    [
        { id: 'all', label: 'Both' },
        { id: 'untied', label: 'Untied' },
        { id: 'tied', label: 'Tied' }
    ].forEach(function (opt) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'stats-explorer-chip' + (opt.id === statsExplorerPopularityTiedMode ? ' active' : '');
        chip.textContent = opt.label;
        chip.addEventListener('click', function () {
            statsExplorerPopularityTiedMode = opt.id;
            renderStatisticsExplorerContent(body);
        });
        bar.appendChild(chip);
    });
    body.appendChild(bar);
}

function filterPopularityByTiedMode(rows) {
    if (!rows || !rows.length) return [];
    if (statsExplorerPopularityTiedMode === 'untied') {
        return rows.filter(function (r) { return (r.tiedHolders || 0) === 1; });
    }
    if (statsExplorerPopularityTiedMode === 'tied') {
        return rows.filter(function (r) { return (r.tiedHolders || 0) > 1; });
    }
    return rows;
}

function renderPopularityView(body) {
    appendPopularityTiedChips(body);
    appendListFilters(body);
    var allRows = filterPopularityByTiedMode(statsExplorerData.popularity || []);
    var filtered = filterRowsByListFilters(allRows);
    var meta = document.createElement('div');
    meta.className = 'stats-explorer-meta';
    var shown = Math.min(filtered.length, STATS_LIST_DISPLAY_LIMIT);
    var tiedHint = statsExplorerPopularityTiedMode === 'untied'
        ? 'untied present WRs'
        : (statsExplorerPopularityTiedMode === 'tied' ? 'tied present WRs' : 'most holders first');
    meta.textContent = shown + ' shown' +
        (filtered.length > STATS_LIST_DISPLAY_LIMIT ? ' · ' + filtered.length + ' match' : '') +
        (filtered.length !== allRows.length ? ' · ' + allRows.length + ' total' : '') +
        ' · ' + tiedHint;
    body.appendChild(meta);
    renderListView(body, filtered, 'popularity');
}

function renderListView(body, rows, kind, showAll) {
    if (!rows.length) {
        var empty = document.createElement('div');
        empty.className = 'stats-explorer-empty';
        empty.textContent = kind === 'longevity' && statsExplorerLongevityMode === 'standing'
            ? 'No still-standing records match these filters.'
            : (kind === 'longevity' || kind === 'contested' || kind === 'stale' || kind === 'popularity' || kind === 'unheld' || kind === 'mastery')
                ? 'No categories match these filters.'
                : 'No data available.';
        body.appendChild(empty);
        return;
    }
    var table = document.createElement('table');
    table.className = 'stats-explorer-table';
    var thead = document.createElement('thead');
    var hr = document.createElement('tr');
    var headers = kind === 'player'
        ? ['Mode', 'Count', 'Speed', 'Size', 'Run', 'Time', 'Days', 'Range']
        : kind === 'longevity'
        ? ['Player', 'Mode', 'Count', 'Speed', 'Size', 'Run', 'Time', 'Days', 'Range']
        : kind === 'stale'
            ? ['Mode', 'Count', 'Speed', 'Size', 'Run', 'Days', 'Flips', 'Holders']
            : kind === 'contested'
                ? ['Mode', 'Count', 'Speed', 'Size', 'Run', 'Flips', 'Holders']
                : kind === 'unheld'
                    ? ['Mode', 'Count', 'Speed', 'Size', 'Run', 'Tier']
                    : kind === 'mastery'
                        ? ['Mode', 'Count', 'Speed', 'Size', 'Run', 'Time']
                        : kind === 'legends'
                            ? ['Player', 'Mode', 'Count', 'Speed', 'Size', 'Run', 'Time', 'Score', 'Days', 'Range', 'Type']
                            : ['Mode', 'Count', 'Speed', 'Size', 'Run', 'Holders', 'Days'];
    headers.forEach(function (h) {
        var th = document.createElement('th');
        th.textContent = h;
        hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    var displayRows = showAll ? rows : rows.slice(0, STATS_LIST_DISPLAY_LIMIT);
    displayRows.forEach(function (row) {
        var parsed = parseCategoryKey(row.category) || {
            gamemode: row.category || '-',
            apple: '-',
            speed: '-',
            size: '-',
            runMode: '-'
        };
        var tr = document.createElement('tr');
        tr.title = row.category || '';
        if (kind === 'player') {
            var playerRange = row.stillStanding
                ? row.start + ' → present'
                : row.start + ' → ' + row.end;
            tr.innerHTML =
                formatCategoryFiveCellsHtml(parsed) +
                '<td>' + formatHoldTimeCell(row, parsed) + '</td>' +
                '<td>' + row.days + '</td>' +
                '<td>' + escapeHtml(playerRange) + '</td>';
        } else if (kind === 'longevity') {
            var range = row.stillStanding
                ? row.start + ' → present'
                : row.start + ' → ' + row.end;
            tr.innerHTML =
                '<td>' + escapeHtml(row.playerName) + '</td>' +
                formatCategoryFiveCellsHtml(parsed) +
                '<td>' + formatHoldTimeCell(row, parsed) + '</td>' +
                '<td>' + row.days + '</td>' +
                '<td>' + escapeHtml(range) + '</td>';
        } else if (kind === 'stale') {
            tr.innerHTML =
                formatCategoryFiveCellsHtml(parsed) +
                '<td>' + (row.holdDays != null ? row.holdDays : row.daysWithRecord) + '</td>' +
                '<td>' + row.flips + '</td>' +
                '<td>' + row.uniqueHolders + '</td>';
        } else if (kind === 'contested') {
            tr.innerHTML =
                formatCategoryFiveCellsHtml(parsed) +
                '<td>' + row.flips + '</td>' +
                '<td>' + row.uniqueHolders + '</td>';
        } else if (kind === 'unheld') {
            tr.innerHTML =
                formatCategoryFiveCellsHtml(parsed) +
                '<td>' + escapeHtml(row.tier || '') + '</td>';
        } else if (kind === 'mastery') {
            tr.innerHTML =
                formatCategoryFiveCellsHtml(parsed) +
                '<td>' + formatHoldTimeCell({ time: row.time, weblink: row.weblink }, parsed) + '</td>';
        } else if (kind === 'legends') {
            var legRange = row.stillStanding
                ? row.start + ' → present'
                : row.start + ' → ' + row.end;
            tr.innerHTML =
                '<td>' + escapeHtml(row.playerName || '—') + '</td>' +
                formatCategoryFiveCellsHtml(parsed) +
                '<td>' + formatHoldTimeCell(row, parsed) + '</td>' +
                '<td>' + (row.score != null ? row.score : '—') + '</td>' +
                '<td>' + row.days + '</td>' +
                '<td>' + escapeHtml(legRange) + '</td>' +
                '<td>' + escapeHtml(row.legendType || '—') + '</td>';
        } else {
            tr.innerHTML =
                formatCategoryFiveCellsHtml(parsed) +
                '<td>' + row.uniqueHolders + '</td>' +
                '<td>' + row.daysWithRecord + '</td>';
        }
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    var scroll = document.createElement('div');
    scroll.className = 'stats-table-scroll';
    scroll.appendChild(table);
    body.appendChild(scroll);
}

function tagLegendRows(rows, typeLabel) {
    return (rows || []).map(function (r) {
        return Object.assign({}, r, { legendType: typeLabel });
    });
}

function getLegendsFilterRows() {
    var legends = tagLegendRows(statsExplorerData.legends || [], 'Legend');
    var unicorns = tagLegendRows(statsExplorerData.unicorns || [], 'Unicorn');
    if (statsExplorerLegendsFilter === 'legends') return legends;
    if (statsExplorerLegendsFilter === 'unicorns') return unicorns;
    return legends.concat(unicorns).sort(function (a, b) {
        var scoreDiff = (b.score || 0) - (a.score || 0);
        if (scoreDiff) return scoreDiff;
        if (a.stillStanding !== b.stillStanding) return a.stillStanding ? -1 : 1;
        return (b.days || 0) - (a.days || 0) || String(a.start || '').localeCompare(String(b.start || ''));
    });
}

function renderLegendsView(body) {
    var filters = document.createElement('div');
    filters.className = 'stats-explorer-filters';
    filters.appendChild(createStatsSelect('Show', statsExplorerLegendsFilter, [
        { value: 'all', label: 'All' },
        { value: 'legends', label: 'Legends' },
        { value: 'unicorns', label: 'Unicorns' }
    ], function (v) {
        statsExplorerLegendsFilter = v;
        renderStatisticsExplorerContent(body);
    }, true));
    body.appendChild(filters);

    var rows = getLegendsFilterRows();
    var standing = rows.filter(function (r) { return r.stillStanding; }).length;
    var meta = document.createElement('div');
    meta.className = 'stats-explorer-meta';
    var hint = statsExplorerLegendsFilter === 'unicorns'
        ? 'Lottery · present first'
        : statsExplorerLegendsFilter === 'legends'
            ? 'Mythic · hardest first'
            : 'Mythic + Lottery · hardest first';
    meta.textContent = rows.length + ' holds · ' + standing + ' still standing · ' + hint;
    body.appendChild(meta);
    renderListView(body, rows, 'legends', true);
}

function renderUnheldView(body) {
    var payload = statsExplorerData.unheld || {};
    var tiers = payload.tiers || ['Free', 'Warmup', 'Easy', 'Medium', 'Hard', 'Mythic', 'Lottery', 'Inhuman'];
    var allRows = payload.rows || [];

    appendListFilters(body);

    var bar = document.createElement('div');
    bar.className = 'stats-explorer-chips';
    ['All'].concat(tiers).forEach(function (t) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'stats-explorer-chip' + (t === statsExplorerUnheldTier ? ' active' : '');
        chip.textContent = t;
        chip.addEventListener('click', function () {
            statsExplorerUnheldTier = t;
            renderStatisticsExplorerContent(body);
        });
        bar.appendChild(chip);
    });
    body.appendChild(bar);

    if (statsExplorerUnheldTier === 'Free') {
        var memeWrap = document.createElement('div');
        memeWrap.className = 'stats-unheld-free-meme';
        var meme = document.createElement('img');
        meme.src = 'assets/unheld_free.gif';
        meme.alt = 'google snake speedrunners when a random category isn\'t absolutely free';
        memeWrap.appendChild(meme);
        body.appendChild(memeWrap);
    }

    if (statsExplorerUnheldTier === 'Inhuman' && Math.random() < 1 / 25) {
        var inhumanMemeWrap = document.createElement('div');
        inhumanMemeWrap.className = 'stats-unheld-free-meme';
        var inhumanMeme = document.createElement('img');
        inhumanMeme.src = 'assets/unheld_inhuman.gif';
        inhumanMeme.alt = 'Yeah I think someone will get wall all mainboard eventually';
        inhumanMemeWrap.appendChild(inhumanMeme);
        body.appendChild(inhumanMemeWrap);
    }

    var rows = filterRowsByListFilters(allRows);
    if (statsExplorerUnheldTier !== 'All') {
        rows = rows.filter(function (r) { return r.tier === statsExplorerUnheldTier; });
    }

    var meta = document.createElement('div');
    meta.className = 'stats-explorer-meta';
    meta.textContent = rows.length + ' shown' +
        (payload.total != null ? ' · ' + payload.total + ' unheld total' : '') +
        ' · easiest first';
    body.appendChild(meta);

    if (!rows.length) {
        var empty = document.createElement('div');
        empty.className = 'stats-explorer-empty';
        empty.textContent = 'No unheld categories for this filter.';
        body.appendChild(empty);
        return;
    }

    renderListView(body, rows.map(function (r) {
        return {
            category: r.category,
            tier: r.tier,
            score: r.score,
            uniqueHolders: 0,
            daysWithRecord: 0
        };
    }), 'unheld', true);
}

function renderImprovingView(body) {
    var windows = ['7d', '30d', '90d', '365d'];
    var bar = document.createElement('div');
    bar.className = 'stats-explorer-chips';
    windows.forEach(function (w) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'stats-explorer-chip' + (w === statsExplorerImproveWindow ? ' active' : '');
        chip.textContent = w;
        chip.addEventListener('click', function () {
            statsExplorerImproveWindow = w;
            renderStatisticsExplorerContent(body);
        });
        bar.appendChild(chip);
    });
    body.appendChild(bar);

    var rows = (statsExplorerData.improving && statsExplorerData.improving[statsExplorerImproveWindow]) || [];
    if (!rows.length) {
        var empty = document.createElement('div');
        empty.className = 'stats-explorer-empty';
        empty.textContent = 'No improving players for this window.';
        body.appendChild(empty);
        return;
    }

    var maxDelta = rows[0].delta || 1;
    var list = document.createElement('div');
    list.className = 'stats-explorer-bars';
    rows.forEach(function (row, idx) {
        var item = document.createElement('div');
        item.className = 'stats-bar-row';
        item.innerHTML = '<span class="stats-bar-rank">' + (idx + 1) + '</span>' +
            '<span class="stats-bar-name">' + escapeHtml(row.playerName) + '</span>' +
            '<span class="stats-bar-track"><span class="stats-bar-fill" style="width:' +
            Math.max(4, (row.delta / maxDelta) * 100) + '%"></span></span>' +
            '<span class="stats-bar-delta">+' + row.delta + '</span>';
        list.appendChild(item);
    });
    body.appendChild(list);
}

function renderHeatmapView(body) {
    var days = statsExplorerData.activityHeatmap || [];
    var byYear = {};
    days.forEach(function (d) {
        var y = d.date.slice(0, 4);
        if (!byYear[y]) byYear[y] = [];
        byYear[y].push(d);
    });
    var years = Object.keys(byYear).sort();
    if (!years.length) {
        body.innerHTML = '<div class="stats-explorer-empty">No heatmap data.</div>';
        return;
    }
    if (!statsExplorerHeatYear || years.indexOf(statsExplorerHeatYear) === -1) {
        statsExplorerHeatYear = years[years.length - 1];
    }

    var controls = document.createElement('div');
    controls.className = 'stats-explorer-filters stats-heatmap-controls';
    controls.appendChild(createStatsSelect('Year', statsExplorerHeatYear, years, function (v) {
        statsExplorerHeatYear = v;
        renderStatisticsExplorerContent(body);
    }, true));

    var metricWrap = document.createElement('div');
    metricWrap.className = 'stats-explorer-select-wrap stats-heatmap-metric-wrap';
    var metricLab = document.createElement('span');
    metricLab.className = 'stats-explorer-select-label';
    metricLab.textContent = 'Metric';
    metricWrap.appendChild(metricLab);
    var metricChips = document.createElement('div');
    metricChips.className = 'stats-explorer-chips stats-heatmap-metric-chips';
    ['flips', 'newWrs'].forEach(function (m) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'stats-explorer-chip stats-heatmap-metric-chip' +
            (m === statsExplorerHeatMetric ? ' active' : '');
        chip.textContent = m === 'flips' ? 'WR flips' : 'New WRs';
        chip.addEventListener('click', function () {
            statsExplorerHeatMetric = m;
            renderStatisticsExplorerContent(body);
        });
        metricChips.appendChild(chip);
    });
    metricWrap.appendChild(metricChips);
    controls.appendChild(metricWrap);
    body.appendChild(controls);

    var detail = document.createElement('div');
    detail.className = 'stats-heatmap-detail';
    detail.textContent = 'Click a day for details.';
    body.appendChild(detail);

    var yearDays = byYear[statsExplorerHeatYear] || [];
    var maxVal = 1;
    yearDays.forEach(function (d) {
        var v = d[statsExplorerHeatMetric] || 0;
        if (v > maxVal) maxVal = v;
    });

    var heatWrap = document.createElement('div');
    heatWrap.className = 'stats-heatmap-wrap';
    var row = document.createElement('div');
    row.className = 'stats-heatmap-year';
    var label = document.createElement('div');
    label.className = 'stats-heatmap-year-label';
    label.textContent = statsExplorerHeatYear;
    row.appendChild(label);
    var grid = document.createElement('div');
    grid.className = 'stats-heatmap-grid';
    yearDays.forEach(function (d) {
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'stats-heatmap-cell';
        var v = d[statsExplorerHeatMetric] || 0;
        var intensity = maxVal ? v / maxVal : 0;
        var isLight = !document.body.classList.contains('dark-mode');
        if (isLight) {
            // Stronger opaque greens so cells stay distinct on frosted glass
            var lightAlpha = 0.28 + intensity * 0.72;
            cell.style.backgroundColor = 'rgba(40, 92, 18, ' + lightAlpha + ')';
        } else {
            cell.style.backgroundColor = 'rgba(87, 138, 52, ' + (0.12 + intensity * 0.88) + ')';
        }
        cell.title = d.date + ': flips ' + d.flips + ', new WRs ' + d.newWrs;
        cell.addEventListener('click', function () {
            detail.textContent = d.date + ' — flips: ' + d.flips + ', new WRs: ' + d.newWrs;
        });
        grid.appendChild(cell);
    });
    row.appendChild(grid);
    heatWrap.appendChild(row);
    body.appendChild(heatWrap);

    if (statsExplorerData.meta) {
        var meta = document.createElement('div');
        meta.className = 'stats-explorer-meta';
        meta.textContent = 'Showing ' + statsExplorerHeatYear + ' · full data through ' +
            (statsExplorerData.meta.dateRange && statsExplorerData.meta.dateRange.latest) +
            ' · updated ' + (statsExplorerData.meta.lastUpdated || '').slice(0, 10);
        body.appendChild(meta);
    }
}

function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, '&#39;');
}

function refreshStatisticsExplorer() {
    if (!document.querySelector('.stats-explorer-wrapper')) {
        ensureStatisticsExplorer();
        return;
    }
    renderStatisticsExplorerContent();
}

window.ensureStatisticsExplorer = ensureStatisticsExplorer;
window.refreshStatisticsExplorer = refreshStatisticsExplorer;
window.applyStatsExplorerCollapseState = applyStatsExplorerCollapseState;
window.syncRightPanelsSideBySide = syncRightPanelsSideBySide;
window.renderStatisticsExplorerContent = renderStatisticsExplorerContent;
window.loadStatisticsExplorerData = loadStatisticsExplorerData;
window.loadMasteryChallengeData = loadMasteryChallengeData;
window.loadChronicleData = loadChronicleData;
window.STATS_TABS = STATS_TABS;
window.formatCategoryPartHtml = formatCategoryPartHtml;
window.formatCategoryInlineHtml = formatCategoryInlineHtml;
window.formatCategoryFiveCellsHtml = formatCategoryFiveCellsHtml;

if (typeof window !== 'undefined' && !window.__statsRightPanelsResizeBound) {
    window.__statsRightPanelsResizeBound = true;
    window.addEventListener('resize', function () {
        if (typeof syncRightPanelsSideBySide === 'function') syncRightPanelsSideBySide();
    });
}
