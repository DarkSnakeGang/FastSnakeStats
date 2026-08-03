// Event Handlers Module
// Handles all button clicks, settings changes, and UI interactions

// Toggle dark mode
function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    if(isDarkMode) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    saveSettings();
    
    // Update desktop toggle button icon and text
    const toggleBtn = document.querySelector('.dark-mode-toggle');
    if(toggleBtn) {
        toggleBtn.innerHTML = isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode';
    }
    
    // Update mobile toggle button icon and text
    const mobileToggleBtn = document.getElementById('mobileDarkModeToggle');
    if(mobileToggleBtn) {
        mobileToggleBtn.textContent = isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode';
        mobileToggleBtn.setAttribute('title', isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    }
}

// Update time travel button status (available, missing, disabled)
function updateTimeTravelButtonStatus(status) {
    //console.log('updateTimeTravelButtonStatus called with status:', status);
    // Set global variable for missing data state
    window.timeTravelDataMissing = (status === 'missing');
    // Update desktop toggle button
    const timeTravelBtn = document.querySelector('.time-travel-btn');
    //console.log('updateTimeTravelButtonStatus: Found desktop button:', !!timeTravelBtn);
    if(timeTravelBtn) {
        if(status === 'missing') {
            //console.log('updateTimeTravelButtonStatus: Setting desktop button to missing');
            timeTravelBtn.innerHTML = '⏰ No Data';
            timeTravelBtn.classList.add('active', 'missing-data');
            timeTravelBtn.setAttribute('title', `No data available for ${selectedTimeTravelDate}. Click to enable time travel.`);
            //console.log('updateTimeTravelButtonStatus: Desktop button text after update:', timeTravelBtn.innerHTML);
        } else if(status === 'available') {
            if (isTimeTravelEnabled) {
                timeTravelBtn.innerHTML = '⏰ Time Travel';
                timeTravelBtn.classList.add('active');
                timeTravelBtn.classList.remove('missing-data');
                timeTravelBtn.setAttribute('title', `Time travel mode enabled for ${selectedTimeTravelDate}. Click to disable.`);
            } else {
                timeTravelBtn.innerHTML = '⏰ Time Travel';
                timeTravelBtn.classList.remove('active', 'missing-data');
                timeTravelBtn.setAttribute('title', `Data available for ${selectedTimeTravelDate}. Click to enable time travel.`);
            }
        } else {
            timeTravelBtn.innerHTML = '⏰ Time Travel';
            timeTravelBtn.classList.remove('active', 'missing-data');
            timeTravelBtn.setAttribute('title', 'Time travel mode disabled. Click to enable.');
        }
    }
    
    // Update mobile toggle button
    const mobileTimeTravelBtn = document.getElementById('mobileTimeTravelBtn');
    if(mobileTimeTravelBtn) {
        if(status === 'missing') {
            mobileTimeTravelBtn.classList.add('active', 'missing-data');
            mobileTimeTravelBtn.setAttribute('title', `No data available for ${selectedTimeTravelDate}. Click to enable time travel.`);
        } else if(status === 'available') {
            if (isTimeTravelEnabled) {
                mobileTimeTravelBtn.classList.add('active');
                mobileTimeTravelBtn.classList.remove('missing-data');
                mobileTimeTravelBtn.setAttribute('title', `Time travel mode enabled for ${selectedTimeTravelDate}. Click to disable.`);
            } else {
                mobileTimeTravelBtn.classList.remove('active', 'missing-data');
                mobileTimeTravelBtn.setAttribute('title', `Data available for ${selectedTimeTravelDate}. Click to enable time travel.`);
            }
        } else {
            mobileTimeTravelBtn.classList.remove('active', 'missing-data');
            mobileTimeTravelBtn.setAttribute('title', 'Time travel mode disabled. Click to enable.');
        }
    }
}

// Make function globally available
window.updateTimeTravelButtonStatus = updateTimeTravelButtonStatus;

// Function to check if date is too early (before or equal to 2018-10-23)
function isDateTooEarly(dateString) {
    if (!dateString) return false;
    const selectedDate = new Date(dateString);
    const cutoffDate = new Date('2018-10-23');
    return selectedDate <= cutoffDate;
}

// Function to show/hide time travel message
function updateTimeTravelMessage() {
    const shouldShow = isTimeTravelEnabled && selectedTimeTravelDate && isDateTooEarly(selectedTimeTravelDate);
    
    // Update desktop message
    const desktopMessage = document.getElementById('timeTravelMessage');
    if (desktopMessage) {
        if (shouldShow) {
            desktopMessage.classList.add('show');
            
            // Hide records tables and summary table when time travel message is shown
            if (window.innerWidth > 1023) { // Desktop only
                const container = document.querySelector('.container');
                if (container) {
                    const recordsTables = container.querySelectorAll('.leaderboard, .ranglist');
                    recordsTables.forEach(table => {
                        table.style.display = 'none';
                    });
                }
            }
        } else {
            desktopMessage.classList.remove('show');
            
            // Redisplay records tables and summary table when time travel message is hidden
            if (window.innerWidth > 1023) { // Desktop only
                const container = document.querySelector('.container');
                if (container) {
                    const recordsTables = container.querySelectorAll('.leaderboard, .ranglist');
                    recordsTables.forEach(table => {
                        table.style.display = '';
                    });
                }
                
                // Regenerate tables if they don't exist
                if (typeof generateSingleTable === 'function') {
                    generateSingleTable();
                }
            }
        }
    }
    
    // Update mobile message
    const mobileMessage = document.getElementById('mobileTimeTravelMessage');
    if (mobileMessage) {
        if (shouldShow) {
            mobileMessage.classList.add('show');
        } else {
            mobileMessage.classList.remove('show');
        }
    }
}

// Make functions globally available
window.isDateTooEarly = isDateTooEarly;
window.updateTimeTravelMessage = updateTimeTravelMessage;

// Toggle time travel mode
async function toggleTimeTravel() {
    isTimeTravelEnabled = !isTimeTravelEnabled;
    saveSettings();
    
    // Update time travel message
    updateTimeTravelMessage();
    
    // Update button status based on data availability, but only if time travel is enabled
    if (isTimeTravelEnabled && selectedTimeTravelDate) {
        // Check data availability only when time travel is enabled
        const cacheData = await window.githubCacheFetcher.fetchWorldRecordsForDate(selectedTimeTravelDate);
        if (!cacheData || Object.keys(cacheData).length === 0) {
            updateTimeTravelButtonStatus('missing');
        } else {
            updateTimeTravelButtonStatus('available');
        }
    } else if (selectedTimeTravelDate) {
        // When time travel is disabled but date is selected, show as available without checking
        updateTimeTravelButtonStatus('available');
    } else {
        updateTimeTravelButtonStatus('disabled');
    }
    
    // Auto-resume API calls if they were paused
    if (isApiPaused) {
        isApiPaused = false;
        window.isApiPaused = false;
    }
    
    // Only refresh on desktop, not on mobile
    if (window.innerWidth > 1023) {
        if (isLoading) return;
        
        // Use Quick Fetch instead of direct API calls
        await quickFetchWorldRecords();
    }
}

// Toggle multiple tables mode
async function toggleMultipleTables() {
    isMultipleTablesEnabled = !isMultipleTablesEnabled;
    saveSettings();
    
    // Update desktop toggle button
    const multipleTablesBtn = document.querySelector('.multiple-tables-btn');
    if(multipleTablesBtn) {
        if(isMultipleTablesEnabled) {
            multipleTablesBtn.innerHTML = '📊 Multiple Tables';
            multipleTablesBtn.classList.add('active');
            multipleTablesBtn.setAttribute('title', 'Multiple tables mode enabled. Click to disable.');
        } else {
            multipleTablesBtn.innerHTML = '📊 Multiple Tables';
            multipleTablesBtn.classList.remove('active');
            multipleTablesBtn.setAttribute('title', 'Multiple tables mode disabled. Click to enable.');
        }
    }
    
    // Update mobile toggle button
    const mobileMultipleTablesBtn = document.getElementById('mobileMultipleTablesToggle');
    if(mobileMultipleTablesBtn) {
        if(isMultipleTablesEnabled) {
            mobileMultipleTablesBtn.classList.add('active');
            mobileMultipleTablesBtn.setAttribute('title', 'Multiple tables mode enabled. Click to disable.');
        } else {
            mobileMultipleTablesBtn.classList.remove('active');
            mobileMultipleTablesBtn.setAttribute('title', 'Multiple tables mode disabled. Click to enable.');
        }
    }
    
    // Regenerate table selector to show/hide count/speed/size options
    generateTableSelector();
    if (isMultipleTablesEnabled) {
        generateMultipleTables();
    } else {
        generateSingleTable();
    }
    // Load data from cache instead of refreshing
    if (isLoading) return;
    
    // Set loading state briefly to show progress
    setLoadingState(true);
    
    try {
        // Ensure settings are saved before proceeding
        saveSettings();
        
        // Use Quick Fetch instead of direct API calls
        await quickFetchWorldRecords();
        
        // Update button highlighting with a small delay to ensure DOM is ready
        setTimeout(() => {
            updateTableSelector();
        }, 50);
        
        // Ensure summary table is updated to reflect current visibility state
        if (typeof calculateRanglist === 'function' && typeof generateRanglist === 'function') {
            calculateRanglist();
            generateRanglist();
        }
        
    } catch (error) {
        console.error('Error loading from cache:', error);
    } finally {
        setLoadingState(false);
    }
}

// Global function to set API overloaded state (called from WorldRecordFetcher)
window.setApiOverloaded = function(overloaded) {
    isApiOverloaded = overloaded;
    window.isApiOverloaded = isApiOverloaded;
    // Update the UI immediately if we're currently loading
    if (isLoading) {
        setLoadingState(true); // This will update the refresh button text
    }
};

// Add loading state management
function setLoadingState(loading) {
    isLoading = loading;
    window.isLoading = isLoading;
    var buttons = document.querySelectorAll('.table-option-btn');
    buttons.forEach(function(button) {
        // Skip the stop/resume button - it should remain enabled during loading
        if (button.classList.contains('stop-resume-btn')) {
            return;
        }
        if (loading) {
            button.disabled = true;
            button.style.opacity = '0.5';
            button.style.cursor = 'not-allowed';
            button.setAttribute('title', 'Loading world records...');
        } else {
            button.disabled = false;
            button.style.opacity = '1';
            button.style.cursor = 'pointer';
            button.removeAttribute('title');
        }
    });
    
    // Update refresh button text
    var refreshButton = document.querySelector('.refresh-btn');
    if (refreshButton) {
        if (loading) {
            if (isApiOverloaded) {
                refreshButton.innerHTML = '⏳ Rate limited';
                refreshButton.disabled = true;
                refreshButton.setAttribute('title', 'API is rate limited. Please wait...');
            } else {
                refreshButton.innerHTML = '⏳ Loading...';
                refreshButton.disabled = true;
                refreshButton.setAttribute('title', 'Please wait while world records are being fetched...');
            }
        } else if (isApiOverloaded) {
            refreshButton.innerHTML = '⚠️ SRC API overloaded';
            refreshButton.disabled = false;
            refreshButton.setAttribute('title', 'Speedrun.com API is overloaded. Click to retry.');
        } else {
            refreshButton.innerHTML = '🔄 Refresh';
            refreshButton.disabled = false;
            refreshButton.setAttribute('title', 'Fetch from API (slower but always current)');
        }
    }
    
    // Update quick fetch button text
    var quickFetchButton = document.querySelector('.quick-fetch-btn');
    if (quickFetchButton) {
        if (loading) {
            quickFetchButton.innerHTML = '⏳ Loading...';
            quickFetchButton.disabled = true;
            quickFetchButton.setAttribute('title', 'Please wait while fetching from cache...');
        } else {
            quickFetchButton.innerHTML = '🐰 Quick Fetch';
            quickFetchButton.disabled = false;
            quickFetchButton.setAttribute('title', 'Fetch from GitHub cache (fast)');
        }
    }
    
    // Update time travel button text
    var timeTravelButton = document.querySelector('.time-travel-btn');
    if (timeTravelButton) {
        timeTravelButton.disabled = loading;
        if (loading) {
            timeTravelButton.title = 'Loading...';
        } else {
            // Restore the correct button state after loading
            if (isTimeTravelEnabled && selectedTimeTravelDate) {
                // Check data availability only when time travel is enabled
                window.githubCacheFetcher.fetchWorldRecordsForDate(selectedTimeTravelDate).then(cacheData => {
                    if (!cacheData || Object.keys(cacheData).length === 0) {
                        updateTimeTravelButtonStatus('missing');
                    } else {
                        updateTimeTravelButtonStatus('available');
                    }
                }).catch(() => {
                    updateTimeTravelButtonStatus('missing');
                });
            } else if (selectedTimeTravelDate) {
                // When time travel is disabled but date is selected, show as available without checking
                updateTimeTravelButtonStatus('available');
            } else {
                updateTimeTravelButtonStatus('disabled');
            }
        }
    }
    
    // Update multiple tables button
    var multipleTablesButton = document.querySelector('.multiple-tables-btn');
    if (multipleTablesButton) {
        multipleTablesButton.disabled = loading;
        multipleTablesButton.innerHTML = '📊 Multiple Tables';
        multipleTablesButton.title = loading ? 'Loading...' : (isMultipleTablesEnabled ? 'Multiple tables mode enabled. Click to disable.' : 'Multiple tables mode disabled. Click to enable.');
    }
    
    // Update stop/resume button visibility
    var stopResumeButton = document.querySelector('.stop-resume-btn');
    if (stopResumeButton) {
        if (loading && (apiCallProgress.total > 0 || isApiPaused)) {
            stopResumeButton.style.display = 'block';
            if (isApiPaused) {
                stopResumeButton.innerHTML = '▶️ Resume';
                stopResumeButton.setAttribute('title', 'Resume API calls');
            } else {
                stopResumeButton.innerHTML = '⏸️ Stop';
                stopResumeButton.setAttribute('title', 'Stop API calls');
            }
        } else if (isApiPaused && apiCallProgress.total > 0 && apiCallProgress.successful < apiCallProgress.total) {
            // Show resume button even when not loading but paused
            stopResumeButton.style.display = 'block';
            stopResumeButton.innerHTML = '▶️ Resume';
            stopResumeButton.setAttribute('title', 'Resume API calls');
        } else if (!loading && apiCallProgress.total > 0 && apiCallProgress.successful >= apiCallProgress.total) {
            // Hide button when all API calls are completed
            stopResumeButton.style.display = 'none';
        }
    }
    
    // Don't show loading message - table will be updated live instead
}

// Toggle API pause/resume functionality
function toggleApiPause() {
    if (isApiPaused) {
        // Resume API calls
        isApiPaused = false;
        window.isApiPaused = false;
        
        // Re-enable loading state
        setLoadingState(true);
        
        // Resume from where we left off
        if (pausedApiState) {
            resumeApiCalls(pausedApiState);
        }
    } else {
        // Pause API calls
        isApiPaused = true;
        window.isApiPaused = true;
        
        // Store current state for resuming
        pausedApiState = {
            progress: { ...apiCallProgress },
            timestamp: Date.now()
        };
        
        // Disable loading state but keep buttons enabled
        setLoadingState(false);
        
        // Update refresh button to show paused state
        var refreshButton = document.querySelector('.refresh-btn');
        if (refreshButton) {
            refreshButton.innerHTML = '⏸️ Paused';
            refreshButton.setAttribute('title', 'API calls are paused. Click Resume to continue.');
        }
        
        // Update stop button to show resume
        var stopResumeButton = document.querySelector('.stop-resume-btn');
        if (stopResumeButton) {
            stopResumeButton.innerHTML = '▶️ Resume';
            stopResumeButton.setAttribute('title', 'Resume API calls');
        }
    }
}

// Resume API calls from paused state
function resumeApiCalls(pausedState) {
    // Update progress to where we left off
    apiCallProgress = { ...pausedState.progress };
    updateApiProgress();
    
    // Continue with the current API call process
    // This will be handled by the existing API call functions
    // which will check isApiPaused and continue from where they left off
}

function switchMode(newmode){
    mode = newmode;
    removeLeaderboards();
    reset = function(){
        //turn everything true
        for(appleAmount in appleAmounts){
            appleAmounts[appleAmount].visible = true;
        }
        for(speed in speeds){
            speeds[speed].visible = true;
        }
        for(size in sizes){
            sizes[size].visible = true;
        }
        for(gamemode in gamemodes){
            gamemodes[gamemode].visible = true;
        }
        for(runMode in runModes){
            runModes[runMode].visible = true;
        }
        //change option buttons
        for(optionButton of document.getElementsByClassName('optionButtonImage')){
            optionButton.setAttribute('class','optionButtonImage');
        }
        for(runMode in runModes){
            var optionElement = document.getElementById('option'+runModes[runMode].id);
            if(optionElement) {
                optionElement.checked = true;
            }
        }
    }
    switch(mode){
        case 0:
            reset();
            if(speeds["Slow"]) speeds["Slow"].visible = false;
            // Safely update option button if it exists
            var speed01Btn = document.getElementById('optionspeed_01');
            if(speed01Btn && speed01Btn.firstChild) {
                speed01Btn.firstChild.setAttribute('class','optionButtonImage optionButtonImageDisabled');
            }
            //document.getElementById('optionmode_02').checked = false;
            var mainText = document.getElementById("mainText");
            var catText = document.getElementById("catText");
            var customText = document.getElementById("customText");
            var switchButton = document.getElementById("switchButton");
            
            if(mainText) mainText.setAttribute("style",'');
            if(catText) catText.setAttribute("style",'display:none');
            if(customText) customText.setAttribute("style",'display:none');
            if(switchButton) switchButton.innerHTML = "Click here to go to Category Extensions";
            break;
        case 1: //slow mode
            reset();
            if(speeds["Fast"]) speeds["Fast"].visible = false;
            if(speeds["Standard"]) speeds["Standard"].visible = false;
            // Safely update option buttons if they exist
            var speed00Btn = document.getElementById('optionspeed_00');
            var speed02Btn = document.getElementById('optionspeed_02');
            if(speed00Btn && speed00Btn.firstChild) {
                speed00Btn.firstChild.setAttribute('class','optionButtonImage optionButtonImageDisabled');
            }
            if(speed02Btn && speed02Btn.firstChild) {
                speed02Btn.firstChild.setAttribute('class','optionButtonImage optionButtonImageDisabled');
            }
            
            var mainText = document.getElementById("mainText");
            var catText = document.getElementById("catText");
            var customText = document.getElementById("customText");
            var switchButton = document.getElementById("switchButton");
            
            if(mainText) mainText.setAttribute("style",'display:none');
            if(catText) catText.setAttribute("style",'');
            if(customText) customText.setAttribute("style",'display:none');
            if(switchButton) switchButton.innerHTML = "Click here to go to Main Leaderboard";
            break;
        case 2:
            var mainText = document.getElementById("mainText");
            var catText = document.getElementById("catText");
            var customText = document.getElementById("customText");
            var switchButton = document.getElementById("switchButton");
            
            if(mainText) mainText.setAttribute("style",'display:none');
            if(catText) catText.setAttribute("style",'display:none');
            if(customText) customText.setAttribute("style",'');
            if(switchButton) switchButton.innerHTML = "Click here to go to Main Leaderboard";

    }
    
    // Only call these functions if we have data
    if(Object.keys(worldRecords).length > 0) {
        calculateRanglist();
        generateRanglist();
    }
    // Only generate table selector if it doesn't exist yet
    if (!document.querySelector('.table-selector')) {
        generateTableSelector();
    } else {
        // Just update highlighting for existing buttons immediately
        updateTableSelector();
    }
    generateSingleTable();
}

//option buttons
function createOptionButton(setting){
    var button = document.createElement('button');
    button.setAttribute('class','optionButton');
    button.setAttribute('onclick','optionButtonClick(this.id)');
    button.setAttribute('id','option'+setting.id);
    button.setAttribute('type','button');
    var icon = createIconElement(setting);
    if(setting.visible){
        icon.setAttribute('class','optionButtonImage');
    }
    else{
        icon.setAttribute('class','optionButtonImage optionButtonImageDisabled');
    }
    button.appendChild(icon);
    return button;
}

function optionButtonClick(clicked_id){
    var element = document.getElementById(clicked_id);
    image = element.getElementsByClassName("optionButtonImage")[0];
    setTo = true;
    if(image.classList.contains("optionButtonImageDisabled")){
        image.classList.remove("optionButtonImageDisabled");
    }
    else{
        image.classList.add("optionButtonImageDisabled");
        setTo = false;
    }
    for(gamemode in gamemodes){
        if("option"+gamemodes[gamemode].id == clicked_id){
            gamemodes[gamemode].visible = setTo;
        }
    }
    for(appleAmount in appleAmounts){
        if("option"+appleAmounts[appleAmount].id == clicked_id){
            appleAmounts[appleAmount].visible = setTo;
        }
    }
    for(speed in speeds){
        if("option"+speeds[speed].id == clicked_id){
            speeds[speed].visible = setTo;
        }
    }
    for(size in sizes){
        if("option"+sizes[size].id == clicked_id){
            sizes[size].visible = setTo;
        }
    }
    saveSettings(); // Save settings when changed
    switchMode(2);
}

function initializeUI() {
    // Initialize modals
    var modal = document.getElementById("infoModal");
    var btn = document.getElementById("infoBtn");
    var span = document.getElementsByClassName("close")[0];

    if(btn && modal) {
        btn.onclick = function() {
            modal.style.display = "block";
        }
    }
    if(span) {
        span.onclick = function() {
            if(modal) modal.style.display = "none";
        }
    }

    var modal2 = document.getElementById("settingsModal");
    var btn2 = document.getElementById("settingsBtn");
    var span2 = document.getElementsByClassName("close")[1];

    if(btn2 && modal2) {
        btn2.onclick = function() {
            modal2.style.display = "block";
        }
    }
    if(span2) {
        span2.onclick = function() {
            if(modal2) modal2.style.display = "none";
        }
    }

    window.onclick = function(event) {
        if (event.target == modal2) {
            modal2.style.display = "none";
        }
        else if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    // Initialize datepicker
    var datepicker = document.getElementById("datepicker");
    if(datepicker) {
        // Set the datepicker value if we have a saved date
        if(selectedTimeTravelDate) {
            datepicker.value = selectedTimeTravelDate;
        }
        
        datepicker.onchange = async function(){
            console.log('datepicker.onchange triggered');
            console.log('isLoading:', isLoading);
            if (isLoading) {
                console.log('Loading state active, returning early');
                return; // Prevent multiple simultaneous requests
            }
            
            const selectedDate = datepicker.value;
            console.log('Selected date:', selectedDate);
            selectedTimeTravelDate = selectedDate; // Save the selected date
            saveSettings();
            
            // Update time travel message
            updateTimeTravelMessage();
            
            if (!selectedDate) {
                selectedTimeTravelDate = "";
                saveSettings();
                updateTimeTravelButtonStatus('disabled');
                updateTimeTravelMessage();
                return;
            }
            
            // Only fetch data if time travel is enabled
            if (isTimeTravelEnabled) {
                console.log('Time travel is enabled, fetching data');
                // Set loading state
                setLoadingState(true);
                
                try {
                    // Check data availability first
                    const cacheData = await window.githubCacheFetcher.fetchWorldRecordsForDate(selectedDate);
                    if (!cacheData || Object.keys(cacheData).length === 0) {
                        updateTimeTravelButtonStatus('missing');
                    } else {
                        updateTimeTravelButtonStatus('available');
                    }
                    
                    // Use Quick Fetch instead of direct API calls
                    console.log('Calling quickFetchWorldRecords');
                    await quickFetchWorldRecords();
                    
                } catch (error) {
                    console.error('Error in date picker change:', error);
                    updateTimeTravelButtonStatus('missing');
                } finally {
                    // Clear loading state
                    setLoadingState(false);
                }
            } else {
                // Check data availability even if time travel is disabled
                const cacheData = await window.githubCacheFetcher.fetchWorldRecordsForDate(selectedDate);
                if (!cacheData || Object.keys(cacheData).length === 0) {
                    updateTimeTravelButtonStatus('missing');
                } else {
                    updateTimeTravelButtonStatus('available');
                }
            }
        }
    }

    // Initialize username search functionality
    initializeUsernameSearch();

    // Game modes / run modes are mounted into the Settings sidebar by generateTableSelector
    // (settings modal is no longer used as a UI surface).
}

// Username search functionality
function initializeUsernameSearch() {
    const searchBtn = document.getElementById('searchPlayerBtn');
    const usernameInput = document.getElementById('usernameSearch');
    const peakDatesContainer = document.getElementById('playerPeakDates');
    const peakRecordsBtn = document.getElementById('peakRecordsBtn');
    const peakPercentageBtn = document.getElementById('peakPercentageBtn');
    const latestDataBtn = document.getElementById('latestDataBtn');
    const peakRecordsDate = document.getElementById('peakRecordsDate');
    const peakPercentageDate = document.getElementById('peakPercentageDate');

    if (!searchBtn || !usernameInput || !peakDatesContainer) return;

    // Search button click handler
    searchBtn.addEventListener('click', async function() {
        const username = usernameInput.value.trim();
        if (!username) {
            alert('Please enter a username to search');
            return;
        }

        try {
            const playerData = await searchPlayerStats(username);
            if (playerData) {
                displayPlayerPeakDates(playerData);
            } else {
                alert(`Player "${username}" not found in the database`);
                peakDatesContainer.style.display = 'none';
            }
        } catch (error) {
            console.error('Error searching for player:', error);
            alert('Error searching for player. Please try again.');
        }
    });

    // Enter key handler for input
    usernameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchBtn.click();
        }
    });

    // Peak records button click handler
    if (peakRecordsBtn) {
        peakRecordsBtn.addEventListener('click', async function() {
            const dateSpan = document.getElementById('peakRecordsDate');
            const date = dateSpan ? dateSpan.textContent : null;
            if (date && date !== '-') {
                await setTimeTravelDate(date);
            }
        });
    }

    // Peak percentage button click handler
    if (peakPercentageBtn) {
        peakPercentageBtn.addEventListener('click', async function() {
            const dateSpan = document.getElementById('peakPercentageDate');
            const date = dateSpan ? dateSpan.textContent : null;
            if (date && date !== '-') {
                await setTimeTravelDate(date);
            }
        });
    }

    // Latest data button click handler
    if (latestDataBtn) {
        latestDataBtn.addEventListener('click', async function() {
            await setTimeTravelDate(''); // Clear date to use latest data
        });
    }
}

// Search for player in the stats database
async function searchPlayerStats(username) {
    try {
        const response = await fetch('time-travel-cache/metadata/player-stats.json');
        if (!response.ok) {
            throw new Error('Failed to load player stats');
        }
        
        const data = await response.json();
        const players = data.players || [];
        
        // Case-insensitive search
        const player = players.find(p => 
            p.name.toLowerCase() === username.toLowerCase()
        );
        
        return player || null;
    } catch (error) {
        console.error('Error loading player stats:', error);
        throw error;
    }
}

// Display player peak dates
function displayPlayerPeakDates(playerData) {
    const peakDatesContainer = document.getElementById('playerPeakDates');
    const peakRecordsDate = document.getElementById('peakRecordsDate');
    const peakPercentageDate = document.getElementById('peakPercentageDate');
    const peakRecordsBtn = document.getElementById('peakRecordsBtn');
    const peakPercentageBtn = document.getElementById('peakPercentageBtn');

    if (!peakDatesContainer || !peakRecordsDate || !peakPercentageDate) return;

    // Update the date spans
    peakRecordsDate.textContent = playerData.peakRecords.date || '-';
    peakPercentageDate.textContent = playerData.peakPercentage.date || '-';

    // Update button text with counts/percentages
    if (peakRecordsBtn) {
        peakRecordsBtn.innerHTML = `📊 Peak Records: <span id="peakRecordsDate">${playerData.peakRecords.date || '-'}</span> (${playerData.peakRecords.count} records)`;
    }
    if (peakPercentageBtn) {
        peakPercentageBtn.innerHTML = `📈 Peak Percentage: <span id="peakPercentageDate">${playerData.peakPercentage.date || '-'}</span> (${playerData.peakPercentage.percentage}%)`;
    }

    // Show the container
    peakDatesContainer.style.display = 'block';
}

// Set time travel date and enable time travel
async function setTimeTravelDate(date) {
    console.log('setTimeTravelDate called with date:', date);
    const datepicker = document.getElementById('datepicker');
    if (datepicker) {
        // Clear any existing loading state to ensure the change event can be processed
        if (isLoading) {
            console.log('Clearing loading state');
            setLoadingState(false);
        }
        
        datepicker.value = date;
        selectedTimeTravelDate = date;
        console.log('Set datepicker value to:', date);
        console.log('Set selectedTimeTravelDate to:', selectedTimeTravelDate);
        
        // Enable time travel if a date is set
        if (date && !isTimeTravelEnabled) {
            isTimeTravelEnabled = true;
            console.log('Enabled time travel');
        }
        
        saveSettings();
        console.log('Settings saved');
        
        // Update time travel button status
        if (date) {
            updateTimeTravelButtonStatus('available');
        } else {
            updateTimeTravelButtonStatus('disabled');
        }
        
        // Explicitly call quickFetchWorldRecords to ensure data is loaded
        if (typeof quickFetchWorldRecords === 'function') {
            console.log('Calling quickFetchWorldRecords explicitly');
            await quickFetchWorldRecords();
        }
    }
    
    // Close the settings modal
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) {
        settingsModal.style.display = 'none';
    }
}
