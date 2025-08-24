# FastSnakeStats

A comprehensive web application that displays Google Snake world records from Speedrun.com with advanced caching, time travel functionality, and automated data collection.

## Features

### Core Functionality
- **World Records Display**: View current and historical world records for Google Snake
- **Multiple Game Modes**: Support for 21 different game modes including Classic, Wall, Portal, Cheese, Borderless, Twin, Winged, Yin Yang, Key, Sokoban, Poison, Dimension, Minesweeper, Statue, Light, Shield, Arrow, Hotdog, Magnet, Gate, and Peaceful
- **Flexible Settings**: Configure apple amounts (1, 3, 5, Dice), speeds (Normal, Fast, Slow), and sizes (Standard, Small, Large)
- **Multiple Tables**: Toggle between single table and multiple table views
- **Time Travel**: View world records from any historical date with available cache data
- **Responsive Design**: Optimized for both desktop and mobile devices

### Advanced Caching System
- **GitHub-Hosted Cache**: Historical data stored in organized JSON files
- **Smart Updates**: Only update cache when data has changed
- **Automated Collection**: Daily cache updates via GitHub Actions
- **Historical Backfill**: Local scripts for filling historical data gaps

### User Experience
- **Dark/Light Mode**: Toggle between themes
- **Error Handling**: Graceful fallbacks and user-friendly error messages
- **Performance Optimized**: Instant cache loading and efficient data processing

## Quick Start

### For Users
1. Visit [FastSnakeStats](https://stats.googlesnakemods.com/)
2. Select your preferred game settings
3. Enable **Time Travel** to view historical records from available cache dates
4. Toggle **Multiple Tables** for comprehensive views

### For Developers

#### Prerequisites
- Node.js 18+ 
- Python 3.7+ (for local development server)

#### Local Development
```bash
# Clone the repository
git clone https://github.com/darkSnakeGang/FastSnakeStats.git
cd FastSnakeStats

# Start local development server
python -m http.server 8000
# or use any local web server
```

#### Cache Management Scripts
```bash
# Run historical cache backfill for a specific date range
node scripts/historical-cache-backfill.js 2024-01-01 2024-01-31

# Run monthly backfill for a specific month and year
node scripts/monthly-backfill.js 2024 1

# Generate available dates metadata
node scripts/generate-available-dates.js

# Install Node.js unattended on Windows
scripts/install-nodejs.bat
```

## Project Structure

```
FastSnakeStats/
├── .github/workflows/          # GitHub Actions automation
│   ├── daily-cache.yml        # Daily cache collection workflow
│   └── update-available-dates.yml # Metadata update workflow
├── scripts/                   # Node.js automation scripts
│   ├── historical-cache-backfill.js # Historical data backfill
│   ├── monthly-backfill.js    # Monthly backfill automation
│   ├── generate-available-dates.js # Metadata generation
│   ├── install-nodejs.bat     # Windows Node.js installer
│   └── README.md              # Scripts documentation
├── time-travel-cache/         # GitHub-hosted cache data
│   ├── daily/                 # Organized by year/month/day
│   └── metadata/              # Cache indexes and statistics
├── metadata/                  # Available dates and statistics
├── index.html                 # Main HTML file
├── main.js                    # Application entry point
├── api-fetcher.js             # API integration and data fetching
├── github-cache-fetcher.js    # GitHub cache integration
├── cache-manager.js           # Local cache management
├── WorldRecordFetcher.js      # Speedrun.com API client
├── data-management.js         # Data structures and settings
├── ui-generator.js            # UI generation and table creation
├── ui-events.js               # Event handlers and interactions
├── mobile-ui.js               # Mobile-specific UI components
├── style.css                  # Desktop and general styles
├── mobile.css                 # Mobile-specific styles
├── package.json               # Project configuration
├── CNAME                      # Custom domain configuration
└── README.md                  # This file
```

## Technical Architecture

### Frontend
- **Vanilla JavaScript**: No frameworks, pure JS for maximum performance
- **Responsive CSS**: Mobile-first design with CSS Grid and Flexbox
- **Progressive Enhancement**: Works without JavaScript for basic functionality

### Backend Integration
- **GitHub Raw**: Data source for cached historical data
- **Local Storage**: Client-side caching for immediate access

### Caching Strategy
1. **GitHub Actions**: Daily automated collection of yesterday's data
2. **Local Scripts**: Manual backfill of historical data
3. **Client Cache**: Browser-based caching for immediate access
4. **Smart Updates**: Only update when data changes

### Data Flow
```
GitHub Actions → GitHub Repository → FastSnakeStats → User
     ↓
Local Cache (Browser) ← GitHub Cache
```

## Key Components

### GitHub Cache System
- **Automated Collection**: Daily at midnight UTC via GitHub Actions
- **Organized Storage**: Year/month/day folder structure
- **Metadata Management**: Indexes and statistics for efficient access
- **Smart Updates**: Only commit changes when data differs

### Time Travel Feature
- **Historical Access**: View world records from any date with available cache
- **Cache Integration**: Fast loading from GitHub-hosted data
- **Empty Cell Handling**: Proper display when no records exist
- **Date Selection**: User-friendly date picker interface

### Mobile Optimization
- **Responsive Design**: Optimized for all screen sizes
- **Touch-Friendly**: Large buttons and intuitive navigation
- **Performance**: Optimized loading and smooth animations
- **Offline Support**: Works with cached data when offline

## Cache System Details

### GitHub Actions Workflow
- **Trigger**: Daily at midnight UTC
- **Process**: Fetches yesterday's complete world records
- **Storage**: Saves to organized folder structure
- **Commit**: Only commits when data has changed

### Local Backfill Scripts
- **Historical Backfill**: Fill historical data gaps for specific date ranges
- **Monthly Backfill**: Automated backfill for entire months
- **Usage**: `node scripts/historical-cache-backfill.js <start-date> <end-date>`
- **Features**: Skip existing data, error handling, progress tracking

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
- **Sidebar Navigation**: Settings, options, and data controls
- **Table Display**: Clean, organized world records tables
- **Summary View**: Player statistics and rankings
- **Modal Dialogs**: Settings and information panels

### Mobile Interface
- **Tab Navigation**: Records, Summary, and Settings tabs
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
- **Game Modes**: 21 different modes including Classic, Wall, Portal, Cheese, Borderless, Twin, Winged, Yin Yang, Key, Sokoban, Poison, Dimension, Minesweeper, Statue, Light, Shield, Arrow, Hotdog, Magnet, Gate, and Peaceful
- **Apple Amounts**: 1, 3, 5, Dice
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

## Future Plans

### Planned Features
- **Fetch best percentage and most records per user name**

## Acknowledgments

- **Speedrun.com**: For providing the API and data
- **Google**: For the original Snake game and images
- **GitHub**: For hosting and automation services
- **Community**: For feedback and contributions

## Support

For questions, issues, or contributions:
- **Repository**: [GitHub Issues](https://github.com/darkSnakeGang/FastSnakeStats/issues)
- **Website**: [FastSnakeStats](https://stats.googlesnakemods.com/)
- **Author**: Yarmiplay

---

**Made with dedication by Yarmiplay**


