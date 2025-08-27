const fs = require('fs');
const path = require('path');

// Read the template file
const templatePath = 'time-travel-cache/daily/2019/07/2019-07-05.json';
const templateData = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

// Generate dates from 2019-07-06 to 2019-10-29
const dates = [];
const startDate = new Date('2019-07-06');
const endDate = new Date('2019-10-29');

const currentDate = new Date(startDate);
while (currentDate <= endDate) {
    const dateString = currentDate.toISOString().split('T')[0];
    dates.push(dateString);
    currentDate.setDate(currentDate.getDate() + 1);
}

console.log(`📋 Creating cache files for ${dates.length} dates:`);
console.log(`   From: 2019-07-06`);
console.log(`   To: 2019-10-29`);

let createdCount = 0;
let skippedCount = 0;

for (const date of dates) {
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
