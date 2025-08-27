const fs = require('fs');
const path = require('path');

// Read the template file
const templatePath = 'time-travel-cache/daily/2019/05/2019-05-31.json';
const templateData = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

// Generate dates for June 2019 (1-30)
const juneDates = [];
for (let day = 1; day <= 30; day++) {
    juneDates.push(`2019-06-${day.toString().padStart(2, '0')}`);
}

// Generate dates for July 1-4, 2019
const julyDates = [];
for (let day = 1; day <= 4; day++) {
    julyDates.push(`2019-07-${day.toString().padStart(2, '0')}`);
}

const allDates = [...juneDates, ...julyDates];

console.log(`📋 Creating cache files for ${allDates.length} dates:`);
console.log(`   June 2019: ${juneDates.length} dates`);
console.log(`   July 1-4, 2019: ${julyDates.length} dates`);

let createdCount = 0;
let skippedCount = 0;

for (const date of allDates) {
    const [year, month] = date.split('-');
    const dirPath = path.join('time-travel-cache/daily', year, month);
    const filePath = path.join(dirPath, `${date}.json`);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📁 Created directory: ${dirPath}`);
    }
    
    // Check if file already exists
    if (fs.existsSync(filePath)) {
        console.log(`⏭️  Skipping ${date} (file already exists)`);
        skippedCount++;
        continue;
    }
    
    // Create new data object with updated date and timestamp
    const newData = {
        ...templateData,
        date: date,
        timestamp: new Date().toISOString()
    };
    
    // Write the file
    fs.writeFileSync(filePath, JSON.stringify(newData, null, 2));
    console.log(`✅ Created: ${date}`);
    createdCount++;
}

console.log(`\n🎉 Copy operation complete!`);
console.log(`✅ Created: ${createdCount} files`);
console.log(`⏭️  Skipped: ${skippedCount} files (already existed)`);
console.log(`📊 Total processed: ${createdCount + skippedCount} files`);
