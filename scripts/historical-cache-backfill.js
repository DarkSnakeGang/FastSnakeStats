const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import the WorldRecordFetcher logic
class HistoricalCacheBackfill {
    constructor() {
        this.gameID = 'o1y9pyk6'; // Google Snake game ID
        this.baseURL = 'https://www.speedrun.com/api/v1';
        this.cacheDir = 'time-travel-cache/daily';
        this.lastFailureTime = 0;
        this.failureDelay = 0; // 5 seconds delay after failures
        this.isGitHubActions = process.env.GITHUB_TOKEN !== undefined;
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

    // Initialize game metadata (same as WorldRecordFetcher)
    async initializeGameMetadata() {
        if (this.gameMetadata.isInitialized) {
            console.log('🎮 Game metadata already initialized');
            return;
        }
        
        console.log('🎮 Initializing game metadata...');
        
        try {
            // Load all metadata in parallel
            const [variables, levels, categories] = await Promise.all([
                this.fetchAPI(`${this.baseURL}/games/${this.gameID}/variables`),
                this.fetchAPI(`${this.baseURL}/games/${this.gameID}/levels`),
                this.fetchAPI(`${this.baseURL}/games/${this.gameID}/categories`)
            ]);
            
            // Cache the metadata
            this.gameMetadata.variables = variables;
            this.gameMetadata.levels = levels;
            this.gameMetadata.categories = categories;
            this.gameMetadata.isInitialized = true;
            
            console.log('✅ Game metadata initialized successfully');
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
        // Check cache first
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
                    
                    // Cache the player data
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

    // Simple API request function with retry logic (same as WorldRecordFetcher)
    async fetchAPI(url, maxRetries = 20, baseDelay = 500) {
        // Only log API calls for debugging specific issues
        // console.log(`🌐 API Call: ${url}`);
        
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
                    console.log(`🔄 API Call Retry ${attempt}/${maxRetries}: ${url}`);
                }
                
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'FastSnakeStats/1.0'
                    }
                });

                if (response.status === 429) {
                    // Rate limited - wait longer
                    const retryAfter = response.headers.get('Retry-After');
                    const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : baseDelay * Math.pow(2, attempt);
                    console.log(`⏳ Rate limited, waiting ${waitTime}ms...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }

                if (response.status === 420) {
                    // API overloaded
                    this.lastFailureTime = Date.now();
                    throw new Error(`HTTP 420: API overloaded`);
                }

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                
                // Reset failure time on success
                this.lastFailureTime = 0;
                return data;
                
            } catch (error) {
                console.error(`❌ API Call attempt ${attempt} failed:`, error.message);
                
                if (attempt === maxRetries) {
                    this.lastFailureTime = Date.now();
                    throw error;
                }
                
                // Exponential backoff
                const delay = baseDelay * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // Fetch world records for a specific date (using WorldRecordFetcher's approach)
    async fetchWorldRecordsForDate(date) {
        console.log(`Fetching world records for ${date}...`);
        
        // Initialize game metadata first
        await this.initializeGameMetadata();
        
        // Define all possible combinations
        const combinations = [
            ['1 Apple', 'Normal', 'Standard'],
            ['1 Apple', 'Normal', 'Small'],
            ['1 Apple', 'Normal', 'Large'],
            ['1 Apple', 'Fast', 'Standard'],
            ['1 Apple', 'Fast', 'Small'],
            ['1 Apple', 'Fast', 'Large'],
            ['1 Apple', 'Slow', 'Standard'],
            ['1 Apple', 'Slow', 'Small'],
            ['1 Apple', 'Slow', 'Large'],
            ['3 Apples', 'Normal', 'Standard'],
            ['3 Apples', 'Normal', 'Small'],
            ['3 Apples', 'Normal', 'Large'],
            ['3 Apples', 'Fast', 'Standard'],
            ['3 Apples', 'Fast', 'Small'],
            ['3 Apples', 'Fast', 'Large'],
            ['3 Apples', 'Slow', 'Standard'],
            ['3 Apples', 'Slow', 'Small'],
            ['3 Apples', 'Slow', 'Large'],
            ['5 Apples', 'Normal', 'Standard'],
            ['5 Apples', 'Normal', 'Small'],
            ['5 Apples', 'Normal', 'Large'],
            ['5 Apples', 'Fast', 'Standard'],
            ['5 Apples', 'Fast', 'Small'],
            ['5 Apples', 'Fast', 'Large'],
            ['5 Apples', 'Slow', 'Standard'],
            ['5 Apples', 'Slow', 'Small'],
            ['5 Apples', 'Slow', 'Large'],
            ['Dice', 'Normal', 'Standard'],
            ['Dice', 'Normal', 'Small'],
            ['Dice', 'Normal', 'Large'],
            ['Dice', 'Fast', 'Standard'],
            ['Dice', 'Fast', 'Small'],
            ['Dice', 'Fast', 'Large'],
            ['Dice', 'Slow', 'Standard'],
            ['Dice', 'Slow', 'Small'],
            ['Dice', 'Slow', 'Large']
        ];

        // Use the same modes and levels as the website
        const modeNames = ["Classic", "Wall", "Portal", "Cheese", "Borderless", "Twin", "Winged", "Yin Yang", "Key", "Sokoban", "Poison", "Dimension", "Minesweeper", "Statue", "Light", "Shield", "Arrow", "Hotdog", "Magnet", "Gate", "Peaceful"];
        const levels = ["25", "50", "100", "All"];
        const highscoreLevels = ["H"]; // Only for highscore modes
        const highscoreModes = [1, 2, 8, 9, 10, 12, 13, 15, 17, 19, 3]; // Wall, Portal, Key, Sokoban, Poison, Minesweeper, Statue, Shield, Hotdog, Gate, Cheese
        
        const cacheData = {
            date: date,
            timestamp: new Date().toISOString(),
            records: {}
        };

        let totalRequests = 0;
        let completedRequests = 0;

        // Calculate total requests
        for (const combo of combinations) {
            // Regular level-based records for all modes
            for (let modeIndex = 0; modeIndex < modeNames.length; modeIndex++) {
                for (let levelIndex = 0; levelIndex < levels.length; levelIndex++) {
                    const level = levels[levelIndex];
                    // Skip "100 Apples" for "Small" size - this combination doesn't exist
                    if (level === "100" && combo[2] === "Small") {
                        continue;
                    }
                    totalRequests++;
                }
            }
            
            // Highscore records only for highscore modes
            for (let levelIndex = 0; levelIndex < highscoreLevels.length; levelIndex++) {
                for (let modeIndex = 0; modeIndex < highscoreModes.length; modeIndex++) {
                    totalRequests++;
                }
            }
        }

        console.log(`Total requests to process: ${totalRequests}`);

        // Process combinations concurrently with batching
        const allRequests = [];
        
        // Build all requests first
        for (const combo of combinations) {
            const [count, speed, size] = combo;
            
            // Regular level-based records for all modes
            for (let modeIndex = 0; modeIndex < modeNames.length; modeIndex++) {
                const modeName = modeNames[modeIndex];
                const mode = modeIndex;
                
                for (let levelIndex = 0; levelIndex < levels.length; levelIndex++) {
                    const level = levels[levelIndex];
                    
                    // Skip "100 Apples" for "Small" size - this combination doesn't exist
                    if (level === "100" && size === "Small") {
                        continue;
                    }
                    
                    allRequests.push({
                        count, speed, size, mode, level, date,
                        key: `${count}|${speed}|${size}|${modeName}|${level} Apples`
                    });
                }
            }
            
            // Highscore records only for highscore modes
            for (let levelIndex = 0; levelIndex < highscoreLevels.length; levelIndex++) {
                const level = highscoreLevels[levelIndex];
                for (let modeIndex = 0; modeIndex < highscoreModes.length; modeIndex++) {
                    const mode = highscoreModes[modeIndex];
                    
                    allRequests.push({
                        count, speed, size, mode, level, date,
                        key: `${count}|${speed}|${size}|${modeNames[mode]}|High Score`
                    });
                }
            }
        }
        
        // Process all requests concurrently with batching
        const batchSize = 10; // Process 10 requests concurrently
        console.log(`🚀 Processing ${allRequests.length} requests with ${batchSize} concurrent batches`);
        
        for (let i = 0; i < allRequests.length; i += batchSize) {
            const batch = allRequests.slice(i, i + batchSize);
            console.log(`\n--- Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allRequests.length/batchSize)} (requests ${i + 1}-${Math.min(i + batchSize, allRequests.length)}) ---`);
            
            const batchPromises = batch.map(async (request, batchIndex) => {
                try {
                    const record = await this.fetchWorldRecord(
                        request.count, request.speed, request.size, 
                        request.mode, request.level, request.date
                    );
                    
                    cacheData.records[request.key] = record;
                    completedRequests++;
                    
                    console.log(`✅ [${i + batchIndex + 1}/${allRequests.length}] Completed: ${request.key}`);
                    
                    return { success: true, key: request.key };
                } catch (error) {
                    console.error(`❌ [${i + batchIndex + 1}/${allRequests.length}] Error: ${request.key}`, error.message);
                    return { success: false, key: request.key, error: error.message };
                }
            });
            
            // Wait for all requests in this batch to complete
            const batchResults = await Promise.all(batchPromises);
            
            // Small delay between batches to be respectful to the API
            if (i + batchSize < allRequests.length) {
                console.log(`⏳ Waiting 1 second before next batch...`);
                await this.delay(0);
            }
        }

        return cacheData;
    }

    // Fetch a single world record (using WorldRecordFetcher's approach)
    async fetchWorldRecord(count, speed, size, mode, level, date) {
        try {
            // Step 1: Get cached game metadata
            const metadata = this.getGameMetadata();
            const variables = metadata.variables;
            const levels = metadata.levels;
            const categories = metadata.categories;
            
            // Step 2: Find the level ID for the mode (using includes like WorldRecordFetcher)
            const modeNames = ["Classic", "Wall", "Portal", "Cheese", "Borderless", "Twin", "Winged", "Yin Yang", "Key", "Sokoban", "Poison", "Dimension", "Minesweeper", "Statue", "Light", "Shield", "Arrow", "Hotdog", "Magnet", "Gate", "Peaceful"];
            const modeName = modeNames[mode];
            
            const levelData = levels.data.find(l => l.name.includes(modeName));
            if (!levelData) {
                console.error(`❌ Level not found for mode: ${modeName}`);
                return {
                    success: false,
                    runs: [],
                    settings: [count, speed, size, mode, level],
                    error: `Level not found for mode: ${modeName}`
                };
            }
            
            // Step 3: Find the category ID (using includes like WorldRecordFetcher)
            const categoryName = level === "H" ? modeName : `${level} Apples`;
            const categoryData = categories.data.find(c => c.name.includes(categoryName));
            if (!categoryData) {
                console.error(`❌ Category not found: ${categoryName}`);
                return {
                    success: false,
                    runs: [],
                    settings: [count, speed, size, mode, level],
                    error: `Category not found: ${categoryName}`
                };
            }
            
            console.log(`✅ Found level: ${levelData.name} (ID: ${levelData.id})`);
            console.log(`✅ Found category: ${categoryData.name} (ID: ${categoryData.id})`);
            
            // Step 4: Build variable parameters (exactly like WorldRecordFetcher)
            const params = [];
            
            // Count variable - "Multi Apple Amount"
            const countVar = variables.data.find(v => v.name === "Multi Apple Amount");
            if (countVar && countVar.values && countVar.values.values) {
                const countValueEntry = Object.entries(countVar.values.values).find(([key, value]) => value.label === count);
                if (countValueEntry) {
                    const [valueId, valueObj] = countValueEntry;
                    params.push(`var-${countVar.id}=${valueId}`);
                }
            }
            
            // Speed variables - add all Speed variables
            const speedVars = variables.data.filter(v => v.name === "Speed");
            for (let i = 0; i < speedVars.length; i++) {
                const sv = speedVars[i];
                if (sv.values && sv.values.values) {
                    const speedValueEntry = Object.entries(sv.values.values).find(([key, value]) => value.label === speed);
                    if (speedValueEntry) {
                        const [valueId, valueObj] = speedValueEntry;
                        params.push(`var-${sv.id}=${valueId}`);
                    }
                }
            }
            
            // Size variable - "Board Size"
            const sizeVar = variables.data.find(v => v.name === "Board Size");
            if (sizeVar && sizeVar.values && sizeVar.values.values) {
                const sizeValueEntry = Object.entries(sizeVar.values.values).find(([key, value]) => value.label === size);
                if (sizeValueEntry) {
                    const [valueId, valueObj] = sizeValueEntry;
                    params.push(`var-${sizeVar.id}=${valueId}`);
                }
            }
            
            console.log(`🔧 Variable parameters: ${params.join(', ')}`);
            
            // Step 5: Build leaderboard URL
            let leaderboardUrl;
            if (level === "H") {
                leaderboardUrl = `${this.baseURL}/leaderboards/${this.gameID}/category/${categoryData.id}?top=10`;
            } else {
                leaderboardUrl = `${this.baseURL}/leaderboards/${this.gameID}/level/${levelData.id}/${categoryData.id}?top=10`;
            }
            
            // Only add parameters if they have valid values (not undefined)
            const validParams = params.filter(p => !p.includes('undefined'));
            if (validParams.length > 0) {
                leaderboardUrl += "&" + validParams.join("&");
            }
            
            // Add date parameter if specified
            if (date) {
                leaderboardUrl += `&date=${date}`;
            }
            
            // Step 6: Get leaderboard
            console.log(`🔍 Fetching: ${leaderboardUrl}`);
            const leaderboardData = await this.fetchAPI(leaderboardUrl);
            console.log(`📊 Response structure:`, {
                hasData: !!leaderboardData.data,
                hasRuns: !!leaderboardData.data?.runs,
                runsLength: leaderboardData.data?.runs?.length || 0,
                firstRun: leaderboardData.data?.runs?.[0] ? 'exists' : 'missing'
            });
            
            // Check if we got a successful response with runs
            if (leaderboardData && leaderboardData.data && leaderboardData.data.runs && leaderboardData.data.runs.length > 0) {
                // Get the best time from the first run
                const bestTime = leaderboardData.data.runs[0].run.times.primary;
                
                // Filter runs to only include those with the same best time (tied world records)
                const tiedRuns = [];
                
                for (const run of leaderboardData.data.runs) {
                    if (run.run.times.primary === bestTime) {
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
                        // Stop when we find a run with a different time
                        break;
                    }
                }
                
                return {
                    success: true,
                    runs: tiedRuns,
                    settings: [count, speed, size, mode, level]
                };
            } else {
                return {
                    success: false,
                    runs: [],
                    settings: [count, speed, size, mode, level]
                };
            }
        } catch (error) {
            console.error(`❌ Error fetching record for ${count} ${speed} ${size} ${mode} ${level}:`, error.message);
            return {
                success: false,
                runs: [],
                settings: [count, speed, size, mode, level],
                error: error.message
            };
        }
    }

    // Utility function to add delay
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
        console.log(`Saved cache for ${date}`);
        
        // Upload to GitHub if running in GitHub Actions
        await this.uploadToGitHub(date);
    }

    // Save progress to a checkpoint file
    saveCheckpoint(startDate, endDate, lastProcessedDate, processedCount, skippedCount, errorCount) {
        const checkpointData = {
            startDate,
            endDate,
            lastProcessedDate,
            processedCount,
            skippedCount,
            errorCount,
            timestamp: new Date().toISOString()
        };
        
        fs.writeFileSync('backfill-checkpoint.json', JSON.stringify(checkpointData, null, 2));
        console.log(`Checkpoint saved: ${lastProcessedDate}`);
    }

    // Load progress from checkpoint file
    loadCheckpoint() {
        if (fs.existsSync('backfill-checkpoint.json')) {
            try {
                const checkpointData = JSON.parse(fs.readFileSync('backfill-checkpoint.json', 'utf8'));
                console.log(`Found checkpoint from ${checkpointData.timestamp}`);
                console.log(`Last processed date: ${checkpointData.lastProcessedDate}`);
                console.log(`Progress: ${checkpointData.processedCount} processed, ${checkpointData.skippedCount} skipped, ${checkpointData.errorCount} errors`);
                return checkpointData;
            } catch (error) {
                console.log('Error reading checkpoint file, starting fresh');
                return null;
            }
        }
        return null;
    }

    // Clear checkpoint file
    clearCheckpoint() {
        if (fs.existsSync('backfill-checkpoint.json')) {
            fs.unlinkSync('backfill-checkpoint.json');
            console.log('Checkpoint cleared');
        }
    }

    // GitHub upload functionality
    async uploadToGitHub(date) {
        if (!this.isGitHubActions || !process.env.GITHUB_ACTIONS) {
            console.log('Not running in GitHub Actions, skipping upload');
            return;
        }

        try {
            console.log('📤 Uploading to GitHub...');
            
            // Configure git
            execSync('git config --local user.email "action@github.com"', { stdio: 'inherit' });
            execSync('git config --local user.name "GitHub Action"', { stdio: 'inherit' });
            
            // Add the cache file
            const cachePath = this.createDateDirectory(date);
            execSync(`git add "${cachePath}"`, { stdio: 'inherit' });
            
            // Commit the changes
            const commitMessage = `Add cache data for ${date}`;
            execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
            
            // Push to repository
            execSync('git push', { stdio: 'inherit' });
            
            console.log('✅ Successfully uploaded to GitHub');
        } catch (error) {
            console.error('❌ Failed to upload to GitHub:', error.message);
            // Don't throw error, just log it
        }
    }

    // Get yesterday's date
    getYesterdayDate() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    }

    // Main execution function
    async run() {
        const args = process.argv.slice(2);
        
        if (args.length === 0) {
            console.log('Usage: node historical-cache-backfill.js <start-date> <end-date> [--force] [--resume] [--clear-checkpoint]');
            console.log('   OR: node historical-cache-backfill.js <single-date> [--force]');
            console.log('   OR: node historical-cache-backfill.js --yesterday [--force]');
            console.log('');
            console.log('Examples:');
            console.log('  node historical-cache-backfill.js 2024-01-01 2024-01-31');
            console.log('  node historical-cache-backfill.js 2024-01-15 --force');
            console.log('  node historical-cache-backfill.js --yesterday');
            console.log('');
            console.log('Options:');
            console.log('  --force           Overwrite existing cache files');
            console.log('  --resume          Resume from last checkpoint (default behavior)');
            console.log('  --clear-checkpoint Clear checkpoint and start fresh');
            console.log('  --yesterday       Fetch yesterday\'s data');
            process.exit(1);
        }
        
        let startDate, endDate;
        const forceOverwrite = args.includes('--force');
        const clearCheckpoint = args.includes('--clear-checkpoint');
        const isYesterday = args.includes('--yesterday');
        
        // Handle different input formats
        if (isYesterday) {
            startDate = this.getYesterdayDate();
            endDate = startDate;
            console.log(`Fetching yesterday's data: ${startDate}`);
        } else if (args.length === 1) {
            // Single date
            startDate = args[0];
            endDate = startDate;
            console.log(`Fetching single date: ${startDate}`);
        } else {
            // Date range
            startDate = args[0];
            endDate = args[1];
            console.log(`Fetching date range: ${startDate} to ${endDate}`);
        }
        
        // Clear checkpoint if requested
        if (clearCheckpoint) {
            this.clearCheckpoint();
        }
        
        // For single date or yesterday, don't use checkpoint system
        const isSingleDate = startDate === endDate;
        
        // Load checkpoint (unless cleared or single date)
        let checkpoint = null;
        if (!clearCheckpoint && !isSingleDate) {
            checkpoint = this.loadCheckpoint();
        }
        
        // Validate checkpoint matches current parameters (only for date ranges)
        if (checkpoint && !isSingleDate && (checkpoint.startDate !== startDate || checkpoint.endDate !== endDate)) {
            console.log('Checkpoint parameters do not match current arguments');
            console.log(`Checkpoint: ${checkpoint.startDate} to ${checkpoint.endDate}`);
            console.log(`Current: ${startDate} to ${endDate}`);
            console.log('Use --clear-checkpoint to start fresh');
            process.exit(1);
        }
        
        const dates = this.generateDateRange(startDate, endDate);
        console.log(`Total dates to process: ${dates.length}`);
        
        let processedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        
        // For single date, process directly
        if (isSingleDate) {
            const date = dates[0];
            
            try {
                if (this.cacheExists(date) && !forceOverwrite) {
                    console.log(`Cache already exists for ${date}, skipping...`);
                    console.log('Use --force to overwrite existing cache');
                    process.exit(0);
                }
                
                console.log(`\n--- Processing ${date} ---`);
                const cacheData = await this.fetchWorldRecordsForDate(date);
                await this.saveCacheData(date, cacheData);
                processedCount++;
                
                console.log(`\n--- Single Date Complete ---`);
                console.log(`Processed: ${processedCount} dates`);
                console.log(`Skipped: ${skippedCount} dates`);
                console.log(`Errors: ${errorCount} dates`);
                
                process.exit(0);
            } catch (error) {
                console.error(`Error processing ${date}:`, error);
                process.exit(1);
            }
        }
        
        // For date ranges, use checkpoint system
        processedCount = checkpoint ? checkpoint.processedCount : 0;
        skippedCount = checkpoint ? checkpoint.skippedCount : 0;
        errorCount = checkpoint ? checkpoint.errorCount : 0;
        
        // Find starting point
        let startIndex = 0;
        if (checkpoint && checkpoint.lastProcessedDate) {
            const lastProcessedIndex = dates.indexOf(checkpoint.lastProcessedDate);
            if (lastProcessedIndex !== -1) {
                startIndex = lastProcessedIndex + 1;
                console.log(`Resuming from date ${dates[startIndex]} (${startIndex + 1}/${dates.length})`);
            }
        }
        
        const remainingDates = dates.slice(startIndex);
        console.log(`Remaining dates to process: ${remainingDates.length}`);
        
        for (let i = 0; i < remainingDates.length; i++) {
            const date = remainingDates[i];
            const globalIndex = startIndex + i;
            
            try {
                if (this.cacheExists(date) && !forceOverwrite) {
                    console.log(`Cache already exists for ${date}, skipping...`);
                    skippedCount++;
                    this.saveCheckpoint(startDate, endDate, date, processedCount, skippedCount, errorCount);
                    continue;
                }
                
                console.log(`\n--- Processing ${date} (${globalIndex + 1}/${dates.length}) ---`);
                const cacheData = await this.fetchWorldRecordsForDate(date);
                await this.saveCacheData(date, cacheData);
                processedCount++;
                
                // Save checkpoint after each successful date
                this.saveCheckpoint(startDate, endDate, date, processedCount, skippedCount, errorCount);
                
                // Add delay between dates to be respectful
                await this.delay(0);
                
            } catch (error) {
                console.error(`Error processing ${date}:`, error);
                errorCount++;
                
                // Save checkpoint even on error
                this.saveCheckpoint(startDate, endDate, date, processedCount, skippedCount, errorCount);
                
                // Continue with next date even if one fails
                await this.delay(0);
            }
        }
        
        // Clear checkpoint on successful completion
        this.clearCheckpoint();
        
        console.log(`\n--- Backfill Complete ---`);
        console.log(`Processed: ${processedCount} dates`);
        console.log(`Skipped: ${skippedCount} dates`);
        console.log(`Errors: ${errorCount} dates`);
        
        process.exit(0);
    }
}

// Run the backfill
const backfill = new HistoricalCacheBackfill();
backfill.run();
