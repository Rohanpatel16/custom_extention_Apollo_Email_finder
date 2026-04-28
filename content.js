/**
 * content.js
 * Entry point for Apollo Email Verifier content script.
 * Orchestrates UI, Scraper, and API modules.
 */

(function () {
    const state = window.ContentState;
    const ui = window.ContentUI;
    const scraper = window.ContentScraper;
    const api = window.ApolloAPI;

    // -------------------------------------------------------------------------
    // 1. Initialization
    // -------------------------------------------------------------------------
    async function init() {
        if (document.getElementById('apollo-verifier-sidebar')) return;

        ui.init();
        setupEventListeners();
        
        // Load Keys
        await loadActiveKeys();

        // Load Session Profiles
        if (window.StorageWrapper) {
            const profiles = await StorageWrapper.getSidebarSession();
            state.profiles = profiles;
            if (state.profiles.length > 0) {
                ui.renderList(state.profiles, document.getElementById('av-show-valid-only')?.checked);
                updateStatusText(`Loaded ${state.profiles.length} profiles (Session)`);
            }
        }
    }

    async function loadActiveKeys() {
        if (!window.StorageWrapper) return;
        const keys = await StorageWrapper.getApiKeys();
        const selector = document.getElementById('av-key-selector');
        if (!selector) return;
        
        selector.innerHTML = '';
        if (keys.length === 0) {
            selector.innerHTML = '<option value="">No keys found</option>';
            updateKeyStatusUI(null);
            return;
        }

        keys.forEach((k, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            const statusIcon = k.status === 'active' ? '🟢' : (k.status === 'exhausted' ? '🔴' : '⚫');
            opt.text = `${statusIcon} ${k.label}`;
            selector.appendChild(opt);
        });

        const activeIdx = keys.findIndex(k => k.status === 'active');
        state.activeKeyIndex = activeIdx > -1 ? activeIdx : 0;
        state.activeKey = keys[state.activeKeyIndex];
        selector.value = state.activeKeyIndex;

        updateKeyStatusUI(state.activeKey);
    }

    function updateKeyStatusUI(key) {
        const el = document.getElementById('av-key-status');
        if (!el || !key) return;
        
        el.textContent = `Status: ${key.status.toUpperCase()} — fetching balance…`;
        el.style.color = key.status === 'active' ? '#10b981' : '#ef4444';

        chrome.runtime.sendMessage({ action: 'GET_APIFY_LIMITS', apiKey: key.key }, (response) => {
            if (!el) return;
            if (response?.success) {
                const { limits, current } = response.data.data;
                const remaining = Math.max(0, limits.maxMonthlyUsageUsd - current.monthlyUsageUsd);
                const pct = limits.maxMonthlyUsageUsd > 0 ? Math.min(100, (current.monthlyUsageUsd / limits.maxMonthlyUsageUsd) * 100).toFixed(0) : 0;
                el.textContent = `${key.status.toUpperCase()} • $${remaining.toFixed(2)} left (${pct}% used)`;
                el.style.color = pct >= 90 ? '#ef4444' : (pct >= 70 ? '#f59e0b' : '#10b981');
            } else {
                el.textContent = `${key.status.toUpperCase()} • ~$${parseFloat(key.balance || 0).toFixed(2)} (est.)`;
            }
        });
    }

    function updateStatusText(text) {
        const el = document.getElementById('av-status-text');
        if (el) el.textContent = text;
    }

    // -------------------------------------------------------------------------
    // 2. Event Listeners
    // -------------------------------------------------------------------------
    function setupEventListeners() {
        document.getElementById('av-close-btn').addEventListener('click', () => {
            document.getElementById('apollo-verifier-sidebar').classList.remove('open');
        });

        document.getElementById('av-help-btn').addEventListener('click', () => {
            document.getElementById('av-help-section').classList.toggle('av-hidden');
        });

        document.getElementById('av-manage-keys-btn').addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: "open_dashboard" });
        });

        document.getElementById('av-refresh-keys-btn').addEventListener('click', () => {
            loadActiveKeys();
            ui.showToast("Keys refreshed", "neutral");
        });

        document.getElementById('av-key-selector').addEventListener('change', async (e) => {
            const keys = await StorageWrapper.getApiKeys();
            state.activeKeyIndex = parseInt(e.target.value);
            state.activeKey = keys[state.activeKeyIndex];
            updateKeyStatusUI(state.activeKey);
        });

        document.getElementById('av-extract-btn').addEventListener('click', () => handleExtract(false));

        document.getElementById('av-open-crm-btn').addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: "open_dashboard" });
        });

        document.getElementById('av-next-page-btn').addEventListener('click', async () => {
            if (await scraper.clickNextPage()) ui.showToast("Navigating...", "neutral");
        });

        document.getElementById('av-autoscrape-toggle').addEventListener('change', (e) => {
            state.autoScraping = e.target.checked;
            if (state.autoScraping) runAutoScrape();
            else ui.setAutoScrapeStatus('Stopping...');
        });

        // Auto-Scrape Mode radios — also toggle bracket settings visibility
        document.querySelectorAll('input[name="av-scrape-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                state.autoScrapeMode = e.target.value;
                const bracketSettings = document.getElementById('av-bracket-settings');
                if (bracketSettings) {
                    bracketSettings.style.display = e.target.value === 'bracket' ? 'block' : 'none';
                }
            });
        });

        // Bracket input sync
        document.getElementById('av-bracket-min')?.addEventListener('input', (e) => {
            state.bracketMin = Math.max(1, parseInt(e.target.value, 10) || 1);
        });
        document.getElementById('av-bracket-max')?.addEventListener('input', (e) => {
            state.bracketMax = Math.max(1, parseInt(e.target.value, 10) || 50);
        });
        document.getElementById('av-bracket-step')?.addEventListener('input', (e) => {
            state.bracketStep = Math.max(1, parseInt(e.target.value, 10) || 2);
        });

        document.getElementById('av-show-valid-only').addEventListener('change', () => {
            ui.renderList(state.profiles, document.getElementById('av-show-valid-only').checked);
        });

        document.getElementById('av-clear-list-btn').addEventListener('click', async () => {
            if (confirm("Clear sidebar list?")) {
                state.profiles = [];
                await StorageWrapper.clearSidebarSession();
                ui.renderList([], false);
                updateStatusText('Ready to extract');
                ui.showToast("Sidebar cleared", "neutral");
            }
        });

        document.getElementById('av-verify-btn').addEventListener('click', () => handleVerify(false));
        document.getElementById('av-download-btn').addEventListener('click', downloadCSV);
        
        // Delegated listener for profile checkboxes
        document.getElementById('av-profile-list').addEventListener('change', (e) => {
            if (e.target.classList.contains('profile-select')) {
                const idx = parseInt(e.target.dataset.idx);
                if (state.profiles[idx]) state.profiles[idx].selected = e.target.checked;
            }
        });

        // Select All
        document.getElementById('av-select-all').addEventListener('change', (e) => {
            state.profiles.forEach(p => p.selected = e.target.checked);
            ui.renderList(state.profiles, document.getElementById('av-show-valid-only')?.checked);
        });
    }

    // -------------------------------------------------------------------------
    // 3. Handlers
    // -------------------------------------------------------------------------
    async function handleExtract(silent = false) {
        const newProfiles = await scraper.extractProfiles(silent);
        if (Array.isArray(newProfiles) && newProfiles.length > 0) {
            // Check global cache for existing verified emails to save costs
            const globalProfiles = await StorageWrapper.getAllProfiles();
            const globalCache = new Map(globalProfiles.map(p => [p.id, p]));

            newProfiles.forEach(p => {
                const cached = globalCache.get(p.id);
                if (cached && (cached.status === 'verified' || (cached.results && cached.results.length > 0))) {
                    p.status = 'verified';
                    p.results = cached.results || [];
                    p.old_results = cached.old_results || [];
                }
            });

            state.addProfiles(newProfiles);
            await StorageWrapper.saveSidebarSession(state.profiles);
            ui.renderList(state.profiles, document.getElementById('av-show-valid-only')?.checked);
            updateStatusText(`Added ${newProfiles.length} new profiles`);
            
            if (!state.autoScraping) {
                const needsVerify = newProfiles.some(p => p.status === 'ready');
                if (needsVerify) {
                    ui.showToast("Auto-verifying...", "neutral");
                    setTimeout(() => handleVerify(false), 1000);
                }
            }
        }
    }

    async function handleVerify(isRetry = false) {
        if (state.isVerifying) return false;
        if (!state.activeKey) {
            await loadActiveKeys();
            if (!state.activeKey) {
                ui.showToast("Add API Keys first", "error");
                return false;
            }
        }

        const toVerify = state.profiles.filter(p => p.selected && (isRetry ? p.status === 'failed' : p.status === 'ready'));
        if (toVerify.length === 0) return true;

        state.isVerifying = true;
        const btn = document.getElementById('av-verify-btn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `${ui.ICONS.spinner} Verifying...`;

        // Cost Optimization: Check CRM for existing verified profiles
        const allCrmProfiles = await StorageWrapper.getAllProfiles();
        const crmMap = new Map();
        allCrmProfiles.forEach(p => {
            if (p.linkedin_url) crmMap.set(`li:${p.linkedin_url}`, p);
            if (p.name && p.domain) crmMap.set(`nd:${p.name}:${p.domain}`, p);
            if (p.id) crmMap.set(`id:${p.id}`, p);
        });

        const actuallyNeedsVerify = [];
        toVerify.forEach(p => {
            const cached = crmMap.get(`id:${p.id}`) || crmMap.get(`li:${p.linkedin_url}`) || crmMap.get(`nd:${p.name}:${p.domain}`);
            
            if (cached && cached.status === 'verified' && cached.results && cached.results.length > 0) {
                p.results = cached.results;
                p.status = 'verified';
            } else {
                p.status = 'processing';
                actuallyNeedsVerify.push(p);
            }
        });

        ui.renderList(state.profiles, document.getElementById('av-show-valid-only')?.checked);

        try {
            if (actuallyNeedsVerify.length > 0) {
                let allEmails = [];
                actuallyNeedsVerify.forEach(p => allEmails.push(...p.emails));
                allEmails = [...new Set(allEmails)];

                if (allEmails.length > 0) {
                    const results = await callApifyWithSwitching(allEmails);
                    
                    // Update key balance (rough estimate)
                    const decisiveCount = results.filter(r => ['ok', 'disposable', 'invalid'].includes(r.result)).length;
                    const cost = decisiveCount * 0.001;
                    state.activeKey.balance = Math.max(0, (state.activeKey.balance || 0) - cost);
                    
                    // Save updated balance to storage
                    const keys = await StorageWrapper.getApiKeys();
                    if (keys[state.activeKeyIndex]) {
                        keys[state.activeKeyIndex].balance = state.activeKey.balance;
                        await StorageWrapper.saveApiKeys(keys);
                    }
                    
                    actuallyNeedsVerify.forEach(p => {
                        p.results = results.filter(r => p.emails.includes(r.email));
                        p.status = (p.results.some(r => r.result === 'ok') || p.results.length > 0) ? 'verified' : 'failed';
                    });
                    
                    ui.showToast(`Verified. Cost: $${cost.toFixed(4)}`, "success");
                } else {
                    actuallyNeedsVerify.forEach(p => p.status = 'failed');
                }
            } else if (toVerify.length > actuallyNeedsVerify.length) {
                ui.showToast("Copied from CRM (Cost: $0.00)", "success");
            }
            
            await StorageWrapper.saveSidebarSession(state.profiles);
            const validOnes = state.profiles.filter(p => p.status === 'verified' && p.results && p.results.some(r => r.result === 'ok'));
            if (validOnes.length > 0) await StorageWrapper.saveAllProfiles(validOnes);

            return true;
        } catch (e) {
            ui.showToast("Error: " + e.message, "error");
            actuallyNeedsVerify.forEach(p => p.status = 'failed');
            return false;
        } finally {
            state.isVerifying = false;
            btn.disabled = false;
            btn.innerHTML = originalText;
            ui.renderList(state.profiles, document.getElementById('av-show-valid-only')?.checked);
        }
    }

    async function callApifyWithSwitching(emails) {
        // Logic from callApify in monolith
        while (true) {
            const response = await new Promise(resolve => {
                chrome.runtime.sendMessage({
                    action: "CALL_APIFY",
                    emails: emails,
                    apiKey: state.activeKey.key
                }, resolve);
            });

            if (response.success) return response.data;

            let err;
            try { err = JSON.parse(response.error); } catch (e) { err = { message: response.error }; }

            if (err.status === 402) {
                const keys = await StorageWrapper.getApiKeys();
                keys[state.activeKeyIndex].status = 'exhausted';
                await StorageWrapper.saveApiKeys(keys);
                
                const nextIdx = keys.findIndex(k => k.status === 'active');
                if (nextIdx > -1) {
                    state.activeKeyIndex = nextIdx;
                    state.activeKey = keys[nextIdx];
                    loadActiveKeys();
                    ui.showToast("Switched to next key", "warning");
                    continue;
                } else {
                    throw new Error("All keys exhausted");
                }
            }
            throw new Error(err.message || response.error);
        }
    }

    async function activateDeadlockBreaker() {
        const domainCount = state.sessionDomains.size;
        if (domainCount === 0) return false;

        state.sessionDomains.forEach(d => state.allExcludedDomains.add(d));
        const totalDomains = state.allExcludedDomains.size;
        
        ui.setAutoScrapeStatus(`Deadlock! Excluding ${totalDomains} companies total...`);
        ui.showToast(`🔄 Deadlock: excluding ${totalDomains} companies total`, 'neutral');

        const allUrls = Array.from(state.allExcludedDomains).map(d => `https://${d}/`);
        let listId = null;
        try {
            const res = await api.saveExclusionQuery(allUrls);
            listId = res?.listId || res?.organization_search_list?.id || res?.model?.id || res?.list_id || res?.id || null;
            if (listId) {
                console.log('[Deadlock] Exclusion list registered:', listId);
            } else {
                console.warn('[Deadlock] save_query response had no ID field:', JSON.stringify(res));
            }
        } catch (e) {
            console.warn('[Deadlock] save_query failed:', e);
        }

        if (!listId) {
            ui.showToast('Deadlock breaker: no list registered — stopping.', 'error');
            return false;
        }

        let hash = window.location.hash;
        const newEncId = encodeURIComponent(listId);
        if (hash.includes('qNotOrganizationSearchListId=')) {
            hash = hash.replace(/qNotOrganizationSearchListId=[^&]*/, `qNotOrganizationSearchListId=${newEncId}`);
        } else {
            hash += `&qNotOrganizationSearchListId=${newEncId}`;
        }
        hash = hash.replace(/page=\d+/, 'page=1');
        window.location.hash = hash;

        state.sessionDomains.clear();
        ui.showToast(`✅ Deadlock broken — ${allUrls.length} companies excluded`, 'success');
        ui.setAutoScrapeStatus('Deadlock broken — resuming...');
        await new Promise(r => setTimeout(r, 3500));
        return true;
    }

    async function runBracketScrape() {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const globalMin = state.bracketMin || 1;
        const globalMax = state.bracketMax || 50;
        const step = state.bracketStep || 2;
        const bracketProgress = document.getElementById('av-bracket-progress');

        ui.showToast(`Bracket Scrape: ${globalMin}–${globalMax}, step ${step}`, 'success');

        for (let lo = globalMin; lo <= globalMax && state.autoScraping; lo += step) {
            const hi = Math.min(lo + step - 1, globalMax);

            // Set bounded bracket filter and update UI
            scraper.setBracketFilter(lo, hi);
            if (bracketProgress) bracketProgress.textContent = `Current bracket: ${lo}–${hi}`;
            await wait(state.SCRAPE_CONFIG.FILTER_WAIT_DELAY);

            // Inner loop: scrape + optional deadlock within this bracket
            let bracketDone = false;
            while (!bracketDone && state.autoScraping) {
                let newInBracket = 0;

                // Scrape up to 5 pages for this bracket — verify after each page
                while (state.autoScraping) {
                    const currentPage = scraper.getCurrentPageFromUrl();
                    ui.setAutoScrapeStatus(`[Bracket ${lo}–${hi}] Page ${currentPage}/5`);
                    await wait(state.SCRAPE_CONFIG.PAGE_LOAD_DELAY);

                    const extracted = await scraper.extractProfiles(true);
                    newInBracket += (extracted?.length || 0);
                    if (Array.isArray(extracted) && extracted.length > 0) {
                        state.addProfiles(extracted);
                        ui.renderList(state.profiles);

                        // Verify immediately after each page (Per-Page behaviour)
                        ui.setAutoScrapeStatus(`[Bracket ${lo}–${hi}] Verifying page ${currentPage}...`);
                        const ok = await handleVerify(false);
                        if (!ok) { state.autoScraping = false; break; }
                    }

                    if (currentPage >= 5) break;
                    if (!(await scraper.clickNextPage())) break;
                    await wait(state.SCRAPE_CONFIG.NAV_WAIT_DELAY);
                }

                if (!state.autoScraping) break;

                // Deadlock check: if this bracket still had domains, try to break out
                if (newInBracket > 0 && state.sessionDomains.size > 0) {
                    const broke = await activateDeadlockBreaker();
                    if (!broke) {
                        bracketDone = true; // deadlock unresolved — move to next bracket
                    } else {
                        // Re-apply bracket filter (deadlock breaker rewrites the URL)
                        scraper.setBracketFilter(lo, hi);
                        await wait(state.SCRAPE_CONFIG.FILTER_WAIT_DELAY);
                    }
                } else {
                    bracketDone = true; // bracket exhausted — move on
                }
            }

            // Clear domain tracking before next bracket
            state.sessionDomains.clear();
        }

        if (bracketProgress) bracketProgress.textContent = `Done — ${globalMin}–${globalMax} complete`;
        ui.showToast(`Bracket Scrape complete (${globalMin}–${globalMax})`, 'success');
    }

    async function runAutoScrape() {
        const hash = window.location.hash;
        if (!hash.includes('sortAscending=true') || !hash.includes('sortByField=organization_estimated_number_employees')) {
            ui.showToast('Sort by Employees, Ascending required', 'error');
            state.autoScraping = false;
            document.getElementById('av-autoscrape-toggle').checked = false;
            return;
        }

        const mode = state.autoScrapeMode || 'batch';

        // ── Bracket Mode: delegate to runBracketScrape ───────────────────────────
        if (mode === 'bracket') {
            await runBracketScrape();
            document.getElementById('av-autoscrape-toggle').checked = false;
            ui.setAutoScrapeStatus('Stopped');
            return;
        }

        ui.showToast(`Auto-Scrape started (${mode})`, 'success');
        const wait = ms => new Promise(r => setTimeout(r, ms));

        while (state.autoScraping) {
            let newProfilesInBatch = 0;
            const batchStartIndex = state.profiles.length;

            while (state.autoScraping) {
                const currentPage = scraper.getCurrentPageFromUrl();
                ui.setAutoScrapeStatus(`[${mode}] Page ${currentPage}/5... (Min: ${scraper.getCurrentMinFromUrl()})`);
                await wait(state.SCRAPE_CONFIG.PAGE_LOAD_DELAY);
                
                const extracted = await scraper.extractProfiles(true);
                newProfilesInBatch += (extracted?.length || 0);
                if (Array.isArray(extracted) && extracted.length > 0) {
                    state.addProfiles(extracted);
                    ui.renderList(state.profiles);
                    
                    if (mode === 'perpage') {
                        ui.setAutoScrapeStatus(`[Per-Page] Verifying page ${currentPage}...`);
                        const ok = await handleVerify(false);
                        if (!ok) { state.autoScraping = false; break; }
                    }
                }

                if (currentPage >= 5) break;
                ui.setAutoScrapeStatus(`[${mode}] Next page...`);
                if (!(await scraper.clickNextPage())) break;
                await wait(state.SCRAPE_CONFIG.NAV_WAIT_DELAY);
            }

            if (!state.autoScraping) break;

            if (mode === 'batch') {
                ui.setAutoScrapeStatus(`Verifying batch...`);
                const ok = await handleVerify(false);
                if (!ok) { state.autoScraping = false; break; }
            }

            if (newProfilesInBatch === 0) {
                // All results were deduplicated — likely resuming a previous session.
                // Advance the filter by 1 past the current minimum instead of stopping.
                const currentMinResume = scraper.getCurrentMinFromUrl();
                const resumeNext = currentMinResume + 1;
                console.log(`[AutoScrape] All results deduped at min=${currentMinResume} — resuming from ${resumeNext}`);
                ui.setAutoScrapeStatus(`Resuming — advancing past ${currentMinResume}...`);
                ui.showToast(`⏩ Resuming — skipping past employee count ${currentMinResume}`, 'neutral');
                scraper.advanceEmployeeFilter(resumeNext);
                await wait(state.SCRAPE_CONFIG.FILTER_WAIT_DELAY);
                continue; // restart outer loop with new filter
            }

            const maxEmp = scraper.getValidatedHighestEmployeeCount(batchStartIndex);
            const currentMin = scraper.getCurrentMinFromUrl();
            
            if (maxEmp !== null && maxEmp > currentMin) {
                // Normal advance: highest scraped count becomes new minimum
                ui.setAutoScrapeStatus(`Advancing filter to ${maxEmp}...`);
                scraper.advanceEmployeeFilter(maxEmp);
                await wait(state.SCRAPE_CONFIG.FILTER_WAIT_DELAY);
            } else if (maxEmp !== null && maxEmp === currentMin) {
                // Tie: all results share the filter minimum — step past it by 1
                const nextMin = currentMin + 1;
                ui.setAutoScrapeStatus(`Tie at ${currentMin} — stepping to ${nextMin}...`);
                console.log(`[AutoScrape] Tie at ${currentMin}, advancing to ${nextMin}`);
                scraper.advanceEmployeeFilter(nextMin);
                await wait(state.SCRAPE_CONFIG.FILTER_WAIT_DELAY);
            } else {
                // maxEmp is null — deadlock (no usable data from batch)
                if (state.sessionDomains.size > 0) {
                    const broke = await activateDeadlockBreaker();
                    if (!broke) { state.autoScraping = false; break; }
                } else {
                    ui.showToast('Auto-Scrape complete — no more results.', 'success');
                    state.autoScraping = false;
                    break;
                }
            }
        }
        
        document.getElementById('av-autoscrape-toggle').checked = false;
        ui.setAutoScrapeStatus('Stopped');
    }

    function downloadCSV() {
        if (state.profiles.length === 0) return ui.showToast("No data", "neutral");
        let csv = "Name,Title,Company,Location,Employees,Industry,Domain,Website,LinkedIn,Email,Status,Result\n";
        const esc = v => `"${String(v || '').replace(/"/g, '""')}"`;
        let rowCount = 0;

        state.profiles.forEach(p => {
            const base = `${esc(p.name)},${esc(p.title)},${esc(p.company)},${esc(p.location)},${esc(p.employees)},${esc(p.industry)},${esc(p.domain)},${esc(p.website)},${esc(p.linkedin)}`;
            const validEmails = (p.results || []).filter(r => r.result === 'ok');
            if (validEmails.length > 0) {
                validEmails.forEach(r => { csv += `${base},${esc(r.email)},${esc(p.status)},${esc(r.result)}\n`; rowCount++; });
            }
            // Profiles with no valid email are skipped entirely
        });

        if (rowCount === 0) return ui.showToast("No valid (ok) emails to export", "neutral");

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'apollo_leads.csv';
        a.click();
        ui.showToast(`Exported ${rowCount} valid email${rowCount !== 1 ? 's' : ''}`, "success");
    }

    // -------------------------------------------------------------------------
    // 4. Message Listener
    // -------------------------------------------------------------------------
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === "toggle_sidebar") {
            const sidebar = document.getElementById('apollo-verifier-sidebar');
            if (sidebar) sidebar.classList.toggle('open');
            else init().then(() => document.getElementById('apollo-verifier-sidebar').classList.add('open'));
        }
    });

    init();
})();
