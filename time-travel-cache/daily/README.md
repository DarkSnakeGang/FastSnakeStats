# Time Travel Cache

This directory contains historical world records data for Google Snake, organized by date.

## Structure

```
time-travel-cache/
├── daily/
│   ├── 2024/
│   │   ├── 01/
│   │   │   ├── 2024-01-15.json
│   │   │   └── 2024-01-16.json
│   │   └── 02/
│   │       └── 2024-02-01.json
│   └── ...
└── metadata/
    ├── available-dates.json
    └── year-statistics.json
```

## Statistics

- **Total Dates Available**: 2
- **Date Range**: 2020-07-20 to 2025-08-22
- **Years Covered**: 2

## File Format

Each JSON file contains world records for a specific date in the following format:

```json
{
  "date": "2024-01-15",
  "timestamp": "2024-01-16T00:00:00.000Z",
  "records": {
    "1 Apple|Normal|Standard|Any%|1 Apples": {
      "success": true,
      "runs": [...],
      "settings": ["1 Apple", "Normal", "Standard", "Any%", "1"]
    }
  }
}
```

## Usage

This cache is automatically updated daily by GitHub Actions and can be accessed by FastSnakeStats for time travel functionality.

Last updated: 2025-08-23T16:12:03.033Z
