// Main Module
// Handles initialization and DOM ready events

// Initialize settings
loadSettings();

// Initialize WorldRecordFetcher
if (typeof WorldRecordFetcher !== 'undefined') {
    window.worldRecordFetcher = new WorldRecordFetcher();
    console.log('WorldRecordFetcher initialized successfully');
} else {
    console.error('WorldRecordFetcher not found');
}

// Update table selector after settings are loaded
document.addEventListener('DOMContentLoaded', function() {
    // Set current date in info modal
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const dateString = today.toLocaleDateString('en-US', options);
    const dateElement = document.getElementById('currentDate');
    if(dateElement) {
        dateElement.textContent = dateString;
    }
    
    // Update table selector to reflect loaded settings
    setTimeout(() => {
        updateTableSelector();
    }, 100);
});

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize UI elements IMMEDIATELY
    initializeUI();
    
    // Test API connectivity first
    testAPIConnectivity(() => {
        // Start the world records download
        startWorldRecordsDownload();
    });
});
