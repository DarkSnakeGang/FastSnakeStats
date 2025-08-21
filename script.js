const gameIDs = ["o1y9pyk6", "9dow0go1"];
const maxRanglistLength = 17;
var categories = [];
var variables = [];
var levels = [];
var mode = 0;    //0 = main, 1 = cat, 2 = custom;
var requestsMade = 0;
var maxdate = undefined;
var firstdate = undefined;
//nog text toevoegen voor alts!
//test opmaak geen runmode
var appleAmounts = {"1 Apple":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v3/count_00.png",id:"count_00"},
                    "3 Apples":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v3/count_01.png",id:"count_01"},
                    "5 Apples":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v3/count_02.png",id:"count_02"},
		    "Dice":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v17/count_03.png",id:"count_03"}};
var speeds =       {"Normal":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v3/speed_00.png",id:"speed_00"},
                    "Slow":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v3/speed_02.png",id:"speed_01"},
                    "Fast":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v3/speed_01.png",id:"speed_02"}};
var sizes =        {"Standard":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v4/size_00.png",id:"size_00"},
                    "Small":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v4/size_01.png",id:"size_01"},
                    "Large":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v4/size_02.png",id:"size_02"}};
var gamemodes =    {"Classic":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v16/trophy_00.png",id:"trophy_01"},
                    "Wall":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v16/trophy_01.png",id:"trophy_02"},
                    "Portal":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v16/trophy_02.png",id:"trophy_03"},
                    "Cheese":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v16/trophy_03.png",id:"trophy_04"},
                    "Borderless":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v16/trophy_04.png",id:"trophy_5"},
                    "Twin":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v16/trophy_05.png",id:"trophy_06"},
                    "Winged":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v16/trophy_06.png",id:"trophy_07"},
                    "Yin Yang":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v16/trophy_07.png",id:"trophy_08"},
                    "Key":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v16/trophy_08.png",id:"trophy_09"},
                    "Sokoban":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v16/trophy_09.png",id:"trophy_10"},
                    "Poison":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v16/trophy_10.png",id:"trophy_11"},
                    "Dimension":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v16/trophy_11.png",id:"trophy_12"},
                    "Minesweeper":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v16/trophy_12.png",id:"trophy_13"},
		    "Statue":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v16/trophy_13.png",id:"trophy_14"},
		    "Light":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v16/trophy_14.png",id:"trophy_15"},
		    "Shield":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v17/trophy_15.png",id:"trophy_16"},
		    "Arrow":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v18/trophy_16.png",id:"trophy_17"},
		    "Hotdog":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v19/trophy_17.png",id:"trophy_18"},
		    "Magnet":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v20/trophy_18.png",id:"trophy_19"},
		    "Gate":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v21/trophy_19.png",id:"trophy_20"},
                    "Peaceful":{visible:true,icon:"https://www.google.com/logos/fnbx/snake_arcade/v18/trophy_17.png",id:"trophy_21"}};
var runModes =     {"25 Apples":{visible:true,icon:null,text:"25 Apples",id:"mode_00"},
                    "50 Apples":{visible:true,icon:null,text:"50 Apples",id:"mode_01"},
                    "100 Apples":{visible:true,icon:null,text:"100 Apples",id:"mode_02"},
                    "All Apples":{visible:true,icon:null,text:"All Apples",id:"mode_03"},
                    "High Score":{visible:true,icon:null,text:"High Score",id:"mode_04"}};
var runs = [];
var bestRuns = [];
var date = "";
var ranglist = [];
var players = [];
var showAmount = false;
var currentTableSettings = ["1 Apple", "Normal", "Standard"]; // Default table settings
var worldRecords = {}; // Store world records data
var isDarkMode = false; // Default to light mode

// Load settings from localStorage
function loadSettings() {
    // Load showAmount setting
    if(localStorage.getItem('showAmount') == null){
        localStorage.setItem('showAmount', showAmount);
    } else {
        showAmount = localStorage.getItem('showAmount');
        if(showAmount == "true"){
            showAmount = true;
        } else {
            showAmount = false;
        }
    }
    
    // Load dark mode setting
    if(localStorage.getItem('darkMode') == null){
        localStorage.setItem('darkMode', isDarkMode);
    } else {
        isDarkMode = localStorage.getItem('darkMode') === 'true';
        if(isDarkMode) {
            document.body.classList.add('dark-mode');
        }
    }
    
    // Load table settings
    if(localStorage.getItem('tableSettings') == null){
        localStorage.setItem('tableSettings', JSON.stringify(currentTableSettings));
    } else {
        try {
            currentTableSettings = JSON.parse(localStorage.getItem('tableSettings'));
        } catch(e) {
            console.log("Error loading table settings, using defaults");
            currentTableSettings = ["1 Apple", "Normal", "Standard"];
        }
    }
    
    // Load visibility settings
    if(localStorage.getItem('visibilitySettings') != null) {
        try {
            var visibilitySettings = JSON.parse(localStorage.getItem('visibilitySettings'));
            
            // Apply visibility settings
            if(visibilitySettings.gamemodes) {
                for(var gamemode in visibilitySettings.gamemodes) {
                    if(gamemodes[gamemode]) {
                        gamemodes[gamemode].visible = visibilitySettings.gamemodes[gamemode];
                    }
                }
            }
            if(visibilitySettings.appleAmounts) {
                for(var appleAmount in visibilitySettings.appleAmounts) {
                    if(appleAmounts[appleAmount]) {
                        appleAmounts[appleAmount].visible = visibilitySettings.appleAmounts[appleAmount];
                    }
                }
            }
            if(visibilitySettings.speeds) {
                for(var speed in visibilitySettings.speeds) {
                    if(speeds[speed]) {
                        speeds[speed].visible = visibilitySettings.speeds[speed];
                    }
                }
            }
            if(visibilitySettings.sizes) {
                for(var size in visibilitySettings.sizes) {
                    if(sizes[size]) {
                        sizes[size].visible = visibilitySettings.sizes[size];
                    }
                }
            }
            if(visibilitySettings.runModes) {
                for(var runMode in visibilitySettings.runModes) {
                    if(runModes[runMode]) {
                        runModes[runMode].visible = visibilitySettings.runModes[runMode];
                    }
                }
            }
        } catch(e) {
            console.log("Error loading visibility settings, using defaults");
        }
    }
}

// Save settings to localStorage
function saveSettings() {
    localStorage.setItem('showAmount', showAmount);
    localStorage.setItem('darkMode', isDarkMode);
    localStorage.setItem('tableSettings', JSON.stringify(currentTableSettings));
    
    // Save visibility settings for all options
    var visibilitySettings = {
        gamemodes: {},
        appleAmounts: {},
        speeds: {},
        sizes: {},
        runModes: {}
    };
    
    for(var gamemode in gamemodes) {
        visibilitySettings.gamemodes[gamemode] = gamemodes[gamemode].visible;
    }
    for(var appleAmount in appleAmounts) {
        visibilitySettings.appleAmounts[appleAmount] = appleAmounts[appleAmount].visible;
    }
    for(var speed in speeds) {
        visibilitySettings.speeds[speed] = speeds[speed].visible;
    }
    for(var size in sizes) {
        visibilitySettings.sizes[size] = sizes[size].visible;
    }
    for(var runMode in runModes) {
        visibilitySettings.runModes[runMode] = runModes[runMode].visible;
    }
    
    localStorage.setItem('visibilitySettings', JSON.stringify(visibilitySettings));
}

// Toggle dark mode
function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    if(isDarkMode) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    saveSettings();
    
    // Update toggle button icon
    const toggleBtn = document.querySelector('.dark-mode-toggle');
    if(toggleBtn) {
        toggleBtn.innerHTML = isDarkMode ? '☀️' : '🌙';
    }
}

// Initialize settings
loadSettings();

// Initialize WorldRecordFetcher
if (typeof WorldRecordFetcher !== 'undefined') {
    window.worldRecordFetcher = new WorldRecordFetcher();
} else {
    console.error("WorldRecordFetcher not loaded!");
}

// Update table selector after settings are loaded
document.addEventListener('DOMContentLoaded', function() {
    // Set current date in info modal
    const today = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const dateString = today.toLocaleDateString('en-US', options);
    const dateElement = document.getElementById('currentDate');
    if(dateElement) {
        dateElement.textContent = dateString;
    }
    
    // Update table selector to reflect loaded settings
    setTimeout(() => {
        updateTableSelector();
    }, 100);
});

function generateRunHolder(list){
    //generate list that hold sorted runs in 5d dimensional array (bad coding practice but idc)
    /*  Runs is a 5d dimensional array allowing to sort runs for all game combinations
        1st: appleAmounts
        2nd: speeds
        3rd: sizes
        4th: gamemodes
        5th: runModes
    */
    for(appleAmount in appleAmounts){
        list[appleAmount] = [];
        for(speed in speeds){
            list[appleAmount][speed] = [];
            for(size in sizes){
                list[appleAmount][speed][size] = [];
                for(gamemode in gamemodes){
                    list[appleAmount][speed][size][gamemode] = [];
                    for(runMode in runModes){
                        if(runMode == "100 Apples" && size == "Small"){continue;}    //no 100 apples in small;
                        if(runMode == "69 Apples" && speed != "Slow"){continue;}       //only slow had 69 Apples
                        list[appleAmount][speed][size][gamemode][runMode] = [];
                    }
                }
            }
        }
    }
}

function getSettingsFromRun(run){
    var myAppleAmount = undefined;
    var mySpeed = undefined;
    var mySize = undefined;
    var myRunMode = undefined;
    var myGamemode = undefined;

    var level = levels.find(x => x.id == run.level);
    var category = categories.find(x => x.id == run.category);
    var values = [];
    for(value in run.values){
        values[variables.find(x => x.id == value).name] = variables.find(x => x.id == value).values.values[run.values[value]].label;
    }

    //appleAmount in values
    for(value in values){
        if(value.toLowerCase().indexOf("amount") != -1){
            for(appleAmount in appleAmounts){
                if(values[value].indexOf(appleAmount) != -1){
                    myAppleAmount = appleAmount;
                }
            }
        }
    }

    //size in values
    for(value in values){
        if(value.toLowerCase().indexOf("size") != -1){
            for(size in sizes){
                if(values[value].indexOf(size) != -1){
                    mySize = size;
                }
            }
        }
    }

    //gamemode can be in level name
    if(typeof(level) != "undefined"){
        for(gamemode in gamemodes){
            if(level.name.indexOf(gamemode) != -1){
                myGamemode = gamemode;
            }
        }
    }
    //gamemode of highscore runs are in category
    if(typeof(category) != "undefined" && typeof(myGamemode) == 'undefined'){
        for(gamemode in gamemodes){
            if(category.name.indexOf(gamemode) != -1){
                myGamemode = gamemode;
            }
        }
    }
    //or in values for 69 runs
    if(typeof(myGamemode) == 'undefined'){
        for(value in values){
            if(value.toLowerCase().indexOf('mode') != -1){
                for(gamemode in gamemodes){
                    if(values[value].indexOf(gamemode) != -1){
                        myGamemode = gamemode;
                    }
                }
            }
        }
    }

    //runMode depends on category
    if(typeof(category) != "undefined"){
        for(runMode in runModes){
            if(category.name.indexOf(runMode) != -1){
                myRunMode = runMode;
            }            
        }
        if(typeof(myRunMode) == 'undefined'){
            if(category.name.indexOf("High") != -1){            //set highscores to all apples
                myRunMode = "All Apples";
            }
        }
    }

    //speed can be in level name
    if(typeof(level) != "undefined"){
        for(speed in speeds){
            if(level.name.indexOf(speed) != -1){
                mySpeed = speed;
            }
        }
    }
    //or in values
    if(typeof(mySpeed) == 'undefined'){
        for(value in values){
            if(value.toLowerCase().indexOf('speed') != -1){
                for(speed in speeds){
                    if(values[value].indexOf(speed) != -1){
                        mySpeed = speed;
                    }
                }
            }
        }
    }
    //or in category
    if(typeof(mySpeed) == 'undefined'){
        if(typeof(category) != "undefined"){
            for(speed in speeds){
                if(category.name.indexOf(speed) != -1){
                    mySpeed = speed;
                }
            }
        }
    }
    //or slow if runmode is 69 Apples
    if(typeof(mySpeed) == 'undefined'){
        if(myRunMode == "69 Apples"){
            mySpeed = "Slow";
        }
    }

    return [myAppleAmount, mySpeed, mySize, myGamemode, myRunMode];
}

function sleepFor(sleepDuration){
    var now = new Date().getTime();
    while(new Date().getTime() < now + sleepDuration){ 
        /* Do nothing */ 
    }
}

function makeAPIrequest(requestURL, callback){
    // Add id to solve query issue
    hasQuery = requestURL.includes("?")
    url = requestURL
    if(hasQuery){
        url += "&"
    }
    else{
        url += "?"
    }
    url += "_=" + new Date().getTime()
    console.log("Making API request to:", url);

    let request = new XMLHttpRequest();
	request.open("GET", url);
    
    // Add proper headers for API requests
    request.setRequestHeader('Accept', 'application/json');
    
    request.onload = function(){
        if(request.status == 200){
            requestsMade+=1;
            try {
                let response = JSON.parse(request.response);
                callback(response);
            } catch(e) {
                console.log("Error parsing JSON response:", e);
                console.log("Response was:", request.response);
                // Return empty data on parse error
                callback({data: []});
            }
        }
        else if(request.status == 429) {
            // Rate limited - wait and retry
            console.log("Rate limited, waiting 5 seconds...");
            setTimeout(() => {
                makeAPIrequest(requestURL, callback);
            }, 5000);
        }
        else{
            console.log("API request failed:", request.status, request.statusText);
            console.log("Failed URL:", url);
            
            // Retry with exponential backoff
            if(requestsMade < 5) {
                let delay = Math.pow(2, requestsMade) * 1000; // 1s, 2s, 4s, 8s
                console.log("Retrying in", delay, "ms...");
                setTimeout(() => {
                    makeAPIrequest(requestURL, callback);
                }, delay);
            } else {
                console.log("Too many failed requests, stopping retries");
                callback({data: []}); // Return empty data to continue
            }
        }
    }
    request.onerror = function() {
        console.log("API request network error for URL:", url);
        
        // Retry with exponential backoff
        if(requestsMade < 5) {
            let delay = Math.pow(2, requestsMade) * 1000;
            console.log("Network error, retrying in", delay, "ms...");
            setTimeout(() => {
                makeAPIrequest(requestURL, callback);
            }, delay);
        } else {
            console.log("Too many network errors, stopping retries");
            callback({data: []}); // Return empty data to continue
        }
    }
    
    // Add timeout
    request.timeout = 10000; // 10 second timeout
    request.ontimeout = function() {
        console.log("API request timeout for URL:", url);
        if(requestsMade < 3) {
            console.log("Retrying after timeout...");
            setTimeout(() => {
                makeAPIrequest(requestURL, callback);
            }, 2000);
        } else {
            callback({data: []});
        }
    }
    
    request.send();
}

function getGameDetails(callback){
    var amount = 3 * gameIDs.length;
    var i = 0
    var ifDone = function(){
        i+=1;
        if(i == amount){
            callback();
        }
    }
    
    // Test the API first to see what's working
    console.log("Testing API endpoints...");
    
    for(gameID of gameIDs){
        // Try the new API structure
        makeAPIrequest("https://www.speedrun.com/api/v1/games/"+gameID+"/variables", (x) => {
            console.log("Variables response:", x);
            if(x.data) {
                variables.push.apply(variables, x.data);
            }
            ifDone();
        });
        makeAPIrequest("https://www.speedrun.com/api/v1/games/"+gameID+"/categories?embed=game", (x) => {
            console.log("Categories response:", x);
            if(x.data) {
                categories.push.apply(categories, x.data);
            }
            ifDone();
        });
        makeAPIrequest("https://www.speedrun.com/api/v1/games/"+gameID+"/levels", (x) => {
            console.log("Levels response:", x);
            if(x.data) {
                levels.push.apply(levels, x.data);
            }
            ifDone();
        });
    }
}

function getWorldRecords(gameID, callback){
    var count = 0;
    var total = 0;

    for(category of categories){
        if(category.game.data.id == gameID){
            total +=1;
        }
    }

    var ifdone = function(){
        count+=1;
        if(count == total){
            callback();
        }
    }

    for(category of categories){
        if(category.game.data.id == gameID){
            getWorldRecordsForCategory(gameID, ifdone, category.id);
        }
    }
}

function getWorldRecordsForCategory(gameID, callback, categoryId){
    // Fetch multiple records to find the best one for each combination
    console.log("Fetching records for category:", categoryId, "game:", gameID);
    makeAPIrequest("https://www.speedrun.com/api/v1/runs?game="+gameID+"&max=50&embed=players&status=verified&category="+categoryId, (x) => {
        if(x.data && x.data.length > 0){
            console.log("Got", x.data.length, "records for category", categoryId);
            
            // Process all runs to find the best one for each combination
            var bestRunsForCategory = {};
            
            for(var i = 0; i < x.data.length; i++){
                var run = x.data[i];
                var settings = getSettingsFromRun(run);
                if(settings.indexOf(undefined) == -1){
                    try{
                        var key = settings[0] + "|" + settings[1] + "|" + settings[2] + "|" + settings[3] + "|" + settings[4];
                        
                        // Only store if we don't have a record for this combination yet, or if this run is better (faster)
                        if(!bestRunsForCategory[key] || run.times.primary_t < bestRunsForCategory[key].times.primary_t){
                            bestRunsForCategory[key] = run;
                        }
                    }
                    catch(e){
                        console.log("Error processing run:", e);
                    }
                }
            }
            
            // Store the best runs for this category
            for(var key in bestRunsForCategory){
                worldRecords[key] = bestRunsForCategory[key];
                
                var run = bestRunsForCategory[key];
                if(typeof(players[run.players.data[0].names.international]) == 'undefined'){
                    players[run.players.data[0].names.international] = run.players.data[0].id;
                }
            }
            
            console.log("Stored", Object.keys(bestRunsForCategory).length, "best records for category", categoryId);
        } else {
            console.log("No data received for category:", categoryId);
        }
        if(typeof(callback) != "undefined"){
            callback();
        }
    });
}

// Legacy SpeedInfo.js integration functions - kept for compatibility but not used

// Unified refresh function for world records
async function refreshWorldRecordsForSettings() {
    if (isLoading) return; // Prevent multiple simultaneous refreshes
    
    console.log("🔄 Refreshing world records for current settings:", currentTableSettings);
    
    // Set loading state
    setLoadingState(true);
    
    // Clear existing records to ensure fresh data
    worldRecords = {};
    
    // Generate empty table immediately to show structure
    generateSingleTable();
    
    try {
        // Ensure settings are saved before proceeding
        saveSettings();
        
        // Fetch fresh world records for the current settings
        await getAllWorldRecordsForCurrentSettings();
        
        // Update button highlighting with a small delay to ensure DOM is ready
        setTimeout(() => {
            updateTableSelector();
        }, 50);
        
    } catch (error) {
        console.error("❌ Error refreshing world records:", error);
        var container = document.querySelector('.container');
        if(container) {
            container.innerHTML = '<p style="color: white; font-size: 18px; text-align: center; padding: 20px;">❌ Error refreshing world records. Please try again.</p>';
        }
    } finally {
        // Always clear loading state
        setLoadingState(false);
    }
}

// SpeedInfo.js time conversion function
function convertSpeedInfoTime(duration) {
    const regex = /PT(?:(\d+)H)?(?:(\d+)M)?([\d.]+)S/;
    const matches = duration.match(regex);

    let convertedTime = '';

    if (matches[1]) {
        convertedTime += matches[1] + 'h';
    }

    if (matches[2]) {
        convertedTime += matches[2] + 'm';
    }

    const seconds = parseFloat(matches[3]);

    if (seconds > 0 || convertedTime === '') {
        const wholeSeconds = Math.floor(seconds);
        convertedTime += wholeSeconds + 's';

        const milliseconds = Math.round((seconds - wholeSeconds) * 1000);

        if (milliseconds > 0) {
            convertedTime += milliseconds + 'ms';
        }
    }

    if (convertedTime.includes('h')) {
        convertedTime = convertedTime.split('s')[0] + "s";
    }

    return convertedTime;
}

function calculateBestRuns(callback){
    generateRunHolder(bestRuns);
    
    // Process world records directly
    for(var key in worldRecords){
        var run = worldRecords[key];
        var settings = key.split("|");
        var appleAmount = settings[0];
        var speed = settings[1];
        var size = settings[2];
        var gamemode = settings[3];
        var runMode = settings[4];
        
        try{
            bestRuns[appleAmount][speed][size][gamemode][runMode] = [run];
            
            // Track dates for historical features
            var rundate = new Date(run.date);
            if(firstdate == undefined){
                firstdate = rundate;
            }
            else if(rundate < firstdate){
                firstdate = rundate;
            }
        }
        catch{//non valid combination
        }
    }
    
    if(typeof(callback) != "undefined"){
        callback();
    }
}

function roundNumber(num, scale) {
  if(!("" + num).includes("e")) {
    return +(Math.round(num + "e+" + scale)  + "e-" + scale);
  } else {
    var arr = ("" + num).split("e");
    var sig = ""
    if(+arr[1] + scale > 0) {
      sig = "+";
    }
    return +(Math.round(+arr[0] + "e" + sig + (+arr[1] + scale)) + "e-" + scale);
  }
}

function calculateRanglist(){
    ranglist = [];
    
    // Count world records per player
    for(var key in worldRecords){
        var run = worldRecords[key];
        var settings = key.split("|");
        var appleAmount = settings[0];
        var speed = settings[1];
        var size = settings[2];
        var gamemode = settings[3];
        var runMode = settings[4];
        
        // Check if this combination is visible
        if(appleAmounts[appleAmount].visible && 
           speeds[speed].visible && 
           sizes[size].visible && 
           gamemodes[gamemode].visible && 
           runModes[runMode].visible){
            
            var id = run.players.data[0].id;
            if(typeof(ranglist[id]) == 'undefined'){
                ranglist[id] = [1, run.players.data[0]];
            }
            else{
                ranglist[id][0] += 1;
            }
        }
    }
    
    //calculate total
    total = 0;
    for(user in ranglist){
        total += ranglist[user][0];
    }
    //calculate percentages
    if(total != 0){
        for(user in ranglist){
            ranglist[user][2] = roundNumber(ranglist[user][0]*100/total,2);
        }
    }

    ranglist = ranglist.sort(function(a, b){return b-a});
}

function createIconElement(setting){
    if(setting.icon == null){
        return document.createTextNode(setting.text);
    }
    else{
        var img = document.createElement('img');
        img.setAttribute('src',setting.icon);
        img.setAttribute('alt',setting.text);
        return img;
    }
}

function createTimeElement(times){
    ptformatter = function primaryTimeFormatter(pt){
        pt = pt.replace("PT","");
        if(pt.indexOf("M") == -1){
            pt = "0M"+pt;
        }
        if(pt.indexOf("S") == -1){
            pt = pt+"0.000S";
        }
        else if(pt.indexOf(".") == -1){
            pt = pt.substring(0,pt.indexOf("S")) +".000S";
        }
        pt = pt.replace("H","<small>h </small>");
        pt = pt.replace("M","<small>m </small>");
        pt = pt.replace(".","<small>s </small>");
        pt = pt.replace("S","<small>ms</small>");
        return pt;
    }

    atformatter = function appleTimeFormatter(pt){
        while(pt.indexOf("PT0.0") != -1){
            pt = pt.replace("PT0.0","PT0.");
        }
        pt = pt.replace("PT0.","");
        pt = pt.replace("S","");
        return pt+ " Apples";
    }

    var span = document.createElement('span');
    span.setAttribute('class','time');
    var text;
    if(times.primary_t < 1){
        text = atformatter(times.primary);
    }
    else{
        text = ptformatter(times.primary);
    }
    span.innerHTML = text;
    return span;
}

function createNameElement(user){
    console.log("createNameElement called with user:", user);
    console.log("user['name-style']:", user["name-style"]);
    console.log("user.weblink:", user.weblink);
    
    var span = document.createElement('span');
    span.setAttribute('class', 'name');
    var a = document.createElement('a');
    a.setAttribute('href', user.weblink);
    a.setAttribute('target','_blank');
    if(user.rel == "user"){
        span.appendChild(document.createTextNode(user.names.international));
        // Add safety check for name-style property
        if(user["name-style"] && user["name-style"].style == "gradient"){
            var colorfrom = user["name-style"]["color-from"].dark;
            var colorto = user["name-style"]["color-to"].dark;
            console.log("Applying gradient colors:", colorfrom, "to", colorto);
            // Apply gradient using CSS - try a more compatible approach
            span.style.background = `linear-gradient(90deg, ${colorfrom}, ${colorto})`;
            span.style.webkitBackgroundClip = "text";
            span.style.webkitTextFillColor = "transparent";
            span.style.backgroundClip = "text";
            span.style.color = "transparent";
            span.style.display = "inline-block"; // Ensure the gradient works
        }
        else if(user["name-style"] && user["name-style"]["color"]){
            var color = user["name-style"]["color"].dark;
            console.log("Applying solid color:", color);
            // Apply solid color
            span.style.color = color;
        }
        else{
            // Default colors if name-style is missing
            console.log("No name-style found, using default white");
            span.style.color = "#ffffff";
        }
    }
    else{
        span.appendChild(document.createTextNode(user.name))
        span.style.color = "#000000";
    }

    console.log("Applied styling to span:", span.style.cssText);
    a.appendChild(span);
    return a;
}

function generateLeaderboard(settings){
    var table = document.createElement('table');
    table.setAttribute('class','leaderboard');

    //calculate stuff
    var thisBoardRunModes = [];
    var thisBoardRuns = bestRuns[settings[0]][settings[1]][settings[2]];
    
    // Check if we have data for this combination
    if(!thisBoardRuns){
        console.log("No data for combination:", settings);
        return;
    }
    
         // Find all run modes that have data for this combination
     const highscoreModes = ["Wall", "Portal", "Key", "Sokoban", "Poison", "Minesweeper", "Statue", "Shield", "Hotdog", "Gate", "Cheese"];
     
     for(gamemode in thisBoardRuns){
         if(gamemodes[gamemode].visible){
             for(runMode in thisBoardRuns[gamemode]){
                 // Only show "High Score" column for highscore modes
                 if(runMode === "High Score" && !highscoreModes.includes(gamemode)){
                     continue;
                 }
                 if(runModes[runMode].visible && thisBoardRunModes.indexOf(runMode) == -1){
                     thisBoardRunModes.push(runMode);
                 }
             }
         }
     }
    
    //create thead
    var thead = document.createElement('thead');
    var row;
    var th;
    var td;
    row = document.createElement('tr');
    th = document.createElement('th');
    th.setAttribute('class', 'settingsRow');
    th.setAttribute('colspan', thisBoardRunModes.length+1);
    th.appendChild(createIconElement(appleAmounts[settings[0]]));
    th.appendChild(createIconElement(speeds[settings[1]]));
    th.appendChild(createIconElement(sizes[settings[2]]));
    row.appendChild(th);
    thead.appendChild(row);

    row = document.createElement('tr');
    row.appendChild(document.createElement('th'));
    for(runMode of thisBoardRunModes){
        let th = document.createElement('th');
        th.appendChild(createIconElement(runModes[runMode]));
        row.appendChild(th);
    }
    thead.appendChild(row);
    table.appendChild(thead);

    //creat tbody
    var tbody = document.createElement('tbody');
    for(gamemode in thisBoardRuns){
        if(gamemodes[gamemode].visible){
            row = document.createElement('tr');
            th = document.createElement('th');
            th.appendChild(createIconElement(gamemodes[gamemode]));
            row.appendChild(th);

            for(runMode of thisBoardRunModes){
                td = document.createElement('td');
                if(typeof(thisBoardRuns[gamemode][runMode]) != 'undefined'){
                    td.setAttribute('class','result');
                    if(thisBoardRuns[gamemode][runMode].length != 0){
                        var a = document.createElement('a');
                        a.setAttribute('href', thisBoardRuns[gamemode][runMode][0].weblink);
                        a.setAttribute('target','_blank');
                        a.appendChild(createTimeElement(thisBoardRuns[gamemode][runMode][0].times));
                        for(run of thisBoardRuns[gamemode][runMode]){
                            a.appendChild(createNameElement(run.players.data[0]))
                        }
                        td.appendChild(a);
                    }
                }
                row.appendChild(td);
            }
            tbody.appendChild(row);

        }
    }
    table.appendChild(tbody);

    // Create a wrapper for better centering
    var tableWrapper = document.createElement('div');
    tableWrapper.setAttribute('class', 'table-wrapper main-table-wrapper');
    tableWrapper.appendChild(table);

    document.getElementsByClassName("container")[0].appendChild(tableWrapper);
}

function generateSingleTable(){
    // Clear existing content
    removeLeaderboards();
    
    // Only generate table if we have data
    if(Object.keys(worldRecords).length > 0) {
        generateLeaderboard(currentTableSettings);
        // Also generate the ranglist (summary table)
        calculateRanglist();
        generateRanglist();
    } else {
        // Show a message that data is loading
        var container = document.querySelector('.container');
        if(container) {
            container.innerHTML = '<p style="color: white; font-size: 18px;">Loading world records...</p>';
        }
    }
}

function generateTableSelector(){
    // Create dark mode toggle button (only if it doesn't exist)
    var existingToggle = document.querySelector('.dark-mode-toggle');
    if(!existingToggle) {
        var darkModeToggle = document.createElement('button');
        darkModeToggle.setAttribute('class', 'dark-mode-toggle');
        darkModeToggle.innerHTML = isDarkMode ? '☀️' : '🌙';
        darkModeToggle.onclick = toggleDarkMode;
        darkModeToggle.setAttribute('title', isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode');
        document.body.appendChild(darkModeToggle);
    }
    
    // Create sidebar for table selection
    var sidebar = document.createElement('div');
    sidebar.setAttribute('class', 'table-selector');
    		sidebar.innerHTML = '<h3>Category Settings</h3>';
    
    // Apple Amount selector
    var appleSelector = document.createElement('div');
    appleSelector.innerHTML = '<label>Apple Amount:</label>';
    var appleButtonGroup = document.createElement('div');
    appleButtonGroup.setAttribute('class', 'button-group');
    for(var appleAmount in appleAmounts){
        if(appleAmounts[appleAmount].visible){
            var button = document.createElement('button');
            button.setAttribute('class', 'table-option-btn');
            // Set active class based on current settings
            if(currentTableSettings[0] === appleAmount){
                button.classList.add('active');
            }
                         button.onclick = function(amount){
                return async function(){
                    if (isLoading) return; // Prevent clicks while loading
                    currentTableSettings[0] = amount;
                    saveSettings(); // Save settings when changed
                    // Update highlighting immediately
                    updateTableSelector();
                    // Refresh world records for the new settings
                    await refreshWorldRecordsForSettings();
                    generateSingleTable();
                };
            }(appleAmount);
            
            // Add icon instead of text
            var icon = createIconElement(appleAmounts[appleAmount]);
            button.appendChild(icon);
            button.setAttribute('data-setting', appleAmount);
            appleButtonGroup.appendChild(button);
        }
    }
    appleSelector.appendChild(appleButtonGroup);
    sidebar.appendChild(appleSelector);
    
    // Speed selector
    var speedSelector = document.createElement('div');
    speedSelector.innerHTML = '<label>Speed:</label>';
    var speedButtonGroup = document.createElement('div');
    speedButtonGroup.setAttribute('class', 'button-group');
    for(var speed in speeds){
        if(speeds[speed].visible){
            var button = document.createElement('button');
            button.setAttribute('class', 'table-option-btn');
            // Set active class based on current settings
            if(currentTableSettings[1] === speed){
                button.classList.add('active');
            }
                         button.onclick = function(spd){
                return async function(){
                    if (isLoading) return; // Prevent clicks while loading
                    currentTableSettings[1] = spd;
                    saveSettings(); // Save settings when changed
                    // Update highlighting immediately
                    updateTableSelector();
                    // Refresh world records for the new settings
                    await refreshWorldRecordsForSettings();
                    generateSingleTable();
                };
            }(speed);
            
            // Add icon instead of text
            var icon = createIconElement(speeds[speed]);
            button.appendChild(icon);
            button.setAttribute('data-setting', speed);
            speedButtonGroup.appendChild(button);
        }
    }
    speedSelector.appendChild(speedButtonGroup);
    sidebar.appendChild(speedSelector);
    
    // Size selector
    var sizeSelector = document.createElement('div');
    sizeSelector.innerHTML = '<label>Size:</label>';
    var sizeButtonGroup = document.createElement('div');
    sizeButtonGroup.setAttribute('class', 'button-group');
    for(var size in sizes){
        if(sizes[size].visible){
            var button = document.createElement('button');
            button.setAttribute('class', 'table-option-btn');
            // Set active class based on current settings
            if(currentTableSettings[2] === size){
                button.classList.add('active');
            }
                         button.onclick = function(sz){
                return async function(){
                    if (isLoading) return; // Prevent clicks while loading
                    currentTableSettings[2] = sz;
                    saveSettings(); // Save settings when changed
                    // Update highlighting immediately
                    updateTableSelector();
                    // Refresh world records for the new settings
                    await refreshWorldRecordsForSettings();
                    generateSingleTable();
                };
            }(size);
            
            // Add icon instead of text
            var icon = createIconElement(sizes[size]);
            button.appendChild(icon);
            button.setAttribute('data-setting', size);
            sizeButtonGroup.appendChild(button);
        }
    }
    sizeSelector.appendChild(sizeButtonGroup);
    sidebar.appendChild(sizeSelector);
    
    // Add refresh button
    var refreshSelector = document.createElement('div');
    refreshSelector.innerHTML = '<label>World Records:</label>';
    var refreshButtonGroup = document.createElement('div');
    refreshButtonGroup.setAttribute('class', 'button-group');
    
    var refreshButton = document.createElement('button');
    refreshButton.setAttribute('class', 'table-option-btn refresh-btn');
    refreshButton.innerHTML = '🔄 Refresh';
    refreshButton.onclick = refreshWorldRecordsForSettings;
    refreshButtonGroup.appendChild(refreshButton);
    refreshSelector.appendChild(refreshButtonGroup);
    sidebar.appendChild(refreshSelector);
    
    // Add sidebar to page
    var existingSidebar = document.querySelector('.table-selector');
    if(existingSidebar){
        existingSidebar.remove();
    }
    document.body.insertBefore(sidebar, document.querySelector('.container'));
}

function updateTableSelector(){
    console.log("🔄 Updating table selector with current settings:", currentTableSettings);
    
    // Get the latest settings from localStorage to ensure we're using the most current values
    try {
        var savedSettings = JSON.parse(localStorage.getItem('tableSettings'));
        if(savedSettings && Array.isArray(savedSettings) && savedSettings.length === 3) {
            currentTableSettings = savedSettings;
            console.log("📥 Loaded settings from localStorage:", currentTableSettings);
        }
    } catch(e) {
        console.log("⚠️ Error loading settings from localStorage, using current settings");
    }
    
    // Update active states of buttons
    var buttons = document.querySelectorAll('.table-option-btn');
    console.log("🔍 Found", buttons.length, "buttons to update");
    
    // First, remove all active classes
    buttons.forEach(function(button){
        button.classList.remove('active');
    });
    
    // Then add active class to matching buttons
    buttons.forEach(function(button, index){
        // Skip refresh button
        if(button.classList.contains('refresh-btn')) {
            return;
        }
        
        // Check if this button corresponds to current settings using data-setting attribute
        var settingValue = button.getAttribute('data-setting');
        if(settingValue) {
            // Check if this button matches any of the current settings
            if(settingValue === currentTableSettings[0] || 
               settingValue === currentTableSettings[1] || 
               settingValue === currentTableSettings[2]){
                button.classList.add('active');
                console.log("✅ Activated button for setting:", settingValue);
            }
        }
    });
    
    // Also update the refresh button state
    var refreshButton = document.querySelector('.refresh-btn');
    if (refreshButton && !isLoading) {
        refreshButton.disabled = false;
        refreshButton.innerHTML = '🔄 Refresh';
        refreshButton.setAttribute('title', 'Refresh world records for current settings');
    }
    
    // Log the final state for debugging
    var activeButtons = document.querySelectorAll('.table-option-btn.active');
    console.log("🎯 Final active buttons count:", activeButtons.length);
    
    // Double-check that we have the right number of active buttons (should be 3: count, speed, size)
    if(activeButtons.length !== 3) {
        console.warn("⚠️ Expected 3 active buttons, but found", activeButtons.length);
        console.log("Current settings:", currentTableSettings);
    }
}

// Add loading state management
var isLoading = false;

function setLoadingState(loading) {
    isLoading = loading;
    var buttons = document.querySelectorAll('.table-option-btn');
    buttons.forEach(function(button) {
        if (loading) {
            button.disabled = true;
            button.style.opacity = '0.5';
            button.style.cursor = 'not-allowed';
            button.setAttribute('title', 'Loading world records...');
        } else {
            button.disabled = false;
            button.style.opacity = '1';
            button.style.cursor = 'pointer';
            button.removeAttribute('title');
        }
    });
    
    // Update refresh button text
    var refreshButton = document.querySelector('.refresh-btn');
    if (refreshButton) {
        if (loading) {
            refreshButton.innerHTML = '⏳ Loading...';
            refreshButton.disabled = true;
            refreshButton.setAttribute('title', 'Please wait while world records are being fetched...');
        } else {
            refreshButton.innerHTML = '🔄 Refresh';
            refreshButton.disabled = false;
            refreshButton.setAttribute('title', 'Refresh world records for current settings');
        }
    }
    
    // Don't show loading message - table will be updated live instead
}

function generateRanglist(){
    var table = document.createElement('table');
    table.setAttribute('class', 'ranglist mode'+mode);
    var thead = document.createElement('thead');
    var row = document.createElement('tr');
    var th = document.createElement('th');
    th.setAttribute('colspan', 2);
    th.appendChild(createIconElement(gamemodes['Classic']));
    row.appendChild(th);
    thead.appendChild(row);
    table.append(thead);

    var i = 0;
    var tbody = document.createElement('tbody');
    var values = []
    var index = 0;
    if(!showAmount){
        var index = 2;
    }
    for(id in ranglist){
        if(values.indexOf(ranglist[id][index]) == -1){
            values.push(ranglist[id][index]);
        }
    }
    values = values.sort(function(a, b){return b-a});
    
    for(value of values){
        for(id in ranglist){
            if(ranglist[id][index] == value){

                //delete anonymous
                if(ranglist[id][1].rel != "user"){
                    continue;
                }
                
                row = document.createElement('tr');
                row.setAttribute('class','ranglistRow result');

                var td = document.createElement('td');
                td.appendChild(createNameElement(ranglist[id][1]))
                row.appendChild(td);

                td = document.createElement('td');
                td.setAttribute('class','percentage result');
                if(index == 2){
                    td.appendChild(document.createTextNode(ranglist[id][index]+"%"));
                }
                else{
                    td.appendChild(document.createTextNode(ranglist[id][index]));
                }
                row.appendChild(td);
                if(i >= maxRanglistLength){
                    row.setAttribute('style','display:none');
                }
                tbody.appendChild(row);
                i+=1;
            }
        }
    }
    if(i >  maxRanglistLength){
        row = document.createElement('tr');
        td = document.createElement('td');
        td.setAttribute('colspan',2);
        b = document.createElement('button');
        b.setAttribute('id','morebutton');
        //a.setAttribute('href','');
        b.appendChild(document.createTextNode("Click here to see all runners.."));
        b.addEventListener('click', () => {
            for(row of document.getElementsByClassName('ranglistRow')){
                row.setAttribute('style','');
            }
            document.getElementById("morebutton").setAttribute('style','display:none');
        });
        td.appendChild(b);
        row.appendChild(td);
        tbody.appendChild(row);
    }

    table.appendChild(tbody);
    
    // Create a wrapper for the ranglist table
    var ranglistWrapper = document.createElement('div');
    ranglistWrapper.setAttribute('class', 'table-wrapper ranglist-wrapper');
    ranglistWrapper.appendChild(table);
    
    document.getElementsByClassName("container")[0].appendChild(ranglistWrapper);
}

function removeLeaderboards(){
    var root =  document.getElementsByClassName("container")[0]
    while (root.firstChild) {
        root.removeChild(root.lastChild);
    }    
}

function switchMode(newmode){
    mode = newmode;
    removeLeaderboards();
    reset = function(){
        //turn everything true
        for(appleAmount in appleAmounts){
            appleAmounts[appleAmount].visible = true;
        }
        for(speed in speeds){
            speeds[speed].visible = true;
        }
        for(size in sizes){
            sizes[size].visible = true;
        }
        for(gamemode in gamemodes){
            gamemodes[gamemode].visible = true;
        }
        for(runMode in runModes){
            runModes[runMode].visible = true;
        }
        //change option buttons
        for(optionButton of document.getElementsByClassName('optionButtonImage')){
            optionButton.setAttribute('class','optionButtonImage');
        }
        for(runMode in runModes){
            var optionElement = document.getElementById('option'+runModes[runMode].id);
            if(optionElement) {
                optionElement.checked = true;
            }
        }
    }
    switch(mode){
        case 0:
            reset();
            if(speeds["Slow"]) speeds["Slow"].visible = false;
            // Safely update option button if it exists
            var speed01Btn = document.getElementById('optionspeed_01');
            if(speed01Btn && speed01Btn.firstChild) {
                speed01Btn.firstChild.setAttribute('class','optionButtonImage optionButtonImageDisabled');
            }
            //document.getElementById('optionmode_02').checked = false;
            var mainText = document.getElementById("mainText");
            var catText = document.getElementById("catText");
            var customText = document.getElementById("customText");
            var switchButton = document.getElementById("switchButton");
            
            if(mainText) mainText.setAttribute("style",'');
            if(catText) catText.setAttribute("style",'display:none');
            if(customText) customText.setAttribute("style",'display:none');
            if(switchButton) switchButton.innerHTML = "Click here to go to Category Extensions";
            break;
        case 1: //slow mode
            reset();
            if(speeds["Fast"]) speeds["Fast"].visible = false;
            if(speeds["Standard"]) speeds["Standard"].visible = false;
            // Safely update option buttons if they exist
            var speed00Btn = document.getElementById('optionspeed_00');
            var speed02Btn = document.getElementById('optionspeed_02');
            if(speed00Btn && speed00Btn.firstChild) {
                speed00Btn.firstChild.setAttribute('class','optionButtonImage optionButtonImageDisabled');
            }
            if(speed02Btn && speed02Btn.firstChild) {
                speed02Btn.firstChild.setAttribute('class','optionButtonImage optionButtonImageDisabled');
            }
            
            var mainText = document.getElementById("mainText");
            var catText = document.getElementById("catText");
            var customText = document.getElementById("customText");
            var switchButton = document.getElementById("switchButton");
            
            if(mainText) mainText.setAttribute("style",'display:none');
            if(catText) catText.setAttribute("style",'');
            if(customText) customText.setAttribute("style",'display:none');
            if(switchButton) switchButton.innerHTML = "Click here to go to Main Leaderboard";
            break;
        case 2:
            var mainText = document.getElementById("mainText");
            var catText = document.getElementById("catText");
            var customText = document.getElementById("customText");
            var switchButton = document.getElementById("switchButton");
            
            if(mainText) mainText.setAttribute("style",'display:none');
            if(catText) catText.setAttribute("style",'display:none');
            if(customText) customText.setAttribute("style",'');
            if(switchButton) switchButton.innerHTML = "Click here to go to Main Leaderboard";

    }
    
    // Only call these functions if we have data
    if(Object.keys(worldRecords).length > 0) {
        calculateRanglist();
        generateRanglist();
    }
    // Only generate table selector if it doesn't exist yet
    if (!document.querySelector('.table-selector')) {
        generateTableSelector();
    } else {
        // Just update highlighting for existing buttons immediately
        updateTableSelector();
    }
    generateSingleTable();
}

function addDays(date, days) {
  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function checkBestDate(name){
    var playerid = players[name];
    if(typeof(playerid) == 'undefined'){
        return "not found";
    }
    var checkdate = firstdate;
    var thisdate = new Date();
    var bestdate = new Date();
    var bestp = 0;
    var index = 0;
    if(!showAmount){
        var index = 2;
    }
    while(true){
        maxdate = checkdate;
        calculateBestRuns();
        calculateRanglist();
        if(typeof(ranglist[playerid]) != 'undefined'){
            if(ranglist[playerid][index] >= bestp){
                bestp = ranglist[playerid][index];
                bestdate = checkdate;
            }
        }
        //increase
        checkdate = addDays(checkdate, 1);
        if(checkdate > thisdate){
            break;
        }
    }
    return bestdate;
}

// Legacy SpeedInfo.js integration functions - kept for compatibility but not used

async function getAllWorldRecordsForCurrentSettings() {
    console.log("Fetching world records using WorldRecordFetcher...");
    
    // Check if WorldRecordFetcher is available
    if (!window.worldRecordFetcher) {
        console.error("WorldRecordFetcher not available!");
        return;
    }
    
    // Get current settings from the table selector
    let count = 0; // 1 Apple
    let speed = 0; // Normal
    let size = 0;  // Standard
    
    // Map current table settings to indices
    const countNames = ["1 Apple", "3 Apples", "5 Apples", "Dice"];
    const speedNames = ["Normal", "Fast", "Slow"];
    const sizeNames = ["Standard", "Small", "Large"];
    
    count = countNames.indexOf(currentTableSettings[0]);
    speed = speedNames.indexOf(currentTableSettings[1]);
    size = sizeNames.indexOf(currentTableSettings[2]);
    
    if (count === -1) count = 0;
    if (speed === -1) speed = 0;
    if (size === -1) size = 0;
    
    console.log("Current settings:", currentTableSettings);
    console.log("Mapped indices - count:", count, "speed:", speed, "size:", size);
    
    // Fetch world records for all game modes and levels
    // All modes get regular levels (25, 50, 100, All Apples)
    // Highscore modes also get highscore records
    const levels = ["25", "50", "100", "All"];
    const highscoreLevels = ["H"]; // Only for highscore modes
    const modeNames = ["Classic", "Wall", "Portal", "Cheese", "Borderless", "Twin", "Winged", "Yin Yang", "Key", "Sokoban", "Poison", "Dimension", "Minesweeper", "Statue", "Light", "Shield", "Arrow", "Hotdog", "Magnet", "Gate", "Peaceful"];
    const highscoreModes = [1, 2, 8, 9, 10, 12, 13, 15, 17, 19, 3]; // Wall, Portal, Key, Sokoban, Poison, Minesweeper, Statue, Shield, Hotdog, Gate, Cheese
    
    // Calculate total requests: regular levels for all modes + highscore levels for highscore modes
    let totalRequests = levels.length * modeNames.length + highscoreLevels.length * highscoreModes.length;
    let completedRequests = 0;
    
    // Clear existing world records
    worldRecords = {};
    
    // Fetch regular level-based records for all modes
    for (let modeIndex = 0; modeIndex < modeNames.length; modeIndex++) {
        for (let levelIndex = 0; levelIndex < levels.length; levelIndex++) {
            const level = levels[levelIndex];
            const mode = modeIndex;
            
            try {
                const record = await window.worldRecordFetcher.getWorldRecord(level, mode, count, speed, size);
                completedRequests++;
                
                if (record.success) {
                    // Create a key for this combination using actual setting names
                    let key = `${currentTableSettings[0]}|${currentTableSettings[1]}|${currentTableSettings[2]}|${modeNames[mode]}|${level + " Apples"}`;
                    
                    // Convert our record format to the expected format
                    let convertedRun = {
                        times: { primary: record.time.raw },
                        date: record.date.toISOString(),
                        id: record.runId,
                        weblink: record.weblink,
                        players: {
                            data: [{
                                names: { international: record.player.name },
                                id: record.player.id,
                                rel: "user",
                                weblink: `https://www.speedrun.com/user/${record.player.id}`,
                                "name-style": record.player.nameStyle || {
                                    style: "solid",
                                    color: {
                                        dark: "#ffffff"
                                    }
                                }
                            }]
                        },
                        values: {} // We'll need to reconstruct this if needed
                    };
                    
                    // Store the world record
                    worldRecords[key] = convertedRun;
                    
                    // Add player to players list
                    if (typeof players[record.player.name] == 'undefined') {
                        players[record.player.name] = record.player.id;
                    }
                    
                    console.log(`✅ Fetched WR for ${modeNames[mode]} - ${level} Apples: ${record.player.name} - ${record.time.formatted}`);
                    
                    // Update the display immediately for each record
                    calculateBestRuns();
                    calculateRanglist();
                    generateRanglist();
                    generateSingleTable();
                } else {
                    console.log(`❌ No WR found for ${modeNames[mode]} - ${level} Apples: ${record.message}`);
                }
                
                // Check if all requests are complete
                if (completedRequests === totalRequests) {
                    console.log("All world records fetched for current settings");
                    console.log("Total records fetched:", Object.keys(worldRecords).length);
                }
                
            } catch (error) {
                completedRequests++;
                console.error(`Error fetching WR for ${modeNames[mode]} - ${level} Apples:`, error);
                
                // Check if all requests are complete
                if (completedRequests === totalRequests) {
                    console.log("All world records fetched for current settings");
                    console.log("Total records fetched:", Object.keys(worldRecords).length);
                }
            }
        }
    }
    
    // Fetch highscore records only for highscore modes
    for (let levelIndex = 0; levelIndex < highscoreLevels.length; levelIndex++) {
        const level = highscoreLevels[levelIndex];
        for (let modeIndex = 0; modeIndex < highscoreModes.length; modeIndex++) {
            const mode = highscoreModes[modeIndex];
            
            try {
                const record = await window.worldRecordFetcher.getWorldRecord(level, mode, count, speed, size);
                completedRequests++;
                
                if (record.success) {
                    // Create a key for this combination using actual setting names
                    let key = `${currentTableSettings[0]}|${currentTableSettings[1]}|${currentTableSettings[2]}|${modeNames[mode]}|High Score`;
                    
                    // Convert our record format to the expected format
                    let convertedRun = {
                        times: { primary: record.time.raw },
                        date: record.date.toISOString(),
                        id: record.runId,
                        weblink: record.weblink,
                        players: {
                            data: [{
                                names: { international: record.player.name },
                                id: record.player.id,
                                rel: "user",
                                weblink: `https://www.speedrun.com/user/${record.player.id}`,
                                "name-style": record.player.nameStyle || {
                                    style: "solid",
                                    color: {
                                        dark: "#ffffff"
                                    }
                                }
                            }]
                        },
                        values: {} // We'll need to reconstruct this if needed
                    };
                    
                    // Store the world record
                    worldRecords[key] = convertedRun;
                    
                    // Add player to players list
                    if (typeof players[record.player.name] == 'undefined') {
                        players[record.player.name] = record.player.id;
                    }
                    
                    console.log(`✅ Fetched WR for ${modeNames[mode]} - High Score: ${record.player.name} - ${record.time.formatted}`);
                    
                    // Update the display immediately for each record
                    calculateBestRuns();
                    calculateRanglist();
                    generateRanglist();
                    generateSingleTable();
                } else {
                    console.log(`❌ No WR found for ${modeNames[mode]} - High Score: ${record.message}`);
                }
                
                // Check if all requests are complete
                if (completedRequests === totalRequests) {
                    console.log("All world records fetched for current settings");
                    console.log("Total records fetched:", Object.keys(worldRecords).length);
                }
                
            } catch (error) {
                completedRequests++;
                console.error(`Error fetching WR for ${modeNames[mode]} - High Score:`, error);
                
                // Check if all requests are complete
                if (completedRequests === totalRequests) {
                    console.log("All world records fetched for current settings");
                    console.log("Total records fetched:", Object.keys(worldRecords).length);
                }
            }
        }
    }
}

//option buttons
function createOptionButton(setting){
    var button = document.createElement('button');
    button.setAttribute('class','optionButton');
    button.setAttribute('onclick','optionButtonClick(this.id)');
    button.setAttribute('id','option'+setting.id);
    button.setAttribute('type','button');
    var icon = createIconElement(setting);
    if(setting.visible){
        icon.setAttribute('class','optionButtonImage');
    }
    else{
        icon.setAttribute('class','optionButtonImage optionButtonImageDisabled');
    }
    button.appendChild(icon);
    return button;
}

function optionButtonClick(clicked_id){
    var element = document.getElementById(clicked_id);
    image = element.getElementsByClassName("optionButtonImage")[0];
    setTo = true;
    if(image.classList.contains("optionButtonImageDisabled")){
        image.classList.remove("optionButtonImageDisabled");
    }
    else{
        image.classList.add("optionButtonImageDisabled");
        setTo = false;
    }
    for(gamemode in gamemodes){
        if("option"+gamemodes[gamemode].id == clicked_id){
            gamemodes[gamemode].visible = setTo;
        }
    }
    for(appleAmount in appleAmounts){
        if("option"+appleAmounts[appleAmount].id == clicked_id){
            appleAmounts[appleAmount].visible = setTo;
        }
    }
    for(speed in speeds){
        if("option"+speeds[speed].id == clicked_id){
            speeds[speed].visible = setTo;
        }
    }
    for(size in sizes){
        if("option"+sizes[size].id == clicked_id){
            sizes[size].visible = setTo;
        }
    }
    saveSettings(); // Save settings when changed
    switchMode(2);
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, starting initialization...");
    
    // Initialize UI elements
    initializeUI();
    
    // Test API connectivity first
    testAPIConnectivity(() => {
        // Start world records download
        startWorldRecordsDownload();
        
        // Auto-click refresh button after a short delay to ensure UI is ready
        setTimeout(() => {
            var refreshButton = document.querySelector('.refresh-btn');
            if (refreshButton && !refreshButton.disabled) {
                console.log("Auto-clicking refresh button...");
                refreshButton.click();
            }
        }, 1000);
    });
});

// Test API connectivity
function testAPIConnectivity(callback) {
    console.log("Testing API connectivity...");
    
    // Test a simple API call to speedrun.com
    makeAPIrequest("https://www.speedrun.com/api/v1/games", (response) => {
        if(response && response.data) {
            console.log("✅ API connectivity test passed");
            callback();
        } else {
            console.log("❌ API connectivity test failed");
            // Still continue, but show warning
            var container = document.querySelector('.container');
            if(container) {
                container.innerHTML = '<p style="color: orange; font-size: 18px;">⚠️ API connectivity issues detected. Some features may not work properly.</p>';
            }
            callback();
        }
    });
}

function initializeUI() {
    // Initialize modals
    var modal = document.getElementById("infoModal");
    var btn = document.getElementById("infoBtn");
    var span = document.getElementsByClassName("close")[0];

    if(btn && modal) {
        btn.onclick = function() {
            modal.style.display = "block";
        }
    }
    if(span) {
        span.onclick = function() {
            if(modal) modal.style.display = "none";
        }
    }

    var modal2 = document.getElementById("settingsModal");
    var btn2 = document.getElementById("settingsBtn");
    var span2 = document.getElementsByClassName("close")[1];

    if(btn2 && modal2) {
        btn2.onclick = function() {
            modal2.style.display = "block";
        }
    }
    if(span2) {
        span2.onclick = function() {
            if(modal2) modal2.style.display = "none";
        }
    }

    window.onclick = function(event) {
        if (event.target == modal2) {
            modal2.style.display = "none";
        }
        else if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    // Initialize datepicker
    var datepicker = document.getElementById("datepicker");
    if(datepicker) {
        datepicker.onchange = function(){
            maxdate = datepicker.valueAsDate;
            calculateBestRuns();
            switchMode(mode);
        }
    }

    //make all optionbuttons
    var optionButtons = document.getElementById('optionButtons');
    if(optionButtons) {
        // Clear existing content
        optionButtons.innerHTML = '';
        
        // Create main row container for top settings
        var topRowContainer = document.createElement('div');
        topRowContainer.className = 'top-settings-row';
        
        // Create container for category settings (gamemodes) - left column
        var categoryContainer = document.createElement('div');
        categoryContainer.className = 'settings-container category-container';
        var categoryTitle = document.createElement('h4');
        categoryTitle.textContent = 'Category Settings';
        categoryTitle.className = 'settings-title';
        categoryContainer.appendChild(categoryTitle);
        
        var categoryButtonGroup = document.createElement('div');
        categoryButtonGroup.className = 'button-group';
        for(gamemode in gamemodes){
            categoryButtonGroup.appendChild(createOptionButton(gamemodes[gamemode]));
        }
        categoryContainer.appendChild(categoryButtonGroup);
        topRowContainer.appendChild(categoryContainer);
        
        // Create container for other settings (count/speed/size) - right column
        var otherSettingsContainer = document.createElement('div');
        otherSettingsContainer.className = 'settings-container other-settings-container';
        
        // Count settings
        var countTitle = document.createElement('h4');
        countTitle.textContent = 'Count Settings';
        countTitle.className = 'settings-title';
        otherSettingsContainer.appendChild(countTitle);
        var countButtonGroup = document.createElement('div');
        countButtonGroup.className = 'button-group';
        for(appleAmount in appleAmounts){
            countButtonGroup.appendChild(createOptionButton(appleAmounts[appleAmount]));
        }
        otherSettingsContainer.appendChild(countButtonGroup);
        
        // Speed settings
        var speedTitle = document.createElement('h4');
        speedTitle.textContent = 'Speed Settings';
        speedTitle.className = 'settings-title';
        otherSettingsContainer.appendChild(speedTitle);
        var speedButtonGroup = document.createElement('div');
        speedButtonGroup.className = 'button-group';
        for(speed in speeds){
            speedButtonGroup.appendChild(createOptionButton(speeds[speed]));
        }
        otherSettingsContainer.appendChild(speedButtonGroup);
        
        // Size settings
        var sizeTitle = document.createElement('h4');
        sizeTitle.textContent = 'Size Settings';
        sizeTitle.className = 'settings-title';
        otherSettingsContainer.appendChild(sizeTitle);
        var sizeButtonGroup = document.createElement('div');
        sizeButtonGroup.className = 'button-group';
        for(size in sizes){
            sizeButtonGroup.appendChild(createOptionButton(sizes[size]));
        }
        otherSettingsContainer.appendChild(sizeButtonGroup);
        
        topRowContainer.appendChild(otherSettingsContainer);
        optionButtons.appendChild(topRowContainer);
        
        // Create container for run mode settings (checkboxes) - bottom
        var runModeContainer = document.createElement('div');
        runModeContainer.className = 'settings-container runmode-container';
        var runModeTitle = document.createElement('h4');
        runModeTitle.textContent = 'Run Mode Settings';
        runModeTitle.className = 'settings-title';
        runModeContainer.appendChild(runModeTitle);
        
        // Create a wrapper for checkboxes to align them properly
        var checkboxWrapper = document.createElement('div');
        checkboxWrapper.className = 'checkbox-wrapper';
        
        for(runMode in runModes){
            var checkboxItem = document.createElement('div');
            checkboxItem.className = 'checkbox-item';
            
            input = document.createElement('input');
            input.checked = true;
            input.setAttribute('type','checkbox');
            input.setAttribute('id',"option"+runModes[runMode].id);
            label = document.createElement('label');
            label.setAttribute('for',"option"+runModes[runMode].id);
            label.appendChild(document.createTextNode(runModes[runMode].text));
            
            input.addEventListener('click', ()=> {
                for(runMode in runModes){
                    runModes[runMode].visible = document.getElementById('option'+runModes[runMode].id).checked;
                }
                saveSettings(); // Save settings when changed
                switchMode(2);
            });
            
            checkboxItem.appendChild(input);
            checkboxItem.appendChild(label);
            checkboxWrapper.appendChild(checkboxItem);
        }
        
        runModeContainer.appendChild(checkboxWrapper);
        optionButtons.appendChild(runModeContainer);
    } else {
        console.error("Option buttons container not found!");
    }

    //username
    var sendUsernameBtn = document.getElementById('sendusername');
    if(sendUsernameBtn) {
        sendUsernameBtn.addEventListener('click', () =>{
            var usernameResult = document.getElementById('usernameResult');
            var usernameInput = document.getElementById('username');
            var datepicker = document.getElementById('datepicker');
            
            if(usernameResult) usernameResult.setAttribute('style','');
            if(usernameResult) usernameResult.innerHTML = "Calculating...";
            
            requestAnimationFrame(() =>
                requestAnimationFrame(() =>{
                date = checkBestDate(usernameInput ? usernameInput.value : '');
                if(date == "not found"){
                    if(usernameResult) usernameResult.innerHTML = "Username not found";
                }
                else{
                    if(datepicker) datepicker.valueAsDate = date;
                    maxdate = date;
                    calculateBestRuns();
                    switchMode(mode);
                    if(usernameResult) usernameResult.innerHTML = "Date set!";
                }
            }));
        });
    }

    function setHighestLabel(){
        var highestLabel = document.getElementById('highestLabel');
        if(highestLabel) {
            if(showAmount){
                highestLabel.innerHTML = "Enter an username to calculate the date with the highest number of runs from this user";
            }
            else{
                highestLabel.innerHTML = "Enter an username to calculate the date with the highest percentage of runs from this user";
            }
        }
    }
    setHighestLabel();

         //showamount
     var showAmountCheckbox = document.getElementById('showAmount');
     if(showAmountCheckbox) {
         showAmountCheckbox.checked = showAmount;
         showAmountCheckbox.addEventListener('click', (e) => {
             showAmount = showAmountCheckbox.checked;
             saveSettings(); // Save settings when changed
             setHighestLabel();
             switchMode(mode);
         });
     }
}

function startWorldRecordsDownload() {
    console.log("Starting world records download...");
    
    // Get container element
    var container = document.querySelector('.container');
    if(!container) {
        console.error("Container element not found!");
        return;
    }

    // Add timeout to prevent infinite loading
    var loadingTimeout = setTimeout(function() {
        console.log("Loading timeout reached, showing fallback content");
        if(container) {
            container.innerHTML = '<p style="color: white; font-size: 18px;">API connection issues. Please check your internet connection and try again.</p>';
        }
    }, 30000); // 30 second timeout

    // Add a shorter timeout for API failures
    var apiTimeout = setTimeout(function() {
        console.log("API timeout reached, showing demo mode");
        if(container) {
            container.innerHTML = '<p style="color: white; font-size: 18px;">API unavailable. Showing demo mode with sample data.</p>';
            // Show the UI even without data
            generateTableSelector();
            generateSingleTable();
            
            var switchButton = document.getElementById("switchButton");
            if(switchButton) {
                switchButton.addEventListener('click', () => {
                    if(mode == 0){
                        switchMode(1);
                    }
                    else{
                        switchMode(0);
                    }
                });
            }
        }
    }, 10000); // 10 second timeout for API

    getGameDetails(
    () => {
        console.log("Game details loaded, fetching world records using SpeedInfo.js integration...");
        
        // Clear any existing world records to ensure fresh data
        worldRecords = {};
        
        // Use the new WorldRecordFetcher to get the most recent world records
        getAllWorldRecordsForCurrentSettings().then(() => {
            console.log("Initial world records loaded successfully");
        }).catch((error) => {
            console.error("Error loading initial world records:", error);
        });
        
        // Set up a completion check
        var checkCompletion = setInterval(() => {
            if(Object.keys(worldRecords).length > 0) {
                clearTimeout(loadingTimeout);
                clearTimeout(apiTimeout);
                clearInterval(checkCompletion);
                
                console.log("World records loaded successfully:", Object.keys(worldRecords).length, "records");
                
                                 calculateBestRuns();
                 calculateRanglist();
                 generateRanglist();
                 // Only generate table selector if it doesn't exist yet
                 if (!document.querySelector('.table-selector')) {
                     generateTableSelector();
                 } else {
                     // Just update highlighting for existing buttons immediately
                     updateTableSelector();
                 }
                 generateSingleTable();
                
                var switchButton = document.getElementById("switchButton");
                if(switchButton) {
                    switchButton.addEventListener('click', () => {
                        if(mode == 0){
                            switchMode(1);
                        }
                        else{
                            switchMode(0);
                        }
                    });
                }
            }
        }, 1000); // Check every second
        
        // Fallback: if no records after 15 seconds, show error
        setTimeout(() => {
            if(Object.keys(worldRecords).length === 0) {
                clearInterval(checkCompletion);
                console.log("No world records found after timeout, showing fallback message");
                if(container) {
                    container.innerHTML = '<p style="color: white; font-size: 18px;">No world records found. The API might be temporarily unavailable.</p>';
                }
            }
        }, 15000);
    });
}


