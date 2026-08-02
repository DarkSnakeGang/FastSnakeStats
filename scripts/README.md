# Scripts

This directory contains utility scripts for the FastSnakeStats project.

## install-nodejs.bat

A Windows batch script that automatically downloads and installs Node.js unattended. This script uses only native Windows commands and doesn't require any additional tools.

### Features

- **Native Windows Support**: Uses only built-in Windows commands (batch, PowerShell, msiexec)
- **Unattended Installation**: Installs Node.js silently without user interaction
- **Version Detection**: Checks if Node.js is already installed before proceeding
- **Error Handling**: Provides clear error messages and troubleshooting steps
- **Automatic Cleanup**: Removes the installer file after installation
- **Installation Logging**: Creates detailed installation logs for troubleshooting

### Usage

```cmd
scripts\install-nodejs.bat
```

### What it does

1. Checks if Node.js is already installed
2. Downloads the latest LTS version of Node.js (v24.18.1 x64)
3. Installs Node.js silently using Windows Installer
4. Verifies the installation was successful
5. Displays installed versions of Node.js and npm
6. Cleans up temporary files

### Requirements

- Windows 7 or later
- Internet connection for download
- Administrator privileges (recommended)

### Notes

- Installs Node.js v24.18.1 (LTS) for x64 architecture
- Uses silent installation mode (`/quiet /norestart`)
- Creates installation logs in `%TEMP%\nodejs-install.log`
- Automatically cleans up the downloaded installer
- If Node.js is already installed, the script will skip installation

### Troubleshooting

If installation fails:
1. Run the script as Administrator
2. Check the installation log: `%TEMP%\nodejs-install.log`
3. Restart your computer and try again
4. Temporarily disable antivirus software
5. Check your internet connection

## generate-available-dates.js

A script that scans the local cache directory structure and generates the `available-dates.json` metadata file. This file is used by the calendar feature to show which dates have cached data available.

### Features

- **Automatic Directory Scanning**: Scans the `time-travel-cache/daily/` directory structure
- **Date Extraction**: Finds all available dates from the cache files
- **Metadata Generation**: Creates a structured JSON file with date information
- **Error Handling**: Handles missing directories and invalid files gracefully
- **Progress Reporting**: Shows detailed progress during scanning

### Usage

```bash
node scripts/generate-available-dates.js
```

### What it does

1. Scans the `time-travel-cache/daily/` directory structure
2. Finds all year/month subdirectories
3. Extracts dates from JSON filenames (YYYY-MM-DD.json format)
4. Generates metadata with:
   - Total number of available dates
   - List of all available dates (sorted)
   - Date range (earliest to latest)
   - Last updated timestamp
5. Saves the metadata to `time-travel-cache/metadata/available-dates.json`

### Output

The script will display:
- Directory scanning progress
- Number of dates found per year/month
- Summary of total dates and date range
- File save confirmation

### Notes

- Creates the metadata directory if it doesn't exist
- Sorts dates chronologically
- Handles empty cache directories gracefully
- Generates valid JSON even with no dates found
- Should be run after adding new cache files

### GitHub Actions Integration

The script is designed to work in both local development and GitHub Actions environments:

- **Local Development**: Uses relative paths from the script location
- **GitHub Actions**: Uses `GITHUB_WORKSPACE` environment variable for correct path resolution

A GitHub Actions workflow (`.github/workflows/update-available-dates.yml`) is included that will:

- **Automatically run** when cache files are added to the repository
- **Run on schedule** daily at 2 AM UTC
- **Run manually** via workflow dispatch
- **Commit and push** updated metadata files automatically

### Next Steps

After running this script:
1. Commit the updated metadata file to your repository
2. Push to GitHub to update the GitHub Pages version
3. The calendar feature will now show the correct available dates

**Note**: If using GitHub Actions, the metadata will be updated automatically when cache files are added to the repository.

## monthly-backfill.js

A script that runs the historical cache backfill for an entire month, automatically calculating the number of days in the specified month and year.

### Features

- **Automatic Day Calculation**: Automatically determines the number of days in any month (handles leap years)
- **Input Validation**: Validates year (1900-2100) and month (1-12) inputs
- **Sequential Processing**: Processes each day of the month one by one
- **Error Handling**: Continues processing even if individual days fail
- **Progress Tracking**: Shows real-time progress and final statistics
- **API Respect**: Includes delays between requests to be respectful to the API

### Usage

```bash
node scripts/monthly-backfill.js <year> <month>
```

### Examples

```bash
# January 2024 (31 days)
node scripts/monthly-backfill.js 2024 1

# December 2023 (31 days)  
node scripts/monthly-backfill.js 2023 12

# February 2025 (28 days - not a leap year)
node scripts/monthly-backfill.js 2025 2

# February 2024 (29 days - leap year)
node scripts/monthly-backfill.js 2024 2

# April 2024 (30 days)
node scripts/monthly-backfill.js 2024 4
```

### What it does

1. Validates the provided year and month
2. Calculates the exact number of days in that month/year
3. Runs `historical-cache-backfill.js` for each day of the month
4. Shows progress for each day being processed
5. Provides a summary of successful and failed days at completion

### Output

The script will display:
- Total days to process
- Progress for each day
- Success/failure status for each day
- Final summary with counts of successful and failed days

### Notes

- This script calls the existing `historical-cache-backfill.js` script for each day
- It does not modify the original backfill script
- Includes 2-second delays between days to be respectful to the API
- Continues processing even if individual days fail
- All cache files are saved to the `time-travel-cache/daily/` directory structure

### Error Handling

If a day fails to process, the script will:
- Log the error
- Continue with the next day
- Include the failure in the final statistics
- Not stop the entire process

## player-stats-analyzer.js

A script that analyzes all available cached world record data to generate comprehensive player statistics, including peak performance metrics for each player.

### Features

- **Comprehensive Analysis**: Scans all available cached dates to find every player who ever submitted a world record
- **Peak Performance Tracking**: Identifies each player's best day in terms of record count and percentage
- **Efficient Processing**: Uses memory-efficient data structures to handle large datasets
- **Progress Reporting**: Shows real-time progress during analysis
- **Error Handling**: Continues processing even if individual cache files are corrupted
- **GitHub Actions Integration**: Designed to run automatically in CI/CD pipelines

### Usage

```bash
node scripts/player-stats-analyzer.js
```

### What it does

1. Loads the list of available dates from `time-travel-cache/metadata/available-dates.json`
2. Processes each cached date file to extract player information
3. Tracks for each player:
   - Total number of world records across all time
   - Number of different dates they had records
   - Date with the most records (count and date)
   - Date with the highest percentage of total records (percentage and date)
4. Generates a comprehensive JSON report with all player statistics
5. Saves results to `time-travel-cache/metadata/player-stats.json`

### Output Structure

The generated `player-stats.json` file contains:

```json
{
  "lastUpdated": "2025-08-25T20:21:34.154Z",
  "totalPlayers": 193,
  "players": [
    {
      "id": "8r7zeqqj",
      "name": "moterstorm",
      "totalRecords": 63293,
      "totalDates": 197,
      "peakRecords": {
        "date": "2025-05-29",
        "count": 331
      },
      "peakPercentage": {
        "date": "2025-01-22",
        "percentage": 11.17
      }
    }
  ]
}
```

### Statistics Explained

For each player, the script calculates:

- **totalRecords**: Total number of world records across all dates
- **totalDates**: Number of different dates they had at least one record
- **peakRecords**: The date they had the most records and how many
- **peakPercentage**: The date they had the highest percentage of total records for that day

### GitHub Actions Integration

The script is integrated with GitHub Actions via `.github/workflows/analyze-player-stats.yml`:

- **Automatic Execution**: Runs after the `update-available-dates` workflow completes
- **Manual Trigger**: Can be run manually via workflow dispatch
- **Conditional Execution**: Only runs if the triggering workflow succeeded
- **Automatic Commits**: Commits and pushes updated statistics automatically

### Performance

- **Memory Efficient**: Uses Maps and Sets for optimal memory usage
- **Progress Tracking**: Shows progress every 50 dates processed
- **Error Resilience**: Continues processing even if individual files fail
- **Large Dataset Support**: Successfully processes 258+ dates with 193+ players

### Notes

- The script processes all available cached data, so runtime depends on the number of dates
- Results are sorted by total records (descending) for easy identification of top players
- Percentages are rounded to 2 decimal places for readability
- The script handles missing or corrupted cache files gracefully
- Player names are extracted from the international name field when available
