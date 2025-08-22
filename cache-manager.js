// Cache Manager Module
// Handles all caching operations for world records data

class CacheManager {
    constructor() {
        this.cachePrefix = 'worldRecordsCache_';
        this.staleThreshold = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
    }

    // Generate unique cache key for table settings and date
    getCacheKey(settings, date = null) {
        const settingsKey = settings.join('|');
        return date ? `${this.cachePrefix}${settingsKey}_${date}` : `${this.cachePrefix}${settingsKey}`;
    }

    // Get cached data for a specific key
    getCachedData(key) {
        try {
            const cached = localStorage.getItem(key);
            if (cached) {
                const data = JSON.parse(cached);
                return data;
            }
        } catch (error) {
            console.error('Error reading cache:', error);
        }
        return null;
    }

    // Store data in cache
    setCachedData(key, data) {
        try {
            const cacheData = {
                data: data,
                timestamp: Date.now(),
                settings: data.settings || [],
                date: data.date || null
            };
            localStorage.setItem(key, JSON.stringify(cacheData));
        } catch (error) {
            console.error('Error writing cache:', error);
        }
    }

    // Check if cache is valid (not stale)
    isCacheValid(key) {
        const cached = this.getCachedData(key);
        if (!cached) return false;
        
        const age = Date.now() - cached.timestamp;
        return age < this.staleThreshold;
    }

    // Clear specific cache entry
    clearCache(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error('Error clearing cache:', error);
        }
    }

    // Clear all cache entries
    clearAllCache() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.cachePrefix)) {
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {
            console.error('Error clearing all cache:', error);
        }
    }

    // Compare old and new data to detect changes
    compareRecords(oldData, newData) {
        if (!oldData || !newData) return true; // Consider as changed if either is missing
        
        // The data structure is { success: true, runs: [...], category: "...", settings: {...} }
        // We need to compare the runs array
        if (!oldData.runs || !newData.runs) return true;
        
        // Simple comparison - check if the number of records changed
        if (oldData.runs.length !== newData.runs.length) return true;
        
        // Compare each record
        for (let i = 0; i < oldData.runs.length; i++) {
            const oldRecord = oldData.runs[i];
            const newRecord = newData.runs[i];
            
            if (!oldRecord || !newRecord) return true;
            
            // Compare run times
            if (oldRecord.time && newRecord.time) {
                if (oldRecord.time.raw !== newRecord.time.raw) return true;
            }
            
            // Compare run IDs
            if (oldRecord.runId !== newRecord.runId) return true;
        }
        
        return false; // No changes detected
    }

    // Update cache if data has changed
    updateCacheIfChanged(key, newData) {
        const oldData = this.getCachedData(key);
        
        if (this.compareRecords(oldData ? oldData.data : null, newData)) {
            // Data has changed, update cache
            this.setCachedData(key, newData);
            return true; // Cache was updated
        } else {
            // No changes, just update timestamp
            if (oldData) {
                oldData.timestamp = Date.now();
                try {
                    localStorage.setItem(key, JSON.stringify(oldData));
                } catch (error) {
                    console.error('Error updating cache timestamp:', error);
                }
            }
            return false; // Cache was not updated
        }
    }

    // Get cache statistics
    getCacheStats() {
        try {
            const keys = Object.keys(localStorage);
            const cacheKeys = keys.filter(key => key.startsWith(this.cachePrefix));
            
            let totalRecords = 0;
            let validCaches = 0;
            let staleCaches = 0;
            
            cacheKeys.forEach(key => {
                const cached = this.getCachedData(key);
                if (cached) {
                    if (cached.data && cached.data.runs && Array.isArray(cached.data.runs)) {
                        totalRecords += cached.data.runs.length;
                    }
                    
                    if (this.isCacheValid(key)) {
                        validCaches++;
                    } else {
                        staleCaches++;
                    }
                }
            });
            
            return {
                totalCaches: cacheKeys.length,
                validCaches: validCaches,
                staleCaches: staleCaches,
                totalRecords: totalRecords
            };
        } catch (error) {
            console.error('Error getting cache stats:', error);
            return { totalCaches: 0, validCaches: 0, staleCaches: 0, totalRecords: 0 };
        }
    }

    // Get cache status for display
    getCacheStatus(key) {
        const cached = this.getCachedData(key);
        if (!cached) return 'Empty';
        
        const age = Date.now() - cached.timestamp;
        if (age < this.staleThreshold) {
            return 'Fresh';
        } else {
            return 'Stale';
        }
    }

    // Get cache info for a specific key
    getCacheInfo(key) {
        const cached = this.getCachedData(key);
        if (!cached) {
            return {
                status: 'Empty',
                lastUpdated: null,
                recordCount: 0
            };
        }
        
        const age = Date.now() - cached.timestamp;
        const status = age < this.staleThreshold ? 'Fresh' : 'Stale';
        
        return {
            status: status,
            lastUpdated: new Date(cached.timestamp),
            recordCount: cached.data && cached.data.runs ? cached.data.runs.length : 0
        };
    }
}

// Create global cache manager instance
window.cacheManager = new CacheManager();
