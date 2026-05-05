/**
 * storage.js
 * Wrapper for CRM data (profiles via IndexedDB) and settings (chrome.storage.local).
 *
 * Profile data is stored in IndexedDB via ProfileDB for performance at scale.
 * Settings, API keys, sidebar session, and Turso config remain in chrome.storage.local
 * because they are small and benefit from the simple key-value model.
 *
 * On first access, any legacy profile data sitting in chrome.storage.local
 * ("av_profiles") is transparently migrated into IndexedDB and the old key is removed.
 */

// ─── Context detection ──────────────────────────────────────────────────
// Content scripts run on app.apollo.io, extension pages on chrome-extension://.
// IndexedDB is origin-scoped, so content scripts must proxy profile operations
// through the background service worker (which shares the extension origin).
const _isExtensionPage = (typeof chrome !== 'undefined' && chrome.runtime?.getURL
    && location.href.startsWith(chrome.runtime.getURL('')));

/**
 * Helper: send a message to the background and return the response.
 * @param {Object} msg
 * @returns {Promise<Object>}
 */
function _bgMessage(msg) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(msg, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(response || {});
            }
        });
    });
}

const Storage = {
    // Keys — only non-profile data stays in chrome.storage.local
    KEYS: {
        PROFILES: 'av_profiles',         // Legacy — checked for migration only
        SESSION: 'av_sidebar_session',   // Current Sidebar View
        SETTINGS: 'av_settings',
        API_TOKEN: 'apifyApiToken',      // Legacy Single Token
        API_KEYS: 'apifyApiKeys',        // New Multi-Key Array
        BALANCE: 'av_balance',
        TURSO_CONFIG: 'av_turso_config', // Turso Cloud credentials
        IDB_MIGRATED: 'av_idb_migrated'  // Flag: migration complete
    },

    /** @type {boolean} tracks whether migration has been checked this session */
    _migrationChecked: false,

    // ─── Migration: chrome.storage → IndexedDB (one-time) ─────────────────

    /**
     * Checks for legacy av_profiles in chrome.storage.local and migrates
     * them into IndexedDB. Idempotent — safe to call multiple times.
     * @returns {Promise<void>}
     */
    async _ensureMigrated() {
        if (this._migrationChecked) return;

        // Quick check: has migration already completed?
        const flags = await new Promise(resolve =>
            chrome.storage.local.get([this.KEYS.IDB_MIGRATED], resolve)
        );
        if (flags[this.KEYS.IDB_MIGRATED]) {
            this._migrationChecked = true;
            return;
        }

        // Check for legacy data
        const legacy = await new Promise(resolve =>
            chrome.storage.local.get([this.KEYS.PROFILES], resolve)
        );
        const legacyProfiles = legacy[this.KEYS.PROFILES];

        if (Array.isArray(legacyProfiles) && legacyProfiles.length > 0) {
            console.log(`[Storage] Migrating ${legacyProfiles.length} profiles from chrome.storage → IndexedDB…`);
            try {
                await ProfileDB.open();
                await ProfileDB.upsertMany(legacyProfiles);
                // Remove legacy key + set migrated flag
                await new Promise(resolve =>
                    chrome.storage.local.remove(this.KEYS.PROFILES, resolve)
                );
                await new Promise(resolve =>
                    chrome.storage.local.set({ [this.KEYS.IDB_MIGRATED]: true }, resolve)
                );
                console.log(`[Storage] Migration complete — ${legacyProfiles.length} profiles moved to IndexedDB.`);
            } catch (err) {
                console.error('[Storage] Migration failed — will retry next time:', err);
                // Don't set the flag so it retries on next load
                this._migrationChecked = true;
                return;
            }
        } else {
            // No legacy data — mark as migrated so we don't check again
            await new Promise(resolve =>
                chrome.storage.local.set({ [this.KEYS.IDB_MIGRATED]: true }, resolve)
            );
        }

        this._migrationChecked = true;
    },

    // ─── Profile Operations (IndexedDB) ───────────────────────────────────

    /**
     * Get Turso Cloud Configuration
     * @returns {Promise<Object>} { dbUrl, authToken }
     */
    async getTursoConfig() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.KEYS.TURSO_CONFIG], (result) => {
                resolve(result[this.KEYS.TURSO_CONFIG] || { dbUrl: '', authToken: '' });
            });
        });
    },

    /**
     * Save Turso Cloud Configuration
     * @param {Object} config { dbUrl, authToken }
     */
    async saveTursoConfig(config) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.KEYS.TURSO_CONFIG]: config }, resolve);
        });
    },

    /**
     * Get all profiles from Global CRM (IndexedDB)
     * @returns {Promise<Array>}
     */
    async getAllProfiles() {
        if (!_isExtensionPage) {
            // Content script → ask background (extension-origin IndexedDB)
            const resp = await _bgMessage({ action: 'GET_ALL_PROFILES' });
            return resp.profiles || [];
        }
        // Extension page (dashboard) → direct IndexedDB access
        await this._ensureMigrated();
        await ProfileDB.open();
        return ProfileDB.getAll();
    },

    /**
     * Find a profile in the CRM by ID, LinkedIn URL, or Name+Domain
     * Uses indexed lookups — O(1) instead of O(n) array scan.
     * @param {Object} query { id, linkedin_url, name, domain }
     * @returns {Promise<Object|null>}
     */
    async getCachedProfile(query) {
        if (!_isExtensionPage) {
            // Content script → ask background
            const resp = await _bgMessage({ action: 'GET_CACHED_PROFILE', query });
            return resp.profile || null;
        }
        // Extension page → direct IndexedDB
        await this._ensureMigrated();
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
    },

    /**
     * Save profiles to Global CRM (merge/overwrite by ID)
     * Preserves the existing merge logic: read existing, merge, write back.
     * @param {Array} newProfiles 
     * @returns {Promise<void>}
     */
    async saveAllProfiles(newProfiles) {
        if (!_isExtensionPage) {
            // Content script → proxy merge+save through background
            await _bgMessage({ action: 'SAVE_PROFILES', profiles: newProfiles });

            // 🔵 Turso cloud sync (fire-and-forget) — turso.js is loaded in content scripts
            if (typeof TursoSync !== 'undefined') {
                const validIds = newProfiles.filter(p => p.id);
                TursoSync.upsertProfiles(validIds).catch(err =>
                    console.warn('[TursoSync] upsert failed:', err)
                );
            }
            return;
        }

        // Extension page (dashboard) → direct IndexedDB access
        await this._ensureMigrated();
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

        // Merge logic (same as original)
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

        // 🔵 Turso cloud sync (fire-and-forget)
        if (typeof TursoSync !== 'undefined') {
            TursoSync.upsertProfiles(toWrite).catch(err =>
                console.warn('[TursoSync] upsert failed:', err)
            );
        }
    },

    /**
     * Overwrite Global CRM with exact list (For Dashboard deletions)
     * @param {Array} profiles 
     */
    async overwriteGlobalProfiles(profiles) {
        if (!_isExtensionPage) {
            // Content script → proxy through background
            await _bgMessage({ action: 'OVERWRITE_PROFILES', profiles });

            if (typeof TursoSync !== 'undefined') {
                TursoSync.deleteAllProfiles()
                    .then(() => profiles.length > 0 ? TursoSync.upsertProfiles(profiles) : null)
                    .catch(err => console.error('[TursoSync] overwrite sync failed:', err));
            }
            return;
        }

        // Extension page → direct IndexedDB
        await this._ensureMigrated();
        await ProfileDB.open();

        await ProfileDB.deleteAll();
        if (profiles.length > 0) {
            await ProfileDB.upsertMany(profiles);
        }

        // 🔵 Turso cloud sync: wipe + re-insert remaining (handles deletions)
        if (typeof TursoSync !== 'undefined') {
            TursoSync.deleteAllProfiles()
                .then(() => {
                    if (profiles.length > 0) {
                        return TursoSync.upsertProfiles(profiles);
                    }
                    console.log('[TursoSync] All profiles cleared — cloud is now empty.');
                })
                .catch(err => {
                    console.error('[TursoSync] overwrite sync failed — cloud may be out of sync:', err);
                });
        }
    },

    /**
     * Get current Sidebar Session profiles
     * @returns {Promise<Array>}
     */
    async getSidebarSession() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.KEYS.SESSION], (result) => {
                resolve(result[this.KEYS.SESSION] || []);
            });
        });
    },

    /**
     * Save Sidebar Session (Replaces current view)
     * @param {Array} profiles 
     */
    async saveSidebarSession(profiles) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.KEYS.SESSION]: profiles }, resolve);
        });
    },

    /**
     * Clear Sidebar Session Only
     */
    async clearSidebarSession() {
        return new Promise((resolve) => {
            chrome.storage.local.remove(this.KEYS.SESSION, resolve);
        });
    },

    /**
     * Clear Global CRM (Dangerous)
     */
    async clearAllProfiles() {
        if (!_isExtensionPage) {
            // Content script → proxy through background
            await _bgMessage({ action: 'CLEAR_PROFILES' });
            console.log('[Storage] Local profiles cleared via background. Cloud data preserved.');
            return;
        }

        // Extension page → direct IndexedDB
        await this._ensureMigrated();
        await ProfileDB.open();
        await ProfileDB.deleteAll();

        // 🔵 Turso cloud sync: WE NO LONGER DELETE FROM CLOUD
        // User wants to keep cloud data as a permanent record.
        console.log('[Storage] Local profiles cleared. Cloud data preserved.');
    },

    /**
     * Pull ALL profiles from Turso cloud into local storage (IndexedDB).
     * Used by the "Sync from Cloud" button in the dashboard.
     * @returns {Promise<Array>} the profiles pulled
     */
    async pullFromTurso() {
        if (typeof TursoSync === 'undefined') {
            console.warn('[TursoSync] TursoSync not available');
            return [];
        }
        await this._ensureMigrated();
        await ProfileDB.open();

        const profiles = await TursoSync.getAllProfiles();
        if (profiles.length > 0) {
            await ProfileDB.deleteAll();
            await ProfileDB.upsertMany(profiles);
        }
        return profiles;
    },

    /**
     * Push ALL local profiles up to Turso cloud.
     * Used when Turso is empty but local data exists (first-time backup).
     * @returns {Promise<number>} number of profiles pushed
     */
    async pushToTurso() {
        if (typeof TursoSync === 'undefined') {
            console.warn('[TursoSync] TursoSync not available');
            return 0;
        }
        const profiles = await this.getAllProfiles();
        if (profiles.length > 0) {
            await TursoSync.upsertProfiles(profiles);
        }
        return profiles.length;
    },

    /**
     * Get API Keys (Migrates old token if exists)
     * @returns {Promise<Array>} [{ key, label, addedAt, renewDate, status }]
     */
    async getApiKeys() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.KEYS.API_KEYS, this.KEYS.API_TOKEN], (result) => {
                let keys = result[this.KEYS.API_KEYS] || [];

                // Migration: If no keys but old token exists
                if (keys.length === 0 && result[this.KEYS.API_TOKEN]) {
                    const oldToken = result[this.KEYS.API_TOKEN];
                    const newKey = {
                        key: oldToken,
                        label: 'Default Information',
                        addedAt: new Date().toISOString(),
                        renewDate: '', // User can set this later
                        balance: 5.00, // Default balance
                        status: 'active' // active, exhausted, disabled
                    };
                    keys = [newKey];
                    // Save immediately so migration is done
                    this.saveApiKeys(keys);
                }

                // Auto-Renewal Check
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                let modified = false;
                keys.forEach(k => {
                    // Backwards compatibility for existing keys without balance
                    if (typeof k.balance === 'undefined') {
                        k.balance = 5.00;
                        modified = true;
                    }

                    if (k.renewDate) {
                        const renew = new Date(k.renewDate);
                        // If today is on or after the renew date
                        if (today >= renew) {
                            // Reset Status & Balance
                            k.status = 'active';
                            k.balance = 5.00; // Reset balance on renewal

                            // Increment Month
                            renew.setMonth(renew.getMonth() + 1);

                            // Save new date
                            k.renewDate = renew.toISOString().split('T')[0];
                            modified = true;
                        }
                    }
                });

                if (modified) {
                    this.saveApiKeys(keys);
                }

                resolve(keys);
            });
        });
    },

    /**
     * Save API Keys
     * @param {Array} keys 
     */
    async saveApiKeys(keys) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.KEYS.API_KEYS]: keys }, resolve);
        });
    },

    /**
     * Get the first Active Key
     * @returns {Promise<Object|null>}
     */
    async getActiveKey() {
        const keys = await this.getApiKeys();
        return keys.find(k => k.status === 'active') || null;
    },

    // --- Legacy / Alias for compatibility if needed ---
    async getProfiles() { return this.getAllProfiles(); },
    async saveProfiles(p) { return this.saveAllProfiles(p); },
    async clearProfiles() { return this.clearAllProfiles(); }
};

// Expose to window if running in content script/page context
if (typeof window !== 'undefined') {
    window.StorageWrapper = Storage;
}

// Export for module systems (if we move to ES modules later)
if (typeof module !== 'undefined') {
    module.exports = Storage;
}
