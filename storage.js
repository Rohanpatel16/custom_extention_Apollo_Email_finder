/**
 * storage.js
 * Wrapper for chrome.storage.local to handle CRM data (Global) and Sidebar Session (View)
 */

const Storage = {
    // Keys
    KEYS: {
        PROFILES: 'av_profiles',         // Global Persistent CRM
        SESSION: 'av_sidebar_session',   // Current Sidebar View
        SETTINGS: 'av_settings',
        API_TOKEN: 'apifyApiToken',      // Legacy Single Token
        API_KEYS: 'apifyApiKeys',        // New Multi-Key Array
        BALANCE: 'av_balance'
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
                // Merge logic: currently just overwrite with new state which is usually more up to date
                // But we might want to preserve 'date_added' if we had it.
                // For now, simple overwrite is fine as long as IDs match.
                existingMap.set(p.id, { ...existingMap.get(p.id), ...p });
            } else {
                existingMap.set(p.id, p);
            }
        });

        const merged = Array.from(existingMap.values());

        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.KEYS.PROFILES]: merged }, resolve);
        });
    },

    /**
     * Overwrite Global CRM with exact list (For Dashboard deletions)
     * @param {Array} profiles 
     */
    async overwriteGlobalProfiles(profiles) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [this.KEYS.PROFILES]: profiles }, resolve);
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
            chrome.storage.local.remove(this.KEYS.PROFILES, resolve);
        });
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
