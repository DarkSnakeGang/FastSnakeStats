// Data Management & State Module
// Handles all application state, variables, and localStorage operations

const gameIDs = ["o1y9pyk6", "9dow0go1"];
var categories = [];
var variables = [];
var levels = [];
var mode = 0;    //0 = main, 1 = cat, 2 = custom;
var requestsMade = 0;
var maxdate = undefined;
var firstdate = undefined;

// Game settings data structures
var appleAmounts = {"1 Apple":{visible:true,icon:"https://i.ibb.co/rGZV12Ym/count-00-png.png",id:"count_00"},
                    "3 Apples":{visible:true,icon:"https://i.ibb.co/V0gcrCmM/count-01-png.png",id:"count_01"},
                    "5 Apples":{visible:true,icon:"https://i.ibb.co/SSc8jww/count-02-png.png",id:"count_02"},
                    "10 Apples":{visible:true,icon:"https://i.ibb.co/gbTbZvw8/count-03.png",id:"count_03"},
		            "Dice":{visible:true,icon:"https://i.ibb.co/8DzSj9hV/count-03-png.png",id:"count_04"},
                    "Bomb":{visible:true,icon:"https://i.ibb.co/kVXQJrVp/count-05.png",id:"count_05"},
                    "Tally":{visible:true,icon:"assets/count_06.png",id:"count_06"}};
var speeds =       {"Normal":{visible:true,icon:"https://i.ibb.co/p6rmphY3/speed-00-png.png",id:"speed_00"},
                    "Slow":{visible:false,icon:"https://i.ibb.co/hJz9cv8B/speed-02-png.png",id:"speed_01"},
                    "Fast":{visible:true,icon:"https://i.ibb.co/fzSffpZX/speed-01-png.png",id:"speed_02"}};
var sizes =        {"Standard":{visible:true,icon:"https://i.ibb.co/wTygmfr/size-00-png.png",id:"size_00"},
                    "Small":{visible:true,icon:"https://i.ibb.co/JRC52RRx/size-01-png.png",id:"size_01"},
                    "Large":{visible:true,icon:"https://i.ibb.co/TDXV3KYM/size-02-png.png",id:"size_02"}};
var gamemodes =    {"Classic":{visible:true,icon:"https://i.ibb.co/Q3Qh6BSy/trophy-00-png.png",id:"trophy_01"},
                    "Wall":{visible:true,icon:"https://i.ibb.co/zhR45VL2/trophy-01-png.png",id:"trophy_02"},
                    "Portal":{visible:true,icon:"https://i.ibb.co/whH1HMVg/trophy-02-png.png",id:"trophy_03"},
                    "Cheese":{visible:true,icon:"https://i.ibb.co/RGtHVbmX/trophy-03-png.png",id:"trophy_04"},
                    "Borderless":{visible:true,icon:"https://i.ibb.co/YBW6HG1W/trophy-04-png.png",id:"trophy_5"},
                    "Twin":{visible:true,icon:"https://i.ibb.co/spKfXDbs/trophy-05-png.png",id:"trophy_06"},
                    "Winged":{visible:true,icon:"https://i.ibb.co/ZRd57NCq/trophy-06-png.png",id:"trophy_07"},
                    "Yin Yang":{visible:true,icon:"https://i.ibb.co/DgLr48GP/trophy-07-png.png",id:"trophy_08"},
                    "Key":{visible:true,icon:"https://i.ibb.co/ccfJ067j/trophy-08-png.png",id:"trophy_09"},
                    "Sokoban":{visible:true,icon:"https://i.ibb.co/GQSbLCPK/trophy-09-png.png",id:"trophy_10"},
                    "Poison":{visible:true,icon:"https://i.ibb.co/B5MFy3M2/trophy-10-png.png",id:"trophy_11"},
                    "Dimension":{visible:true,icon:"https://i.ibb.co/NgC8Rzrq/trophy-11-png.png",id:"trophy_12"},
                    "Minesweeper":{visible:true,icon:"https://i.ibb.co/r2b26trd/trophy-12-png.png",id:"trophy_13"},
		    "Statue":{visible:true,icon:"https://i.ibb.co/tTQyhWmV/trophy-13-png.png",id:"trophy_14"},
		    "Light":{visible:true,icon:"https://i.ibb.co/Mkk60W48/trophy-14-png.png",id:"trophy_15"},
		    "Shield":{visible:true,icon:"https://i.ibb.co/W4ZdB20L/trophy-15-png.png",id:"trophy_16"},
		    "Arrow":{visible:true,icon:"https://i.ibb.co/rGBxD1Jg/trophy-16-png.png",id:"trophy_17"},
		    "Hotdog":{visible:true,icon:"https://i.ibb.co/FF4hdbz/trophy-17-png.png",id:"trophy_18"},
		    "Magnet":{visible:true,icon:"https://i.ibb.co/nMbMjjfL/trophy-18-png.png",id:"trophy_19"},
		    "Gate":{visible:true,icon:"https://i.ibb.co/1tp8JqBM/trophy-19-png.png",id:"trophy_20"},
		    "Bridge":{visible:true,icon:"https://i.ibb.co/Kj7tYtM7/trophy-20.png",id:"trophy_22"},
                    "Peaceful":{visible:true,icon:"https://i.ibb.co/jvrCYD8r/trophy-17-png.png",id:"trophy_21"}};
var runModes =     {"25 Apples":{visible:true,icon:null,text:"25 Apples",id:"mode_00"},
                    "50 Apples":{visible:true,icon:null,text:"50 Apples",id:"mode_01"},
                    "100 Apples":{visible:true,icon:null,text:"100 Apples",id:"mode_02"},
                    "All Apples":{visible:true,icon:null,text:"All Apples",id:"mode_03"},
                    "High Score":{visible:true,icon:null,text:"High Score",id:"mode_04"}};

// Application state
var runs = [];
var bestRuns = [];
var date = "";
var ranglist = [];
var players = [];
var currentTableSettings = ["1 Apple", "Normal", "Standard"]; // Default table settings
var worldRecords = {}; // Store world records data
var isDarkMode = false; // Default to light mode
var isTimeTravelEnabled = false; // Time travel toggle state
var selectedTimeTravelDate = ""; // Currently selected date for time travel
var isMultipleTablesEnabled = false; // Multiple tables toggle state
var isCategoryCollapsed = false; // Desktop left Category Settings panel
var isSummaryCollapsed = false; // Desktop right Rankings panel
var isStatsExplorerCollapsed = true; // Desktop right Statistics panel (default collapsed)
var isApiOverloaded = false; // Track if SRC API is overloaded (420 error)
var apiCallProgress = { successful: 0, total: 0 }; // Track API call progress for runs only
var isApiPaused = false; // Track if API calls are paused
var pausedApiState = null; // Store state when API calls are paused
var isLoading = false; // Loading state management

function applyPanelCollapseState() {
    document.body.classList.toggle('category-collapsed', !!isCategoryCollapsed);
    document.body.classList.toggle('summary-collapsed', !!isSummaryCollapsed);

    var categoryToggle = document.getElementById('categoryCollapseBtn');
    if (categoryToggle) {
        // Only a close control when open; collapsed tab is label-only
        categoryToggle.textContent = '◀';
        categoryToggle.setAttribute('title', 'Hide Settings');
        categoryToggle.setAttribute('aria-expanded', String(!isCategoryCollapsed));
        categoryToggle.setAttribute('aria-label', 'Hide Settings');
        categoryToggle.hidden = !!isCategoryCollapsed;
    }

    var categoryTitle = document.querySelector('.category-settings-title');
    if (categoryTitle) {
        categoryTitle.textContent = isCategoryCollapsed ? '⚙️' : 'Settings';
        categoryTitle.setAttribute('aria-label', isCategoryCollapsed ? 'Show Settings' : 'Settings');
        categoryTitle.setAttribute('title', isCategoryCollapsed ? 'Show Settings' : 'Settings');
    }

    var summaryToggle = document.getElementById('summaryCollapseBtn');
    if (summaryToggle) {
        // Only a close control when open; collapsed tab is icon-only
        summaryToggle.textContent = '▶';
        summaryToggle.setAttribute('title', 'Hide Rankings');
        summaryToggle.setAttribute('aria-expanded', String(!isSummaryCollapsed));
        summaryToggle.setAttribute('aria-label', 'Hide Rankings');
        summaryToggle.hidden = !!isSummaryCollapsed;
    }

    var summaryTitle = document.querySelector('.ranglist-panel-title');
    if (summaryTitle) {
        summaryTitle.textContent = isSummaryCollapsed ? '📊' : 'Rankings';
        summaryTitle.setAttribute('aria-label', isSummaryCollapsed ? 'Show Rankings' : 'Rankings');
        summaryTitle.setAttribute('title', isSummaryCollapsed ? 'Show Rankings' : 'Rankings');
    }

    var categorySidebar = document.querySelector('.table-selector');
    if (categorySidebar) {
        categorySidebar.classList.toggle('collapsed', !!isCategoryCollapsed);
    }

    var summaryWrapper = document.querySelector('.ranglist-wrapper');
    if (summaryWrapper) {
        summaryWrapper.classList.toggle('collapsed', !!isSummaryCollapsed);
    }

    if (typeof applyStatsExplorerCollapseState === 'function') {
        applyStatsExplorerCollapseState();
    }
}

function toggleCategoryCollapsed() {
    isCategoryCollapsed = !isCategoryCollapsed;
    saveSettings();
    applyPanelCollapseState();
}

function toggleSummaryCollapsed() {
    isSummaryCollapsed = !isSummaryCollapsed;
    saveSettings();
    applyPanelCollapseState();
}

function toggleStatsExplorerCollapsed() {
    isStatsExplorerCollapsed = !isStatsExplorerCollapsed;
    saveSettings();
    applyPanelCollapseState();
}

// Function to update cache info displays
function updateAllCacheInfo() {
    // Update desktop cache info
    if (typeof updateCacheInfo === 'function') {
        updateCacheInfo();
    }
    

}

// Make state accessible globally
window.isApiPaused = false;
window.isLoading = isLoading;

// Load settings from localStorage
function loadSettings() {
    // Load dark mode setting
    if(localStorage.getItem('darkMode') == null){
        localStorage.setItem('darkMode', isDarkMode);
    } else {
        isDarkMode = localStorage.getItem('darkMode') === 'true';
        if(isDarkMode) {
            document.body.classList.add('dark-mode');
        }
    }
    
    // Load time travel settings
    if(localStorage.getItem('timeTravelEnabled') == null){
        localStorage.setItem('timeTravelEnabled', isTimeTravelEnabled);
    } else {
        isTimeTravelEnabled = localStorage.getItem('timeTravelEnabled') === 'true';
    }
    
    if(localStorage.getItem('selectedTimeTravelDate') != null){
        selectedTimeTravelDate = localStorage.getItem('selectedTimeTravelDate');
    }
    
    // Load multiple tables settings
    if(localStorage.getItem('multipleTablesEnabled') == null){
        localStorage.setItem('multipleTablesEnabled', isMultipleTablesEnabled);
    } else {
        isMultipleTablesEnabled = localStorage.getItem('multipleTablesEnabled') === 'true';
    }

    // Load desktop panel collapse settings (default open)
    if(localStorage.getItem('categorySettingsCollapsed') == null){
        localStorage.setItem('categorySettingsCollapsed', 'false');
    } else {
        isCategoryCollapsed = localStorage.getItem('categorySettingsCollapsed') === 'true';
    }
    if(localStorage.getItem('summaryCollapsed') == null){
        localStorage.setItem('summaryCollapsed', 'false');
    } else {
        isSummaryCollapsed = localStorage.getItem('summaryCollapsed') === 'true';
    }
    if(localStorage.getItem('statsExplorerCollapsed') == null){
        localStorage.setItem('statsExplorerCollapsed', 'true');
    } else {
        isStatsExplorerCollapsed = localStorage.getItem('statsExplorerCollapsed') === 'true';
    }
    
    // Load table settings
    if(localStorage.getItem('tableSettings') == null){
        localStorage.setItem('tableSettings', JSON.stringify(currentTableSettings));
    } else {
        try {
            currentTableSettings = JSON.parse(localStorage.getItem('tableSettings'));
        } catch(e) {
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
        }
    }
    
    // Update time travel message after loading settings
    if (typeof updateTimeTravelMessage === 'function') {
        updateTimeTravelMessage();
    }
}

// Save settings to localStorage
function saveSettings() {
    localStorage.setItem('darkMode', isDarkMode);
    localStorage.setItem('tableSettings', JSON.stringify(currentTableSettings));
    localStorage.setItem('timeTravelEnabled', isTimeTravelEnabled);
    localStorage.setItem('selectedTimeTravelDate', selectedTimeTravelDate);
    localStorage.setItem('multipleTablesEnabled', isMultipleTablesEnabled);
    localStorage.setItem('categorySettingsCollapsed', isCategoryCollapsed);
    localStorage.setItem('summaryCollapsed', isSummaryCollapsed);
    localStorage.setItem('statsExplorerCollapsed', isStatsExplorerCollapsed);
    
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
    
    // Make time travel variables globally available
    window.isTimeTravelEnabled = isTimeTravelEnabled;
    window.selectedTimeTravelDate = selectedTimeTravelDate;

    if (typeof refreshStatisticsExplorer === 'function') {
        refreshStatisticsExplorer();
    }
}

// Generate run holder for data organization
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

// Get settings from run data
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

// Utility function for rounding numbers
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

// Add days to date utility
function addDays(date, days) {
  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Sleep utility function
function sleepFor(sleepDuration){
    var now = new Date().getTime();
    while(new Date().getTime() < now + sleepDuration){ 
        /* Do nothing */ 
    }
}
