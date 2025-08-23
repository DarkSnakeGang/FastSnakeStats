const fs = require('fs');
const path = require('path');

class MetadataUpdater {
    constructor() {
        this.cacheDir = 'time-travel-cache/daily';
        this.metadataDir = 'metadata';
    }

    // Create metadata directory if it doesn't exist
    ensureMetadataDir() {
        if (!fs.existsSync(this.metadataDir)) {
            fs.mkdirSync(this.metadataDir, { recursive: true });
        }
    }

    // Scan all cache files and build metadata
    async scanCacheFiles() {
        const availableDates = [];
        const yearStats = {};
        
        if (!fs.existsSync(this.cacheDir)) {
            console.log('Cache directory does not exist yet');
            return { availableDates, yearStats };
        }

        // Recursively scan the cache directory
        const scanDirectory = (dir) => {
            const items = fs.readdirSync(dir);
            
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    scanDirectory(fullPath);
                } else if (item.endsWith('.json')) {
                    // Extract date from file path
                    const relativePath = path.relative(this.cacheDir, fullPath);
                    const dateMatch = relativePath.match(/(\d{4})\/(\d{2})\/(\d{4}-\d{2}-\d{2})\.json$/);
                    
                    if (dateMatch) {
                        const year = dateMatch[1];
                        const month = dateMatch[2];
                        const date = dateMatch[3];
                        
                        availableDates.push(date);
                        
                        // Build year statistics
                        if (!yearStats[year]) {
                            yearStats[year] = {
                                totalDays: 0,
                                months: {}
                            };
                        }
                        
                        if (!yearStats[year].months[month]) {
                            yearStats[year].months[month] = 0;
                        }
                        
                        yearStats[year].totalDays++;
                        yearStats[year].months[month]++;
                    }
                }
            }
        };

        scanDirectory(this.cacheDir);
        
        // Sort dates chronologically
        availableDates.sort();
        
        return { availableDates, yearStats };
    }

    // Create available dates index
    createAvailableDatesIndex(availableDates) {
        const indexData = {
            lastUpdated: new Date().toISOString(),
            totalDates: availableDates.length,
            availableDates: availableDates,
            dateRange: availableDates.length > 0 ? {
                earliest: availableDates[0],
                latest: availableDates[availableDates.length - 1]
            } : null
        };
        
        const indexPath = path.join(this.metadataDir, 'available-dates.json');
        fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2));
        console.log(`Updated available dates index: ${availableDates.length} dates`);
    }

    // Create year statistics
    createYearStats(yearStats) {
        const statsData = {
            lastUpdated: new Date().toISOString(),
            years: yearStats,
            summary: {
                totalYears: Object.keys(yearStats).length,
                totalDays: Object.values(yearStats).reduce((sum, year) => sum + year.totalDays, 0)
            }
        };
        
        const statsPath = path.join(this.metadataDir, 'year-statistics.json');
        fs.writeFileSync(statsPath, JSON.stringify(statsData, null, 2));
        console.log(`Updated year statistics: ${statsData.summary.totalYears} years, ${statsData.summary.totalDays} total days`);
    }

    // Create README for the cache directory
    createCacheReadme(availableDates, yearStats) {
        const readmeContent = `# Time Travel Cache

This directory contains historical world records data for Google Snake, organized by date.

## Structure

\`\`\`
time-travel-cache/
├── daily/
│   ├── 2024/
│   │   ├── 01/
│   │   │   ├── 2024-01-15.json
│   │   │   └── 2024-01-16.json
│   │   └── 02/
│   │       └── 2024-02-01.json
│   └── ...
└── metadata/
    ├── available-dates.json
    └── year-statistics.json
\`\`\`

## Statistics

- **Total Dates Available**: ${availableDates.length}
- **Date Range**: ${availableDates.length > 0 ? `${availableDates[0]} to ${availableDates[availableDates.length - 1]}` : 'No data'}
- **Years Covered**: ${Object.keys(yearStats).length}

## File Format

Each JSON file contains world records for a specific date in the following format:

\`\`\`json
{
  "date": "2024-01-15",
  "timestamp": "2024-01-16T00:00:00.000Z",
  "records": {
    "1 Apple|Normal|Standard|Any%|1 Apples": {
      "success": true,
      "runs": [...],
      "settings": ["1 Apple", "Normal", "Standard", "Any%", "1"]
    }
  }
}
\`\`\`

## Usage

This cache is automatically updated daily by GitHub Actions and can be accessed by FastSnakeStats for time travel functionality.

Last updated: ${new Date().toISOString()}
`;

        const readmePath = path.join(this.cacheDir, 'README.md');
        fs.writeFileSync(readmePath, readmeContent);
        console.log('Updated cache README');
    }

    // Main execution function
    async run() {
        try {
            console.log('Starting metadata update...');
            
            this.ensureMetadataDir();
            
            const { availableDates, yearStats } = await this.scanCacheFiles();
            
            this.createAvailableDatesIndex(availableDates);
            this.createYearStats(yearStats);
            this.createCacheReadme(availableDates, yearStats);
            
            console.log('Metadata update completed successfully');
            process.exit(0);
        } catch (error) {
            console.error('Error updating metadata:', error);
            process.exit(1);
        }
    }
}

// Run the updater
const updater = new MetadataUpdater();
updater.run();


