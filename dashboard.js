// dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
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

    // --- initialization ---
    init();

    async function init() {
        await loadData();
        updateBalance();
        initSettings();
        setupEventListeners();
        render();
        updateFilterOptions();

        // ── Auto-refresh: listen for storage changes from extension ──────────
        // When content.js saves verified profiles to chrome.storage.local,
        // the dashboard updates automatically — no button click needed.
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'local' && changes['av_profiles']) {
                    // New profiles written by the extension — reload silently
                    const newVal = changes['av_profiles'].newValue || [];
                    allProfiles = newVal;
                    applyFilters();
                    render();
                    updateFilterOptions();
                    updateCounts();
                    console.log('[Dashboard] Auto-refreshed from storage change');
                }
            });
        }
    }

    async function updateBalance() {
        const key = await StorageWrapper.getActiveKey();
        const balance = key && key.balance !== undefined ? parseFloat(key.balance) : 0.00;
        const el = document.getElementById('balance-display');
        if (el) el.textContent = `Credits: $${balance.toFixed(4)}`;
    }

    async function loadData() {
        if (window.StorageWrapper) {
            allProfiles = await StorageWrapper.getProfiles();
        } else {
            console.error("StorageWrapper not found");
        }
        applyFilters();
    }

    function setupEventListeners() {
        // Tabs
        document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.nav-item[data-tab]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeTab = btn.dataset.tab;
                currentPage = 1;
                applyFilters();
                render();
            });
        });

        // Legal page
        document.getElementById('legal-nav-btn').addEventListener('click', () => {
            document.getElementById('legal-section').style.display = 'block';
        });
        document.getElementById('legal-close-btn').addEventListener('click', () => {
            document.getElementById('legal-section').style.display = 'none';
        });
        document.querySelectorAll('.legal-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                // Switch active tab style
                document.querySelectorAll('.legal-tab').forEach(t => {
                    t.style.color = '#6b7280';
                    t.style.borderBottom = 'none';
                });
                tab.style.color = '#4f46e5';
                tab.style.borderBottom = '2px solid #4f46e5';
                // Show the right content
                document.querySelectorAll('.legal-content').forEach(c => c.style.display = 'none');
                document.getElementById('legal-' + tab.dataset.legal).style.display = 'block';
            });
        });

        // Search
        document.getElementById('global-search').addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase();
            currentPage = 1;
            applyFilters();
            render();
        });

        // Filters
        document.getElementById('filter-job').addEventListener('change', (e) => {
            filterJob = e.target.value;
            currentPage = 1;
            applyFilters();
            render();
        });
        document.getElementById('filter-company').addEventListener('change', (e) => {
            filterCompany = e.target.value;
            currentPage = 1;
            applyFilters();
            render();
        });
        document.getElementById('filter-location').addEventListener('change', (e) => {
            filterLocation = e.target.value;
            currentPage = 1;
            applyFilters();
            render();
        });
        document.getElementById('filter-industry').addEventListener('change', (e) => {
            filterIndustry = e.target.value;
            currentPage = 1;
            applyFilters();
            render();
        });
        document.getElementById('filter-employees').addEventListener('change', (e) => {
            filterEmployees = e.target.value;
            const customRow = document.getElementById('custom-emp-range');
            if (filterEmployees === 'custom') {
                customRow.style.display = 'flex';
                // Don't apply yet — wait for the Apply button
            } else {
                customRow.style.display = 'none';
                customEmpMin = null;
                customEmpMax = null;
                currentPage = 1;
                applyFilters();
                render();
            }
        });

        // Custom range: Apply button
        document.getElementById('emp-apply-btn').addEventListener('click', () => {
            const minVal = document.getElementById('emp-min').value;
            const maxVal = document.getElementById('emp-max').value;
            customEmpMin = minVal !== '' ? parseInt(minVal, 10) : null;
            customEmpMax = maxVal !== '' ? parseInt(maxVal, 10) : null;
            currentPage = 1;
            applyFilters();
            render();
        });

        // Custom range: Clear / reset button
        document.getElementById('emp-clear-btn').addEventListener('click', () => {
            document.getElementById('emp-min').value = '';
            document.getElementById('emp-max').value = '';
            document.getElementById('filter-employees').value = '';
            document.getElementById('custom-emp-range').style.display = 'none';
            filterEmployees = '';
            customEmpMin = null;
            customEmpMax = null;
            currentPage = 1;
            applyFilters();
            render();
        });
        document.getElementById('show-valid-only').addEventListener('change', (e) => {
            showValidOnly = e.target.checked;
            currentPage = 1;
            applyFilters();
            render();
        });

        // Actions
        document.getElementById('refresh-btn').addEventListener('click', () => {
            loadData().then(() => {
                updateBalance();
                render();
                alert('Data refreshed from storage');
            });
        });

        document.getElementById('sync-cloud-btn').addEventListener('click', async () => {
            const btn = document.getElementById('sync-cloud-btn');
            btn.textContent = '⏳ Syncing…';
            btn.disabled = true;
            try {
                // Check what's in Turso first
                const cloudProfiles = await TursoSync.getAllProfiles();

                if (cloudProfiles.length === 0 && allProfiles.length > 0) {
                    // Turso is empty but we have local data → PUSH local up to cloud
                    const count = await StorageWrapper.pushToTurso();
                    alert(`✅ Backed up ${count} profiles to Turso cloud.`);
                } else if (cloudProfiles.length > 0) {
                    // Turso has data → PULL cloud into local storage
                    const profiles = await StorageWrapper.pullFromTurso();
                    allProfiles = profiles;
                    applyFilters();
                    render();
                    updateFilterOptions();
                    alert(`✅ Synced ${profiles.length} profiles from Turso cloud.`);
                } else {
                    // Both empty
                    alert('ℹ️ Nothing to sync — no profiles in local storage or cloud yet.');
                }
            } catch (err) {
                console.error('[TursoSync] sync failed:', err);
                alert('❌ Sync failed: ' + err.message);
            } finally {
                btn.textContent = '☁️ Sync from Cloud';
                btn.disabled = false;
            }
        });

        document.getElementById('clear-all-btn').addEventListener('click', async () => {
            if (confirm("Clear local leads? (Don't worry, your cloud backup in Turso will be preserved)")) {
                await StorageWrapper.clearAllProfiles();
                allProfiles = [];
                applyFilters();
                render();
            }
        });

        document.getElementById('clean-links-btn').addEventListener('click', cleanLinkedInLinks);

        // Pagination
        document.getElementById('prev-page').addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                render();
            }
        });
        document.getElementById('next-page').addEventListener('click', () => {
            if (currentPage * itemsPerPage < filteredProfiles.length) {
                currentPage++;
                render();
            }
        });

        // Dark Mode
        document.getElementById('toggle-dark-mode').addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
        });
        if (localStorage.getItem('darkMode') === 'true') {
            document.body.classList.add('dark-mode');
        }

        // Export Modal
        const modal = document.getElementById('export-modal');
        document.getElementById('export-btn').addEventListener('click', () => modal.classList.remove('hidden'));
        document.getElementById('close-export-modal').addEventListener('click', () => modal.classList.add('hidden'));
        document.getElementById('confirm-export').addEventListener('click', handleExport);

        // Import Logic
        const importBtn = document.getElementById('import-btn');
        const importInput = document.getElementById('import-input');
        if (importBtn && importInput) {
            importBtn.addEventListener('click', () => importInput.click());
            importInput.addEventListener('change', handleImport);
        }
    }

    function applyFilters() {
        filteredProfiles = allProfiles.filter(p => {
            // Tab Filter
            if (activeTab === 'verified' && p.status !== 'verified') return false;
            if (activeTab === 'failed' && p.status !== 'failed') return false;

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
                    // No parseable number and a preset filter is set — exclude
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
        document.getElementById('count-all').textContent = allProfiles.length;
        document.getElementById('count-verified').textContent = allProfiles.filter(p => p.status === 'verified').length;
        document.getElementById('count-failed').textContent = allProfiles.filter(p => p.status === 'failed').length;
    }

    function updateFilterOptions() {
        const jobs = [...new Set(allProfiles.map(p => p.title).filter(Boolean))].sort();
        const companies = [...new Set(allProfiles.map(p => p.company).filter(Boolean))].sort();
        const locations = [...new Set(allProfiles.map(p => p.location).filter(Boolean))].sort();
        const industries = [...new Set(allProfiles.map(p => p.industry).filter(Boolean))].sort();

        populateSelect('filter-job', jobs);
        populateSelect('filter-company', companies);
        populateSelect('filter-location', locations);
        populateSelect('filter-industry', industries);
        // Note: filter-employees options are static (fixed bands) — not populated dynamically
    }

    function populateSelect(id, options) {
        const select = document.getElementById(id);
        const currentVal = select.value;
        // Keep first option
        select.innerHTML = select.firstElementChild.outerHTML;
        options.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt;
            el.textContent = opt;
            select.appendChild(el);
        });
        select.value = currentVal;
    }

    function render() {
        const tbody = document.getElementById('table-body');
        tbody.innerHTML = '';

        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageItems = filteredProfiles.slice(start, end);

        if (pageItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">No records found</td></tr>';
        } else {
            pageItems.forEach(p => {
                const tr = document.createElement('tr');

                // Email Column Logic - current verified emails
                let emailHtml = '';
                const validEmails = p.results ? p.results.filter(r => r.result === 'ok') : [];

                if (validEmails.length > 0) {
                    validEmails.forEach(r => {
                        emailHtml += `<div class="email-row" title="Verified Valid">
                            <span style="font-size:12px; color: #10b981;">✅ ${r.email}</span>
                            <button class="btn-copy" onclick="copyToClipboard('${r.email}')">📋</button>
                        </div>`;
                    });
                } else if (p.status === 'verified') {
                    emailHtml = `<span class="status-badge status-failed" title="Verification completed but no valid email found">No Valid Email</span>`;
                } else if (p.results && p.results.length > 0) {
                    emailHtml = `<span class="status-badge status-failed">No Valid Email</span>`;
                } else {
                    emailHtml = `<span class="status-badge status-${p.status}">${p.status}</span>`;
                }

                // Old emails from previous jobs
                const oldVerified = Array.isArray(p.old_results)
                    ? p.old_results.filter(r => r.result === 'ok')
                    : [];
                if (oldVerified.length > 0) {
                    emailHtml += `<div style="margin-top:4px; border-top:1px dashed #d1d5db; padding-top:3px;">`;
                    oldVerified.forEach(r => {
                        emailHtml += `<div class="email-row" title="Past job email (archived)">
                            <span style="font-size:11px; color:#9ca3af;">📂 ${r.email}</span>
                            <button class="btn-copy" onclick="copyToClipboard('${r.email}')">📋</button>
                        </div>`;
                    });
                    emailHtml += `</div>`;
                }

                // Socials
                let socialsHtml = '';
                if (p.linkedin) socialsHtml += `<a href="${p.linkedin}" target="_blank" title="Person LinkedIn">IN</a> `;
                if (p.website) socialsHtml += `<a href="${p.website}" target="_blank" title="Company Website">🌐</a>`;
                if (p.companyLinkedin) socialsHtml += `<a href="${p.companyLinkedin}" target="_blank" title="Company LinkedIn">🏢</a>`;

                // Job-change badge
                const jobChangeBadge = p.jobChanged
                    ? `<span title="Job changed — re-verify email" style="font-size:10px; background:#fef3c7; color:#92400e; padding:1px 5px; border-radius:4px; margin-left:4px;">🔄 Job Changed</span>`
                    : '';

                tr.innerHTML = `
                    <td><input type="checkbox" class="row-checkbox" value="${p.id}"></td>
                    <td>
                        <div style="font-weight:500;">${p.name}</div>
                        <div class="cell-title">${p.title || '-'}</div>
                    </td>
                    <td>
                        <div>${p.company || '-'}${jobChangeBadge}</div>
                        <div class="cell-meta">${p.domain || ''}</div>
                    </td>
                    <td><div style="font-size:13px;">${p.employees || '-'}</div></td>
                    <td><div style="font-size:13px; color:#6b7280;">${p.industry || '-'}</div></td>
                    <td><div style="font-size:12px; color:#6b7280;">${(p.secondaryIndustries || []).join(', ') || '-'}</div></td>
                    <td><div style="font-size:12px; color:#94a3b8;">${(p.companyKeywords || []).slice(0,5).join(', ') || '-'}</div></td>
                    <td>${p.location || '-'}</td>
                    <td>${emailHtml}</td>
                    <td>${socialsHtml}</td>
                    <td>
                        <button class="btn btn-secondary" onclick="deleteProfile('${p.id}')">🗑️</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

        }

        // Pagination Info
        document.getElementById('pagination-info').textContent = `Showing ${filteredProfiles.length > 0 ? start + 1 : 0}-${Math.min(end, filteredProfiles.length)} of ${filteredProfiles.length}`;
        document.getElementById('prev-page').disabled = currentPage === 1;
        document.getElementById('next-page').disabled = end >= filteredProfiles.length;
    }

    // Export Logic
    function handleExport() {
        const format = document.querySelector('input[name="export-format"]:checked').value;
        const validOnly = document.getElementById('export-valid-only').checked;

        let dataToExport = filteredProfiles; // OR allProfiles based on user intent? Usually filter applies to export.
        // Let's stick to filteredProfiles for "What you see is what you get"

        if (validOnly) {
            dataToExport = dataToExport.filter(p => p.status === 'verified' && p.results.some(r => r.result === 'ok'));
        }

        if (format === 'json') {
            downloadJSON(dataToExport);
        } else {
            downloadCSV(dataToExport);
        }
        document.getElementById('export-modal').classList.add('hidden');
    }

    function downloadJSON(data) {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        triggerDownload(dataStr, "apollo_crm_export.json");
    }

    function downloadCSV(data) {
        const header = ["Name", "Title", "Company", "Employees", "Industry", "Secondary_Industries", "Company_Keywords", "Location", "Domain", "Website", "Person_LinkedIn", "Company_LinkedIn", "Email", "Verification_Status"];
        let csvContent = header.join(",") + "\n";

        data.forEach(p => {
            // Bug 11: escape all string fields — commas and quotes inside values break CSV
            const csvEsc = v => String(v || '').replace(/"/g, '""');
            const keywords = (p.companyKeywords || []).join('; ');
            const secIndustries = (p.secondaryIndustries || []).join('; ');

            // If multiple emails, replicate row for cleaner CSV usage
            let emails = [];
            if (p.results && p.results.length > 0) {
                const isExportValidOnly = document.getElementById('export-valid-only').checked;

                p.results.forEach(r => {
                    if (isExportValidOnly && r.result !== 'ok') return;
                    emails.push({ email: r.email, status: r.result });
                });
            }

            if (emails.length === 0) {
                const row = [
                    `"${csvEsc(p.name)}"`, `"${csvEsc(p.title)}"`, `"${csvEsc(p.company)}"`,
                    `"${csvEsc(p.employees)}"`, `"${csvEsc(p.industry)}"`,
                    `"${csvEsc(secIndustries)}"`, `"${csvEsc(keywords)}"`, `"${csvEsc(p.location)}"`,
                    `"${csvEsc(p.domain)}"`, `"${csvEsc(p.website)}"`,
                    `"${csvEsc(p.linkedin)}"`, `"${csvEsc(p.companyLinkedin)}"`,
                    `""`, `"${csvEsc(p.status)}"`
                ];
                csvContent += row.join(",") + "\n";
            } else {
                emails.forEach(e => {
                    const row = [
                        `"${csvEsc(p.name)}"`, `"${csvEsc(p.title)}"`, `"${csvEsc(p.company)}"`,
                        `"${csvEsc(p.employees)}"`, `"${csvEsc(p.industry)}"`,
                        `"${csvEsc(secIndustries)}"`, `"${csvEsc(keywords)}"`, `"${csvEsc(p.location)}"`,
                        `"${csvEsc(p.domain)}"`, `"${csvEsc(p.website)}"`,
                        `"${csvEsc(p.linkedin)}"`, `"${csvEsc(p.companyLinkedin)}"`,
                        `"${csvEsc(e.email)}"`, `"${csvEsc(e.status)}"`
                    ];
                    csvContent += row.join(",") + "\n";
                });
            }
        });

        const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
        triggerDownload(dataStr, "apollo_crm_export.csv");
    }

    function triggerDownload(dataStr, fileName) {
        const link = document.createElement("a");
        link.setAttribute("href", dataStr);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // --- Import Logic ---
    async function handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            const rows = parseCSV(text);

            if (rows.length === 0) {
                alert("No valid data found in CSV");
                return;
            }

            // Grouping logic: merge rows by Name + Domain
            const groups = {};
            rows.forEach(row => {
                // Use Name + Domain as key for deduplication
                const name = row.Name || "";
                const domain = row.Domain || "";
                const key = `${name}_${domain}`.toLowerCase();
                
                if (!groups[key]) {
                    groups[key] = {
                        id: Math.random().toString(36).substr(2, 9),
                        name: name,
                        title: row.Title || "",
                        company: row.Company || "",
                        employees: row.Employees || "",
                        industry: row.Industry || "",
                        location: row.Location || "",
                        domain: domain,
                        website: row.Website || "",
                        linkedin: row.Person_LinkedIn || "",
                        companyLinkedin: row.Company_LinkedIn || "",
                        status: 'ready',
                        results: []
                    };
                }

                if (row.Email) {
                    const resultObj = {
                        email: row.Email,
                        result: row.Verification_Status || "unknown"
                    };
                    
                    // Update status if we have a verified email
                    if (row.Verification_Status === 'ok') {
                        groups[key].status = 'verified';
                    }

                    // Avoid duplicate emails for the same person
                    if (!groups[key].results.some(r => r.email === row.Email)) {
                        groups[key].results.push(resultObj);
                    }
                }
            });

            const importedProfiles = Object.values(groups);

            if (confirm(`Import ${importedProfiles.length} profiles to CRM?`)) {
                await StorageWrapper.saveAllProfiles(importedProfiles);
                await loadData();
                render();
                updateFilterOptions();
                alert(`Successfully imported ${importedProfiles.length} profiles.`);
            }

            // Clear input
            e.target.value = "";
        };
        reader.readAsText(file);
    }

    function parseCSV(text) {
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
        const results = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
            const fields = lines[i].split(regex).map(f => f.replace(/^"|"$/g, '').trim());

            if (fields.length < headers.length) continue;

            const entry = {};
            headers.forEach((h, idx) => {
                entry[h] = fields[idx] || "";
            });
            results.push(entry);
        }
        return results;
    }

    // Global helper for delete
    window.deleteProfile = async (id) => {
        if (confirm("Delete this profile?")) {
            const index = allProfiles.findIndex(p => p.id === id);
            if (index > -1) {
                allProfiles.splice(index, 1);
                await StorageWrapper.overwriteGlobalProfiles(allProfiles);
                applyFilters();
                render();
                updateFilterOptions(); // Bug 14: refresh dropdowns so deleted profile's values don't linger
            }
        }
    };

    window.copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('Copied: ' + text);
    };

    async function cleanLinkedInLinks() {
        if (!confirm("This will scan all leads and remove/fix any LinkedIn URLs that are not personal profiles (missing /in/). Continue?")) {
            return;
        }

        let fixCount = 0;
        let moveCount = 0;

        allProfiles.forEach(p => {
            const hasLink = p.linkedin && p.linkedin.includes('linkedin.com');
            const isPersonal = p.linkedin && p.linkedin.includes('linkedin.com/in/');

            if (hasLink && !isPersonal) {
                // If it's a company link and companyLinkedin is empty, move it there
                if (!p.companyLinkedin && (p.linkedin.includes('/company/') || p.linkedin.includes('/school/'))) {
                    p.companyLinkedin = p.linkedin;
                    moveCount++;
                }

                // Clear the personal LinkedIn field since it's invalid/messed up
                p.linkedin = "";
                fixCount++;
            }
        });

        if (fixCount === 0) {
            alert("No invalid LinkedIn links found. Your data is clean! ✨");
            return;
        }

        try {
            // Save updated profiles
            await StorageWrapper.overwriteGlobalProfiles(allProfiles);
            applyFilters();
            render();
            alert(`✅ Cleanup Complete!\n\n- Fixed/Cleared: ${fixCount} invalid personal links\n- Moved to Company field: ${moveCount}\n\nExisting leads can now be "re-found" with correct links when you scrape them again on Apollo.`);
        } catch (err) {
            console.error("Cleanup failed:", err);
            alert("Cleanup failed. See console for details.");
        }
    }

    // --- API Key Management (Settings) ---
    function initSettings() {
        // Modal Toggles
        const modal = document.getElementById('settings-modal');
        document.getElementById('settings-btn').addEventListener('click', () => {
            resetKeyForm(); // Clear form when opening
            renderKeys(false); // instant from cache — no API call on open
            modal.classList.remove('hidden');
        });
        document.getElementById('close-settings-modal').addEventListener('click', () => modal.classList.add('hidden'));

        // Edit Mode State
        let editingIndex = -1;

        function resetKeyForm() {
            editingIndex = -1;
            document.getElementById('new-key-token').value = '';
            document.getElementById('new-key-label').value = '';
            document.getElementById('new-key-date').value = '';
            document.getElementById('add-key-btn').textContent = '+ Add Key';
            // Hide verify preview strip
            const preview = document.getElementById('key-verify-preview');
            if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
        }


        // ── Helper: call Apify limits directly (dashboard has host_permissions) ─
        async function fetchApifyLimits(token) {
            const res = await fetch(
                `https://api.apify.com/v2/users/me/limits?token=${encodeURIComponent(token)}`
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error?.message || `HTTP ${res.status}`);
            }
            const json = await res.json();
            return json.data; // { monthlyUsageCycle, limits, current }
        }


        // ── Helper: build & show the account info preview strip ─────────────
        function showVerifyPreview(limitsData, isOk) {
            const preview = document.getElementById('key-verify-preview');
            if (!isOk) {
                preview.style.display = 'block';
                preview.style.background = '#fef2f2';
                preview.style.border = '1px solid #fecaca';
                preview.style.color = '#dc2626';
                preview.innerHTML = `❌ <strong>Invalid token</strong> — could not reach Apify. Check the key and try again.`;
                return;
            }
            const { limits, current, monthlyUsageCycle } = limitsData;
            const used      = current.monthlyUsageUsd;
            const max       = limits.maxMonthlyUsageUsd;
            const remaining = Math.max(0, max - used);
            const pct       = max > 0 ? Math.min(100, (used / max) * 100).toFixed(0) : 0;
            const endDate   = monthlyUsageCycle?.endAt
                ? new Date(monthlyUsageCycle.endAt).toISOString().split('T')[0]
                : null;
            const startDate = monthlyUsageCycle?.startAt
                ? new Date(monthlyUsageCycle.startAt).toLocaleDateString()
                : '?';

            const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#10b981';

            preview.style.display = 'block';
            preview.style.background = '#f0fdf4';
            preview.style.border = '1px solid #86efac';
            preview.style.color = '#166534';
            preview.innerHTML = `
                ✅ <strong>Token verified</strong> &nbsp;|&nbsp;
                Plan: <strong>$${max}/month</strong> &nbsp;|&nbsp;
                Used: <strong>$${used.toFixed(2)}</strong> ($${remaining.toFixed(2)} left, ${pct}%) &nbsp;|&nbsp;
                Cycle: ${startDate} → <strong>${endDate || '?'}</strong>
                <div style="margin-top:6px; background:#dcfce7; border-radius:3px; height:4px; overflow:hidden;">
                    <div style="width:${pct}%; background:${barColor}; height:100%; border-radius:3px;"></div>
                </div>
                ${endDate ? '<span style="font-size:11px; color:#166534;">📅 Renewal date auto-filled below</span>' : ''}
            `;

            // Auto-fill the date input with the cycle end date
            if (endDate) document.getElementById('new-key-date').value = endDate;
        }

        // ── Verify button ────────────────────────────────────────────────────
        document.getElementById('verify-key-btn').addEventListener('click', async () => {
            const token = document.getElementById('new-key-token').value.trim();
            if (!token) { alert('Enter an API token first.'); return; }

            const btn = document.getElementById('verify-key-btn');
            btn.textContent = '⏳';
            btn.disabled = true;

            try {
                const data = await fetchApifyLimits(token);
                showVerifyPreview(data, true);
            } catch {
                showVerifyPreview(null, false);
            } finally {
                btn.textContent = '🔍 Verify';
                btn.disabled = false;
            }
        });

        // ── Refresh All Balances button ──────────────────────────────────────
        document.getElementById('refresh-all-balances-btn').addEventListener('click', () => {
            renderKeys(true); // live fetch from Apify
        });

        // ── Add / Update Key ─────────────────────────────────────────────────
        document.getElementById('add-key-btn').addEventListener('click', async () => {
            const tokenInp = document.getElementById('new-key-token');
            const labelInp = document.getElementById('new-key-label');
            const dateInp  = document.getElementById('new-key-date');
            const addBtn   = document.getElementById('add-key-btn');

            const token = tokenInp.value.trim();
            const label = labelInp.value.trim() || 'My Key';

            if (!token) { alert('Please enter an API Token'); return; }

            // Auto-verify & auto-fill renewal date before saving
            addBtn.textContent = '⏳ Verifying…';
            addBtn.disabled = true;
            let renewDate = dateInp.value; // use whatever is already filled (manual or from Verify)

            try {
                const data = await fetchApifyLimits(token);
                showVerifyPreview(data, true);
                // If date not already set, auto-fill from Apify cycle
                if (!dateInp.value && data.monthlyUsageCycle?.endAt) {
                    renewDate = new Date(data.monthlyUsageCycle.endAt).toISOString().split('T')[0];
                    dateInp.value = renewDate;
                } else {
                    renewDate = dateInp.value;
                }
                // Store the real plan limit as the starting balance
                const planLimit = data.limits?.maxMonthlyUsageUsd ?? 5.00;
                const used      = data.current?.monthlyUsageUsd ?? 0;

                const keys = await StorageWrapper.getApiKeys();
                if (editingIndex > -1) {
                    keys[editingIndex].key       = token;
                    keys[editingIndex].label     = label;
                    keys[editingIndex].renewDate = renewDate;
                    keys[editingIndex].balance   = Math.max(0, planLimit - used);
                    await StorageWrapper.saveApiKeys(keys);
                    alert('Key updated successfully!');
                } else {
                    keys.push({
                        key:       token,
                        label:     label,
                        renewDate: renewDate,
                        addedAt:   new Date().toISOString(),
                        balance:   Math.max(0, planLimit - used),
                        status:    'active'
                    });
                    await StorageWrapper.saveApiKeys(keys);
                    alert('Key added! ✅  Plan: $' + planLimit + '/mo | $' + (planLimit - used).toFixed(2) + ' remaining');
                }
            } catch {
                // Token invalid — still allow saving but warn
                if (!confirm('⚠️ Could not verify this token with Apify (check the key). Save anyway?')) {
                    addBtn.textContent = editingIndex > -1 ? 'Update Key' : '+ Add Key';
                    addBtn.disabled = false;
                    return;
                }
                const keys = await StorageWrapper.getApiKeys();
                if (editingIndex > -1) {
                    keys[editingIndex].key       = token;
                    keys[editingIndex].label     = label;
                    keys[editingIndex].renewDate = dateInp.value;
                    await StorageWrapper.saveApiKeys(keys);
                } else {
                    keys.push({ key: token, label, renewDate: dateInp.value,
                        addedAt: new Date().toISOString(), balance: 5.00, status: 'active' });
                    await StorageWrapper.saveApiKeys(keys);
                }
            }

            addBtn.textContent = editingIndex > -1 ? 'Update Key' : '+ Add Key';
            addBtn.disabled = false;
            resetKeyForm();
            renderKeys(false); // re-render from updated cache
        });



        // ── renderKeys(fetchLive) ─────────────────────────────────────────────
        // fetchLive=false  → instant render from local storage (no API calls)
        // fetchLive=true   → hits Apify, fixes statuses/balances, saves, re-renders
        // Threshold: remaining ≤ $0.50 → exhausted | > $0.50 → active
        const AUTO_EXHAUST_THRESHOLD = 0.50;

        window.renderKeys = async function (fetchLive = false) {
            const list = document.getElementById('keys-list');
            let keys = await StorageWrapper.getApiKeys();

            if (keys.length === 0) {
                list.innerHTML = '<div style="color:#888; text-align:center; padding:10px;">No keys found. Add one above.</div>';
                return;
            }

            if (fetchLive) {
                // ── LIVE MODE: fetch all from Apify, correct statuses, save ──
                const refreshBtn = document.getElementById('refresh-all-balances-btn');
                if (refreshBtn) { refreshBtn.textContent = '⏳ Refreshing…'; refreshBtn.disabled = true; }

                const balanceResults = await Promise.allSettled(
                    keys.map(k => fetchApifyLimits(k.key))
                );

                let anyChanged = false;
                balanceResults.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        const data      = result.value;
                        const used      = data.current.monthlyUsageUsd;
                        const max       = data.limits.maxMonthlyUsageUsd;
                        const remaining = Math.max(0, max - used);
                        const correct   = remaining > AUTO_EXHAUST_THRESHOLD ? 'active' : 'exhausted';
                        // Store fetched balance and last-refreshed timestamp
                        keys[index].balance      = remaining;
                        keys[index].balanceUsed  = used;
                        keys[index].balanceMax   = max;
                        keys[index].lastRefreshed = new Date().toISOString();
                        if (keys[index].status !== correct) {
                            keys[index].status = correct;
                            anyChanged = true;
                        } else { anyChanged = true; } // always save refreshed balance
                    }
                });
                await StorageWrapper.saveApiKeys(keys);

                if (refreshBtn) { refreshBtn.textContent = '🔄 Refresh All'; refreshBtn.disabled = false; }
            }

            // ── RENDER from local storage (after optional live update) ─────────
            list.innerHTML = '';
            keys.forEach((k, index) => {
                const masked      = k.key.length > 8
                    ? k.key.substring(0, 4) + '...' + k.key.substring(k.key.length - 4)
                    : '****';
                const renewText   = k.renewDate ? `Renew: ${k.renewDate}` : 'No renew date';
                const statusColor = k.status === 'active' ? '#10b981' : '#ef4444';

                // Build balance row from cached data
                let balanceHtml;
                const localBal = k.balance !== undefined ? parseFloat(k.balance) : null;

                if (localBal !== null && k.balanceMax !== undefined) {
                    const used      = parseFloat(k.balanceUsed || 0);
                    const max       = parseFloat(k.balanceMax);
                    const remaining = localBal;
                    const pct       = max > 0 ? Math.min(100, (used / max) * 100) : 0;
                    const barColor  = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#10b981';
                    const remColor  = k.status === 'active'
                        ? (pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#10b981')
                        : '#ef4444';
                    const badge     = k.status === 'active'
                        ? `<span style="font-size:10px; padding:1px 6px; border-radius:3px; background:#dcfce7; color:#166534;">✓ active</span>`
                        : `<span style="font-size:10px; padding:1px 6px; border-radius:3px; background:#fee2e2; color:#dc2626;">✗ exhausted</span>`;
                    const refreshedText = k.lastRefreshed
                        ? `<span style="font-size:10px; color:#d1d5db;">Updated: ${new Date(k.lastRefreshed).toLocaleTimeString()}</span>`
                        : `<span style="font-size:10px; color:#d1d5db;">Click 🔄 to get live balance</span>`;

                    balanceHtml = `
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:wrap;">
                            <span style="color:${remColor}; font-weight:600;">$${remaining.toFixed(2)} left</span>
                            <span style="color:#9ca3af;">($${used.toFixed(2)} of $${max.toFixed(2)} used)</span>
                            ${badge}
                            ${refreshedText}
                        </div>
                        <div style="background:#e5e7eb; border-radius:4px; height:5px; overflow:hidden;">
                            <div style="width:${pct.toFixed(1)}%; background:${barColor}; height:100%; border-radius:4px;"></div>
                        </div>`;
                } else if (localBal !== null) {
                    // Have local balance but no max (older format)
                    balanceHtml = `<span style="color:#9ca3af; font-size:12px;">~$${localBal.toFixed(2)} cached &nbsp;•&nbsp; Click 🔄 Refresh All for live data</span>`;
                } else {
                    balanceHtml = `<span style="color:#9ca3af; font-size:12px;">No balance data — click 🔄 Refresh All</span>`;
                }

                const div = document.createElement('div');
                div.className = 'key-item';
                div.style.cssText = 'background:#f9fafb; border:1px solid #e5e7eb; padding:10px 12px; margin-bottom:8px; border-radius:8px;';
                div.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div style="flex:1; min-width:0;">
                            <div style="font-weight:600; font-size:14px; margin-bottom:3px;">
                                ${k.label}
                                <span style="font-size:11px; padding:2px 6px; border-radius:4px; background:${statusColor}20; color:${statusColor}; margin-left:4px;">${k.status.toUpperCase()}</span>
                            </div>
                            <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">
                                Token: ${masked} &nbsp;•&nbsp; ${renewText}
                            </div>
                            <div style="font-size:12px;">${balanceHtml}</div>
                        </div>
                        <div style="display:flex; gap:8px; margin-left:10px; flex-shrink:0; align-items:center;">
                            <button class="btn-sm btn-edit-key" data-idx="${index}" style="background:none; border:none; cursor:pointer;" title="Edit">✏️</button>
                            <button class="btn-sm btn-delete-key" data-idx="${index}" style="background:none; border:none; cursor:pointer;" title="Delete">🗑️</button>
                            ${k.status === 'exhausted' ? `<button class="btn-sm btn-reset-key" data-idx="${index}" style="font-size:12px; color:#3b82f6; background:none; border:none; cursor:pointer; text-decoration:underline;">Reset</button>` : ''}
                        </div>
                    </div>
                `;
                list.appendChild(div);
            });

            // ── Event Handlers ────────────────────────────────────────────────
            document.querySelectorAll('.btn-edit-key').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const idx = parseInt(e.target.dataset.idx);
                    const keys = await StorageWrapper.getApiKeys();
                    const k = keys[idx];
                    editingIndex = idx;
                    document.getElementById('new-key-token').value = k.key;
                    document.getElementById('new-key-label').value = k.label;
                    document.getElementById('new-key-date').value = k.renewDate || '';
                    document.getElementById('add-key-btn').textContent = 'Update Key';
                    document.getElementById('new-key-token').focus();
                });
            });

            document.querySelectorAll('.btn-delete-key').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (confirm('Delete this API key?')) {
                        const idx = parseInt(e.target.dataset.idx);
                        if (editingIndex === idx) resetKeyForm();
                        const keys = await StorageWrapper.getApiKeys();
                        keys.splice(idx, 1);
                        await StorageWrapper.saveApiKeys(keys);
                        renderKeys(false);
                    }
                });
            });

            // Manual Reset (forces active regardless of balance)
            document.querySelectorAll('.btn-reset-key').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const idx = parseInt(e.target.dataset.idx);
                    const keys = await StorageWrapper.getApiKeys();
                    keys[idx].status = 'active';
                    await StorageWrapper.saveApiKeys(keys);
                    renderKeys(false);
                });
            });
        };


    }

    // Call renderKeys initially? No, only when opening modal.

});
