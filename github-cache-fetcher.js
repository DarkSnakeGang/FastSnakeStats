// GitHub Cache Fetcher Module
// Prefers runs-derived WR timelines for FastSnakeStats Time Travel;
// falls back to legacy daily/ snapshots (Pudding*-compatible path).

class GitHubCacheFetcher {
    constructor() {
        this.baseURL = 'https://raw.githubusercontent.com/DarkSnakeGang/FastSnakeStats/refs/heads/main';
        this.cacheDir = 'daily';
        this.metadataURL = `${this.baseURL}/time-travel-cache/metadata/available-dates.json`;
        this.runsDatesURL = `${this.baseURL}/time-travel-cache/metadata/available-dates-runs.json`;
        this.timelinesURL = `${this.baseURL}/time-travel-cache/runs-derived/wr-timelines.json`;
        this.fallbackToAPI = true;
        this._timelines = null;
        this._timelinesPromise = null;
        this._useRunsDerived = null;
        this._runsDates = null;
    }

    async preferRunsDerived() {
        if (this._useRunsDerived != null) return this._useRunsDerived;
        try {
            const local = await fetch('time-travel-cache/metadata/available-dates-runs.json');
            if (local.ok) {
                this._runsDates = await local.json();
                this._useRunsDerived = !!(this._runsDates.availableDates && this._runsDates.availableDates.length);
                return this._useRunsDerived;
            }
        } catch (e) { /* fall through */ }
        try {
            const remote = await fetch(this.runsDatesURL);
            if (remote.ok) {
                this._runsDates = await remote.json();
                this._useRunsDerived = !!(this._runsDates.availableDates && this._runsDates.availableDates.length);
                return this._useRunsDerived;
            }
        } catch (e) { /* fall through */ }
        this._useRunsDerived = false;
        return false;
    }

    async loadTimelines() {
        if (this._timelines) return this._timelines;
        if (this._timelinesPromise) return this._timelinesPromise;
        this._timelinesPromise = (async () => {
            try {
                const local = await fetch('time-travel-cache/runs-derived/wr-timelines.json');
                if (local.ok) {
                    this._timelines = await local.json();
                    return this._timelines;
                }
            } catch (e) { /* fall through */ }
            const remote = await fetch(this.timelinesURL);
            if (!remote.ok) throw new Error('timelines unavailable');
            this._timelines = await remote.json();
            return this._timelines;
        })();
        return this._timelinesPromise;
    }

    wrAsOf(timeline, date) {
        if (!timeline || !timeline.length) return [];
        let lo = 0;
        let hi = timeline.length - 1;
        let best = -1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (timeline[mid].d <= date) {
                best = mid;
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return best >= 0 ? timeline[best].runs : [];
    }

    buildDerivedDay(timelines, date) {
        const boards = (timelines && timelines.boards) || {};
        const records = {};
        for (const category of Object.keys(boards)) {
            const top = this.wrAsOf(boards[category], date);
            const parts = category.split('|');
            records[category] = {
                success: top.length > 0,
                settings: [
                    parts[0],
                    parts[1],
                    parts[2],
                    0,
                    parts[4] === 'High Score' ? 'H' : String(parts[4] || '').replace(/ Apples$/, '')
                ],
                runs: top.map((r) => ({
                    id: r.id,
                    date: date,
                    weblink: r.w,
                    times: { primary: r.t, primary_t: r.pt },
                    players: {
                        data: [
                            r.g || String(r.p).indexOf('guest:') === 0
                                ? {
                                      rel: 'guest',
                                      name: r.n,
                                      'name-style': r.ns || {
                                          style: 'solid',
                                          color: { dark: '#9e9e9e', light: '#9e9e9e' }
                                      }
                                  }
                                : {
                                      rel: 'user',
                                      id: r.p,
                                      names: { international: r.n },
                                      weblink: 'https://www.speedrun.com/user/' + r.n,
                                      'name-style': r.ns || undefined
                                  }
                        ]
                    },
                    values: {}
                }))
            };
        }
        return { date, timestamp: new Date().toISOString(), source: 'runs-derived', records };
    }

    async getAvailableDates() {
        try {
            if (await this.preferRunsDerived()) {
                return (this._runsDates && this._runsDates.availableDates) || [];
            }
            try {
                const localResponse = await fetch('time-travel-cache/metadata/available-dates.json');
                if (localResponse.ok) {
                    const metadata = await localResponse.json();
                    return metadata.availableDates || [];
                }
            } catch (localError) { /* fall through */ }

            const response = await fetch(this.metadataURL);
            if (!response.ok) return [];
            const metadata = await response.json();
            return metadata.availableDates || [];
        } catch (error) {
            console.log('Error fetching available dates:', error);
            return [];
        }
    }

    async getMostRecentDate() {
        try {
            const dates = await this.getAvailableDates();
            if (dates && dates.length > 0) {
                return dates[dates.length - 1];
            }
        } catch (error) {
            console.log('Error fetching most recent date:', error);
        }
        return null;
    }

    async isDateAvailable(date) {
        try {
            const dates = await this.getAvailableDates();
            return dates.includes(date);
        } catch (error) {
            console.log('Error checking date availability:', error);
            return false;
        }
    }

    async fetchCacheForDate(date) {
        try {
            if (await this.preferRunsDerived()) {
                const timelines = await this.loadTimelines();
                console.log(`Built runs-derived snapshot for ${date}`);
                return this.buildDerivedDay(timelines, date);
            }

            const [year, month] = date.split('-');
            const relativePath = `time-travel-cache/${this.cacheDir}/${year}/${month}/${date}.json`;

            try {
                const localResponse = await fetch(relativePath);
                if (localResponse.ok) {
                    console.log(`Loaded local cache for ${date}`);
                    return await localResponse.json();
                }
            } catch (localError) { /* fall through */ }

            const cacheURL = `${this.baseURL}/time-travel-cache/${this.cacheDir}/${year}/${month}/${date}.json`;
            console.log(`Fetching GitHub cache for ${date}...`);
            const response = await fetch(cacheURL);

            if (!response.ok) {
                console.log(`GitHub cache not available for ${date}`);
                if (window.isTimeTravelEnabled && window.selectedTimeTravelDate === date) {
                    if (window.updateTimeTravelButtonStatus) {
                        window.updateTimeTravelButtonStatus('missing');
                    }
                }
                return null;
            }

            const cacheData = await response.json();
            console.log(`Successfully fetched GitHub cache for ${date}`);
            return cacheData;
        } catch (error) {
            console.log(`Error fetching cache for ${date}:`, error);
            if (window.isTimeTravelEnabled && window.selectedTimeTravelDate === date) {
                if (window.updateTimeTravelButtonStatus) {
                    window.updateTimeTravelButtonStatus('missing');
                }
            }
            return null;
        }
    }

    convertCacheFormat(githubCache, targetDate) {
        if (!githubCache || !githubCache.records) {
            return null;
        }

        const convertedData = {};

        for (const [key, record] of Object.entries(githubCache.records)) {
            if (record.success && record.runs && Array.isArray(record.runs)) {
                const convertedRuns = record.runs.map((run) => {
                    if (run.players && run.players.data && Array.isArray(run.players.data) && run.players.data.length > 0) {
                        if (typeof isIgnoredRun === 'function' && isIgnoredRun(run)) {
                            return null;
                        }
                        return {
                            times: run.times,
                            date: run.date || targetDate,
                            id: run.id,
                            weblink: run.weblink,
                            players: run.players,
                            values: run.values || {}
                        };
                    }
                    console.warn(`Legacy format detected for run ${run.id}, skipping`);
                    return null;
                }).filter((run) => run !== null);

                convertedData[key] = convertedRuns;
            } else {
                convertedData[key] = [];
            }
        }

        return convertedData;
    }

    async fetchCurrentWorldRecords() {
        const mostRecentDate = await this.getMostRecentDate();
        if (!mostRecentDate) {
            console.log('No GitHub cache available');
            return null;
        }

        const cacheData = await this.fetchCacheForDate(mostRecentDate);
        if (!cacheData) {
            console.log('Failed to fetch GitHub cache');
            return null;
        }

        return this.convertCacheFormat(cacheData, mostRecentDate);
    }

    async fetchWorldRecordsForDate(date) {
        const cacheData = await this.fetchCacheForDate(date);
        if (!cacheData) {
            console.log(`Failed to fetch GitHub cache for ${date}`);
            return null;
        }

        return this.convertCacheFormat(cacheData, date);
    }

    async isGitHubCacheAvailable() {
        try {
            if (await this.preferRunsDerived()) return true;
            const response = await fetch(this.metadataURL);
            return response.ok;
        } catch (error) {
            console.log('Error checking GitHub cache availability:', error);
            return false;
        }
    }

    async getCacheStats() {
        try {
            if (await this.preferRunsDerived()) {
                return {
                    totalDates: (this._runsDates && this._runsDates.totalDates) || 0,
                    dateRange: (this._runsDates && this._runsDates.dateRange) || null,
                    lastUpdated: (this._runsDates && this._runsDates.lastUpdated) || null,
                    source: 'runs-derived'
                };
            }
            const response = await fetch(this.metadataURL);
            if (!response.ok) return null;
            const metadata = await response.json();
            return {
                totalDates: metadata.totalDates || 0,
                dateRange: metadata.dateRange || null,
                lastUpdated: metadata.lastUpdated || null
            };
        } catch (error) {
            console.log('Error fetching cache stats:', error);
            return null;
        }
    }
}

window.githubCacheFetcher = new GitHubCacheFetcher();
