// Main Module
// Handles initialization and DOM ready events

// Initialize settings
loadSettings();

// Initialize WorldRecordFetcher
if (typeof WorldRecordFetcher !== 'undefined') {
    window.worldRecordFetcher = new WorldRecordFetcher();
}
/*
    console.log('WorldRecordFetcher initialized successfully');
    
    // Initialize game metadata immediately
    WorldRecordFetcher.initializeGameMetadata().then(() => {
        console.log('Game metadata loaded successfully');
    }).catch(error => {
        console.error('Failed to load game metadata:', error);
    });
} else {
    console.error('WorldRecordFetcher not found');
}*/

// Initialize GitHub Cache Fetcher
if (typeof GitHubCacheFetcher !== 'undefined') {
    window.githubCacheFetcher = new GitHubCacheFetcher();
    console.log('GitHub Cache Fetcher initialized successfully');
    
    // Test GitHub cache availability
    window.githubCacheFetcher.isGitHubCacheAvailable().then(available => {
        if (available) {
            console.log('GitHub cache is available');
        } else {
            console.log('GitHub cache is not available, will use API fallback');
        }
    }).catch(error => {
        console.error('Error checking GitHub cache availability:', error);
    });
} else {
    console.error('GitHubCacheFetcher not found');
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
        if (typeof updateTableSelector === 'function') {
            updateTableSelector();
        } else {
            console.error('updateTableSelector function not found');
        }
    }, 100);
});

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on mobile
    if (window.innerWidth <= 1023) {
        // Mobile: Initialize mobile-specific loading state function
        if (typeof initializeMobileLoadingState === 'function') {
            initializeMobileLoadingState();
        }
        
        // Test API connectivity first
        if (typeof testAPIConnectivity === 'function') {
            testAPIConnectivity(() => {
                // Start the world records download
                if (typeof startWorldRecordsDownload === 'function') {
                    startWorldRecordsDownload();
                }
            });
        }
    } else {
        // Desktop: Initialize UI elements IMMEDIATELY
        if (typeof initializeUI === 'function') {
            initializeUI();
        } else {
            console.error('initializeUI function not found');
        }
        
        // Scroll to the right on desktop load
        setTimeout(() => {
            window.scrollTo(document.body.scrollWidth, 0);
        }, 100);
        
        // Test API connectivity first
        if (typeof testAPIConnectivity === 'function') {
            testAPIConnectivity(() => {
                // Start the world records download
                if (typeof startWorldRecordsDownload === 'function') {
                    startWorldRecordsDownload();
                }
            });
        }
    }
});
