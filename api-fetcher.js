// API & Data Fetching Module
// Handles all API calls, world record fetching, and data processing

function makeAPIrequest(requestURL, callback){
    // Add id to solve query issue
    hasQuery = requestURL.includes("?")
    url = requestURL
    if(hasQuery){
        url += "&"
    }
    else{
        url += "?"
    }
    url += "_=" + new Date().getTime()

    let request = new XMLHttpRequest();
	request.open("GET", url);
    
    // Add proper headers for API requests
    request.setRequestHeader('Accept', 'application/json');
    
    request.onload = function(){
        if(request.status == 200){
            requestsMade+=1;
            try {
                let response = JSON.parse(request.response);
                callback(response);
            } catch(e) {
                // Return empty data on parse error
                callback({data: []});
            }
        }
        else if(request.status == 429) {
            // Rate limited - wait and retry
            setTimeout(() => {
                makeAPIrequest(requestURL, callback);
            }, 5000);
        }
        else{
            // Retry with exponential backoff
            if(requestsMade < 5) {
                let delay = Math.pow(2, requestsMade) * 1000; // 1s, 2s, 4s, 8s
                setTimeout(() => {
                    makeAPIrequest(requestURL, callback);
                }, delay);
            } else {
                callback({data: []}); // Return empty data to continue
            }
        }
    }
    request.onerror = function() {
        // Retry with exponential backoff
        if(requestsMade < 5) {
            let delay = Math.pow(2, requestsMade) * 1000;
            setTimeout(() => {
                makeAPIrequest(requestURL, callback);
            }, delay);
        } else {
            callback({data: []}); // Return empty data to continue
        }
    }
    
    // Add timeout
    request.timeout = 10000; // 10 second timeout
    request.ontimeout = function() {
        if(requestsMade < 3) {
            setTimeout(() => {
                makeAPIrequest(requestURL, callback);
            }, 2000);
        } else {
            callback({data: []});
        }
    }
    
    request.send();
}

function getGameDetails(callback){
    var amount = 3 * gameIDs.length;
    var i = 0
    var ifDone = function(){
        i+=1;
        if(i == amount){
            callback();
        }
    }
    
    // Test the API first to see what's working
    
    for(gameID of gameIDs){
        // Try the new API structure
        makeAPIrequest("https://www.speedrun.com/api/v1/games/"+gameID+"/variables", (x) => {
            if(x.data) {
                variables.push.apply(variables, x.data);
            }
            ifDone();
        });
        makeAPIrequest("https://www.speedrun.com/api/v1/games/"+gameID+"/categories?embed=game", (x) => {
            if(x.data) {
                categories.push.apply(categories, x.data);
            }
            ifDone();
        });
        makeAPIrequest("https://www.speedrun.com/api/v1/games/"+gameID+"/levels", (x) => {
            if(x.data) {
                levels.push.apply(levels, x.data);
            }
            ifDone();
        });
    }
}

function getWorldRecords(gameID, callback){
    var count = 0;
    var total = 0;

    for(category of categories){
        if(category.game.data.id == gameID){
            total +=1;
        }
    }

    var ifdone = function(){
        count+=1;
        if(count == total){
            callback();
        }
    }

    for(category of categories){
        if(category.game.data.id == gameID){
            getWorldRecordsForCategory(gameID, ifdone, category.id);
        }
    }
}

function getWorldRecordsForCategory(gameID, callback, categoryId){
    // Fetch multiple records to find the best one for each combination
    makeAPIrequest("https://www.speedrun.com/api/v1/runs?game="+gameID+"&max=50&embed=players&status=verified&category="+categoryId, (x) => {
        if(x.data && x.data.length > 0){
            
            // Process all runs to find the best one for each combination
            var bestRunsForCategory = {};
            
            for(var i = 0; i < x.data.length; i++){
                var run = x.data[i];
                var settings = getSettingsFromRun(run);
                if(settings.indexOf(undefined) == -1){
                    try{
                        var key = settings[0] + "|" + settings[1] + "|" + settings[2] + "|" + settings[3] + "|" + settings[4];
                        
                        // Only store if we don't have a record for this combination yet, or if this run is better (faster)
                        if(!bestRunsForCategory[key] || run.times.primary_t < bestRunsForCategory[key].times.primary_t){
                            bestRunsForCategory[key] = run;
                        }
                    }
                    catch(e){
                    }
                }
            }
            
            // Store the best runs for this category
            for(var key in bestRunsForCategory){
                worldRecords[key] = bestRunsForCategory[key];
                
                var run = bestRunsForCategory[key];
                if(typeof(players[run.players.data[0].names.international]) == 'undefined'){
                    players[run.players.data[0].names.international] = run.players.data[0].id;
                }
            }
            
        } else {
        }
        if(typeof(callback) != "undefined"){
            callback();
        }
    });
}

// Test API connectivity
function testAPIConnectivity(callback) {
    // Test a simple API call to speedrun.com
    makeAPIrequest("https://www.speedrun.com/api/v1/games", (response) => {
        if(response && response.data) {
            callback();
        } else {
            // Still continue, but show warning
            var container = document.querySelector('.container');
            if(container) {
                container.innerHTML = '<p style="color: orange; font-size: 18px;">⚠️ API connectivity issues detected. Some features may not work properly.</p>';
            }
            callback();
        }
    });
}

// Unified refresh function for world records
async function refreshWorldRecordsForSettings() {
    console.log('refreshWorldRecordsForSettings called');
    
    if (isLoading) {
        console.log('Already loading, returning early');
        return; // Prevent multiple simultaneous refreshes
    }
    
    // Auto-resume API calls if they were paused
    if (isApiPaused) {
        isApiPaused = false;
        window.isApiPaused = false;
    }
    
    // Set loading state
    setLoadingState(true);
    
    // Clear existing records to ensure fresh data
    worldRecords = {};
    
    // Generate empty table immediately to show structure
    generateSingleTable();
    
    try {
        // Ensure settings are saved before proceeding
        saveSettings();
        
        // Fetch fresh world records based on time travel state
        if (isTimeTravelEnabled && selectedTimeTravelDate) {
            await getAllWorldRecordsForDate(selectedTimeTravelDate);
        } else {
            await getAllWorldRecordsForCurrentSettings();
        }
        
        // Reset API overloaded state on successful fetch
        if (isApiOverloaded) {
            isApiOverloaded = false;
        }
        
        // Update button highlighting with a small delay to ensure DOM is ready
        setTimeout(() => {
            updateTableSelector();
        }, 50);
        
    } catch (error) {
        console.error('Error in refreshWorldRecordsForSettings:', error);
        
        // Check if it's a 420 error (API overloaded)
        if (error.message && error.message.includes('HTTP 420')) {
            isApiOverloaded = true;
            window.isApiOverloaded = true;
            console.log('API overloaded (420 error) detected');
            console.log('isApiOverloaded set to:', isApiOverloaded);
        }
        
        var container = document.querySelector('.container');
        if(container) {
            if (isApiOverloaded) {
                container.innerHTML = '<p style="color: white; font-size: 18px; text-align: center; padding: 20px;">⚠️ Speedrun.com API is overloaded. Please try again later.</p>';
            } else {
                container.innerHTML = '<p style="color: white; font-size: 18px; text-align: center; padding: 20px;">❌ Error refreshing world records. Please try again.</p>';
            }
        }
        
        // Update the loading state to show rate limited status
        setLoadingState(false);
    } finally {
        // Only clear loading state if not rate limited
        if (!isApiOverloaded) {
            setLoadingState(false);
        }
    }
}

// Refresh function for a specific table (for individual table refresh buttons)
async function refreshSpecificTable(settings) {
    if (isLoading) return; // Prevent multiple simultaneous refreshes
    
    // Set loading state
    setLoadingState(true);
    
    try {
        // Ensure settings are saved before proceeding
        saveSettings();
        
        // Check if WorldRecordFetcher is available
        if (!window.worldRecordFetcher) {
            throw new Error('WorldRecordFetcher not available');
        }
        
        // Map combination to indices
        const countNames = ["1 Apple", "3 Apples", "5 Apples", "Dice"];
        const speedNames = ["Normal", "Fast", "Slow"];
        const sizeNames = ["Standard", "Small", "Large"];
        
        let count = countNames.indexOf(settings[0]);
        let speed = speedNames.indexOf(settings[1]);
        let size = sizeNames.indexOf(settings[2]);
        
        if (count === -1) count = 0;
        if (speed === -1) speed = 0;
        if (size === -1) size = 0;
        
        // Fetch world records for all game modes and levels for this specific combination
        const levels = ["25", "50", "100", "All"];
        const highscoreLevels = ["H"]; // Only for highscore modes
        const modeNames = ["Classic", "Wall", "Portal", "Cheese", "Borderless", "Twin", "Winged", "Yin Yang", "Key", "Sokoban", "Poison", "Dimension", "Minesweeper", "Statue", "Light", "Shield", "Arrow", "Hotdog", "Magnet", "Gate", "Peaceful"];
        const highscoreModes = [1, 2, 8, 9, 10, 12, 13, 15, 17, 19, 3]; // Wall, Portal, Key, Sokoban, Poison, Minesweeper, Statue, Shield, Hotdog, Gate, Cheese
        
        // Fetch regular level-based records for all modes
        for (let modeIndex = 0; modeIndex < modeNames.length; modeIndex++) {
            for (let levelIndex = 0; levelIndex < levels.length; levelIndex++) {
                const level = levels[levelIndex];
                const mode = modeIndex;
                
                try {
                    let record;
                    if (isTimeTravelEnabled && selectedTimeTravelDate) {
                        record = await window.worldRecordFetcher.getWorldRecordForDate(level, mode, count, speed, size, selectedTimeTravelDate);
                    } else {
                        record = await window.worldRecordFetcher.getWorldRecord(level, mode, count, speed, size);
                    }
                    
                    if (record.success) {
                        // Create a key for this combination using actual setting names
                        let key = `${settings[0]}|${settings[1]}|${settings[2]}|${modeNames[mode]}|${level + " Apples"}`;
                        
                        // Convert all runs to the expected format
                        let convertedRuns = [];
                        
                        for (const run of record.runs) {
                            let convertedRun = {
                                times: { primary: run.time.raw },
                                date: run.date.toISOString(),
                                id: run.runId,
                                weblink: run.weblink,
                                players: {
                                    data: [{
                                        names: { international: run.player.name },
                                        id: run.player.id,
                                        rel: "user",
                                        weblink: `https://www.speedrun.com/user/${run.player.name}`,
                                        "name-style": run.player.nameStyle || {
                                            style: "solid",
                                            color: {
                                                dark: "#ffffff"
                                            }
                                        }
                                    }]
                                },
                                values: {} // We'll need to reconstruct this if needed
                            };
                            convertedRuns.push(convertedRun);
                            
                            // Add player to players list
                            if (typeof players[run.player.name] == 'undefined') {
                                players[run.player.name] = run.player.id;
                            }
                        }
                        
                        // Store all the world records (tied runs)
                        worldRecords[key] = convertedRuns;
                    }
                } catch (error) {
                    console.error(`Error fetching WR for ${modeNames[modeIndex]} - ${level} Apples (${settings[0]}, ${settings[1]}, ${settings[2]}):`, error);
                }
            }
        }
        
        // Fetch highscore records only for highscore modes
        for (let levelIndex = 0; levelIndex < highscoreLevels.length; levelIndex++) {
            const level = highscoreLevels[levelIndex];
            for (let modeIndex = 0; modeIndex < highscoreModes.length; modeIndex++) {
                const mode = highscoreModes[modeIndex];
                
                try {
                    let record;
                    if (isTimeTravelEnabled && selectedTimeTravelDate) {
                        record = await window.worldRecordFetcher.getWorldRecordForDate(level, mode, count, speed, size, selectedTimeTravelDate);
                    } else {
                        record = await window.worldRecordFetcher.getWorldRecord(level, mode, count, speed, size);
                    }
                    
                    if (record.success) {
                        // Create a key for this combination using actual setting names
                        let key = `${settings[0]}|${settings[1]}|${settings[2]}|${modeNames[mode]}|High Score`;
                        
                        // Convert all runs to the expected format
                        let convertedRuns = [];
                        
                        for (const run of record.runs) {
                            let convertedRun = {
                                times: { primary: run.time.raw },
                                date: run.date.toISOString(),
                                id: run.runId,
                                weblink: run.weblink,
                                players: {
                                    data: [{
                                        names: { international: run.player.name },
                                        id: run.player.id,
                                        rel: "user",
                                        weblink: `https://www.speedrun.com/user/${run.player.name}`,
                                        "name-style": run.player.nameStyle || {
                                            style: "solid",
                                            color: {
                                                dark: "#ffffff"
                                            }
                                        }
                                    }]
                                },
                                values: {} // We'll need to reconstruct this if needed
                            };
                            convertedRuns.push(convertedRun);
                            
                            // Add player to players list
                            if (typeof players[run.player.name] == 'undefined') {
                                players[run.player.name] = run.player.id;
                            }
                        }
                        
                        // Store all the world records (tied runs)
                        worldRecords[key] = convertedRuns;
                    }
                } catch (error) {
                    console.error(`Error fetching WR for ${modeNames[mode]} - High Score (${settings[0]}, ${settings[1]}, ${settings[2]}):`, error);
                }
            }
        }
        
        // Reset API overloaded state on successful fetch
        if (isApiOverloaded) {
            isApiOverloaded = false;
        }
        
        // Update the data structures
        calculateBestRuns();
        calculateRanglist();
        
        // Update only the specific table data without regenerating the entire table
        if (isMultipleTablesEnabled) {
            // Find the existing table and update its data
            var tableWrapper = document.querySelector(`[data-settings="${settings.join('|')}"]`);
            if (tableWrapper) {
                // Update the table data by regenerating only the content
                var table = tableWrapper.querySelector('table');
                if (table) {
                    // Clear existing table content
                    table.innerHTML = '';
                    
                    // Generate new table content for this specific combination
                    generateTableContent(table, settings, null);
                }
            }
        } else {
            // In single table mode, update only the table content without regenerating the entire UI
            var mainTable = document.querySelector('.main-table-wrapper table');
            if (mainTable) {
                // Clear existing table content
                mainTable.innerHTML = '';
                
                // Generate new table content for the current settings
                generateTableContent(mainTable, currentTableSettings, null);
            }
            
            // Also update the ranglist if it exists
            var ranglistTable = document.querySelector('.ranglist-wrapper table');
            if (ranglistTable) {
                // Clear existing ranglist content
                ranglistTable.innerHTML = '';
                
                // Regenerate ranglist content
                generateRanglist();
            }
        }
        
    } catch (error) {
        // Check if it's a 420 error (API overloaded)
        if (error.message && error.message.includes('HTTP 420')) {
            isApiOverloaded = true;
        }
        
        // Show error message for the specific table
        var tableWrapper = document.querySelector(`[data-settings="${settings.join('|')}"]`);
        if (tableWrapper) {
            var errorMsg = document.createElement('p');
            errorMsg.style.cssText = 'color: white; font-size: 14px; text-align: center; padding: 10px; margin: 0;';
            if (isApiOverloaded) {
                errorMsg.textContent = '⚠️ API overloaded. Please try again later.';
            } else {
                errorMsg.textContent = '❌ Error refreshing table. Please try again.';
            }
            tableWrapper.appendChild(errorMsg);
        }
    } finally {
        // Always clear loading state
        setLoadingState(false);
    }
}

async function getAllWorldRecordsForCurrentSettings() {
    console.log('getAllWorldRecordsForCurrentSettings called');
    
    // Check if WorldRecordFetcher is available
    if (!window.worldRecordFetcher) {
        console.error('WorldRecordFetcher not available in getAllWorldRecordsForCurrentSettings');
        return;
    }
    
    console.log('WorldRecordFetcher is available, proceeding...');
    console.log('isMultipleTablesEnabled:', isMultipleTablesEnabled);
    console.log('currentTableSettings:', currentTableSettings);
    
    // Get all selected combinations from the settings popup if multiple tables is enabled
    var selectedCombinations = [];
    
    if (isMultipleTablesEnabled) {
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
    } else {
        // Use ONLY the current table settings for single table mode
        // Ensure we have a valid currentTableSettings
        if (currentTableSettings && currentTableSettings.length >= 3) {
            selectedCombinations = [currentTableSettings];
        } else {
            // Fallback to default settings if currentTableSettings is invalid
            selectedCombinations = [["1 Apple", "Normal", "Standard"]];
        }
    }
    
    // Fetch world records for game modes and levels
    // When multiple tables is disabled, only fetch for visible modes and levels
    const levels = ["25", "50", "100", "All"];
    const highscoreLevels = ["H"]; // Only for highscore modes
    const modeNames = ["Classic", "Wall", "Portal", "Cheese", "Borderless", "Twin", "Winged", "Yin Yang", "Key", "Sokoban", "Poison", "Dimension", "Minesweeper", "Statue", "Light", "Shield", "Arrow", "Hotdog", "Magnet", "Gate", "Peaceful"];
    const highscoreModes = [1, 2, 8, 9, 10, 12, 13, 15, 17, 19, 3]; // Wall, Portal, Key, Sokoban, Poison, Minesweeper, Statue, Shield, Hotdog, Gate, Cheese
    
    // When multiple tables is disabled, only use visible modes and levels
    let selectedModes = [];
    let selectedLevels = [];
    let selectedHighscoreModes = [];
    
    if (isMultipleTablesEnabled) {
        // In multiple tables mode, fetch for all modes and levels
        selectedModes = modeNames;
        selectedLevels = levels;
        selectedHighscoreModes = highscoreModes;
    } else {
        // In single table mode, only fetch for visible modes and levels
        for (let i = 0; i < modeNames.length; i++) {
            if (gamemodes[modeNames[i]] && gamemodes[modeNames[i]].visible) {
                selectedModes.push(modeNames[i]);
            }
        }
        
        for (let i = 0; i < levels.length; i++) {
            const levelName = levels[i] + " Apples";
            if (runModes[levelName] && runModes[levelName].visible) {
                selectedLevels.push(levels[i]);
            }
        }
        
        // Check if High Score is visible
        if (runModes["High Score"] && runModes["High Score"].visible) {
            selectedHighscoreModes = highscoreModes;
        }
    }
    
    // Clear existing world records
    worldRecords = {};
    
    // Initialize API call progress tracking
    apiCallProgress.successful = 0;
    apiCallProgress.total = 0;
    
    // Build all requests for batch processing
    let allRequests = [];
    
    // Fetch data for each combination
    for (let comboIndex = 0; comboIndex < selectedCombinations.length; comboIndex++) {
        const combo = selectedCombinations[comboIndex];
        
        // Map combination to indices
        const countNames = ["1 Apple", "3 Apples", "5 Apples", "Dice"];
        const speedNames = ["Normal", "Fast", "Slow"];
        const sizeNames = ["Standard", "Small", "Large"];
        
        let count = countNames.indexOf(combo[0]);
        let speed = speedNames.indexOf(combo[1]);
        let size = sizeNames.indexOf(combo[2]);
        
        if (count === -1) count = 0;
        if (speed === -1) speed = 0;
        if (size === -1) size = 0;
        
        // Add regular level-based requests for selected modes and levels
        for (let modeIndex = 0; modeIndex < selectedModes.length; modeIndex++) {
            const modeName = selectedModes[modeIndex];
            const mode = modeNames.indexOf(modeName);
            
            for (let levelIndex = 0; levelIndex < selectedLevels.length; levelIndex++) {
                const level = selectedLevels[levelIndex];
                
                allRequests.push({
                    level: level,
                    mode: mode,
                    count: count,
                    speed: speed,
                    size: size,
                    combo: combo,
                    modeName: modeName,
                    levelName: level + " Apples"
                });
            }
        }
        
        // Add highscore requests only for selected highscore modes
        for (let levelIndex = 0; levelIndex < highscoreLevels.length; levelIndex++) {
            const level = highscoreLevels[levelIndex];
            for (let modeIndex = 0; modeIndex < selectedHighscoreModes.length; modeIndex++) {
                const mode = selectedHighscoreModes[modeIndex];
                
                allRequests.push({
                    level: level,
                    mode: mode,
                    count: count,
                    speed: speed,
                    size: size,
                    combo: combo,
                    modeName: modeNames[mode],
                    levelName: "High Score"
                });
            }
        }
    }
    
    // Set total API calls needed
    apiCallProgress.total = allRequests.length;
    updateApiProgress();
    
    // Update mobile API progress if on mobile
    if (window.innerWidth <= 1023 && typeof updateMobileApiCallProgress === 'function') {
        updateMobileApiCallProgress(0, allRequests.length);
    }
    
    if (isMultipleTablesEnabled) {
        // Load tables one by one for multiple tables mode
        let totalCompleted = 0;
        for (let comboIndex = 0; comboIndex < selectedCombinations.length; comboIndex++) {
            const combo = selectedCombinations[comboIndex];
            
            // Get requests for this specific combination
            const comboRequests = allRequests.filter(request => 
                request.combo[0] === combo[0] && 
                request.combo[1] === combo[1] && 
                request.combo[2] === combo[2]
            );
            
            // Process this combination's requests
            const comboResults = await window.worldRecordFetcher.fetchWorldRecordsBatch(comboRequests, (completedCount) => {
                apiCallProgress.successful = totalCompleted + completedCount;
                updateApiProgress();
                
                // Update mobile API progress if on mobile
                if (window.innerWidth <= 1023 && typeof updateMobileApiCallProgress === 'function') {
                    updateMobileApiCallProgress(totalCompleted + completedCount, apiCallProgress.total);
                }
            });
            
            totalCompleted += comboRequests.length;
            
            // Process results for this combination
            for (let j = 0; j < comboResults.length; j++) {
                const record = comboResults[j];
                const request = comboRequests[j];
                
                if (record.success) {
                    // Create a key for this combination using actual setting names
                    let key = `${request.combo[0]}|${request.combo[1]}|${request.combo[2]}|${request.modeName}|${request.levelName}`;
                    
                    // Convert all runs to the expected format
                    let convertedRuns = [];
                    
                    for (const run of record.runs) {
                        let convertedRun = {
                            times: { primary: run.time.raw },
                            date: run.date.toISOString(),
                            id: run.runId,
                            weblink: run.weblink,
                            players: {
                                data: [{
                                    names: { international: run.player.name },
                                    id: run.player.id,
                                    rel: "user",
                                    weblink: `https://www.speedrun.com/user/${run.player.name}`,
                                    "name-style": run.player.nameStyle || {
                                        style: "solid",
                                        color: {
                                            dark: "#ffffff"
                                        }
                                    }
                                }]
                            },
                            values: {} // We'll need to reconstruct this if needed
                        };
                        convertedRuns.push(convertedRun);
                        
                        // Add player to players list
                        if (typeof players[run.player.name] == 'undefined') {
                            players[run.player.name] = run.player.id;
                        }
                    }
                    
                    // Store all the world records (tied runs)
                    worldRecords[key] = convertedRuns;
                }
            }
            
            // Update the display after each table is loaded
            calculateBestRuns();
            calculateRanglist();
            generateRanglist();
            generateSingleTable();
            
            // Small delay to show progress
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    } else {
        // Single table mode - only process current table settings
        console.log('Single table mode - processing only current settings:', currentTableSettings);
        
        // Filter requests to only include current table settings
        const currentRequests = allRequests.filter(request => 
            request.combo[0] === currentTableSettings[0] && 
            request.combo[1] === currentTableSettings[1] && 
            request.combo[2] === currentTableSettings[2]
        );
        
        console.log('Filtered to', currentRequests.length, 'requests for current settings');
        
        // Update total to reflect only current settings
        apiCallProgress.total = currentRequests.length;
        updateApiProgress();
        
        // Update mobile API progress if on mobile
        if (window.innerWidth <= 1023 && typeof updateMobileApiCallProgress === 'function') {
            updateMobileApiCallProgress(0, currentRequests.length);
        }
        
        let batchResults;
        try {
            batchResults = await window.worldRecordFetcher.fetchWorldRecordsBatch(currentRequests, (completedCount) => {
                apiCallProgress.successful = completedCount;
                updateApiProgress();
                
                // Update mobile API progress if on mobile
                if (window.innerWidth <= 1023 && typeof updateMobileApiCallProgress === 'function') {
                    updateMobileApiCallProgress(completedCount, apiCallProgress.total);
                }
            });
            console.log('fetchWorldRecordsBatch completed, got', batchResults.length, 'results');
        } catch (error) {
            console.error('Error in fetchWorldRecordsBatch:', error);
            // Check if it's a 420 error and set the overloaded state
            if (error.message && error.message.includes('HTTP 420')) {
                isApiOverloaded = true;
                window.isApiOverloaded = true;
                console.log('API overloaded (420 error) detected in batch fetch');
                console.log('isApiOverloaded set to:', isApiOverloaded);
                // Update loading state to show rate limited
                setLoadingState(false);
            }
            throw error;
        }
        
        // Process batch results
        for (let j = 0; j < batchResults.length; j++) {
            const record = batchResults[j];
            const request = currentRequests[j];
            
            if (record.success) {
                // Create a key for this combination using actual setting names
                let key = `${request.combo[0]}|${request.combo[1]}|${request.combo[2]}|${request.modeName}|${request.levelName}`;
                
                // Convert all runs to the expected format
                let convertedRuns = [];
                
                for (const run of record.runs) {
                    let convertedRun = {
                        times: { primary: run.time.raw },
                        date: run.date.toISOString(),
                        id: run.runId,
                        weblink: run.weblink,
                        players: {
                            data: [{
                                names: { international: run.player.name },
                                id: run.player.id,
                                rel: "user",
                                weblink: `https://www.speedrun.com/user/${run.player.name}`,
                                "name-style": run.player.nameStyle || {
                                    style: "solid",
                                    color: {
                                        dark: "#ffffff"
                                    }
                                }
                            }]
                        },
                        values: {} // We'll need to reconstruct this if needed
                    };
                    convertedRuns.push(convertedRun);
                    
                    // Add player to players list
                    if (typeof players[run.player.name] == 'undefined') {
                        players[run.player.name] = run.player.id;
                    }
                }
                
                // Store all the world records (tied runs)
                worldRecords[key] = convertedRuns;
            }
        }
        
        // Update the display once for single table mode
        calculateBestRuns();
        calculateRanglist();
        generateRanglist();
        generateSingleTable();
        
        // Mark API calls as complete for single table mode
        apiCallProgress.successful = apiCallProgress.total;
        updateApiProgress();
        
        // Update mobile API progress if on mobile
        if (window.innerWidth <= 1023 && typeof updateMobileApiCallProgress === 'function') {
            updateMobileApiCallProgress(apiCallProgress.total, apiCallProgress.total);
        }
    }
}

// Fetch world records for a specific date
async function getAllWorldRecordsForDate(date) {
    console.log('getAllWorldRecordsForDate called with date:', date);
    
    // Check if WorldRecordFetcher is available
    if (!window.worldRecordFetcher) {
        console.error('WorldRecordFetcher not available in getAllWorldRecordsForDate');
        return;
    }
    
    console.log('WorldRecordFetcher is available, proceeding...');
    
    // Get all selected combinations from the settings popup if multiple tables is enabled
    var selectedCombinations = [];
    
    if (isMultipleTablesEnabled) {
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
    } else {
        // Use ONLY the current table settings for single table mode
        // Ensure we have a valid currentTableSettings
        if (currentTableSettings && currentTableSettings.length >= 3) {
            selectedCombinations = [currentTableSettings];
        } else {
            // Fallback to default settings if currentTableSettings is invalid
            selectedCombinations = [["1 Apple", "Normal", "Standard"]];
        }
    }
    
    // Fetch world records for game modes and levels
    // When multiple tables is disabled, only fetch for visible modes and levels
    const levels = ["25", "50", "100", "All"];
    const highscoreLevels = ["H"]; // Only for highscore modes
    const modeNames = ["Classic", "Wall", "Portal", "Cheese", "Borderless", "Twin", "Winged", "Yin Yang", "Key", "Sokoban", "Poison", "Dimension", "Minesweeper", "Statue", "Light", "Shield", "Arrow", "Hotdog", "Magnet", "Gate", "Peaceful"];
    const highscoreModes = [1, 2, 8, 9, 10, 12, 13, 15, 17, 19, 3]; // Wall, Portal, Key, Sokoban, Poison, Minesweeper, Statue, Shield, Hotdog, Gate, Cheese
    
    // When multiple tables is disabled, only use visible modes and levels
    let selectedModes = [];
    let selectedLevels = [];
    let selectedHighscoreModes = [];
    
    if (isMultipleTablesEnabled) {
        // In multiple tables mode, fetch for all modes and levels
        selectedModes = modeNames;
        selectedLevels = levels;
        selectedHighscoreModes = highscoreModes;
    } else {
        // In single table mode, only fetch for visible modes and levels
        for (let i = 0; i < modeNames.length; i++) {
            if (gamemodes[modeNames[i]] && gamemodes[modeNames[i]].visible) {
                selectedModes.push(modeNames[i]);
            }
        }
        
        for (let i = 0; i < levels.length; i++) {
            const levelName = levels[i] + " Apples";
            if (runModes[levelName] && runModes[levelName].visible) {
                selectedLevels.push(levels[i]);
            }
        }
        
        // Check if High Score is visible
        if (runModes["High Score"] && runModes["High Score"].visible) {
            selectedHighscoreModes = highscoreModes;
        }
    }
    
    // Calculate total requests: (regular levels for selected modes + highscore levels for selected highscore modes) * number of combinations
    let totalRequests = (selectedLevels.length * selectedModes.length + highscoreLevels.length * selectedHighscoreModes.length) * selectedCombinations.length;
    let completedRequests = 0;
    
    // Clear existing world records
    worldRecords = {};
    
    // Initialize API call progress tracking
    apiCallProgress.successful = 0;
    apiCallProgress.total = totalRequests;
    updateApiProgress();
    
    // Build all requests for batch processing
    let allRequests = [];
    
    // Fetch data for each combination
    for (let comboIndex = 0; comboIndex < selectedCombinations.length; comboIndex++) {
        const combo = selectedCombinations[comboIndex];
        
        // Map combination to indices
        const countNames = ["1 Apple", "3 Apples", "5 Apples", "Dice"];
        const speedNames = ["Normal", "Fast", "Slow"];
        const sizeNames = ["Standard", "Small", "Large"];
        
        let count = countNames.indexOf(combo[0]);
        let speed = speedNames.indexOf(combo[1]);
        let size = sizeNames.indexOf(combo[2]);
        
        if (count === -1) count = 0;
        if (speed === -1) speed = 0;
        if (size === -1) size = 0;
        
        // Add regular level-based requests for selected modes and levels
        for (let modeIndex = 0; modeIndex < selectedModes.length; modeIndex++) {
            const modeName = selectedModes[modeIndex];
            const mode = modeNames.indexOf(modeName);
            
            for (let levelIndex = 0; levelIndex < selectedLevels.length; levelIndex++) {
                const level = selectedLevels[levelIndex];
                
                allRequests.push({
                    level: level,
                    mode: mode,
                    count: count,
                    speed: speed,
                    size: size,
                    combo: combo,
                    modeName: modeName,
                    levelName: level + " Apples",
                    date: date
                });
            }
        }
        
        // Add highscore requests only for selected highscore modes
        for (let levelIndex = 0; levelIndex < highscoreLevels.length; levelIndex++) {
            const level = highscoreLevels[levelIndex];
            for (let modeIndex = 0; modeIndex < selectedHighscoreModes.length; modeIndex++) {
                const mode = selectedHighscoreModes[modeIndex];
                
                allRequests.push({
                    level: level,
                    mode: mode,
                    count: count,
                    speed: speed,
                    size: size,
                    combo: combo,
                    modeName: modeNames[mode],
                    levelName: "High Score",
                    date: date
                });
            }
        }
    }
    
    // Use the WorldRecordFetcher's batch processing (50 concurrent requests)
    let requestsToProcess = allRequests;
    
    // If multiple tables is disabled, only process current table settings
    if (!isMultipleTablesEnabled) {
        console.log('Date fetch - Single table mode - filtering to current settings:', currentTableSettings);
        requestsToProcess = allRequests.filter(request => 
            request.combo[0] === currentTableSettings[0] && 
            request.combo[1] === currentTableSettings[1] && 
            request.combo[2] === currentTableSettings[2]
        );
        
        // Update total to reflect only current settings
        apiCallProgress.total = requestsToProcess.length;
        updateApiProgress();
        
        // Update mobile API progress if on mobile
        if (window.innerWidth <= 1023 && typeof updateMobileApiCallProgress === 'function') {
            updateMobileApiCallProgress(0, requestsToProcess.length);
        }
    } else {
        // Update mobile API progress if on mobile
        if (window.innerWidth <= 1023 && typeof updateMobileApiCallProgress === 'function') {
            updateMobileApiCallProgress(0, allRequests.length);
        }
    }
    
    try {
        const batchResults = await window.worldRecordFetcher.fetchWorldRecordsBatch(requestsToProcess, (completedCount) => {
            apiCallProgress.successful = completedCount;
            updateApiProgress();
            
            // Update mobile API progress if on mobile
            if (window.innerWidth <= 1023 && typeof updateMobileApiCallProgress === 'function') {
                updateMobileApiCallProgress(completedCount, apiCallProgress.total);
            }
        });
        
        // Process batch results
        for (let j = 0; j < batchResults.length; j++) {
            const record = batchResults[j];
            const request = requestsToProcess[j];
            
            if (record.success) {
                // Create a key for this combination using actual setting names
                let key = `${request.combo[0]}|${request.combo[1]}|${request.combo[2]}|${request.modeName}|${request.levelName}`;
                
                // Convert all runs to the expected format
                let convertedRuns = [];
                
                for (const run of record.runs) {
                    let convertedRun = {
                        times: { primary: run.time.raw },
                        date: run.date.toISOString(),
                        id: run.runId,
                        weblink: run.weblink,
                        players: {
                            data: [{
                                names: { international: run.player.name },
                                id: run.player.id,
                                rel: "user",
                                weblink: `https://www.speedrun.com/user/${run.player.name}`,
                                "name-style": run.player.nameStyle || {
                                    style: "solid",
                                    color: {
                                        dark: "#ffffff"
                                    }
                                }
                            }]
                        },
                        values: {} // We'll need to reconstruct this if needed
                    };
                    convertedRuns.push(convertedRun);
                    
                    // Add player to players list
                    if (typeof players[run.player.name] == 'undefined') {
                        players[run.player.name] = run.player.id;
                    }
                }
                
                // Store all the world records (tied runs)
                worldRecords[key] = convertedRuns;
                
                // Update the display immediately for each record
                calculateBestRuns();
                calculateRanglist();
                generateRanglist();
                generateSingleTable();
            }
        }
    } catch (error) {
        console.error('Error in getAllWorldRecordsForDate batch fetch:', error);
        // Check if it's a 420 error and set the overloaded state
        if (error.message && error.message.includes('HTTP 420')) {
            isApiOverloaded = true;
            window.isApiOverloaded = true;
            console.log('API overloaded (420 error) detected in date fetch');
            console.log('isApiOverloaded set to:', isApiOverloaded);
            // Update loading state to show rate limited
            setLoadingState(false);
        }
        throw error;
    }
}

function startWorldRecordsDownload() {
    // Get container element
    var container = document.querySelector('.container');
    if(!container) {
        console.error('Container element not found');
        return;
    }

    // Ensure WorldRecordFetcher is available
    if (!window.worldRecordFetcher) {
        console.error('WorldRecordFetcher not available');
        if(container) {
            container.innerHTML = '<p style="color: white; font-size: 18px;">Error: WorldRecordFetcher not initialized. Please refresh the page.</p>';
        }
        return;
    }

    // Add timeout to prevent infinite loading
    var loadingTimeout = setTimeout(function() {
        if(container) {
            container.innerHTML = '<p style="color: white; font-size: 18px;">API connection issues. Please check your internet connection and try again.</p>';
        }
        // Re-enable category settings on timeout
        setLoadingState(false);
    }, 30000); // 30 second timeout

    // Add a shorter timeout for API failures
    var apiTimeout = setTimeout(function() {
        if(container) {
            container.innerHTML = '<p style="color: white; font-size: 18px;">API unavailable. Showing demo mode with sample data.</p>';
            // Show the UI even without data
            generateTableSelector();
            generateSingleTable();
            
            var switchButton = document.getElementById("switchButton");
            if(switchButton) {
                switchButton.addEventListener('click', () => {
                    if(mode == 0){
                        switchMode(1);
                    }
                    else{
                        switchMode(0);
                    }
                });
            }
        }
        // Re-enable category settings on API timeout
        setLoadingState(false);
    }, 10000); // 10 second timeout for API

    getGameDetails(
    () => {
        console.log('Game details loaded, starting world records download');
        
        // Clear any existing world records to ensure fresh data
        worldRecords = {};
        
        // Generate table selector first so the API progress element exists
        generateTableSelector();
        
        // Show stop button immediately for initial load
        var stopResumeButton = document.querySelector('.stop-resume-btn');
        if (stopResumeButton) {
            stopResumeButton.style.display = 'block';
            stopResumeButton.innerHTML = '⏸️ Stop';
            stopResumeButton.setAttribute('title', 'Stop API calls');
        }
        
                         // Update API progress display to show initial state
        updateApiProgress();
        
        // Immediately trigger refresh on initial load (like clicking the refresh button)
        try {
            refreshWorldRecordsForSettings();
        } catch (error) {
            console.error('Error calling refreshWorldRecordsForSettings:', error);
            if(container) {
                container.innerHTML = '<p style="color: white; font-size: 18px;">Error during initial load. Please try refreshing the page.</p>';
            }
            setLoadingState(false);
        }
        
        // Set up a completion check
        var checkCompletion = setInterval(() => {
            // For multiple tables mode, wait for all API calls to complete
            // For single table mode, wait for any records to be loaded
            if (isMultipleTablesEnabled) {
                // In multiple tables mode, check if all API calls are completed
                if (apiCallProgress.total > 0 && apiCallProgress.successful >= apiCallProgress.total) {
                    clearTimeout(loadingTimeout);
                    clearTimeout(apiTimeout);
                    clearInterval(checkCompletion);
                    
                    // Re-enable category settings after completion
                    setLoadingState(false);
                    
                    calculateBestRuns();
                    calculateRanglist();
                    generateRanglist();
                    updateTableSelector();
                    generateSingleTable();
                    
                    var switchButton = document.getElementById("switchButton");
                    if(switchButton) {
                        switchButton.addEventListener('click', () => {
                            if(mode == 0){
                                switchMode(1);
                            }
                            else{
                                switchMode(0);
                            }
                        });
                    }
                }
            } else {
                // In single table mode, check if any records are loaded
                if(Object.keys(worldRecords).length > 0) {
                    clearTimeout(loadingTimeout);
                    clearTimeout(apiTimeout);
                    clearInterval(checkCompletion);
                    
                    // Re-enable category settings after completion
                    setLoadingState(false);
                    
                    calculateBestRuns();
                    calculateRanglist();
                    generateRanglist();
                    updateTableSelector();
                    generateSingleTable();
                    
                    var switchButton = document.getElementById("switchButton");
                    if(switchButton) {
                        switchButton.addEventListener('click', () => {
                            if(mode == 0){
                                switchMode(1);
                            }
                            else{
                                switchMode(0);
                            }
                        });
                    }
                }
            }
        }, 1000); // Check every second
        
        // Fallback: if no records after 15 seconds, show error
        setTimeout(() => {
            if (isMultipleTablesEnabled) {
                // In multiple tables mode, check if API calls are still in progress
                if (apiCallProgress.total > 0 && apiCallProgress.successful < apiCallProgress.total) {
                    clearInterval(checkCompletion);
                    if(container) {
                        container.innerHTML = '<p style="color: white; font-size: 18px;">API calls are taking longer than expected. Please wait or try refreshing.</p>';
                    }
                    // Don't disable loading state - let it continue
                }
            } else {
                // In single table mode, check if any records are loaded
                if(Object.keys(worldRecords).length === 0) {
                    clearInterval(checkCompletion);
                    if(container) {
                        container.innerHTML = '<p style="color: white; font-size: 18px;">No world records found. The API might be temporarily unavailable.</p>';
                    }
                    // Re-enable category settings on fallback timeout
                    setLoadingState(false);
                }
            }
        }, 15000);
    });
}
