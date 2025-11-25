// Simple World Record Fetcher
class WorldRecordFetcher {
    constructor() {
        // Use the first game ID from the gameIDs array defined in data-management.js
        // Wait for gameIDs to be available, with fallback to the known correct game ID
        this.gameID = (typeof gameIDs !== 'undefined' && gameIDs.length > 0) ? gameIDs[0] : 'o1y9pyk6';
        this.lastFailureTime = 0;
        this.failureDelay = 5000; // 5 seconds delay after failures
    }
    
    // Static counter for tracking API calls
    static apiCallCount = 0;
    
    // Static cache for game metadata
    static gameMetadata = {
        variables: null,
        levels: null,
        categories: null,
        isInitialized: false
    };
    
    // Static method to reset API call counter
    static resetApiCallCounter() {
        WorldRecordFetcher.apiCallCount = 0;
        console.log('🔄 API Call Counter Reset');
    }
    
    // Static method to get API call summary
    static getApiCallSummary() {
        return {
            totalCalls: WorldRecordFetcher.apiCallCount,
            summary: `Total API calls made: ${WorldRecordFetcher.apiCallCount}`
        };
    }
    
    // Static method to initialize game metadata (called once on page load)
    static async initializeGameMetadata() {
        if (WorldRecordFetcher.gameMetadata.isInitialized) {
            console.log('🎮 Game metadata already initialized');
            return;
        }
        
        console.log('🎮 Initializing game metadata...');
        
        try {
            const fetcher = new WorldRecordFetcher();
            
            // Load all metadata in parallel
            const [variables, levels, categories] = await Promise.all([
                fetcher.fetchAPI(`https://www.speedrun.com/api/v1/games/${fetcher.gameID}/variables`),
                fetcher.fetchAPI(`https://www.speedrun.com/api/v1/games/${fetcher.gameID}/levels`),
                fetcher.fetchAPI(`https://www.speedrun.com/api/v1/games/${fetcher.gameID}/categories`)
            ]);
            
            // Cache the metadata
            WorldRecordFetcher.gameMetadata.variables = variables;
            WorldRecordFetcher.gameMetadata.levels = levels;
            WorldRecordFetcher.gameMetadata.categories = categories;
            WorldRecordFetcher.gameMetadata.isInitialized = true;
            
            console.log('✅ Game metadata initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize game metadata:', error);
            throw error;
        }
    }
    
    // Method to get cached metadata
    getGameMetadata() {
        if (!WorldRecordFetcher.gameMetadata.isInitialized) {
            throw new Error('Game metadata not initialized. Call WorldRecordFetcher.initializeGameMetadata() first.');
        }
        return WorldRecordFetcher.gameMetadata;
    }
    
    // Simple API request function with retry logic
    async fetchAPI(url, maxRetries = 10, baseDelay = 1000) {
        // Increment API call counter
        WorldRecordFetcher.apiCallCount++;
        const callNumber = WorldRecordFetcher.apiCallCount;
        
        console.log(`🌐 API Call #${callNumber}: ${url}`);
        
        // Check if we need to wait due to a recent failure
        const now = Date.now();
        const timeSinceLastFailure = now - this.lastFailureTime;
        if (timeSinceLastFailure < this.failureDelay) {
            const waitTime = this.failureDelay - timeSinceLastFailure;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (attempt > 1) {
                    console.log(`🔄 API Call #${callNumber} Retry ${attempt}/${maxRetries}: ${url}`);
                }
                
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    // Special handling for 420 rate limit - wait longer and retry
                    if (response.status === 420) {
                        console.log(`⚠️ API Call #${callNumber} Rate limited (420) on attempt ${attempt}, waiting before retry...`);
                        
                        // Update refresh button immediately to show "Rate limited"
                        var refreshButton = document.querySelector('.refresh-btn');
                        if (refreshButton) {
                            refreshButton.innerHTML = '⏳ Rate limited';
                            refreshButton.disabled = true;
                            refreshButton.setAttribute('title', 'API is rate limited. Please wait...');
                        }
                        
                        // Set global rate limit state
                        if (window.setApiOverloaded) {
                            window.setApiOverloaded(true);
                        }
                        
                        // Wait 5 seconds for rate limit
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        
                        // If this is the last attempt, throw the error
                        if (attempt === maxRetries) {
                            console.log(`❌ API Call #${callNumber} Failed after ${maxRetries} attempts: ${response.status} ${response.statusText}`);
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                        continue; // Retry
                    }
                    
                    // Don't retry on other 4xx client errors (except 429 rate limit)
                    if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                        // Record failure time for future API calls
                        this.lastFailureTime = Date.now();
                        console.log(`❌ API Call #${callNumber} Client error (no retry): ${response.status} ${response.statusText}`);
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    // For 5xx server errors and 429 rate limit, retry
                    console.log(`⚠️ API Call #${callNumber} Server error on attempt ${attempt}: ${response.status} ${response.statusText}`);
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                // Success - clear rate limit state if it was set
                if (window.setApiOverloaded) {
                    window.setApiOverloaded(false);
                }
                
                const data = await response.json();
                console.log(`✅ API Call #${callNumber} Success: ${url}`);
                return data;
            } catch (error) {
                // Record failure time for future API calls
                this.lastFailureTime = Date.now();
                
                // If this is the last attempt, throw the error
                if (attempt === maxRetries) {
                    console.log(`❌ API Call #${callNumber} Failed after ${maxRetries} attempts: ${error.message}`);
                    throw error;
                }
                
                // Calculate delay with exponential backoff
                const delay = baseDelay * Math.pow(2, attempt - 1);
                console.log(`⏳ API Call #${callNumber} Waiting ${delay}ms before retry ${attempt + 1}...`);
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // Convert ISO duration to readable format
    formatTime(duration) {
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?([\d.]+)S/);
        if (!match) return duration;
        
        let time = '';
        if (match[1]) time += match[1] + 'h';
        if (match[2]) time += match[2] + 'm';
        
        const seconds = parseFloat(match[3]);
        time += Math.floor(seconds) + 's';
        
        const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
        if (ms > 0) time += ms + 'ms';
        
        return time;
    }

    // Fetch player data by ID
    async getPlayerData(playerId) {
        try {
            const playerData = await this.fetchAPI(`https://www.speedrun.com/api/v1/users/${playerId}`);
            
            if (playerData && playerData.data) {
                // Check if we have valid name data
                let playerName = null;
                
                if (playerData.data.names && playerData.data.names.international) {
                    playerName = playerData.data.names.international;
                } else if (playerData.data.name) {
                    playerName = playerData.data.name;
                }
                
                // Only return valid player data if we have a name
                if (playerName && playerName.trim() !== "") {
                    return {
                        name: playerName,
                        id: playerData.data.id,
                        nameStyle: playerData.data["name-style"] || {
                            style: "solid",
                            color: {
                                dark: "#ffffff"
                            }
                        }
                    };
                }
            }
            
            // If we reach here, something went wrong - try to get a better fallback
            return {
                name: `Player ${playerId.substring(0, 8)}`,
                id: playerId,
                nameStyle: {
                    style: "solid",
                    color: {
                        dark: "#ffffff"
                    }
                }
            };
        } catch (error) {
            // If API call fails, use a more descriptive fallback
            return {
                name: `Player ${playerId.substring(0, 8)}`,
                id: playerId,
                nameStyle: {
                    style: "solid",
                    color: {
                        dark: "#ffffff"
                    }
                }
            };
        }
    }

    // Decode run variables to understand the mapping
    async decodeRunVariables(runValues) {
        try {
            const metadata = this.getGameMetadata();
            const variables = metadata.variables;
            
            for (const [varId, valueId] of Object.entries(runValues)) {
                const variable = variables.data.find(v => v.id === varId);
                if (variable) {
                    if (variable.values && variable.values.values) {
                        const value = variable.values.values[valueId];
                        if (value) {
                     
                        }
                    }
                }
            }
        } catch (error) {
            // Silent error
        }
    }

    // Get world record for specific parameters
    async getWorldRecord(level, mode = 0, count = 0, speed = 0, size = 0) {
        try {
            // Check cache first
            const modeNames = ["Classic", "Wall", "Portal", "Cheese", "Borderless", "Twin", "Winged", "Yin Yang", "Key", "Sokoban", "Poison", "Dimension", "Minesweeper", "Statue", "Light", "Shield", "Arrow", "Hotdog", "Magnet", "Gate", "Peaceful"];
            const modeName = modeNames[mode];
            const categoryName = level === "H" ? modeName : `${level} Apples`;
            
            const settings = [
                modeName,
                categoryName,
                ["1 Apple", "3 Apples", "5 Apples", "10 Apples", "Dice", "Bomb"][count],
                ["Normal", "Fast", "Slow"][speed],
                ["Standard", "Small", "Large"][size]
            ];
            const cacheKey = window.cacheManager.getCacheKey(settings);
            const cachedData = window.cacheManager.getCachedData(cacheKey);
            
            if (cachedData && window.cacheManager.isCacheValid(cacheKey)) {
                // Return the cached data directly - it's already in the correct format
                return cachedData.data;
            }
            
            // Step 1: Get cached game metadata
            const metadata = this.getGameMetadata();
            const variables = metadata.variables;
            const levels = metadata.levels;
            const categories = metadata.categories;
            
            // Step 2: Find the level ID for the mode
            const levelData = levels.data.find(l => l.name.includes(modeName));
            if (!levelData) {
                throw new Error(`Level not found for mode: ${modeName}`);
            }
            
            // Step 3: Find the category ID
            const categoryData = categories.data.find(c => c.name.includes(categoryName));
            if (!categoryData) {
                throw new Error(`Category not found: ${categoryName}`);
            }
            
            // Step 4: Build variable parameters
            const params = [];
            
            // Count variable - "Multi Apple Amount"
            const countVar = variables.data.find(v => v.name === "Multi Apple Amount");
            if (countVar && countVar.values && countVar.values.values) {
                const countNames = ["1 Apple", "3 Apples", "5 Apples", "10 Apples", "Dice", "Bomb"];
                const countValueEntry = Object.entries(countVar.values.values).find(([key, value]) => value.label === countNames[count]);
                if (countValueEntry) {
                    const [valueId, valueObj] = countValueEntry;
                    params.push(`var-${countVar.id}=${valueId}`);
                }
            }
            
            // Speed variables - add all Speed variables with Normal speed
            const speedVars = variables.data.filter(v => v.name === "Speed");
            
            // Add all speed variables with Normal speed
            for (let i = 0; i < speedVars.length; i++) {
                const sv = speedVars[i];
                if (sv.values && sv.values.values) {
                    const valueLabels = Object.values(sv.values.values).map(v => v.label);
                    
                    // Find Normal speed for this variable
                    const speedNames = ["Normal", "Fast", "Slow"];
                    const speedValueEntry = Object.entries(sv.values.values).find(([key, value]) => value.label === speedNames[speed]);
                    if (speedValueEntry) {
                        const [valueId, valueObj] = speedValueEntry;
                        params.push(`var-${sv.id}=${valueId}`);
                    }
                }
            }
            
            // Size variable - "Board Size"
            const sizeVar = variables.data.find(v => v.name === "Board Size");
            if (sizeVar && sizeVar.values && sizeVar.values.values) {
                const sizeNames = ["Standard", "Small", "Large"];
                const sizeValueEntry = Object.entries(sizeVar.values.values).find(([key, value]) => value.label === sizeNames[size]);
                if (sizeValueEntry) {
                    const [valueId, valueObj] = sizeValueEntry;
                    params.push(`var-${sizeVar.id}=${valueId}`);
                }
            }
            
            // Step 5: Build leaderboard URL - request more records to get all tied runs
            let leaderboardUrl;
            if (level === "H") {
                leaderboardUrl = `https://www.speedrun.com/api/v1/leaderboards/${this.gameID}/category/${categoryData.id}?top=10`;
            } else {
                leaderboardUrl = `https://www.speedrun.com/api/v1/leaderboards/${this.gameID}/level/${levelData.id}/${categoryData.id}?top=10`;
            }
            
            // Only add parameters if they have valid values (not undefined)
            const validParams = params.filter(p => !p.includes('undefined'));
            if (validParams.length > 0) {
                leaderboardUrl += "&" + validParams.join("&");
            }
            
            // Step 6: Get leaderboard
            const leaderboard = await this.fetchAPI(leaderboardUrl);
            
            // Step 7: Process result
            
            if (!leaderboard.data || !leaderboard.data.runs || leaderboard.data.runs.length === 0) {
                const emptyResult = {
                    success: false,
                    message: "No world record found",
                    category: `${modeName} - ${categoryName} (${["1 Apple", "3 Apples", "5 Apples", "10 Apples", "Dice", "Bomb"][count]}, ${["Normal", "Fast", "Slow"][speed]}, ${["Standard", "Small", "Large"][size]})`,
                    settings: {
                        count: ["1 Apple", "3 Apples", "5 Apples", "10 Apples", "Dice", "Bomb"][count],
                        speed: ["Normal", "Fast", "Slow"][speed],
                        size: ["Standard", "Small", "Large"][size]
                    }
                };
                
                // Cache empty results as well - this prevents repeated API calls for non-existent combinations
                window.cacheManager.updateCacheIfChanged(cacheKey, emptyResult);
                
                return emptyResult;
            }
            
            // Get the best time from the first run
            const bestTime = leaderboard.data.runs[0].run.times.primary;
            
            // Filter runs to only include those with the same best time (tied world records)
            const tiedRuns = [];
            
            for (const run of leaderboard.data.runs) {
                if (run.run.times.primary === bestTime) {
                    // Check what variables the returned run actually has
                    if (run.run && run.run.values) {
                        await this.decodeRunVariables(run.run.values);
                    }
                    
                    let playerId = null;
                    let runData = null;
                    
                    // Check for the correct structure: run.run.players[0] (array)
                    if (run.run && run.run.players && Array.isArray(run.run.players) && run.run.players.length > 0) {
                        const playerRef = run.run.players[0];
                        
                        // Player reference should have an 'id' field
                        if (playerRef && playerRef.id) {
                            playerId = playerRef.id;
                            runData = run.run;
                        } else {
                            continue; // Skip this run if player reference is missing
                        }
                    } else {
                        continue; // Skip this run if player data structure is wrong
                    }
                    
                    // Fetch the full player data using the ID
                    const player = await this.getPlayerData(playerId);
                    
                    tiedRuns.push({
                        player: {
                            name: player.name,
                            id: player.id,
                            nameStyle: player.nameStyle
                        },
                        time: {
                            raw: runData.times.primary,
                            formatted: this.formatTime(runData.times.primary)
                        },
                        date: new Date(runData.date),
                        runId: runData.id,
                        weblink: runData.weblink
                    });
                } else {
                    // Stop when we find a run with a different time
                    break;
                }
            }
            
            const result = {
                success: true,
                runs: tiedRuns,
                category: `${modeName} - ${categoryName} (${["1 Apple", "3 Apples", "5 Apples", "10 Apples", "Dice", "Bomb"][count]}, ${["Normal", "Fast", "Slow"][speed]}, ${["Standard", "Small", "Large"][size]})`,
                settings: {
                    count: ["1 Apple", "3 Apples", "5 Apples", "10 Apples", "Dice", "Bomb"][count],
                    speed: ["Normal", "Fast", "Slow"][speed],
                    size: ["Standard", "Small", "Large"][size]
                }
            };
            
            // Store in cache using comparison logic
            const wasUpdated = window.cacheManager.updateCacheIfChanged(cacheKey, result);
            
            return result;
            
                         } catch (error) {
            // If it's a 420 error, re-throw it to be caught by the main application
            if (error.message && error.message.includes('HTTP 420')) {
                throw error;
            }
            
            const modeNames = ["Classic", "Wall", "Portal", "Cheese", "Borderless", "Twin", "Winged", "Yin Yang", "Key", "Sokoban", "Poison", "Dimension", "Minesweeper", "Statue", "Light", "Shield", "Arrow", "Hotdog", "Magnet", "Gate", "Peaceful"];
            const categoryName = level === "H" ? modeNames[mode] : level + " Apples";
            return {
                success: false,
                error: error.message,
                category: `${modeNames[mode]} - ${categoryName} (${["1 Apple", "3 Apples", "5 Apples", "10 Apples", "Dice", "Bomb"][count]}, ${["Normal", "Fast", "Slow"][speed]}, ${["Standard", "Small", "Large"][size]})`,
                settings: {
                    count: ["1 Apple", "3 Apples", "5 Apples", "10 Apples", "Dice", "Bomb"][count],
                    speed: ["Normal", "Fast", "Slow"][speed],
                    size: ["Standard", "Small", "Large"][size]
                }
            };
        }
    }

    // Get world record for specific parameters and date
    async getWorldRecordForDate(level, mode = 0, count = 0, speed = 0, size = 0, date) {
        try {
            // Check cache first
            const modeNames = ["Classic", "Wall", "Portal", "Cheese", "Borderless", "Twin", "Winged", "Yin Yang", "Key", "Sokoban", "Poison", "Dimension", "Minesweeper", "Statue", "Light", "Shield", "Arrow", "Hotdog", "Magnet", "Gate", "Peaceful"];
            const modeName = modeNames[mode];
            const categoryName = level === "H" ? modeName : `${level} Apples`;
            
            const settings = [
                modeName,
                categoryName,
                ["1 Apple", "3 Apples", "5 Apples", "10 Apples", "Dice", "Bomb"][count],
                ["Normal", "Fast", "Slow"][speed],
                ["Standard", "Small", "Large"][size]
            ];
            const cacheKey = window.cacheManager.getCacheKey(settings, date);
            const cachedData = window.cacheManager.getCachedData(cacheKey);
            
            if (cachedData && window.cacheManager.isCacheValid(cacheKey)) {
                // Return the cached data directly - it's already in the correct format
                return cachedData.data;
            }
            
            // Step 1: Get cached game metadata
            const metadata = this.getGameMetadata();
            const variables = metadata.variables;
            const levels = metadata.levels;
            const categories = metadata.categories;
            
            // Step 2: Find the level ID for the mode
            const levelData = levels.data.find(l => l.name.includes(modeName));
            if (!levelData) {
                throw new Error(`Level not found for mode: ${modeName}`);
            }
            
            // Step 3: Find the category ID
            const categoryData = categories.data.find(c => c.name.includes(categoryName));
            if (!categoryData) {
                throw new Error(`Category not found: ${categoryName}`);
            }
            
            // Step 4: Build variable parameters
            const params = [];
            
            // Count variable - "Multi Apple Amount"
            const countVar = variables.data.find(v => v.name === "Multi Apple Amount");
            if (countVar && countVar.values && countVar.values.values) {
                const countNames = ["1 Apple", "3 Apples", "5 Apples", "10 Apples", "Dice", "Bomb"];
                const countValueEntry = Object.entries(countVar.values.values).find(([key, value]) => value.label === countNames[count]);
                if (countValueEntry) {
                    const [valueId, valueObj] = countValueEntry;
                    params.push(`var-${countVar.id}=${valueId}`);
                }
            }
            
            // Speed variables - add all Speed variables with Normal speed
            const speedVars = variables.data.filter(v => v.name === "Speed");
            
            // Add all speed variables with Normal speed
            for (let i = 0; i < speedVars.length; i++) {
                const sv = speedVars[i];
                if (sv.values && sv.values.values) {
                    const valueLabels = Object.values(sv.values.values).map(v => v.label);
                    
                    // Find Normal speed for this variable
                    const speedNames = ["Normal", "Fast", "Slow"];
                    const speedValueEntry = Object.entries(sv.values.values).find(([key, value]) => value.label === speedNames[speed]);
                    if (speedValueEntry) {
                        const [valueId, valueObj] = speedValueEntry;
                        params.push(`var-${sv.id}=${valueId}`);
                    }
                }
            }
            
            // Size variable - "Board Size"
            const sizeVar = variables.data.find(v => v.name === "Board Size");
            if (sizeVar && sizeVar.values && sizeVar.values.values) {
                const sizeNames = ["Standard", "Small", "Large"];
                const sizeValueEntry = Object.entries(sizeVar.values.values).find(([key, value]) => value.label === sizeNames[size]);
                if (sizeValueEntry) {
                    const [valueId, valueObj] = sizeValueEntry;
                    params.push(`var-${sizeVar.id}=${valueId}`);
                }
            }
            
            // Step 5: Build leaderboard URL with date filter
            let leaderboardUrl;
            if (level === "H") {
                leaderboardUrl = `https://www.speedrun.com/api/v1/leaderboards/${this.gameID}/category/${categoryData.id}?top=10&date=${date}`;
            } else {
                leaderboardUrl = `https://www.speedrun.com/api/v1/leaderboards/${this.gameID}/level/${levelData.id}/${categoryData.id}?top=10&date=${date}`;
            }
            
            // Only add parameters if they have valid values (not undefined)
            const validParams = params.filter(p => !p.includes('undefined'));
            if (validParams.length > 0) {
                leaderboardUrl += "&" + validParams.join("&");
            }
            
            // Step 6: Get leaderboard
            const leaderboard = await this.fetchAPI(leaderboardUrl);
            
            // Step 7: Process result
            if (!leaderboard.data || !leaderboard.data.runs || leaderboard.data.runs.length === 0) {
                const emptyResult = {
                    success: false,
                    message: "No world record found for this date",
                    category: `${modeName} - ${categoryName} (${["1 Apple", "3 Apples", "5 Apples", "10 Apples", "Dice", "Bomb"][count]}, ${["Normal", "Fast", "Slow"][speed]}, ${["Standard", "Small", "Large"][size]})`,
                    settings: {
                        count: ["1 Apple", "3 Apples", "5 Apples", "10 Apples", "Dice", "Bomb"][count],
                        speed: ["Normal", "Fast", "Slow"][speed],
                        size: ["Standard", "Small", "Large"][size]
                    },
                    date: date
                };
                
                // Cache empty results as well - this prevents repeated API calls for non-existent combinations
                window.cacheManager.updateCacheIfChanged(cacheKey, emptyResult);
                
                return emptyResult;
            }
            
            // Get the best time from the first run
            const bestTime = leaderboard.data.runs[0].run.times.primary;
            
            // Filter runs to only include those with the same best time (tied world records)
            const tiedRuns = [];
            
            for (const run of leaderboard.data.runs) {
                if (run.run.times.primary === bestTime) {
                    // Check what variables the returned run actually has
                    if (run.run && run.run.values) {
                        await this.decodeRunVariables(run.run.values);
                    }
                    
                    let playerId = null;
                    let runData = null;
                    
                    // Check for the correct structure: run.run.players[0] (array)
                    if (run.run && run.run.players && Array.isArray(run.run.players) && run.run.players.length > 0) {
                        const playerRef = run.run.players[0];
                        
                        // Player reference should have an 'id' field
                        if (playerRef && playerRef.id) {
                            playerId = playerRef.id;
                            runData = run.run;
                        } else {
                            continue; // Skip this run if player reference is missing
                        }
                    } else {
                        continue; // Skip this run if player data structure is wrong
                    }
                    
                    // Fetch the full player data using the ID
                    const player = await this.getPlayerData(playerId);
                    
                    tiedRuns.push({
                        player: {
                            name: player.name,
                            id: player.id,
                            nameStyle: player.nameStyle
                        },
                        time: {
                            raw: runData.times.primary,
                            formatted: this.formatTime(runData.times.primary)
                        },
                        date: new Date(runData.date),
                        runId: runData.id,
                        weblink: runData.weblink
                    });
                } else {
                    // Stop when we find a run with a different time
                    break;
                }
            }
            
            const result = {
                success: true,
                runs: tiedRuns,
                category: `${modeName} - ${categoryName} (${["1 Apple", "3 Apples", "5 Apples", "10 Apples", "Dice", "Bomb"][count]}, ${["Normal", "Fast", "Slow"][speed]}, ${["Standard", "Small", "Large"][size]})`,
                settings: {
                    count: ["1 Apple", "3 Apples", "5 Apples", "10 Apples", "Dice", "Bomb"][count],
                    speed: ["Normal", "Fast", "Slow"][speed],
                    size: ["Standard", "Small", "Large"][size]
                },
                date: date
            };
            
            // Store in cache using comparison logic
            const wasUpdated = window.cacheManager.updateCacheIfChanged(cacheKey, result);
            
            return result;
            
        } catch (error) {
            // If it's a 420 error, re-throw it to be caught by the main application
            if (error.message && error.message.includes('HTTP 420')) {
                throw error;
            }
            
            const modeNames = ["Classic", "Wall", "Portal", "Cheese", "Borderless", "Twin", "Winged", "Yin Yang", "Key", "Sokoban", "Poison", "Dimension", "Minesweeper", "Statue", "Light", "Shield", "Arrow", "Hotdog", "Magnet", "Gate", "Peaceful"];
            const categoryName = level === "H" ? modeNames[mode] : level + " Apples";
            return {
                success: false,
                error: error.message,
                category: `${modeNames[mode]} - ${categoryName} (${["1 Apple", "3 Apples", "5 Apples", "10 Apples", "Dice", "Bomb"][count]}, ${["Normal", "Fast", "Slow"][speed]}, ${["Standard", "Small", "Large"][size]})`,
                settings: {
                    count: ["1 Apple", "3 Apples", "5 Apples", "10 Apples", "Dice", "Bomb"][count],
                    speed: ["Normal", "Fast", "Slow"][speed],
                    size: ["Standard", "Small", "Large"][size]
                },
                date: date
            };
        }
    }

    // Fetch multiple world records concurrently (batch of 50 or 25 based on multiple tables setting)
    async fetchWorldRecordsBatch(requests, progressCallback = null) {
        // Determine batch size based on multiple tables setting
        const batchSize = (typeof isMultipleTablesEnabled !== 'undefined' && isMultipleTablesEnabled) ? 25 : 50;
        
        // Initialize results array with the same length as requests, filled with null
        const results = new Array(requests.length);
        
        // First, check cache for all requests with 1000 concurrency
        const cacheResults = [];
        const apiRequests = [];
        const apiRequestIndices = []; // Track original indices for API requests
        
        // Process ALL cache checks instantly with maximum concurrency
        const cachePromises = requests.map(async (request, index) => {
            // Generate cache key for this request
            const modeNames = ["Classic", "Wall", "Portal", "Cheese", "Borderless", "Twin", "Winged", "Yin Yang", "Key", "Sokoban", "Poison", "Dimension", "Minesweeper", "Statue", "Light", "Shield", "Arrow", "Hotdog", "Magnet", "Gate", "Peaceful"];
            const modeName = modeNames[request.mode];
            
            // Check if this is a high score request (either by level or levelName)
            const isHighScore = request.level === "H" || request.levelName === "High Score";
            const categoryName = isHighScore ? modeName : `${request.level} Apples`;
            
            const settings = [
                modeName,
                categoryName,
                ["1 Apple", "3 Apples", "5 Apples", "10 Apples", "Dice", "Bomb"][request.count],
                ["Normal", "Fast", "Slow"][request.speed],
                ["Standard", "Small", "Large"][request.size]
            ];
            
            const cacheKey = window.cacheManager.getCacheKey(settings, request.date);
            const cachedData = window.cacheManager.getCachedData(cacheKey);
            
            if (cachedData && window.cacheManager.isCacheValid(cacheKey)) {
                // Use cached data
                return {
                    type: 'cache',
                    request: request,
                    result: cachedData.data,
                    originalIndex: index
                };
            } else {
                // Need to make API call
                return {
                    type: 'api',
                    request: request,
                    originalIndex: index
                };
            }
        });
        
        // Wait for ALL cache checks to complete instantly
        const allResults = await Promise.all(cachePromises);
        
        // Separate cache hits from API requests and place results in correct positions
        allResults.forEach(result => {
            if (result.type === 'cache') {
                // Place cache result in the correct position
                results[result.originalIndex] = result.result;
                cacheResults.push({
                    request: result.request,
                    result: result.result
                });
            } else {
                // Track API request for later processing
                apiRequests.push(result.request);
                apiRequestIndices.push(result.originalIndex);
            }
        });
        
        // Update progress for cached results (these are not API calls)
        if (progressCallback) {
            progressCallback(0); // Don't count cache hits as API calls
        }
        
        // Show cache loading progress
        if (cacheResults.length > 0) {
            console.log(`Loaded ${cacheResults.length} records from cache, ${apiRequests.length} API calls needed`);
        }
        
        // Update the total API calls needed (only actual API calls, not cache)
        if (progressCallback && apiRequests.length > 0) {
            // This will update the total to only count actual API calls
            progressCallback(apiRequests.length, true); // true = update total
        }
        
        // Process API requests in batches
        for (let i = 0; i < apiRequests.length; i += batchSize) {
            // Check if API calls are paused
            while (window.isApiPaused) {
                await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms before checking again
            }
            
            const batch = apiRequests.slice(i, i + batchSize);
            const batchIndices = apiRequestIndices.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (request, batchIndex) => {
                const originalIndex = batchIndices[batchIndex];
                
                try {
                    if (request.date) {
                        return {
                            result: await this.getWorldRecordForDate(
                                request.level, 
                                request.mode, 
                                request.count, 
                                request.speed, 
                                request.size, 
                                request.date
                            ),
                            originalIndex: originalIndex
                        };
                    } else {
                        return {
                            result: await this.getWorldRecord(
                                request.level, 
                                request.mode, 
                                request.count, 
                                request.speed, 
                                request.size
                            ),
                            originalIndex: originalIndex
                        };
                    }
                } catch (error) {
                    // If it's a 420 error, throw it to be caught by the main application
                    if (error.message && error.message.includes('HTTP 420')) {
                        throw error;
                    }
                    // For other errors, return a failed result
                    return {
                        result: {
                            success: false,
                            error: error.message,
                            category: 'Unknown',
                            settings: {
                                count: 'Unknown',
                                speed: 'Unknown',
                                size: 'Unknown'
                            }
                        },
                        originalIndex: originalIndex
                    };
                }
            });
            
            try {
                const batchResults = await Promise.all(batchPromises);
                
                // Place API results in the correct positions
                batchResults.forEach(item => {
                    results[item.originalIndex] = item.result;
                });
                
                // Update progress after each batch (only count actual API calls, not cache)
                if (progressCallback) {
                    // Only count the API calls from this batch, not cache hits
                    const apiCallsInBatch = batchResults.filter(item => item.result.success || item.result.error).length;
                    progressCallback(apiCallsInBatch);
                }
                
                // Add delay between batches when multiple tables is enabled
                if (typeof isMultipleTablesEnabled !== 'undefined' && isMultipleTablesEnabled && i + batchSize < apiRequests.length) {
                    await new Promise(resolve => setTimeout(resolve, 300)); // 0.3 second delay
                }
            } catch (error) {
                // If any request in the batch failed with 420, throw the error
                if (error.message && error.message.includes('HTTP 420')) {
                    throw error;
                }
                // For other errors, continue with partial results
                console.error('Batch error:', error);
            }
        }
        
        // Log API call summary for this batch operation
        const summary = WorldRecordFetcher.getApiCallSummary();
        console.log(`📊 Batch Operation Complete: ${summary.summary}`);
        
        return results;
    }
}

// Create global instance
window.worldRecordFetcher = new WorldRecordFetcher();
