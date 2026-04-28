/**
 * content-ui.js
 * Handles the content script's floating sidebar UI and toasts.
 */

window.ContentUI = (() => {
    const ICONS = {
        close: `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`,
        help: `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
        extract: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>`,
        verify: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
        download: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>`,
        spinner: `<svg class="av-spin" width="16" height="16" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`
    };

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
                <div id="av-help-section" class="av-card av-hidden" style="background:#EFF6FF; border-color:#BFDBFE;">
                    <h3 style="margin-top:0; font-size:14px; color:#1E40AF;">How to use</h3>
                    <ol style="padding-left:20px; margin-bottom:0; font-size:13px; color:#1E3A8A;">
                        <li>Enter your Apify API Token.</li>
                        <li>Click <b>Extract Profiles</b> to grab visible rows.</li>
                        <li>Select profiles and click <b>Verify</b>.</li>
                    </ol>
                </div>

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

                <div class="av-card">
                    <label class="av-label">Actions</label>
                    <button id="av-extract-btn" class="av-btn av-btn-primary">
                        ${ICONS.extract} Extract Profiles
                    </button>
                    <div style="display:flex; gap:5px; margin-top:8px;">
                        <button id="av-next-page-btn" class="av-btn av-btn-secondary" style="flex:1;">Next Page ➡️</button>
                        <button id="av-open-crm-btn" class="av-btn av-btn-secondary" style="flex:1;">📊 Open CRM</button>
                    </div>
                    <div style="margin-top:10px; padding:8px; background:#F0FDF4; border:1px solid #BBF7D0; border-radius:8px;">
                        <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:#166534; cursor:pointer;">
                            <input type="checkbox" id="av-autoscrape-toggle" class="av-checkbox">
                            🤖 Auto-Scrape Mode
                        </label>
                        <div style="margin-top:6px; padding-left:4px; display:flex; flex-direction:column; gap:4px; font-size:12px; color:#374151;">
                            <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                                <input type="radio" id="av-mode-batch" name="av-scrape-mode" value="batch" checked style="accent-color:#16a34a;">
                                <span><b>Batch</b> — 5 pages → verify → advance</span>
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

                <div id="av-results-area" class="av-hidden">
                    <div class="av-list-header">
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:500;">
                                <input type="checkbox" id="av-select-all" class="av-checkbox" checked> Select All
                            </label>
                            <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:#6B7280;">
                                <input type="checkbox" id="av-show-valid-only" class="av-checkbox"> Show valid emails only
                            </label>
                        </div>
                        <button id="av-clear-list-btn" class="av-close-btn" style="font-size:12px;">🗑️ Clear View</button>
                    </div>
                    <div id="av-profile-list" class="av-data-list"></div>
                    <div style="margin-top:16px; display:flex; flex-direction:column; gap:8px;">
                        <button id="av-verify-btn" class="av-btn av-btn-primary">${ICONS.verify} Verify Selected</button>
                        <button id="av-download-btn" class="av-btn av-btn-secondary">${ICONS.download} Download CSV</button>
                    </div>
                </div>
            </div>
            <div id="av-toast-container"></div>
        </div>
    `;

    function init() {
        if (document.getElementById('apollo-verifier-sidebar')) return;
        const div = document.createElement('div');
        div.innerHTML = sidebarHTML;
        document.body.appendChild(div.firstElementChild);
    }

    function showToast(message, type = 'neutral') {
        const container = document.getElementById('av-toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `av-toast ${type}`;
        let icon = type === 'success' ? '✅' : (type === 'error' ? '⚠️' : 'ℹ️');
        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function renderList(profiles, showValidOnly) {
        const list = document.getElementById('av-profile-list');
        if (!list) return;
        list.innerHTML = '';

        profiles.forEach((p, originalIdx) => {
            // Filter logic
            if (showValidOnly) {
                const hasValid = p.results && p.results.some(r => r.result === 'ok');
                if (p.status !== 'ready' && !hasValid) return;
            }

            const item = document.createElement('div');
            item.className = 'av-profile-item';
            
            const emailsHtml = (p.results || [])
                .filter(r => r.result === 'ok')
                .map(r => `<div style="font-size:11px; color:#10b981">✅ ${r.email}</div>`)
                .join('');

            item.innerHTML = `
                <div style="display:flex; gap:10px; align-items:flex-start;">
                    <input type="checkbox" class="av-checkbox profile-select" data-idx="${originalIdx}" ${p.selected ? 'checked' : ''}>
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:600; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
                        <div style="font-size:11px; color:#6B7280; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.title} @ ${p.company}</div>
                        <div class="av-item-status status-${p.status}">${p.status.toUpperCase()}</div>
                        <div style="margin-top:4px;">${emailsHtml}</div>
                    </div>
                </div>
            `;
            list.appendChild(item);
        });

        const resultsArea = document.getElementById('av-results-area');
        if (profiles.length > 0) resultsArea.classList.remove('av-hidden');
        else resultsArea.classList.add('av-hidden');
    }

    function setAutoScrapeStatus(text) {
        const el = document.getElementById('av-autoscrape-status');
        if (el) el.textContent = text;
    }

    return { init, showToast, renderList, setAutoScrapeStatus, ICONS };
})();
