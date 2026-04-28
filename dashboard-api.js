/**
 * dashboard-api.js
 * Handles data operations like sync, import, export, and deletion.
 */

window.DashboardAPI = (() => {

    async function syncCloud() {
        const btn = document.getElementById('sync-cloud-btn');
        if (!btn) return;
        btn.textContent = '⏳ Syncing…';
        btn.disabled = true;
        try {
            const cloudProfiles = await TursoSync.getAllProfiles();

            if (cloudProfiles.length === 0 && DashboardState.allProfiles.length > 0) {
                const count = await StorageWrapper.pushToTurso();
                alert(`✅ Backed up ${count} profiles to Turso cloud.`);
            } else if (cloudProfiles.length > 0) {
                const profiles = await StorageWrapper.pullFromTurso();
                DashboardState.allProfiles = profiles;
                DashboardState.applyFilters();
                DashboardUI.render();
                DashboardUI.populateFilterOptions();
                alert(`✅ Synced ${profiles.length} profiles from Turso cloud.`);
            } else {
                alert('ℹ️ Nothing to sync — no profiles in local storage or cloud yet.');
            }
        } catch (err) {
            console.error('[TursoSync] sync failed:', err);
            alert('❌ Sync failed: ' + err.message);
        } finally {
            btn.textContent = '☁️ Sync from Cloud';
            btn.disabled = false;
        }
    }

    async function deleteProfile(id) {
        if (confirm("Delete this profile?")) {
            const index = DashboardState.allProfiles.findIndex(p => p.id === id);
            if (index > -1) {
                DashboardState.allProfiles.splice(index, 1);
                await StorageWrapper.overwriteGlobalProfiles(DashboardState.allProfiles);
                DashboardState.applyFilters();
                DashboardUI.render();
                DashboardUI.populateFilterOptions();
            }
        }
    }

    async function cleanLinkedInLinks() {
        if (!confirm("This will scan all leads and remove/fix any LinkedIn URLs that are not personal profiles (missing /in/). Continue?")) {
            return;
        }

        let fixCount = 0;
        let moveCount = 0;

        DashboardState.allProfiles.forEach(p => {
            const hasLink = p.linkedin && p.linkedin.includes('linkedin.com');
            const isPersonal = p.linkedin && p.linkedin.includes('linkedin.com/in/');

            if (hasLink && !isPersonal) {
                if (!p.companyLinkedin && (p.linkedin.includes('/company/') || p.linkedin.includes('/school/'))) {
                    p.companyLinkedin = p.linkedin;
                    moveCount++;
                }
                p.linkedin = "";
                fixCount++;
            }
        });

        if (fixCount === 0) {
            alert("No invalid LinkedIn links found. Your data is clean! ✨");
            return;
        }

        try {
            await StorageWrapper.overwriteGlobalProfiles(DashboardState.allProfiles);
            DashboardState.applyFilters();
            DashboardUI.render();
            alert(`✅ Cleanup Complete!\n\n- Fixed/Cleared: ${fixCount} invalid personal links\n- Moved to Company field: ${moveCount}`);
        } catch (err) {
            console.error("Cleanup failed:", err);
        }
    }

    function handleExport() {
        const format = document.querySelector('input[name="export-format"]:checked').value;
        const validOnly = document.getElementById('export-valid-only').checked;

        let dataToExport = DashboardState.filteredProfiles;
        if (validOnly) {
            dataToExport = dataToExport.filter(p => p.status === 'verified' && p.results.some(r => r.result === 'ok'));
        }

        if (format === 'json') {
            downloadJSON(dataToExport);
        } else {
            downloadCSV(dataToExport);
        }
        document.getElementById('export-modal').classList.add('hidden');
    }

    function downloadJSON(data) {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        triggerDownload(dataStr, "apollo_crm_export.json");
    }

    function downloadCSV(data) {
        const header = ["Name", "Title", "Company", "Employees", "Industry", "Secondary_Industries", "Company_Keywords", "Location", "Domain", "Website", "Person_LinkedIn", "Company_LinkedIn", "Email", "Verification_Status"];
        let csvContent = header.join(",") + "\n";

        data.forEach(p => {
            const csvEsc = v => String(v || '').replace(/"/g, '""');
            const keywords = (p.companyKeywords || []).join('; ');
            const secIndustries = (p.secondaryIndustries || []).join('; ');

            let emails = [];
            if (p.results && p.results.length > 0) {
                const isExportValidOnly = document.getElementById('export-valid-only').checked;
                p.results.forEach(r => {
                    if (isExportValidOnly && r.result !== 'ok') return;
                    emails.push({ email: r.email, status: r.result });
                });
            }

            if (emails.length === 0) {
                const row = [
                    `"${csvEsc(p.name)}"`, `"${csvEsc(p.title)}"`, `"${csvEsc(p.company)}"`,
                    `"${csvEsc(p.employees)}"`, `"${csvEsc(p.industry)}"`,
                    `"${csvEsc(secIndustries)}"`, `"${csvEsc(keywords)}"`, `"${csvEsc(p.location)}"`,
                    `"${csvEsc(p.domain)}"`, `"${csvEsc(p.website)}"`,
                    `"${csvEsc(p.linkedin)}"`, `"${csvEsc(p.companyLinkedin)}"`,
                    `""`, `"${csvEsc(p.status)}"`
                ];
                csvContent += row.join(",") + "\n";
            } else {
                emails.forEach(e => {
                    const row = [
                        `"${csvEsc(p.name)}"`, `"${csvEsc(p.title)}"`, `"${csvEsc(p.company)}"`,
                        `"${csvEsc(p.employees)}"`, `"${csvEsc(p.industry)}"`,
                        `"${csvEsc(secIndustries)}"`, `"${csvEsc(keywords)}"`, `"${csvEsc(p.location)}"`,
                        `"${csvEsc(p.domain)}"`, `"${csvEsc(p.website)}"`,
                        `"${csvEsc(p.linkedin)}"`, `"${csvEsc(p.companyLinkedin)}"`,
                        `"${csvEsc(e.email)}"`, `"${csvEsc(e.status)}"`
                    ];
                    csvContent += row.join(",") + "\n";
                });
            }
        });

        const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
        triggerDownload(dataStr, "apollo_crm_export.csv");
    }

    function triggerDownload(dataStr, fileName) {
        const link = document.createElement("a");
        link.setAttribute("href", dataStr);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async function handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            const rows = parseCSV(text);

            if (rows.length === 0) {
                alert("No valid data found in CSV");
                return;
            }

            const groups = {};
            rows.forEach(row => {
                const name = row.Name || "";
                const domain = row.Domain || "";
                const key = `${name}_${domain}`.toLowerCase();
                
                if (!groups[key]) {
                    groups[key] = {
                        id: row.Person_LinkedIn || key,
                        name: name,
                        title: row.Title || "",
                        company: row.Company || "",
                        employees: row.Employees || "",
                        industry: row.Industry || "",
                        location: row.Location || "",
                        domain: domain,
                        website: row.Website || "",
                        linkedin: row.Person_LinkedIn || "",
                        companyLinkedin: row.Company_LinkedIn || "",
                        status: 'ready',
                        results: []
                    };
                }

                if (row.Email) {
                    const resultObj = {
                        email: row.Email,
                        result: row.Verification_Status || "unknown"
                    };
                    if (row.Verification_Status === 'ok') {
                        groups[key].status = 'verified';
                    }
                    if (!groups[key].results.some(r => r.email === row.Email)) {
                        groups[key].results.push(resultObj);
                    }
                }
            });

            const importedProfiles = Object.values(groups);
            if (confirm(`Import ${importedProfiles.length} profiles to CRM?`)) {
                await StorageWrapper.saveAllProfiles(importedProfiles);
                await DashboardState.loadData();
                DashboardUI.render();
                DashboardUI.populateFilterOptions();
                alert('Import complete!');
            }
        };
        reader.readAsText(file);
    }

    function parseCSV(text) {
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) return [];
        const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const results = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const values = [];
            let current = "";
            let inQuotes = false;
            for (let char of lines[i]) {
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) {
                    values.push(current.trim());
                    current = "";
                } else current += char;
            }
            values.push(current.trim());
            const entry = {};
            header.forEach((h, idx) => {
                entry[h] = (values[idx] || "").replace(/^"|"$/g, '');
            });
            results.push(entry);
        }
        return results;
    }

    // Expose cleanLinkedInLinks to window for legacy support if needed
    window.cleanLinkedInLinks = cleanLinkedInLinks;
    window.deleteProfile = deleteProfile;

    return {
        syncCloud,
        deleteProfile,
        cleanLinkedInLinks,
        handleExport,
        handleImport
    };
})();
