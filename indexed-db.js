/**
 * indexed-db.js
 * IndexedDB wrapper for high-performance CRM profile storage.
 *
 * Replaces the old chrome.storage.local JSON-blob approach with a proper
 * database that supports indexed lookups and incremental writes.
 *
 * Database : ApolloVerifierDB  (version 1)
 * Store    : profiles          (keyPath: "id")
 * Indexes  : linkedin, domain, status, name_domain (compound)
 */

const ProfileDB = (() => {
    const DB_NAME = 'ApolloVerifierDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'profiles';

    /** @type {IDBDatabase|null} */
    let _db = null;

    /** @type {Promise<IDBDatabase>|null} — dedup concurrent open() calls */
    let _opening = null;

    // ─── Core: open / ensure ──────────────────────────────────────────────────

    /**
     * Open (or create) the IndexedDB database.
     * Safe to call multiple times — returns the cached connection.
     * @returns {Promise<IDBDatabase>}
     */
    function open() {
        if (_db) return Promise.resolve(_db);
        if (_opening) return _opening;

        _opening = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });

                    // Index: fast lookup by LinkedIn URL (unique-ish, but allow dupes for safety)
                    store.createIndex('linkedin', 'linkedin', { unique: false });

                    // Index: fast lookup by domain (many profiles share a domain)
                    store.createIndex('domain', 'domain', { unique: false });

                    // Index: filter by verification status
                    store.createIndex('status', 'status', { unique: false });

                    // Compound index: name + domain for dedup
                    store.createIndex('name_domain', ['name', 'domain'], { unique: false });

                    // Index: name-only for Tier-3 dedup fallback
                    store.createIndex('name', 'name', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                _db = event.target.result;

                // Handle unexpected close (e.g. browser cleared storage)
                _db.onclose = () => { _db = null; _opening = null; };
                _db.onversionchange = () => { _db.close(); _db = null; _opening = null; };

                _opening = null;
                resolve(_db);
            };

            request.onerror = (event) => {
                console.error('[ProfileDB] Failed to open IndexedDB:', event.target.error);
                _opening = null;
                reject(event.target.error);
            };
        });

        return _opening;
    }

    /**
     * Internal helper — ensures DB is open, returns the database instance.
     * @returns {Promise<IDBDatabase>}
     */
    async function ensure() {
        if (_db) return _db;
        return open();
    }

    // ─── Read operations ──────────────────────────────────────────────────────

    /**
     * Get ALL profiles from the store.
     * @returns {Promise<Array>}
     */
    async function getAll() {
        const db = await ensure();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Stream-read ALL profiles using a cursor, yielding chunks.
     * Useful for very large datasets (50k+) where getAll() causes a memory spike.
     * @param {number} chunkSize - How many profiles per chunk (default 500).
     * @param {function(Array): void} onChunk - Called for each chunk of profiles.
     * @returns {Promise<void>} resolves when all chunks have been yielded.
     */
    async function getAllPaginated(chunkSize = 500, onChunk) {
        const db = await ensure();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.openCursor();
            let chunk = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    chunk.push(cursor.value);
                    if (chunk.length >= chunkSize) {
                        onChunk(chunk);
                        chunk = [];
                    }
                    cursor.continue();
                } else {
                    // Final partial chunk
                    if (chunk.length > 0) {
                        onChunk(chunk);
                    }
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get a single profile by its primary key (id).
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async function getById(id) {
        if (!id) return null;
        const db = await ensure();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Find the first profile matching a LinkedIn URL via the linkedin index.
     * @param {string} linkedinUrl
     * @returns {Promise<Object|null>}
     */
    async function getByLinkedin(linkedinUrl) {
        if (!linkedinUrl) return null;
        const db = await ensure();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('linkedin');
            const request = index.get(linkedinUrl.toLowerCase());
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Find the first profile matching a name + domain via the compound index.
     * @param {string} name
     * @param {string} domain
     * @returns {Promise<Object|null>}
     */
    async function getByNameDomain(name, domain) {
        if (!name || !domain) return null;
        const db = await ensure();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('name_domain');
            const request = index.get([name, domain]);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Find the first profile matching a name (Tier-3 dedup fallback).
     * @param {string} name
     * @returns {Promise<Object|null>}
     */
    async function getByName(name) {
        if (!name) return null;
        const db = await ensure();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('name');
            const request = index.get(name);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get a quick count of profiles without loading them.
     * @returns {Promise<number>}
     */
    async function count() {
        const db = await ensure();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ─── Write operations ─────────────────────────────────────────────────────

    /**
     * Batch upsert (put) profiles into the store.
     * Uses a single readwrite transaction for atomicity.
     * @param {Array} profiles
     * @returns {Promise<void>}
     */
    async function upsertMany(profiles) {
        if (!profiles || profiles.length === 0) return;
        const db = await ensure();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);

            for (const p of profiles) {
                if (!p.id) continue; // skip profiles without an ID

                // Normalize linkedin to lowercase for consistent index lookups
                if (p.linkedin) {
                    p.linkedin = p.linkedin.toLowerCase();
                }

                store.put(p);
            }

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
        });
    }

    /**
     * Put a single profile.
     * @param {Object} profile
     * @returns {Promise<void>}
     */
    async function putOne(profile) {
        return upsertMany([profile]);
    }

    /**
     * Delete a single profile by ID.
     * @param {string} id
     * @returns {Promise<void>}
     */
    async function deleteById(id) {
        const db = await ensure();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete ALL profiles (clear the entire object store).
     * @returns {Promise<void>}
     */
    async function deleteAll() {
        const db = await ensure();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // ─── Expose ───────────────────────────────────────────────────────────────

    return {
        open,
        getAll,
        getAllPaginated,
        getById,
        getByLinkedin,
        getByNameDomain,
        getByName,
        count,
        upsertMany,
        putOne,
        deleteById,
        deleteAll
    };
})();

// Expose to window for content scripts / dashboard
if (typeof window !== 'undefined') window.ProfileDB = ProfileDB;
// Export for module systems
if (typeof module !== 'undefined') module.exports = ProfileDB;
