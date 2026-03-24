
(function () {
    // -------------------------------------------------------------------------
    // 0. Icons (SVG)
    // -------------------------------------------------------------------------
    const ICONS = {
        close: `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`,
        help: `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
        save: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>`, // Using download icon for save broadly
        extract: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>`,
        verify: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
        download: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>`,
        spinner: `<svg class="av-spin" width="16" height="16" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`
    };

    // -------------------------------------------------------------------------
    // 1. Sidebar HTML Structure
    // -------------------------------------------------------------------------
    const sidebarHTML = `
        <div id="apollo-verifier-sidebar">
            <div class="av-header">
                <div class="av-brand">
                    <span style="font-size:20px;">🚀</span>
                    <h2 class="av-title">Apollo Verifier</h2>
                </div>
                <div style="display:flex; gap:8px;">
                    <button id="av-help-btn" class="av-close-btn" title="Help">${ICONS.help}</button>
                    <button id="av-close-btn" class="av-close-btn" title="Close">${ICONS.close}</button>
                </div>
            </div>
            
            <div class="av-content">
                <!-- Help Section -->
                <div id="av-help-section" class="av-card av-hidden" style="background:#EFF6FF; border-color:#BFDBFE;">
                    <h3 style="margin-top:0; font-size:14px; color:#1E40AF;">How to use</h3>
                    <ol style="padding-left:20px; margin-bottom:0; font-size:13px; color:#1E3A8A;">
                        <li>Enter your Apify API Token.</li>
                        <li>Click <b>Extract Profiles</b> to grab visible rows.</li>
                        <li>Select profiles and click <b>Verify</b>.</li>
                    </ol>
                </div>

                <!-- API Key Section -->
                <div class="av-card">
                    <label class="av-label">Active API Key</label>
                    <div style="display:flex; gap:5px; margin-bottom:5px;">
                        <select id="av-key-selector" class="av-input" style="flex:1; cursor:pointer;">
                            <option value="">Loading keys...</option>
                        </select>
                        <button id="av-refresh-keys-btn" class="av-btn av-btn-secondary" title="Refresh Keys" style="width:30px; padding:0;">🔄</button>
                    </div>
                    <div id="av-key-status" style="font-size:11px; margin-bottom:8px; color:#6b7280;">Status: -</div>
                    <button id="av-manage-keys-btn" class="av-btn av-btn-secondary" style="font-size:12px;">⚙️ Manage Keys in Dashboard</button>
                </div>

                <!-- Actions Section -->
                <div class="av-card">
                    <label class="av-label">Actions</label>
                    <button id="av-extract-btn" class="av-btn av-btn-primary">
                        ${ICONS.extract} Extract Profiles
                    </button>
                    <div style="display:flex; gap:5px; margin-top:8px;">
                        <button id="av-next-page-btn" class="av-btn av-btn-secondary" style="flex:1;">
                            Next Page ➡️
                        </button>
                        <button id="av-open-crm-btn" class="av-btn av-btn-secondary" style="flex:1;">
                            📊 Open CRM
                        </button>
                    </div>
                    <div style="margin-top:10px; padding:8px; background:#F0FDF4; border:1px solid #BBF7D0; border-radius:8px;">
                        <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:#166534; cursor:pointer;">
                            <input type="checkbox" id="av-autoscrape-toggle" class="av-checkbox">
                            🤖 Auto-Scrape Mode
                        </label>
                        <div style="margin-top:6px; padding-left:4px; display:flex; flex-direction:column; gap:4px; font-size:12px; color:#374151;">
                            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                <input type="radio" id="av-mode-batch" name="av-scrape-mode" value="batch" checked style="accent-color:#16a34a;">
                                <span><b>Batch</b> — 5 pages → verify once → advance</span>
                            </label>
                            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                <input type="radio" id="av-mode-perpage" name="av-scrape-mode" value="perpage" style="accent-color:#16a34a;">
                                <span><b>Per Page</b> — verify after each page</span>
                            </label>
                        </div>
                        <div id="av-autoscrape-status" style="margin-top:4px; font-size:11px; color:#6B7280; padding-left:2px;">Idle — enable to start</div>
                    </div>
                    <div id="av-status-text" style="margin-top:8px; font-size:12px; color:#6B7280; text-align:center;">Ready to extract</div>
                </div>

                <!-- Results Section -->
                <div id="av-results-area" class="av-hidden">
                    <div class="av-list-header">
                        <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:500;">
                            <input type="checkbox" id="av-select-all" class="av-checkbox" checked> Select All
                        </label>
                        <div style="display:flex; gap:10px;">
                             <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:500;">
                                <input type="checkbox" id="av-show-valid-only" class="av-checkbox" checked> Valid Only
                            </label>
                            <button id="av-clear-list-btn" class="av-close-btn" title="Clear View Only" style="font-size:12px; height:auto; padding:0 5px;">🗑️ Clear View</button>
                        </div>
                    </div>

                    <div id="av-profile-list" class="av-data-list">
                        <!-- Items injected here -->
                    </div>

                    <div style="margin-top:16px; display:flex; flex-direction:column; gap:8px;">
                         <button id="av-verify-btn" class="av-btn av-btn-primary">
                            ${ICONS.verify} Verify Selected
                        </button>
                         <button id="av-retry-btn" class="av-btn av-btn-retry av-hidden">
                            Retry Failed
                        </button>
                        <button id="av-download-btn" class="av-btn av-btn-secondary">
                            ${ICONS.download} Download CSV
                        </button>
                    </div>
                </div>
            </div>

            <!-- Toast Container -->
            <div id="av-toast-container"></div>
        </div>
    `;

    // -------------------------------------------------------------------------
    // 2. State & Utils
    // -------------------------------------------------------------------------
    let state = {
        token: "",
        profiles: [],
        isVerifying: false,
        autoScraping: false,
        autoScrapePageCount: 0,
        autoScrapeMode: 'batch'   // 'batch' = 5 pages then verify | 'perpage' = verify after each page
    };

    function showToast(message, type = 'neutral') {
        const container = document.getElementById('av-toast-container');
        const toast = document.createElement('div');
        toast.className = `av-toast ${type}`;

        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '⚠️';

        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
        container.appendChild(toast);

        // Animate
        requestAnimationFrame(() => toast.classList.add('show'));

        // Remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // -------------------------------------------------------------------------
    // 3. Initialization
    // -------------------------------------------------------------------------
    function init() {
        if (document.getElementById('apollo-verifier-sidebar')) return;

        const div = document.createElement('div');
        div.innerHTML = sidebarHTML;
        document.body.appendChild(div.firstElementChild);

        // Load Keys
        loadActiveKeys();

        // Load Profiles (Sidebar Session only)
        if (window.StorageWrapper) {
            StorageWrapper.getSidebarSession().then(profiles => {
                state.profiles = profiles;
                if (state.profiles.length > 0) {
                    document.getElementById('av-results-area').classList.remove('av-hidden');
                    document.getElementById('av-status-text').textContent = `Loaded ${state.profiles.length} profiles (Session)`;
                    renderList();
                }
            });
        }

        setupEventListeners();
    }

    async function loadActiveKeys() {
        if (!window.StorageWrapper) return;

        const keys = await StorageWrapper.getApiKeys();
        const selector = document.getElementById('av-key-selector');
        selector.innerHTML = '';

        if (keys.length === 0) {
            const opt = document.createElement('option');
            opt.text = "No keys found";
            selector.appendChild(opt);
            updateKeyStatus(null);
            return;
        }

        keys.forEach((k, idx) => {
            const opt = document.createElement('option');
            opt.value = idx; // Use index as value to easily retrieve object
            const statusIcon = k.status === 'active' ? '🟢' : (k.status === 'exhausted' ? '🔴' : '⚫');
            opt.text = `${statusIcon} ${k.label}`;
            selector.appendChild(opt);
        });

        // Auto-select first active or keep previous selection if possible?
        // Simple: Select first ACTIVE key logic is handled by getActiveKey, but here we let user choose?
        // Let's default to the *first active* one.
        const activeIdx = keys.findIndex(k => k.status === 'active');
        if (activeIdx > -1) {
            selector.value = activeIdx;
            state.activeKey = keys[activeIdx];
            state.activeKeyIndex = activeIdx;
        } else {
            // All exhausted or disabled
            state.activeKey = keys[0]; // Just select first
            state.activeKeyIndex = 0;
        }

        updateKeyStatus(state.activeKey);
    }

    function updateKeyStatus(key) {
        const el = document.getElementById('av-key-status');
        if (!key) {
            el.textContent = "Status: No Key";
            el.style.color = "#6b7280";
            return;
        }

        const color = key.status === 'active' ? '#10b981' : '#ef4444';
        el.textContent = `Status: ${key.status.toUpperCase()} ${key.renewDate ? '(Renew: ' + key.renewDate + ')' : ''}`;
        el.style.color = color;
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "toggle_sidebar") {
            const sidebar = document.getElementById('apollo-verifier-sidebar');
            if (sidebar) {
                sidebar.classList.toggle('open');
            } else {
                init();
                setTimeout(() => document.getElementById('apollo-verifier-sidebar').classList.add('open'), 10);
            }
        }
    });

    // -------------------------------------------------------------------------
    // 4. Event Listeners
    // -------------------------------------------------------------------------
    function setupEventListeners() {
        // Toggle Sidebar
        document.getElementById('av-close-btn').addEventListener('click', () => {
            document.getElementById('apollo-verifier-sidebar').classList.remove('open');
        });

        // Help Toggle
        document.getElementById('av-help-btn').addEventListener('click', () => {
            document.getElementById('av-help-section').classList.toggle('av-hidden');
        });

        // Manage Keys
        document.getElementById('av-manage-keys-btn').addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: "open_dashboard" });
        });

        // Refresh Keys
        document.getElementById('av-refresh-keys-btn').addEventListener('click', () => {
            loadActiveKeys();
            showToast("Keys refreshed", "neutral");
        });

        // Key Selection Change
        document.getElementById('av-key-selector').addEventListener('change', async (e) => {
            const idx = parseInt(e.target.value);
            const keys = await StorageWrapper.getApiKeys();
            if (keys[idx]) {
                state.activeKey = keys[idx];
                state.activeKeyIndex = idx;
                updateKeyStatus(state.activeKey);
            }
        });

        // Extract
        document.getElementById('av-extract-btn').addEventListener('click', () => extractProfiles(false));

        // Open CRM
        document.getElementById('av-open-crm-btn').addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: "open_dashboard" });
        });

        // Next Page (Pagination)
        document.getElementById('av-next-page-btn').addEventListener('click', handleNextPage);

        // Auto-Scrape Toggle
        document.getElementById('av-autoscrape-toggle').addEventListener('change', (e) => {
            if (e.target.checked) {
                state.autoScraping = true;
                runAutoScrape();
            } else {
                state.autoScraping = false;
                setAutoScrapeStatus('Stopping after current page…');
            }
        });

        // Auto-Scrape Mode radios
        document.querySelectorAll('input[name="av-scrape-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                state.autoScrapeMode = e.target.value;
            });
        });

        // Select All
        document.getElementById('av-select-all').addEventListener('change', (e) => {
            state.profiles.forEach(p => p.selected = e.target.checked); // Corrected 'checked' to 'e.target.checked'
            renderList();
        });

        // Show Valid Only
        document.getElementById('av-show-valid-only').addEventListener('change', renderList);

        // Clear List (Session Only)
        document.getElementById('av-clear-list-btn').addEventListener('click', async () => {
            if (confirm("Clear sidebar list? (Data remains in CRM)")) {
                state.profiles = [];
                if (window.StorageWrapper) await StorageWrapper.clearSidebarSession();
                renderList();
                document.getElementById('av-results-area').classList.add('av-hidden');
                document.getElementById('av-status-text').textContent = 'Ready to extract';
                showToast("Sidebar cleared", "neutral");
            }
        });

        // Verify
        document.getElementById('av-verify-btn').addEventListener('click', () => verifyProfiles(false));
        document.getElementById('av-retry-btn').addEventListener('click', () => verifyProfiles(true));

        // Download CSV
        document.getElementById('av-download-btn').addEventListener('click', downloadCSV);
    }

    // -------------------------------------------------------------------------
    // 5. Core Logic
    // -------------------------------------------------------------------------

    // Pagination State
    let pageCount = 0;
    const MAX_PAGES = 5;

    async function handleNextPage() {
        if (!state.autoScraping && pageCount >= MAX_PAGES) {
            showToast(`Free limit reached (${MAX_PAGES} pages). Use Auto-Scrape for more.`, "error");
            return;
        }

        const nextBtn = document.querySelector('[aria-label="Next"]') ||
            document.querySelector('.zp-button:has(.apollo-icon-chevron-right)') ||
            Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Next') || b.querySelector('.apollo-icon-chevron-right'));

        if (nextBtn) {
            nextBtn.click();
            if (!state.autoScraping) showToast("Navigating to next page...", "neutral");
            pageCount++;
        } else {
            showToast("Next page button not found.", "error");
        }
    }

    // -------------------------------------------------------------------------
    // Auto-Scrape Helpers
    // -------------------------------------------------------------------------

    /**
     * Reads employee count cells and returns the highest number visible.
     * Strategy:
     * 1. Try data-id="account.estimated_num_employees" (Apollo standard)
     * 2. Dynamically find column by scanning headers for "employee" text
     * 3. Last resort: brute-force scan all cells for number-only values
     */
    function getHighestEmployeeCount() {
        const parseCount = raw => {
            const n = parseInt(String(raw).replace(/,/g, '').replace(/\+/g, '').trim(), 10);
            return isNaN(n) ? null : n;
        };

        const counts = [];

        // Strategy 1: Apollo renders employee count in cells with this data-id
        document.querySelectorAll('[data-id="account.estimated_num_employees"]').forEach(cell => {
            const n = parseCount(cell.textContent);
            if (n && n > 0) counts.push(n);
        });

        if (counts.length > 0) {
            console.log('[AutoScrape] Employee counts via data-id:', counts);
            return Math.max(...counts);
        }

        // Strategy 2: Find which column header says "employee", then read that column
        let employeeColIndex = null;
        document.querySelectorAll('[role="columnheader"]').forEach(header => {
            const text = header.textContent.toLowerCase();
            if (text.includes('employee')) {
                const idx = header.getAttribute('aria-colindex');
                if (idx) employeeColIndex = idx;
            }
        });

        if (employeeColIndex) {
            document.querySelectorAll('[role="row"]').forEach(row => {
                if (row.querySelector('[role="columnheader"]')) return;
                const cell = row.querySelector(`[aria-colindex="${employeeColIndex}"]`);
                if (cell) {
                    const n = parseCount(cell.textContent);
                    if (n && n > 0) counts.push(n);
                }
            });
        }

        if (counts.length > 0) {
            console.log(`[AutoScrape] Employee counts via header colindex ${employeeColIndex}:`, counts);
            return Math.max(...counts);
        }

        // Strategy 3: Brute-force — look for cells containing only a number (1-6 digits)
        document.querySelectorAll('[role="row"]').forEach(row => {
            if (row.querySelector('[role="columnheader"]')) return;
            row.querySelectorAll('[role="cell"], [role="gridcell"]').forEach(cell => {
                const text = cell.textContent.trim().replace(/,/g, '');
                if (/^\d{1,6}\+?$/.test(text)) {
                    const n = parseCount(text);
                    if (n && n > 0) counts.push(n);
                }
            });
        });

        if (counts.length > 0) {
            console.log('[AutoScrape] Employee counts via brute-force scan:', counts);
            return Math.max(...counts);
        }

        console.warn('[AutoScrape] Could not detect employee counts on this page.');
        return null;
    }

    /**
     * Advances the organizationNumEmployeesRanges[] MIN to newMin and resets page=1.
     * URL format: organizationNumEmployeesRanges[]=MIN%2C  (%2C = comma, no upper bound)
     */
    function advanceEmployeeFilter(newMin) {
        let hash = window.location.hash;

        // Replace the min in organizationNumEmployeesRanges[]=OLD%2C
        hash = hash.replace(
            /organizationNumEmployeesRanges\[\]=[^&]*/,
            `organizationNumEmployeesRanges[]=${encodeURIComponent(newMin + ',')}`
        );

        // Reset page to 1
        hash = hash.replace(/page=\d+/, 'page=1');

        window.location.hash = hash;
        console.log(`[AutoScrape] Advanced filter: new min=${newMin}, page reset to 1`);
    }

    /**
     * Reads current min from the URL's organizationNumEmployeesRanges[]=MIN%2C
     */
    function getCurrentMinFromUrl() {
        const hash = decodeURIComponent(window.location.hash);
        const match = hash.match(/organizationNumEmployeesRanges\[\]=(\d+),/);
        return match ? parseInt(match[1], 10) : 0;
    }

    /**
     * Reads the current page number from page=N in the URL hash.
     * Returns 1 if not found.
     */
    function getCurrentPageFromUrl() {
        const hash = decodeURIComponent(window.location.hash);
        const match = hash.match(/[?&]page=(\d+)/);
        return match ? parseInt(match[1], 10) : 1;
    }

    /**
     * Updates the Auto-Scrape status label.
     */
    function setAutoScrapeStatus(text) {
        const el = document.getElementById('av-autoscrape-status');
        if (el) el.textContent = text;
    }

    /**
     * Main Auto-Scrape loop:
     * - Collects 5 pages of profiles (no verify during collection)
     * - Then batch-verifies ALL collected profiles at once
     * - Then advances the employee filter and repeats
     */
    async function runAutoScrape() {
        // Guard: must be sorted by employees ascending
        const hash = window.location.hash;
        if (!hash.includes('sortAscending=true') || !hash.includes('sortByField=organization_estimated_number_employees')) {
            showToast('Auto-Scrape requires: Sort by Employees, Ascending ↑', 'error');
            setAutoScrapeStatus('Error: wrong sort order');
            document.getElementById('av-autoscrape-toggle').checked = false;
            state.autoScraping = false;
            return;
        }

        state.autoScrapePageCount = 0;
        pageCount = 0;
        setAutoScrapeStatus('Starting…');
        showToast('🤖 Auto-Scrape started', 'success');

        const wait = ms => new Promise(r => setTimeout(r, ms));

        // Helper: find and click the Next Page button
        const clickNext = async () => {
            const nextBtn = document.querySelector('[aria-label="Next"]') ||
                document.querySelector('.zp-button:has(.apollo-icon-chevron-right)') ||
                Array.from(document.querySelectorAll('button')).find(b =>
                    b.textContent.includes('Next') || b.querySelector('.apollo-icon-chevron-right'));
            if (nextBtn) {
                nextBtn.click();
                await wait(3000);
                return true;
            }
            showToast('Auto-Scrape: Next button not found — stopping.', 'error');
            state.autoScraping = false;
            return false;
        };

        if (state.autoScrapeMode === 'batch') {
            // ── BATCH MODE ──────────────────────────────────────────────────
            // Collect 5 pages silently, then verify once, then advance filter.
            while (state.autoScraping) {
                let newProfilesInBatch = 0;
                while (state.autoScraping) {
                    const currentPage = getCurrentPageFromUrl();
                    setAutoScrapeStatus(`[Batch] Collecting page ${currentPage}/5… (Min: ${getCurrentMinFromUrl()})`);
                    await wait(2500);
                    const newlyExtracted = await extractProfiles(true);
                    newProfilesInBatch += newlyExtracted || 0;
                    if (currentPage >= 5) break;
                    setAutoScrapeStatus(`[Batch] Page ${currentPage} done — going to next…`);
                    if (!(await clickNext())) break;
                }

                if (!state.autoScraping) break;

                const maxCount = getHighestEmployeeCount();
                const currentMin = getCurrentMinFromUrl();
                setAutoScrapeStatus(`[Batch] 5 pages done. Max: ${maxCount ?? '?'}. Verifying…`);
                
                const success = await verifyProfiles(false);
                if (!success) {
                    showToast('🤖 Auto-Scrape: API Error — stopping safety stop.', 'error');
                    setAutoScrapeStatus('Stopped: API Error ❌');
                    state.autoScraping = false;
                    document.getElementById('av-autoscrape-toggle').checked = false;
                    break;
                }
                
                if (newProfilesInBatch === 0) {
                    showToast('🤖 Auto-Scrape complete — NO new profiles found. Results are still there so please change filter and make the profiles a little smaller.', 'warning');
                    setAutoScrapeStatus('Complete ✅ — No new profiles. Reduce filter.');
                    state.autoScraping = false;
                    document.getElementById('av-autoscrape-toggle').checked = false;
                    break;
                }

                if (maxCount !== null && maxCount > currentMin) {
                    setAutoScrapeStatus(`[Batch] Advancing filter: ${currentMin} → ${maxCount}…`);
                    await wait(1000);
                    advanceEmployeeFilter(maxCount);
                    state.autoScrapePageCount = 0;
                    pageCount = 0;
                    await wait(3500);
                } else {
                    showToast('🤖 Auto-Scrape complete — no more results.', 'success');
                    setAutoScrapeStatus('Complete ✅');
                    state.autoScraping = false;
                    document.getElementById('av-autoscrape-toggle').checked = false;
                    break;
                }
            }
        } else {
            // ── PER-PAGE MODE ───────────────────────────────────────────────
            // Verify after EACH page, then go to next. After page 5, advance filter.
            while (state.autoScraping) {
                let newProfilesInBatch = 0;
                while (state.autoScraping) {
                    const currentPage = getCurrentPageFromUrl();
                    setAutoScrapeStatus(`[Per-Page] Page ${currentPage}/5… (Min: ${getCurrentMinFromUrl()})`);
                    await wait(2500);
                    const newlyExtracted = await extractProfiles(true);
                    newProfilesInBatch += newlyExtracted || 0;

                    // Verify this page's profiles immediately
                    setAutoScrapeStatus(`[Per-Page] Page ${currentPage} — verifying…`);
                    const success = await verifyProfiles(false);
                    if (!success) {
                        showToast('🤖 Auto-Scrape: API Error — stopping safety stop.', 'error');
                        setAutoScrapeStatus('Stopped: API Error ❌');
                        state.autoScraping = false;
                        document.getElementById('av-autoscrape-toggle').checked = false;
                        break;
                    }

                    if (currentPage >= 5) break;

                    setAutoScrapeStatus(`[Per-Page] Page ${currentPage} verified — going to next…`);
                    if (!(await clickNext())) break;
                }

                if (!state.autoScraping) break;

                const maxCount = getHighestEmployeeCount();
                const currentMin = getCurrentMinFromUrl();

                if (newProfilesInBatch === 0) {
                    showToast('🤖 Auto-Scrape complete — NO new profiles found. Results are still there so please change filter and make the profiles a little smaller.', 'warning');
                    setAutoScrapeStatus('Complete ✅ — No new profiles. Reduce filter.');
                    state.autoScraping = false;
                    document.getElementById('av-autoscrape-toggle').checked = false;
                    break;
                }

                if (maxCount !== null && maxCount > currentMin) {
                    setAutoScrapeStatus(`[Per-Page] Advancing filter: ${currentMin} → ${maxCount}…`);
                    await wait(1000);
                    advanceEmployeeFilter(maxCount);
                    state.autoScrapePageCount = 0;
                    pageCount = 0;
                    await wait(3500);
                } else {
                    showToast('🤖 Auto-Scrape complete — no more results.', 'success');
                    setAutoScrapeStatus('Complete ✅');
                    state.autoScraping = false;
                    document.getElementById('av-autoscrape-toggle').checked = false;
                    break;
                }
            }
        }

        if (!state.autoScraping) {
            setAutoScrapeStatus('Stopped.');
        }
    }

    // Helper to get dynamic column indices from headers
    function getColumnIndexes() {
        const mapping = {
            name: 1, // Default fallback
            title: 3,
            location: 2,
            linkedin: 4,
            company: 6,
            companySocial: 5
        };

        const headers = document.querySelectorAll('[role="columnheader"]');
        headers.forEach(h => {
            const id = h.getAttribute('data-id');
            const idx = h.getAttribute('aria-colindex');
            if (id && idx) {
                if (id === 'contact.name') mapping.name = idx;
                if (id === 'contact.job_title') mapping.title = idx;
                if (id === 'contact.location') mapping.location = idx;
                if (id === 'contact.social') mapping.linkedin = idx;
                if (id === 'contact.account') mapping.company = idx;
                if (id === 'account.social') mapping.companySocial = idx;
            }
        });
        return mapping;
    }

    async function extractProfiles(isAuto = false) {
        const colMap = getColumnIndexes();

        const rows = document.querySelectorAll('[role="row"]');
        let newCount = 0;
        const newProfiles = [];

        // Fetch Global CRM to check for duplicates/existing data
        let globalProfiles = [];
        if (window.StorageWrapper) {
            globalProfiles = await StorageWrapper.getAllProfiles();
        }

        // Map for fast lookup
        // Using name + domain (or just id if we had it, but we generate ID)
        // Ideally we match by a composite key since ID is random.
        // Let's match by Name + Domain.
        const globalProfileMap = new Map();
        globalProfiles.forEach(p => {
            const key = (p.name + "|" + p.domain).toLowerCase();
            globalProfileMap.set(key, p);
        });

        rows.forEach((row) => {
            // Skip header rows
            if (row.querySelector('[role="columnheader"]')) return;

            // Pass global map to check emptiness or pre-fill? 
            // Better to parse first, then check.
            const profile = parseProfileRow(row, colMap);

            if (profile) {
                // Check if already in CURRENT SESSION (Sidebar)
                const inSession = state.profiles.some(p => p.name === profile.name && p.domain === profile.domain);

                if (!inSession) {
                    // Check if in GLOBAL CRM
                    const key = (profile.name + "|" + profile.domain).toLowerCase();
                    if (globalProfileMap.has(key)) {
                        const existing = globalProfileMap.get(key);
                        // Reuse ID and Status and Results
                        profile.id = existing.id;
                        profile.status = existing.status;
                        profile.results = existing.results || [];
                        // We might want to keep the NEW scraped data (title, location) if it updated?
                        // For now, let's mix: New Scraped Data + Old Status/Results/ID
                        // But wait, if we overwrite ID we might break things if not careful.
                        // Actually, if we found it in CRM, let's use the CRM version directly?
                        // But maybe the user wants to see the current page's version.
                        // Let's use the CRM version but update it with current page info if needed.
                        // Simple: Use CRM ID, Status, Results.
                    }

                    newProfiles.push(profile);
                    newCount++;
                }
            }
        });

        // 5. Save to Storage (Both Session and Global)
        if (newProfiles.length > 0) {
            if (window.StorageWrapper) {
                // Save to Global CRM (Persist) - SKIP FOR NOW (Only save after verify)
                // StorageWrapper.saveAllProfiles(newProfiles).catch(err => console.error("Global Save Error:", err));

                // Update Local State (Session)
                state.profiles = [...state.profiles, ...newProfiles];

                // Save to Sidebar Session (View)
                StorageWrapper.saveSidebarSession(state.profiles).catch(err => console.error("Session Save Error:", err));

                showToast("Added to Sidebar (Verify to Save)", "neutral");
            }
        }

        if (newCount > 0) {
            document.getElementById('av-results-area').classList.remove('av-hidden');
            document.getElementById('av-status-text').textContent = `Found ${newCount} new profiles`;
            showToast(`Extracted ${newCount} profiles`, "success");
            renderList();

            // AUTO VERIFY — skip when Auto-Scrape is running (batch verify happens after 5 pages)
            if (!state.autoScraping) {
                const needsVerification = newProfiles.some(p => p.status !== 'verified' && p.status !== 'failed');
                if (needsVerification) {
                    showToast("Auto-verifying new profiles...", "neutral");
                    setTimeout(() => {
                        verifyProfiles(false);
                    }, 1000);
                } else {
                    showToast("Profiles loaded from CRM (Already Processed)", "neutral");
                }
            }

        } else {
            showToast("No new profiles found on this page.", "neutral");
        }
        
        return newCount;
    }

    /**
     * Parses a single table row to extract profile data
     * @param {HTMLElement} row 
     * @param {Object} colMap
     * @returns {Object|null}
     */
    function parseProfileRow(row, colMap) {
        // Name is usually in the first or second column, often has specific class or testid
        const nameEl = row.querySelector('[data-testid="contact-name-cell"] a') ||
            row.querySelector(`[aria-colindex="${colMap.name}"] a`) ||
            row.querySelector('.zp_x0e0J a'); // Fallback class if known

        if (!nameEl) return null;
        const name = nameEl.textContent.trim();

        // Helper to get text by data-id OR column index
        const getText = (dataId, colIndex) => {
            let el = row.querySelector(`[data-id="${dataId}"]`);
            if (!el && colIndex) {
                el = row.querySelector(`[aria-colindex="${colIndex}"]`);
            }
            return el ? el.textContent.trim() : "";
        };

        // Helper to get links by data-id OR column index
        const getLinks = (dataId, colIndex) => {
            let el = row.querySelector(`[data-id="${dataId}"]`);
            if (!el && colIndex) {
                el = row.querySelector(`[aria-colindex="${colIndex}"]`);
            }
            return el ? Array.from(el.querySelectorAll('a')) : [];
        };

        // 1. Job Title
        const title = getText('contact.job_title', colMap.title);

        // 2. Location
        const location = getText('contact.location', colMap.location);

        // 3. Person LinkedIn
        let linkedin = "";
        const socialLinks = getLinks('contact.social', colMap.linkedin);
        socialLinks.forEach(a => {
            if (a.href && a.href.includes('linkedin')) {
                linkedin = a.href;
            }
        });

        // 4. Company Name
        const company = getText('contact.account', colMap.company);

        // 5. Company Socials (Website & LinkedIn)
        let website = "";
        let companyLinkedin = "";

        const companySocialLinks = getLinks('account.social', colMap.companySocial);
        companySocialLinks.forEach(a => {
            if (a.href) {
                if (a.href.includes('linkedin')) {
                    companyLinkedin = a.href;
                } else if (!a.href.includes('twitter') && !a.href.includes('facebook') && a.href.startsWith('http')) {
                    website = a.href;
                }
            }
        });

        // Fallback for website if not found in account.social
        if (!website) {
            const websiteElement = row.querySelector('a[aria-label="website link"]');
            if (websiteElement) website = websiteElement.href;
        }

        // Extract Domain
        let domain = "";
        if (website) {
            try {
                const url = new URL(website);
                domain = url.hostname.replace(/^www\./, "");
            } catch (e) { }
        }

        // STRICT DOMAIN CHECK: Skip if no domain
        if (!domain && company) {
            // Try to guess from company name if simple? No, unsafe.
            // But if we have a company name but no website, maybe we can still list them?
            // User previously requested strict check. We will stick to it or maybe relax it?
            // "STRICT DOMAIN CHECK: Skip if no domain" -> Keep this for now as per previous logic.
            // However, for debugging, let's log if we drop someone.
            console.debug(`Av: Dropping ${name} - No domain found.`);
            return null;
        }
        if (!domain) return null;

        return {
            id: Math.random().toString(36).substr(2, 9),
            name: name,
            title: title,
            location: location,
            linkedin: linkedin,
            company: company,
            companyLinkedin: companyLinkedin,
            domain: domain,
            website: website,
            emails: generateEmails(name, domain),
            selected: true,
            status: 'ready',
            results: []
        };
    }

    function generateEmails(fullName, domain) {
        if (!fullName || !domain) return [];
        let cleanName = fullName.replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.)\s+/i, '');
        const parts = cleanName.toLowerCase().split(/\s+/);
        if (parts.length < 2) return [`info@${domain}`, `contact@${domain}`];

        const first = parts[0].replace(/[^a-z0-9]/g, '');
        const last = parts[parts.length - 1].replace(/[^a-z0-9]/g, '');

        return [...new Set([
            `${first}@${domain}`, `${last}@${domain}`, `${first}${last}@${domain}`,
            `${last}${first}@${domain}`, `${first}.${last}@${domain}`, `${last}.${first}@${domain}`,
            `${first}_${last}@${domain}`, `${first[0]}${last}@${domain}`
        ])];
    }

    async function verifyProfiles(isRetry) {
        if (!state.activeKey) {
            // First try to load
            await loadActiveKeys();
            if (!state.activeKey) {
                showToast("Please add API Keys in Dashboard", "error");
                return;
            }
        }

        const toVerify = state.profiles.filter(p => p.selected && (isRetry ? p.status === 'failed' : p.status !== 'verified'));
        if (toVerify.length === 0) {
            showToast("No profiles selected for verification", "neutral");
            return true;
        }

        // UI Loading State
        const verifyBtn = document.getElementById('av-verify-btn');
        const originalBtnText = verifyBtn.innerHTML;
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = `${ICONS.spinner} Verifying ${toVerify.length}...`;
        state.isVerifying = true;

        document.getElementById('av-retry-btn').classList.add('av-hidden');

        // Optimistic Update
        toVerify.forEach(p => p.status = 'processing');
        renderList();

        try {
            // Collect Emails
            let allEmails = [];
            toVerify.forEach(p => allEmails.push(...p.emails));
            allEmails = [...new Set(allEmails)];

            if (allEmails.length === 0) {
                // No emails to verify (e.g. only profiles with no domain?)
                // Just mark them as failed or done?
                toVerify.forEach(p => p.status = 'verified'); // Verified that they have no emails?
                // Or 'failed' because no valid email?
                // Let's mark as 'failed' (No valid email)
                toVerify.forEach(p => p.status = 'verified'); // Status verified, but result empty.

                showToast("No emails to verify for selected profiles.", "neutral");
            } else {
                // Call API
                const results = await callApify(allEmails);

                // Process Results
                let verifiedCount = 0;

                // --- COST CALCULATION ---
                // $1 per 1,000 decisive verifications (ok, disposable, invalid)
                const decisiveResults = results.filter(r => ['ok', 'disposable', 'invalid'].includes(r.result));
                const distinctDecisive = decisiveResults.length; // Each result corresponds to an email check
                const cost = distinctDecisive * 0.001;

                // Update Balance (Per Key)
                const keys = await StorageWrapper.getApiKeys();
                if (keys[state.activeKeyIndex]) {
                    let currentBal = keys[state.activeKeyIndex].balance !== undefined ? parseFloat(keys[state.activeKeyIndex].balance) : 5.00;
                    currentBal = Math.max(0, currentBal - cost);
                    keys[state.activeKeyIndex].balance = currentBal;

                    await StorageWrapper.saveApiKeys(keys);

                    // Update current state activeKey reference too
                    state.activeKey.balance = currentBal;

                    console.log(`Batch Cost: $${cost.toFixed(5)}, New Key Balance: $${currentBal.toFixed(5)}`);
                }

                toVerify.forEach(p => {
                    p.results = results.filter(r => p.emails.includes(r.email));
                    const hasValid = p.results.some(r => r.result === 'ok');

                    if (hasValid || p.results.length > 0) {
                        p.status = 'verified';
                        if (hasValid) verifiedCount++;
                    } else {
                        p.status = 'failed';
                    }
                });

                showToast(`Verified. Cost: $${cost.toFixed(4)}`, "success");
            }

            renderList();
            return true;
        } catch (e) {
            console.error("Verification Error:", e);
            state.isVerifying = false;
            toVerify.forEach(p => p.status = 'failed');
            showToast("Verification Failed: " + e.message, "error");
            document.getElementById('av-retry-btn').classList.remove('av-hidden');
            return false;
        } finally {
            // Save updated status to storage (BOTH)
            if (window.StorageWrapper) {
                console.log("Saving profiles to storage...");
                // Save Session (All results, including failed)
                await StorageWrapper.saveSidebarSession(state.profiles).catch(err => console.error("Session Save failed:", err));

                // Save Global (ONLY VALID VERIFIED)
                const validProfiles = state.profiles.filter(p => p.status === 'verified' && p.results.some(r => r.result === 'ok'));
                if (validProfiles.length > 0) {
                    await StorageWrapper.saveAllProfiles(validProfiles).catch(err => console.error("Global Save failed:", err));
                    console.log(`Saved ${validProfiles.length} valid profiles to CRM.`);
                }
            } else {
                console.error("StorageWrapper missing!");
                // Fallback
                chrome.storage.local.set({ 'av_sidebar_session': state.profiles });
            }

            verifyBtn.disabled = false;
            verifyBtn.innerHTML = originalBtnText;
            renderList();
        }
    }

    async function callApify(emails) {
        while (true) {
            if (!state.activeKey || !state.activeKey.key) {
                // Try to reload keys if missing
                await loadActiveKeys();
                if (!state.activeKey) throw new Error("No active API key selected");
            }

            const response = await new Promise(resolve => {
                chrome.runtime.sendMessage({
                    action: "CALL_APIFY",
                    emails: emails,
                    apiKey: state.activeKey.key
                }, resolve);
            });

            if (response.success) {
                return response.data;
            } else {
                // Handle specific error codes for key switching
                let errData;
                try {
                    errData = JSON.parse(response.error);
                } catch (e) {
                    errData = { message: response.error };
                }

                if (errData.status === 402) {
                    // QUOTA EXHAUSTED LOGIC
                    console.warn(`Key ${state.activeKey.label} exhausted (402). Switching...`);

                    // Mark current as exhausted
                    const keys = await StorageWrapper.getApiKeys();
                    if (keys[state.activeKeyIndex]) {
                        keys[state.activeKeyIndex].status = 'exhausted';
                        await StorageWrapper.saveApiKeys(keys);
                    }

                    // Find next active
                    const nextIdx = keys.findIndex(k => k.status === 'active');
                    if (nextIdx > -1) {
                        state.activeKey = keys[nextIdx];
                        state.activeKeyIndex = nextIdx;

                        // Update UI
                        loadActiveKeys(); // Refreshes dropdown/status
                        showToast(`Key exhausted. Switched to ${state.activeKey.label}`, "warning");

                        // Retry loop immediately with new key
                        continue;
                    } else {
                        throw new Error("All API keys exhausted! Please add more in Dashboard.");
                    }
                }

                if (errData.status === 401) throw new Error("Invalid API Token");
                throw new Error(errData.message || response.error);
            }
        }
    }

    function renderList() {
        const list = document.getElementById('av-profile-list');
        list.innerHTML = '';
        const showValidOnly = document.getElementById('av-show-valid-only').checked;

        state.profiles.forEach(p => {
            // Filter Logic
            if (showValidOnly) {
                if (p.status === 'verified') {
                    const hasValid = p.results.some(r => r.result === 'ok');
                    if (!hasValid) return;
                } else {
                    // Keep them visible if they are not verified yet (processing/ready)
                    // unless user wants to hide them? Standard behavior: filter applies to RESULTS.
                    // But if user clicks 'Valid Only' before verifying, they might expect to hide 'ready' ones with low confidence?
                    // Let's stick to hiding COMPLETED w/o valid.
                    if (p.status === 'verified' && !p.results.some(r => r.result === 'ok')) return;
                }
            }

            const item = document.createElement('div');
            item.className = 'av-data-item';

            // Checkbox
            const chkDiv = document.createElement('div');
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.className = 'av-checkbox';
            chk.checked = p.selected;
            chk.addEventListener('change', (e) => p.selected = e.target.checked);
            chkDiv.appendChild(chk);

            // Content
            const content = document.createElement('div');
            content.className = 'av-item-content';
            content.innerHTML = `
                <div class="av-item-name">${p.name}</div>
                <div class="av-item-meta">${p.domain}</div>
             `;

            // Badges / Results
            if (p.status === 'verified') {
                const validEmails = p.results.filter(r => r.result === 'ok');
                if (validEmails.length > 0) {
                    validEmails.forEach(e => {
                        const badge = document.createElement('div');
                        badge.className = 'av-badge av-badge-success';
                        badge.textContent = `✓ ${e.email}`;
                        content.appendChild(badge);
                    });
                } else {
                    const badge = document.createElement('div');
                    badge.className = 'av-badge av-badge-warning';
                    badge.textContent = 'No valid email';
                    content.appendChild(badge);
                }
            } else if (p.status === 'failed') {
                const badge = document.createElement('div');
                badge.className = 'av-badge av-badge-error';
                badge.textContent = 'Failed';
                content.appendChild(badge);
            } else if (p.status === 'processing') {
                const badge = document.createElement('div');
                badge.className = 'av-badge av-badge-neutral';
                badge.textContent = 'Processing...';
                content.appendChild(badge);
            }

            item.appendChild(chkDiv);
            item.appendChild(content);
            list.appendChild(item);
        });
    }

    function downloadCSV() {
        if (state.profiles.length === 0) {
            showToast("No data to export", "neutral");
            return;
        }

        // Updated Headers
        let csvContent = "data:text/csv;charset=utf-8,Name,Title,Company,Location,Domain,Website,Person_LinkedIn,Company_LinkedIn,Email,Status,Verification_Result\n";

        state.profiles.forEach(p => {
            const baseRow = `"${p.name}","${p.title || ''}","${p.company || ''}","${p.location || ''}","${p.domain || ''}","${p.website || ''}","${p.linkedin || ''}","${p.companyLinkedin || ''}"`;

            if (p.results && p.results.length > 0) {
                p.results.forEach(r => {
                    csvContent += `${baseRow},"${r.email}","${p.status}","${r.result}"\n`;
                });
            } else {
                // If no emails yet/failed
                csvContent += `${baseRow},"","${p.status}",""\n`;
            }
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "apollo_verifier_sidebar_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("CSV Downloaded", "success");
    }

})();
