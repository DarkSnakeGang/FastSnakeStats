// Simple World Record Fetcher
class WorldRecordFetcher {
    constructor() {
        this.gameID = "o1y9pyk6"; // Snake game ID
        this.lastFailureTime = 0; // Track when the last API failure occurred
        this.failureDelay = 600; // 0.6 seconds delay after failure
    }

        // Simple API request function with retry logic
    async fetchAPI(url, maxRetries = 5, baseDelay = 1000) {
        // Check if we need to wait due to a recent failure
        const now = Date.now();
        const timeSinceLastFailure = now - this.lastFailureTime;
        if (timeSinceLastFailure < this.failureDelay) {
            const waitTime = this.failureDelay - timeSinceLastFailure;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    // Don't retry on 4xx client errors (except 429 rate limit)
                    if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                        // Record failure time for future API calls
                        this.lastFailureTime = Date.now();
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    // For 5xx server errors and 429 rate limit, retry
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                return data;
            } catch (error) {
                // Record failure time for future API calls
                this.lastFailureTime = Date.now();
                
                // If this is the last attempt, throw the error
                if (attempt === maxRetries) {
                    throw error;
                }
                
                // Calculate delay with exponential backoff
                const delay = baseDelay * Math.pow(2, attempt - 1);
                
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
            const variables = await this.fetchAPI(`https://www.speedrun.com/api/v1/games/${this.gameID}/variables`);
            
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
            
            // Step 1: Get game data
            const variables = await this.fetchAPI(`https://www.speedrun.com/api/v1/games/${this.gameID}/variables`);
            const levels = await this.fetchAPI(`https://www.speedrun.com/api/v1/games/${this.gameID}/levels`);
            const categories = await this.fetchAPI(`https://www.speedrun.com/api/v1/games/${this.gameID}/categories`);
            
                         // Step 2: Find the level ID for the mode
             const modeNames = ["Classic", "Wall", "Portal", "Cheese", "Borderless", "Twin", "Winged", "Yin Yang", "Key", "Sokoban", "Poison", "Dimension", "Minesweeper", "Statue", "Light", "Shield", "Arrow", "Hotdog", "Magnet", "Gate", "Peaceful"];
            const modeName = modeNames[mode];
            
            const levelData = levels.data.find(l => l.name.includes(modeName));
            if (!levelData) {
                throw new Error(`Level not found for mode: ${modeName}`);
            }
            
            // Step 3: Find the category ID
            const categoryName = level === "H" ? modeName : `${level} Apples`;
            const categoryData = categories.data.find(c => c.name.includes(categoryName));
            if (!categoryData) {
                throw new Error(`Category not found: ${categoryName}`);
            }
            
            // Step 4: Build variable parameters
            const params = [];
            
            // Count variable - "Multi Apple Amount"
            const countVar = variables.data.find(v => v.name === "Multi Apple Amount");
            if (countVar && countVar.values && countVar.values.values) {
                const countNames = ["1 Apple", "3 Apples", "5 Apples", "Dice"];
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
            
            // API URL and parameters logged for debugging if needed
            
            // Step 6: Get leaderboard
            const leaderboard = await this.fetchAPI(leaderboardUrl);
            
            // Step 7: Process result
            
            if (!leaderboard.data || !leaderboard.data.runs || leaderboard.data.runs.length === 0) {
                return {
                    success: false,
                    message: "No world record found",
                    category: `${modeName} - ${categoryName} (${["1 Apple", "3 Apples", "5 Apples", "Dice"][count]}, ${["Normal", "Fast", "Slow"][speed]}, ${["Standard", "Small", "Large"][size]})`,
                    settings: {
                        count: ["1 Apple", "3 Apples", "5 Apples", "Dice"][count],
                        speed: ["Normal", "Fast", "Slow"][speed],
                        size: ["Standard", "Small", "Large"][size]
                    }
                };
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
            
            return {
                success: true,
                runs: tiedRuns,
                category: `${modeName} - ${categoryName} (${["1 Apple", "3 Apples", "5 Apples", "Dice"][count]}, ${["Normal", "Fast", "Slow"][speed]}, ${["Standard", "Small", "Large"][size]})`,
                settings: {
                    count: ["1 Apple", "3 Apples", "5 Apples", "Dice"][count],
                    speed: ["Normal", "Fast", "Slow"][speed],
                    size: ["Standard", "Small", "Large"][size]
                }
            };
            
                 } catch (error) {
             const modeNames = ["Classic", "Wall", "Portal", "Cheese", "Borderless", "Twin", "Winged", "Yin Yang", "Key", "Sokoban", "Poison", "Dimension", "Minesweeper", "Statue", "Light", "Shield", "Arrow", "Hotdog", "Magnet", "Gate", "Peaceful"];
            const categoryName = level === "H" ? modeNames[mode] : level + " Apples";
            return {
                success: false,
                error: error.message,
                category: `${modeNames[mode]} - ${categoryName} (${["1 Apple", "3 Apples", "5 Apples", "Dice"][count]}, ${["Normal", "Fast", "Slow"][speed]}, ${["Standard", "Small", "Large"][size]})`,
                settings: {
                    count: ["1 Apple", "3 Apples", "5 Apples", "Dice"][count],
                    speed: ["Normal", "Fast", "Slow"][speed],
                    size: ["Standard", "Small", "Large"][size]
                }
            };
        }
    }

    // Get world record for specific parameters and date
    async getWorldRecordForDate(level, mode = 0, count = 0, speed = 0, size = 0, date) {
        try {
            
            // Step 1: Get game data
            const variables = await this.fetchAPI(`https://www.speedrun.com/api/v1/games/${this.gameID}/variables`);
            const levels = await this.fetchAPI(`https://www.speedrun.com/api/v1/games/${this.gameID}/levels`);
            const categories = await this.fetchAPI(`https://www.speedrun.com/api/v1/games/${this.gameID}/categories`);
            
            // Step 2: Find the level ID for the mode
            const modeNames = ["Classic", "Wall", "Portal", "Cheese", "Borderless", "Twin", "Winged", "Yin Yang", "Key", "Sokoban", "Poison", "Dimension", "Minesweeper", "Statue", "Light", "Shield", "Arrow", "Hotdog", "Magnet", "Gate", "Peaceful"];
            const modeName = modeNames[mode];
            
            const levelData = levels.data.find(l => l.name.includes(modeName));
            if (!levelData) {
                throw new Error(`Level not found for mode: ${modeName}`);
            }
            
            // Step 3: Find the category ID
            const categoryName = level === "H" ? modeName : `${level} Apples`;
            const categoryData = categories.data.find(c => c.name.includes(categoryName));
            if (!categoryData) {
                throw new Error(`Category not found: ${categoryName}`);
            }
            
            // Step 4: Build variable parameters
            const params = [];
            
            // Count variable - "Multi Apple Amount"
            const countVar = variables.data.find(v => v.name === "Multi Apple Amount");
            if (countVar && countVar.values && countVar.values.values) {
                const countNames = ["1 Apple", "3 Apples", "5 Apples", "Dice"];
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
                return {
                    success: false,
                    message: "No world record found for this date",
                    category: `${modeName} - ${categoryName} (${["1 Apple", "3 Apples", "5 Apples", "Dice"][count]}, ${["Normal", "Fast", "Slow"][speed]}, ${["Standard", "Small", "Large"][size]})`,
                    settings: {
                        count: ["1 Apple", "3 Apples", "5 Apples", "Dice"][count],
                        speed: ["Normal", "Fast", "Slow"][speed],
                        size: ["Standard", "Small", "Large"][size]
                    },
                    date: date
                };
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
            
            return {
                success: true,
                runs: tiedRuns,
                category: `${modeName} - ${categoryName} (${["1 Apple", "3 Apples", "5 Apples", "Dice"][count]}, ${["Normal", "Fast", "Slow"][speed]}, ${["Standard", "Small", "Large"][size]})`,
                settings: {
                    count: ["1 Apple", "3 Apples", "5 Apples", "Dice"][count],
                    speed: ["Normal", "Fast", "Slow"][speed],
                    size: ["Standard", "Small", "Large"][size]
                },
                date: date
            };
            
        } catch (error) {
            const modeNames = ["Classic", "Wall", "Portal", "Cheese", "Borderless", "Twin", "Winged", "Yin Yang", "Key", "Sokoban", "Poison", "Dimension", "Minesweeper", "Statue", "Light", "Shield", "Arrow", "Hotdog", "Magnet", "Gate", "Peaceful"];
            const categoryName = level === "H" ? modeNames[mode] : level + " Apples";
            return {
                success: false,
                error: error.message,
                category: `${modeNames[mode]} - ${categoryName} (${["1 Apple", "3 Apples", "5 Apples", "Dice"][count]}, ${["Normal", "Fast", "Slow"][speed]}, ${["Standard", "Small", "Large"][size]})`,
                settings: {
                    count: ["1 Apple", "3 Apples", "5 Apples", "Dice"][count],
                    speed: ["Normal", "Fast", "Slow"][speed],
                    size: ["Standard", "Small", "Large"][size]
                },
                date: date
            };
        }
    }

    // Fetch multiple world records concurrently (batch of 40)
    async fetchWorldRecordsBatch(requests, progressCallback = null) {
        const batchSize = 40;
        const results = [];
        
        for (let i = 0; i < requests.length; i += batchSize) {
            const batch = requests.slice(i, i + batchSize);
            const batchPromises = batch.map(request => {
                if (request.date) {
                    return this.getWorldRecordForDate(
                        request.level, 
                        request.mode, 
                        request.count, 
                        request.speed, 
                        request.size, 
                        request.date
                    );
                } else {
                    return this.getWorldRecord(
                        request.level, 
                        request.mode, 
                        request.count, 
                        request.speed, 
                        request.size
                    );
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            // Update progress after each batch
            if (progressCallback) {
                progressCallback(results.length);
            }
        }
        
        return results;
    }
}

// Create global instance
window.worldRecordFetcher = new WorldRecordFetcher();
