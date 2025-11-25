// Import the class from historical-cache-backfill.js
const HistoricalCacheBackfill = require('./historical-cache-backfill.js');

async function testSingleFetch() {
    console.log('🧪 Testing single fetch for: Classic, Normal speed, 10 Apples, level 25...\n');
    
    const backfill = new HistoricalCacheBackfill();
    
    // Initialize game metadata
    console.log('📡 Initializing game metadata...');
    await backfill.initializeGameMetadata();
    console.log('✅ Game metadata initialized\n');
    
    // Test combination: Classic (mode 0), Normal speed, 10 Apples, Standard size, level 25
    // Parameters: count, speed, size, mode, level, date
    const testDate = '2025-11-24';
    console.log(`🔍 Fetching world record for:`);
    console.log(`   Mode: Classic (0)`);
    console.log(`   Level: 25 Apples`);
    console.log(`   Count: 10 Apples`);
    console.log(`   Speed: Normal`);
    console.log(`   Size: Standard`);
    console.log(`   Date: ${testDate}\n`);
    
    try {
        const result = await backfill.fetchWorldRecord(
            '10 Apples',  // count
            'Normal',     // speed
            'Standard',   // size
            0,            // mode (Classic)
            '25',         // level
            testDate      // date
        );
        
        console.log('\n📊 Result:');
        console.log(JSON.stringify(result, null, 2));
        
        if (result.success && result.runs && result.runs.length > 0) {
            console.log('\n✅ SUCCESS: Found world record!');
            const firstRun = result.runs[0];
            if (firstRun.times && firstRun.times.primary) {
                console.log(`   Time: ${firstRun.times.primary}`);
            }
            if (firstRun.players && firstRun.players.data && firstRun.players.data[0]) {
                console.log(`   Player: ${firstRun.players.data[0].names.international || firstRun.players.data[0].id}`);
            }
        } else if (result.success === false && result.message) {
            console.log(`\n⚠️ ${result.message}`);
        } else {
            console.log('\n❌ No world record found for this combination');
        }
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
    }
    
    console.log('\n\n🧪 Testing single fetch for: Classic, Normal speed, Bomb, level 25...\n');
    
    try {
        const result2 = await backfill.fetchWorldRecord(
            'Bomb',      // count
            'Normal',    // speed
            'Standard',  // size
            0,           // mode (Classic)
            '25',        // level
            testDate     // date
        );
        
        console.log('\n📊 Result:');
        console.log(JSON.stringify(result2, null, 2));
        
        if (result2.success && result2.runs && result2.runs.length > 0) {
            console.log('\n✅ SUCCESS: Found world record!');
            const firstRun2 = result2.runs[0];
            if (firstRun2.times && firstRun2.times.primary) {
                console.log(`   Time: ${firstRun2.times.primary}`);
            }
            if (firstRun2.players && firstRun2.players.data && firstRun2.players.data[0]) {
                console.log(`   Player: ${firstRun2.players.data[0].names.international || firstRun2.players.data[0].id}`);
            }
        } else if (result2.success === false && result2.message) {
            console.log(`\n⚠️ ${result2.message}`);
        } else {
            console.log('\n❌ No world record found for this combination');
        }
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
    }
}

testSingleFetch().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

