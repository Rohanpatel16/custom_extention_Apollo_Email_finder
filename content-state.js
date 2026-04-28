/**
 * content-state.js
 * Shared state for the content script modules.
 */

window.ContentState = (() => {
    return {
        profiles: [],
        isVerifying: false,
        autoScraping: false,
        autoScrapePageCount: 0,
        autoScrapeMode: 'batch',
        sessionDomains: new Set(),
        allExcludedDomains: new Set(),
        activeKey: null,
        activeKeyIndex: -1,
        
        SCRAPE_CONFIG: {
            PAGE_LOAD_DELAY: 2500,
            NAV_WAIT_DELAY: 3500,
            FILTER_WAIT_DELAY: 4500,
            RETRY_DELAY: 5000
        },
        
        resetBatch() {
            this.autoScrapePageCount = 0;
        },
        
        addProfiles(newProfiles) {
            this.profiles = [...this.profiles, ...newProfiles];
        }
    };
})();
