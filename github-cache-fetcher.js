// GitHub Cache Fetcher Module
// Fetches world records data from GitHub-hosted cache files

class GitHubCacheFetcher {
    constructor() {
        this.baseURL = 'https://raw.githubusercontent.com/DarkSnakeGang/FastSnakeStats/refs/heads/main';
        this.cacheDir = 'daily';
        this.metadataURL = `${this.baseURL}/time-travel-cache/metadata/available-dates.json`;
        this.fallbackToAPI = true; // Whether to fall back to API calls
    }

    // Get available dates (prefer local metadata, fall back to GitHub)
    async getAvailableDates() {
        try {
            try {
                const localResponse = await fetch('time-travel-cache/metadata/available-dates.json');
                if (localResponse.ok) {
                    const metadata = await localResponse.json();
                    return metadata.availableDates || [];
                }
            } catch (localError) {
                // Local fetch unavailable — fall through to GitHub
            }

            const response = await fetch(this.metadataURL);
            if (!response.ok) return [];
            
            const metadata = await response.json();
            return metadata.availableDates || [];
        } catch (error) {
            console.log('Error fetching available dates:', error);
            return [];
        }
    }

    // Get the most recent available date
    async getMostRecentDate() {
        try {
            const dates = await this.getAvailableDates();
            if (dates && dates.length > 0) {
                return dates[dates.length - 1];
            }
        } catch (error) {
            console.log('Error fetching most recent date:', error);
        }
        return null;
    }

    // Check if a specific date is available in cache
    async isDateAvailable(date) {
        try {
            const dates = await this.getAvailableDates();
            return dates.includes(date);
        } catch (error) {
            console.log('Error checking date availability:', error);
            return false;
        }
    }

    // Fetch cache data for a specific date (prefer local files, fall back to GitHub)
    async fetchCacheForDate(date) {
        try {
            const [year, month] = date.split('-');
            const relativePath = `time-travel-cache/${this.cacheDir}/${year}/${month}/${date}.json`;
            
            // Prefer local cache so newly fetched dates work before push
            try {
                const localResponse = await fetch(relativePath);
                if (localResponse.ok) {
                    console.log(`Loaded local cache for ${date}`);
                    return await localResponse.json();
                }
            } catch (localError) {
                // Local fetch unavailable (e.g. file://) — fall through to GitHub
            }

            const cacheURL = `${this.baseURL}/time-travel-cache/${this.cacheDir}/${year}/${month}/${date}.json`;
            
            console.log(`Fetching GitHub cache for ${date}...`);
            const response = await fetch(cacheURL);
            
            if (!response.ok) {
                console.log(`GitHub cache not available for ${date}`);

                // Update time travel button status if in time travel mode
                if (window.isTimeTravelEnabled && window.selectedTimeTravelDate === date) {
                    if (window.updateTimeTravelButtonStatus) {
                        window.updateTimeTravelButtonStatus('missing');
                    } 
                } 
                return null;
            }
            
            const cacheData = await response.json();
            console.log(`Successfully fetched GitHub cache for ${date}`);
            return cacheData;
            
        } catch (error) {
            console.log(`Error fetching cache for ${date}:`, error);
            // Update time travel button status if in time travel mode
            if (window.isTimeTravelEnabled && window.selectedTimeTravelDate === date) {
                console.log('GitHub cache fetcher: Setting button to missing (error)');
                if (window.updateTimeTravelButtonStatus) {
                    window.updateTimeTravelButtonStatus('missing');
                }
            }
            return null;
        }
    }

    // Convert GitHub cache format to the format expected by the app
    convertCacheFormat(githubCache, targetDate) {
        if (!githubCache || !githubCache.records) {
            return null;
        }

        const convertedData = {};
        
        // Convert each record from GitHub format to app format
        for (const [key, record] of Object.entries(githubCache.records)) {
            if (record.success && record.runs && Array.isArray(record.runs)) {
                // The runs are already in the correct format from our script
                // Just ensure they have the right structure
                const convertedRuns = record.runs.map(run => {
                    // Check if this is already in the correct format
                    if (run.players && run.players.data && Array.isArray(run.players.data) && run.players.data.length > 0) {
                        // Already in correct format, return as is
                        return {
                            times: run.times,
                            date: run.date || targetDate,
                            id: run.id,
                            weblink: run.weblink,
                            players: run.players,
                            values: run.values || {}
                        };
                    } else {
                        // Handle legacy format (if any)
                        console.warn(`Legacy format detected for run ${run.id}, skipping`);
                        return null;
                    }
                }).filter(run => run !== null); // Remove any null runs

                convertedData[key] = convertedRuns;
            } else {
                // Handle empty results
                convertedData[key] = [];
            }
        }

        return convertedData;
    }

    // Fetch world records for current settings (most recent available data)
    async fetchCurrentWorldRecords() {
        const mostRecentDate = await this.getMostRecentDate();
        if (!mostRecentDate) {
            console.log('No GitHub cache available');
            return null;
        }

        const cacheData = await this.fetchCacheForDate(mostRecentDate);
        if (!cacheData) {
            console.log('Failed to fetch GitHub cache');
            return null;
        }

        return this.convertCacheFormat(cacheData, mostRecentDate);
    }

    // Fetch world records for a specific date
    async fetchWorldRecordsForDate(date) {
        // Don't check metadata - just try to fetch the cache directly
        const cacheData = await this.fetchCacheForDate(date);
        if (!cacheData) {
            console.log(`Failed to fetch GitHub cache for ${date}`);
            return null;
        }

        return this.convertCacheFormat(cacheData, date);
    }

    // Check if GitHub cache is accessible
    async isGitHubCacheAvailable() {
        try {
            const response = await fetch(this.metadataURL);
            if (response.ok) {
                return true;
            } else {
                return false;
            }
        } catch (error) {
            console.log('Error checking GitHub cache availability:', error);
            return false;
        }
    }

    // Get cache statistics from GitHub
    async getCacheStats() {
        try {
            const response = await fetch(this.metadataURL);
            if (!response.ok) return null;
            
            const metadata = await response.json();
            return {
                totalDates: metadata.totalDates || 0,
                dateRange: metadata.dateRange || null,
                lastUpdated: metadata.lastUpdated || null
            };
        } catch (error) {
            console.log('Error fetching cache stats:', error);
            return null;
        }
    }
}

// Create global instance
window.githubCacheFetcher = new GitHubCacheFetcher();
