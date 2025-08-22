// UI Generation Module
// Handles all table generation, sidebar creation, and UI elements

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
    generateRunHolder(bestRuns);
    
    // Process world records directly
    for(var key in worldRecords){
        var runs = worldRecords[key];
        var settings = key.split("|");
        var appleAmount = settings[0];
        var speed = settings[1];
        var size = settings[2];
        var gamemode = settings[3];
        var runMode = settings[4];
        
        try{
            // Store all runs for this combination
            bestRuns[appleAmount][speed][size][gamemode][runMode] = runs;
            
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
}

function calculateRanglist(){
    ranglist = [];
    
    // Count world records per player
    for(var key in worldRecords){
        var runs = worldRecords[key];
        var settings = key.split("|");
        var appleAmount = settings[0];
        var speed = settings[1];
        var size = settings[2];
        var gamemode = settings[3];
        var runMode = settings[4];
        
        // When multiple tables is disabled, only count the currently selected category
        if(!isMultipleTablesEnabled) {
            if(appleAmount === currentTableSettings[0] && 
               speed === currentTableSettings[1] && 
               size === currentTableSettings[2]) {
                // Count each run for each player
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
        } else {
            // When multiple tables is enabled, count all visible categories
            if(appleAmounts[appleAmount].visible && 
               speeds[speed].visible && 
               sizes[size].visible && 
               gamemodes[gamemode].visible && 
               runModes[runMode].visible){
                
                // Count each run for each player
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
        }
    }
    
    //calculate total
    total = 0;
    for(user in ranglist){
        total += ranglist[user][0];
    }
    //calculate percentages
    if(total != 0){
        for(user in ranglist){
            ranglist[user][2] = roundNumber(ranglist[user][0]*100/total,2);
        }
    }

    ranglist = ranglist.sort(function(a, b){return b-a});
}

function createIconElement(setting){
    if(setting.icon == null){
        return document.createTextNode(setting.text);
    }
    else{
        var img = document.createElement('img');
        img.setAttribute('src',setting.icon);
        img.setAttribute('alt',setting.text);
        return img;
    }
}

function createTimeElement(times){
    ptformatter = function primaryTimeFormatter(pt){
        pt = pt.replace("PT","");
        if(pt.indexOf("M") == -1){
            pt = "0M"+pt;
        }
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

    var span = document.createElement('span');
    span.setAttribute('class','time');
    var text;
    if(times.primary_t < 1){
        text = atformatter(times.primary);
    }
    else{
        text = ptformatter(times.primary);
    }
    span.innerHTML = text;
    return span;
}

function createNameElement(user){
    
    var span = document.createElement('span');
    span.setAttribute('class', 'name');
    var a = document.createElement('a');
    a.setAttribute('href', user.weblink);
    a.setAttribute('target','_blank');
    if(user.rel == "user"){
        span.appendChild(document.createTextNode(user.names.international));
        // Add safety check for name-style property
        if(user["name-style"] && user["name-style"].style == "gradient"){
            var colorfrom = user["name-style"]["color-from"].dark;
            var colorto = user["name-style"]["color-to"].dark;
            // Apply gradient using CSS - try a more compatible approach
            span.style.background = `linear-gradient(90deg, ${colorfrom}, ${colorto})`;
            span.style.webkitBackgroundClip = "text";
            span.style.webkitTextFillColor = "transparent";
            span.style.backgroundClip = "text";
            span.style.color = "transparent";
            span.style.display = "inline-block"; // Ensure the gradient works
        }
        else if(user["name-style"] && user["name-style"]["color"]){
            var color = user["name-style"]["color"].dark;
            // Apply solid color
            span.style.color = color;
        }
        else{
            // Default colors if name-style is missing
            span.style.color = "#ffffff";
        }
    }
    else{
        span.appendChild(document.createTextNode(user.name))
        span.style.color = "#000000";
    }

    a.appendChild(span);
    return a;
}

function generateLeaderboard(settings, specificGamemode = null){
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
     const highscoreModes = ["Wall", "Portal", "Key", "Sokoban", "Poison", "Minesweeper", "Statue", "Shield", "Hotdog", "Gate", "Cheese"];
     
     for(gamemode in thisBoardRuns){
         if(gamemodes[gamemode].visible){
             for(runMode in thisBoardRuns[gamemode]){
                 // Only show "High Score" column for highscore modes
                 if(runMode === "High Score" && !highscoreModes.includes(gamemode)){
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
    
    //create thead
    var thead = document.createElement('thead');
    var row;
    var th;
    var td;
    row = document.createElement('tr');
    th = document.createElement('th');
    th.setAttribute('class', 'settingsRow');
    th.setAttribute('colspan', thisBoardRunModes.length+1);
    th.appendChild(createIconElement(appleAmounts[settings[0]]));
    th.appendChild(createIconElement(speeds[settings[1]]));
    th.appendChild(createIconElement(sizes[settings[2]]));
    
    row.appendChild(th);
    thead.appendChild(row);

    row = document.createElement('tr');
    // Create the first header cell (to the left of "25 Apples")
    var firstHeaderCell = document.createElement('th');
    
    // Add individual refresh button to the first header cell when multiple tables mode is enabled
    if (isMultipleTablesEnabled) {
        var refreshButton = document.createElement('button');
        refreshButton.setAttribute('class', 'table-option-btn refresh-btn individual-refresh-btn');
        refreshButton.innerHTML = '🔄';
        refreshButton.setAttribute('title', `Refresh ${settings[0]} ${settings[1]} ${settings[2]} table`);
        refreshButton.onclick = function(settings) {
            return async function() {
                if (isLoading) return; // Prevent clicks while loading
                await refreshSpecificTable(settings);
            };
        }(settings);
        
        // Add button to the first header cell
        firstHeaderCell.appendChild(refreshButton);
    }
    
    row.appendChild(firstHeaderCell);
    for(runMode of thisBoardRunModes){
        let th = document.createElement('th');
        th.appendChild(createIconElement(runModes[runMode]));
        row.appendChild(th);
    }
    thead.appendChild(row);
    table.appendChild(thead);

    //creat tbody
    var tbody = document.createElement('tbody');
    for(gamemode in thisBoardRuns){
        if(gamemodes[gamemode].visible && (specificGamemode === null || gamemode === specificGamemode)){
            row = document.createElement('tr');
            th = document.createElement('th');
            th.appendChild(createIconElement(gamemodes[gamemode]));
            row.appendChild(th);

            for(runMode of thisBoardRunModes){
                td = document.createElement('td');
                if(typeof(thisBoardRuns[gamemode][runMode]) != 'undefined'){
                    td.setAttribute('class','result');
                    if(thisBoardRuns[gamemode][runMode].length != 0){
                        // Create a container for all runs
                        var runsContainer = document.createElement('div');
                        runsContainer.setAttribute('class', 'runs-container');
                        
                        // Add time display (same for all tied runs) - link to first run
                        var timeDisplay = document.createElement('div');
                        timeDisplay.setAttribute('class', 'time-display');
                        var timeLink = document.createElement('a');
                        timeLink.setAttribute('href', thisBoardRuns[gamemode][runMode][0].weblink);
                        timeLink.setAttribute('target', '_blank');
                        timeLink.appendChild(createTimeElement(thisBoardRuns[gamemode][runMode][0].times));
                        timeDisplay.appendChild(timeLink);
                        runsContainer.appendChild(timeDisplay);
                        
                        // Add all player names with their individual links
                        for(var i = 0; i < thisBoardRuns[gamemode][runMode].length; i++){
                            var run = thisBoardRuns[gamemode][runMode][i];
                            var playerLink = document.createElement('a');
                            playerLink.setAttribute('href', run.weblink);
                            playerLink.setAttribute('target','_blank');
                            playerLink.appendChild(createNameElement(run.players.data[0]));
                            
                            // Add separator between players (except for the last one)
                            if(i < thisBoardRuns[gamemode][runMode].length - 1) {
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
    const highscoreModes = ["Wall", "Portal", "Key", "Sokoban", "Poison", "Minesweeper", "Statue", "Shield", "Hotdog", "Gate", "Cheese"];
    
    for(gamemode in thisBoardRuns){
        if(gamemodes[gamemode].visible){
            for(runMode in thisBoardRuns[gamemode]){
                // Only show "High Score" column for highscore modes
                if(runMode === "High Score" && !highscoreModes.includes(gamemode)){
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
    
    //create thead
    var thead = document.createElement('thead');
    var row;
    var th;
    var td;
    row = document.createElement('tr');
    th = document.createElement('th');
    th.setAttribute('class', 'settingsRow');
    th.setAttribute('colspan', thisBoardRunModes.length+1);
    th.appendChild(createIconElement(appleAmounts[settings[0]]));
    th.appendChild(createIconElement(speeds[settings[1]]));
    th.appendChild(createIconElement(sizes[settings[2]]));
    
    row.appendChild(th);
    thead.appendChild(row);

    row = document.createElement('tr');
    // Create the first header cell (to the left of "25 Apples")
    var firstHeaderCell = document.createElement('th');
    
    // Add individual refresh button to the first header cell when multiple tables mode is enabled
    if (isMultipleTablesEnabled) {
        var refreshButton = document.createElement('button');
        refreshButton.setAttribute('class', 'table-option-btn refresh-btn individual-refresh-btn');
        refreshButton.innerHTML = '🔄';
        refreshButton.setAttribute('title', `Refresh ${settings[0]} ${settings[1]} ${settings[2]} table`);
        refreshButton.onclick = function(settings) {
            return async function() {
                if (isLoading) return; // Prevent clicks while loading
                await refreshSpecificTable(settings);
            };
        }(settings);
        
        // Add button to the first header cell
        firstHeaderCell.appendChild(refreshButton);
    }
    
    row.appendChild(firstHeaderCell);
    for(runMode of thisBoardRunModes){
        let th = document.createElement('th');
        th.appendChild(createIconElement(runModes[runMode]));
        row.appendChild(th);
    }
    thead.appendChild(row);
    table.appendChild(thead);

    //creat tbody
    var tbody = document.createElement('tbody');
    for(gamemode in thisBoardRuns){
        if(gamemodes[gamemode].visible){
            row = document.createElement('tr');
            th = document.createElement('th');
            th.appendChild(createIconElement(gamemodes[gamemode]));
            row.appendChild(th);

            for(runMode of thisBoardRunModes){
                td = document.createElement('td');
                if(typeof(thisBoardRuns[gamemode][runMode]) != 'undefined'){
                    td.setAttribute('class','result');
                    if(thisBoardRuns[gamemode][runMode].length != 0){
                        // Create a container for all runs
                        var runsContainer = document.createElement('div');
                        runsContainer.setAttribute('class', 'runs-container');
                        
                        // Add time display (same for all tied runs) - link to first run
                        var timeDisplay = document.createElement('div');
                        timeDisplay.setAttribute('class', 'time-display');
                        var timeLink = document.createElement('a');
                        timeLink.setAttribute('href', thisBoardRuns[gamemode][runMode][0].weblink);
                        timeLink.setAttribute('target', '_blank');
                        timeLink.appendChild(createTimeElement(thisBoardRuns[gamemode][runMode][0].times));
                        timeDisplay.appendChild(timeLink);
                        runsContainer.appendChild(timeDisplay);
                        
                        // Add all player names with their individual links
                        for(var i = 0; i < thisBoardRuns[gamemode][runMode].length; i++){
                            var run = thisBoardRuns[gamemode][runMode][i];
                            var playerLink = document.createElement('a');
                            playerLink.setAttribute('href', run.weblink);
                            playerLink.setAttribute('target','_blank');
                            playerLink.appendChild(createNameElement(run.players.data[0]));
                            
                            // Add separator between players (except for the last one)
                            if(i < thisBoardRuns[gamemode][runMode].length - 1) {
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

function generateSingleTable(){
    // Clear existing content
    removeLeaderboards();
    
    // Only generate table if we have data
    if(Object.keys(worldRecords).length > 0) {
        if(isMultipleTablesEnabled) {
            generateMultipleTables();
        } else {
            generateLeaderboard(currentTableSettings);
            // Also generate the ranglist (summary table)
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
}

function generateTableSelector(){
    // Create sidebar for table selection
    var sidebar = document.createElement('div');
    sidebar.setAttribute('class', 'table-selector');
    
    // Create sidebar header with info and settings buttons
    var sidebarHeader = document.createElement('div');
    sidebarHeader.setAttribute('class', 'sidebar-header');
    
    // Add Category Settings text
    var categoryText = document.createElement('h3');
    categoryText.textContent = 'Category Settings';
    categoryText.style.margin = '0';
    categoryText.style.flex = '1';
    categoryText.style.textAlign = 'center';
    sidebarHeader.appendChild(categoryText);
    
    // Create sidebar info button
    var sidebarInfoBtn = document.createElement('button');
    sidebarInfoBtn.setAttribute('class', 'sidebar-info-btn');
    sidebarInfoBtn.innerHTML = 'ℹ️';
    sidebarInfoBtn.setAttribute('title', 'Info');
    sidebarHeader.appendChild(sidebarInfoBtn);
    
    // Create sidebar settings button
    var sidebarSettingsBtn = document.createElement('button');
    sidebarSettingsBtn.setAttribute('class', 'sidebar-settings-btn');
    sidebarSettingsBtn.innerHTML = '⚙️';
    sidebarSettingsBtn.setAttribute('title', 'Settings');
    sidebarHeader.appendChild(sidebarSettingsBtn);
    
    sidebar.appendChild(sidebarHeader);
    
    // Add event listeners for sidebar buttons
    sidebarInfoBtn.addEventListener('click', function() {
        var modal = document.getElementById("infoModal");
        if(modal) {
            modal.style.display = "block";
        }
    });
    
    sidebarSettingsBtn.addEventListener('click', function() {
        var modal2 = document.getElementById("settingsModal");
        if(modal2) {
            modal2.style.display = "block";
        }
    });
    
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
                // Trigger refresh when Multiple Tables is disabled (radio button behavior)
                if (!isMultipleTablesEnabled) {
                    refreshWorldRecordsForSettings();
                }
            };
        }(appleAmount);
        
        // Add icon instead of text
        var icon = createIconElement(appleAmounts[appleAmount]);
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
                // Trigger refresh when Multiple Tables is disabled (radio button behavior)
                if (!isMultipleTablesEnabled) {
                    refreshWorldRecordsForSettings();
                }
            };
        }(speed);
        
        // Add icon instead of text
        var icon = createIconElement(speeds[speed]);
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
                // Trigger refresh when Multiple Tables is disabled (radio button behavior)
                if (!isMultipleTablesEnabled) {
                    refreshWorldRecordsForSettings();
                }
            };
        }(size);
        
        // Add icon instead of text
        var icon = createIconElement(sizes[size]);
        button.appendChild(icon);
        button.setAttribute('data-setting', size);
        sizeButtonGroup.appendChild(button);
    }
    sizeSelector.appendChild(sizeButtonGroup);
    
    // Always show count/speed/size selectors regardless of multiple tables setting
    sidebar.appendChild(appleSelector);
    sidebar.appendChild(speedSelector);
    sidebar.appendChild(sizeSelector);
    
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
    
    var refreshButton = document.createElement('button');
    refreshButton.setAttribute('class', 'table-option-btn refresh-btn');
    refreshButton.innerHTML = '🔄 Refresh';
    refreshButton.onclick = refreshWorldRecordsForSettings;
    optionsButtonGroup.appendChild(refreshButton);
    
    var timeTravelButton = document.createElement('button');
    timeTravelButton.setAttribute('class', 'table-option-btn time-travel-btn');
    if(isTimeTravelEnabled) {
        timeTravelButton.innerHTML = '⏰ Time Travel';
        timeTravelButton.classList.add('active');
        timeTravelButton.setAttribute('title', 'Time travel mode enabled. Click to disable.');
    } else {
        timeTravelButton.innerHTML = '⏰ Time Travel';
        timeTravelButton.setAttribute('title', 'Time travel mode disabled. Click to enable.');
    }
    timeTravelButton.onclick = toggleTimeTravel;
    optionsButtonGroup.appendChild(timeTravelButton);
    
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
    
    optionsSelector.appendChild(optionsButtonGroup);
    sidebar.appendChild(optionsSelector);
    
    // Add data section (API call progress)
    var dataSelector = document.createElement('div');
    dataSelector.innerHTML = '<label>Data</label>';
    
    // Create a container for the data content (API calls and stop button)
    var dataContentContainer = document.createElement('div');
    dataContentContainer.setAttribute('class', 'data-content-container');
    var dataInfo = document.createElement('div');
    dataInfo.setAttribute('class', 'data-info');
    dataInfo.setAttribute('id', 'dataInfo');
    
    // Create progress display (centered)
    var progressDisplay = document.createElement('div');
    progressDisplay.setAttribute('class', 'progress-display');
    progressDisplay.innerHTML = `API Calls: <span id="apiProgress">0/0</span>`;
    dataInfo.appendChild(progressDisplay);
    
    // Create stop/resume button (outside but inline)
    var stopResumeButton = document.createElement('button');
    stopResumeButton.setAttribute('class', 'stop-resume-btn');
    stopResumeButton.setAttribute('id', 'stopResumeBtn');
    stopResumeButton.innerHTML = '⏸️ Stop';
    stopResumeButton.setAttribute('title', 'Stop API calls');
    stopResumeButton.style.display = 'none'; // Hidden by default
    stopResumeButton.onclick = toggleApiPause;
    
    // Add both elements to the content container
    dataContentContainer.appendChild(dataInfo);
    dataContentContainer.appendChild(stopResumeButton);
    dataSelector.appendChild(dataContentContainer);
    sidebar.appendChild(dataSelector);
    
    // Add sidebar to page
    var existingSidebar = document.querySelector('.table-selector');
    if(existingSidebar){
        existingSidebar.remove();
    }
    document.body.insertBefore(sidebar, document.querySelector('.container'));
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
        refreshButton.setAttribute('title', 'Refresh world records for current settings');
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
    
    // Double-check that we have the right number of active buttons (should be 3: count, speed, size)
    var activeButtons = document.querySelectorAll('.table-option-btn.active');
}

function generateRanglist(){
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
    
    // Percentage column header
    var percentageHeader = document.createElement('th');
    percentageHeader.textContent = 'Percentage';
    percentageHeader.setAttribute('class', 'ranglist-percentage-header');
    row.appendChild(percentageHeader);
    
    thead.appendChild(row);
    table.append(thead);

    var i = 0;
    var tbody = document.createElement('tbody');
    var values = []

    for(id in ranglist){
        if(values.indexOf(ranglist[id][0]) == -1){
            values.push(ranglist[id][0]);
        }
    }
    values = values.sort(function(a, b){return b-a});
    
    for(value of values){
        for(id in ranglist){
            if(ranglist[id][0] == value){

                //delete anonymous
                if(ranglist[id][1].rel != "user"){
                    continue;
                }
                
                row = document.createElement('tr');
                row.setAttribute('class','ranglistRow result');

                // Player name column
                var td = document.createElement('td');
                td.setAttribute('class', 'ranglist-player-cell');
                td.appendChild(createNameElement(ranglist[id][1]))
                row.appendChild(td);

                // Count column
                td = document.createElement('td');
                td.setAttribute('class','ranglist-count-cell percentage result');
                td.appendChild(document.createTextNode(ranglist[id][0]));
                row.appendChild(td);

                // Percentage column
                td = document.createElement('td');
                td.setAttribute('class','ranglist-percentage-cell percentage result');
                td.appendChild(document.createTextNode(ranglist[id][2]+"%"));
                row.appendChild(td);
                if(i >= maxRanglistLength){
                    row.setAttribute('style','display:none');
                }
                tbody.appendChild(row);
                i+=1;
            }
        }
    }
    if(i >  maxRanglistLength){
        // Create button outside the table structure
        b = document.createElement('button');
        b.setAttribute('id','morebutton');
        b.setAttribute('class', 'more-runners-btn');
        b.appendChild(document.createTextNode("Click here to see all runners"));
        b.addEventListener('click', () => {
            for(row of document.getElementsByClassName('ranglistRow')){
                row.setAttribute('style','');
            }
            document.getElementById("morebutton").setAttribute('style','display:none');
        });
    }

    table.appendChild(tbody);
    
    // Create a wrapper for the ranglist table
    var ranglistWrapper = document.createElement('div');
    ranglistWrapper.setAttribute('class', 'table-wrapper ranglist-wrapper');
    ranglistWrapper.style.gridArea = 'ranglist'; // Ensure grid area is set
    ranglistWrapper.appendChild(table);
    
    // Add the "more runners" button after the table if it exists
    if(i > maxRanglistLength){
        ranglistWrapper.appendChild(b);
    }
    
    // Add speed_01 icon under the summary table
    var speedIcon = document.createElement('img');
    speedIcon.setAttribute('src', 'https://www.google.com/logos/fnbx/snake_arcade/v3/speed_01.png');
    speedIcon.setAttribute('alt', 'Bunny!');
    speedIcon.setAttribute('style', 'display: block; margin: 20px auto; max-width: 100px; height: auto;');
    ranglistWrapper.appendChild(speedIcon);
    
    document.getElementsByClassName("container")[0].appendChild(ranglistWrapper);
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
    if(Object.keys(worldRecords).length > 0) {
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
