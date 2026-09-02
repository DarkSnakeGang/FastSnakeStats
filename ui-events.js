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

    if (typeof refreshUsernameColors === 'function') {
        refreshUsernameColors();
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

function applyCeDisplayButtonState(btn) {
    if (!btn) return;
    var mode = (typeof getCeDisplayMode === 'function') ? getCeDisplayMode() : (ceDisplayMode || 'off');
    var label = (typeof ceDisplayModeLabel === 'function') ? ceDisplayModeLabel(mode) : ('CE: ' + mode);
    btn.innerHTML = '🧩 ' + label;
    btn.classList.toggle('active', mode !== 'off');
    var tip = 'Category Extensions (Chess/Burger): Off hides them, Mix shows with main modes, Only shows CE modes.';
    if (mode === 'mix') tip = 'CE Mix enabled — Chess & Burger shown with main modes. Click to cycle.';
    else if (mode === 'only') tip = 'CE Only — showing Chess & Burger exclusively. Click to cycle.';
    btn.setAttribute('title', tip);
}

function refreshAllCeDisplayButtons() {
    var buttons = document.querySelectorAll('.ce-display-btn');
    for (var i = 0; i < buttons.length; i++) {
        applyCeDisplayButtonState(buttons[i]);
    }
}

/** Cycle CE display: Off → Mix → Only → Off */
async function toggleCeDisplayMode() {
    var cur = (typeof getCeDisplayMode === 'function') ? getCeDisplayMode() : (ceDisplayMode || 'off');
    var next = cur === 'off' ? 'mix' : (cur === 'mix' ? 'only' : 'off');
    if (typeof setCeDisplayMode === 'function') setCeDisplayMode(next);
    else ceDisplayMode = next;

    if (next === 'mix' || next === 'only') {
        if (gamemodes.Chess) gamemodes.Chess.visible = true;
        if (gamemodes.Burger) gamemodes.Burger.visible = true;
    }

    saveSettings();
    refreshAllCeDisplayButtons();

    generateTableSelector();
    if (isMultipleTablesEnabled) {
        generateMultipleTables();
    } else {
        generateSingleTable();
    }
    if (isLoading) {
        // Initial Quick Fetch already in flight — paint mobile from current data/mode when ready
        if (typeof refreshMobileWorldRecordsIfVisible === 'function') {
            refreshMobileWorldRecordsIfVisible();
        }
        return;
    }
    setLoadingState(true);
    try {
        saveSettings();
        await quickFetchWorldRecords();
        setTimeout(function () { updateTableSelector(); }, 50);
        if (typeof calculateRanglist === 'function' && typeof generateRanglist === 'function') {
            calculateRanglist();
            generateRanglist();
        }
        if (typeof refreshStatisticsExplorer === 'function') {
            refreshStatisticsExplorer();
        }
        if (typeof refreshMobileWorldRecordsIfVisible === 'function') {
            refreshMobileWorldRecordsIfVisible();
        }
        // Rebuild Settings chips if user is on that tab (Chess/Burger visibility)
        if (typeof mobileState !== 'undefined' && mobileState.currentSection === 'settings' &&
            typeof showBasicMobileSettingsSection === 'function') {
            showBasicMobileSettingsSection();
        }
    } catch (error) {
        console.error('Error after CE display toggle:', error);
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
        if (button.classList.contains('category-icons-toggle')) {
            // Keep icons/text toggle enabled and labeled during loads
            if (!loading && typeof applyCategoryIconsToggleToButton === 'function') {
                applyCategoryIconsToggleToButton(button);
            }
            return;
        }
        if (button.classList.contains('ce-display-btn')) {
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

    // CE header/mobile buttons (not always .table-option-btn)
    document.querySelectorAll('.ce-display-btn').forEach(function (button) {
        if (loading) {
            button.disabled = true;
            button.style.opacity = '0.5';
            button.style.cursor = 'not-allowed';
        } else {
            button.disabled = false;
            button.style.opacity = '1';
            button.style.cursor = 'pointer';
            if (typeof applyCeDisplayButtonState === 'function') {
                applyCeDisplayButtonState(button);
            }
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
function createOptionButton(setting, label){
    var button = document.createElement('button');
    button.setAttribute('class','optionButton');
    button.setAttribute('onclick','optionButtonClick(this.id)');
    button.setAttribute('id','option'+setting.id);
    button.setAttribute('type','button');
    var displayLabel = label;
    if (displayLabel == null) {
        displayLabel = setting.text;
        if (displayLabel == null && typeof gamemodes !== 'undefined') {
            for (var g in gamemodes) {
                if (gamemodes[g] === setting) { displayLabel = g; break; }
            }
        }
    }
    var icon = createIconElement(setting, displayLabel);
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
var playerStatsCache = null;
var playerStatsCachePromise = null;

function initializeUsernameSearch() {
    const searchBtn = document.getElementById('searchPlayerBtn');
    const usernameInput = document.getElementById('usernameSearch');
    const peakDatesContainer = document.getElementById('playerPeakDates');
    const peakRecordsBtn = document.getElementById('peakRecordsBtn');
    const peakPercentageBtn = document.getElementById('peakPercentageBtn');
    const latestDataBtn = document.getElementById('latestDataBtn');

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
                await displayPlayerPeakDates(playerData);
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

async function loadPlayerStatsData() {
    if (playerStatsCache) return playerStatsCache;
    if (playerStatsCachePromise) return playerStatsCachePromise;

    playerStatsCachePromise = (async function () {
        const response = await fetch('time-travel-cache/metadata/player-stats.json');
        if (!response.ok) {
            throw new Error('Failed to load player stats');
        }
        playerStatsCache = await response.json();
        return playerStatsCache;
    })();

    try {
        return await playerStatsCachePromise;
    } finally {
        playerStatsCachePromise = null;
    }
}

// Search for player in the stats database
async function searchPlayerStats(username) {
    try {
        const data = await loadPlayerStatsData();
        const players = data.players || [];

        // Case-insensitive exact match
        const player = players.find(p =>
            p.name.toLowerCase() === username.toLowerCase()
        );

        return player || null;
    } catch (error) {
        console.error('Error loading player stats:', error);
        throw error;
    }
}

function getPlayerLongevityBest(playerId) {
    const empty = { allTime: null, standing: null };
    if (!playerId || typeof loadStatisticsExplorerData !== 'function') {
        return Promise.resolve(empty);
    }

    return loadStatisticsExplorerData().then(function (data) {
        if (!data || !data.longevity) return empty;

        const longevity = data.longevity;
        let allRows = Array.isArray(longevity.all)
            ? longevity.all
            : (Array.isArray(longevity) ? longevity : []);
        if (typeof filterHoldsByDisplayedModes === 'function') {
            allRows = filterHoldsByDisplayedModes(allRows);
        }
        const standingRows = allRows.filter(function (r) { return r.stillStanding; });

        const pickBest = function (rows) {
            let best = null;
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (row.playerId !== playerId) continue;
                if (!best || row.days > best.days) best = row;
            }
            return best;
        };

        return {
            allTime: pickBest(allRows),
            standing: pickBest(standingRows)
        };
    }).catch(function () {
        return empty;
    });
}

function formatPlayerCategoryLabel(category) {
    const parsed = typeof parseCategoryKey === 'function' ? parseCategoryKey(category) : null;
    if (!parsed) return category || '—';
    return [parsed.gamemode, parsed.apple, parsed.speed, parsed.size, parsed.runMode]
        .filter(Boolean)
        .join(' · ');
}

function formatPlayerCategoryHtml(category) {
    const escape = typeof escapeHtml === 'function'
        ? escapeHtml
        : function (s) { return String(s == null ? '' : s); };
    const parsed = typeof parseCategoryKey === 'function' ? parseCategoryKey(category) : null;
    if (!parsed) return escape(category || '—');
    if (typeof formatCategoryInlineHtml === 'function') {
        return '<div class="player-longevity-cats">' + formatCategoryInlineHtml(parsed) + '</div>';
    }
    const details = [parsed.apple, parsed.speed, parsed.size, parsed.runMode]
        .filter(Boolean)
        .join(' · ');
    return '<div class="player-longevity-mode">' + escape(parsed.gamemode) + '</div>' +
        '<div class="player-longevity-details">' + escape(details) + '</div>';
}

function formatLongevityHoldHtml(row) {
    if (!row) {
        return '<div class="player-longevity-empty">None</div>';
    }

    const escape = typeof escapeHtml === 'function'
        ? escapeHtml
        : function (s) { return String(s == null ? '' : s); };
    const parsed = typeof parseCategoryKey === 'function' ? parseCategoryKey(row.category) : null;
    const isHS = parsed && parsed.runMode === 'High Score';
    const timeText = typeof formatPrimaryDisplay === 'function'
        ? formatPrimaryDisplay(row.time, isHS)
        : (row.time || '—');
    const timeHtml = row.weblink
        ? '<a class="stats-run-link" href="' + (typeof escapeAttr === 'function' ? escapeAttr(row.weblink) : row.weblink) +
            '" target="_blank" rel="noopener noreferrer">' + escape(timeText) + '</a>'
        : escape(timeText);
    const range = row.stillStanding
        ? (row.start || '?') + ' → present'
        : (row.start || '?') + ' → ' + (row.end || '?');
    const tied = row.tiedHolders > 1 ? ' · tied×' + row.tiedHolders : '';

    return '<div class="player-longevity-hold">' +
        '<div class="player-longevity-days">' + escape(String(row.days)) + ' days' + escape(tied) + '</div>' +
        '<div class="player-longevity-cat">' + formatPlayerCategoryHtml(row.category) + '</div>' +
        '<div class="player-longevity-meta"><span class="player-longevity-range">' + escape(range) + '</span>' +
        '<span class="player-longevity-time">' + timeHtml + '</span></div>' +
        '</div>';
}

function buildPlayerSearchProfileHtml(playerData, careerStats) {
    const escape = typeof escapeHtml === 'function'
        ? escapeHtml
        : function (s) { return String(s == null ? '' : s); };
    const totalDates = playerData.totalDates || 0;
    const totalRecords = playerData.totalRecords || 0;
    const wrDays = careerStats && careerStats.wrDays != null ? careerStats.wrDays : null;

    return '<div class="player-search-name">' + escape(playerData.name) + '</div>' +
        '<div class="player-search-summary">' +
        '<span><strong>' + escape(String(totalDates)) + '</strong> dates</span>' +
        '<span><strong>' + escape(String(totalRecords)) + '</strong> total WRs</span>' +
        (wrDays != null
            ? '<span><strong>' + escape(String(wrDays)) + '</strong> WR-days</span>'
            : '') +
        '</div>';
}

function getPlayerCareerStats(playerId) {
    if (!playerId || typeof loadStatisticsExplorerData !== 'function') {
        return Promise.resolve(null);
    }
    return loadStatisticsExplorerData().then(function (data) {
        // Prefer CE-aware recompute from longevity holds
        if (typeof buildDisplayedCareerRows === 'function') {
            const rows = buildDisplayedCareerRows();
            for (let i = 0; i < rows.length; i++) {
                if (rows[i].playerId === playerId) return rows[i];
            }
            return { playerId: playerId, wrDays: 0, bestAll: null, bestStanding: null };
        }
        const rows = (data && data.career) || [];
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].playerId === playerId) return rows[i];
        }
        return null;
    }).catch(function () {
        return null;
    });
}

function buildPlayerLongevityHtml(longevityBest) {
    const best = longevityBest || { allTime: null, standing: null };
    return '<div class="player-longevity-grid">' +
        '<div class="player-longevity-card">' +
        '<div class="player-longevity-label">Best longevity (all-time)</div>' +
        formatLongevityHoldHtml(best.allTime) +
        '</div>' +
        '<div class="player-longevity-card">' +
        '<div class="player-longevity-label">Best still standing</div>' +
        formatLongevityHoldHtml(best.standing) +
        '</div>' +
        '</div>';
}

// Display player peak dates + career / longevity profile
async function displayPlayerPeakDates(playerData) {
    const peakDatesContainer = document.getElementById('playerPeakDates');
    const peakRecordsDate = document.getElementById('peakRecordsDate');
    const peakPercentageDate = document.getElementById('peakPercentageDate');
    const peakRecordsBtn = document.getElementById('peakRecordsBtn');
    const peakPercentageBtn = document.getElementById('peakPercentageBtn');
    const latestDataBtn = document.getElementById('latestDataBtn');
    const profileEl = document.getElementById('playerSearchProfile');
    const longevityEl = document.getElementById('playerSearchLongevity');

    if (!peakDatesContainer || !peakRecordsDate || !peakPercentageDate) return;

    const careerStats = typeof getPlayerCareerStats === 'function'
        ? await getPlayerCareerStats(playerData.id)
        : null;

    if (profileEl) {
        profileEl.innerHTML = buildPlayerSearchProfileHtml(playerData, careerStats);
    }

    peakRecordsDate.textContent = playerData.peakRecords.date || '-';
    peakPercentageDate.textContent = playerData.peakPercentage.date || '-';

    if (peakRecordsBtn) {
        peakRecordsBtn.innerHTML = `📊 Peak Records: <span id="peakRecordsDate">${playerData.peakRecords.date || '-'}</span> (${playerData.peakRecords.count} records)`;
    }
    if (peakPercentageBtn) {
        peakPercentageBtn.innerHTML = `📈 Peak Percentage: <span id="peakPercentageDate">${playerData.peakPercentage.date || '-'}</span> (${playerData.peakPercentage.percentage}%)`;
    }
    if (latestDataBtn) {
        const latest = playerData.latest || {};
        const latestDate = latest.date || '-';
        const latestCount = latest.count != null ? latest.count : 0;
        const latestPct = latest.percentage != null ? latest.percentage : 0;
        latestDataBtn.innerHTML = `🕒 Latest Data: <span id="latestDataDate">${latestDate}</span> (${latestCount} records, ${latestPct}%)`;
    }

    peakDatesContainer.style.display = 'block';

    const longevityBest = await getPlayerLongevityBest(playerData.id);
    if (longevityEl) {
        longevityEl.innerHTML = buildPlayerLongevityHtml(longevityBest);
    }
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
window.setTimeTravelDate = setTimeTravelDate;
