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
        initializeMobileUI();
    }
});

// Initialize mobile UI
function initializeMobileUI() {
    console.log('Initializing mobile UI...');
    
    // Set up mobile event listeners
    setupMobileEventListeners();
    
    // Show records section by default
    showMobileRecordsSection();
    
    // Set up data update listeners
    setupDataUpdateListeners();
}

// Setup data update listeners to refresh mobile UI when data changes
function setupDataUpdateListeners() {
    // Create a MutationObserver to watch for changes to worldRecords and bestRuns
    const observer = new MutationObserver(() => {
        if (mobileState.currentSection === 'records') {
            showMobileRecordsSection();
        } else if (mobileState.currentSection === 'summary') {
            showMobileSummarySection();
        }
    });
    
    // Watch for changes to the document body (where data might be updated)
    observer.observe(document.body, { 
        childList: true, 
        subtree: true 
    });
    
    // Also set up periodic checks for data changes
    setInterval(() => {
        if (mobileState.currentSection === 'records' && Object.keys(worldRecords).length > 0) {
            showMobileRecordsSection();
        } else if (mobileState.currentSection === 'summary' && bestRuns && Object.keys(bestRuns).length > 0) {
            showMobileSummarySection();
        }
    }, 2000); // Check every 2 seconds
}

// Setup mobile event listeners
function setupMobileEventListeners() {
    // Mobile info button
    const mobileInfoBtn = document.getElementById('mobileInfoBtn');
    if (mobileInfoBtn) {
        mobileInfoBtn.addEventListener('click', () => {
            const infoModal = document.getElementById('infoModal');
            if (infoModal) {
                infoModal.style.display = 'block';
            }
        });
    }

    // Mobile navigation
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
    mobileNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.getAttribute('data-section');
            switchMobileSection(section);
        });
    });

    // Close info modal when clicking outside
    const infoModal = document.getElementById('infoModal');
    if (infoModal) {
        infoModal.addEventListener('click', (e) => {
            if (e.target === infoModal) {
                infoModal.style.display = 'none';
            }
        });
    }
}

// Switch mobile section
function switchMobileSection(section) {
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
            showMobileSettingsSection();
            break;
        case 'records':
            showMobileRecordsSection();
            break;
        case 'summary':
            showMobileSummarySection();
            break;
    }
}

// Show mobile settings section
function showMobileSettingsSection() {
    const mobileTablesContainer = document.getElementById('mobileTablesContainer');
    if (!mobileTablesContainer) return;

    mobileTablesContainer.innerHTML = `
        <div class="mobile-card">
            <div class="mobile-card-header">
                <h2 class="mobile-card-title">Settings</h2>
                <button class="mobile-card-action" id="mobileRefreshBtn">Refresh Data</button>
            </div>
            
            <!-- Date Picker -->
            <div class="mobile-form-group">
                <label class="mobile-form-label" for="mobileDatePicker">Pick a date to travel back in time</label>
                <input type="date" id="mobileDatePicker" class="mobile-form-input" value="${selectedTimeTravelDate || ''}">
            </div>

            <!-- Time Travel Toggle -->
            <div class="mobile-checkbox-group">
                <input type="checkbox" id="mobileTimeTravel" class="mobile-checkbox" ${isTimeTravelEnabled ? 'checked' : ''}>
                <label for="mobileTimeTravel" class="mobile-checkbox-label">⏰ Time Travel Mode</label>
            </div>

            <!-- Multiple Tables Toggle -->
            <div class="mobile-checkbox-group">
                <input type="checkbox" id="mobileMultipleTables" class="mobile-checkbox" ${isMultipleTablesEnabled ? 'checked' : ''}>
                <label for="mobileMultipleTables" class="mobile-checkbox-label">📊 Multiple Tables Mode</label>
            </div>

            <!-- Apple Amounts -->
            <div class="mobile-form-group">
                <label class="mobile-form-label">Apple Amounts</label>
                <div class="mobile-category-grid" id="mobileAppleAmounts">
                    ${generateMobileCategoryCheckboxes(appleAmounts, 'apple')}
                </div>
            </div>

            <!-- Speeds -->
            <div class="mobile-form-group">
                <label class="mobile-form-label">Speeds</label>
                <div class="mobile-category-grid" id="mobileSpeeds">
                    ${generateMobileCategoryCheckboxes(speeds, 'speed')}
                </div>
            </div>

            <!-- Sizes -->
            <div class="mobile-form-group">
                <label class="mobile-form-label">Sizes</label>
                <div class="mobile-category-grid" id="mobileSizes">
                    ${generateMobileCategoryCheckboxes(sizes, 'size')}
                </div>
            </div>

            <!-- Game Modes -->
            <div class="mobile-form-group">
                <label class="mobile-form-label">Game Modes</label>
                <div class="mobile-category-grid" id="mobileGameModes">
                    ${generateMobileCategoryCheckboxes(gamemodes, 'gamemode')}
                </div>
            </div>

            <!-- Run Modes -->
            <div class="mobile-form-group">
                <label class="mobile-form-label">Run Modes</label>
                <div class="mobile-category-grid" id="mobileRunModes">
                    ${generateMobileCategoryCheckboxes(runModes, 'runmode')}
                </div>
            </div>
        </div>
    `;

    // Set up settings event listeners
    setupMobileSettingsEventListeners();
}

// Generate mobile category checkboxes with proper radio/toggle behavior
function generateMobileCategoryCheckboxes(categoryData, categoryType) {
    let html = '';
    for (const [name, data] of Object.entries(categoryData)) {
        let checked = false;
        
        if (categoryType === 'apple' || categoryType === 'speed' || categoryType === 'size') {
            // For apple amounts, speeds, and sizes - behavior depends on multiple tables mode
            if (isMultipleTablesEnabled) {
                // Toggle behavior: check based on visible state
                checked = data.visible;
            } else {
                // Radio behavior: check based on current table settings
                const settingIndex = categoryType === 'apple' ? 0 : categoryType === 'speed' ? 1 : 2;
                checked = currentTableSettings[settingIndex] === name;
            }
        } else {
            // For gamemodes and run modes - always toggle behavior
            checked = data.visible;
        }
        
        const checkedAttr = checked ? 'checked' : '';
        const icon = data.icon ? `<img src="${data.icon}" alt="${name}" class="mobile-category-icon">` : '';
        const text = data.text || name;
        
        html += `
            <div class="mobile-checkbox-group">
                <input type="checkbox" id="mobile_${categoryType}_${name.replace(/\s+/g, '_')}" 
                       class="mobile-checkbox" ${checkedAttr} data-category="${categoryType}" data-name="${name}">
                <label for="mobile_${categoryType}_${name.replace(/\s+/g, '_')}" class="mobile-checkbox-label">
                    ${icon} ${text}
                </label>
            </div>
        `;
    }
    return html;
}

// Setup mobile settings event listeners
function setupMobileSettingsEventListeners() {
    // Date picker
    const mobileDatePicker = document.getElementById('mobileDatePicker');
    if (mobileDatePicker) {
        mobileDatePicker.addEventListener('change', (e) => {
            selectedTimeTravelDate = e.target.value;
            localStorage.setItem('selectedTimeTravelDate', selectedTimeTravelDate);
        });
    }

    // Time travel toggle
    const mobileTimeTravel = document.getElementById('mobileTimeTravel');
    if (mobileTimeTravel) {
        mobileTimeTravel.addEventListener('change', (e) => {
            isTimeTravelEnabled = e.target.checked;
            localStorage.setItem('timeTravelEnabled', isTimeTravelEnabled);
            // Trigger desktop time travel function
            if (window.toggleTimeTravel) {
                window.toggleTimeTravel();
            }
        });
    }

    // Multiple tables toggle
    const mobileMultipleTables = document.getElementById('mobileMultipleTables');
    if (mobileMultipleTables) {
        mobileMultipleTables.addEventListener('change', (e) => {
            isMultipleTablesEnabled = e.target.checked;
            localStorage.setItem('multipleTablesEnabled', isMultipleTablesEnabled);
            
            // Regenerate settings to update radio/toggle behavior
            showMobileSettingsSection();
            
            // Trigger desktop multiple tables function
            if (window.toggleMultipleTables) {
                window.toggleMultipleTables();
            }
        });
    }

    // Category checkboxes
    const categoryCheckboxes = document.querySelectorAll('[data-category]');
    categoryCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const categoryType = e.target.dataset.category;
            const name = e.target.dataset.name;
            const checked = e.target.checked;
            
            if (categoryType === 'apple' || categoryType === 'speed' || categoryType === 'size') {
                if (isMultipleTablesEnabled) {
                    // Toggle behavior: update visible state
                    switch (categoryType) {
                        case 'apple':
                            appleAmounts[name].visible = checked;
                            break;
                        case 'speed':
                            speeds[name].visible = checked;
                            break;
                        case 'size':
                            sizes[name].visible = checked;
                            break;
                    }
                } else {
                    // Radio behavior: update current table settings
                    const settingIndex = categoryType === 'apple' ? 0 : categoryType === 'speed' ? 1 : 2;
                    currentTableSettings[settingIndex] = name;
                    
                    // Uncheck all other options in the same category
                    categoryCheckboxes.forEach(otherCheckbox => {
                        if (otherCheckbox.dataset.category === categoryType && otherCheckbox !== checkbox) {
                            otherCheckbox.checked = false;
                        }
                    });
                }
            } else {
                // For gamemodes and run modes - always toggle behavior
                switch (categoryType) {
                    case 'gamemode':
                        gamemodes[name].visible = checked;
                        break;
                    case 'runmode':
                        runModes[name].visible = checked;
                        break;
                }
            }
            
            // Save settings
            saveSettings();
            
            // Only refresh data if multiple tables is disabled (to avoid heavy API calls)
            if (!isMultipleTablesEnabled && window.refreshWorldRecordsForSettings) {
                window.refreshWorldRecordsForSettings();
            }
        });
    });

    // Refresh button
    const mobileRefreshBtn = document.getElementById('mobileRefreshBtn');
    if (mobileRefreshBtn) {
        mobileRefreshBtn.addEventListener('click', () => {
            if (window.refreshWorldRecordsForSettings) {
                window.refreshWorldRecordsForSettings();
            }
        });
    }
}

// Show mobile records section
function showMobileRecordsSection() {
    const mobileTablesContainer = document.getElementById('mobileTablesContainer');
    if (!mobileTablesContainer) return;

    // Check if we have world records data
    if (Object.keys(worldRecords).length === 0) {
        mobileTablesContainer.innerHTML = `
            <div class="mobile-card">
                <div class="mobile-card-header">
                    <h2 class="mobile-card-title">World Records</h2>
                    <button class="mobile-card-action" id="mobileLoadRecordsBtn">Load Records</button>
                </div>
                <div class="mobile-empty">
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        <line x1="12" y1="12" x2="12" y2="16"></line>
                    </svg>
                    <p>No world records loaded</p>
                    <p>Click "Load Records" to fetch data from the API</p>
                </div>
            </div>
        `;

        // Set up load records button
        const mobileLoadRecordsBtn = document.getElementById('mobileLoadRecordsBtn');
        if (mobileLoadRecordsBtn) {
            mobileLoadRecordsBtn.addEventListener('click', () => {
                if (window.startWorldRecordsDownload) {
                    window.startWorldRecordsDownload();
                }
            });
        }
    } else {
        // Display world records data using the same logic as desktop
        displayMobileWorldRecords();
    }
}

// Display mobile world records using desktop logic
function displayMobileWorldRecords() {
    const mobileTablesContainer = document.getElementById('mobileTablesContainer');
    if (!mobileTablesContainer) return;

    let html = `
        <div class="mobile-card">
            <div class="mobile-card-header">
                <h2 class="mobile-card-title">World Records</h2>
                <button class="mobile-card-action" id="mobileRefreshRecordsBtn">Refresh</button>
            </div>
        </div>
    `;

    if (isMultipleTablesEnabled) {
        // Generate multiple tables like desktop
        html += generateMobileMultipleTables();
    } else {
        // Generate single table like desktop
        html += generateMobileSingleTable();
    }

    mobileTablesContainer.innerHTML = html;

    // Set up refresh button
    const mobileRefreshRecordsBtn = document.getElementById('mobileRefreshRecordsBtn');
    if (mobileRefreshRecordsBtn) {
        mobileRefreshRecordsBtn.addEventListener('click', () => {
            if (window.refreshWorldRecordsForSettings) {
                window.refreshWorldRecordsForSettings();
            }
        });
    }
}

// Generate mobile single table (like desktop generateLeaderboard)
function generateMobileSingleTable() {
    if (!bestRuns || !bestRuns[currentTableSettings[0]] || !bestRuns[currentTableSettings[0]][currentTableSettings[1]] || !bestRuns[currentTableSettings[0]][currentTableSettings[1]][currentTableSettings[2]]) {
        return '<div class="mobile-card"><p>No data available for current settings</p></div>';
    }

    const thisBoardRuns = bestRuns[currentTableSettings[0]][currentTableSettings[1]][currentTableSettings[2]];
    const thisBoardRunModes = [];
    
    // Find all run modes that have data for this combination
    const highscoreModes = ["Wall", "Portal", "Key", "Sokoban", "Poison", "Minesweeper", "Statue", "Shield", "Hotdog", "Gate", "Cheese"];
    
    for (const gamemode in thisBoardRuns) {
        if (gamemodes[gamemode].visible) {
            for (const runMode in thisBoardRuns[gamemode]) {
                // Only show "High Score" column for highscore modes
                if (runMode === "High Score" && !highscoreModes.includes(gamemode)) {
                    continue;
                }
                // Don't show "100 Apples" for "Small" size
                if (runMode === "100 Apples" && currentTableSettings[2] === "Small") {
                    continue;
                }
                if (runModes[runMode].visible && thisBoardRunModes.indexOf(runMode) === -1) {
                    thisBoardRunModes.push(runMode);
                }
            }
        }
    }

    let html = `
        <div class="mobile-card">
            <div class="mobile-card-header">
                <h3 class="mobile-card-title">${currentTableSettings[0]} | ${currentTableSettings[1]} | ${currentTableSettings[2]}</h3>
            </div>
            <div class="mobile-table-container">
                <table class="mobile-table">
                    <thead>
                        <tr>
                            <th>Game Mode</th>
                            ${thisBoardRunModes.map(runMode => `<th>${runModes[runMode].text || runMode}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
    `;

    for (const gamemode in thisBoardRuns) {
        if (gamemodes[gamemode].visible) {
            html += `<tr><th>${gamemode}</th>`;
            
            for (const runMode of thisBoardRunModes) {
                html += '<td>';
                if (thisBoardRuns[gamemode][runMode] && thisBoardRuns[gamemode][runMode].length > 0) {
                    const bestRun = thisBoardRuns[gamemode][runMode][0];
                    const time = bestRun.time ? convertSpeedInfoTime(bestRun.time) : 'N/A';
                    const player = bestRun.player || 'Unknown';
                    html += `<div class="mobile-result">${time}</div><div class="mobile-name">${player}</div>`;
                } else {
                    html += '<div class="mobile-empty">-</div>';
                }
                html += '</td>';
            }
            html += '</tr>';
        }
    }

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    return html;
}

// Generate mobile multiple tables (like desktop generateMultipleTables)
function generateMobileMultipleTables() {
    // Get all selected combinations from the settings
    const selectedCombinations = [];
    
    // Get selected apple amounts
    const selectedAppleAmounts = [];
    for (const appleAmount in appleAmounts) {
        if (appleAmounts[appleAmount].visible) {
            selectedAppleAmounts.push(appleAmount);
        }
    }
    
    // Get selected speeds
    const selectedSpeeds = [];
    for (const speed in speeds) {
        if (speeds[speed].visible) {
            selectedSpeeds.push(speed);
        }
    }
    
    // Get selected sizes
    const selectedSizes = [];
    for (const size in sizes) {
        if (sizes[size].visible) {
            selectedSizes.push(size);
        }
    }
    
    // Generate all combinations of apple amount, speed, and size
    for (let i = 0; i < selectedAppleAmounts.length; i++) {
        for (let j = 0; j < selectedSpeeds.length; j++) {
            for (let k = 0; k < selectedSizes.length; k++) {
                const combination = [selectedAppleAmounts[i], selectedSpeeds[j], selectedSizes[k]];
                selectedCombinations.push(combination);
            }
        }
    }
    
    let html = '';
    
    // Generate a table for each combination
    for (let i = 0; i < selectedCombinations.length; i++) {
        const combo = selectedCombinations[i];
        html += generateMobileSingleTableForCombo(combo);
    }
    
    return html;
}

// Generate mobile single table for a specific combination
function generateMobileSingleTableForCombo(settings) {
    if (!bestRuns || !bestRuns[settings[0]] || !bestRuns[settings[0]][settings[1]] || !bestRuns[settings[0]][settings[1]][settings[2]]) {
        return '';
    }

    const thisBoardRuns = bestRuns[settings[0]][settings[1]][settings[2]];
    const thisBoardRunModes = [];
    
    // Find all run modes that have data for this combination
    const highscoreModes = ["Wall", "Portal", "Key", "Sokoban", "Poison", "Minesweeper", "Statue", "Shield", "Hotdog", "Gate", "Cheese"];
    
    for (const gamemode in thisBoardRuns) {
        if (gamemodes[gamemode].visible) {
            for (const runMode in thisBoardRuns[gamemode]) {
                // Only show "High Score" column for highscore modes
                if (runMode === "High Score" && !highscoreModes.includes(gamemode)) {
                    continue;
                }
                // Don't show "100 Apples" for "Small" size
                if (runMode === "100 Apples" && settings[2] === "Small") {
                    continue;
                }
                if (runModes[runMode].visible && thisBoardRunModes.indexOf(runMode) === -1) {
                    thisBoardRunModes.push(runMode);
                }
            }
        }
    }

    let html = `
        <div class="mobile-card">
            <div class="mobile-card-header">
                <h3 class="mobile-card-title">${settings[0]} | ${settings[1]} | ${settings[2]}</h3>
            </div>
            <div class="mobile-table-container">
                <table class="mobile-table">
                    <thead>
                        <tr>
                            <th>Game Mode</th>
                            ${thisBoardRunModes.map(runMode => `<th>${runModes[runMode].text || runMode}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
    `;

    for (const gamemode in thisBoardRuns) {
        if (gamemodes[gamemode].visible) {
            html += `<tr><th>${gamemode}</th>`;
            
            for (const runMode of thisBoardRunModes) {
                html += '<td>';
                if (thisBoardRuns[gamemode][runMode] && thisBoardRuns[gamemode][runMode].length > 0) {
                    const bestRun = thisBoardRuns[gamemode][runMode][0];
                    const time = bestRun.time ? convertSpeedInfoTime(bestRun.time) : 'N/A';
                    const player = bestRun.player || 'Unknown';
                    html += `<div class="mobile-result">${time}</div><div class="mobile-name">${player}</div>`;
                } else {
                    html += '<div class="mobile-empty">-</div>';
                }
                html += '</td>';
            }
            html += '</tr>';
        }
    }

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    return html;
}

// Show mobile summary section
function showMobileSummarySection() {
    const mobileTablesContainer = document.getElementById('mobileTablesContainer');
    if (!mobileTablesContainer) return;

    // Check if we have best runs data
    if (!bestRuns || Object.keys(bestRuns).length === 0) {
        mobileTablesContainer.innerHTML = `
            <div class="mobile-card">
                <div class="mobile-card-header">
                    <h2 class="mobile-card-title">Summary</h2>
                </div>
                <div class="mobile-empty">
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        <line x1="12" y1="12" x2="12" y2="16"></line>
                    </svg>
                    <p>No summary data available</p>
                    <p>Load world records first to see summary</p>
                </div>
            </div>
        `;
        return;
    }

    // Generate summary data
    let html = `
        <div class="mobile-card">
            <div class="mobile-card-header">
                <h2 class="mobile-card-title">Summary</h2>
            </div>
        </div>
    `;

    // Generate summary tables for each category
    for (const [appleAmount, appleData] of Object.entries(bestRuns)) {
        for (const [speed, speedData] of Object.entries(appleData)) {
            for (const [size, sizeData] of Object.entries(speedData)) {
                for (const [gamemode, gamemodeData] of Object.entries(sizeData)) {
                    for (const [runMode, runs] of Object.entries(gamemodeData)) {
                        if (runs && runs.length > 0) {
                            const bestRun = runs[0];
                            const time = bestRun.time ? convertSpeedInfoTime(bestRun.time) : 'N/A';
                            const date = bestRun.date ? new Date(bestRun.date).toLocaleDateString() : 'N/A';
                            
                            html += `
                                <div class="mobile-card">
                                    <div class="mobile-card-header">
                                        <h3 class="mobile-card-title">${appleAmount} | ${speed} | ${size} | ${gamemode} | ${runMode}</h3>
                                    </div>
                                    <div class="mobile-summary-content">
                                        <div class="mobile-summary-item">
                                            <span class="mobile-summary-label">Best Time:</span>
                                            <span class="mobile-summary-value">${time}</span>
                                        </div>
                                        <div class="mobile-summary-item">
                                            <span class="mobile-summary-label">Player:</span>
                                            <span class="mobile-summary-value">${bestRun.player || 'Unknown'}</span>
                                        </div>
                                        <div class="mobile-summary-item">
                                            <span class="mobile-summary-label">Date:</span>
                                            <span class="mobile-summary-value">${date}</span>
                                        </div>
                                        <div class="mobile-summary-item">
                                            <span class="mobile-summary-label">Total Runs:</span>
                                            <span class="mobile-summary-value">${runs.length}</span>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }
                    }
                }
            }
        }
    }

    mobileTablesContainer.innerHTML = html;
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
    initializeMobileUI,
    switchMobileSection,
    showMobileSettingsSection,
    showMobileRecordsSection,
    showMobileSummarySection,
    displayMobileWorldRecords
};
