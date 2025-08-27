const fs = require('fs');
const path = require('path');

// Import the WorldRecordFetcher logic
class ClassicRecordFetcher {
    constructor() {
        this.gameID = 'o1y9pyk6'; // Google Snake game ID
        this.baseURL = 'https://www.speedrun.com/api/v1';
        this.cacheDir = 'time-travel-cache/daily';
        this.lastFailureTime = 0;
        this.failureDelay = 0;
        this.isGitHubActions = process.env.GITHUB_TOKEN !== undefined;
        this.rateLimitShown = false;
        this.apiOverloadShown = false;
    }

    // Create directory structure for the date
    createDateDirectory(date) {
        const [year, month] = date.split('-');
        const dirPath = path.join(this.cacheDir, year, month);
        
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        
        return path.join(dirPath, `${date}.json`);
    }

    // Check if cache already exists for a date
    cacheExists(date) {
        const filePath = this.createDateDirectory(date);
        return fs.existsSync(filePath);
    }

    // Game metadata cache
    gameMetadata = {
        variables: null,
        levels: null,
        categories: null,
        isInitialized: false
    };

    // Player data cache to avoid duplicate API calls
    playerCache = new Map();

    // Initialize game metadata
    async initializeGameMetadata() {
        if (this.gameMetadata.isInitialized) {
            return;
        }
        
        try {
            const [variables, levels, categories] = await Promise.all([
                this.fetchAPI(`${this.baseURL}/games/${this.gameID}/variables`),
                this.fetchAPI(`${this.baseURL}/games/${this.gameID}/levels`),
                this.fetchAPI(`${this.baseURL}/games/${this.gameID}/categories`)
            ]);
            
            this.gameMetadata.variables = variables;
            this.gameMetadata.levels = levels;
            this.gameMetadata.categories = categories;
            this.gameMetadata.isInitialized = true;
        } catch (error) {
            console.error('❌ Failed to initialize game metadata:', error);
            throw error;
        }
    }

    // Get cached metadata
    getGameMetadata() {
        if (!this.gameMetadata.isInitialized) {
            throw new Error('Game metadata not initialized. Call initializeGameMetadata() first.');
        }
        return this.gameMetadata;
    }

    // Fetch player data by ID (with caching)
    async getPlayerData(playerId) {
        if (this.playerCache.has(playerId)) {
            return this.playerCache.get(playerId);
        }

        try {
            const playerData = await this.fetchAPI(`${this.baseURL}/users/${playerId}`);
            
            if (playerData && playerData.data) {
                let playerName = null;
                
                if (playerData.data.names && playerData.data.names.international) {
                    playerName = playerData.data.names.international;
                } else if (playerData.data.name) {
                    playerName = playerData.data.name;
                }
                
                if (playerName && playerName.trim() !== "") {
                    const playerInfo = {
                        id: playerData.data.id,
                        name: playerName,
                        weblink: `https://www.speedrun.com/user/${playerName}`,
                        nameStyle: playerData.data["name-style"] || {
                            style: "solid",
                            color: { dark: "#ffffff" }
                        }
                    };
                    
                    this.playerCache.set(playerId, playerInfo);
                    return playerInfo;
                }
            }
            
            return null;
        } catch (error) {
            console.error(`Error fetching player data for ${playerId}:`, error);
            return null;
        }
    }

    // Simple API request function with infinite retry logic and 2-second cooldown
    async fetchAPI(url) {
        const now = Date.now();
        const timeSinceLastFailure = now - this.lastFailureTime;
        if (timeSinceLastFailure < this.failureDelay) {
            const waitTime = this.failureDelay - timeSinceLastFailure;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        let attempt = 1;
        
        while (true) {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'FastSnakeStats/1.0'
                    }
                });

                if (response.status === 429) {
                    if (!this.rateLimitShown) {
                        console.log(`⏳ API rate limiting detected, waiting...`);
                        this.rateLimitShown = true;
                    }
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    attempt++;
                    continue;
                }

                if (response.status === 420) {
                    if (!this.apiOverloadShown) {
                        console.log(`⏳ API overloaded, waiting...`);
                        this.apiOverloadShown = true;
                    }
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    attempt++;
                    continue;
                }

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                this.lastFailureTime = 0;
                return data;
                
            } catch (error) {
                console.error(`❌ API Call attempt ${attempt} failed:`, error.message);
                await new Promise(resolve => setTimeout(resolve, 2000));
                attempt++;
            }
        }
    }

    // Fetch a single Classic record
    async fetchClassicRecord(level, date) {
        try {
            const metadata = this.getGameMetadata();
            const variables = metadata.variables;
            const levels = metadata.levels;
            const categories = metadata.categories;
            
            // Find Classic level
            const levelData = levels.data.find(l => l.name.includes("Classic"));
            if (!levelData) {
                console.error(`❌ Classic level not found`);
                return {
                    success: false,
                    runs: [],
                    settings: ["1 Apple", "Normal", "Standard", 0, level],
                    error: `Classic level not found`
                };
            }
            
            // Find category
            const categoryName = `${level} Apples`;
            const categoryData = categories.data.find(c => c.name.includes(categoryName));
            if (!categoryData) {
                console.error(`❌ Category not found: ${categoryName}`);
                return {
                    success: false,
                    runs: [],
                    settings: ["1 Apple", "Normal", "Standard", 0, level],
                    error: `Category not found: ${categoryName}`
                };
            }
            
            // Build variable parameters for 1 Apple, Normal speed, Standard size
            const params = [];
            
            // Count variable - "Multi Apple Amount" = "1 Apple"
            const countVar = variables.data.find(v => v.name === "Multi Apple Amount");
            if (countVar && countVar.values && countVar.values.values) {
                const countValueEntry = Object.entries(countVar.values.values).find(([key, value]) => value.label === "1 Apple");
                if (countValueEntry) {
                    const [valueId, valueObj] = countValueEntry;
                    params.push(`var-${countVar.id}=${valueId}`);
                }
            }
            
            // Speed variables - "Normal"
            const speedVars = variables.data.filter(v => v.name === "Speed");
            for (let i = 0; i < speedVars.length; i++) {
                const sv = speedVars[i];
                if (sv.values && sv.values.values) {
                    const speedValueEntry = Object.entries(sv.values.values).find(([key, value]) => value.label === "Normal");
                    if (speedValueEntry) {
                        const [valueId, valueObj] = speedValueEntry;
                        params.push(`var-${sv.id}=${valueId}`);
                    }
                }
            }
            
            // Size variable - "Board Size" = "Standard"
            const sizeVar = variables.data.find(v => v.name === "Board Size");
            if (sizeVar && sizeVar.values && sizeVar.values.values) {
                const sizeValueEntry = Object.entries(sizeVar.values.values).find(([key, value]) => value.label === "Standard");
                if (sizeValueEntry) {
                    const [valueId, valueObj] = sizeValueEntry;
                    params.push(`var-${sizeVar.id}=${valueId}`);
                }
            }
            
            // Build leaderboard URL
            const leaderboardUrl = `${this.baseURL}/leaderboards/${this.gameID}/level/${levelData.id}/${categoryData.id}?top=1`;
            
            const validParams = params.filter(p => !p.includes('undefined'));
            let finalUrl = leaderboardUrl;
            if (validParams.length > 0) {
                finalUrl += "&" + validParams.join("&");
            }
            
            if (date) {
                finalUrl += `&date=${date}`;
            }
            
            const leaderboardData = await this.fetchAPI(finalUrl);
            
            if (leaderboardData && leaderboardData.data && leaderboardData.data.runs && leaderboardData.data.runs.length > 0) {
                const bestTime = leaderboardData.data.runs[0].run.times.primary;
                const tiedRuns = [];
                
                for (const run of leaderboardData.data.runs) {
                    if (run.run.times.primary === bestTime) {
                        let playerId = null;
                        let runData = null;
                        
                        if (run.run && run.run.players && Array.isArray(run.run.players) && run.run.players.length > 0) {
                            const playerRef = run.run.players[0];
                            
                            if (playerRef && playerRef.id) {
                                playerId = playerRef.id;
                                runData = run.run;
                            } else {
                                continue;
                            }
                        } else {
                            continue;
                        }
                        
                        const player = await this.getPlayerData(playerId);
                        
                        if (player) {
                            const processedRun = {
                                times: { primary: runData.times.primary },
                                date: runData.date,
                                id: runData.id,
                                weblink: runData.weblink,
                                players: {
                                    data: [{
                                        id: player.id,
                                        names: { international: player.name },
                                        weblink: `https://www.speedrun.com/user/${player.name}`,
                                        "name-style": player.nameStyle
                                    }]
                                },
                                values: runData.values || {}
                            };
                            
                            tiedRuns.push(processedRun);
                        }
                    } else {
                        break;
                    }
                }
                
                return {
                    success: true,
                    runs: tiedRuns,
                    settings: ["1 Apple", "Normal", "Standard", 0, level]
                };
            } else {
                return {
                    success: false,
                    runs: [],
                    settings: ["1 Apple", "Normal", "Standard", 0, level]
                };
            }
        } catch (error) {
            console.error(`❌ Error fetching Classic record for ${level} Apples:`, error.message);
            return {
                success: false,
                runs: [],
                settings: ["1 Apple", "Normal", "Standard", 0, level],
                error: error.message
            };
        }
    }

    // Generate date range
    generateDateRange(startDate, endDate) {
        const dates = [];
        const current = new Date(startDate);
        const end = new Date(endDate);
        
        while (current <= end) {
            dates.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }
        
        return dates;
    }

    // Save cache data
    async saveCacheData(date, data) {
        const filePath = this.createDateDirectory(date);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`💾 Cache saved for ${date}`);
    }

    // Main execution function
    async run() {
        const startDate = '2019-10-29';
        const endDate = '2019-12-31';
        
        console.log(`🎯 Fetching Classic records from ${startDate} to ${endDate}`);
        console.log(`📋 Only fetching: 1 Apple, Normal speed, Standard size for 50 and 100 Apples`);
        
        // Initialize game metadata
        await this.initializeGameMetadata();
        
        const dates = this.generateDateRange(startDate, endDate);
        console.log(`📅 Total dates to process: ${dates.length}`);
        
        let processedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < dates.length; i++) {
            const date = dates[i];
            
            try {
                if (this.cacheExists(date)) {
                    console.log(`📁 Cache already exists for ${date}, skipping...`);
                    skippedCount++;
                    continue;
                }
                
                console.log(`\n📅 Processing ${date} (${i + 1}/${dates.length})`);
                
                // Load template from 2019-10-28
                const templatePath = 'time-travel-cache/daily/2019/10/2019-10-28.json';
                const templateData = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
                
                // Create new cache data with updated date and timestamp
                const cacheData = {
                    date: date,
                    timestamp: new Date().toISOString(),
                    records: { ...templateData.records } // Copy all empty records
                };
                
                // Fetch only the Classic records we need
                const classicLevels = ['50', '100'];
                
                for (const level of classicLevels) {
                    console.log(`🔍 Fetching Classic ${level} Apples for ${date}...`);
                    const record = await this.fetchClassicRecord(level, date);
                    const key = `1 Apple|Normal|Standard|Classic|${level} Apples`;
                    cacheData.records[key] = record;
                }
                
                await this.saveCacheData(date, cacheData);
                processedCount++;
                
                // Small delay between dates
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`💥 Error processing ${date}:`, error);
                errorCount++;
            }
        }
        
        console.log(`\n🎉 Classic Records Fetch Complete!`);
        console.log(`✅ Processed: ${processedCount} dates`);
        console.log(`⏭️  Skipped: ${skippedCount} dates`);
        console.log(`❌ Errors: ${errorCount} dates`);
        
        process.exit(0);
    }
}

// Run the fetcher
const fetcher = new ClassicRecordFetcher();
fetcher.run();
