const fs = require('fs');
const path = require('path');

class AvailableDatesGenerator {
    constructor() {
        // Determine the base directory - works in both local and GitHub Actions
        const isGitHubActions = process.env.GITHUB_WORKSPACE !== undefined;
        const baseDir = isGitHubActions ? process.env.GITHUB_WORKSPACE : path.join(__dirname, '..');
        
        this.cacheDir = path.join(baseDir, 'time-travel-cache', 'daily');
        this.metadataDir = path.join(baseDir, 'time-travel-cache', 'metadata');
        this.outputFile = path.join(this.metadataDir, 'available-dates.json');
        
        console.log(`🔧 Environment: ${isGitHubActions ? 'GitHub Actions' : 'Local Development'}`);
        console.log(`📁 Base directory: ${baseDir}`);
        console.log(`📁 Cache directory: ${this.cacheDir}`);
        console.log(`📁 Metadata directory: ${this.metadataDir}`);
    }

    // Scan the cache directory and find all available dates
    async scanAvailableDates() {
        const availableDates = [];
        
        try {
            // Check if cache directory exists
            if (!fs.existsSync(this.cacheDir)) {
                console.log('❌ Cache directory not found:', this.cacheDir);
                return availableDates;
            }

            console.log('🔍 Scanning cache directory:', this.cacheDir);
            
            // Get all year directories
            const yearDirs = fs.readdirSync(this.cacheDir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name)
                .filter(name => /^\d{4}$/.test(name)) // Only 4-digit year directories
                .sort();

            console.log(`📅 Found ${yearDirs.length} year directories:`, yearDirs);

            // Scan each year directory
            for (const year of yearDirs) {
                const yearPath = path.join(this.cacheDir, year);
                const monthDirs = fs.readdirSync(yearPath, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name)
                    .filter(name => /^\d{2}$/.test(name)) // Only 2-digit month directories
                    .sort();

                console.log(`  📆 Year ${year}: Found ${monthDirs.length} month directories`);

                // Scan each month directory
                for (const month of monthDirs) {
                    const monthPath = path.join(yearPath, month);
                    const dateFiles = fs.readdirSync(monthPath, { withFileTypes: true })
                        .filter(dirent => dirent.isFile())
                        .map(dirent => dirent.name)
                        .filter(name => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)) // Only date JSON files
                        .sort();

                    console.log(`    📅 Month ${month}: Found ${dateFiles.length} date files`);

                    // Extract dates from filenames
                    for (const filename of dateFiles) {
                        const date = filename.replace('.json', '');
                        availableDates.push(date);
                    }
                }
            }

            // Sort dates chronologically
            availableDates.sort();

            console.log(`✅ Found ${availableDates.length} available dates`);
            return availableDates;

        } catch (error) {
            console.error('❌ Error scanning cache directory:', error);
            return availableDates;
        }
    }

    // Generate the metadata object
    generateMetadata(availableDates) {
        if (availableDates.length === 0) {
            return {
                lastUpdated: new Date().toISOString(),
                totalDates: 0,
                availableDates: [],
                dateRange: {
                    earliest: null,
                    latest: null
                }
            };
        }

        return {
            lastUpdated: new Date().toISOString(),
            totalDates: availableDates.length,
            availableDates: availableDates,
            dateRange: {
                earliest: availableDates[0],
                latest: availableDates[availableDates.length - 1]
            }
        };
    }

    // Create metadata directory if it doesn't exist
    ensureMetadataDirectory() {
        if (!fs.existsSync(this.metadataDir)) {
            console.log('📁 Creating metadata directory:', this.metadataDir);
            fs.mkdirSync(this.metadataDir, { recursive: true });
        }
    }

    // Save the metadata file
    async saveMetadata(metadata) {
        try {
            this.ensureMetadataDirectory();
            
            const jsonContent = JSON.stringify(metadata, null, 2);
            fs.writeFileSync(this.outputFile, jsonContent);
            
            console.log('✅ Metadata file saved:', this.outputFile);
            console.log('📊 Summary:');
            console.log(`   Total dates: ${metadata.totalDates}`);
            console.log(`   Date range: ${metadata.dateRange.earliest} to ${metadata.dateRange.latest}`);
            console.log(`   Last updated: ${metadata.lastUpdated}`);
            
            return true;
        } catch (error) {
            console.error('❌ Error saving metadata file:', error);
            return false;
        }
    }

    // Main execution function
    async run() {
        console.log('🚀 Starting available dates generation...');
        console.log('');

        try {
            // Scan for available dates
            const availableDates = await this.scanAvailableDates();
            
            if (availableDates.length === 0) {
                console.log('⚠️  No available dates found. Creating empty metadata file.');
            }

            // Generate metadata
            const metadata = this.generateMetadata(availableDates);
            
            // Save metadata file
            const success = await this.saveMetadata(metadata);
            
            if (success) {
                console.log('');
                console.log('🎉 Available dates generation completed successfully!');
                console.log('');
                
                // Different next steps based on environment
                if (process.env.GITHUB_WORKSPACE) {
                    console.log('📋 GitHub Actions environment detected:');
                    console.log('   1. The metadata file has been updated in the repository');
                    console.log('   2. GitHub Pages will be updated automatically after push');
                    console.log('   3. The calendar feature will now show the correct available dates');
                } else {
                    console.log('📋 Next steps:');
                    console.log('   1. Commit the updated metadata file to your repository');
                    console.log('   2. Push to GitHub to update the GitHub Pages version');
                    console.log('   3. The calendar feature will now show the correct available dates');
                }
            } else {
                console.log('');
                console.log('❌ Available dates generation failed!');
                process.exit(1);
            }

        } catch (error) {
            console.error('❌ Unexpected error:', error);
            process.exit(1);
        }
    }
}

// Run the generator
const generator = new AvailableDatesGenerator();
generator.run();
