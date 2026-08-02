# FastSnakeStats

A comprehensive web application that displays Google Snake world records from Speedrun.com with advanced caching, time travel functionality, and automated data collection.

## Features

### Core Functionality
- **World Records Display**: View current and historical world records for Google Snake
- **Multiple Game Modes**: Support for 22 modes — Classic, Wall, Portal, Cheese, Borderless, Twin, Winged, Yin Yang, Key, Sokoban, Poison, Dimension, Minesweeper, Statue, Light, Shield, Arrow, Hotdog, Magnet, Gate, Bridge, and Peaceful
- **Flexible Settings**: Apple amounts (1, 3, 5, 10, Dice, Bomb), speeds (Normal, Fast, Slow), and sizes (Standard, Small, Large)
- **Run Types**: 25 / 50 / 100 / All Apples, plus High Score where SRC supports it (not Cheese)
- **Multiple Tables**: Toggle between single-table and multiple-table views
- **Time Travel**: View world records from any historical date with available cache data
- **Player Peak Search**: Look up a player's peak record count and peak percentage dates (ties use the latest date)
- **Responsive Design**: Optimized for both desktop and mobile devices

### Advanced Caching System
- **GitHub-Hosted Cache**: Historical data stored in organized JSON files
- **Smart Updates**: Only update cache when data has changed
- **Automated Collection**: Daily cache updates via GitHub Actions (Node.js 24)
- **Historical Backfill**: Local scripts for filling historical data gaps

### User Experience
- **Dark/Light Mode**: Toggle between themes
- **Collapsible Panels**: Category Settings, Rankings, and Statistics overlay the records table without shifting layout
- **Play Now**: Quick link to [Google Snake Mods](https://googlesnakemods.com/v/current/)
- **Rankings**: Player WR counts with Overall% and Relative% for the current category selection
- **Statistics Explorer**: Precomputed history views — WR progression, record longevity, fastest improving players (7d/30d/90d/365d), contested categories, category popularity, and activity heatmaps
- **Error Handling**: Graceful fallbacks and user-friendly error messages
- **Performance Optimized**: Instant cache loading and efficient data processing

## Quick Start

### For Users
1. Visit [FastSnakeStats](https://stats.googlesnakemods.com/)
2. Select your preferred game settings in **Category Settings**
3. Enable **Time Travel** to view historical records from available cache dates
4. Toggle **Multiple Tables** for comprehensive views
5. Open **Rankings** for player WR leaderboards, or **Play Now** to jump into the game

### For Developers

#### Prerequisites
- Node.js 24+

#### Local Development
```bash
# Clone the repository
git clone https://github.com/darkSnakeGang/FastSnakeStats.git
cd FastSnakeStats

# Start local development server
# Use any local web server of your choice
```

#### Cache Management Scripts
```bash
# Run historical cache backfill for a specific date range
node scripts/historical-cache-backfill.js 2024-01-01 2024-01-31

# Fetch yesterday (same as the daily GitHub Action)
node scripts/historical-cache-backfill.js --yesterday

# Overwrite an existing day
node scripts/historical-cache-backfill.js 2026-08-01 --force

# Run monthly backfill for a specific month and year
node scripts/monthly-backfill.js 2024 1

# Generate available dates metadata
node scripts/generate-available-dates.js

# Rebuild player peak stats
node scripts/player-stats-analyzer.js

# Rebuild statistics explorer metadata (progression, longevity, heatmap, etc.)
node scripts/statistics-explorer-analyzer.js

# Install Node.js unattended on Windows (LTS 24.x)
scripts/install-nodejs.bat
```

## Key Components

### GitHub Cache System
- **Automated Collection**: Daily at midnight UTC via GitHub Actions
- **Runtime**: Node.js 24 with `actions/checkout@v6` and `actions/setup-node@v6`
- **Organized Storage**: Year/month/day folder structure
- **Metadata Management**: Indexes and statistics for efficient access
- **Smart Updates**: Only commit changes when data differs

### Time Travel Feature
- **Historical Access**: View world records from any date with available cache
- **Cache Integration**: Fast loading from GitHub-hosted data (local cache preferred when present)
- **Empty Cell Handling**: Proper display when no records exist
- **Date Selection**: User-friendly date picker interface
- **Peak Dates**: Search a username for peak records and peak percentage days

### Mobile Optimization
- **Responsive Design**: Optimized for all screen sizes
- **Touch-Friendly**: Large buttons and intuitive navigation
- **Performance**: Optimized loading and smooth animations
- **Offline Support**: Works with cached data when offline

## Cache System Details

### GitHub Actions Workflows
- **Daily Cache** (`daily-cache.yml`): Fetches yesterday's world records, regenerates `available-dates.json`, `player-stats.json`, and `statistics-explorer.json`
- **Available Dates** (`update-available-dates.yml`): Regenerates date metadata
- **Player Stats** (`analyze-player-stats.yml`): Manual/backup rebuild of peak stats and statistics explorer metadata

### Statistics Explorer
- Precomputed from the full daily cache into `time-travel-cache/metadata/statistics-explorer.json`
- Progression uses its own Count / Speed / Size / Run / Mode dropdowns (all-time history, independent of Category Settings)
- Longevity, contested, and popularity list Mode + Count + Speed + Size + Run; Longevity has All-time / Still standing toggles
- Heatmap uses a year dropdown (one year at a time)
- Improving players and heatmap metrics are site-wide
- Refresh locally with `node scripts/statistics-explorer-analyzer.js`

### Local Backfill Scripts
- **Historical Backfill**: Fill historical data gaps for specific date ranges
- **Monthly Backfill**: Automated backfill for entire months
- **Usage**: `node scripts/historical-cache-backfill.js <start-date> <end-date>`
- **Features**: Skip existing data (or `--force`), error handling, progress tracking

### Cache Format
```json
{
  "date": "2024-01-15",
  "timestamp": "2024-01-16T00:00:00.000Z",
  "records": {
    "1 Apple|Normal|Standard|Classic|25 Apples": {
      "success": true,
      "runs": [...],
      "settings": ["1 Apple", "Normal", "Standard", "Classic", "25 Apples"]
    }
  }
}
```

## UI Components

### Desktop Interface
- **Category Settings**: Collapsible left panel for modes, apples, speeds, sizes, and options
- **Play Now**: Always-visible left-edge shortcut to Google Snake Mods
- **Records Table**: Centered world records view
- **Rankings**: Collapsible right panel with player counts, Overall%, and Relative%
- **Statistics**: Collapsible right panel (under Rankings when collapsed) for historical explorer views
- **Modal Dialogs**: Settings (time travel / peak search) and Info (links, credits)

### Mobile Interface
- **Tab Navigation**: Records, Rankings, Statistics, and Settings tabs
- **Touch Controls**: Large, accessible buttons
- **Responsive Tables**: Optimized for mobile viewing
- **Quick Actions**: Fast access to common functions

## Performance Features

### Optimization Strategies
- **Instant Cache Loading**: Pre-loaded data for immediate display
- **Lazy Loading**: Load data only when needed
- **Smart Caching**: Intelligent cache invalidation and updates

### Speed Improvements
- **GitHub Cache**: Fast data loading from organized cache files
- **Local Storage**: Instant access to recent data
- **Efficient Rendering**: Fast table generation and updates

## Configuration

### Settings
- **Game Modes**: 22 modes (see Features above); High Score columns for Wall, Portal, Key, Sokoban, Poison, Minesweeper, Statue, Shield, Hotdog, Gate, and Bridge
- **Apple Amounts**: 1, 3, 5, 10, Dice, Bomb
- **Speeds**: Normal, Fast, Slow
- **Sizes**: Standard, Small, Large
- **Display Options**: Single/Multiple tables, Time Travel

### Cache Settings
- **Stale Threshold**: 3 hours for local cache
- **Update Frequency**: Daily for GitHub cache
- **Storage Limits**: 1GB repository limit (generous for JSON data)

## Statistics

### Current Status
- **Total Dates Cached**: Varies by implementation and available cache data
- **Data Size**: ~50-200KB per day
- **Update Frequency**: Daily automated

### Performance Metrics
- **Load Time**: <1s with cache
- **Cache Hit Rate**: >95% for recent data
- **User Experience**: Instant loading for cached data

## Acknowledgments

- **Speedrun.com**: For providing the API and data
- **Google**: For the original Snake game and images
- **GitHub**: For hosting and automation services
- **Community**: For feedback and contributions — [Google Snake Discord](https://discord.gg/n3UZcHttqX)

## Support

For questions, issues, or contributions:
- **Repository**: [GitHub Issues](https://github.com/darkSnakeGang/FastSnakeStats/issues)
- **Website**: [FastSnakeStats](https://stats.googlesnakemods.com/)
- **Discord**: [Google Snake Discord](https://discord.gg/n3UZcHttqX)
- **Author**: Yarmiplay

---

**Made with dedication by Yarmiplay**
