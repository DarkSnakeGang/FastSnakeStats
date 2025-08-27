const { execSync } = require('child_process');
const path = require('path');

class MonthlyBackfill {
    constructor() {
        this.scriptPath = path.join(__dirname, 'historical-cache-backfill.js');
    }

    // Get the number of days in a month
    getDaysInMonth(year, month) {
        return new Date(year, month, 0).getDate();
    }

    // Validate month and year inputs
    validateInputs(year, month) {
        const yearNum = parseInt(year);
        const monthNum = parseInt(month);

        if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
            throw new Error('Invalid year. Please provide a year between 1900 and 2100.');
        }

        if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
            throw new Error('Invalid month. Please provide a month between 1 and 12.');
        }

        return { year: yearNum, month: monthNum };
    }

    // Format date with leading zeros
    formatDate(year, month, day) {
        const monthStr = month.toString().padStart(2, '0');
        const dayStr = day.toString().padStart(2, '0');
        return `${year}-${monthStr}-${dayStr}`;
    }

    // Run the backfill for a single date
    async runBackfillForDate(date) {
        try {
            console.log(`\n🔄 Running backfill for ${date}...`);
            const nodePath = process.platform === 'win32' ? 'C:\\Program Files\\nodejs\\node.exe' : 'node';
            execSync(`"${nodePath}" "${this.scriptPath}" ${date}`, { 
                stdio: 'inherit',
                cwd: path.dirname(path.dirname(this.scriptPath)) // Go to project root
            });
            console.log(`✅ Completed backfill for ${date}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to run backfill for ${date}:`, error.message);
            return false;
        }
    }

    // Main execution function
    async run() {
        const args = process.argv.slice(2);
        
        if (args.length !== 2) {
            console.log('Usage: node monthly-backfill.js <year> <month>');
            console.log('');
            console.log('Examples:');
            console.log('  node monthly-backfill.js 2024 1    # January 2024');
            console.log('  node monthly-backfill.js 2023 12   # December 2023');
            console.log('  node monthly-backfill.js 2025 2    # February 2025');
            console.log('');
            console.log('Note: This will run the historical cache backfill for every day in the specified month.');
            process.exit(1);
        }

        const [yearArg, monthArg] = args;

        try {
            // Validate inputs
            const { year, month } = this.validateInputs(yearArg, monthArg);
            
            // Get number of days in the month
            const daysInMonth = this.getDaysInMonth(year, month);
            
            console.log(`📅 Starting monthly backfill for ${year}-${month.toString().padStart(2, '0')}`);
            console.log(`📊 Total days to process: ${daysInMonth}`);
            
            let successCount = 0;
            let failureCount = 0;
            
            // Process each day of the month
            for (let day = 1; day <= daysInMonth; day++) {
                const date = this.formatDate(year, month, day);
                
                console.log(`\n--- Day ${day}/${daysInMonth} ---`);
                
                const success = await this.runBackfillForDate(date);
                
                if (success) {
                    successCount++;
                } else {
                    failureCount++;
                }
                
                // Add a small delay between days to be respectful to the API
                if (day < daysInMonth) {
                    console.log('⏳ Waiting 2 seconds before next day...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            
            console.log(`\n🎉 Monthly backfill complete!`);
            console.log(`✅ Successful: ${successCount} days`);
            console.log(`❌ Failed: ${failureCount} days`);
            console.log(`📊 Total processed: ${successCount + failureCount} days`);
            
        } catch (error) {
            console.error('❌ Error:', error.message);
            process.exit(1);
        }
    }
}

// Run the monthly backfill
const monthlyBackfill = new MonthlyBackfill();
monthlyBackfill.run();
