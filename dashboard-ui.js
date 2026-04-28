/**
 * dashboard-ui.js
 * Handles UI rendering and DOM manipulation for the dashboard.
 */

window.DashboardUI = (() => {
    
    function populateFilterOptions() {
        const jobs = [...new Set(DashboardState.allProfiles.map(p => p.title).filter(Boolean))].sort();
        const companies = [...new Set(DashboardState.allProfiles.map(p => p.company).filter(Boolean))].sort();
        const locations = [...new Set(DashboardState.allProfiles.map(p => p.location).filter(Boolean))].sort();
        const industries = [...new Set(DashboardState.allProfiles.map(p => p.industry).filter(Boolean))].sort();

        populateSelect('filter-job', jobs);
        populateSelect('filter-company', companies);
        populateSelect('filter-location', locations);
        populateSelect('filter-industry', industries);
    }

    function populateSelect(id, options) {
        const select = document.getElementById(id);
        if (!select) return;
        const currentVal = select.value;
        // Keep first option
        select.innerHTML = select.firstElementChild ? select.firstElementChild.outerHTML : '<option value="">All</option>';
        // Fix 5: Build all <option> nodes into a DocumentFragment, then flush
        // once — avoids N individual reflows when the list is large.
        const fragment = document.createDocumentFragment();
        options.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt;
            el.textContent = opt;
            fragment.appendChild(el);
        });
        select.appendChild(fragment);
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
            // Fix 4: Collect all rows into a DocumentFragment, then flush to the
            // DOM in a single operation. Reduces up to 50 individual reflows to 1.
            const fragment = document.createDocumentFragment();

            pageItems.forEach(p => {
                const tr = document.createElement('tr');

                // Email Column Logic
                let emailHtml = '';
                const validEmails = p.results ? p.results.filter(r => r.result === 'ok') : [];

                if (validEmails.length > 0) {
                    validEmails.forEach(r => {
                        emailHtml += `<div class="email-row" title="Verified Valid">
                            <span style="font-size:12px; color: #10b981;">✅ ${r.email}</span>
                            <button class="btn-copy" onclick="DashboardUI.copyToClipboard('${r.email}')">📋</button>
                        </div>`;
                    });
                } else if (p.status === 'verified') {
                    emailHtml = `<span class="status-badge status-failed" title="Verification completed but no valid email found">No Valid Email</span>`;
                } else if (p.results && p.results.length > 0) {
                    emailHtml = `<span class="status-badge status-failed">No Valid Email</span>`;
                } else {
                    emailHtml = `<span class="status-badge status-${p.status}">${p.status}</span>`;
                }

                // Old emails
                const oldVerified = Array.isArray(p.old_results)
                    ? p.old_results.filter(r => r.result === 'ok')
                    : [];
                if (oldVerified.length > 0) {
                    emailHtml += `<div style="margin-top:4px; border-top:1px dashed #d1d5db; padding-top:3px;">`;
                    oldVerified.forEach(r => {
                        emailHtml += `<div class="email-row" title="Past job email (archived)">
                            <span style="font-size:11px; color:#9ca3af;">📂 ${r.email}</span>
                            <button class="btn-copy" onclick="DashboardUI.copyToClipboard('${r.email}')">📋</button>
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
                        <div style="display:flex; gap:4px;">
                            <button class="btn btn-secondary" style="padding:4px 8px;" onclick="DashboardUI.copyRowToClipboard('${p.id}')" title="Copy row to clipboard">📋</button>
                            <button class="btn btn-secondary" style="padding:4px 8px;" onclick="DashboardAPI.deleteProfile('${p.id}')" title="Delete lead">🗑️</button>
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
        const p = DashboardState.allProfiles.find(x => x.id === id);
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
