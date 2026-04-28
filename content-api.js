/**
 * content-api.js
 * Apollo.io API client and data mapping logic.
 */

const ApolloAPI = (() => {
    const PEOPLE_FIELDS = [
        'contact.id', 'contact.name', 'contact.first_name', 'contact.last_name',
        'contact.linkedin_url', 'contact.twitter_url', 'contact.facebook_url',
        'contact.title', 'contact.email', 'contact.email_status',
        'contact.email_domain_catchall', 'contact.phone_numbers',
        'contact.city', 'contact.state', 'contact.country',
        'contact.organization_name', 'contact.organization_id',
        'account.estimated_num_employees', 'account.domain',
        'account.industries', 'account.website_url', 'account.linkedin_url'
    ];

    function getCsrfToken() {
        const match = document.cookie.match(/X-CSRF-TOKEN=([^;]+)/);
        if (match) return decodeURIComponent(match[1]);
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.content : null;
    }

    async function call(endpoint, method = 'GET', body = null) {
        const headers = { 'Content-Type': 'application/json' };
        const csrf = getCsrfToken();
        if (csrf && method !== 'GET') headers['X-CSRF-TOKEN'] = csrf;
        const opts = { method, headers, credentials: 'include' };
        if (body) opts.body = JSON.stringify({ ...body, cacheKey: Date.now() });

        for (let attempt = 0; attempt < 3; attempt++) {
            const res = await fetch(`https://app.apollo.io${endpoint}`, opts);
            if (res.ok) return res.json();

            if ((res.status === 429 || res.status === 503) && attempt < 2) {
                const delay = 3000 * Math.pow(2, attempt);
                console.warn(`[ApolloAPI] ${res.status} on ${endpoint} — retrying in ${delay}ms`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            throw new Error(`Apollo API ${res.status}: ${res.statusText}`);
        }
    }

    async function searchPeople(filters, page = 1, perPage = 30) {
        const hash = window.location.hash;
        let endpoint = '/api/v1/mixed_people/search';
        let context = 'people-index-page';

        if (hash.includes('/contacts')) {
            endpoint = '/api/v1/contacts/search';
            context = 'contacts-index-page';
        }

        return call(endpoint, 'POST', {
            page,
            per_page: perPage,
            display_mode: 'explorer_mode',
            context: context,
            finder_version: 2,
            show_suggestions: false,
            num_fetch_result: 1,
            typed_custom_fields: [],
            fields: PEOPLE_FIELDS,
            ...filters
        });
    }

    async function loadOrganizations(orgIds) {
        if (!orgIds || orgIds.length === 0) return { organizations: [] };
        return call('/api/v1/organizations/load_snippets', 'POST', { ids: orgIds });
    }

    async function saveExclusionQuery(domainUrls) {
        // Bug 1: accept array and join with newline — Apollo accepts multiple URLs in one call
        const query = Array.isArray(domainUrls) ? domainUrls.join('\n') : domainUrls;
        const res = await call('/api/v1/organization_search_lists/save_query', 'POST', { query });
        console.log('[saveExclusionQuery] raw response:', JSON.stringify(res));
        return res;
    }

    return {
        searchPeople,
        loadOrganizations,
        saveExclusionQuery
    };
})();

/**
 * Maps Apollo API person and org snippet to our internal Profile model.
 */
function mapPersonToProfile(person, orgSnippet) {
    const org = person.organization || {};
    const snippet = orgSnippet || {};

    // Domain extraction — try every available field before dropping the profile.
    const website =
        org.website_url ||
        snippet.website_url ||
        (org.primary_domain     ? `https://${org.primary_domain}`     : '') ||
        (snippet.primary_domain ? `https://${snippet.primary_domain}` : '') ||
        '';

    let domain = '';
    if (website) {
        try { domain = new URL(website).hostname.replace(/^www\./, ''); } catch (e) {}
    }

    if (!domain && org.primary_domain)    domain = org.primary_domain.replace(/^www\./, '');
    if (!domain && snippet.primary_domain) domain = snippet.primary_domain.replace(/^www\./, '');

    // If we still have no domain, we can't generate emails.
    if (!domain) return null;

    // Filter for only personal LinkedIn profiles (no company pages/placeholders)
    const liRaw = person.linkedin_url || '';
    const linkedin = liRaw.includes('linkedin.com/in/') ? liRaw : '';

    const companyKeywords = snippet.keywords || org.keywords || [];
    const secondaryIndustries = snippet.secondary_industries || org.secondary_industries || [];

    const fullName = person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim();

    return {
        id: person.id || person.contact_id || person.linkedin_url || Math.random().toString(36).substr(2, 9),
        name: fullName,
        title: person.title || '',
        location: [person.city, person.state, person.country].filter(Boolean).join(', '),
        linkedin,
        company: org.name || snippet.name || person.organization_name || '',
        companyLinkedin: org.linkedin_url || snippet.linkedin_url || '',
        domain,
        website: website || `https://${domain}`,
        employees: String(org.estimated_num_employees || snippet.estimated_num_employees || ''),
        industry: (org.industries || snippet.industries || [org.industry || snippet.industry || ''])[0] || '',
        companyKeywords,
        secondaryIndustries,
        emails: generateEmails(fullName, domain),
        selected: true,
        status: 'ready',
        results: [],
        old_results: []
    };
}

/**
 * Generates common email patterns.
 */
function generateEmails(fullName, domain) {
    if (!fullName || !domain) return [];
    let cleanName = fullName.replace(/^(Dr\.|Mr\.|Mrs\.|Ms\.)\s+/i, '');
    const parts = cleanName.toLowerCase().split(/\s+/);

    if (parts.length < 2) {
        const single = parts[0].replace(/[^a-z0-9]/g, '');
        return [...new Set([`${single}@${domain}`, `info@${domain}`, `contact@${domain}`])];
    }

    const first = parts[0].replace(/[^a-z0-9]/g, '');
    const last = parts[parts.length - 1].replace(/[^a-z0-9]/g, '');

    return [...new Set([
        `${first}@${domain}`, `${last}@${domain}`, `${first}${last}@${domain}`,
        `${last}${first}@${domain}`, `${first}.${last}@${domain}`, `${last}.${first}@${domain}`,
        `${first}_${last}@${domain}`, `${first[0]}${last}@${domain}`
    ])];
}

if (typeof window !== 'undefined') {
    window.ApolloAPI = ApolloAPI;
    window.mapPersonToProfile = mapPersonToProfile;
    window.generateEmails = generateEmails;
}
