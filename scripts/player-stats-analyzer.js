const fs = require('fs');
const path = require('path');

class PlayerStatsAnalyzer {
    constructor() {
        this.cacheDir = 'time-travel-cache/daily';
        this.outputFile = 'time-travel-cache/metadata/player-stats.json';
        this.availableDatesFile = 'time-travel-cache/metadata/available-dates.json';
        this.playerStats = new Map(); // playerId -> stats
        this.dateStats = new Map(); // date -> { totalRecords, playerCounts }
    }

    // Load available dates
    loadAvailableDates() {
        try {
            const data = JSON.parse(fs.readFileSync(this.availableDatesFile, 'utf8'));
            return data.availableDates || [];
        } catch (error) {
            console.error('❌ Error loading available dates:', error.message);
            return [];
        }
    }

    // Get cache file path for a date
    getCacheFilePath(date) {
        const [year, month] = date.split('-');
        return path.join(this.cacheDir, year, month, `${date}.json`);
    }

    // Extract player ID from player data
    extractPlayerId(playerData) {
        if (playerData.rel === 'user') {
            return playerData.id;
        } else if (playerData.id) {
            return playerData.id;
        }
        return null;
    }

    // Extract player name from player data
    extractPlayerName(playerData) {
        if (playerData.names && playerData.names.international) {
            return playerData.names.international;
        } else if (playerData.name) {
            return playerData.name;
        }
        return 'Unknown Player';
    }

    // Process a single cache file
    processCacheFile(date) {
        try {
            const filePath = this.getCacheFilePath(date);
            if (!fs.existsSync(filePath)) {
                console.log(`⚠️  Cache file not found for ${date}`);
                return;
            }

            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const records = data.records || {};
            
            let totalRecordsForDate = 0;
            const playerCountsForDate = new Map();

            // Process each record category
            for (const [categoryKey, categoryData] of Object.entries(records)) {
                if (!categoryData.success || !categoryData.runs || categoryData.runs.length === 0) {
                    continue;
                }

                // Count records for this category
                totalRecordsForDate += categoryData.runs.length;

                // Process each run
                for (const run of categoryData.runs) {
                    if (!run.players || !run.players.data) {
                        continue;
                    }

                    // Process each player in the run
                    for (const playerData of run.players.data) {
                        const playerId = this.extractPlayerId(playerData);
                        if (!playerId) continue;

                        const playerName = this.extractPlayerName(playerData);

                        // Update player counts for this date
                        playerCountsForDate.set(playerId, (playerCountsForDate.get(playerId) || 0) + 1);

                        // Initialize player stats if not exists
                        if (!this.playerStats.has(playerId)) {
                            this.playerStats.set(playerId, {
                                id: playerId,
                                name: playerName,
                                totalRecords: 0,
                                datesWithRecords: new Set(),
                                dailyRecordCounts: new Map(), // date -> count
                                dailyRecordPercentages: new Map() // date -> percentage
                            });
                        }

                        const playerStat = this.playerStats.get(playerId);
                        playerStat.totalRecords++;
                        playerStat.datesWithRecords.add(date);
                    }
                }
            }

            // Store date statistics
            this.dateStats.set(date, {
                totalRecords: totalRecordsForDate,
                playerCounts: playerCountsForDate
            });

            // Update daily record counts and percentages for each player
            for (const [playerId, count] of playerCountsForDate) {
                const playerStat = this.playerStats.get(playerId);
                if (playerStat) {
                    playerStat.dailyRecordCounts.set(date, count);
                    const percentage = totalRecordsForDate > 0 ? (count / totalRecordsForDate) * 100 : 0;
                    playerStat.dailyRecordPercentages.set(date, percentage);
                }
            }

        } catch (error) {
            console.error(`❌ Error processing cache file for ${date}:`, error.message);
        }
    }

    // Calculate peak statistics for each player
    calculatePeakStats(latestDate) {
        const results = [];
        const latestDateStats = latestDate ? this.dateStats.get(latestDate) : null;
        const latestTotal = latestDateStats ? latestDateStats.totalRecords : 0;

        for (const [playerId, playerStat] of this.playerStats) {
            // Find date with most records
            let maxRecordsDate = null;
            let maxRecordsCount = 0;

            for (const [date, count] of playerStat.dailyRecordCounts) {
                // >= so ties keep the latest date (dates are processed earliest → latest)
                if (count >= maxRecordsCount) {
                    maxRecordsCount = count;
                    maxRecordsDate = date;
                }
            }

            // Find date with highest percentage
            let maxPercentageDate = null;
            let maxPercentage = 0;

            for (const [date, percentage] of playerStat.dailyRecordPercentages) {
                // >= so ties keep the latest date (dates are processed earliest → latest)
                if (percentage >= maxPercentage) {
                    maxPercentage = percentage;
                    maxPercentageDate = date;
                }
            }

            const latestCount = latestDate
                ? (playerStat.dailyRecordCounts.get(latestDate) || 0)
                : 0;
            const latestPercentage = latestTotal > 0
                ? Math.round((latestCount / latestTotal) * 10000) / 100
                : 0;

            results.push({
                id: playerId,
                name: playerStat.name,
                totalRecords: playerStat.totalRecords,
                totalDates: playerStat.datesWithRecords.size,
                peakRecords: {
                    date: maxRecordsDate,
                    count: maxRecordsCount
                },
                peakPercentage: {
                    date: maxPercentageDate,
                    percentage: Math.round(maxPercentage * 100) / 100 // Round to 2 decimal places
                },
                latest: {
                    date: latestDate || null,
                    count: latestCount,
                    percentage: latestPercentage
                }
            });
        }

        return results;
    }

    // Save results to file
    saveResults(results) {
        try {
            const outputData = {
                lastUpdated: new Date().toISOString(),
                totalPlayers: results.length,
                players: results.sort((a, b) => b.totalRecords - a.totalRecords) // Sort by total records descending
            };

            // Ensure output directory exists
            const outputDir = path.dirname(this.outputFile);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            fs.writeFileSync(this.outputFile, JSON.stringify(outputData, null, 2));
            console.log(`✅ Player statistics saved to ${this.outputFile}`);
            console.log(`📊 Analyzed ${results.length} players`);
        } catch (error) {
            console.error('❌ Error saving results:', error.message);
        }
    }

    // Main execution function
    async run() {
        console.log('🔍 Starting player statistics analysis...');
        
        // Load available dates
        const availableDates = this.loadAvailableDates();
        if (availableDates.length === 0) {
            console.error('❌ No available dates found');
            process.exit(1);
        }

        console.log(`📅 Found ${availableDates.length} dates to analyze`);

        // Process each date
        let processedCount = 0;
        for (const date of availableDates) {
            this.processCacheFile(date);
            processedCount++;
            
            if (processedCount % 50 === 0) {
                console.log(`📊 Processed ${processedCount}/${availableDates.length} dates...`);
            }
        }

        console.log(`✅ Processed all ${availableDates.length} dates`);

        // Calculate peak statistics
        console.log('📈 Calculating peak statistics...');
        const latestDate = availableDates[availableDates.length - 1];
        const results = this.calculatePeakStats(latestDate);

        // Save results
        this.saveResults(results);

        // Print summary
        console.log('\n📊 Analysis Summary:');
        console.log(`Total players analyzed: ${results.length}`);
        console.log(`Total dates processed: ${availableDates.length}`);
        
        if (results.length > 0) {
            const topPlayer = results[0];
            console.log(`Top player: ${topPlayer.name} (${topPlayer.totalRecords} total records)`);
            console.log(`Peak performance: ${topPlayer.peakRecords.count} records on ${topPlayer.peakRecords.date}`);
            console.log(`Peak percentage: ${topPlayer.peakPercentage.percentage}% on ${topPlayer.peakPercentage.date}`);
        }

        console.log('🎉 Player statistics analysis complete!');
    }
}

// Run the analyzer if this script is executed directly
if (require.main === module) {
    const analyzer = new PlayerStatsAnalyzer();
    analyzer.run().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = PlayerStatsAnalyzer;
