
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
    // 1. Apollo API Module (MitM — replaces DOM scraper for data collection)
    // -------------------------------------------------------------------------
    const ApolloAPI = {
        PEOPLE_FIELDS: [
            'contact.id', 'contact.name', 'contact.first_name', 'contact.last_name',
            'contact.linkedin_url', 'contact.twitter_url', 'contact.facebook_url',
            'contact.title', 'contact.email', 'contact.email_status',
            'contact.email_domain_catchall', 'contact.phone_numbers',
            'contact.city', 'contact.state', 'contact.country',
            'contact.organization_name', 'contact.organization_id',
            'account.estimated_num_employees', 'account.domain',
            'account.industries', 'account.website_url', 'account.linkedin_url'
        ],

        getCsrfToken() {
            const match = document.cookie.match(/X-CSRF-TOKEN=([^;]+)/);
            if (match) return decodeURIComponent(match[1]);
            const meta = document.querySelector('meta[name="csrf-token"]');
            return meta ? meta.content : null;
        },

        async call(endpoint, method = 'GET', body = null) {
            const headers = { 'Content-Type': 'application/json' };
            const csrf = this.getCsrfToken();
            if (csrf && method !== 'GET') headers['X-CSRF-TOKEN'] = csrf;
            const opts = { method, headers, credentials: 'include' };
            if (body) opts.body = JSON.stringify({ ...body, cacheKey: Date.now() });

            // Bug 8: retry on transient rate-limit / overload responses
            for (let attempt = 0; attempt < 3; attempt++) {
                const res = await fetch(`https://app.apollo.io${endpoint}`, opts);
                if (res.ok) return res.json();

                // 429 Too Many Requests or 503 Service Unavailable — transient, worth retrying
                if ((res.status === 429 || res.status === 503) && attempt < 2) {
                    const delay = 3000 * Math.pow(2, attempt); // 3 000 ms, then 6 000 ms
                    console.warn(`[ApolloAPI] ${res.status} on ${endpoint} — retrying in ${delay}ms (attempt ${attempt + 1}/3)`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }

                // All other errors (400, 401, 403, 5xx after retries) — throw immediately
                throw new Error(`Apollo API ${res.status}: ${res.statusText}`);
            }
        },

        async searchPeople(filters, page = 1, perPage = 30) {
            const hash = window.location.hash;
            let endpoint = '/api/v1/mixed_people/search';
            let context = 'people-index-page';

            if (hash.includes('/contacts')) {
                endpoint = '/api/v1/contacts/search';
                context = 'contacts-index-page';
            }

            return this.call(endpoint, 'POST', {
                page,
                per_page: perPage,
                display_mode: 'explorer_mode',
                context: context,
                finder_version: 2,
                show_suggestions: false,
                num_fetch_result: 1,
                typed_custom_fields: [],
                fields: this.PEOPLE_FIELDS,
                ...filters
            });
        },

        async loadOrganizations(orgIds) {
            if (!orgIds || orgIds.length === 0) return { organizations: [] };
            return this.call('/api/v1/organizations/load_snippets', 'POST', { ids: orgIds });
        },

        async saveExclusionQuery(domainUrls) {
            // Bug 1: accept array and join with newline — Apollo accepts multiple URLs in one call
            const query = Array.isArray(domainUrls) ? domainUrls.join('\n') : domainUrls;
            const res = await this.call(
                '/api/v1/organization_search_lists/save_query', 'POST', { query }
            );
            // Log raw response once so we can confirm the real list-ID field name in production
            console.log('[saveExclusionQuery] raw response:', JSON.stringify(res));
            return res;
        }
    };

    // -------------------------------------------------------------------------
    // 2. URL Filter Parser (reads Apollo's URL hash → API params)
    // -------------------------------------------------------------------------
    function parseApolloUrlFilters() {
        const hash = decodeURIComponent(window.location.hash);
        const qPart = hash.includes('?') ? hash.split('?')[1] : '';
        const params = new URLSearchParams(qPart);
        const filters = {};

        for (const [key, value] of params.entries()) {
            let isArray = key.endsWith('[]');
            let cleanKey = isArray ? key.slice(0, -2) : key;
            
            let snakeKey = cleanKey.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

            if (isArray) {
                if (!filters[snakeKey]) filters[snakeKey] = [];
                filters[snakeKey].push(value);
            } else {
                if (value === 'true') filters[snakeKey] = true;
                else if (value === 'false') filters[snakeKey] = false;
                else filters[snakeKey] = value;
            }
        }
        
        if (filters.page !== undefined) delete filters.page;
        
        return filters;
    }

    // -------------------------------------------------------------------------
    // 3. Profile Mapper (replaces parseProfileRow — fixes LinkedIn/domain/emp bugs)
    // -------------------------------------------------------------------------
    function mapPersonToProfile(person, orgSnippet) {
        const org = person.organization || {};
        const snippet = orgSnippet || {};

        // Domain extraction — try every available field before dropping the profile.
        // Apollo's search response often has website_url=null but the org snippet
        // (from loadOrganizations) may have primary_domain or website_url populated.
        const website =
            org.website_url ||
            snippet.website_url ||
            (org.primary_domain     ? `https://${org.primary_domain}`     : '') ||
            (snippet.primary_domain ? `https://${snippet.primary_domain}` : '') ||
            '';

        let domain = '';
        if (website) {
            try { domain = new URL(website).hostname.replace(/^www\./, ''); } catch (e) {}
        }

        // Last resort: if the org has a primary_domain field directly, use it
        if (!domain && org.primary_domain)    domain = org.primary_domain.replace(/^www\./, '');
        if (!domain && snippet.primary_domain) domain = snippet.primary_domain.replace(/^www\./, '');

        if (!domain) {
            console.debug(`[API] Dropping ${person.name} — no domain in any org field`);
            return null;
        }

        // Bug 1 fix: only store personal /in/ LinkedIn URLs
        const liRaw = person.linkedin_url || '';
        const linkedin = liRaw.includes('linkedin.com/in/') ? liRaw : '';

        // New fields: company_keywords + secondary_industries
        const companyKeywords = snippet.keywords || org.keywords || [];
        const secondaryIndustries = snippet.secondary_industries || org.secondary_industries || [];

        const fullName = person.name ||
            `${person.first_name || ''} ${person.last_name || ''}`.trim();

        return {
            id: Math.random().toString(36).substr(2, 9),
            name: fullName,
            title: person.title || '',
            // Bug 3 fix: structured location parts (not a single scraped text cell)
            location: [person.city, person.state, person.country].filter(Boolean).join(', '),
            linkedin,
            company: org.name || snippet.name || person.organization_name || '',
            companyLinkedin: org.linkedin_url || snippet.linkedin_url || '',
            domain,
            website: website || `https://${domain}`,
            // Bug 2 fix: exact integer from API, not "2,000+" text from DOM
            employees: String(org.estimated_num_employees || snippet.estimated_num_employees || ''),
            industry: (org.industries || snippet.industries || [org.industry || snippet.industry || ''])[0] || '',
            companyKeywords,
            secondaryIndustries,
            // Apify flow fields — UNCHANGED
            emails: generateEmails(fullName, domain),
            selected: true,
            status: 'ready',
            results: [],
            old_results: []
        };
    }

    // -------------------------------------------------------------------------
    // 4. Deadlock Breaker (for stuck employee-count filter situations)
    // -------------------------------------------------------------------------
    async function activateDeadlockBreaker() {
        const domainCount = state.sessionDomains.size;
        if (domainCount === 0) return false;

        // Accumulate into the persistent set BEFORE clearing sessionDomains.
        // This fixes a critical bug: if deadlock fires multiple times, each new
        // save_query must include ALL ever-seen domains, not just the latest batch.
        // Without this, deadlock #2 would only exclude the 2nd batch — the 1st
        // batch of companies comes back in results.
        state.sessionDomains.forEach(d => state.allExcludedDomains.add(d));

        const totalDomains = state.allExcludedDomains.size;
        const newDomains   = domainCount;
        setAutoScrapeStatus(
            `Deadlock detected — building exclusion list (${newDomains} new + ${totalDomains - newDomains} carry-over = ${totalDomains} total)…`
        );
        showToast(`🔄 Deadlock: excluding ${totalDomains} companies total`, 'neutral');

        // Build URL list from the COMPLETE accumulated set
        const allUrls = Array.from(state.allExcludedDomains).map(d => `https://${d}/`);
        setAutoScrapeStatus(`Registering ${allUrls.length} domains for exclusion…`);

        let listId = null;
        try {
            const res = await ApolloAPI.saveExclusionQuery(allUrls);
            // Confirmed real field: res.listId (camelCase — seen in production console log)
            listId = res?.listId
                || res?.organization_search_list?.id
                || res?.model?.id
                || res?.list_id
                || res?.id
                || null;
            if (listId) {
                console.log('[Deadlock] Exclusion list registered:', listId,
                    `(${allUrls.length} domains, cycle #${state._deadlockCycle = (state._deadlockCycle||0)+1})`);
            } else {
                console.warn('[Deadlock] save_query response had no recognisable ID field:', JSON.stringify(res));
            }
            setAutoScrapeStatus(`Exclusion list ready: ${listId || 'failed'}`);
        } catch (e) {
            console.warn('[Deadlock] save_query failed:', e);
        }

        if (!listId) {
            showToast('Deadlock breaker: no list registered — stopping.', 'error');
            return false;
        }

        // Inject the exclusion list ID into the URL hash.
        // Apollo supports ONE qNotOrganizationSearchListId per search.
        // REPLACE any existing value so each deadlock cycle uses the latest list
        // (which now contains ALL domains, including all previous cycles).
        let hash = window.location.hash;
        const newEncId = encodeURIComponent(listId);
        if (hash.includes('qNotOrganizationSearchListId=')) {
            hash = hash.replace(
                /qNotOrganizationSearchListId=[^&]*/,
                `qNotOrganizationSearchListId=${newEncId}`
            );
        } else {
            hash += `&qNotOrganizationSearchListId=${newEncId}`;
        }
        // Reset to page 1 so Apollo starts fresh with exclusions active
        hash = hash.replace(/page=\d+/, 'page=1');
        window.location.hash = hash;

        // Clear session domains for the NEXT cycle only.
        // allExcludedDomains is never cleared — it carries over to future deadlocks.
        state.sessionDomains.clear();

        showToast(`✅ Deadlock broken — ${allUrls.length} companies excluded total`, 'success');
        setAutoScrapeStatus('Deadlock broken — resuming with exclusions active...');

        // Wait for Apollo UI to apply the new filter
        await new Promise(r => setTimeout(r, 3500));
        return true;
    }

    // -------------------------------------------------------------------------
    // 5. Sidebar HTML Structure
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
        autoScrapeMode: 'batch',   // 'batch' = 5 pages then verify | 'perpage' = verify after each page
        sessionDomains: new Set(),    // domains seen since LAST deadlock fire
        allExcludedDomains: new Set() // ALL domains ever seen this session — never cleared
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
            el.textContent = 'Status: No Key';
            el.style.color = '#6b7280';
            return;
        }

        const color = key.status === 'active' ? '#10b981' : '#ef4444';
        el.textContent = `Status: ${key.status.toUpperCase()} — fetching balance…`;
        el.style.color = color;

        // Fetch real balance from Apify in the background
        chrome.runtime.sendMessage({ action: 'GET_APIFY_LIMITS', apiKey: key.key }, (response) => {
            if (!el) return; // sidebar may have been closed
            if (response?.success) {
                const limits  = response.data.data.limits;
                const current = response.data.data.current;
                const used      = current.monthlyUsageUsd;
                const max       = limits.maxMonthlyUsageUsd;
                const remaining = Math.max(0, max - used);
                const pct       = max > 0 ? Math.min(100, (used / max) * 100).toFixed(0) : 0;
                const remColor  = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#10b981';
                el.textContent = `${key.status.toUpperCase()} • $${remaining.toFixed(2)} left (${pct}% used)${key.renewDate ? ' • Renew: ' + key.renewDate : ''}`;
                el.style.color = remColor;
            } else {
                // Fallback to local estimate
                const localBal = key.balance !== undefined ? parseFloat(key.balance).toFixed(2) : '?';
                el.textContent = `${key.status.toUpperCase()} • ~$${localBal} (est.)${key.renewDate ? ' • Renew: ' + key.renewDate : ''}`;
                el.style.color = color;
            }
        });
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
     * Returns the highest employee count seen across all profiles in the current session.
     * Now reads directly from state.profiles (populated by API) instead of scanning the DOM.
     */
    /**
     * Returns the highest employee count seen in profiles collected SINCE
     * startIndex — i.e. only within the current 5-page batch.
     * Passing startIndex prevents stale high values from earlier batches
     * from falsely advancing the filter when the current batch is stuck.
     */
    function getHighestEmployeeCount(startIndex = 0) {
        const counts = state.profiles
            .slice(startIndex)   // ← only current batch
            .map(p => parseInt(String(p.employees || '').replace(/,/g, '').replace(/\+/g, '').trim(), 10))
            .filter(n => !isNaN(n) && n > 0);
        if (counts.length > 0) {
            const max = Math.max(...counts);
            console.log(`[AutoScrape] Max employee count from batch profiles (idx ${startIndex}+):`, max);
            return max;
        }
        console.warn('[AutoScrape] No employee counts in current batch profiles.');
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
                const batchStartIndex = state.profiles.length; // snapshot before this batch
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

                const maxCount = getHighestEmployeeCount(batchStartIndex); // only this batch
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
                    // Deadlock: employee count didn't advance — try exclusion breaker
                    if (state.sessionDomains.size > 0) {
                        const broke = await activateDeadlockBreaker();
                        if (!broke) {
                            showToast('🤖 Auto-Scrape complete — no more results.', 'success');
                            setAutoScrapeStatus('Complete ✅');
                            state.autoScraping = false;
                            document.getElementById('av-autoscrape-toggle').checked = false;
                            break;
                        }
                        // Deadlock broken — reset page counter and continue
                        pageCount = 0;
                        state.autoScrapePageCount = 0;
                    } else {
                        showToast('🤖 Auto-Scrape complete — no more results.', 'success');
                        setAutoScrapeStatus('Complete ✅');
                        state.autoScraping = false;
                        document.getElementById('av-autoscrape-toggle').checked = false;
                        break;
                    }
                }
            }
        } else {
            // ── PER-PAGE MODE ───────────────────────────────────────────────
            // Verify after EACH page, then go to next. After page 5, advance filter.
            while (state.autoScraping) {
                let newProfilesInBatch = 0;
                const batchStartIndex = state.profiles.length; // snapshot before this batch
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

                const maxCount = getHighestEmployeeCount(batchStartIndex); // only this batch
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
                    // Deadlock: employee count didn't advance — try exclusion breaker
                    if (state.sessionDomains.size > 0) {
                        const broke = await activateDeadlockBreaker();
                        if (!broke) {
                            showToast('🤖 Auto-Scrape complete — no more results.', 'success');
                            setAutoScrapeStatus('Complete ✅');
                            state.autoScraping = false;
                            document.getElementById('av-autoscrape-toggle').checked = false;
                            break;
                        }
                        pageCount = 0;
                        state.autoScrapePageCount = 0;
                    } else {
                        showToast('🤖 Auto-Scrape complete — no more results.', 'success');
                        setAutoScrapeStatus('Complete ✅');
                        state.autoScraping = false;
                        document.getElementById('av-autoscrape-toggle').checked = false;
                        break;
                    }
                }
            }
        }

        if (!state.autoScraping) {
            setAutoScrapeStatus('Stopped.');
        }
    }

    // -------------------------------------------------------------------------
    // extractProfiles — now uses Apollo API instead of DOM scraping
    // -------------------------------------------------------------------------
    async function extractProfiles(isAuto = false) {
        const currentPage = getCurrentPageFromUrl();
        const filters = parseApolloUrlFilters();

        // Apollo sometimes returns an empty 200 OK immediately after a filter/hash
        // change (e.g. right after the deadlock exclusion is applied).
        // The UI catches up fine but the API needs a moment — retry up to 3×.
        let data = null;
        const MAX_EMPTY_RETRIES = 3;
        for (let attempt = 1; attempt <= MAX_EMPTY_RETRIES; attempt++) {
            try {
                data = await ApolloAPI.searchPeople(filters, currentPage);
            } catch (err) {
                console.error('[ApolloAPI] searchPeople failed:', err);
                showToast(`API Error: ${err.message}`, 'error');
                return 0;
            }

            const peopleList = data?.people || data?.contacts || [];
            if (peopleList.length > 0) break; // ✅ got results

            if (attempt < MAX_EMPTY_RETRIES) {
                console.warn(
                    `[extractProfiles] Empty response page=${currentPage}` +
                    ` (attempt ${attempt}/${MAX_EMPTY_RETRIES}) — waiting 3 s…`
                );
                setAutoScrapeStatus(
                    `Page ${currentPage}: Apollo returned empty — retrying (${attempt}/${MAX_EMPTY_RETRIES})…`
                );
                await new Promise(r => setTimeout(r, 3000));
            }
        }

        const finalPeopleList = data?.people || data?.contacts || [];
        if (finalPeopleList.length === 0) {
            showToast('No results from API on this page (after 3 attempts).', 'neutral');
            return 0;
        }


        // ── Pass 1: load org snippets for all org IDs ──────────────────────
        const orgIds = [...new Set(
            finalPeopleList.map(p => p.organization_id).filter(Boolean)
        )];

        let orgMap = {};
        if (orgIds.length > 0) {
            try {
                const orgData = await ApolloAPI.loadOrganizations(orgIds);
                (orgData.organizations || []).forEach(org => { orgMap[org.id] = org; });
            } catch (err) {
                console.warn('[ApolloAPI] loadOrganizations pass-1 failed (non-fatal):', err);
            }
        }

        // ── Pass 2: for people whose org still has no website, re-query ────
        // The search endpoint embeds a minimal org stub — the snippet endpoint
        // often has primary_domain populated even when website_url is null.
        const noWebsiteOrgIds = finalPeopleList
            .filter(p => {
                const org = p.organization || {};
                const snip = orgMap[p.organization_id] || {};
                return !org.website_url && !snip.website_url &&
                       !org.primary_domain && !snip.primary_domain;
            })
            .map(p => p.organization_id)
            .filter(Boolean);

        if (noWebsiteOrgIds.length > 0) {
            console.log(`[extractProfiles] Pass-2 re-query for ${noWebsiteOrgIds.length} orgs with no website`);
            try {
                const orgData2 = await ApolloAPI.loadOrganizations(noWebsiteOrgIds);
                (orgData2.organizations || []).forEach(org => {
                    // Merge into orgMap — prefer pass-2 data for domain fields
                    orgMap[org.id] = { ...(orgMap[org.id] || {}), ...org };
                });
            } catch (err) {
                console.warn('[ApolloAPI] loadOrganizations pass-2 failed (non-fatal):', err);
            }
        }

        // Fetch Global CRM to build smart dedup maps (same logic as before)
        let globalProfiles = [];
        if (window.StorageWrapper) {
            globalProfiles = await StorageWrapper.getAllProfiles();
        }

        const linkedinMap = new Map();
        const nameMap = new Map();
        const nameDomainMap = new Map();

        globalProfiles.forEach(p => {
            if (p.linkedin) linkedinMap.set(p.linkedin.trim().toLowerCase(), p);
            const nameKey = (p.name || '').trim().toLowerCase();
            if (nameKey && !nameMap.has(nameKey)) nameMap.set(nameKey, p);
            const ndKey = (p.name + '|' + p.domain).toLowerCase();
            nameDomainMap.set(ndKey, p);
        });

        const newProfiles = [];
        let newCount = 0;

        for (const person of finalPeopleList) {
            const orgSnippet = orgMap[person.organization_id] || null;
            const profile = mapPersonToProfile(person, orgSnippet);
            if (!profile) continue;

            // Track domain for deadlock detection
            if (profile.domain) state.sessionDomains.add(profile.domain);

            // ── Check already in CURRENT SESSION (Sidebar) ────────────────────
            const inSession = state.profiles.some(p =>
                (p.linkedin && p.linkedin === profile.linkedin) ||
                (p.name === profile.name && p.domain === profile.domain)
            );
            if (inSession) continue;

            // ── Smart CRM lookup (3-tier) ──────────────────────────────────────
            // Tier 1: LinkedIn URL — globally unique, most reliable
            // Tier 2: name + domain — precise; prevents "Rajesh Shah @ CompanyA"
            //         from merging with "Rajesh Shah @ CompanyB"
            // Tier 3: name only — last resort, only when neither side has LinkedIn
            //         (avoids false merges on common Indian names)
            let existing = null;
            let matchedBy = null;

            // Tier 1 — LinkedIn
            if (profile.linkedin) {
                const li = profile.linkedin.trim().toLowerCase();
                if (linkedinMap.has(li)) { existing = linkedinMap.get(li); matchedBy = 'linkedin'; }
            }

            // Tier 2 — name + domain (exact company match)
            if (!existing && profile.name && profile.domain) {
                const ndKey = (profile.name + '|' + profile.domain).toLowerCase();
                if (nameDomainMap.has(ndKey)) { existing = nameDomainMap.get(ndKey); matchedBy = 'name+domain'; }
            }

            // Tier 3 — name only, but ONLY when neither side has a LinkedIn URL
            // (if either has LinkedIn we would have already matched via Tier 1, or
            //  they are genuinely different people who happen to share a name)
            if (!existing && profile.name && !profile.linkedin) {
                const nameKey = (profile.name || '').trim().toLowerCase();
                const candidate = nameMap.get(nameKey);
                if (candidate && !candidate.linkedin) {
                    existing = candidate;
                    matchedBy = 'name-only';
                }
            }

            if (existing) {
                // ── UPDATE IN-PLACE ────────────────────────────────────────────
                const domainChanged = existing.domain && profile.domain &&
                    existing.domain.toLowerCase() !== profile.domain.toLowerCase();

                let old_results = Array.isArray(existing.old_results) ? [...existing.old_results] : [];
                if (domainChanged && existing.results && existing.results.length > 0) {
                    const oldVerified = existing.results.filter(r => r.result === 'ok');
                    if (oldVerified.length > 0) {
                        const archivedEmails = new Set(old_results.map(r => r.email));
                        oldVerified.forEach(r => {
                            if (!archivedEmails.has(r.email)) {
                                old_results.push({ ...r, archivedAt: new Date().toISOString() });
                            }
                        });
                    }
                }

                const updated = {
                    ...profile,
                    id: existing.id,
                    status: domainChanged ? 'ready' : existing.status,
                    results: domainChanged ? [] : (existing.results || []),
                    old_results,
                    jobChanged: domainChanged,
                    emails: profile.emails
                };

                if (domainChanged) {
                    console.log(`[SmartDedup] Job change: "${profile.name}" ${existing.domain} → ${profile.domain}`);
                } else {
                    console.log(`[SmartDedup] Matched "${profile.name}" by ${matchedBy}`);
                }

                newProfiles.push(updated);
                newCount++;
            } else {
                // ── NEW PROFILE ────────────────────────────────────────────────
                profile.old_results = [];
                newProfiles.push(profile);
                newCount++;
            }
        }

        // Save to storage (same pattern as before)
        if (newProfiles.length > 0 && window.StorageWrapper) {
            state.profiles = [...state.profiles, ...newProfiles];
            StorageWrapper.saveSidebarSession(state.profiles)
                .catch(err => console.error('Session Save Error:', err));
            showToast('Added to Sidebar (Verify to Save)', 'neutral');
        }

        if (newCount > 0) {
            document.getElementById('av-results-area').classList.remove('av-hidden');
            document.getElementById('av-status-text').textContent = `Found ${newCount} new profiles`;
            showToast(`Extracted ${newCount} profiles`, 'success');
            renderList();

            // Auto-verify — same logic as before, skipped when auto-scraping
            if (!state.autoScraping) {
                const needsVerification = newProfiles.some(p => p.status !== 'verified' && p.status !== 'failed');
                if (needsVerification) {
                    showToast('Auto-verifying new profiles...', 'neutral');
                    setTimeout(() => verifyProfiles(false), 1000);
                } else {
                    showToast('Profiles loaded from CRM (Already Processed)', 'neutral');
                }
            }
        } else {
            showToast('No new profiles found on this page.', 'neutral');
        }

        return newCount;
    }

    // REMOVED: getColumnIndexes() — not needed, API returns named JSON fields
    // REMOVED: parseProfileRow() — replaced by mapPersonToProfile()

    // parseProfileRow() REMOVED — replaced by mapPersonToProfile() above.
    // getColumnIndexes() REMOVED — not needed; API returns named JSON fields.
    // Old DOM-based extractProfiles() REMOVED — replaced by API version above.



    function generateEmails(fullName, domain) {
        if (!fullName || !domain) return [];
        let cleanName = fullName.replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.)\s+/i, '');
        const parts = cleanName.toLowerCase().split(/\s+/);

        // Single-word name (e.g. "Dev") — can't do first.last patterns,
        // so try the name itself first, then generic fallbacks
        if (parts.length < 2) {
            const single = parts[0].replace(/[^a-z0-9]/g, '');
            return [...new Set([
                `${single}@${domain}`,
                `info@${domain}`,
                `contact@${domain}`
            ])];
        }

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
                return false; // Bug 5: explicit false so auto-scrape loop doesn't misread as API error
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
                // Bug 7: no emails were generated (no domain) — mark as failed so Retry button shows
                toVerify.forEach(p => p.status = 'failed');

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

        // Updated Headers — includes new company_keywords + secondary_industries
        let csvContent = "data:text/csv;charset=utf-8,Name,Title,Company,Location,Employees,Industry,Secondary_Industries,Company_Keywords,Domain,Website,Person_LinkedIn,Company_LinkedIn,Email,Status,Verification_Result\n";

        // Bug 12: escape all string fields — any field containing " or , would break CSV
        const csvEsc = v => String(v || '').replace(/"/g, '""');

        state.profiles.forEach(p => {
            const keywords = (p.companyKeywords || []).join('; ');
            const secIndustries = (p.secondaryIndustries || []).join('; ');
            const baseRow = [
                `"${csvEsc(p.name)}"`, `"${csvEsc(p.title)}"`, `"${csvEsc(p.company)}"`,
                `"${csvEsc(p.location)}"`, `"${csvEsc(p.employees)}"`, `"${csvEsc(p.industry)}"`,
                `"${csvEsc(secIndustries)}"`, `"${csvEsc(keywords)}"`,
                `"${csvEsc(p.domain)}"`, `"${csvEsc(p.website)}"`,
                `"${csvEsc(p.linkedin)}"`, `"${csvEsc(p.companyLinkedin)}"`
            ].join(',');

            if (p.results && p.results.length > 0) {
                p.results.forEach(r => {
                    csvContent += `${baseRow},"${csvEsc(r.email)}","${csvEsc(p.status)}","${csvEsc(r.result)}"\n`;
                });
            } else {
                // No emails yet or failed
                csvContent += `${baseRow},"","${csvEsc(p.status)}",""\n`;
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
