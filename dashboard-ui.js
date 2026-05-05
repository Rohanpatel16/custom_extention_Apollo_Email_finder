/**
 * dashboard-ui.js
 * Handles UI rendering and DOM manipulation for the dashboard.
 *
 * Performance notes (15k+ leads):
 * - Filter dropdowns with >200 unique values switch to a text input + <datalist>
 *   autocomplete to avoid injecting thousands of <option> DOM nodes.
 * - All user data is HTML-escaped before insertion via innerHTML to prevent XSS.
 * - Profile lookups use the O(1) profileMap from DashboardState.
 */

window.DashboardUI = (() => {

    /** Max options before we switch a <select> to a datalist autocomplete */
    const DATALIST_THRESHOLD = 200;

    /**
     * Escape HTML to prevent XSS and layout breaks.
     * Used for every user-supplied value injected into innerHTML.
     */
    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Escape a string for safe use inside a JS string literal in an onclick attribute.
     * Prevents injection through profile data (emails, IDs).
     */
    function escapeJsAttr(str) {
        return String(str == null ? '' : str)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"');
    }

    function populateFilterOptions() {
        const sets = DashboardState.cachedFilterSets;
        if (!sets) {
            // Cache not built yet — compute from allProfiles directly (fallback)
            const jobs = [...new Set(DashboardState.allProfiles.map(p => p.title).filter(Boolean))].sort();
            const companies = [...new Set(DashboardState.allProfiles.map(p => p.company).filter(Boolean))].sort();
            const locations = [...new Set(DashboardState.allProfiles.map(p => p.location).filter(Boolean))].sort();
            const industries = [...new Set(DashboardState.allProfiles.map(p => p.industry).filter(Boolean))].sort();
            populateFilterControl('filter-job', jobs, 'All Job Titles');
            populateFilterControl('filter-company', companies, 'All Companies');
            populateFilterControl('filter-location', locations, 'All Locations');
            populateFilterControl('filter-industry', industries, 'All Industries');
            return;
        }

        populateFilterControl('filter-job', sets.jobs, 'All Job Titles');
        populateFilterControl('filter-company', sets.companies, 'All Companies');
        populateFilterControl('filter-location', sets.locations, 'All Locations');
        populateFilterControl('filter-industry', sets.industries, 'All Industries');
    }

    /**
     * Populate a filter control. If option count exceeds DATALIST_THRESHOLD,
     * replaces the <select> with an <input> + <datalist> autocomplete.
     */
    function populateFilterControl(id, options, placeholder) {
        const existing = document.getElementById(id);
        if (!existing) return;

        if (options.length <= DATALIST_THRESHOLD) {
            // Standard <select> path — fast enough for ≤200 options
            ensureSelect(id, placeholder);
            populateSelect(id, options);
        } else {
            // Too many options — switch to datalist autocomplete
            ensureDatalist(id, placeholder, options);
        }
    }

    /**
     * Ensure the element is a <select>. If it was converted to an <input> earlier,
     * swap it back.
     */
    function ensureSelect(id, placeholder) {
        const el = document.getElementById(id);
        if (el && el.tagName === 'SELECT') return; // already correct
        if (!el) return;

        // Swap input back to select
        const select = document.createElement('select');
        select.id = id;
        select.className = el.className;
        select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>`;
        el.parentNode.replaceChild(select, el);

        // Remove orphaned datalist if any
        const dl = document.getElementById(id + '-datalist');
        if (dl) dl.remove();

        // Re-attach event listener
        attachFilterListener(id);
    }

    /**
     * Convert a <select> to an <input> + <datalist> for autocomplete search.
     * Only called when option count > DATALIST_THRESHOLD.
     */
    function ensureDatalist(id, placeholder, options) {
        const el = document.getElementById(id);
        if (!el) return;

        const currentVal = el.value || '';
        const datalistId = id + '-datalist';

        // If already an input with datalist, just rebuild the datalist
        if (el.tagName === 'INPUT' && el.getAttribute('list') === datalistId) {
            rebuildDatalist(datalistId, options);
            el.value = currentVal;
            return;
        }

        // Create the input
        const input = document.createElement('input');
        input.type = 'text';
        input.id = id;
        input.className = el.className;
        input.placeholder = placeholder;
        input.setAttribute('list', datalistId);
        input.setAttribute('autocomplete', 'off');
        input.value = currentVal;

        // Create datalist
        const datalist = document.createElement('datalist');
        datalist.id = datalistId;
        rebuildDatalist(datalistId, options, datalist);

        // Replace the select with input + datalist
        el.parentNode.replaceChild(input, el);
        input.parentNode.insertBefore(datalist, input.nextSibling);

        // Re-attach filter listener for the new input
        attachFilterListener(id);
    }

    /**
     * Rebuild a <datalist>'s <option> elements.
     * Uses a DocumentFragment to minimize reflows.
     */
    function rebuildDatalist(datalistId, options, datalistEl) {
        const dl = datalistEl || document.getElementById(datalistId);
        if (!dl) return;

        const fragment = document.createDocumentFragment();
        for (let i = 0; i < options.length; i++) {
            const opt = document.createElement('option');
            opt.value = options[i];
            fragment.appendChild(opt);
        }
        dl.innerHTML = '';
        dl.appendChild(fragment);
    }

    /**
     * Re-attach the filter change/input listener after swapping elements.
     */
    function attachFilterListener(id) {
        const el = document.getElementById(id);
        if (!el) return;

        const fieldMap = {
            'filter-job': 'filterJob',
            'filter-company': 'filterCompany',
            'filter-location': 'filterLocation',
            'filter-industry': 'filterIndustry'
        };
        const stateKey = fieldMap[id];
        if (!stateKey) return;

        const eventType = el.tagName === 'SELECT' ? 'change' : 'input';

        let debounce;
        el.addEventListener(eventType, (e) => {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                DashboardState[stateKey] = e.target.value;
                DashboardState.currentPage = 1;
                DashboardState.applyFilters();
                DashboardUI.render();
            }, el.tagName === 'SELECT' ? 0 : 300);
        });
    }

    function populateSelect(id, options) {
        const select = document.getElementById(id);
        if (!select || select.tagName !== 'SELECT') return;
        const currentVal = select.value;
        
        // Keep first option
        const firstOpt = select.firstElementChild ? select.firstElementChild.outerHTML : '<option value="">All</option>';
        
        // String based creation is >10x faster than createElement in loops
        const optionsHtml = options.map(opt => 
            `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`
        ).join('');
        
        select.innerHTML = firstOpt + optionsHtml;
        select.value = currentVal;
    }

    function render() {
        const tbody = document.getElementById('table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        const { currentPage, itemsPerPage, filteredProfiles } = DashboardState;
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageItems = filteredProfiles.slice(start, end);

        if (pageItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:20px;">No records found</td></tr>';
        } else {
            // Collect all rows into a DocumentFragment, then flush to the
            // DOM in a single operation. Reduces up to 50 individual reflows to 1.
            const fragment = document.createDocumentFragment();

            pageItems.forEach(p => {
                const tr = document.createElement('tr');

                // Email Column Logic
                let emailHtml = '';
                const validEmails = p.results ? p.results.filter(r => r.result === 'ok') : [];

                if (validEmails.length > 0) {
                    validEmails.forEach(r => {
                        const safeEmail = escapeHtml(r.email);
                        const jsEmail = escapeJsAttr(r.email);
                        emailHtml += `<div class="email-row" title="Verified Valid">
                            <span style="font-size:12px; color: #10b981;">✅ ${safeEmail}</span>
                            <button class="btn-copy" onclick="DashboardUI.copyToClipboard('${jsEmail}')">📋</button>
                        </div>`;
                    });
                } else if (p.status === 'verified') {
                    emailHtml = `<span class="status-badge status-failed" title="Verification completed but no valid email found">No Valid Email</span>`;
                } else if (p.results && p.results.length > 0) {
                    emailHtml = `<span class="status-badge status-failed">No Valid Email</span>`;
                } else {
                    emailHtml = `<span class="status-badge status-${escapeHtml(p.status)}">${escapeHtml(p.status)}</span>`;
                }

                // Old emails
                const oldVerified = Array.isArray(p.old_results)
                    ? p.old_results.filter(r => r.result === 'ok')
                    : [];
                if (oldVerified.length > 0) {
                    emailHtml += `<div style="margin-top:4px; border-top:1px dashed #d1d5db; padding-top:3px;">`;
                    oldVerified.forEach(r => {
                        const safeEmail = escapeHtml(r.email);
                        const jsEmail = escapeJsAttr(r.email);
                        emailHtml += `<div class="email-row" title="Past job email (archived)">
                            <span style="font-size:11px; color:#9ca3af;">📂 ${safeEmail}</span>
                            <button class="btn-copy" onclick="DashboardUI.copyToClipboard('${jsEmail}')">📋</button>
                        </div>`;
                    });
                    emailHtml += `</div>`;
                }

                // Socials — escape URLs to prevent XSS
                let socialsHtml = '';
                if (p.linkedin) socialsHtml += `<a href="${escapeHtml(p.linkedin)}" target="_blank" title="Person LinkedIn">IN</a> `;
                if (p.website) socialsHtml += `<a href="${escapeHtml(p.website)}" target="_blank" title="Company Website">🌐</a>`;
                if (p.companyLinkedin) socialsHtml += `<a href="${escapeHtml(p.companyLinkedin)}" target="_blank" title="Company LinkedIn">🏢</a>`;

                // Job-change badge
                const jobChangeBadge = p.jobChanged
                    ? `<span title="Job changed — re-verify email" style="font-size:10px; background:#fef3c7; color:#92400e; padding:1px 5px; border-radius:4px; margin-left:4px;">🔄 Job Changed</span>`
                    : '';

                const safeName = escapeHtml(p.name);
                const safeTitle = escapeHtml(p.title || '-');
                const safeCompany = escapeHtml(p.company || '-');
                const safeDomain = escapeHtml(p.domain || '');
                const safeEmployees = escapeHtml(p.employees || '-');
                const safeIndustry = escapeHtml(p.industry || '-');
                const safeLocation = escapeHtml(p.location || '-');
                const safeSecondary = escapeHtml((p.secondaryIndustries || []).join(', ') || '-');
                const safeKeywords = escapeHtml((p.companyKeywords || []).slice(0, 5).join(', ') || '-');
                const jsId = escapeJsAttr(p.id);

                tr.innerHTML = `
                    <td><input type="checkbox" class="row-checkbox" value="${escapeHtml(p.id)}"></td>
                    <td>
                        <div style="font-weight:500;">${safeName}</div>
                        <div class="cell-title">${safeTitle}</div>
                    </td>
                    <td>
                        <div>${safeCompany}${jobChangeBadge}</div>
                        <div class="cell-meta">${safeDomain}</div>
                    </td>
                    <td><div style="font-size:13px;">${safeEmployees}</div></td>
                    <td><div style="font-size:13px; color:#6b7280;">${safeIndustry}</div></td>
                    <td><div style="font-size:12px; color:#6b7280;">${safeSecondary}</div></td>
                    <td><div style="font-size:12px; color:#94a3b8;">${safeKeywords}</div></td>
                    <td>${safeLocation}</td>
                    <td>${emailHtml}</td>
                    <td>${socialsHtml}</td>
                    <td>
                        <div style="display:flex; gap:4px;">
                            <button class="btn btn-secondary" style="padding:4px 8px;" onclick="DashboardUI.copyRowToClipboard('${jsId}')" title="Copy row to clipboard">📋</button>
                            <button class="btn btn-secondary" style="padding:4px 8px;" onclick="DashboardAPI.deleteProfile('${jsId}')" title="Delete lead">🗑️</button>
                        </div>
                    </td>
                `;
                fragment.appendChild(tr);
            });

            tbody.appendChild(fragment);
        }

        // Pagination Info
        const pagInfo = document.getElementById('pagination-info');
        if (pagInfo) {
            pagInfo.textContent = `Showing ${filteredProfiles.length > 0 ? start + 1 : 0}-${Math.min(end, filteredProfiles.length)} of ${filteredProfiles.length}`;
        }
        
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        if (prevBtn) prevBtn.disabled = currentPage === 1;
        if (nextBtn) nextBtn.disabled = end >= filteredProfiles.length;
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            console.log('Copied to clipboard:', text);
        });
    }

    function copyRowToClipboard(id) {
        // O(1) lookup via profileMap instead of O(n) find()
        const p = DashboardState.profileMap.get(id);
        if (!p) return;
        const validEmails = (p.results || []).filter(r => r.result === 'ok').map(r => r.email).join('; ');
        const text = [
            p.name, p.title, p.company, p.domain,
            p.industry, p.employees, p.location,
            p.linkedin, p.companyLinkedin, validEmails
        ].join('\t');
        copyToClipboard(text);
        alert('Lead info copied to clipboard (Tab-separated)');
    }

    return {
        render,
        populateFilterOptions,
        copyToClipboard,
        copyRowToClipboard
    };
})();
