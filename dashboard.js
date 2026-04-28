/**
 * dashboard.js
 * Main entry point for the Apollo CRM Dashboard.
 * Orchestrates initialization and event routing to specialized modules.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Settings Module
    DashboardSettings.init();

    // 2. Initial Data Load
    await DashboardState.loadData();
    DashboardUI.populateFilterOptions();
    DashboardUI.render();

    // 3. Global Event Listeners
    setupTabListeners();
    setupFilterListeners();
    setupActionListeners();
    setupPaginationListeners();
    setupThemeToggle();
    setupStorageListener();
});

function setupStorageListener() {
    // Fix 3: Debounce storage events so rapid scraping writes don't freeze the tab.
    // 500 ms is imperceptible to the user but collapses bursts into a single refresh.
    let storageDebounce;
    chrome.storage.onChanged.addListener(async (changes, area) => {
        if (area === 'local' && changes.av_profiles) {
            clearTimeout(storageDebounce);
            storageDebounce = setTimeout(async () => {
                console.log('[Dashboard] Storage changed, refreshing...');
                await DashboardState.loadData();
                DashboardUI.render();
                DashboardUI.populateFilterOptions();
            }, 500);
        }
    });
}

function setupTabListeners() {
    document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
        item.addEventListener('click', (e) => {
            const tab = e.target.closest('.nav-item').dataset.tab;
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            e.target.closest('.nav-item').classList.add('active');
            
            DashboardState.activeTab = tab;
            DashboardState.currentPage = 1;
            DashboardState.applyFilters();
            DashboardUI.render();
        });
    });
}

function setupFilterListeners() {
    // Search
    // Fix 1: Debounce so applyFilters()+render() fire only after 250 ms of inactivity.
    // Eliminates a full DOM rebuild on every single keystroke.
    let searchDebounce;
    document.getElementById('global-search').addEventListener('input', (e) => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
            DashboardState.searchQuery = e.target.value.toLowerCase();
            DashboardState.currentPage = 1;
            DashboardState.applyFilters();
            DashboardUI.render();
        }, 250);
    });

    // Dropdowns
    ['job', 'company', 'location', 'industry'].forEach(field => {
        const el = document.getElementById(`filter-${field}`);
        if (el) {
            el.addEventListener('change', (e) => {
                const setter = `filter${field.charAt(0).toUpperCase() + field.slice(1)}`;
                DashboardState[setter] = e.target.value;
                DashboardState.currentPage = 1;
                DashboardState.applyFilters();
                DashboardUI.render();
            });
        }
    });

    // Employees
    document.getElementById('filter-employees').addEventListener('change', (e) => {
        const val = e.target.value;
        DashboardState.filterEmployees = val;
        const customRow = document.getElementById('custom-emp-range');
        if (val === 'custom') {
            customRow.style.display = 'flex';
        } else {
            customRow.style.display = 'none';
            DashboardState.customEmpMin = null;
            DashboardState.customEmpMax = null;
            DashboardState.currentPage = 1;
            DashboardState.applyFilters();
            DashboardUI.render();
        }
    });

    document.getElementById('emp-apply-btn').addEventListener('click', () => {
        const minVal = document.getElementById('emp-min').value;
        const maxVal = document.getElementById('emp-max').value;
        DashboardState.customEmpMin = minVal !== '' ? parseInt(minVal, 10) : null;
        DashboardState.customEmpMax = maxVal !== '' ? parseInt(maxVal, 10) : null;
        DashboardState.currentPage = 1;
        DashboardState.applyFilters();
        DashboardUI.render();
    });

    document.getElementById('emp-clear-btn').addEventListener('click', () => {
        document.getElementById('emp-min').value = '';
        document.getElementById('emp-max').value = '';
        document.getElementById('filter-employees').value = '';
        document.getElementById('custom-emp-range').style.display = 'none';
        DashboardState.filterEmployees = '';
        DashboardState.customEmpMin = null;
        DashboardState.customEmpMax = null;
        DashboardState.currentPage = 1;
        DashboardState.applyFilters();
        DashboardUI.render();
    });

    document.getElementById('show-valid-only').addEventListener('change', (e) => {
        DashboardState.showValidOnly = e.target.checked;
        DashboardState.currentPage = 1;
        DashboardState.applyFilters();
        DashboardUI.render();
    });
}

function setupActionListeners() {
    document.getElementById('refresh-btn').addEventListener('click', async () => {
        await DashboardState.loadData();
        DashboardUI.render();
        alert('Data refreshed from storage');
    });

    document.getElementById('sync-cloud-btn').addEventListener('click', DashboardAPI.syncCloud);

    document.getElementById('clear-all-btn').addEventListener('click', async () => {
        if (confirm("Clear local leads? (Don't worry, your cloud backup in Turso will be preserved)")) {
            await StorageWrapper.clearAllProfiles();
            DashboardState.allProfiles = [];
            DashboardState.applyFilters();
            DashboardUI.render();
        }
    });

    document.getElementById('clean-links-btn').addEventListener('click', DashboardAPI.cleanLinkedInLinks);

    // Import/Export
    document.getElementById('export-btn').addEventListener('click', () => {
        document.getElementById('export-modal').classList.remove('hidden');
    });
    document.getElementById('close-export-modal').addEventListener('click', () => {
        document.getElementById('export-modal').classList.add('hidden');
    });
    document.getElementById('confirm-export').addEventListener('click', DashboardAPI.handleExport);

    const importBtn = document.getElementById('import-btn');
    const importInput = document.getElementById('import-input');
    if (importBtn && importInput) {
        importBtn.addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', DashboardAPI.handleImport);
    }
}

function setupPaginationListeners() {
    document.getElementById('prev-page').addEventListener('click', () => {
        if (DashboardState.currentPage > 1) {
            DashboardState.currentPage--;
            DashboardUI.render();
        }
    });
    document.getElementById('next-page').addEventListener('click', () => {
        const { currentPage, itemsPerPage, filteredProfiles } = DashboardState;
        if (currentPage * itemsPerPage < filteredProfiles.length) {
            DashboardState.currentPage++;
            DashboardUI.render();
        }
    });
}

function setupThemeToggle() {
    const btn = document.getElementById('toggle-dark-mode');
    btn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
    });
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
    }
}

// Global helpers for legacy HTML inline events
window.copyToClipboard = DashboardUI.copyToClipboard;
window.deleteProfile = DashboardAPI.deleteProfile;
