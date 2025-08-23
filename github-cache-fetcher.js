// GitHub Cache Fetcher Module
// Fetches world records data from GitHub-hosted cache files

class GitHubCacheFetcher {
    constructor() {
        this.baseURL = 'https://raw.githubusercontent.com/DarkSnakeGang/FastSnakeStats/refs/heads/main';
        this.cacheDir = 'daily';
        this.metadataURL = `${this.baseURL}/time-travel-cache/metadata/available-dates.json`;
        this.fallbackToAPI = true; // Whether to fall back to API calls
    }

    // Get the most recent available date from GitHub
    async getMostRecentDate() {
        try {
            const response = await fetch(this.metadataURL);
            if (!response.ok) {
                console.log('GitHub metadata not available (404), GitHub cache not set up yet');
                return null;
            }
            
            const metadata = await response.json();
            if (metadata.availableDates && metadata.availableDates.length > 0) {
                return metadata.availableDates[metadata.availableDates.length - 1];
            }
        } catch (error) {
            console.log('Error fetching GitHub metadata:', error);
        }
        return null;
    }

    // Check if a specific date is available in GitHub cache
    async isDateAvailable(date) {
        try {
            const response = await fetch(this.metadataURL);
            if (!response.ok) {
                console.log('GitHub metadata not available (404), cannot check date availability');
                return false;
            }
            
            const metadata = await response.json();
            return metadata.availableDates && metadata.availableDates.includes(date);
        } catch (error) {
            console.log('Error checking date availability:', error);
            return false;
        }
    }

    // Fetch cache data for a specific date from GitHub
    async fetchCacheForDate(date) {
        try {
            const [year, month] = date.split('-');
            const cacheURL = `${this.baseURL}/time-travel-cache/${this.cacheDir}/${year}/${month}/${date}.json`;
            
            console.log(`Fetching GitHub cache for ${date}...`);
            const response = await fetch(cacheURL);
            
            if (!response.ok) {
                console.log(`GitHub cache not available for ${date}`);
                return null;
            }
            
            const cacheData = await response.json();
            console.log(`Successfully fetched GitHub cache for ${date}`);
            return cacheData;
            
        } catch (error) {
            console.log(`Error fetching GitHub cache for ${date}:`, error);
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
            console.log('No GitHub cache available, falling back to API');
            return null;
        }

        const cacheData = await this.fetchCacheForDate(mostRecentDate);
        if (!cacheData) {
            console.log('Failed to fetch GitHub cache, falling back to API');
            return null;
        }

        return this.convertCacheFormat(cacheData, mostRecentDate);
    }

    // Fetch world records for a specific date
    async fetchWorldRecordsForDate(date) {
        // Don't check metadata - just try to fetch the cache directly
        const cacheData = await this.fetchCacheForDate(date);
        if (!cacheData) {
            console.log(`Failed to fetch GitHub cache for ${date}, falling back to API`);
            return null;
        }

        return this.convertCacheFormat(cacheData, date);
    }

    // Get available dates from GitHub
    async getAvailableDates() {
        try {
            const response = await fetch(this.metadataURL);
            if (!response.ok) return [];
            
            const metadata = await response.json();
            return metadata.availableDates || [];
        } catch (error) {
            console.log('Error fetching available dates:', error);
            return [];
        }
    }

    // Check if GitHub cache is accessible
    async isGitHubCacheAvailable() {
        try {
            const response = await fetch(this.metadataURL);
            if (response.ok) {
                console.log('GitHub cache is available');
                return true;
            } else {
                console.log('GitHub cache not available (404), repository not set up yet');
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
