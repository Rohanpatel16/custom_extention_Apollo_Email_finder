// Import IndexedDB wrapper so profile operations run on the extension origin.
// Content scripts write to app.apollo.io's IndexedDB (wrong origin for dashboard),
// so we proxy all profile CRUD through this service worker instead.
importScripts('indexed-db.js');

chrome.action.onClicked.addListener((tab) => {
    if (tab.id) {
        if (tab.url && tab.url.includes("app.apollo.io")) {
            chrome.tabs.sendMessage(tab.id, { action: "toggle_sidebar" });
        } else {
            chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
        }
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "open_dashboard") {
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
        return;
    }

    // ─── Profile CRUD (proxied for content scripts) ────────────────────
    // Content scripts run on app.apollo.io origin, so their IndexedDB is
    // separate from the extension's. We proxy all profile operations here
    // so everything writes to/reads from the extension-origin IndexedDB.

    if (request.action === "SAVE_PROFILES") {
        handleSaveProfiles(request.profiles)
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (request.action === "GET_ALL_PROFILES") {
        handleGetAllProfiles()
            .then(profiles => sendResponse({ success: true, profiles }))
            .catch(err => sendResponse({ success: false, profiles: [], error: err.message }));
        return true;
    }

    if (request.action === "GET_CACHED_PROFILE") {
        handleGetCachedProfile(request.query)
            .then(profile => sendResponse({ success: true, profile }))
            .catch(err => sendResponse({ success: false, profile: null, error: err.message }));
        return true;
    }

    if (request.action === "OVERWRITE_PROFILES") {
        handleOverwriteProfiles(request.profiles)
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (request.action === "CLEAR_PROFILES") {
        handleClearProfiles()
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (request.action === "COUNT_PROFILES") {
        handleCountProfiles()
            .then(count => sendResponse({ success: true, count }))
            .catch(err => sendResponse({ success: false, count: 0, error: err.message }));
        return true;
    }

    if (request.action === "CALL_APIFY") {
        handleCallApify(request.emails, request.apiKey)
            .then(results => sendResponse({ success: true, data: results }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    if (request.action === "GET_APIFY_LIMITS") {
        handleGetApifyLimits(request.apiKey)
            .then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep channel open for async response
    }
});

async function handleCallApify(emails, apiKey) {
    const actorId = "VJ5w50TP6mAbyimyO";

    // 1. Start Run
    const startRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: emails })
    });

    if (!startRes.ok) {
        const errorData = await startRes.json().catch(() => ({}));
        const status = startRes.status;
        throw new Error(JSON.stringify({ status, message: errorData.message || startRes.statusText }));
    }

    const startData = await startRes.json();
    const runId = startData.data.id;
    const datasetId = startData.data.defaultDatasetId;

    // 2. Poll Result — Bug 6: add MAX_POLLS to prevent infinite loop if Apify run hangs
    const MAX_POLLS = 150; // 150 × 2 s = 5 minutes maximum wait time
    let polls = 0;
    while (true) {
        await new Promise(r => setTimeout(r, 2000));

        if (++polls > MAX_POLLS) {
            throw new Error(`Apify run ${runId} timed out after 5 minutes — check Apify dashboard`);
        }

        const pollRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${apiKey}`);
        if (!pollRes.ok) throw new Error("Failed to poll run status");

        const pollData = await pollRes.json();
        const status = pollData.data.status;

        if (status === 'SUCCEEDED') break;
        if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
            throw new Error(`Run ${status}`);
        }
    }

    // 3. Fetch Items
    const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}`);
    if (!itemsRes.ok) throw new Error("Failed to fetch results from dataset");

    return await itemsRes.json();
}

async function handleGetApifyLimits(apiKey) {
    const res = await fetch(`https://api.apify.com/v2/users/me/limits?token=${apiKey}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify({
            status: res.status,
            message: err.error?.message || res.statusText
        }));
    }
    return res.json();
}

// ─── Profile CRUD handlers (extension-origin IndexedDB) ──────────────────

/**
 * Save/merge profiles into IndexedDB.
 * Replicates the merge logic from storage.js so existing data is preserved.
 */
async function handleSaveProfiles(newProfiles) {
    if (!newProfiles || newProfiles.length === 0) return;
    await ProfileDB.open();

    // Build a map of existing profiles that need merging
    const existingMap = new Map();
    for (const p of newProfiles) {
        if (!p.id) continue;
        const existing = await ProfileDB.getById(p.id);
        if (existing) {
            existingMap.set(p.id, existing);
        }
    }

    // Merge logic (same as storage.js saveAllProfiles)
    const toWrite = newProfiles.map(p => {
        if (!p.id) return p;
        const existing = existingMap.get(p.id);
        let merged = existing ? { ...existing, ...p } : p;

        // Auto-clear jobChanged once a valid email is verified
        if (merged.jobChanged && merged.results && merged.results.some(r => r.result === 'ok')) {
            merged = { ...merged, jobChanged: false };
        }

        return merged;
    }).filter(p => p.id); // skip any without IDs

    await ProfileDB.upsertMany(toWrite);
    console.log(`[Background] Saved ${toWrite.length} profiles to extension-origin IndexedDB`);
}

/**
 * Get all profiles from IndexedDB.
 */
async function handleGetAllProfiles() {
    await ProfileDB.open();
    return ProfileDB.getAll();
}

/**
 * Find a profile by ID, LinkedIn URL, or Name+Domain.
 * Replicates the indexed lookup logic from storage.js getCachedProfile.
 */
async function handleGetCachedProfile(query) {
    if (!query) return null;
    await ProfileDB.open();

    if (query.id) {
        const byId = await ProfileDB.getById(query.id);
        if (byId) return byId;
    }
    if (query.linkedin_url) {
        const byLi = await ProfileDB.getByLinkedin(query.linkedin_url);
        if (byLi) return byLi;
    }
    if (query.name && query.domain) {
        const byND = await ProfileDB.getByNameDomain(query.name, query.domain);
        if (byND) return byND;
    }
    return null;
}

/**
 * Overwrite all profiles (used by dashboard deletions).
 */
async function handleOverwriteProfiles(profiles) {
    await ProfileDB.open();
    await ProfileDB.deleteAll();
    if (profiles && profiles.length > 0) {
        await ProfileDB.upsertMany(profiles);
    }
}

/**
 * Clear all profiles.
 */
async function handleClearProfiles() {
    await ProfileDB.open();
    await ProfileDB.deleteAll();
}

/**
 * Get profile count.
 */
async function handleCountProfiles() {
    await ProfileDB.open();
    return ProfileDB.count();
}

