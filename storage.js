/**
 * storage.js
 * Wrapper for chrome.storage.local to handle CRM data (Global) and Sidebar Session (View)
 * Also syncs profile data to Turso cloud (fire-and-forget) via TursoSync.
 */

const Storage = {
    // Keys
    KEYS: {
        PROFILES: 'av_profiles',         // Global Persistent CRM
        SESSION: 'av_sidebar_session',   // Current Sidebar View
        SETTINGS: 'av_settings',
        API_TOKEN: 'apifyApiToken',      // Legacy Single Token
        API_KEYS: 'apifyApiKeys',        // New Multi-Key Array
        BALANCE: 'av_balance',
        TURSO_CONFIG: 'av_turso_config'  // Turso Cloud credentials
    },

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
     * Get all profiles from Global CRM
     * @returns {Promise<Array>}
     */
    async getAllProfiles() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.KEYS.PROFILES], (result) => {
                resolve(result[this.KEYS.PROFILES] || []);
            });
        });
    },

    /**
     * Find a profile in the CRM by ID, LinkedIn URL, or Name+Domain
     * @param {Object} query { id, linkedin_url, name, domain }
     * @returns {Promise<Object|null>}
     */
    async getCachedProfile(query) {
        const profiles = await this.getAllProfiles();
        return profiles.find(p => {
            if (query.id && p.id === query.id) return true;
            if (query.linkedin_url && p.linkedin_url && p.linkedin_url === query.linkedin_url) return true;
            if (query.name && query.domain && p.name === query.name && p.domain === query.domain) return true;
            return false;
        }) || null;
    },

    /**
     * Save profiles to Global CRM (merge/overwrite by ID)
     * @param {Array} newProfiles 
     * @returns {Promise<void>}
     */
    async saveAllProfiles(newProfiles) {
        const existing = await this.getAllProfiles();
        const existingMap = new Map(existing.map(p => [p.id, p]));

        newProfiles.forEach(p => {
            // If exists, merge (prefer new data mostly, but keep flags if needed)
            if (existingMap.has(p.id)) {
                existingMap.set(p.id, { ...existingMap.get(p.id), ...p });
            } else {
                existingMap.set(p.id, p);
            }
        });

        // Fix 3: Auto-clear jobChanged once a valid email is verified for the lead.
        // This way the badge disappears silently as soon as re-verification succeeds.
        existingMap.forEach((p, id) => {
            if (p.jobChanged && p.results && p.results.some(r => r.result === 'ok')) {
                existingMap.set(id, { ...p, jobChanged: false });
            }
        });

        const merged = Array.from(existingMap.values());

        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.KEYS.PROFILES]: merged }, () => {
                resolve();
                // 🔵 Turso cloud sync (fire-and-forget)
                if (typeof TursoSync !== 'undefined') {
                    TursoSync.upsertProfiles(merged).catch(err =>
                        console.warn('[TursoSync] upsert failed:', err)
                    );
                }
            });
        });
    },

    /**
     * Overwrite Global CRM with exact list (For Dashboard deletions)
     * @param {Array} profiles 
     */
    async overwriteGlobalProfiles(profiles) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.KEYS.PROFILES]: profiles }, () => {
                resolve();
                // 🔵 Turso cloud sync: wipe + re-insert remaining (handles deletions)
                if (typeof TursoSync !== 'undefined') {
                    TursoSync.deleteAllProfiles()
                        .then(() => {
                            // Bug 9: skip upsert when there's nothing to insert (avoids a pointless round-trip)
                            if (profiles.length > 0) {
                                return TursoSync.upsertProfiles(profiles);
                            }
                            console.log('[TursoSync] All profiles cleared — cloud is now empty.');
                        })
                        .catch(err => {
                            // Bug 9: elevated from warn to error — Turso may be empty while local isn't
                            console.error('[TursoSync] overwrite sync failed — cloud may be out of sync:', err);
                        });
                }
            });
        });
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
        return new Promise((resolve) => {
            chrome.storage.local.remove(this.KEYS.PROFILES, () => {
                resolve();
                // 🔵 Turso cloud sync: WE NO LONGER DELETE FROM CLOUD
                // User wants to keep cloud data as a permanent record.
                console.log('[Storage] Local profiles cleared. Cloud data preserved.');
            });
        });
    },

    /**
     * Pull ALL profiles from Turso cloud into local storage.
     * Used by the "Sync from Cloud" button in the dashboard.
     * @returns {Promise<Array>} the profiles pulled
     */
    async pullFromTurso() {
        if (typeof TursoSync === 'undefined') {
            console.warn('[TursoSync] TursoSync not available');
            return [];
        }
        const profiles = await TursoSync.getAllProfiles();
        if (profiles.length > 0) {
            await new Promise(resolve =>
                chrome.storage.local.set({ [this.KEYS.PROFILES]: profiles }, resolve)
            );
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
                            // Careful with end of month overflow (e.g. Jan 31 -> Feb 28)
                            // Ideally user wants "same date" so 18th.
                            // Simple increment:
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
        // Check for renewal (simple logic: if renewDate passed, reset status?)
        // Let's keep it simple: just return first 'active' key.
        // User manually resets status or we auto-reset if logic dictates.
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
