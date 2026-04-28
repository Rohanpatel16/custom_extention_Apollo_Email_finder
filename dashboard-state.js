/**
 * dashboard-state.js
 * Manages the data state and filtering logic for the dashboard.
 */

window.DashboardState = (() => {
    let allProfiles = [];
    let filteredProfiles = [];
    let currentPage = 1;
    const itemsPerPage = 50;

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

    async function loadData() {
        if (window.StorageWrapper) {
            allProfiles = await StorageWrapper.getProfiles();
        } else {
            console.error("StorageWrapper not found");
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

            // Search
            if (searchQuery) {
                const searchStr = (
                    `${p.name} ${p.company} ${p.title} ${p.location} ${p.employees || ''} ${p.industry || ''}` +
                    ` ${(p.companyKeywords || []).join(' ')} ${(p.secondaryIndustries || []).join(' ')}`
                ).toLowerCase();
                if (!searchStr.includes(searchQuery)) return false;
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

        updateCounts();
    }

    function updateCounts() {
        // Single-pass count: verified, failed, and job-changed-and-verified
        let verified = 0;
        let failed = 0;
        let jobChanged = 0;
        allProfiles.forEach(p => {
            if (p.status === 'verified') verified++;
            else if (p.status === 'failed') failed++;
            if (p.jobChanged && p.status === 'verified') jobChanged++;
        });

        const countAll = document.getElementById('count-all');
        const countVerified = document.getElementById('count-verified');
        const countFailed = document.getElementById('count-failed');
        const countJobChanged = document.getElementById('count-job-changed');

        if (countAll) countAll.textContent = allProfiles.length;
        if (countVerified) countVerified.textContent = verified;
        if (countFailed) countFailed.textContent = failed;
        if (countJobChanged) countJobChanged.textContent = jobChanged;
    }

    return {
        get allProfiles() { return allProfiles; },
        set allProfiles(val) { allProfiles = val; },
        get filteredProfiles() { return filteredProfiles; },
        get currentPage() { return currentPage; },
        set currentPage(val) { currentPage = val; },
        get itemsPerPage() { return itemsPerPage; },
        
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
