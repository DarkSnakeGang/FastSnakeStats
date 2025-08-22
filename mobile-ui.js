// Mobile UI Module
// Handles all mobile-specific functionality and UI generation
// Integrates with existing desktop system

// Mobile state management
let mobileState = {
    currentSection: 'records',
    selectedModes: [],
    isLoading: false
};

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
    
    // Setup mobile navigation
    setupMobileNavigation();
    
    // Setup mobile dark mode button
    setupMobileDarkModeButton();
    
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
            typeof isMultipleTablesEnabled !== 'undefined') {
            clearInterval(checkInterval);
            console.log('Desktop system ready, showing mobile records...');
            console.log('Available functions:', {
                worldRecords: typeof worldRecords,
                generateLeaderboard: typeof generateLeaderboard,
                generateMultipleTables: typeof generateMultipleTables,
                currentTableSettings: typeof currentTableSettings,
                isMultipleTablesEnabled: typeof isMultipleTablesEnabled
            });
            showBasicMobileRecordsSection();
            
            // Update API progress display
            updateMobileApiProgress();
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
            isMultipleTablesEnabled: typeof isMultipleTablesEnabled
        });
        showBasicMobileRecordsSection();
    }, 10000);
}

// Update mobile API progress display
function updateMobileApiProgress() {
    const mobileApiProgress = document.getElementById('mobileApiProgress');
    if (mobileApiProgress) {
        // Check for API progress from desktop system
        if (typeof apiProgress !== 'undefined' && apiProgress !== null) {
            // Handle HTML element objects by extracting text content
            if (apiProgress instanceof HTMLElement) {
                mobileApiProgress.textContent = apiProgress.textContent || '0/0';
            } else {
                mobileApiProgress.textContent = String(apiProgress);
            }
        } else if (typeof window.apiProgress !== 'undefined' && window.apiProgress !== null) {
            // Handle HTML element objects by extracting text content
            if (window.apiProgress instanceof HTMLElement) {
                mobileApiProgress.textContent = window.apiProgress.textContent || '0/0';
            } else {
                mobileApiProgress.textContent = String(window.apiProgress);
            }
        } else {
            mobileApiProgress.textContent = '0/0';
        }
    }
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

// Setup mobile dark mode button
function setupMobileDarkModeButton() {
    const darkModeBtn = document.getElementById('mobileDarkModeBtn');
    if (darkModeBtn) {
        // Set initial state
        updateMobileDarkModeButton();
        
        // Add click event
        darkModeBtn.addEventListener('click', function() {
            toggleDarkMode();
            updateMobileDarkModeButton();
        });
    }
}

// Update mobile dark mode button appearance
function updateMobileDarkModeButton() {
    const darkModeBtn = document.getElementById('mobileDarkModeBtn');
    if (darkModeBtn) {
        if (isDarkMode) {
            darkModeBtn.textContent = '☀️';
            darkModeBtn.title = 'Switch to Light Mode';
        } else {
            darkModeBtn.textContent = '🌙';
            darkModeBtn.title = 'Switch to Dark Mode';
        }
    }
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
            break;
        case 'summary':
            showBasicMobileSummarySection();
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

    // Check if we already have content in the records section
    const existingContent = mobileTablesContainer.querySelector('.mobile-card');
    if (existingContent) {
        // If content exists, update API progress and load table data
        console.log('Records content already exists, updating API progress and loading table');
        updateMobileApiProgress();
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
                    <button class="mobile-option-btn" id="mobileRefreshBtn">🔄 Refresh</button>
                    <button class="mobile-option-btn" id="mobileMultipleTablesBtn">
                        📊 Multiple Tables
                    </button>
                </div>
                
                <!-- Data Section -->
                <div class="mobile-data-section">
                    <div class="mobile-data-info">
                        <div class="mobile-progress-display">
                            API Calls: <span id="mobileApiProgress">0/0</span>
                        </div>
                    </div>
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

    // Load the table data
    loadMobileTableData();

    // Set up periodic API progress updates
    setInterval(updateMobileApiProgress, 1000);
}

// Setup mobile records event listeners
function setupMobileRecordsEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('mobileRefreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            refreshWorldRecordsForSettings();
            loadMobileTableData();
        });
    }

    // Multiple tables button
    const multipleTablesBtn = document.getElementById('mobileMultipleTablesBtn');
    if (multipleTablesBtn) {
        multipleTablesBtn.addEventListener('click', function() {
            toggleMultipleTables();
            // Update button state
            if (isMultipleTablesEnabled) {
                this.classList.add('active');
                this.setAttribute('title', 'Multiple tables mode enabled. Click to disable.');
            } else {
                this.classList.remove('active');
                this.setAttribute('title', 'Multiple tables mode disabled. Click to enable.');
            }
            // Reload table data after toggle
            loadMobileTableData();
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
        updateMobileApiProgress();
    } else {
        console.log('No world records data available, showing loading message');
        // Show loading message
        mobileTableContent.innerHTML = `
            <div class="mobile-loading">
                <p>Loading world records...</p>
            </div>
        `;
    }
}

// Show basic mobile settings section
function showBasicMobileSettingsSection() {
    const mobileTablesContainer = document.getElementById('mobileTablesContainer');
    if (!mobileTablesContainer) return;

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

            <!-- Options Section (from desktop table-selector) -->
            <div class="mobile-form-group">
                <label class="mobile-form-label">Options</label>
                <div class="mobile-options-section">
                    <div class="mobile-options-grid">
                        <button class="mobile-option-btn" id="mobileDarkModeToggle">
                            ${isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
                        </button>
                        <button class="mobile-option-btn" id="mobileTimeTravelBtn">
                            ⏰ Time Travel
                        </button>
                    </div>
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="mobile-btn-group">
                <button class="mobile-btn" id="mobileSettingsSave">Save Settings</button>
                <button class="mobile-btn secondary" id="mobileSettingsReset">Reset to Default</button>
            </div>
        </div>
    `;

    // Add event listeners
    setupMobileSettingsEventListeners();
}

// Generate mobile category checkboxes
function generateMobileCategoryCheckboxes() {
    let html = '';
    
    // Apple Amounts
    html += '<div class="mobile-category-section">';
    html += '<h4 class="mobile-category-title">Apple Amounts</h4>';
    for (const [key, value] of Object.entries(appleAmounts)) {
        html += `
            <div class="mobile-checkbox-group">
                <input type="checkbox" id="mobile_${value.id}" class="mobile-checkbox" ${value.visible ? 'checked' : ''}>
                <label for="mobile_${value.id}" class="mobile-checkbox-label">
                    <img src="${value.icon}" alt="${key}" class="mobile-category-icon">
                    ${key}
                </label>
            </div>
        `;
    }
    html += '</div>';

    // Speeds
    html += '<div class="mobile-category-section">';
    html += '<h4 class="mobile-category-title">Speeds</h4>';
    for (const [key, value] of Object.entries(speeds)) {
        html += `
            <div class="mobile-checkbox-group">
                <input type="checkbox" id="mobile_${value.id}" class="mobile-checkbox" ${value.visible ? 'checked' : ''}>
                <label for="mobile_${value.id}" class="mobile-checkbox-label">
                    <img src="${value.icon}" alt="${key}" class="mobile-category-icon">
                    ${key}
                </label>
            </div>
        `;
    }
    html += '</div>';

    // Sizes
    html += '<div class="mobile-category-section">';
    html += '<h4 class="mobile-category-title">Sizes</h4>';
    for (const [key, value] of Object.entries(sizes)) {
        html += `
            <div class="mobile-checkbox-group">
                <input type="checkbox" id="mobile_${value.id}" class="mobile-checkbox" ${value.visible ? 'checked' : ''}>
                <label for="mobile_${value.id}" class="mobile-checkbox-label">
                    <img src="${value.icon}" alt="${key}" class="mobile-category-icon">
                    ${key}
                </label>
            </div>
        `;
    }
    html += '</div>';

    // Game Modes
    html += '<div class="mobile-category-section">';
    html += '<h4 class="mobile-category-title">Game Modes</h4>';
    for (const [key, value] of Object.entries(gamemodes)) {
        html += `
            <div class="mobile-checkbox-group">
                <input type="checkbox" id="mobile_${value.id}" class="mobile-checkbox" ${value.visible ? 'checked' : ''}>
                <label for="mobile_${value.id}" class="mobile-checkbox-label">
                    <img src="${value.icon}" alt="${key}" class="mobile-category-icon">
                    ${key}
                </label>
            </div>
        `;
    }
    html += '</div>';

    return html;
}

// Generate mobile run mode checkboxes
function generateMobileRunModeCheckboxes() {
    let html = '';
    for (const [key, value] of Object.entries(runModes)) {
        html += `
            <div class="mobile-checkbox-group">
                <input type="checkbox" id="mobile_${value.id}" class="mobile-checkbox" ${value.visible ? 'checked' : ''}>
                <label for="mobile_${value.id}" class="mobile-checkbox-label">
                    ${value.text}
                </label>
            </div>
        `;
    }
    return html;
}

// Setup mobile settings event listeners
function setupMobileSettingsEventListeners() {
    // Date picker
    const datePicker = document.getElementById('mobileDatePicker');
    if (datePicker) {
        datePicker.addEventListener('change', function() {
            selectedTimeTravelDate = this.value;
            saveSettings();
        });
    }

    // Save and reset buttons
    const saveBtn = document.getElementById('mobileSettingsSave');
    const resetBtn = document.getElementById('mobileSettingsReset');
    
    if (saveBtn) {
        saveBtn.addEventListener('click', saveMobileSettings);
    }
    
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
            toggleDarkMode();
            // Update button text
            this.textContent = isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode';
            this.setAttribute('title', isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode');
        });
    }

    // Time travel button
    const timeTravelBtn = document.getElementById('mobileTimeTravelBtn');
    if (timeTravelBtn) {
        timeTravelBtn.addEventListener('click', function() {
            toggleTimeTravel();
            // Update button state
            if (isTimeTravelEnabled) {
                this.classList.add('active');
                this.setAttribute('title', 'Time travel mode enabled. Click to disable.');
                } else {
                this.classList.remove('active');
                this.setAttribute('title', 'Time travel mode disabled. Click to enable.');
            }
        });
    }
}

// Setup mobile data listeners (now handled in records section)
function setupMobileDataListeners() {
    // Data listeners are now handled in setupMobileRecordsEventListeners
}

// Setup mobile checkbox listeners
function setupMobileCheckboxListeners() {
    // Apple Amounts
    for (const [key, value] of Object.entries(appleAmounts)) {
        const checkbox = document.getElementById(`mobile_${value.id}`);
        if (checkbox) {
            checkbox.addEventListener('change', function() {
                appleAmounts[key].visible = this.checked;
                saveSettings();
            });
        }
    }

    // Speeds
    for (const [key, value] of Object.entries(speeds)) {
        const checkbox = document.getElementById(`mobile_${value.id}`);
        if (checkbox) {
            checkbox.addEventListener('change', function() {
                speeds[key].visible = this.checked;
                saveSettings();
        });
    }
}

    // Sizes
    for (const [key, value] of Object.entries(sizes)) {
        const checkbox = document.getElementById(`mobile_${value.id}`);
        if (checkbox) {
            checkbox.addEventListener('change', function() {
                sizes[key].visible = this.checked;
                saveSettings();
            });
        }
    }

    // Game Modes
    for (const [key, value] of Object.entries(gamemodes)) {
        const checkbox = document.getElementById(`mobile_${value.id}`);
        if (checkbox) {
            checkbox.addEventListener('change', function() {
                gamemodes[key].visible = this.checked;
                saveSettings();
            });
        }
    }

    // Run Modes
    for (const [key, value] of Object.entries(runModes)) {
        const checkbox = document.getElementById(`mobile_${value.id}`);
        if (checkbox) {
            checkbox.addEventListener('change', function() {
                runModes[key].visible = this.checked;
                saveSettings();
            });
        }
    }
}

// Save mobile settings
function saveMobileSettings() {
    // Settings are already saved via checkbox listeners
    // This function can be used for additional mobile-specific settings
    console.log('Mobile settings saved');
}

// Reset mobile settings to default
function resetMobileSettings() {
    // Reset all checkboxes to checked (visible)
    for (const [key, value] of Object.entries(appleAmounts)) {
        value.visible = true;
        const checkbox = document.getElementById(`mobile_${value.id}`);
        if (checkbox) checkbox.checked = true;
    }

    for (const [key, value] of Object.entries(speeds)) {
        value.visible = true;
        const checkbox = document.getElementById(`mobile_${value.id}`);
        if (checkbox) checkbox.checked = true;
    }

    for (const [key, value] of Object.entries(sizes)) {
        value.visible = true;
        const checkbox = document.getElementById(`mobile_${value.id}`);
        if (checkbox) checkbox.checked = true;
    }

    for (const [key, value] of Object.entries(gamemodes)) {
        value.visible = true;
        const checkbox = document.getElementById(`mobile_${value.id}`);
        if (checkbox) checkbox.checked = true;
    }

    for (const [key, value] of Object.entries(runModes)) {
        value.visible = true;
        const checkbox = document.getElementById(`mobile_${value.id}`);
        if (checkbox) checkbox.checked = true;
    }

    // Clear date picker
    const datePicker = document.getElementById('mobileDatePicker');
    if (datePicker) {
        datePicker.value = '';
        selectedTimeTravelDate = '';
        localStorage.removeItem('selectedTimeTravelDate');
    }

    // Save settings
    saveSettings();
    
    // Show success message
    const resetButton = document.getElementById('mobileSettingsReset');
    if (resetButton) {
        resetButton.textContent = 'Settings Reset!';
        setTimeout(() => {
            resetButton.textContent = 'Reset to Default';
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
                <div class="mobile-empty">
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                    </svg>
                <p>Mobile Summary Section</p>
                <p>This will be implemented to show desktop summary</p>
                                    </div>
                                </div>
                            `;
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

// Export functions for use in other modules
window.mobileUI = {
    initializeSimpleMobileUI,
    switchBasicMobileSection,
    showBasicMobileSettingsSection,
    showBasicMobileRecordsSection,
    showBasicMobileSummarySection
};

