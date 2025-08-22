// Mobile UI Module
// Handles all mobile-specific functionality and UI generation
// Integrates with existing desktop system

// Mobile state management
let mobileState = {
    currentSection: 'records',
    isInitialized: false
};

// Mobile-specific variables
let mobileTableData = null;

// Mobile-specific toggle functions (in case desktop functions aren't available)
function mobileToggleDarkMode() {
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
    
    // Update mobile toggle button
    const mobileToggleBtn = document.getElementById('mobileDarkModeToggle');
    if(mobileToggleBtn) {
        mobileToggleBtn.innerHTML = isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode';
        mobileToggleBtn.setAttribute('title', isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    }
}

async function mobileToggleTimeTravel() {
    isTimeTravelEnabled = !isTimeTravelEnabled;
    saveSettings();
    
    // Update desktop toggle button
    const timeTravelBtn = document.querySelector('.time-travel-btn');
    if(timeTravelBtn) {
        if(isTimeTravelEnabled) {
            timeTravelBtn.innerHTML = '⏰ Time Travel';
            timeTravelBtn.classList.add('active');
            timeTravelBtn.setAttribute('title', 'Time travel mode enabled. Click to disable.');
        } else {
            timeTravelBtn.innerHTML = '⏰ Time Travel';
            timeTravelBtn.classList.remove('active');
            timeTravelBtn.setAttribute('title', 'Time travel mode disabled. Click to enable.');
        }
    }
    
    // Update mobile toggle button
    const mobileTimeTravelBtn = document.getElementById('mobileTimeTravelBtn');
    if(mobileTimeTravelBtn) {
        if(isTimeTravelEnabled) {
            mobileTimeTravelBtn.classList.add('active');
            mobileTimeTravelBtn.setAttribute('title', 'Time travel mode enabled. Click to disable.');
        } else {
            mobileTimeTravelBtn.classList.remove('active');
            mobileTimeTravelBtn.setAttribute('title', 'Time travel mode disabled. Click to enable.');
        }
    }
    
    // Auto-resume API calls if they were paused
    if (isApiPaused) {
        isApiPaused = false;
        window.isApiPaused = false;
    }
    
    // Only refresh data on desktop (not mobile)
    if (window.innerWidth > 1023) {
        // Refresh data based on current state
        if (isTimeTravelEnabled) {
            // If time travel is enabled, refresh with current date
            await refreshWorldRecordsForSettings();
        } else {
            // If time travel is disabled, refresh with current date
            await refreshWorldRecordsForSettings();
        }
    }
    
    // Update date picker state
    updateMobileDatePickerState();
}

// Mobile-specific loading state function (overrides desktop setLoadingState)
function setMobileLoadingState(loading) {
    mobileState.isLoading = loading;
    
    // Update mobile refresh button state
    const mobileRefreshBtn = document.getElementById('mobileRefreshBtn');
    if (mobileRefreshBtn) {
        if (loading) {
            mobileRefreshBtn.textContent = '⏳ Loading...';
            mobileRefreshBtn.disabled = true;
            mobileRefreshBtn.setAttribute('title', 'Please wait while world records are being fetched...');
        } else if (isApiOverloaded) {
            mobileRefreshBtn.textContent = '⚠️ SRC API overloaded';
            mobileRefreshBtn.disabled = false;
            mobileRefreshBtn.setAttribute('title', 'Speedrun.com API is overloaded. Click to retry.');
        } else {
            mobileRefreshBtn.textContent = '🔄 Refresh';
            mobileRefreshBtn.disabled = false;
            mobileRefreshBtn.setAttribute('title', 'Refresh world records for current settings');
        }
    }
    
    // Update mobile stop/resume button
    const mobileStopResumeBtn = document.getElementById('mobileStopResumeBtn');
    if (mobileStopResumeBtn) {
        if (isApiPaused) {
            mobileStopResumeBtn.textContent = '▶️ Resume';
            mobileStopResumeBtn.style.display = 'block';
        } else if (loading) {
            mobileStopResumeBtn.textContent = '⏸️ Stop';
            mobileStopResumeBtn.style.display = 'block';
        } else {
            mobileStopResumeBtn.style.display = 'none';
        }
    }
}

// Trigger initial records loading for mobile (equivalent to desktop initializeUI behavior)
function triggerMobileInitialRecordsLoad() {
    console.log('Triggering mobile initial records load...');
    
    // First, ensure the mobile table structure is created
    setTimeout(() => {
        loadMobileTableData();
    }, 100);
    
    // Then trigger the initial data loading
    setTimeout(() => {
        // Check if we need to load initial records
        if (typeof worldRecords === 'undefined' || Object.keys(worldRecords).length === 0) {
            console.log('No world records found, triggering initial load...');
            
            // Call the same function that desktop uses for initial loading
            if (typeof startWorldRecordsDownload === 'function') {
                console.log('Calling startWorldRecordsDownload...');
                startWorldRecordsDownload();
            } else if (typeof refreshWorldRecordsForSettings === 'function') {
                console.log('Calling refreshWorldRecordsForSettings...');
                refreshWorldRecordsForSettings();
            } else {
                console.error('No records loading function available');
            }
        } else {
            console.log('World records already available, no need for initial load');
            // Even if records exist, refresh to ensure mobile display is updated
            if (typeof refreshWorldRecordsForSettings === 'function') {
                console.log('Refreshing existing records for mobile display...');
                refreshWorldRecordsForSettings();
            }
        }
    }, 200);
}

// Initialize mobile UI when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    if (window.innerWidth <= 1023) {
        // Simple mobile initialization without complex dependencies
        initializeSimpleMobileUI();
    }
});

// Also try to initialize if DOM is already loaded
if (document.readyState === 'loading') {
    // DOM is still loading, wait for DOMContentLoaded
} else {
    // DOM is already loaded, initialize immediately if on mobile
    if (window.innerWidth <= 1023) {
        initializeSimpleMobileUI();
    }
}

// Initialize simple mobile UI
function initializeSimpleMobileUI() {
    console.log('Initializing simple mobile UI...');
    
    // Settings are already loaded by the desktop system (main.js)
    
    // Setup mobile navigation
    setupMobileNavigation();
    
    // Wait for desktop system to be ready, then show initial section
    waitForDesktopSystem();
    
    console.log('Simple mobile UI initialized successfully');
}

// Wait for desktop system to be ready
function waitForDesktopSystem() {
    const checkInterval = setInterval(() => {
        // Check if desktop system is loaded
        if (typeof worldRecords !== 'undefined' && 
            typeof generateLeaderboard === 'function' && 
            typeof generateMultipleTables === 'function' &&
            typeof currentTableSettings !== 'undefined' &&
            typeof isMultipleTablesEnabled !== 'undefined' &&
            typeof loadSettings === 'function') {
            clearInterval(checkInterval);
            console.log('Desktop system ready, showing mobile records...');
            console.log('Available functions:', {
                worldRecords: typeof worldRecords,
                generateLeaderboard: typeof generateLeaderboard,
                generateMultipleTables: typeof generateMultipleTables,
                currentTableSettings: typeof currentTableSettings,
                isMultipleTablesEnabled: typeof isMultipleTablesEnabled,
                loadSettings: typeof loadSettings
            });
            
            // Initialize mobile run and game modes
            initializeMobileRunAndGameModes();
            
            // Mobile uses its own loading state system - no override needed
            
            showBasicMobileRecordsSection();
            
            // Update API progress display
            // updateMobileApiProgress(); // This function is removed
            
            // Trigger initial records loading for mobile
            triggerMobileInitialRecordsLoad();
        }
    }, 100);
    
    // Timeout after 10 seconds
    setTimeout(() => {
        clearInterval(checkInterval);
        console.log('Desktop system not ready after timeout, showing loading state...');
        console.log('Available functions:', {
            worldRecords: typeof worldRecords,
            generateLeaderboard: typeof generateLeaderboard,
            generateMultipleTables: typeof generateMultipleTables,
            currentTableSettings: typeof currentTableSettings,
            isMultipleTablesEnabled: typeof isMultipleTablesEnabled,
            loadSettings: typeof loadSettings
        });
        showBasicMobileRecordsSection();
    }, 10000);
}

// Setup mobile navigation
function setupMobileNavigation() {
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
    console.log('Setting up mobile navigation with', mobileNavItems.length, 'items');
    
    if (mobileNavItems.length === 0) {
        console.error('No mobile navigation items found!');
        console.log('Available elements with mobile-nav-item class:', document.querySelectorAll('.mobile-nav-item'));
        return;
    }
    
    mobileNavItems.forEach((item, index) => {
        const section = item.getAttribute('data-section');
        console.log(`Setting up nav item ${index}:`, section);
        
        item.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Mobile nav clicked:', section);
            switchBasicMobileSection(section);
        });
    });

    console.log('Mobile navigation setup complete');
}



// Switch basic mobile section
function switchBasicMobileSection(section) {
    console.log('Switching to mobile section:', section);
    
    // Update navigation
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
    mobileNavItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-section') === section) {
            item.classList.add('active');
        }
    });

    // Update mobile state
    mobileState.currentSection = section;

    // Handle section-specific logic
    switch (section) {
        case 'settings':
            showBasicMobileSettingsSection();
            break;
        case 'records':
            showBasicMobileRecordsSection();
            // Refresh table when switching to records to ensure latest settings are applied
            setTimeout(() => {
                // Double-check we're still on records section before loading
                if (mobileState.currentSection === 'records') {
                    loadMobileTableData();
                } else {
                    console.log('Navigation changed, skipping table load');
                }
            }, 100);
            break;
        case 'summary':
            showBasicMobileSummarySection();
            // Refresh summary when switching to summary to ensure latest data is shown
            setTimeout(() => {
                // Double-check we're still on summary section before loading
                if (mobileState.currentSection === 'summary') {
                    loadMobileSummaryData();
                } else {
                    console.log('Navigation changed, skipping summary load');
                }
            }, 200);
            break;
        default:
            console.log('Unknown mobile section:', section);
    }
}

// Show basic mobile records section
function showBasicMobileRecordsSection() {
    console.log('Showing mobile records section');
    const mobileTablesContainer = document.getElementById('mobileTablesContainer');
    if (!mobileTablesContainer) {
        console.error('Mobile tables container not found!');
        return;
    }

    // Check if we already have records content specifically
    const existingRecordsContent = mobileTablesContainer.querySelector('.mobile-card .mobile-card-title');
    if (existingRecordsContent && existingRecordsContent.textContent === 'World Records') {
        // If records content exists, update API progress and load table data
        console.log('Records content already exists, updating API progress and loading table');
        // updateMobileApiProgress(); // This function is removed
        loadMobileTableData();
        return;
    }

    // Create the records section with controls
    mobileTablesContainer.innerHTML = `
        <div class="mobile-card">
            <div class="mobile-card-header">
                <h2 class="mobile-card-title">World Records</h2>
            </div>
            
            <!-- Mobile Records Controls -->
            <div class="mobile-records-controls">
                <div class="mobile-controls-grid">
                </div>
                
                <!-- Data Section -->
                <div class="mobile-data-section">
                    <button class="mobile-option-btn" id="mobileRefreshBtn">🔄 Refresh</button>
                    <button class="mobile-option-btn" id="mobileStopResumeBtn" style="display: none;">
                        ⏸️ Stop
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Mobile Table Container - Outside the card -->
        <div id="mobileTableContent" class="mobile-table-content">
            <div class="mobile-loading">
                <p>Loading world records...</p>
            </div>
        </div>
    `;

    // Setup mobile records event listeners
    setupMobileRecordsEventListeners();

    // Set initial refresh button state
    const refreshBtn = document.getElementById('mobileRefreshBtn');
    if (refreshBtn) {
        if (isApiOverloaded) {
            refreshBtn.textContent = '⚠️ SRC API overloaded';
            refreshBtn.setAttribute('title', 'Speedrun.com API is overloaded. Click to retry.');
        } else {
            refreshBtn.textContent = '🔄 Refresh';
            refreshBtn.setAttribute('title', 'Refresh world records for current settings');
        }
    }

    // Load the table data
    loadMobileTableData();

    // Set up periodic API progress updates
    // setInterval(updateMobileApiProgress, 1000); // This function is removed
    

}

// Setup mobile records event listeners
function setupMobileRecordsEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('mobileRefreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async function() {
            // Prevent multiple clicks while loading
            if (isLoading) {
                console.log('Already loading, ignoring refresh click');
                return;
            }
            
            try {
                // Update button to show loading state
                this.textContent = '⏳ Loading...';
                this.disabled = true;
                this.setAttribute('title', 'Please wait while world records are being fetched...');
                
                // Call the refresh function and wait for it to complete
                await refreshWorldRecordsForSettings();
                
                            // Wait a bit for the desktop table to be generated
            setTimeout(() => {
                // Load the mobile table data after refresh is complete
                loadMobileTableData();
                
                // Also refresh the summary table if we're on the summary tab
                if (mobileState.currentSection === 'summary') {
                    setTimeout(() => {
                        loadMobileSummaryData();
                    }, 200);
                }
            }, 100);
                
            } catch (error) {
                console.error('Error refreshing mobile table:', error);
                // Show error message in mobile container
                const mobileTableContent = document.getElementById('mobileTableContent');
                if (mobileTableContent) {
                    if (isApiOverloaded) {
                        mobileTableContent.innerHTML = `
                            <div class="mobile-loading">
                                <p>⚠️ Speedrun.com API is overloaded. Please try again later.</p>
                            </div>
                        `;
                    } else {
                        mobileTableContent.innerHTML = `
                            <div class="mobile-loading">
                                <p>❌ Error refreshing world records. Please try again.</p>
                            </div>
                        `;
                    }
                }
            } finally {
                // Restore button state
                if (isApiOverloaded) {
                    this.textContent = '⚠️ SRC API overloaded';
                    this.disabled = false;
                    this.setAttribute('title', 'Speedrun.com API is overloaded. Click to retry.');
                } else {
                    this.textContent = '🔄 Refresh';
                    this.disabled = false;
                    this.setAttribute('title', 'Refresh world records for current settings');
                }
            }
        });
    }



    // Stop/resume button
    const stopResumeBtn = document.getElementById('mobileStopResumeBtn');
    if (stopResumeBtn) {
        stopResumeBtn.addEventListener('click', function() {
            toggleApiPause();
            // Update button text
            if (isApiPaused) {
                this.textContent = '▶️ Resume';
                this.setAttribute('title', 'Resume API calls');
            } else {
                this.textContent = '⏸️ Stop';
                this.setAttribute('title', 'Stop API calls');
            }
        });
    }
}

// Load mobile table data
function loadMobileTableData() {
    const mobileTableContent = document.getElementById('mobileTableContent');
    if (!mobileTableContent) return;

    // Check if we're still on the records section before loading
    if (mobileState.currentSection !== 'records') {
        console.log('loadMobileTableData: Skipping table load - not on records section (current:', mobileState.currentSection, ')');
        return;
    }

    console.log('loadMobileTableData: Starting table load');
    console.log('worldRecords available:', typeof worldRecords !== 'undefined' && Object.keys(worldRecords).length > 0);
    console.log('isMultipleTablesEnabled:', typeof isMultipleTablesEnabled !== 'undefined' ? isMultipleTablesEnabled : 'undefined');

    // Check if we have world records data
    if (typeof worldRecords !== 'undefined' && Object.keys(worldRecords).length > 0) {
        if (typeof isMultipleTablesEnabled !== 'undefined' && isMultipleTablesEnabled) {
            console.log('Loading multiple tables...');
            // For multiple tables, create a mobile-specific container
            const multipleTablesContainer = document.createElement('div');
            multipleTablesContainer.setAttribute('class', 'mobile-multiple-tables-container');
            mobileTableContent.innerHTML = '';
            mobileTableContent.appendChild(multipleTablesContainer);
            
            // Temporarily show the desktop container to generate tables
            const desktopContainer = document.querySelector('.container');
            if (desktopContainer) {
                desktopContainer.style.display = 'flex';
                
                // Call the same function desktop uses for multiple tables
                if (typeof generateMultipleTables === 'function') {
                    console.log('Calling generateMultipleTables...');
                    generateMultipleTables();
                    
                    // Find and move the content immediately
                    const multipleTablesElement = document.querySelector('.multiple-tables-container');
                    console.log('Found multiple tables element:', multipleTablesElement);
                    
                    if (multipleTablesElement) {
                        // Clone the content and move it to mobile
                        const clonedContent = multipleTablesElement.cloneNode(true);
                        multipleTablesContainer.appendChild(clonedContent);
                        
                        // Add individual refresh buttons to mobile multiple tables
                        addMobileIndividualRefreshButtons();
                        
                        // Hide the desktop container again
                        desktopContainer.style.display = 'none';
                        console.log('Multiple tables loaded successfully');
                    } else {
                        console.log('ERROR: Could not find .multiple-tables-container');
                        mobileTableContent.innerHTML = `
                            <div class="mobile-loading">
                                <p>Error: Could not load multiple tables</p>
                            </div>
                        `;
                        desktopContainer.style.display = 'none';
                    }
                }
            } else {
                console.log('ERROR: Could not find .container');
                mobileTableContent.innerHTML = `
                    <div class="mobile-loading">
                        <p>Error: Could not find desktop container</p>
                    </div>
                `;
            }
        } else {
            console.log('Loading single table...');
            // For single table, create a mobile-specific wrapper
            const tableWrapper = document.createElement('div');
            tableWrapper.setAttribute('class', 'mobile-table-wrapper');
            mobileTableContent.innerHTML = '';
            mobileTableContent.appendChild(tableWrapper);
            
            // Temporarily show the desktop container to generate tables
            const desktopContainer = document.querySelector('.container');
            if (desktopContainer) {
                desktopContainer.style.display = 'flex';
                
                // Call the same function desktop uses for single table
                if (typeof generateLeaderboard === 'function' && typeof currentTableSettings !== 'undefined') {
                    console.log('Calling generateLeaderboard with settings:', currentTableSettings);
                    generateLeaderboard(currentTableSettings);
                    
                    // Find and move the content immediately
                    const mainTableElement = document.querySelector('.main-table-wrapper');
                    console.log('Found main table element:', mainTableElement);
                    
                    if (mainTableElement) {
                        // Clone the content and move it to mobile
                        const clonedTable = mainTableElement.cloneNode(true);
                        tableWrapper.appendChild(clonedTable);
                        
                        // Hide the desktop container again
                        desktopContainer.style.display = 'none';
                        console.log('Single table loaded successfully');
                    } else {
                        console.log('ERROR: Could not find .main-table-wrapper');
                        mobileTableContent.innerHTML = `
                            <div class="mobile-loading">
                                <p>Error: Could not load table</p>
                            </div>
                        `;
                        desktopContainer.style.display = 'none';
                    }
                }
            } else {
                console.log('ERROR: Could not find .container');
                mobileTableContent.innerHTML = `
                    <div class="mobile-loading">
                        <p>Error: Could not find desktop container</p>
                    </div>
                `;
            }
        }
        
        // Update API progress after loading
        // updateMobileApiProgress(); // This function is removed
    } else {
        console.log('No world records data available, showing loading message');
        // Show loading message
        mobileTableContent.innerHTML = `
            <div class="mobile-loading">
                <p>Loading world records...</p>
            </div>
        `;
    }
    
    // Function to add individual refresh buttons to mobile multiple tables
    function addMobileIndividualRefreshButtons() {
        console.log('Adding individual refresh buttons to mobile multiple tables...');
        
        // Find all table wrappers in mobile multiple tables container
        const mobileTableWrappers = document.querySelectorAll('.mobile-multiple-tables-container .table-wrapper');
        
        mobileTableWrappers.forEach(tableWrapper => {
            // Get the settings from the data-settings attribute
            const settingsAttr = tableWrapper.getAttribute('data-settings');
            if (!settingsAttr) {
                console.log('No data-settings found for table wrapper');
                return;
            }
            
            const settings = settingsAttr.split('|');
            if (settings.length < 3) {
                console.log('Invalid settings format:', settingsAttr);
                return;
            }
            
            // Find the table header cell (first th in thead)
            const table = tableWrapper.querySelector('table');
            if (!table) {
                console.log('No table found in wrapper');
                return;
            }
            
            const thead = table.querySelector('thead');
            if (!thead) {
                console.log('No thead found in table');
                return;
            }
            
            // Find the second row (the one with the refresh button)
            const headerRows = thead.querySelectorAll('tr');
            if (headerRows.length < 2) {
                console.log('Not enough header rows found');
                return;
            }
            
            const secondRow = headerRows[1]; // Second row (index 1)
            const firstHeaderCell = secondRow.querySelector('th');
            
            if (!firstHeaderCell) {
                console.log('No first header cell found');
                return;
            }
            
            // Check if refresh button already exists
            const existingButton = firstHeaderCell.querySelector('.individual-refresh-btn');
            if (existingButton) {
                console.log('Refresh button already exists for this table');
                return;
            }
            
            // Create mobile-specific refresh button
            const refreshButton = document.createElement('button');
            refreshButton.setAttribute('class', 'table-option-btn refresh-btn individual-refresh-btn mobile-individual-refresh-btn');
            refreshButton.innerHTML = '🔄';
            refreshButton.setAttribute('title', `Refresh ${settings[0]} ${settings[1]} ${settings[2]} table`);
            refreshButton.onclick = function(settings) {
                return async function() {
                    if (isLoading) return; // Prevent clicks while loading
                    console.log('Mobile individual refresh clicked for settings:', settings);
                    await refreshSpecificTable(settings);
                    
                    // Refresh the mobile display after the data is updated
                    setTimeout(() => {
                        loadMobileTableData();
                    }, 100);
                };
            }(settings);
            
            // Add button to the first header cell
            firstHeaderCell.appendChild(refreshButton);
            console.log('Added mobile individual refresh button for settings:', settings);
        });
    }
}

// Show basic mobile settings section
function showBasicMobileSettingsSection() {
    const mobileTablesContainer = document.getElementById('mobileTablesContainer');
    if (!mobileTablesContainer) return;

    // Settings are already loaded during initial page load, no need to reload here

    mobileTablesContainer.innerHTML = `
        <div class="mobile-settings-content">
            <h2 style="font-size: 24px; font-weight: 700; color: var(--mobile-text); margin-bottom: 20px; text-align: center;">Settings</h2>
            
            <!-- Time Travel Date Picker -->
            <div class="mobile-form-group">
                <label class="mobile-form-label" for="mobileDatePicker">Pick a date to travel back in time</label>
                <input type="date" id="mobileDatePicker" class="mobile-form-input" value="${selectedTimeTravelDate || ''}">
            </div>

            <!-- Category Settings -->
            <div class="mobile-form-group">
                <label class="mobile-form-label">Category Settings</label>
                <div id="mobileCategorySettings" class="mobile-category-grid">
                    ${generateMobileCategoryCheckboxes()}
                </div>
            </div>

            <!-- Run Mode Settings -->
            <div class="mobile-form-group">
                <label class="mobile-form-label">Run Mode Settings</label>
                <div id="mobileRunModeSettings">
                    ${generateMobileRunModeCheckboxes()}
                </div>
            </div>

            <!-- Options Section -->
            <div class="mobile-form-group">
                <label class="mobile-form-label">Options</label>
                <div class="mobile-options-section">
                    <div class="mobile-options-grid">
                        <button class="mobile-option-btn" id="mobileDarkModeToggle" title="${isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}">
                            ${isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
                        </button>
                        <button class="mobile-option-btn" id="mobileTimeTravelBtn" title="Toggle time travel mode">
                            ⏰ Time Travel
                        </button>
                        <button class="mobile-option-btn" id="mobileMultipleTablesToggle" title="Toggle multiple tables mode">
                            📊 Multiple Tables
                        </button>
                        <button class="mobile-option-btn" id="mobileResetBtn" title="Reset settings to default">
                            🔧 Reset
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add event listeners
    setupMobileSettingsEventListeners();
    
    // Ensure settings are synchronized with desktop system
    console.log('Mobile settings section loaded - settings synchronized with desktop');
    
    // Update time travel button state to ensure it reflects current settings
    updateMobileTimeTravelButtonState();
    
    // Update date picker state to ensure it reflects current settings
    updateMobileDatePickerState();
}

// Update mobile time travel button state
function updateMobileTimeTravelButtonState() {
    const timeTravelBtn = document.getElementById('mobileTimeTravelBtn');
    if (timeTravelBtn) {
        if (isTimeTravelEnabled) {
            timeTravelBtn.classList.add('active');
            timeTravelBtn.setAttribute('title', 'Time travel mode enabled. Click to disable.');
        } else {
            timeTravelBtn.classList.remove('active');
            timeTravelBtn.setAttribute('title', 'Time travel mode disabled. Click to enable.');
        }
    }
    
    // Also update date picker state
    updateMobileDatePickerState();
}

// Update mobile date picker state
function updateMobileDatePickerState() {
    const datePicker = document.getElementById('mobileDatePicker');
    if (datePicker) {
        // Set the date picker value to the current selected date
        datePicker.value = selectedTimeTravelDate || '';
        
        // Optionally, you could also show/hide the date picker based on time travel state
        // For now, we'll keep it always visible but ensure it has the correct value
    }
}

// Initialize run modes and game modes to be all selected
function initializeMobileRunAndGameModes() {
    let needsSaving = false;
    
    // Check if run modes have been initialized before
    const runModesInitialized = localStorage.getItem('mobileRunModesInitialized');
    if (!runModesInitialized) {
        // Set all run modes to visible
        for (const [key, value] of Object.entries(runModes)) {
            value.visible = true;
        }
        localStorage.setItem('mobileRunModesInitialized', 'true');
        needsSaving = true;
    }
    
    // Check if game modes have been initialized before
    const gameModesInitialized = localStorage.getItem('mobileGameModesInitialized');
    if (!gameModesInitialized) {
        // Set all game modes to visible
        for (const [key, value] of Object.entries(gamemodes)) {
            value.visible = true;
        }
        localStorage.setItem('mobileGameModesInitialized', 'true');
        needsSaving = true;
    }
    
    // Only save settings if we actually made changes
    if (needsSaving) {
        saveSettings();
    }
}

// Generate mobile category icon buttons
function generateMobileCategoryCheckboxes() {
    let html = '';
    
    // Apple Amounts
    html += '<div class="mobile-category-section">';
    html += '<h4 class="mobile-category-title">Apple Amounts</h4>';
    html += '<div class="mobile-button-group">';
    for (const [key, value] of Object.entries(appleAmounts)) {
        const isActive = isMultipleTablesEnabled ? value.visible : (currentTableSettings[0] === key);
        html += `
            <button class="mobile-table-option-btn ${isActive ? 'active' : ''}" data-setting="${key}" data-type="apple">
                <img src="${value.icon}" alt="${key}" class="mobile-category-icon">
            </button>
        `;
    }
    html += '</div></div>';

    // Speeds
    html += '<div class="mobile-category-section">';
    html += '<h4 class="mobile-category-title">Speeds</h4>';
    html += '<div class="mobile-button-group">';
    for (const [key, value] of Object.entries(speeds)) {
        const isActive = isMultipleTablesEnabled ? value.visible : (currentTableSettings[1] === key);
        html += `
            <button class="mobile-table-option-btn ${isActive ? 'active' : ''}" data-setting="${key}" data-type="speed">
                <img src="${value.icon}" alt="${key}" class="mobile-category-icon">
            </button>
        `;
    }
    html += '</div></div>';

    // Sizes
    html += '<div class="mobile-category-section">';
    html += '<h4 class="mobile-category-title">Sizes</h4>';
    html += '<div class="mobile-button-group">';
    for (const [key, value] of Object.entries(sizes)) {
        const isActive = isMultipleTablesEnabled ? value.visible : (currentTableSettings[2] === key);
        html += `
            <button class="mobile-table-option-btn ${isActive ? 'active' : ''}" data-setting="${key}" data-type="size">
                <img src="${value.icon}" alt="${key}" class="mobile-category-icon">
            </button>
        `;
    }
    html += '</div></div>';

    // Game Modes
    html += '<div class="mobile-category-section">';
    html += '<h4 class="mobile-category-title">Game Modes</h4>';
    html += '<div class="mobile-button-group">';
    for (const [key, value] of Object.entries(gamemodes)) {
        // Game modes are always toggle behavior (always use value.visible)
        const isActive = value.visible;
        html += `
            <button class="mobile-table-option-btn ${isActive ? 'active' : ''}" data-setting="${key}" data-type="gamemode">
                <img src="${value.icon}" alt="${key}" class="mobile-category-icon">
            </button>
        `;
    }
    html += '</div></div>';

    return html;
}

// Generate mobile run mode icon buttons
function generateMobileRunModeCheckboxes() {
    let html = '';
    html += '<div class="mobile-button-group">';
    for (const [key, value] of Object.entries(runModes)) {
        // Run modes are always toggle behavior and start all selected
        const isActive = value.visible;
        html += `
            <button class="mobile-table-option-btn ${isActive ? 'active' : ''}" data-setting="${key}" data-type="runmode">
                ${value.text}
            </button>
        `;
    }
    html += '</div>';
    return html;
}

// Setup mobile settings event listeners
function setupMobileSettingsEventListeners() {
    // Date picker
    const datePicker = document.getElementById('mobileDatePicker');
    if (datePicker) {
        // Set initial value from saved settings
        datePicker.value = selectedTimeTravelDate || '';
        
        datePicker.addEventListener('change', function() {
            selectedTimeTravelDate = this.value;
            
            // If a date is selected, enable time travel mode
            if (this.value && !isTimeTravelEnabled) {
                isTimeTravelEnabled = true;
                updateMobileTimeTravelButtonState();
            }
            
            saveSettings();
        });
    }

    // Reset button
    const resetBtn = document.getElementById('mobileResetBtn');
    
    if (resetBtn) {
        resetBtn.addEventListener('click', resetMobileSettings);
    }

    // Setup checkbox listeners
    setupMobileCheckboxListeners();

    // Setup options section listeners (from desktop table-selector)
    setupMobileOptionsListeners();

    // Setup data section listeners (from desktop table-selector)
    setupMobileDataListeners();
}

// Setup mobile options listeners
function setupMobileOptionsListeners() {
    // Dark mode toggle
    const darkModeToggle = document.getElementById('mobileDarkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', function() {
            // Use mobile-specific function if available, fallback to desktop function
            if (typeof mobileToggleDarkMode === 'function') {
                mobileToggleDarkMode();
            } else if (typeof toggleDarkMode === 'function') {
                toggleDarkMode();
            } else {
                console.error('toggleDarkMode function not available');
            }
        });
    }

    // Time travel button
    const timeTravelBtn = document.getElementById('mobileTimeTravelBtn');
    if (timeTravelBtn) {
        // Set initial state
        if (isTimeTravelEnabled) {
            timeTravelBtn.classList.add('active');
            timeTravelBtn.setAttribute('title', 'Time travel mode enabled. Click to disable.');
        } else {
            timeTravelBtn.classList.remove('active');
            timeTravelBtn.setAttribute('title', 'Time travel mode disabled. Click to enable.');
        }
        
        timeTravelBtn.addEventListener('click', function() {
            // Use mobile-specific function if available, fallback to desktop function
            if (typeof mobileToggleTimeTravel === 'function') {
                mobileToggleTimeTravel();
            } else if (typeof toggleTimeTravel === 'function') {
                toggleTimeTravel();
            } else {
                console.error('toggleTimeTravel function not available');
            }
        });
    }

    // Multiple tables toggle
    const multipleTablesToggle = document.getElementById('mobileMultipleTablesToggle');
    if (multipleTablesToggle) {
        // Set initial state
        if (isMultipleTablesEnabled) {
            multipleTablesToggle.classList.add('active');
            multipleTablesToggle.setAttribute('title', 'Multiple tables mode enabled. Click to disable.');
        } else {
            multipleTablesToggle.classList.remove('active');
            multipleTablesToggle.setAttribute('title', 'Multiple tables mode disabled. Click to enable.');
        }
        
        multipleTablesToggle.addEventListener('click', function() {
            // Toggle the state
            isMultipleTablesEnabled = !isMultipleTablesEnabled;
            saveSettings();
            
            // Update button state
            if (isMultipleTablesEnabled) {
                this.classList.add('active');
                this.setAttribute('title', 'Multiple tables mode enabled. Click to disable.');
            } else {
                this.classList.remove('active');
                this.setAttribute('title', 'Multiple tables mode disabled. Click to enable.');
            }
            
            // Update button states to reflect new radio/toggle behavior
            updateMobileButtonStates();
        });
    }
}

// Setup mobile data listeners (now handled in records section)
function setupMobileDataListeners() {
    // Data listeners are now handled in setupMobileRecordsEventListeners
}

// Setup mobile icon button listeners
function setupMobileCheckboxListeners() {
    // Add click listeners to all mobile table option buttons
    const buttons = document.querySelectorAll('.mobile-table-option-btn');
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            if (isLoading) return; // Prevent clicks while loading
            
            const setting = this.getAttribute('data-setting');
            const type = this.getAttribute('data-type');
            
            if (type === 'apple') {
                if (isMultipleTablesEnabled) {
                    // Toggle behavior: toggle the visible state
                    appleAmounts[setting].visible = !appleAmounts[setting].visible;
                } else {
                    // Radio behavior: set only this one as active
                    currentTableSettings[0] = setting;
                }
            } else if (type === 'speed') {
                if (isMultipleTablesEnabled) {
                    // Toggle behavior: toggle the visible state
                    speeds[setting].visible = !speeds[setting].visible;
                } else {
                    // Radio behavior: set only this one as active
                    currentTableSettings[1] = setting;
                }
            } else if (type === 'size') {
                if (isMultipleTablesEnabled) {
                    // Toggle behavior: toggle the visible state
                    sizes[setting].visible = !sizes[setting].visible;
                } else {
                    // Radio behavior: set only this one as active
                    currentTableSettings[2] = setting;
                }
            } else if (type === 'gamemode') {
                // Game modes are always toggle behavior
                gamemodes[setting].visible = !gamemodes[setting].visible;
            } else if (type === 'runmode') {
                // Run modes are always toggle behavior
                runModes[setting].visible = !runModes[setting].visible;
            }
            
            saveSettings();
            // Update button states immediately
            updateMobileButtonStates();
        });
    });
}

// Save mobile settings
function saveMobileSettings() {
    // Settings are already saved via checkbox listeners
    // This function can be used for additional mobile-specific settings
    console.log('Mobile settings saved');
}

// Refresh mobile table after settings change
function refreshMobileTableAfterSettingsChange() {
    // Only refresh if we're currently on the records tab
    if (mobileState.currentSection === 'records') {
        console.log('Refreshing mobile table after settings change');
        // Reload the table data with new settings
        showBasicMobileRecordsSection();
    }
}

// Update mobile button states to reflect radio/toggle behavior
function updateMobileButtonStates() {
    // Apple Amounts
    for (const [key, value] of Object.entries(appleAmounts)) {
        const button = document.querySelector(`.mobile-table-option-btn[data-setting="${key}"][data-type="apple"]`);
        if (button) {
            const isActive = isMultipleTablesEnabled ? value.visible : (currentTableSettings[0] === key);
            if (isActive) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        }
    }

    // Speeds
    for (const [key, value] of Object.entries(speeds)) {
        const button = document.querySelector(`.mobile-table-option-btn[data-setting="${key}"][data-type="speed"]`);
        if (button) {
            const isActive = isMultipleTablesEnabled ? value.visible : (currentTableSettings[1] === key);
            if (isActive) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        }
    }

    // Sizes
    for (const [key, value] of Object.entries(sizes)) {
        const button = document.querySelector(`.mobile-table-option-btn[data-setting="${key}"][data-type="size"]`);
        if (button) {
            const isActive = isMultipleTablesEnabled ? value.visible : (currentTableSettings[2] === key);
            if (isActive) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        }
    }

    // Game Modes
    for (const [key, value] of Object.entries(gamemodes)) {
        const button = document.querySelector(`.mobile-table-option-btn[data-setting="${key}"][data-type="gamemode"]`);
        if (button) {
            if (value.visible) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        }
    }

    // Run Modes
    for (const [key, value] of Object.entries(runModes)) {
        const button = document.querySelector(`.mobile-table-option-btn[data-setting="${key}"][data-type="runmode"]`);
        if (button) {
            if (value.visible) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        }
    }
}

// Reset mobile settings to default
function resetMobileSettings() {
    // Reset all buttons to active (visible)
    for (const [key, value] of Object.entries(appleAmounts)) {
        value.visible = true;
    }

    for (const [key, value] of Object.entries(speeds)) {
        value.visible = true;
    }

    for (const [key, value] of Object.entries(sizes)) {
        value.visible = true;
    }

    for (const [key, value] of Object.entries(gamemodes)) {
        value.visible = true;
    }

    for (const [key, value] of Object.entries(runModes)) {
        value.visible = true;
    }

    // Clear date picker and disable time travel
    const datePicker = document.getElementById('mobileDatePicker');
    if (datePicker) {
        datePicker.value = '';
        selectedTimeTravelDate = '';
        localStorage.removeItem('selectedTimeTravelDate');
    }
    
    // Disable time travel mode
    isTimeTravelEnabled = false;

    // Save settings
    saveSettings();
    
    // Update button states to reflect the reset
    updateMobileButtonStates();
    
    // Update time travel button state to reflect the reset
    updateMobileTimeTravelButtonState();
    
    // Show success message
    const resetButton = document.getElementById('mobileResetBtn');
    if (resetButton) {
        resetButton.innerHTML = '🔧 Settings Reset!';
        setTimeout(() => {
            resetButton.innerHTML = '🔧 Reset';
        }, 2000);
    }
}

// Show basic mobile summary section
function showBasicMobileSummarySection() {
    const mobileTablesContainer = document.getElementById('mobileTablesContainer');
    if (!mobileTablesContainer) return;

    mobileTablesContainer.innerHTML = `
        <div class="mobile-card">
            <div class="mobile-card-header">
                <h2 class="mobile-card-title">Summary</h2>
            </div>
        </div>
        
        <!-- Mobile Summary Table Container -->
        <div id="mobileSummaryContent" class="mobile-table-content">
            <div class="mobile-loading">
                <p>Loading summary...</p>
            </div>
        </div>
    `;

    // Load the summary table data
    setTimeout(() => {
        loadMobileSummaryData();
    }, 100);
}

// Load mobile summary table data
function loadMobileSummaryData() {
    const mobileSummaryContent = document.getElementById('mobileSummaryContent');
    if (!mobileSummaryContent) return;

    // Check if we're still on the summary section before loading
    if (mobileState.currentSection !== 'summary') {
        console.log('loadMobileSummaryData: Skipping summary load - not on summary section (current:', mobileState.currentSection, ')');
        return;
    }

    console.log('loadMobileSummaryData: Starting summary load');
    console.log('worldRecords available:', typeof worldRecords !== 'undefined' && Object.keys(worldRecords).length > 0);
    console.log('ranglist available:', typeof ranglist !== 'undefined' && ranglist.length > 0);

    // Check if we have world records data first
    if (typeof worldRecords !== 'undefined' && Object.keys(worldRecords).length > 0) {
        console.log('World records data available, generating summary table...');
        
        // Create a mobile-specific wrapper for the summary table
        const summaryWrapper = document.createElement('div');
        summaryWrapper.setAttribute('class', 'mobile-summary-wrapper');
        mobileSummaryContent.innerHTML = '';
        mobileSummaryContent.appendChild(summaryWrapper);
        
        // Call the same functions desktop uses for summary table
        if (typeof calculateRanglist === 'function' && typeof generateRanglist === 'function') {
            console.log('Calling calculateRanglist...');
            calculateRanglist();
            
            console.log('Ranglist calculated:', ranglist);
            console.log('Ranglist keys:', Object.keys(ranglist));
            console.log('Ranglist entries count:', Object.keys(ranglist).length);
            
            if (Object.keys(ranglist).length > 0) {
                console.log('Generating ranglist table...');
                generateRanglist();
                
                // Find the generated ranglist element
                const ranglistElement = document.querySelector('.ranglist-wrapper');
                console.log('Found ranglist element:', ranglistElement);
                
                if (ranglistElement) {
                    // Clone the content and move it to mobile
                    const clonedContent = ranglistElement.cloneNode(true);
                    summaryWrapper.appendChild(clonedContent);
                    
                    // Fix the "more runners" button in the cloned content
                    const moreButton = clonedContent.querySelector('#morebutton');
                    if (moreButton) {
                        console.log('Found more button, adding mobile event listener');
                        moreButton.addEventListener('click', () => {
                            console.log('More button clicked, showing all runners');
                            // Show all hidden rows in this specific table
                            const hiddenRows = clonedContent.querySelectorAll('.ranglistRow[style*="display:none"]');
                            hiddenRows.forEach(row => {
                                row.style.display = '';
                            });
                            // Hide the button
                            moreButton.style.display = 'none';
                        });
                    }
                    
                    // Remove the original from desktop (since we cloned it)
                    ranglistElement.remove();
                    
                    console.log('Summary table loaded successfully');
                } else {
                    console.log('ERROR: Could not find .ranglist-wrapper after generation');
                    mobileSummaryContent.innerHTML = `
                        <div class="mobile-loading">
                            <p>Error: Could not generate summary table</p>
                        </div>
                    `;
                }
            } else {
                console.log('No ranglist data after calculation');
                mobileSummaryContent.innerHTML = `
                    <div class="mobile-loading">
                        <p>No summary data available for current settings.</p>
                        <p>Try adjusting your category selections in Settings.</p>
                    </div>
                `;
            }
        } else {
            console.log('ERROR: calculateRanglist or generateRanglist functions not found');
            mobileSummaryContent.innerHTML = `
                <div class="mobile-loading">
                    <p>Error: Summary functions not available</p>
                </div>
            `;
        }
    } else {
        console.log('No world records data available, showing message to load records first');
        // Show message to load records first
        mobileSummaryContent.innerHTML = `
            <div class="mobile-loading">
                <p>No world records loaded yet.</p>
                <p>Go to Records tab and click "Refresh" to load data first.</p>
            </div>
        `;
    }
}

// Helper function to get ordinal suffix
function getOrdinalSuffix(num) {
    const j = num % 10;
    const k = num % 100;
    if (j == 1 && k != 11) {
        return "st";
    }
    if (j == 2 && k != 12) {
        return "nd";
    }
    if (j == 3 && k != 13) {
        return "rd";
    }
    return "th";
}

// Initialize mobile loading state function (replaces desktop setLoadingState)
function initializeMobileLoadingState() {
    // Create a mobile-compatible setLoadingState function
    window.setLoadingState = function(loading) {
        isLoading = loading;
        window.isLoading = isLoading;
        
        // Update mobile refresh button
        const mobileRefreshBtn = document.getElementById('mobileRefreshBtn');
        if (mobileRefreshBtn) {
            if (loading) {
                if (isApiOverloaded) {
                    mobileRefreshBtn.textContent = '⏳ Rate limited';
                    mobileRefreshBtn.disabled = true;
                    mobileRefreshBtn.setAttribute('title', 'API is rate limited. Please wait...');
                } else {
                    mobileRefreshBtn.textContent = '⏳ Loading...';
                    mobileRefreshBtn.disabled = true;
                    mobileRefreshBtn.setAttribute('title', 'Please wait while world records are being fetched...');
                }
            } else if (isApiOverloaded) {
                mobileRefreshBtn.textContent = '⚠️ SRC API overloaded';
                mobileRefreshBtn.disabled = false;
                mobileRefreshBtn.setAttribute('title', 'Speedrun.com API is overloaded. Click to retry.');
            } else {
                mobileRefreshBtn.textContent = '🔄 Refresh';
                mobileRefreshBtn.disabled = false;
                mobileRefreshBtn.setAttribute('title', 'Refresh world records for current settings');
            }
        }
        
        // Update mobile time travel button
        const mobileTimeTravelBtn = document.getElementById('mobileTimeTravelBtn');
        if (mobileTimeTravelBtn) {
            mobileTimeTravelBtn.disabled = loading;
            mobileTimeTravelBtn.title = loading ? 'Loading...' : (isTimeTravelEnabled ? 'Time travel mode enabled. Click to disable.' : 'Time travel mode disabled. Click to enable.');
        }
        
        // Update mobile multiple tables button
        const mobileMultipleTablesBtn = document.getElementById('mobileMultipleTablesToggle');
        if (mobileMultipleTablesBtn) {
            mobileMultipleTablesBtn.disabled = loading;
            mobileMultipleTablesBtn.title = loading ? 'Loading...' : (isMultipleTablesEnabled ? 'Multiple tables mode enabled. Click to disable.' : 'Multiple tables mode disabled. Click to enable.');
        }
        
        // Update mobile stop/resume button
        const mobileStopResumeBtn = document.getElementById('mobileStopResumeBtn');
        if (mobileStopResumeBtn) {
            if (loading || isApiPaused) {
                mobileStopResumeBtn.style.display = 'block';
                if (isApiPaused) {
                    mobileStopResumeBtn.textContent = '▶️ Resume';
                    mobileStopResumeBtn.setAttribute('title', 'Resume API calls');
                } else {
                    mobileStopResumeBtn.textContent = '⏸️ Stop';
                    mobileStopResumeBtn.setAttribute('title', 'Stop API calls');
                }
            } else {
                mobileStopResumeBtn.style.display = 'none';
            }
        }
        
        // Disable mobile settings buttons during loading
        const mobileSettingsButtons = document.querySelectorAll('.mobile-table-option-btn');
        mobileSettingsButtons.forEach(function(button) {
            if (loading) {
                button.disabled = true;
                button.style.opacity = '0.5';
                button.style.cursor = 'not-allowed';
            } else {
                button.disabled = false;
                button.style.opacity = '1';
                button.style.cursor = 'pointer';
            }
        });
    };
    
    console.log('Mobile loading state function initialized');
}

// Export functions for use in other modules
window.mobileUI = {
    initializeSimpleMobileUI,
    switchBasicMobileSection,
    showBasicMobileSettingsSection,
    showBasicMobileRecordsSection,
    showBasicMobileSummarySection,
    loadMobileSummaryData,
    initializeMobileLoadingState
};

