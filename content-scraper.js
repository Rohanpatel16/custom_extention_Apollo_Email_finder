/**
 * content-scraper.js
 * Handles DOM scraping and Apollo-specific page navigation/filtering.
 */

window.ContentScraper = (() => {

    function parseApolloUrlFilters() {
        const hash = decodeURIComponent(window.location.hash);
        const qPart = hash.includes('?') ? hash.split('?')[1] : '';
        const params = new URLSearchParams(qPart);
        const filters = {};

        for (const [key, value] of params.entries()) {
            let isArray = key.endsWith('[]');
            let objMatch = key.match(/^([^\[]+)\[([^\]]+)\]$/);
            let isObject = !isArray && objMatch !== null;

            let baseKey = key;
            let subKey = null;

            if (isArray) {
                baseKey = key.slice(0, -2);
            } else if (isObject) {
                baseKey = objMatch[1];
                subKey = objMatch[2];
            }

            let snakeKey = baseKey.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

            let parsedValue = value;
            if (value === 'true') parsedValue = true;
            else if (value === 'false') parsedValue = false;

            if (isArray) {
                if (!filters[snakeKey]) filters[snakeKey] = [];
                filters[snakeKey].push(parsedValue);
            } else if (isObject) {
                if (!filters[snakeKey]) filters[snakeKey] = {};
                let snakeSubKey = subKey.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                filters[snakeKey][snakeSubKey] = parsedValue;
            } else {
                filters[snakeKey] = parsedValue;
            }
        }
        if (filters.page !== undefined) delete filters.page;

        // Ensure open_factor_names includes contact_job_changed if job changed filter is applied
        if (filters.contact_job_changed !== undefined) {
            if (!filters.open_factor_names) {
                filters.open_factor_names = [];
            }
            if (!filters.open_factor_names.includes('contact_job_changed')) {
                filters.open_factor_names.push('contact_job_changed');
            }
            // Apollo HAR showed this as a string, e.g., "true" or "false"
            filters.contact_job_changed = String(filters.contact_job_changed);
        }

        return filters;
    }

    /**
     * Parses the active employee count filter range from the Apollo URL hash.
     * Apollo encodes ranges as "N," (open-ended, N and above) or "N,M" (bounded).
     * Returns { min, max, active } where min/max are integers or null if not set.
     */
    function parseEmployeeFilterRange() {
        const hash = decodeURIComponent(window.location.hash);
        const qPart = hash.includes('?') ? hash.split('?')[1] : '';
        const params = new URLSearchParams(qPart);
        const ranges = params.getAll('organizationNumEmployeesRanges[]');

        let min = null, max = null;
        ranges.forEach(r => {
            const parts = r.split(',');
            const lo = parseInt((parts[0] || '').trim(), 10);
            const hi = parseInt((parts[1] || '').trim(), 10);
            if (!isNaN(lo)) min = (min === null) ? lo : Math.min(min, lo);
            if (!isNaN(hi)) max = (max === null) ? hi : Math.max(max, hi);
        });

        return { min, max, active: min !== null || max !== null };
    }

    /**
     * Returns true if the profile's employee count falls within the active filter range.
     * Profiles with missing/unparseable employee counts are accepted (benefit of doubt).
     * If no filter is active, all profiles are accepted.
     */
    function isWithinEmployeeFilter(profile, filterRange) {
        if (!filterRange.active) return true;
        const empStr = String(profile.employees || '').replace(/,/g, '').replace(/\+/g, '').trim();
        const count = parseInt(empStr, 10);
        if (isNaN(count) || count <= 0) return true; // unknown count — accept
        if (filterRange.min !== null && count < filterRange.min) return false;
        if (filterRange.max !== null && count > filterRange.max) return false;
        return true;
    }

    async function extractProfiles(silent = false) {
        if (!silent) ContentUI.showToast("Extracting via Apollo API...", "neutral");

        try {
            const currentPage = getCurrentPageFromUrl();
            const filters = parseApolloUrlFilters();
            const filterRange = parseEmployeeFilterRange();
            let skippedAnomalyCount = 0;

            // Apollo sometimes returns empty data right after filter changes. Retry 3x.
            let data = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
                data = await ApolloAPI.searchPeople(filters, currentPage);
                const peopleList = data?.people || data?.contacts || [];
                if (peopleList.length > 0) break;
                if (attempt < 3) await new Promise(r => setTimeout(r, 3000));
            }

            const finalPeopleList = data?.people || data?.contacts || [];
            const totalCount = data?.pagination?.total_entries || data?.pagination?.total_count || 0;
            const totalPages = data?.pagination?.total_pages || 0;

            if (finalPeopleList.length === 0) {
                if (!silent) ContentUI.showToast("No profiles found on this page.", "error");
                return { profiles: [], totalCount, totalPages };
            }

            // ── Pass 1: load org snippets for all org IDs ──────────────────────
            const orgIds = [...new Set(finalPeopleList.map(p => p.organization_id).filter(Boolean))];
            let orgMap = {};
            if (orgIds.length > 0) {
                const orgData = await ApolloAPI.loadOrganizations(orgIds);
                (orgData.organizations || []).forEach(org => { orgMap[org.id] = org; });
            }

            // ── Pass 2: for people whose org still has no website, re-query ────
            const noWebsiteOrgIds = finalPeopleList
                .filter(p => {
                    const org = p.organization || {};
                    const snip = orgMap[p.organization_id] || {};
                    return !org.website_url && !snip.website_url && !org.primary_domain && !snip.primary_domain;
                })
                .map(p => p.organization_id)
                .filter(Boolean);

            if (noWebsiteOrgIds.length > 0) {
                try {
                    const orgData2 = await ApolloAPI.loadOrganizations(noWebsiteOrgIds);
                    (orgData2.organizations || []).forEach(org => {
                        orgMap[org.id] = { ...(orgMap[org.id] || {}), ...org };
                    });
                } catch (e) {
                    console.warn('[Extract] Supplemental org metadata query failed:', e);
                }
            }

            // Smart Dedup logic — uses IndexedDB indexed lookups instead of
            // loading the entire CRM into memory. Each lookup is O(1) via index.
            await ProfileDB.open();

            const newProfiles = [];
            for (const person of finalPeopleList) {
                const orgSnippet = orgMap[person.organization_id] || null;
                const profile = mapPersonToProfile(person, orgSnippet);
                if (!profile) continue;

                if (profile.domain) ContentState.sessionDomains.add(profile.domain);

                // Check Sidebar Session
                const inSession = ContentState.profiles.some(p => 
                    (p.linkedin && p.linkedin === profile.linkedin) ||
                    (p.name === profile.name && p.domain === profile.domain)
                );
                if (inSession) continue;

                // ── Filter Anomaly Guard ────────────────────────────────────────
                // Apollo sometimes injects out-of-range results even on ascending
                // sorts (e.g., a 6-emp company in a 1-emp filter). Skip them so
                // they don't pollute the CRM or distort the auto-advance cursor.
                if (!isWithinEmployeeFilter(profile, filterRange)) {
                    skippedAnomalyCount++;
                    console.warn(`[FilterGuard] Skipping "${profile.name}" — ${profile.employees} employees outside filter range (min:${filterRange.min}, max:${filterRange.max})`);
                    continue;
                }

                // 3-Tier CRM Dedup — indexed lookups instead of full array scan
                // matchTier tracks HOW the match was found — only Tier 1 (LinkedIn) is
                // authoritative enough to confirm same-person identity for job-change logic.
                let existing = null;
                let matchTier = 0;

                // Tier 1: LinkedIn URL — same person confirmed
                if (profile.linkedin) {
                    const byLi = await ProfileDB.getByLinkedin(profile.linkedin.toLowerCase());
                    if (byLi) {
                        existing = byLi;
                        matchTier = 1;
                    }
                }

                // Tier 2: Name + Domain — same person at same company
                if (!existing && profile.name && profile.domain) {
                    const byND = await ProfileDB.getByNameDomain(profile.name, profile.domain);
                    if (byND) {
                        existing = byND;
                        matchTier = 2;
                    }
                }

                // Tier 3: Name-only — identity unconfirmed fallback
                if (!existing && profile.name && !profile.linkedin) {
                    const byName = await ProfileDB.getByName(profile.name);
                    if (byName && !byName.linkedin) {
                        existing = byName;
                        matchTier = 3;
                    }
                }

                if (existing) {
                    // Tier 3: name-only match with no LinkedIn on either side — identity unconfirmed.
                    // Treat the incoming profile as a brand-new lead to avoid false merges.
                    if (matchTier === 3) {
                        newProfiles.push(profile);
                        continue;
                    }

                    let updated;

                    // Job-change detection: only safe when LinkedIn confirmed it's the same person (Tier 1)
                    // AND the company domain has actually changed.
                    const domainActuallyChanged =
                        matchTier === 1 &&
                        existing.domain &&
                        profile.domain &&
                        existing.domain.toLowerCase() !== profile.domain.toLowerCase();

                    if (domainActuallyChanged) {
                        // Archive old emails, reset for re-verification at new company
                        updated = {
                            ...existing,
                            ...profile,
                            status: 'ready',
                            results: [],
                            old_results: [...(existing.old_results || []), ...(existing.results || [])],
                            jobChanged: true
                        };
                    } else {
                        // Same company update — preserve existing verification state and emails
                        updated = {
                            ...existing,
                            ...profile,
                            status: existing.status,
                            results: existing.results,
                            old_results: existing.old_results,
                            // Preserve existing emails; only use newly generated ones if none stored yet
                            emails: (existing.emails && existing.emails.length > 0) ? existing.emails : profile.emails,
                            // Preserve jobChanged flag if it was set and not yet cleared
                            jobChanged: existing.jobChanged || false
                        };
                    }
                    newProfiles.push(updated);
                } else {
                    newProfiles.push(profile);
                }
            }

            if (skippedAnomalyCount > 0 && !silent) {
                ContentUI.showToast(`⚠️ Skipped ${skippedAnomalyCount} anomalous result${skippedAnomalyCount > 1 ? 's' : ''} (outside employee filter)`, 'warning');
            }

            return { profiles: newProfiles, totalCount, totalPages };
        } catch (err) {
            console.error('[Extract] failed:', err);
            if (!silent) ContentUI.showToast("Extraction failed: " + err.message, "error");
            return { profiles: [], totalCount: 0, totalPages: 0 };
        }
    }

    function getCurrentPageFromUrl() {
        const hash = window.location.hash;
        if (!hash.includes('?')) return 1;
        const qPart = hash.split('?')[1];
        const params = new URLSearchParams(qPart);
        const page = params.get('page');
        return page ? parseInt(page, 10) : 1;
    }

    function getCurrentMinFromUrl() {
        const hash = decodeURIComponent(window.location.hash);
        const match = hash.match(/organizationNumEmployeesRanges\[\]=(\d+),/);
        return match ? parseInt(match[1], 10) : 0;
    }

    function getHighestEmployeeCount(startIndex = 0) {
        const counts = ContentState.profiles
            .slice(startIndex)
            .map(p => parseInt(String(p.employees || '').replace(/,/g, '').replace(/\+/g, '').trim(), 10))
            .filter(n => !isNaN(n) && n > 0);
        return counts.length > 0 ? Math.max(...counts) : null;
    }

    /**
     * Like getHighestEmployeeCount but only considers profiles that are within
     * the active Apollo employee filter range. This prevents anomalous out-of-range
     * results from inflating the auto-advance cursor and causing gaps in coverage.
     */
    function getValidatedHighestEmployeeCount(startIndex = 0) {
        const filterRange = parseEmployeeFilterRange();
        const counts = ContentState.profiles
            .slice(startIndex)
            .filter(p => isWithinEmployeeFilter(p, filterRange))
            .map(p => parseInt(String(p.employees || '').replace(/,/g, '').replace(/\+/g, '').trim(), 10))
            .filter(n => !isNaN(n) && n > 0);
        return counts.length > 0 ? Math.max(...counts) : null;
    }

    function advanceEmployeeFilter(newMin) {
        let hash = window.location.hash;
        hash = hash.replace(
            /organizationNumEmployeesRanges\[\]=[^&]*/,
            `organizationNumEmployeesRanges[]=${encodeURIComponent(newMin + ',')}`
        );
        hash = hash.replace(/page=\d+/, 'page=1');
        window.location.hash = hash;
    }

    /**
     * Sets the Apollo URL employee filter to a bounded range [min, max].
     * Used by Bracket Scrape Mode. Apollo encodes this as "min,max".
     */
    function setBracketFilter(min, max) {
        let hash = window.location.hash;
        const encoded = encodeURIComponent(`${min},${max}`);
        if (hash.includes('organizationNumEmployeesRanges[]')) {
            hash = hash.replace(
                /organizationNumEmployeesRanges\[\]=[^&]*/,
                `organizationNumEmployeesRanges[]=${encoded}`
            );
        } else {
            // No existing filter — append it after the ? separator
            const sep = hash.includes('?') ? '&' : '?';
            hash += `${sep}organizationNumEmployeesRanges[]=${encoded}`;
        }
        hash = hash.replace(/page=\d+/, 'page=1');
        window.location.hash = hash;
    }

    async function clickNextPage() {
        const nextBtn = document.querySelector('[aria-label="Next"]') ||
            document.querySelector('.zp-button:has(.apollo-icon-chevron-right)') ||
            Array.from(document.querySelectorAll('button')).find(b =>
                b.textContent.includes('Next') || b.querySelector('.apollo-icon-chevron-right'));
        
        if (nextBtn) {
            // Check for various disabled states
            const isDisabled = 
                nextBtn.disabled || 
                nextBtn.getAttribute('aria-disabled') === 'true' || 
                nextBtn.classList.contains('zp-is-disabled') ||
                nextBtn.classList.contains('disabled');
            
            if (!isDisabled) {
                nextBtn.click();
                return true;
            } else {
                console.log('[ContentScraper] Next button found but is disabled.');
            }
        }
        return false;
    }

    return {
        extractProfiles,
        getCurrentPageFromUrl,
        getCurrentMinFromUrl,
        getHighestEmployeeCount,
        getValidatedHighestEmployeeCount,
        advanceEmployeeFilter,
        setBracketFilter,
        clickNextPage
    };
})();
