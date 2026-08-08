// UI Generation Module
// Handles all table generation, sidebar creation, and UI elements

// Define ordered arrays for consistent table ordering
const orderedGamemodes = [
    "Classic", "Wall", "Portal", "Cheese", "Borderless", "Twin", "Winged", 
    "Yin Yang", "Key", "Sokoban", "Poison", "Dimension", "Minesweeper", 
    "Statue", "Light", "Shield", "Arrow", "Hotdog", "Magnet", "Gate", "Bridge", "Peaceful",
    "Chess", "Burger"
];

/** Mode visible in tables/chips given CE display setting + per-mode toggle */
function isGamemodeShown(gamemode) {
    if (typeof isModeDisplayed === 'function') return isModeDisplayed(gamemode);
    return !!(gamemodes[gamemode] && gamemodes[gamemode].visible);
}

const orderedRunModes = [
    "25 Apples", "50 Apples", "100 Apples", "All Apples", "High Score"
];

// Function to update API call progress display
function updateApiProgress() {
    var progressElement = document.getElementById('apiProgress');
    if (progressElement) {
        progressElement.textContent = `${apiCallProgress.successful}/${apiCallProgress.total}`;
    }
    
    // Update stop/resume button visibility based on progress
    var stopResumeButton = document.querySelector('.stop-resume-btn');
    if (stopResumeButton) {
        if ((apiCallProgress.total > 0 && apiCallProgress.successful < apiCallProgress.total) || (isLoading && apiCallProgress.total === 0)) {
            if (isLoading || isApiPaused) {
                stopResumeButton.style.display = 'block';
                if (isApiPaused) {
                    stopResumeButton.innerHTML = '▶️ Resume';
                    stopResumeButton.setAttribute('title', 'Resume API calls');
                } else {
                    stopResumeButton.innerHTML = '⏸️ Stop';
                    stopResumeButton.setAttribute('title', 'Stop API calls');
                }
            }
        } else if (apiCallProgress.total > 0 && apiCallProgress.successful >= apiCallProgress.total) {
            stopResumeButton.style.display = 'none';
        }
    }
    
    // Update cache info display
    updateCacheInfo();
}

// Function to update cache info display
function updateCacheInfo() {
    if (!window.cacheManager) return;
    
    const cacheTimestampElement = document.getElementById('cacheTimestamp');
    const cacheSizeElement = document.getElementById('cacheSize');
    
    if (cacheTimestampElement && cacheSizeElement) {
        const stats = window.cacheManager.getCacheStats();
        
        // Update timestamp (show most recent)
        if (stats.totalCaches > 0) {
            // Get the most recent timestamp from all caches
            const keys = Object.keys(localStorage);
            const cacheKeys = keys.filter(key => key.startsWith(window.cacheManager.cachePrefix));
            let mostRecent = 0;
            
            cacheKeys.forEach(key => {
                const cached = window.cacheManager.getCachedData(key);
                if (cached && cached.timestamp > mostRecent) {
                    mostRecent = cached.timestamp;
                }
            });
            
            if (mostRecent > 0) {
                const date = new Date(mostRecent);
                cacheTimestampElement.textContent = date.toLocaleString();
            } else {
                cacheTimestampElement.textContent = 'Unknown';
            }
        } else {
            cacheTimestampElement.textContent = 'Never';
        }
        
        // Update record count
        cacheSizeElement.textContent = stats.totalRecords;
    }
}

// SpeedInfo.js time conversion function
function convertSpeedInfoTime(duration) {
    const regex = /PT(?:(\d+)H)?(?:(\d+)M)?([\d.]+)S/;
    const matches = duration.match(regex);

    let convertedTime = '';

    if (matches[1]) {
        convertedTime += matches[1] + 'h';
    }

    if (matches[2]) {
        convertedTime += matches[2] + 'm';
    }

    const seconds = parseFloat(matches[3]);

    if (seconds > 0 || convertedTime === '') {
        const wholeSeconds = Math.floor(seconds);
        convertedTime += wholeSeconds + 's';

        const milliseconds = Math.round((seconds - wholeSeconds) * 1000);

        if (milliseconds > 0) {
            convertedTime += milliseconds + 'ms';
        }
    }

    if (convertedTime.includes('h')) {
        convertedTime = convertedTime.split('s')[0] + "s";
    }

    return convertedTime;
}

function calculateBestRuns(callback){
    try {
        generateRunHolder(bestRuns);
        
        // Process world records directly
        for(var key in worldRecords){
            var runs = worldRecords[key];
            var settings = key.split("|");
            
            // Handle time travel keys that include date (6 parts) vs normal keys (5 parts)
            var appleAmount, speed, size, gamemode, runMode;
            if (settings.length === 6) {
                // Time travel key: "appleAmount|speed|size|gamemode|runMode|date"
                appleAmount = settings[0];
                speed = settings[1];
                size = settings[2];
                gamemode = settings[3];
                runMode = settings[4];
                // settings[5] is the date, which we ignore for processing
            } else if (settings.length === 5) {
                // Normal key: "appleAmount|speed|size|gamemode|runMode"
                appleAmount = settings[0];
                speed = settings[1];
                size = settings[2];
                gamemode = settings[3];
                runMode = settings[4];
            } else {
                console.warn('Invalid key format:', key, 'with', settings.length, 'parts');
                continue; // Skip invalid keys
            }
            
            try{
                // Store all runs for this combination
                bestRuns[appleAmount][speed][size][gamemode][runMode] = {
                    success: true,
                    runs: runs,
                    settings: [appleAmount, speed, size, gamemode, runMode]
                };
                
                // Track dates for historical features (use the first run's date)
                if(runs.length > 0) {
                    var rundate = new Date(runs[0].date);
                    if(firstdate == undefined){
                        firstdate = rundate;
                    }
                    else if(rundate < firstdate){
                        firstdate = rundate;
                    }
                }
            }
            catch{//non valid combination
            }
        }
        
        if(typeof(callback) != "undefined"){
            callback();
        }
    } catch (error) {
        console.error('Error in calculateBestRuns:', error);
        console.error('Error stack:', error.stack);
        throw error; // Re-throw the error so it can be caught by the calling function
    }
}

function calculateRanglist(){
    //console.log('currentTableSettings:', currentTableSettings);
    
    ranglist = [];
    var totalCategories = 0;
    
    // Count world records per player against selected categories
    for(var key in worldRecords){
        var runs = worldRecords[key];
        //console.log('Processing key:', key, 'with', runs.length, 'runs');
        var settings = key.split("|");
        
        // Handle time travel keys that include date (6 parts) vs normal keys (5 parts)
        var appleAmount, speed, size, gamemode, runMode;
        if (settings.length === 6) {
            // Time travel key: "appleAmount|speed|size|gamemode|runMode|date"
            appleAmount = settings[0];
            speed = settings[1];
            size = settings[2];
            gamemode = settings[3];
            runMode = settings[4];
            // settings[5] is the date, which we ignore for processing
        } else if (settings.length === 5) {
            // Normal key: "appleAmount|speed|size|gamemode|runMode"
            appleAmount = settings[0];
            speed = settings[1];
            size = settings[2];
            gamemode = settings[3];
            runMode = settings[4];
        } else {
            console.warn('Invalid key format:', key, 'with', settings.length, 'parts');
            continue; // Skip invalid keys
        }

        if(!runs || runs.length === 0){
            continue;
        }

        if (typeof filterIgnoredRuns === 'function') {
            runs = filterIgnoredRuns(runs);
        }
        if(!runs || runs.length === 0){
            continue;
        }

        var inSelection = false;
        
        // When multiple tables is disabled, only count the currently selected board
        if(!isMultipleTablesEnabled) {
            //console.log('Single table mode - checking if matches current settings');
            if(appleAmount === currentTableSettings[0] && 
               speed === currentTableSettings[1] && 
               size === currentTableSettings[2] &&
               gamemodes[gamemode] && isGamemodeShown(gamemode) &&
               runModes[runMode] && runModes[runMode].visible) {
                inSelection = true;
            }
        } else {
            //console.log('Multiple tables mode - checking visibility');
            // When multiple tables is enabled, count all visible categories
            if(appleAmounts[appleAmount] && appleAmounts[appleAmount].visible && 
               speeds[speed] && speeds[speed].visible && 
               sizes[size] && sizes[size].visible && 
               gamemodes[gamemode] && isGamemodeShown(gamemode) && 
               runModes[runMode] && runModes[runMode].visible){
                inSelection = true;
            }
        }

        if(!inSelection){
            continue;
        }

        // Each matching category counts once toward the percentage denominator
        totalCategories += 1;

        // Count each tied WR holder for this category
        for(var i = 0; i < runs.length; i++) {
            var run = runs[i];
            var id = run.players.data[0].id;
            if(typeof(ranglist[id]) == 'undefined'){
                ranglist[id] = [1, run.players.data[0]];
            }
            else{
                ranglist[id][0] += 1;
            }
        }
    }
    
    // Overall% = player's WR count / total selected categories
    // Relative% = player's WR count / sum of all player WR counts (ties inflate this total)
    var relativeTotal = 0;
    for(user in ranglist){
        relativeTotal += ranglist[user][0];
    }
    total = totalCategories;
    for(user in ranglist){
        ranglist[user][2] = totalCategories != 0
            ? roundNumber(ranglist[user][0]*100/totalCategories,2)
            : 0;
        ranglist[user][3] = relativeTotal != 0
            ? roundNumber(ranglist[user][0]*100/relativeTotal,2)
            : 0;
    }

    // Convert ranglist object to array and sort by count (descending)
    // [count, player, overall%, relative%]
    var ranglistArray = [];
    for(user in ranglist){
        ranglistArray.push([ranglist[user][0], ranglist[user][1], ranglist[user][2], ranglist[user][3]]);
    }
    ranglist = ranglistArray.sort(function(a, b){return b[0]-a[0]});
}

function getCategoryUseIcons() {
    try {
        var v = localStorage.getItem('categoryUseIcons');
        if (v === null || v === undefined) return true;
        return v !== 'false';
    } catch (e) {
        return true;
    }
}

function setCategoryUseIcons(useIcons) {
    try {
        localStorage.setItem('categoryUseIcons', useIcons ? 'true' : 'false');
    } catch (e) { /* ignore */ }
    if (typeof updateCategoryIconsToggleButtons === 'function') {
        updateCategoryIconsToggleButtons();
    }
    refreshCategoryIconDisplays();
}

function toggleCategoryUseIcons() {
    setCategoryUseIcons(!getCategoryUseIcons());
}

function updateCategoryIconsToggleButtons() {
    var useIcons = getCategoryUseIcons();
    // Match Dark Mode / Time Travel: emoji + label for current mode
    var label = useIcons ? '🔣 Icons' : '🔤 Text';
    var title = useIcons
        ? 'Statistics categories use icons. Click to switch to text.'
        : 'Statistics categories use text. Click to switch to icons.';
    document.querySelectorAll('#categoryIconsToggle, #mobileCategoryIconsToggle, .category-icons-toggle').forEach(function (btn) {
        btn.textContent = label;
        btn.setAttribute('title', title);
        btn.classList.toggle('active', !!useIcons);
    });
}

function applyCategoryIconsToggleToButton(btn) {
    if (!btn) return;
    var useIcons = getCategoryUseIcons();
    btn.textContent = useIcons ? '🔣 Icons' : '🔤 Text';
    btn.setAttribute('title', useIcons
        ? 'Statistics categories use icons. Click to switch to text.'
        : 'Statistics categories use text. Click to switch to icons.');
    btn.classList.toggle('active', !!useIcons);
}

function refreshCategoryIconDisplays() {
    // Settings menu always keeps icons — only refresh Statistics category cells
    if (typeof renderStatisticsExplorerContent === 'function') {
        var body = document.getElementById('statsExplorerBody') ||
            document.getElementById('mobileStatsExplorerBody');
        if (body) renderStatisticsExplorerContent(body);
    }
}

function createIconElement(setting, label) {
    var text = label != null ? String(label)
        : (setting && setting.text != null ? String(setting.text) : '');
    // Settings / table headers always use icons when available (toggle does not apply here)
    if (!setting || setting.icon == null) {
        var span = document.createElement('span');
        span.className = 'category-text-label';
        span.textContent = text || '—';
        span.setAttribute('title', text || '');
        return span;
    }
    var img = document.createElement('img');
    img.setAttribute('src', setting.icon);
    img.setAttribute('alt', text);
    img.setAttribute('title', text);
    return img;
}

function createTimeElement(times, isHighScore = false){
    ptformatter = function primaryTimeFormatter(pt){
        pt = pt.replace("PT","");
        if(pt.indexOf("S") == -1){
            pt = pt+"0.000S";
        }
        else if(pt.indexOf(".") == -1){
            pt = pt.substring(0,pt.indexOf("S")) +".000S";
        }
        pt = pt.replace("H","<small>h </small>");
        pt = pt.replace("M","<small>m </small>");
        pt = pt.replace(".","<small>s </small>");
        pt = pt.replace("S","<small>ms</small>");
        return pt;
    }

    atformatter = function appleTimeFormatter(pt){
        while(pt.indexOf("PT0.0") != -1){
            pt = pt.replace("PT0.0","PT0.");
        }
        pt = pt.replace("PT0.","");
        pt = pt.replace("S","");
        return pt+ " Apples";
    }

    // Special formatter for high scores - extract milliseconds and show as "X apples"
    highScoreFormatter = function highScoreFormatter(pt){
        // Extract the milliseconds part from the time
        const match = pt.match(/PT(?:(\d+)H)?(?:(\d+)M)?([\d.]+)S/);
        if (match) {
            const seconds = parseFloat(match[3]);
            const milliseconds = Math.round((seconds - Math.floor(seconds)) * 1000);
            return milliseconds + " apples";
        }
        // Fallback to apple formatter if regex doesn't match
        return atformatter(pt);
    }

    var span = document.createElement('span');
    span.setAttribute('class','time');
    var text;
    
    if(isHighScore){
        text = highScoreFormatter(times.primary);
    }
    else if(times.primary_t < 1){
        text = atformatter(times.primary);
    }
    else{
        text = ptformatter(times.primary);
    }
    span.innerHTML = text;
    return span;
}

/**
 * Resolve a Speedrun.com name-style color pair.
 * Always prefer the SRC "dark" (bright) swatch — green cells in every theme.
 * Never theme-switch and never invent a non-SRC fallback when a swatch exists.
 */
function pickNameStyleColor(pair) {
    if (!pair) return null;
    if (typeof pair === 'string') return pair;
    return pair.dark || pair.light || null;
}

/** Thin black outline — same for every username (solid + gradient). */
function snakeNameOutlineFilter() {
    return (
        'drop-shadow(1px 0 0 #000) ' +
        'drop-shadow(-1px 0 0 #000) ' +
        'drop-shadow(0 1px 0 #000) ' +
        'drop-shadow(0 -1px 0 #000)'
    );
}

function clearNameEffects(span) {
    span.style.webkitTextStroke = '';
    span.style.paintOrder = '';
    span.style.textShadow = '';
    span.style.filter = '';
    span.style.background = '';
    span.style.webkitBackgroundClip = '';
    span.style.backgroundClip = '';
    span.style.webkitTextFillColor = '';
    span.style.removeProperty('color');
}

/**
 * Apply SRC name-style colors + thin Snake outline.
 * Same result in light/dark and on mobile/desktop — prefers SRC colors only.
 */
function applyUsernameColors(span, nameStyle) {
    clearNameEffects(span);
    span.style.display = 'inline-block';
    span.style.fontWeight = '700';
    span.style.fontFamily = 'Arial, Helvetica, sans-serif';

    if (nameStyle) {
        try {
            span.dataset.nameStyle = JSON.stringify(nameStyle);
        } catch (e) { /* ignore */ }
    }

    var outline = snakeNameOutlineFilter();
    var fill = null;

    if (!nameStyle) {
        fill = '#ffffff';
        span.style.setProperty('color', fill, 'important');
    } else if (nameStyle.style === 'gradient' && nameStyle['color-from'] && nameStyle['color-to']) {
        var colorFrom = pickNameStyleColor(nameStyle['color-from']) || '#ffffff';
        var colorTo = pickNameStyleColor(nameStyle['color-to']) || colorFrom;
        fill = colorFrom;
        if (colorFrom.toLowerCase() === colorTo.toLowerCase()) {
            span.style.setProperty('color', colorFrom, 'important');
        } else {
            span.style.background = 'linear-gradient(90deg, ' + colorFrom + ', ' + colorTo + ')';
            span.style.webkitBackgroundClip = 'text';
            span.style.backgroundClip = 'text';
            span.style.webkitTextFillColor = 'transparent';
            span.style.setProperty('color', colorFrom, 'important');
        }
    } else if (nameStyle.color) {
        fill = pickNameStyleColor(nameStyle.color) || '#ffffff';
        span.style.setProperty('color', fill, 'important');
    } else {
        fill = '#ffffff';
        span.style.setProperty('color', fill, 'important');
    }

    // Identical thin outline for every user
    span.style.filter = outline;

    // Keep parent link from forcing white over the SRC color
    var parent = span.parentElement;
    if (parent && parent.tagName === 'A' && fill) {
        parent.style.setProperty('color', fill, 'important');
        parent.style.textDecoration = 'none';
    }

    return fill;
}

function refreshUsernameColors() {
    document.querySelectorAll('span.name[data-name-style]').forEach(function (span) {
        try {
            applyUsernameColors(span, JSON.parse(span.dataset.nameStyle));
        } catch (e) { /* ignore bad payload */ }
    });
}

function createNameElement(user){
    
    var span = document.createElement('span');
    span.setAttribute('class', 'name');
    var a = document.createElement('a');
    
    const playerName = user.names && user.names.international
        ? user.names.international
        : (user.name || 'unknown');
    const isGuest = user.rel === 'guest' ||
        (user.id && String(user.id).indexOf('guest:') === 0);

    // Guests have no SRC user profile; prefer stored weblink, else skip fake /user/ links
    if (user.weblink) {
        a.setAttribute('href', user.weblink);
        a.setAttribute('target', '_blank');
    } else if (!isGuest) {
        a.setAttribute('href', `https://www.speedrun.com/user/${playerName}`);
        a.setAttribute('target', '_blank');
    }
    
    var nameStyle = user['name-style'] || user.nameStyle || null;
    if (isGuest && !nameStyle) {
        nameStyle = { style: 'solid', color: { dark: '#9e9e9e', light: '#9e9e9e' } };
    }

    // Check if this is a user with names.international (GitHub cache format)
    if(user.names && user.names.international){
        span.appendChild(document.createTextNode(user.names.international));
        a.appendChild(span);
        applyUsernameColors(span, nameStyle);
    }
    // Legacy format check (user.rel == "user")
    else if(user.rel == "user"){
        span.appendChild(document.createTextNode(user.names.international));
        a.appendChild(span);
        applyUsernameColors(span, nameStyle);
    }
    else if(user.rel == "guest" || isGuest){
        span.appendChild(document.createTextNode(playerName));
        a.appendChild(span);
        applyUsernameColors(span, nameStyle);
    }
    else{
        // Fallback for other formats
        span.appendChild(document.createTextNode(user.name || "Unknown Player"));
        span.style.setProperty('color', '#ffffff', 'important');
        span.style.filter = snakeNameOutlineFilter();
        a.appendChild(span);
    }

    return a;
}

// Function to generate table content for a specific combination (used for refresh)
function generateTableContent(table, settings, specificGamemode = null) {
    try {
        // Validate parameters
        if (!table || !settings || !Array.isArray(settings) || settings.length === 0) {
            console.error('Invalid parameters for generateTableContent:', { table, settings });
            return;
        }
    
    // Get the runs for this specific combination
    var thisBoardRuns = {};
    var thisBoardRunModes = [];
    
    // Get runs for this specific combination from worldRecords
    for(gamemode in gamemodes){
        if(gamemodes[gamemode] && isGamemodeShown(gamemode)){
            thisBoardRuns[gamemode] = {};
            for(const runMode of orderedRunModes){
                if(runModes[runMode] && runModes[runMode].visible){
                    // Don't show "100 Apples" for "Small" size
                    if(runMode === "100 Apples" && settings[2] === "Small"){
                        continue;
                    }
                    
                    // Only show "High Score" column for highscore modes (or Tally CE modes)
                    if(runMode === "High Score" &&
                        !(typeof shouldShowHighScoreColumn === 'function'
                            ? shouldShowHighScoreColumn(settings[0], gamemode)
                            : ["Wall", "Portal", "Key", "Sokoban", "Poison", "Minesweeper", "Statue", "Shield", "Hotdog", "Gate", "Bridge"].includes(gamemode))){
                        continue;
                    }
                    
                    var key = settings[0] + "|" + settings[1] + "|" + settings[2] + "|" + gamemode + "|" + runMode;
                    if(typeof(worldRecords[key]) != 'undefined'){
                        thisBoardRuns[gamemode][runMode] = worldRecords[key];
                    }
                    
                    // Add to run modes list if not already present
                    if(thisBoardRunModes.indexOf(runMode) == -1){
                        thisBoardRunModes.push(runMode);
                    }
                }
            }
        }
    }
    // Keep columns in canonical order (25 → 50 → 100 → All → High Score)
    thisBoardRunModes = orderedRunModes.filter(function (rm) {
        return thisBoardRunModes.indexOf(rm) !== -1;
    });
    
    // Create thead
    var thead = document.createElement('thead');
    
    // First row: Category icons (apple amount, speed, size)
    var row = document.createElement('tr');
    var th = document.createElement('th');
    th.setAttribute('class', 'settingsRow');
    th.setAttribute('colspan', thisBoardRunModes.length + 1);
    th.appendChild(createIconElement(appleAmounts[settings[0]], settings[0]));
    th.appendChild(createIconElement(speeds[settings[1]], settings[1]));
    th.appendChild(createIconElement(sizes[settings[2]], settings[2]));
    row.appendChild(th);
    thead.appendChild(row);
    
    // Second row: Run mode headers
    row = document.createElement('tr');
    var firstHeaderCell = document.createElement('th');
    
    row.appendChild(firstHeaderCell);
    for(runMode of thisBoardRunModes){
        let th = document.createElement('th');
        if(runModes[runMode]){
            th.appendChild(createIconElement(runModes[runMode], runMode));
        }
        row.appendChild(th);
    }
    thead.appendChild(row);
    table.appendChild(thead);

    // Create tbody
    var tbody = document.createElement('tbody');
    for(gamemode in thisBoardRuns){
        if(gamemodes[gamemode] && isGamemodeShown(gamemode) && (specificGamemode === null || gamemode === specificGamemode)){
            row = document.createElement('tr');
            th = document.createElement('th');
            th.appendChild(createIconElement(gamemodes[gamemode], gamemode));
            row.appendChild(th);

            for(runMode of thisBoardRunModes){
                td = document.createElement('td');
                if(typeof(thisBoardRuns[gamemode][runMode]) != 'undefined'){
                    td.setAttribute('class','result');
                    if(thisBoardRuns[gamemode][runMode].runs && thisBoardRuns[gamemode][runMode].runs.length != 0){
                        // Create a container for all runs
                        var runsContainer = document.createElement('div');
                        runsContainer.setAttribute('class', 'runs-container');
                        
                        // Add time display (same for all tied runs) - link to first run
                        var timeDisplay = document.createElement('div');
                        timeDisplay.setAttribute('class', 'time-display');
                        var timeLink = document.createElement('a');
                        
                        timeLink.setAttribute('href', thisBoardRuns[gamemode][runMode].runs[0].weblink);
                        timeLink.setAttribute('target', '_blank');
                        timeLink.appendChild(createTimeElement(thisBoardRuns[gamemode][runMode].runs[0].times, runMode === "High Score"));
                        timeDisplay.appendChild(timeLink);
                        runsContainer.appendChild(timeDisplay);
                        
                        // Add all player names with their individual links
                        for(var i = 0; i < thisBoardRuns[gamemode][runMode].runs.length; i++){
                            var run = thisBoardRuns[gamemode][runMode].runs[i];
                            var playerLink = document.createElement('a');
                            playerLink.setAttribute('href', run.weblink);
                            playerLink.setAttribute('target','_blank');
                            playerLink.appendChild(createNameElement(run.players.data[0]));
                            
                            // Add separator between players (except for the last one)
                            if(i < thisBoardRuns[gamemode][runMode].runs.length - 1) {
                                var separator = document.createElement('span');
                                separator.innerHTML = ' ';
                                separator.setAttribute('class', 'player-separator');
                                runsContainer.appendChild(separator);
                            }
                            
                            runsContainer.appendChild(playerLink);
                        }
                        
                        td.appendChild(runsContainer);
                    }
                }
                row.appendChild(td);
            }
            tbody.appendChild(row);
        }
    }
    table.appendChild(tbody);
    } catch (error) {
        console.error('Error in generateTableContent:', error);
        console.error('Error stack:', error.stack);
        throw error; // Re-throw the error so it can be caught by the calling function
    }
}

function generateLeaderboard(settings, specificGamemode = null){
    // Safety check: ensure game metadata is loaded
    if (typeof speeds === 'undefined' || typeof gamemodes === 'undefined' || typeof runModes === 'undefined' || typeof appleAmounts === 'undefined') {
        //console.log('Game metadata not yet loaded, skipping table generation');
        return document.createElement('div'); // Return empty div instead of table
    }
    
    // Additional safety check: ensure the specific settings exist
    //console.log('generateLeaderboard called with settings:', settings);
    //console.log('Available speeds:', speeds);
    //console.log('Available appleAmounts:', appleAmounts);
    //console.log('Available sizes:', sizes);
    
    if (!speeds || !speeds[settings[1]] || typeof speeds[settings[1]] !== 'object') {
        //console.log('Speeds metadata not available for setting:', settings[1], 'Available speeds:', speeds);
        return document.createElement('div');
    }
    if (!appleAmounts || !appleAmounts[settings[0]] || typeof appleAmounts[settings[0]] !== 'object') {
        //console.log('Apple amounts metadata not available for setting:', settings[0], 'Available amounts:', appleAmounts);
        return document.createElement('div');
    }
    if (!sizes || !sizes[settings[2]] || typeof sizes[settings[2]] !== 'object') {
        //console.log('Sizes metadata not available for setting:', settings[2], 'Available sizes:', sizes);
        return document.createElement('div');
    }
    
    var table = document.createElement('table');
    table.setAttribute('class','leaderboard');

    //calculate stuff
    var thisBoardRunModes = [];
    var thisBoardRuns = bestRuns[settings[0]][settings[1]][settings[2]];
    
    // Check if we have data for this combination
    if(!thisBoardRuns){
        return table;
    }
    
    // Find all run modes that have data for this combination
     
     // Use ordered gamemodes for consistent row ordering
     for(const gamemode of orderedGamemodes){
         if(thisBoardRuns[gamemode] && isGamemodeShown(gamemode)){
             for(const runMode of orderedRunModes){
                 if(thisBoardRuns[gamemode][runMode]){
                     // Only show "High Score" column for highscore modes (or Tally CE modes)
                     if(runMode === "High Score" &&
                         !(typeof shouldShowHighScoreColumn === 'function'
                             ? shouldShowHighScoreColumn(settings[0], gamemode)
                             : ["Wall", "Portal", "Key", "Sokoban", "Poison", "Minesweeper", "Statue", "Shield", "Hotdog", "Gate", "Bridge"].includes(gamemode))){
                         continue;
                     }
                     // Don't show "100 Apples" for "Small" size
                     if(runMode === "100 Apples" && settings[2] === "Small"){
                         continue;
                     }
                     if(runModes[runMode].visible && thisBoardRunModes.indexOf(runMode) == -1){
                         thisBoardRunModes.push(runMode);
                     }
                 }
             }
         }
     }
    // Keep columns in canonical order (25 → 50 → 100 → All → High Score)
    thisBoardRunModes = orderedRunModes.filter(function (rm) {
        return thisBoardRunModes.indexOf(rm) !== -1;
    });
    
    //create thead
    var thead = document.createElement('thead');
    var row;
    var th;
    var td;
    row = document.createElement('tr');
    th = document.createElement('th');
    th.setAttribute('class', 'settingsRow');
    th.setAttribute('colspan', thisBoardRunModes.length+1);
    
    // Safe icon creation with fallbacks
    const appleIcon = appleAmounts[settings[0]] ? createIconElement(appleAmounts[settings[0]], settings[0]) : document.createTextNode(settings[0]);
    const speedIcon = speeds[settings[1]] ? createIconElement(speeds[settings[1]], settings[1]) : document.createTextNode(settings[1]);
    const sizeIcon = sizes[settings[2]] ? createIconElement(sizes[settings[2]], settings[2]) : document.createTextNode(settings[2]);
    
    th.appendChild(appleIcon);
    th.appendChild(speedIcon);
    th.appendChild(sizeIcon);
    
    row.appendChild(th);
    thead.appendChild(row);

    row = document.createElement('tr');
    // Create the first header cell (to the left of "25 Apples")
    var firstHeaderCell = document.createElement('th');
    
    // Individual refresh button removed - no longer needed
    
    row.appendChild(firstHeaderCell);
    for(runMode of thisBoardRunModes){
        let th = document.createElement('th');
        th.appendChild(createIconElement(runModes[runMode], runMode));
        row.appendChild(th);
    }
    thead.appendChild(row);
    table.appendChild(thead);

    //creat tbody
    var tbody = document.createElement('tbody');
    // Use ordered gamemodes for consistent row ordering (always show visible modes, even if cache has no data yet)
    for(const gamemode of orderedGamemodes){
        if(gamemodes[gamemode] && isGamemodeShown(gamemode) && (specificGamemode === null || gamemode === specificGamemode)){
            const modeRuns = thisBoardRuns[gamemode] || {};
            row = document.createElement('tr');
            th = document.createElement('th');
            th.appendChild(createIconElement(gamemodes[gamemode], gamemode));
            row.appendChild(th);

            for(runMode of thisBoardRunModes){
                td = document.createElement('td');
                if(typeof(modeRuns[runMode]) != 'undefined'){
                    td.setAttribute('class','result');
                    if(modeRuns[runMode].runs && modeRuns[runMode].runs.length != 0){
                        // Create a container for all runs
                        var runsContainer = document.createElement('div');
                        runsContainer.setAttribute('class', 'runs-container');
                        
                        // Add time display (same for all tied runs) - link to first run
                        var timeDisplay = document.createElement('div');
                        timeDisplay.setAttribute('class', 'time-display');
                        var timeLink = document.createElement('a');
                        timeLink.setAttribute('href', modeRuns[runMode].runs[0].weblink);
                        timeLink.setAttribute('target', '_blank');
                        timeLink.appendChild(createTimeElement(modeRuns[runMode].runs[0].times, runMode === "High Score"));
                        timeDisplay.appendChild(timeLink);
                        runsContainer.appendChild(timeDisplay);
                        
                        // Add all player names with their individual links
                        for(var i = 0; i < modeRuns[runMode].runs.length; i++){
                            var run = modeRuns[runMode].runs[i];
                            var playerLink = document.createElement('a');
                            playerLink.setAttribute('href', run.weblink);
                            playerLink.setAttribute('target','_blank');
                            playerLink.appendChild(createNameElement(run.players.data[0]));
                            
                            // Add separator between players (except for the last one)
                            if(i < modeRuns[runMode].runs.length - 1) {
                                var separator = document.createElement('span');
                                separator.innerHTML = ' ';
                                separator.setAttribute('class', 'player-separator');
                                runsContainer.appendChild(separator);
                            }
                            
                            runsContainer.appendChild(playerLink);
                        }
                        
                        td.appendChild(runsContainer);
                    }
                }
                row.appendChild(td);
            }
            tbody.appendChild(row);

        }
    }
    table.appendChild(tbody);

    // Create a wrapper for better centering
    var tableWrapper = document.createElement('div');
    tableWrapper.setAttribute('class', 'table-wrapper main-table-wrapper');
    tableWrapper.setAttribute('data-settings', settings.join('|'));
    tableWrapper.style.gridArea = 'main'; // Ensure grid area is set
    tableWrapper.appendChild(table);

    document.getElementsByClassName("container")[0].appendChild(tableWrapper);
}

function generateLeaderboardForMultiple(settings, container){
    // Validate parameters
    if (!settings || !Array.isArray(settings) || settings.length === 0) {
        console.error('Invalid settings parameter:', settings);
        return;
    }
    
    if (!container || !container.appendChild) {
        console.error('Invalid container parameter:', container);
        return;
    }
    
    // Use the same logic as generateLeaderboard but for multiple tables
    var table = document.createElement('table');
    table.setAttribute('class','leaderboard');

    //calculate stuff
    var thisBoardRunModes = [];
    var thisBoardRuns = bestRuns[settings[0]][settings[1]][settings[2]];
    
    // Check if we have data for this combination
    if(!thisBoardRuns){
        return;
    }
    
    // Find all run modes that have data for this combination
    
    // Use ordered gamemodes for consistent row ordering
    for(const gamemode of orderedGamemodes){
        if(thisBoardRuns[gamemode] && isGamemodeShown(gamemode)){
            for(const runMode of orderedRunModes){
                if(thisBoardRuns[gamemode][runMode]){
                    // Only show "High Score" column for highscore modes (or Tally CE modes)
                    if(runMode === "High Score" &&
                        !(typeof shouldShowHighScoreColumn === 'function'
                            ? shouldShowHighScoreColumn(settings[0], gamemode)
                            : ["Wall", "Portal", "Key", "Sokoban", "Poison", "Minesweeper", "Statue", "Shield", "Hotdog", "Gate", "Bridge"].includes(gamemode))){
                        continue;
                    }
                    // Don't show "100 Apples" for "Small" size
                    if(runMode === "100 Apples" && settings[2] === "Small"){
                        continue;
                    }
                    if(runModes[runMode].visible && thisBoardRunModes.indexOf(runMode) == -1){
                        thisBoardRunModes.push(runMode);
                    }
                }
            }
        }
    }
    // Keep columns in canonical order (25 → 50 → 100 → All → High Score)
    thisBoardRunModes = orderedRunModes.filter(function (rm) {
        return thisBoardRunModes.indexOf(rm) !== -1;
    });
    
    //create thead
    var thead = document.createElement('thead');
    var row;
    var th;
    var td;
    row = document.createElement('tr');
    th = document.createElement('th');
    th.setAttribute('class', 'settingsRow');
    th.setAttribute('colspan', thisBoardRunModes.length+1);
    th.appendChild(createIconElement(appleAmounts[settings[0]], settings[0]));
    th.appendChild(createIconElement(speeds[settings[1]], settings[1]));
    th.appendChild(createIconElement(sizes[settings[2]], settings[2]));
    
    row.appendChild(th);
    thead.appendChild(row);

    row = document.createElement('tr');
    // Create the first header cell (to the left of "25 Apples")
    var firstHeaderCell = document.createElement('th');
    
    // Individual refresh button removed - no longer needed
    
    row.appendChild(firstHeaderCell);
    for(runMode of thisBoardRunModes){
        let th = document.createElement('th');
        th.appendChild(createIconElement(runModes[runMode], runMode));
        row.appendChild(th);
    }
    thead.appendChild(row);
    table.appendChild(thead);

    //creat tbody
    var tbody = document.createElement('tbody');
    // Use ordered gamemodes for consistent row ordering (always show visible modes, even if cache has no data yet)
    for(const gamemode of orderedGamemodes){
        if(gamemodes[gamemode] && isGamemodeShown(gamemode)){
            const modeRuns = thisBoardRuns[gamemode] || {};
            row = document.createElement('tr');
            th = document.createElement('th');
            th.appendChild(createIconElement(gamemodes[gamemode], gamemode));
            row.appendChild(th);

            for(runMode of thisBoardRunModes){
                td = document.createElement('td');
                if(typeof(modeRuns[runMode]) != 'undefined'){
                    td.setAttribute('class','result');
                    if(modeRuns[runMode].runs && modeRuns[runMode].runs.length != 0){
                        // Create a container for all runs
                        var runsContainer = document.createElement('div');
                        runsContainer.setAttribute('class', 'runs-container');
                        
                        // Add time display (same for all tied runs) - link to first run
                        var timeDisplay = document.createElement('div');
                        timeDisplay.setAttribute('class', 'time-display');
                        var timeLink = document.createElement('a');
                        timeLink.setAttribute('href', modeRuns[runMode].runs[0].weblink);
                        timeLink.setAttribute('target', '_blank');
                        timeLink.appendChild(createTimeElement(modeRuns[runMode].runs[0].times, runMode === "High Score"));
                        timeDisplay.appendChild(timeLink);
                        runsContainer.appendChild(timeDisplay);
                        
                        // Add all player names with their individual links
                        for(var i = 0; i < modeRuns[runMode].runs.length; i++){
                            var run = modeRuns[runMode].runs[i];
                            var playerLink = document.createElement('a');
                            playerLink.setAttribute('href', run.weblink);
                            playerLink.setAttribute('target','_blank');
                            playerLink.appendChild(createNameElement(run.players.data[0]));
                            
                            // Add separator between players (except for the last one)
                            if(i < modeRuns[runMode].runs.length - 1) {
                                var separator = document.createElement('span');
                                separator.innerHTML = ' ';
                                separator.setAttribute('class', 'player-separator');
                                runsContainer.appendChild(separator);
                            }
                            
                            runsContainer.appendChild(playerLink);
                        }
                        
                        td.appendChild(runsContainer);
                    }
                }
                row.appendChild(td);
            }
            tbody.appendChild(row);

        }
    }
    table.appendChild(tbody);

    // Create a wrapper for the table
    var tableWrapper = document.createElement('div');
    tableWrapper.setAttribute('class', 'table-wrapper multiple-table-wrapper');
    tableWrapper.setAttribute('data-settings', settings.join('|'));
    // Don't set grid area for multiple tables
    tableWrapper.appendChild(table);
    
    // Validate that tableWrapper is a valid Node before appending
    if (tableWrapper && tableWrapper.nodeType) {
        container.appendChild(tableWrapper);
    } else {
        console.error('tableWrapper is not a valid Node:', tableWrapper);
    }
}

function updateTableSelector(){
    // Get the latest settings from localStorage to ensure we're using the most current values
    try {
        var savedSettings = JSON.parse(localStorage.getItem('tableSettings'));
        if(savedSettings && Array.isArray(savedSettings) && savedSettings.length === 3) {
            currentTableSettings = savedSettings;
        }
    } catch(e) {
    }
    
    // Update active states of buttons
    var buttons = document.querySelectorAll('.table-option-btn');
    
    // First, remove all active classes
    buttons.forEach(function(button){
        button.classList.remove('active');
    });
    
    // Then add active class to matching buttons
    buttons.forEach(function(button, index){
        // Skip refresh button
        if(button.classList.contains('refresh-btn')) {
            return;
        }
        
        // Check if this button corresponds to current settings using data-setting attribute
        var settingValue = button.getAttribute('data-setting');
        if(settingValue) {
            if (isMultipleTablesEnabled) {
                // Toggle behavior: highlight based on visible state
                if (settingValue in appleAmounts && appleAmounts[settingValue].visible) {
                    button.classList.add('active');
                } else if (settingValue in speeds && speeds[settingValue].visible) {
                    button.classList.add('active');
                } else if (settingValue in sizes && sizes[settingValue].visible) {
                    button.classList.add('active');
                }
            } else {
                // Radio behavior: highlight based on current settings
                if(settingValue === currentTableSettings[0] || 
                   settingValue === currentTableSettings[1] || 
                   settingValue === currentTableSettings[2]){
                    button.classList.add('active');
                }
            }
        }
    });
    
    // Also update the refresh button state
    var refreshButton = document.querySelector('.refresh-btn');
    if (refreshButton && !isLoading) {
        refreshButton.disabled = false;
        refreshButton.innerHTML = '🔄 Refresh';
        refreshButton.setAttribute('title', 'Fetch from API (slower but always current)');
    }
    
    // Also update the quick fetch button state
    var quickFetchButton = document.querySelector('.quick-fetch-btn');
    if (quickFetchButton && !isLoading) {
        quickFetchButton.disabled = false;
        quickFetchButton.innerHTML = '🐰 Quick Fetch';
        quickFetchButton.setAttribute('title', 'Fetch from GitHub cache (fast)');
    }
    
    // Update stop/resume button state (should remain enabled)
    var stopResumeButton = document.querySelector('.stop-resume-btn');
    if (stopResumeButton) {
        stopResumeButton.disabled = false;
        stopResumeButton.style.opacity = '1';
        stopResumeButton.style.cursor = 'pointer';
    }
    
    // Also update the time travel button state
    var timeTravelButton = document.querySelector('.time-travel-btn');
    if (timeTravelButton) {
        if(isTimeTravelEnabled) {
            timeTravelButton.innerHTML = '⏰ Time Travel';
            timeTravelButton.classList.add('active');
            timeTravelButton.setAttribute('title', 'Time travel mode enabled. Click to disable.');
        } else {
            timeTravelButton.innerHTML = '⏰ Time Travel';
            timeTravelButton.classList.remove('active');
            timeTravelButton.setAttribute('title', 'Time travel mode disabled. Click to enable.');
        }
    }
    
    // Also update the multiple tables button state
    var multipleTablesButton = document.querySelector('.multiple-tables-btn');
    if (multipleTablesButton) {
        if(isMultipleTablesEnabled) {
            multipleTablesButton.innerHTML = '📊 Multiple Tables';
            multipleTablesButton.classList.add('active');
            multipleTablesButton.setAttribute('title', 'Multiple tables mode enabled. Click to disable.');
        } else {
            multipleTablesButton.innerHTML = '📊 Multiple Tables';
            multipleTablesButton.classList.remove('active');
            multipleTablesButton.setAttribute('title', 'Multiple tables mode disabled. Click to enable.');
        }
    }

    // Restore icons/text toggle label + active (cleared by blanket remove above)
    if (typeof applyCategoryIconsToggleToButton === 'function') {
        applyCategoryIconsToggleToButton(document.getElementById('categoryIconsToggle'));
    }

    // Restore run-mode chip active states (cleared by the blanket remove above)
    document.querySelectorAll('.settings-run-btn').forEach(function (btn) {
        var rm = btn.getAttribute('data-run-mode');
        if (rm && runModes[rm]) {
            btn.classList.toggle('active', !!runModes[rm].visible);
        }
    });
    
    // Double-check that we have the right number of active buttons (should be 3: count, speed, size)
    var activeButtons = document.querySelectorAll('.table-option-btn.active');
}

function generateSingleTable(){
    try {
        // Clear existing content
        removeLeaderboards();
        
        // Only generate table if we have data
        if(Object.keys(worldRecords).length > 0 || (bestRuns && Object.keys(bestRuns).length > 0)) {
            // Ensure worldRecords is populated for summary table
            if(Object.keys(worldRecords).length === 0 && bestRuns && Object.keys(bestRuns).length > 0) {
                // Populate worldRecords from bestRuns for summary table
                worldRecords = {};
                for (const count in bestRuns) {
                    for (const speed in bestRuns[count]) {
                        for (const size in bestRuns[count][speed]) {
                            for (const gamemode in bestRuns[count][speed][size]) {
                                for (const runMode in bestRuns[count][speed][size][gamemode]) {
                                    const key = `${count}|${speed}|${size}|${gamemode}|${runMode}`;
                                    const data = bestRuns[count][speed][size][gamemode][runMode];
                                    if (data && data.success && data.runs && data.runs.length > 0) {
                                        worldRecords[key] = data.runs;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            if(isMultipleTablesEnabled) {
                generateMultipleTables();
            } else {
                generateLeaderboard(currentTableSettings);
                // Also generate the ranglist (summary table)
                //console.log('=== BEFORE CALCULATE RANGLIST ===');
                //console.log('worldRecords keys:', Object.keys(worldRecords));
                //console.log('worldRecords sample:', Object.keys(worldRecords).slice(0, 3).map(key => ({key, runs: worldRecords[key].length})));
                calculateRanglist();
                generateRanglist();
            }
        } else {
            // Show a message that data is loading
            var container = document.querySelector('.container');
            if(container) {
                container.innerHTML = '<p style="color: white; font-size: 18px;">Loading world records...</p>';
            }
        }
    } catch (error) {
        console.error('Error in generateSingleTable:', error);
        console.error('Error stack:', error.stack);
        throw error; // Re-throw the error so it can be caught by the calling function
    }
}

function generateTableSelector(){
    // Create sidebar for table selection
    var sidebar = document.createElement('div');
    sidebar.setAttribute('class', 'table-selector');
    
    // Create sidebar header with info and settings buttons
    var sidebarHeader = document.createElement('div');
    sidebarHeader.setAttribute('class', 'sidebar-header');

    // Collapse/expand toggle (desktop)
    var categoryCollapseBtn = document.createElement('button');
    categoryCollapseBtn.setAttribute('type', 'button');
    categoryCollapseBtn.setAttribute('id', 'categoryCollapseBtn');
    categoryCollapseBtn.setAttribute('class', 'sidebar-settings-btn category-collapse-btn');
    categoryCollapseBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleCategoryCollapsed();
    });
    sidebarHeader.appendChild(categoryCollapseBtn);
    
    // Add Settings title
    var categoryText = document.createElement('h3');
    categoryText.setAttribute('class', 'category-settings-title');
    categoryText.textContent = 'Settings';
    sidebarHeader.appendChild(categoryText);
    
    // Create sidebar info + CE controls (trailing group)
    var sidebarHeaderActions = document.createElement('div');
    sidebarHeaderActions.setAttribute('class', 'sidebar-header-actions');

    var ceDisplayButton = document.createElement('button');
    ceDisplayButton.setAttribute('class', 'sidebar-ce-btn ce-display-btn');
    ceDisplayButton.type = 'button';
    if (typeof applyCeDisplayButtonState === 'function') {
        applyCeDisplayButtonState(ceDisplayButton);
    } else {
        ceDisplayButton.innerHTML = (typeof ceDisplayModeLabel === 'function')
            ? ceDisplayModeLabel(ceDisplayMode)
            : 'CE: Off';
    }
    ceDisplayButton.onclick = function () {
        if (typeof toggleCeDisplayMode === 'function') toggleCeDisplayMode();
    };
    sidebarHeaderActions.appendChild(ceDisplayButton);

    var sidebarInfoBtn = document.createElement('button');
    sidebarInfoBtn.setAttribute('class', 'sidebar-info-btn');
    sidebarInfoBtn.innerHTML = 'ℹ️';
    sidebarInfoBtn.setAttribute('title', 'Info');
    sidebarHeaderActions.appendChild(sidebarInfoBtn);

    sidebarHeader.appendChild(sidebarHeaderActions);
    
    sidebar.appendChild(sidebarHeader);

    // Collapsible body holds all selectors
    var sidebarBody = document.createElement('div');
    sidebarBody.setAttribute('class', 'table-selector-body');
    
    // Add event listeners for sidebar buttons
    sidebarInfoBtn.addEventListener('click', function() {
        var modal = document.getElementById("infoModal");
        if(modal) {
            modal.style.display = "block";
        }
    });

    // Three-column layout: category | modes | time travel
    var settingsLayout = document.createElement('div');
    settingsLayout.setAttribute('class', 'settings-layout');
    var leftCol = document.createElement('div');
    leftCol.setAttribute('class', 'settings-col settings-col-left');
    var centerCol = document.createElement('div');
    centerCol.setAttribute('class', 'settings-col settings-col-center');
    var rightCol = document.createElement('div');
    rightCol.setAttribute('class', 'settings-col settings-col-right');
    settingsLayout.appendChild(leftCol);
    settingsLayout.appendChild(centerCol);
    settingsLayout.appendChild(rightCol);
    sidebarBody.appendChild(settingsLayout);
    // Apple Amount selector
    var appleSelector = document.createElement('div');
    appleSelector.innerHTML = '<label>Apple Amount</label>';
    var appleButtonGroup = document.createElement('div');
    appleButtonGroup.setAttribute('class', 'button-group');
    for(var appleAmount in appleAmounts){
        // Always show all buttons regardless of visible property
        var button = document.createElement('button');
        button.setAttribute('class', 'table-option-btn');
        // Set active class based on current settings
        if (isMultipleTablesEnabled) {
            // Toggle behavior: highlight based on visible state
            if (appleAmounts[appleAmount].visible) {
                button.classList.add('active');
            }
        } else {
            // Radio behavior: highlight based on current settings
            if(currentTableSettings[0] === appleAmount){
                button.classList.add('active');
            }
        }
        button.onclick = function(amount){
            return async function(){
                if (isLoading) return; // Prevent clicks while loading
                
                if (isMultipleTablesEnabled) {
                    // Toggle behavior: toggle the visible state
                    appleAmounts[amount].visible = !appleAmounts[amount].visible;
                } else {
                    // Radio behavior: set only this one as active
                    currentTableSettings[0] = amount;
                }
                
                saveSettings(); // Save settings when changed
                // Update highlighting immediately
                updateTableSelector();
                
                if (isMultipleTablesEnabled) {
                    // When Multiple Tables is enabled, immediately regenerate tables and load from cache
                    generateMultipleTables();
                    // Load data from cache for the newly visible tables using Quick Fetch
                    if (!isLoading) {
                        setLoadingState(true);
                        try {
                            await quickFetchWorldRecords();
                        } catch (error) {
                            console.error('Error in Quick Fetch:', error);
                        } finally {
                            setLoadingState(false);
                        }
                    }
                } else {
                    // Trigger Quick Fetch when Multiple Tables is disabled (radio button behavior)
                    if (!isLoading) {
                        setLoadingState(true);
                        try {
                            await quickFetchWorldRecords();
                            // Regenerate single table with new settings
                            generateSingleTable();
                        } catch (error) {
                            console.error('Error in Quick Fetch:', error);
                        } finally {
                            setLoadingState(false);
                        }
                    }
                }
            };
        }(appleAmount);
        
        // Add icon / text label
        var icon = createIconElement(appleAmounts[appleAmount], appleAmount);
        button.appendChild(icon);
        button.setAttribute('data-setting', appleAmount);
        appleButtonGroup.appendChild(button);
    }
    appleSelector.appendChild(appleButtonGroup);
    
    // Speed selector
    var speedSelector = document.createElement('div');
    speedSelector.innerHTML = '<label>Speed</label>';
    var speedButtonGroup = document.createElement('div');
    speedButtonGroup.setAttribute('class', 'button-group');
    for(var speed in speeds){
        // Always show all buttons regardless of visible property
        var button = document.createElement('button');
        button.setAttribute('class', 'table-option-btn');
        // Set active class based on current settings
        if (isMultipleTablesEnabled) {
            // Toggle behavior: highlight based on visible state
            if (speeds[speed].visible) {
                button.classList.add('active');
            }
        } else {
            // Radio behavior: highlight based on current settings
            if(currentTableSettings[1] === speed){
                button.classList.add('active');
            }
        }
        button.onclick = function(spd){
            return async function(){
                if (isLoading) return; // Prevent clicks while loading
                
                if (isMultipleTablesEnabled) {
                    // Toggle behavior: toggle the visible state
                    speeds[spd].visible = !speeds[spd].visible;
                } else {
                    // Radio behavior: set only this one as active
                    currentTableSettings[1] = spd;
                }
                
                saveSettings(); // Save settings when changed
                // Update highlighting immediately
                updateTableSelector();
                
                if (isMultipleTablesEnabled) {
                    // When Multiple Tables is enabled, immediately regenerate tables and load from cache
                    generateMultipleTables();
                    // Load data from cache for the newly visible tables using Quick Fetch
                    if (!isLoading) {
                        setLoadingState(true);
                        try {
                            await quickFetchWorldRecords();
                        } catch (error) {
                            console.error('Error in Quick Fetch:', error);
                        } finally {
                            setLoadingState(false);
                        }
                    }
                } else {
                    // Trigger Quick Fetch when Multiple Tables is disabled (radio button behavior)
                    if (!isLoading) {
                        setLoadingState(true);
                        try {
                            await quickFetchWorldRecords();
                            // Regenerate single table with new settings
                            generateSingleTable();
                        } catch (error) {
                            console.error('Error in Quick Fetch:', error);
                        } finally {
                            setLoadingState(false);
                        }
                    }
                }
            };
        }(speed);
        
        // Add icon / text label
        var icon = createIconElement(speeds[speed], speed);
        button.appendChild(icon);
        button.setAttribute('data-setting', speed);
        speedButtonGroup.appendChild(button);
    }
    speedSelector.appendChild(speedButtonGroup);
    
    // Size selector
    var sizeSelector = document.createElement('div');
    sizeSelector.innerHTML = '<label>Size</label>';
    var sizeButtonGroup = document.createElement('div');
    sizeButtonGroup.setAttribute('class', 'button-group');
    for(var size in sizes){
        // Always show all buttons regardless of visible property
        var button = document.createElement('button');
        button.setAttribute('class', 'table-option-btn');
        // Set active class based on current settings
        if (isMultipleTablesEnabled) {
            // Toggle behavior: highlight based on visible state
            if (sizes[size].visible) {
                button.classList.add('active');
            }
        } else {
            // Radio behavior: highlight based on current settings
            if(currentTableSettings[2] === size){
                button.classList.add('active');
            }
        }
        button.onclick = function(sz){
            return async function(){
                if (isLoading) return; // Prevent clicks while loading
                
                if (isMultipleTablesEnabled) {
                    // Toggle behavior: toggle the visible state
                    sizes[sz].visible = !sizes[sz].visible;
                } else {
                    // Radio behavior: set only this one as active
                    currentTableSettings[2] = sz;
                }
                
                saveSettings(); // Save settings when changed
                // Update highlighting immediately
                updateTableSelector();
                
                if (isMultipleTablesEnabled) {
                    // When Multiple Tables is enabled, immediately regenerate tables and load from cache
                    generateMultipleTables();
                    // Load data from cache for the newly visible tables using Quick Fetch
                    if (!isLoading) {
                        setLoadingState(true);
                        try {
                            await quickFetchWorldRecords();
                        } catch (error) {
                            console.error('Error in Quick Fetch:', error);
                        } finally {
                            setLoadingState(false);
                        }
                    }
                } else {
                    // Trigger Quick Fetch when Multiple Tables is disabled (radio button behavior)
                    if (!isLoading) {
                        setLoadingState(true);
                        try {
                            await quickFetchWorldRecords();
                            // Regenerate single table with new settings
                            generateSingleTable();
                        } catch (error) {
                            console.error('Error in Quick Fetch:', error);
                        } finally {
                            setLoadingState(false);
                        }
                    }
                }
            };
        }(size);
        
    // Add icon / text label
        var icon = createIconElement(sizes[size], size);
        button.appendChild(icon);
        button.setAttribute('data-setting', size);
        sizeButtonGroup.appendChild(button);
    }
    sizeSelector.appendChild(sizeButtonGroup);
    
    // Always show count/speed/size selectors regardless of multiple tables setting
    leftCol.appendChild(appleSelector);
    leftCol.appendChild(speedSelector);
    leftCol.appendChild(sizeSelector);
    
    // Add options section (refresh and time travel buttons)
    var optionsSelector = document.createElement('div');
    optionsSelector.innerHTML = '<label>Options</label>';
    var optionsButtonGroup = document.createElement('div');
    optionsButtonGroup.setAttribute('class', 'button-group');
    
    var darkModeToggle = document.createElement('button');
    darkModeToggle.setAttribute('class', 'dark-mode-toggle');
    darkModeToggle.innerHTML = isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode';
    darkModeToggle.onclick = toggleDarkMode;
    darkModeToggle.setAttribute('title', isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    optionsButtonGroup.appendChild(darkModeToggle);
    
    var multipleTablesButton = document.createElement('button');
    multipleTablesButton.setAttribute('class', 'table-option-btn multiple-tables-btn');
    if(isMultipleTablesEnabled) {
        multipleTablesButton.innerHTML = '📊 Multiple Tables';
        multipleTablesButton.classList.add('active');
        multipleTablesButton.setAttribute('title', 'Multiple tables mode enabled. Click to disable.');
    } else {
        multipleTablesButton.innerHTML = '📊 Multiple Tables';
        multipleTablesButton.setAttribute('title', 'Multiple tables mode disabled. Click to enable.');
    }
    multipleTablesButton.onclick = toggleMultipleTables;
    optionsButtonGroup.appendChild(multipleTablesButton);
    
    var timeTravelButton = document.createElement('button');
    timeTravelButton.setAttribute('class', 'table-option-btn time-travel-btn');
    if(isTimeTravelEnabled) {
        // Check if the existing button has missing-data class
        const existingButton = document.querySelector('.time-travel-btn');
        const hasMissingData = existingButton && existingButton.classList.contains('missing-data');
        
        if (hasMissingData) {
            timeTravelButton.innerHTML = '⏰ No Data';
            timeTravelButton.classList.add('active', 'missing-data');
            timeTravelButton.setAttribute('title', `No data available for ${window.selectedTimeTravelDate}. Click to disable time travel.`);
        } else {
            timeTravelButton.innerHTML = '⏰ Time Travel';
            timeTravelButton.classList.add('active');
            timeTravelButton.setAttribute('title', `Time travel mode enabled for ${window.selectedTimeTravelDate}. Click to disable.`);
        }
    } else {
        timeTravelButton.innerHTML = '⏰ Time Travel';
        timeTravelButton.setAttribute('title', 'Time travel mode disabled. Click to enable.');
    }
    timeTravelButton.onclick = toggleTimeTravel;
    optionsButtonGroup.appendChild(timeTravelButton);

    var categoryIconsToggle = document.createElement('button');
    categoryIconsToggle.setAttribute('class', 'table-option-btn category-icons-toggle');
    categoryIconsToggle.setAttribute('id', 'categoryIconsToggle');
    categoryIconsToggle.type = 'button';
    categoryIconsToggle.onclick = function () {
        if (typeof toggleCategoryUseIcons === 'function') {
            toggleCategoryUseIcons();
        }
    };
    // Set label on the element itself (not yet in document — querySelector would miss it)
    applyCategoryIconsToggleToButton(categoryIconsToggle);
    optionsButtonGroup.appendChild(categoryIconsToggle);
    
    optionsSelector.appendChild(optionsButtonGroup);
    leftCol.appendChild(optionsSelector);

    // Center: game modes + run modes; Right: time travel
    populateSidebarSettingsExtras(centerCol);

    sidebar.appendChild(sidebarBody);
    
    // Data section removed - no longer needed since only scripts handle API calls
    
    // Add sidebar to page — park tools first so rebuild doesn't destroy them
    parkSettingsTools();
    var existingSidebar = document.querySelector('.table-selector');
    if(existingSidebar){
        existingSidebar.remove();
    }
    // Clicking the collapsed strip expands Settings
    sidebar.addEventListener('click', function(e) {
        if (!isCategoryCollapsed) return;
        if (e.target.closest('#categoryCollapseBtn')) return;
        toggleCategoryCollapsed();
    });

    document.body.insertBefore(sidebar, document.querySelector('.container'));
    mountSettingsTools(rightCol);
    applyPanelCollapseState();
}

function parkSettingsTools() {
    var tools = document.getElementById('settingsTools');
    if (!tools) return;
    var host = document.getElementById('settingsToolsHost');
    if (!host) {
        host = document.createElement('div');
        host.id = 'settingsToolsHost';
        host.setAttribute('hidden', '');
        document.body.appendChild(host);
    }
    host.appendChild(tools);
}

function mountSettingsTools(rightCol) {
    var tools = document.getElementById('settingsTools');
    if (!tools || !rightCol) return;
    var toolsWrap = document.createElement('div');
    toolsWrap.setAttribute('class', 'settings-panel-section settings-tools-section');
    var toolsLabel = document.createElement('label');
    toolsLabel.textContent = 'Time Travel';
    toolsWrap.appendChild(toolsLabel);
    toolsWrap.appendChild(tools);
    rightCol.appendChild(toolsWrap);
}

function populateSidebarSettingsExtras(rightCol) {
    // Game modes
    var modeSection = document.createElement('div');
    modeSection.setAttribute('class', 'settings-panel-section');
    modeSection.innerHTML = '<label>Game Modes</label>';
    var modeGroup = document.createElement('div');
    modeGroup.setAttribute('class', 'button-group settings-mode-group');
    for (var gamemode in gamemodes) {
        if (typeof isCeLevelMode === 'function' && isCeLevelMode(gamemode)) {
            if (typeof getCeDisplayMode === 'function' && getCeDisplayMode() === 'off') continue;
        } else if (typeof getCeDisplayMode === 'function' && getCeDisplayMode() === 'only') {
            continue;
        }
        modeGroup.appendChild(createOptionButton(gamemodes[gamemode], gamemode));
    }
    modeSection.appendChild(modeGroup);
    rightCol.appendChild(modeSection);

    // Run modes — toggle chips matching sidebar theme
    var runSection = document.createElement('div');
    runSection.setAttribute('class', 'settings-panel-section');
    runSection.innerHTML = '<label>Run Modes</label>';
    var runGroup = document.createElement('div');
    runGroup.setAttribute('class', 'button-group settings-run-group');
    for (var runMode in runModes) {
        (function (rm) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.setAttribute('class', 'table-option-btn settings-run-btn');
            btn.setAttribute('data-run-mode', rm);
            btn.textContent = runModes[rm].text;
            if (runModes[rm].visible) btn.classList.add('active');
            btn.addEventListener('click', function () {
                if (isLoading) return;
                runModes[rm].visible = !runModes[rm].visible;
                btn.classList.toggle('active', !!runModes[rm].visible);
                saveSettings();
                switchMode(2);
            });
            runGroup.appendChild(btn);
        })(runMode);
    }
    runSection.appendChild(runGroup);
    rightCol.appendChild(runSection);
}

// Legacy stub kept so older callers don't break — extras now live in the sidebar
function populateSettingsModalOptionButtons() {
    // no-op: game/run mode controls are built in populateSidebarSettingsExtras
}

function generateRanglist(){
    // Remove any existing summary table first
    var existingRanglist = document.querySelector('.ranglist-wrapper');
    if (existingRanglist) {
        existingRanglist.remove();
    }

    // Panel shell with collapse toggle
    var ranglistWrapper = document.createElement('div');
    ranglistWrapper.setAttribute('class', 'table-wrapper ranglist-wrapper');

    var panelHeader = document.createElement('div');
    panelHeader.setAttribute('class', 'ranglist-panel-header');

    var summaryTitle = document.createElement('h3');
    summaryTitle.setAttribute('class', 'ranglist-panel-title');
    summaryTitle.textContent = 'Rankings';
    panelHeader.appendChild(summaryTitle);

    var summaryCollapseBtn = document.createElement('button');
    summaryCollapseBtn.setAttribute('type', 'button');
    summaryCollapseBtn.setAttribute('id', 'summaryCollapseBtn');
    summaryCollapseBtn.setAttribute('class', 'panel-collapse-btn summary-collapse-btn');
    summaryCollapseBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleSummaryCollapsed();
    });
    panelHeader.appendChild(summaryCollapseBtn);
    ranglistWrapper.appendChild(panelHeader);

    var scrollBody = document.createElement('div');
    scrollBody.setAttribute('class', 'ranglist-scroll');
    
    var table = document.createElement('table');
    table.setAttribute('class', 'ranglist mode'+mode);
    var thead = document.createElement('thead');
    
    // Create a single header row with proper column structure
    var row = document.createElement('tr');
    
    // Player column header
    var nameHeader = document.createElement('th');
    nameHeader.textContent = 'Player';
    nameHeader.setAttribute('class', 'ranglist-player-header');
    row.appendChild(nameHeader);
    
    // Count column header
    var countHeader = document.createElement('th');
    countHeader.textContent = 'Count';
    countHeader.setAttribute('class', 'ranglist-count-header');
    row.appendChild(countHeader);
    
    // Overall% = share of selected categories
    var overallHeader = document.createElement('th');
    overallHeader.textContent = 'Overall%';
    overallHeader.setAttribute('class', 'ranglist-percentage-header ranglist-overall-header');
    row.appendChild(overallHeader);

    // Relative% = share of all counted player WRs (old calculation)
    var relativeHeader = document.createElement('th');
    relativeHeader.textContent = 'Relative%';
    relativeHeader.setAttribute('class', 'ranglist-percentage-header ranglist-relative-header');
    row.appendChild(relativeHeader);
    
    thead.appendChild(row);
    table.append(thead);

    var tbody = document.createElement('tbody');
    var values = []

    // Get unique count values for sorting
    for(var j = 0; j < ranglist.length; j++){
        //console.log('Processing ranglist item', j, ':', ranglist[j]);
        if(values.indexOf(ranglist[j][0]) == -1){
            values.push(ranglist[j][0]);
        }
    }
    //console.log('Unique values:', values);
    values = values.sort(function(a, b){return b-a});
    
    for(value of values){
        //console.log('Processing value:', value);
        for(var j = 0; j < ranglist.length; j++){
            if(ranglist[j][0] == value){
                // All users in the data have proper names, no need to filter anonymous users
                row = document.createElement('tr');
                row.setAttribute('class','ranglistRow result');

                // Player name column
                var td = document.createElement('td');
                td.setAttribute('class', 'ranglist-player-cell');
                td.appendChild(createNameElement(ranglist[j][1]))
                row.appendChild(td);

                // Count column
                td = document.createElement('td');
                td.setAttribute('class','ranglist-count-cell percentage result');
                td.appendChild(document.createTextNode(ranglist[j][0]));
                row.appendChild(td);

                // Overall% column
                td = document.createElement('td');
                td.setAttribute('class','ranglist-percentage-cell ranglist-overall-cell percentage result');
                td.appendChild(document.createTextNode(ranglist[j][2]+"%"));
                row.appendChild(td);

                // Relative% column
                td = document.createElement('td');
                td.setAttribute('class','ranglist-percentage-cell ranglist-relative-cell percentage result');
                td.appendChild(document.createTextNode(ranglist[j][3]+"%"));
                row.appendChild(td);
                tbody.appendChild(row);
            }
        }
    }

    table.appendChild(tbody);
    scrollBody.appendChild(table);
    ranglistWrapper.appendChild(scrollBody);
    
    // Clicking the collapsed strip expands the summary
    ranglistWrapper.addEventListener('click', function(e) {
        if (!isSummaryCollapsed) return;
        if (e.target.closest('#summaryCollapseBtn')) return;
        toggleSummaryCollapsed();
    });

    document.getElementsByClassName("container")[0].appendChild(ranglistWrapper);
    applyPanelCollapseState();
    if (typeof ensureStatisticsExplorer === 'function') {
        ensureStatisticsExplorer();
    }
    if (typeof refreshStatisticsExplorer === 'function') {
        refreshStatisticsExplorer();
    }
}

function removeLeaderboards(){
    var root =  document.getElementsByClassName("container")[0]
    while (root.firstChild) {
        root.removeChild(root.lastChild);
    }    
}

function generateMultipleTables(){
    // Clear existing content
    removeLeaderboards();
    
    // Only generate tables if we have data
    if(Object.keys(worldRecords).length > 0 || (bestRuns && Object.keys(bestRuns).length > 0)) {
        // Ensure worldRecords is populated for summary table
        if(Object.keys(worldRecords).length === 0 && bestRuns && Object.keys(bestRuns).length > 0) {
            // Populate worldRecords from bestRuns for summary table
            worldRecords = {};
            for (const count in bestRuns) {
                for (const speed in bestRuns[count]) {
                    for (const size in bestRuns[count][speed]) {
                        for (const gamemode in bestRuns[count][speed][size]) {
                            for (const runMode in bestRuns[count][speed][size][gamemode]) {
                                const key = `${count}|${speed}|${size}|${gamemode}|${runMode}`;
                                const data = bestRuns[count][speed][size][gamemode][runMode];
                                if (data && data.success && data.runs && data.runs.length > 0) {
                                    worldRecords[key] = data.runs;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Get all selected combinations from the settings popup
        var selectedCombinations = [];
        
        // Get selected apple amounts
        var selectedAppleAmounts = [];
        for(var appleAmount in appleAmounts) {
            if(appleAmounts[appleAmount].visible) {
                selectedAppleAmounts.push(appleAmount);
            }
        }
        
        // Get selected speeds
        var selectedSpeeds = [];
        for(var speed in speeds) {
            if(speeds[speed].visible) {
                selectedSpeeds.push(speed);
            }
        }
        
        // Get selected sizes
        var selectedSizes = [];
        for(var size in sizes) {
            if(sizes[size].visible) {
                selectedSizes.push(size);
            }
        }
        
        // Generate all combinations of apple amount, speed, and size
        for(var i = 0; i < selectedAppleAmounts.length; i++) {
            for(var j = 0; j < selectedSpeeds.length; j++) {
                for(var k = 0; k < selectedSizes.length; k++) {
                    var combination = [selectedAppleAmounts[i], selectedSpeeds[j], selectedSizes[k]];
                    selectedCombinations.push(combination);
                }
            }
        }
        
        // Create a container for multiple tables
        var multipleTablesContainer = document.createElement('div');
        multipleTablesContainer.setAttribute('class', 'multiple-tables-container');
        multipleTablesContainer.style.gridArea = 'main';
        
        // Generate a table for each combination
        for(var i = 0; i < selectedCombinations.length; i++) {
            var combo = selectedCombinations[i];
            generateLeaderboardForMultiple(combo, multipleTablesContainer);
        }
        
        // Add the multiple tables container to the main container
        document.getElementsByClassName("container")[0].appendChild(multipleTablesContainer);
        
        // Also generate the ranglist (summary table)
        calculateRanglist();
        generateRanglist();
    } else {
        // Show a message that data is loading
        var container = document.querySelector('.container');
        if(container) {
            container.innerHTML = '<p style="color: white; font-size: 18px;">Loading world records...</p>';
        }
    }
}
