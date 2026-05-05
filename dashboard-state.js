/**
 * dashboard-state.js
 * Manages the data state and filtering logic for the dashboard.
 *
 * Performance notes (15k+ leads):
 * - Search index strings are pre-computed at loadData() time so that
 *   applyFilters() does a simple .includes() instead of rebuilding a string
 *   per-profile per-interaction.
 * - Tab badge counts (all / verified / failed / jobChanged) are cached at
 *   loadData() time and NOT re-computed on every filter/tab change.
 * - Filter option sets (unique jobs, companies, etc.) are built lazily via
 *   requestIdleCallback / setTimeout so the table renders first.
 * - A profileMap (Map<id, profile>) is maintained for O(1) lookups.
 */

window.DashboardState = (() => {
    let allProfiles = [];
    let filteredProfiles = [];
    let currentPage = 1;
    const itemsPerPage = 50;

    // ── O(1) lookup map ───────────────────────────────────────────────────
    /** @type {Map<string, Object>} */
    let _profileMap = new Map();

    // ── Cached filter option sets — rebuilt only when data changes via loadData()
    let _cachedFilterSets = null;

    // ── Cached tab badge counts — rebuilt only at loadData() ──────────────
    let _cachedCounts = { all: 0, verified: 0, failed: 0, jobChanged: 0 };

    // Filters
    let activeTab = 'all';
    let searchQuery = '';
    let filterJob = '';
    let filterCompany = '';
    let filterLocation = '';
    let filterIndustry = '';
    let filterEmployees = '';  // preset band string OR 'custom'
    let customEmpMin = null;   // used when filterEmployees === 'custom'
    let customEmpMax = null;
    let showValidOnly = false;

    // ── Helpers ───────────────────────────────────────────────────────────

    /**
     * Build a lowercase search-index string for a single profile.
     * Stored as `p._searchIndex` so applyFilters() just calls .includes().
     */
    function buildSearchIndex(p) {
        // Include generated emails and verified result emails so users
        // can search by email address (e.g. "adyasa.mund@peopleskafe.com")
        const emails = (p.emails || []).join(' ');
        const resultEmails = (p.results || []).map(r => r.email || '').join(' ');
        return (
            `${p.name || ''} ${p.company || ''} ${p.title || ''} ${p.location || ''} ` +
            `${p.employees || ''} ${p.industry || ''} ` +
            `${(p.companyKeywords || []).join(' ')} ${(p.secondaryIndustries || []).join(' ')} ` +
            `${emails} ${resultEmails}`
        ).toLowerCase();
    }

    /**
     * Build unique, sorted filter option sets from the full profile list.
     * Called once per loadData() instead of on every render.
     * @param {Array} profiles
     * @returns {Object} { jobs, companies, locations, industries }
     */
    function buildFilterSets(profiles) {
        const jobs = new Set();
        const companies = new Set();
        const locations = new Set();
        const industries = new Set();

        for (let i = 0; i < profiles.length; i++) {
            const p = profiles[i];
            if (p.title) jobs.add(p.title);
            if (p.company) companies.add(p.company);
            if (p.location) locations.add(p.location);
            if (p.industry) industries.add(p.industry);
        }

        return {
            jobs: [...jobs].sort(),
            companies: [...companies].sort(),
            locations: [...locations].sort(),
            industries: [...industries].sort()
        };
    }

    /**
     * Compute tab badge counts in a single pass.
     * Only called from loadData(), NOT from filter changes.
     */
    function computeCounts(profiles) {
        let verified = 0;
        let failed = 0;
        let jobChanged = 0;
        for (let i = 0; i < profiles.length; i++) {
            const p = profiles[i];
            if (p.status === 'verified') verified++;
            else if (p.status === 'failed') failed++;
            if (p.jobChanged && p.status === 'verified') jobChanged++;
        }
        return { all: profiles.length, verified, failed, jobChanged };
    }

    // ── Core ──────────────────────────────────────────────────────────────

    async function loadData() {
        if (window.StorageWrapper) {
            allProfiles = await StorageWrapper.getProfiles();
        } else {
            console.error("StorageWrapper not found");
        }

        // Pre-compute search index for every profile (once)
        for (let i = 0; i < allProfiles.length; i++) {
            allProfiles[i]._searchIndex = buildSearchIndex(allProfiles[i]);
        }

        // Build O(1) lookup map
        _profileMap = new Map();
        for (let i = 0; i < allProfiles.length; i++) {
            if (allProfiles[i].id) {
                _profileMap.set(allProfiles[i].id, allProfiles[i]);
            }
        }

        // Cache tab badge counts (single pass)
        _cachedCounts = computeCounts(allProfiles);

        // Build filter sets lazily so the table renders first
        const idleBuild = () => {
            _cachedFilterSets = buildFilterSets(allProfiles);
            // Notify UI that filter options are ready (if UI already rendered)
            if (window.DashboardUI && typeof DashboardUI.populateFilterOptions === 'function') {
                DashboardUI.populateFilterOptions();
            }
        };

        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(idleBuild, { timeout: 2000 });
        } else {
            setTimeout(idleBuild, 0);
        }

        applyFilters();
    }

    function applyFilters() {
        filteredProfiles = allProfiles.filter(p => {
            // Tab Filter
            if (activeTab === 'verified' && p.status !== 'verified') return false;
            if (activeTab === 'failed' && p.status !== 'failed') return false;
            // Job Changed tab: verified leads that still carry the jobChanged flag
            if (activeTab === 'jobChanged' && !(p.jobChanged && p.status === 'verified')) return false;

            // Search — use pre-computed index
            if (searchQuery) {
                if (!p._searchIndex.includes(searchQuery)) return false;
            }

            // Dropdown Filters
            if (filterJob && p.title !== filterJob) return false;
            if (filterCompany && p.company !== filterCompany) return false;
            if (filterLocation && p.location !== filterLocation) return false;
            if (filterIndustry && (p.industry || '').toLowerCase() !== filterIndustry.toLowerCase()) return false;

            // Employee range filter
            if (filterEmployees) {
                const empNum = parseInt(String(p.employees || '').replace(/,/g, '').replace(/\+/g, '').trim(), 10);
                if (!isNaN(empNum)) {
                    if (filterEmployees === 'custom') {
                        if (customEmpMin !== null && empNum < customEmpMin) return false;
                        if (customEmpMax !== null && empNum > customEmpMax) return false;
                    } else if (filterEmployees === '10001+') {
                        if (empNum <= 10000) return false;
                    } else {
                        const [minStr, maxStr] = filterEmployees.split('-');
                        const min = parseInt(minStr, 10);
                        const max = parseInt(maxStr, 10);
                        if (empNum < min || empNum > max) return false;
                    }
                } else if (filterEmployees && filterEmployees !== 'custom') {
                    return false;
                }
            }

            // Show Valid Only checkbox
            if (showValidOnly) {
                if (p.status !== 'verified') return false;
                const hasValid = p.results && p.results.some(r => r.result === 'ok');
                if (!hasValid) return false;
            }

            return true;
        });

        // Update DOM badge counts from cache (no re-scan needed)
        flushCountsToDOM();
    }

    /**
     * Write cached counts to the DOM badges.
     * Does NOT re-scan profiles — uses _cachedCounts from loadData().
     */
    function flushCountsToDOM() {
        const countAll = document.getElementById('count-all');
        const countVerified = document.getElementById('count-verified');
        const countFailed = document.getElementById('count-failed');
        const countJobChanged = document.getElementById('count-job-changed');

        if (countAll) countAll.textContent = _cachedCounts.all;
        if (countVerified) countVerified.textContent = _cachedCounts.verified;
        if (countFailed) countFailed.textContent = _cachedCounts.failed;
        if (countJobChanged) countJobChanged.textContent = _cachedCounts.jobChanged;
    }

    // Legacy compat — external callers that reference updateCounts()
    function updateCounts() {
        flushCountsToDOM();
    }

    return {
        get allProfiles() { return allProfiles; },
        set allProfiles(val) {
            allProfiles = val;
            // Rebuild search index + map + counts when set externally
            for (let i = 0; i < allProfiles.length; i++) {
                allProfiles[i]._searchIndex = buildSearchIndex(allProfiles[i]);
            }
            _profileMap = new Map();
            for (let i = 0; i < allProfiles.length; i++) {
                if (allProfiles[i].id) _profileMap.set(allProfiles[i].id, allProfiles[i]);
            }
            _cachedCounts = computeCounts(allProfiles);
        },
        get filteredProfiles() { return filteredProfiles; },
        get currentPage() { return currentPage; },
        set currentPage(val) { currentPage = val; },
        get itemsPerPage() { return itemsPerPage; },
        
        // Cached filter sets — read-only, rebuilt by loadData()
        get cachedFilterSets() { return _cachedFilterSets; },

        // Cached counts — read-only
        get cachedCounts() { return _cachedCounts; },

        // O(1) profile lookup
        get profileMap() { return _profileMap; },

        // Filter state accessors
        get activeTab() { return activeTab; },
        set activeTab(val) { activeTab = val; },
        get searchQuery() { return searchQuery; },
        set searchQuery(val) { searchQuery = val; },
        get filterJob() { return filterJob; },
        set filterJob(val) { filterJob = val; },
        get filterCompany() { return filterCompany; },
        set filterCompany(val) { filterCompany = val; },
        get filterLocation() { return filterLocation; },
        set filterLocation(val) { filterLocation = val; },
        get filterIndustry() { return filterIndustry; },
        set filterIndustry(val) { filterIndustry = val; },
        get filterEmployees() { return filterEmployees; },
        set filterEmployees(val) { filterEmployees = val; },
        get customEmpMin() { return customEmpMin; },
        set customEmpMin(val) { customEmpMin = val; },
        get customEmpMax() { return customEmpMax; },
        set customEmpMax(val) { customEmpMax = val; },
        get showValidOnly() { return showValidOnly; },
        set showValidOnly(val) { showValidOnly = val; },

        loadData,
        applyFilters,
        updateCounts
    };
})();
