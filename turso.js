/**
 * turso.js
 * Turso HTTP API client for syncing profile data to the cloud.
 * Uses the Turso HTTP pipeline API — no Node.js / npm required.
 *
 * Database: apollo-email-finder
 * Table: profiles
 */

const TursoSync = (() => {
    // ─── Config ───────────────────────────────────────────────────────────────
    const DB_URL    = 'https://apollo-email-finder-rohanpatell.aws-ap-south-1.turso.io';
    const AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzQzNTYxOTYsImlkIjoiMDE5ZDFmZGQtMmMwMS03ZTczLWIwODAtNzA5ZTFlZDBiMzEwIiwicmlkIjoiYjg0MTBjYmEtZjk1ZS00YzQ0LWE5NDAtZDY1MzU1NzU2MjE5In0.-5KzP0ei0UTWWtMNn4c6P1HipwGv2OwzQPruCfQ9NN4Rg-ctEYk33bm5SjYLLM5JbqI55ytTeMKflAFj3Z2_Cw';

    // ─── Core HTTP executor ───────────────────────────────────────────────────
    async function execute(requests) {
        const res = await fetch(`${DB_URL}/v2/pipeline`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ requests })
        });
        if (!res.ok) {
            const txt = await res.text().catch(() => res.statusText);
            throw new Error(`[TursoSync] HTTP ${res.status}: ${txt}`);
        }
        return res.json();
    }

    // ─── Helper: build positional args array ──────────────────────────────────
    function textArg(value) {
        return { type: 'text', value: String(value ?? '') };
    }

    // ─── Schema migration guard ───────────────────────────────────────────────
    let _schemaMigrated = false;
    async function ensureSchema() {
        if (_schemaMigrated) return;
        // SQLite ignores ADD COLUMN if already exists only via try/catch;
        // we send all 3 and swallow individual errors.
        const migrations = [
            `ALTER TABLE profiles ADD COLUMN employees  TEXT DEFAULT ''`,
            `ALTER TABLE profiles ADD COLUMN industry   TEXT DEFAULT ''`,
            `ALTER TABLE profiles ADD COLUMN old_results TEXT DEFAULT '[]'`
        ];
        for (const sql of migrations) {
            try {
                await execute([{ type: 'execute', stmt: { sql, args: [] } }, { type: 'close' }]);
            } catch (_) {
                // Column already exists — safe to ignore
            }
        }
        _schemaMigrated = true;
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Upsert (INSERT OR REPLACE) a batch of profiles into Turso.
     * Called after every save to local storage.
     * @param {Array} profiles
     */
    async function upsertProfiles(profiles) {
        if (!profiles || profiles.length === 0) return;
        await ensureSchema();

        const CHUNK = 50;
        for (let i = 0; i < profiles.length; i += CHUNK) {
            const chunk = profiles.slice(i, i + CHUNK);
            const requests = chunk.map(p => ({
                type: 'execute',
                stmt: {
                    sql: `INSERT OR REPLACE INTO profiles
                          (id, name, title, company, location, domain, website,
                           linkedin, company_linkedin, status, results,
                           employees, industry, old_results, updated_at)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                    args: [
                        textArg(p.id),
                        textArg(p.name),
                        textArg(p.title),
                        textArg(p.company),
                        textArg(p.location),
                        textArg(p.domain),
                        textArg(p.website),
                        textArg(p.linkedin),
                        textArg(p.companyLinkedin),
                        textArg(p.status || 'ready'),
                        textArg(JSON.stringify(p.results || [])),
                        textArg(p.employees || ''),
                        textArg(p.industry || ''),
                        textArg(JSON.stringify(p.old_results || []))
                    ]
                }
            }));
            requests.push({ type: 'close' });
            await execute(requests);
        }
    }

    /**
     * Delete a single profile by ID from Turso.
     * @param {string} id
     */
    async function deleteProfile(id) {
        return execute([
            {
                type: 'execute',
                stmt: {
                    sql: 'DELETE FROM profiles WHERE id = ?',
                    args: [textArg(id)]
                }
            },
            { type: 'close' }
        ]);
    }

    /**
     * Delete ALL profiles from Turso.
     * Called when user clears the CRM.
     */
    async function deleteAllProfiles() {
        return execute([
            {
                type: 'execute',
                stmt: { sql: 'DELETE FROM profiles', args: [] }
            },
            { type: 'close' }
        ]);
    }

    /**
     * Fetch ALL profiles from Turso and return as a JS array.
     * Used for "Sync from Cloud" pull.
     * @returns {Promise<Array>}
     */
    async function getAllProfiles() {
        await ensureSchema();
        const result = await execute([
            {
                type: 'execute',
                stmt: {
                    sql: 'SELECT * FROM profiles ORDER BY created_at DESC',
                    args: []
                }
            },
            { type: 'close' }
        ]);

        const response = result.results?.[0]?.response?.result;
        if (!response) return [];

        const cols = response.cols.map(c => c.name);
        const rows = response.rows || [];

        return rows.map(row => {
            const obj = {};
            cols.forEach((col, i) => {
                obj[col] = row[i]?.value ?? null;
            });

            // Parse stored JSON fields
            try { obj.results     = JSON.parse(obj.results     || '[]'); } catch (_) { obj.results = []; }
            try { obj.old_results = JSON.parse(obj.old_results || '[]'); } catch (_) { obj.old_results = []; }

            // Map snake_case → camelCase to match JS data model
            obj.companyLinkedin = obj.company_linkedin ?? '';
            delete obj.company_linkedin;

            return obj;
        });
    }

    // ─── Expose ───────────────────────────────────────────────────────────────
    return { upsertProfiles, deleteProfile, deleteAllProfiles, getAllProfiles };
})();

// Expose to window for content scripts / dashboard
if (typeof window !== 'undefined') window.TursoSync = TursoSync;
// Export for module systems
if (typeof module !== 'undefined') module.exports = TursoSync;
