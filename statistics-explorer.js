// Statistics Explorer — collapsible right panel + analytics views
// Data: time-travel-cache/metadata/statistics-explorer.json (precomputed)

var statsExplorerData = null;
var statsExplorerLoading = false;
var statsExplorerActiveTab = 'progression';
var statsExplorerImproveWindow = '30d';
var statsExplorerHeatMetric = 'flips';
var statsExplorerHeatYear = null; // set from data
var statsExplorerLongevityMode = 'standing'; // 'all' | 'standing'
var statsExplorerLongevityHideHs = false; // when true, exclude High Score holds
var statsExplorerUnheldTier = 'All'; // 'All' | Free…Inhuman
// Independent progression filters (not Category Settings)
var statsProgApple = '1 Apple';
var statsProgSpeed = 'Normal';
var statsProgSize = 'Standard';
var statsProgGamemode = 'Classic';
var statsProgRunMode = '25 Apples';

var STATS_HIGHSCORE_MODES = ['Wall', 'Portal', 'Key', 'Sokoban', 'Poison', 'Minesweeper', 'Statue', 'Shield', 'Hotdog', 'Gate', 'Bridge'];

var STATS_TABS = [
    { id: 'progression', label: 'Progression' },
    { id: 'longevity', label: 'Longevity' },
    { id: 'improving', label: 'Improving' },
    { id: 'contested', label: 'Contested' },
    { id: 'stale', label: 'Stale' },
    { id: 'popularity', label: 'Popularity' },
    { id: 'unicorns', label: 'Unicorns' },
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
    var names = typeof gamemodes !== 'undefined' ? Object.keys(gamemodes) : [];
    if (statsProgRunMode === 'High Score') {
        return names.filter(function (n) { return STATS_HIGHSCORE_MODES.indexOf(n) !== -1; });
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
        o.value = opt;
        o.textContent = opt;
        if (opt === value) o.selected = true;
        sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
        onChange(sel.value);
    });
    wrap.appendChild(sel);
    return wrap;
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
    if (statsExplorerData || statsExplorerLoading) return statsExplorerData;
    statsExplorerLoading = true;
    try {
        var localRes = await fetch('time-travel-cache/metadata/statistics-explorer.json');
        if (localRes.ok) {
            statsExplorerData = await localRes.json();
            return statsExplorerData;
        }
    } catch (e) { /* try remote */ }
    try {
        var base = (window.githubCacheFetcher && window.githubCacheFetcher.baseURL) ||
            'https://raw.githubusercontent.com/DarkSnakeGang/FastSnakeStats/refs/heads/main';
        var remoteRes = await fetch(base + '/time-travel-cache/metadata/statistics-explorer.json');
        if (remoteRes.ok) {
            statsExplorerData = await remoteRes.json();
            return statsExplorerData;
        }
    } catch (e2) {
        console.error('Failed to load statistics explorer data', e2);
    } finally {
        statsExplorerLoading = false;
    }
    return null;
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
        case 'improving':
            renderImprovingView(body);
            break;
        case 'contested':
            renderListView(body, statsExplorerData.contested || [], 'contested');
            break;
        case 'stale':
            renderListView(body, statsExplorerData.stale || [], 'stale');
            break;
        case 'popularity':
            renderListView(body, statsExplorerData.popularity || [], 'popularity');
            break;
        case 'unicorns':
            renderUnicornsView(body);
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

function renderProgressionView(body) {
    normalizeProgressionFilters();

    var appleOpts = typeof appleAmounts !== 'undefined' ? Object.keys(appleAmounts) : ['1 Apple', '3 Apples', '5 Apples', '10 Apples', 'Dice', 'Bomb'];
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

    function xAt(i) {
        if (points.length === 1) return padL + (w - padL - padR) / 2;
        return padL + (i / (points.length - 1)) * (w - padL - padR);
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

    wrap.appendChild(svg);
    wrap.appendChild(tip);
    return wrap;
}

function getLongevityRows() {
    var raw = statsExplorerData && statsExplorerData.longevity;
    if (!raw) return [];
    // New shape: { all, standing, allTimed, standingTimed }; legacy: flat array
    if (Array.isArray(raw)) {
        var legacy = raw;
        if (statsExplorerLongevityMode === 'standing') {
            legacy = legacy.filter(function (r) { return r.stillStanding; });
        }
        if (statsExplorerLongevityHideHs) {
            legacy = legacy.filter(function (r) {
                var p = parseCategoryKey(r.category);
                return !p || p.runMode !== 'High Score';
            });
        }
        return legacy;
    }
    if (statsExplorerLongevityHideHs) {
        if (statsExplorerLongevityMode === 'standing') {
            return raw.standingTimed || (raw.standing || []).filter(function (r) {
                var p = parseCategoryKey(r.category);
                return !p || p.runMode !== 'High Score';
            });
        }
        return raw.allTimed || (raw.all || []).filter(function (r) {
            var p = parseCategoryKey(r.category);
            return !p || p.runMode !== 'High Score';
        });
    }
    if (statsExplorerLongevityMode === 'standing') {
        return raw.standing || [];
    }
    return raw.all || [];
}

function renderLongevityView(body) {
    var bar = document.createElement('div');
    bar.className = 'stats-explorer-chips';
    [
        { id: 'all', label: 'All-time' },
        { id: 'standing', label: 'Still standing' }
    ].forEach(function (opt) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'stats-explorer-chip' + (opt.id === statsExplorerLongevityMode ? ' active' : '');
        chip.textContent = opt.label;
        chip.addEventListener('click', function () {
            statsExplorerLongevityMode = opt.id;
            renderStatisticsExplorerContent(body);
        });
        bar.appendChild(chip);
    });
    body.appendChild(bar);

    var hsBar = document.createElement('div');
    hsBar.className = 'stats-explorer-chips';
    [
        { id: false, label: 'Include High Score' },
        { id: true, label: 'Hide High Score' }
    ].forEach(function (opt) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'stats-explorer-chip' + (opt.id === statsExplorerLongevityHideHs ? ' active' : '');
        chip.textContent = opt.label;
        chip.addEventListener('click', function () {
            statsExplorerLongevityHideHs = opt.id;
            renderStatisticsExplorerContent(body);
        });
        hsBar.appendChild(chip);
    });
    body.appendChild(hsBar);

    renderListView(body, getLongevityRows(), 'longevity');
}

function renderListView(body, rows, kind, showAll) {
    if (!rows.length) {
        var empty = document.createElement('div');
        empty.className = 'stats-explorer-empty';
        empty.textContent = kind === 'longevity' && statsExplorerLongevityMode === 'standing'
            ? 'No still-standing records in the top list.'
            : 'No data available.';
        body.appendChild(empty);
        return;
    }
    var table = document.createElement('table');
    table.className = 'stats-explorer-table';
    var thead = document.createElement('thead');
    var hr = document.createElement('tr');
    var headers = kind === 'longevity'
        ? ['Player', 'Mode', 'Count', 'Speed', 'Size', 'Run', 'Time', 'Days', 'Range']
        : kind === 'stale'
            ? ['Mode', 'Count', 'Speed', 'Size', 'Run', 'Days', 'Flips', 'Holders']
            : kind === 'contested'
                ? ['Mode', 'Count', 'Speed', 'Size', 'Run', 'Flips', 'Holders']
                : kind === 'unheld'
                    ? ['Mode', 'Count', 'Speed', 'Size', 'Run', 'Tier']
                    : kind === 'unicorns'
                        ? ['Player', 'Mode', 'Count', 'Speed', 'Size', 'Run', 'Time', 'Days', 'Range']
                        : kind === 'legends'
                            ? ['Player', 'Mode', 'Count', 'Speed', 'Size', 'Run', 'Time', 'Score', 'Days', 'Range']
                            : ['Mode', 'Count', 'Speed', 'Size', 'Run', 'Holders', 'Days'];
    headers.forEach(function (h) {
        var th = document.createElement('th');
        th.textContent = h;
        hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    var displayRows = showAll ? rows : rows.slice(0, 50);
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
        if (kind === 'longevity') {
            var range = row.stillStanding
                ? row.start + ' → present'
                : row.start + ' → ' + row.end;
            tr.innerHTML =
                '<td>' + escapeHtml(row.playerName) + '</td>' +
                '<td>' + escapeHtml(parsed.gamemode) + '</td>' +
                '<td>' + escapeHtml(parsed.apple) + '</td>' +
                '<td>' + escapeHtml(parsed.speed) + '</td>' +
                '<td>' + escapeHtml(parsed.size) + '</td>' +
                '<td>' + escapeHtml(parsed.runMode) + '</td>' +
                '<td>' + formatHoldTimeCell(row, parsed) + '</td>' +
                '<td>' + row.days + '</td>' +
                '<td>' + escapeHtml(range) + '</td>';
        } else if (kind === 'stale') {
            tr.innerHTML =
                '<td>' + escapeHtml(parsed.gamemode) + '</td>' +
                '<td>' + escapeHtml(parsed.apple) + '</td>' +
                '<td>' + escapeHtml(parsed.speed) + '</td>' +
                '<td>' + escapeHtml(parsed.size) + '</td>' +
                '<td>' + escapeHtml(parsed.runMode) + '</td>' +
                '<td>' + (row.holdDays != null ? row.holdDays : row.daysWithRecord) + '</td>' +
                '<td>' + row.flips + '</td>' +
                '<td>' + row.uniqueHolders + '</td>';
        } else if (kind === 'contested') {
            tr.innerHTML =
                '<td>' + escapeHtml(parsed.gamemode) + '</td>' +
                '<td>' + escapeHtml(parsed.apple) + '</td>' +
                '<td>' + escapeHtml(parsed.speed) + '</td>' +
                '<td>' + escapeHtml(parsed.size) + '</td>' +
                '<td>' + escapeHtml(parsed.runMode) + '</td>' +
                '<td>' + row.flips + '</td>' +
                '<td>' + row.uniqueHolders + '</td>';
        } else if (kind === 'unheld') {
            tr.innerHTML =
                '<td>' + escapeHtml(parsed.gamemode) + '</td>' +
                '<td>' + escapeHtml(parsed.apple) + '</td>' +
                '<td>' + escapeHtml(parsed.speed) + '</td>' +
                '<td>' + escapeHtml(parsed.size) + '</td>' +
                '<td>' + escapeHtml(parsed.runMode) + '</td>' +
                '<td>' + escapeHtml(row.tier || '') + '</td>';
        } else if (kind === 'unicorns') {
            var uniRange = row.stillStanding
                ? row.start + ' → present'
                : row.start + ' → ' + row.end;
            tr.innerHTML =
                '<td>' + escapeHtml(row.playerName || '—') + '</td>' +
                '<td>' + escapeHtml(parsed.gamemode) + '</td>' +
                '<td>' + escapeHtml(parsed.apple) + '</td>' +
                '<td>' + escapeHtml(parsed.speed) + '</td>' +
                '<td>' + escapeHtml(parsed.size) + '</td>' +
                '<td>' + escapeHtml(parsed.runMode) + '</td>' +
                '<td>' + formatHoldTimeCell(row, parsed) + '</td>' +
                '<td>' + row.days + '</td>' +
                '<td>' + escapeHtml(uniRange) + '</td>';
        } else if (kind === 'legends') {
            var legRange = row.stillStanding
                ? row.start + ' → present'
                : row.start + ' → ' + row.end;
            tr.innerHTML =
                '<td>' + escapeHtml(row.playerName || '—') + '</td>' +
                '<td>' + escapeHtml(parsed.gamemode) + '</td>' +
                '<td>' + escapeHtml(parsed.apple) + '</td>' +
                '<td>' + escapeHtml(parsed.speed) + '</td>' +
                '<td>' + escapeHtml(parsed.size) + '</td>' +
                '<td>' + escapeHtml(parsed.runMode) + '</td>' +
                '<td>' + formatHoldTimeCell(row, parsed) + '</td>' +
                '<td>' + (row.score != null ? row.score : '—') + '</td>' +
                '<td>' + row.days + '</td>' +
                '<td>' + escapeHtml(legRange) + '</td>';
        } else {
            tr.innerHTML =
                '<td>' + escapeHtml(parsed.gamemode) + '</td>' +
                '<td>' + escapeHtml(parsed.apple) + '</td>' +
                '<td>' + escapeHtml(parsed.speed) + '</td>' +
                '<td>' + escapeHtml(parsed.size) + '</td>' +
                '<td>' + escapeHtml(parsed.runMode) + '</td>' +
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

function renderUnicornsView(body) {
    var rows = statsExplorerData.unicorns || [];
    var standing = rows.filter(function (r) { return r.stillStanding; }).length;
    var meta = document.createElement('div');
    meta.className = 'stats-explorer-meta';
    meta.textContent = rows.length + ' holds · ' + standing + ' still standing · Lottery · present first';
    body.appendChild(meta);
    renderListView(body, rows, 'unicorns', true);
}

function renderLegendsView(body) {
    var rows = statsExplorerData.legends || [];
    var standing = rows.filter(function (r) { return r.stillStanding; }).length;
    var meta = document.createElement('div');
    meta.className = 'stats-explorer-meta';
    meta.textContent = rows.length + ' Mythic holds · ' + standing + ' still standing · hardest first';
    body.appendChild(meta);
    renderListView(body, rows, 'legends', true);
}

function renderUnheldView(body) {
    var payload = statsExplorerData.unheld || {};
    var tiers = payload.tiers || ['Free', 'Warmup', 'Easy', 'Medium', 'Hard', 'Mythic', 'Lottery', 'Inhuman'];
    var allRows = payload.rows || [];

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

    var rows = allRows;
    if (statsExplorerUnheldTier !== 'All') {
        rows = allRows.filter(function (r) { return r.tier === statsExplorerUnheldTier; });
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
    controls.className = 'stats-explorer-filters';
    controls.appendChild(createStatsSelect('Year', statsExplorerHeatYear, years, function (v) {
        statsExplorerHeatYear = v;
        renderStatisticsExplorerContent(body);
    }, true));

    var metricWrap = document.createElement('div');
    metricWrap.className = 'stats-explorer-chips';
    ['flips', 'newWrs'].forEach(function (m) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'stats-explorer-chip' + (m === statsExplorerHeatMetric ? ' active' : '');
        chip.textContent = m === 'flips' ? 'WR flips' : 'New WRs';
        chip.addEventListener('click', function () {
            statsExplorerHeatMetric = m;
            renderStatisticsExplorerContent(body);
        });
        metricWrap.appendChild(chip);
    });
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
        cell.style.backgroundColor = 'rgba(87, 138, 52, ' + (0.12 + intensity * 0.88) + ')';
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

if (typeof window !== 'undefined' && !window.__statsRightPanelsResizeBound) {
    window.__statsRightPanelsResizeBound = true;
    window.addEventListener('resize', function () {
        if (typeof syncRightPanelsSideBySide === 'function') syncRightPanelsSideBySide();
    });
}
