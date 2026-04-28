/**
 * dashboard-settings.js
 * Handles API key management and Turso cloud configuration.
 */

window.DashboardSettings = (() => {
    let editingIndex = -1;

    function init() {
        const modal = document.getElementById('settings-modal');
        document.getElementById('settings-btn').addEventListener('click', () => {
            resetKeyForm();
            renderKeys(false);
            loadTursoSettings();
            modal.classList.remove('hidden');
        });
        document.getElementById('close-settings-modal').addEventListener('click', () => modal.classList.add('hidden'));

        document.getElementById('verify-key-btn').addEventListener('click', verifyKey);
        document.getElementById('refresh-all-balances-btn').addEventListener('click', () => renderKeys(true));
        document.getElementById('add-key-btn').addEventListener('click', addOrUpdateKey);
        document.getElementById('save-turso-btn').addEventListener('click', saveTursoSettings);
    }

    function resetKeyForm() {
        editingIndex = -1;
        document.getElementById('new-key-token').value = '';
        document.getElementById('new-key-label').value = '';
        document.getElementById('new-key-date').value = '';
        document.getElementById('add-key-btn').textContent = '+ Add Key';
        const preview = document.getElementById('key-verify-preview');
        if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
    }

    async function fetchApifyLimits(token) {
        const res = await fetch(`https://api.apify.com/v2/users/me/limits?token=${encodeURIComponent(token)}`);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || `HTTP ${res.status}`);
        }
        const json = await res.json();
        return json.data;
    }

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
        const used = current.monthlyUsageUsd;
        const max = limits.maxMonthlyUsageUsd;
        const remaining = Math.max(0, max - used);
        const pct = max > 0 ? Math.min(100, (used / max) * 100).toFixed(0) : 0;
        const endDate = monthlyUsageCycle?.endAt ? new Date(monthlyUsageCycle.endAt).toISOString().split('T')[0] : null;
        const startDate = monthlyUsageCycle?.startAt ? new Date(monthlyUsageCycle.startAt).toLocaleDateString() : '?';

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
        if (endDate) document.getElementById('new-key-date').value = endDate;
    }

    async function verifyKey() {
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
    }

    async function addOrUpdateKey() {
        const tokenInp = document.getElementById('new-key-token');
        const labelInp = document.getElementById('new-key-label');
        const dateInp = document.getElementById('new-key-date');
        const addBtn = document.getElementById('add-key-btn');

        const token = tokenInp.value.trim();
        const label = labelInp.value.trim() || 'My Key';
        if (!token) { alert('Please enter an API Token'); return; }

        addBtn.textContent = '⏳ Verifying…';
        addBtn.disabled = true;
        let renewDate = dateInp.value;

        try {
            const data = await fetchApifyLimits(token);
            showVerifyPreview(data, true);
            if (!dateInp.value && data.monthlyUsageCycle?.endAt) {
                renewDate = new Date(data.monthlyUsageCycle.endAt).toISOString().split('T')[0];
                dateInp.value = renewDate;
            }
            const planLimit = data.limits?.maxMonthlyUsageUsd ?? 5.00;
            const used = data.current?.monthlyUsageUsd ?? 0;

            const keys = await StorageWrapper.getApiKeys();
            if (editingIndex > -1) {
                keys[editingIndex] = { ...keys[editingIndex], key: token, label, renewDate, balance: Math.max(0, planLimit - used) };
                await StorageWrapper.saveApiKeys(keys);
                alert('Key updated successfully!');
            } else {
                keys.push({ key: token, label, renewDate, addedAt: new Date().toISOString(), balance: Math.max(0, planLimit - used), status: 'active' });
                await StorageWrapper.saveApiKeys(keys);
                alert('Key added! ✅');
            }
        } catch {
            if (!confirm('⚠️ Could not verify this token with Apify. Save anyway?')) {
                addBtn.textContent = editingIndex > -1 ? 'Update Key' : '+ Add Key';
                addBtn.disabled = false;
                return;
            }
            const keys = await StorageWrapper.getApiKeys();
            if (editingIndex > -1) {
                keys[editingIndex] = { ...keys[editingIndex], key: token, label, renewDate: dateInp.value };
                await StorageWrapper.saveApiKeys(keys);
            } else {
                keys.push({ key: token, label, renewDate: dateInp.value, addedAt: new Date().toISOString(), balance: 5.00, status: 'active' });
                await StorageWrapper.saveApiKeys(keys);
            }
        }
        addBtn.textContent = editingIndex > -1 ? 'Update Key' : '+ Add Key';
        addBtn.disabled = false;
        resetKeyForm();
        renderKeys(false);
    }

    async function renderKeys(fetchLive = false) {
        const list = document.getElementById('keys-list');
        if (!list) return;
        let keys = await StorageWrapper.getApiKeys();
        if (keys.length === 0) {
            list.innerHTML = '<div style="color:#888; text-align:center; padding:10px;">No keys found. Add one above.</div>';
            return;
        }

        if (fetchLive) {
            const refreshBtn = document.getElementById('refresh-all-balances-btn');
            if (refreshBtn) { refreshBtn.textContent = '⏳ Refreshing…'; refreshBtn.disabled = true; }
            const balanceResults = await Promise.allSettled(keys.map(k => fetchApifyLimits(k.key)));
            balanceResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    const data = result.value;
                    const used = data.current.monthlyUsageUsd;
                    const max = data.limits.maxMonthlyUsageUsd;
                    const remaining = Math.max(0, max - used);
                    keys[index] = { ...keys[index], balance: remaining, balanceUsed: used, balanceMax: max, lastRefreshed: new Date().toISOString(), status: remaining > 0.5 ? 'active' : 'exhausted' };
                }
            });
            await StorageWrapper.saveApiKeys(keys);
            if (refreshBtn) { refreshBtn.textContent = '🔄 Refresh All'; refreshBtn.disabled = false; }
        }

        list.innerHTML = '';
        keys.forEach((k, index) => {
            const masked = k.key.length > 8 ? k.key.substring(0, 4) + '...' + k.key.substring(k.key.length - 4) : '****';
            const statusColor = k.status === 'active' ? '#10b981' : '#ef4444';
            const div = document.createElement('div');
            div.className = 'key-item';
            div.style.cssText = 'background:#f9fafb; border:1px solid #e5e7eb; padding:10px 12px; margin-bottom:8px; border-radius:8px;';
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:600; font-size:14px; margin-bottom:3px;">
                            ${k.label}
                            <span style="font-size:11px; padding:2px 6px; border-radius:4px; background:${statusColor}20; color:${statusColor}; margin-left:4px;">${(k.status || 'ACTIVE').toUpperCase()}</span>
                        </div>
                        <div style="font-size:12px; color:#6b7280;">Token: ${masked} &nbsp;•&nbsp; ${k.renewDate || 'No renew date'}</div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-edit-key" data-idx="${index}">✏️</button>
                        <button class="btn-delete-key" data-idx="${index}">🗑️</button>
                    </div>
                </div>
            `;
            list.appendChild(div);
        });

        document.querySelectorAll('.btn-edit-key').forEach(btn => {
            btn.onclick = (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx);
                editingIndex = idx;
                const k = keys[idx];
                document.getElementById('new-key-token').value = k.key;
                document.getElementById('new-key-label').value = k.label;
                document.getElementById('new-key-date').value = k.renewDate || '';
                document.getElementById('add-key-btn').textContent = 'Update Key';
            };
        });

        document.querySelectorAll('.btn-delete-key').forEach(btn => {
            btn.onclick = async (e) => {
                if (confirm('Delete this key?')) {
                    const idx = parseInt(e.currentTarget.dataset.idx);
                    keys.splice(idx, 1);
                    await StorageWrapper.saveApiKeys(keys);
                    renderKeys(false);
                }
            };
        });
    }

    async function loadTursoSettings() {
        const config = await StorageWrapper.getTursoConfig();
        document.getElementById('turso-db-url').value = config.dbUrl || '';
        document.getElementById('turso-auth-token').value = config.authToken || '';
    }

    async function saveTursoSettings() {
        const dbUrl = document.getElementById('turso-db-url').value.trim();
        const authToken = document.getElementById('turso-auth-token').value.trim();
        const btn = document.getElementById('save-turso-btn');
        btn.textContent = '⏳ Saving…';
        btn.disabled = true;
        try {
            await StorageWrapper.saveTursoConfig({ dbUrl, authToken });
            alert('Cloud settings saved! ✅');
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            btn.textContent = 'Save Cloud Settings';
            btn.disabled = false;
        }
    }

    return { init, renderKeys, loadTursoSettings };
})();
