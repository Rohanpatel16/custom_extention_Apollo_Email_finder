# Apollo Extension: Scraping → API Migration Guide

> **For**: Extension developers migrating from DOM scraping to Apollo's internal API  
> **Skill Level**: Beginner-friendly — every concept explained from scratch  
> **Last Updated**: April 2026

---

## Table of Contents

1. [How the Extension Works TODAY (DOM Scraping)](#1-how-the-extension-works-today-dom-scraping)
2. [What's Wrong with DOM Scraping?](#2-whats-wrong-with-dom-scraping)
3. [How Apollo's Internal API Works](#3-how-apollos-internal-api-works)
4. [The Key API Endpoints You Need](#4-the-key-api-endpoints-you-need)
5. [Authentication — How to Make API Calls](#5-authentication--how-to-make-api-calls)
6. [Migration Plan: What Changes, What Stays](#6-migration-plan-what-changes-what-stays)
7. [Code Mapping: Old Scraping → New API](#7-code-mapping-old-scraping--new-api)
8. [Step-by-Step Implementation](#8-step-by-step-implementation)
9. [Handling Pagination the API Way](#9-handling-pagination-the-api-way)
10. [The Auto-Scrape Rewrite](#10-the-auto-scrape-rewrite)
11. [What You Get for FREE from the API](#11-what-you-get-for-free-from-the-api)
12. [Rate Limits & Safety](#12-rate-limits--safety)
13. [Manifest.json Changes](#13-manifestjson-changes)
14. [Gotchas & Pitfalls](#14-gotchas--pitfalls)
15. [Complete Code Examples](#15-complete-code-examples)
16. [Before vs After Comparison](#16-before-vs-after-comparison)

---

## 1. How the Extension Works TODAY (DOM Scraping)

Your extension currently works by **reading the HTML that Apollo renders in the browser**. Here's the simplified flow:

```
User opens Apollo → Extension injects content.js → Reads table rows from DOM → Extracts text
```

### Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ manifest.json                                               │
│   ├── background.js     → Handles Apify API calls           │
│   ├── content.js        → DOM scraping + sidebar UI         │
│   ├── storage.js        → chrome.storage.local wrapper      │
│   ├── turso.js          → Cloud sync to Turso DB            │
│   ├── sidebar.css       → Sidebar styles                    │
│   └── dashboard.html/js → CRM dashboard page                │
└─────────────────────────────────────────────────────────────┘
```

### What content.js Does Today (The Scraping Part)

Here are the specific functions that scrape the DOM:

| Function | What It Does | Lines |
|----------|-------------|-------|
| `extractProfiles()` | Finds all `[role="row"]` elements on Apollo's table and calls `parseProfileRow()` | L717-875 |
| `parseProfileRow()` | Reads individual cells using `querySelector`, `data-id`, `aria-colindex` to extract name, title, company, etc. | L883-996 |
| `getColumnIndexes()` | Dynamically figures out which column is "Name", "Title", "Employees" etc by scanning `[role="columnheader"]` elements | L666-715 |
| `getHighestEmployeeCount()` | Reads employee count cells to find the max value (for auto-scrape filter advancement) | L386-458 |
| `handleNextPage()` | Finds and clicks the physical "Next" button (`[aria-label="Next"]`) | L356-373 |
| `advanceEmployeeFilter()` | Modifies `window.location.hash` directly to change the employee range filter | L464-478 |
| `getCurrentMinFromUrl()` | Parses `window.location.hash` for `organizationNumEmployeesRanges[]=MIN,` | L483-487 |

**The Problem**: All of these rely on Apollo's **HTML structure**. If Apollo changes a CSS class, a `data-id`, or their table layout — **everything breaks**.

---

## 2. What's Wrong with DOM Scraping?

| Problem | Impact | How Often |
|---------|--------|-----------|
| **Apollo changes HTML classes** | `parseProfileRow()` can't find elements → returns `null` | Every few weeks |
| **Column order changes** | `getColumnIndexes()` maps wrong columns | When user customizes view |
| **Dynamic rendering** | Content loads after `content.js` runs → empty results | Varies |
| **Missing data** | Some fields (email, phone) aren't rendered in the HTML | Always |
| **Pagination fragility** | "Next" button selector changes → can't navigate | Medium |
| **Rate: 30 profiles/page** | You can only see what's on screen | Always |
| **Need the tab open** | Auto-scrape requires keeping the Apollo tab active + visible | Always |

### With the API, ALL of these go away.

---

## 3. How Apollo's Internal API Works

When you use Apollo's website, your browser makes `fetch()` calls to `https://app.apollo.io/api/v1/...`. These are the **same** API calls the website uses internally. Your extension can make these calls directly.

### The Magic: Cookie-Based Auth

Since your extension runs as a **content script on `app.apollo.io`**, it shares the user's authentication cookies automatically. Here's why this matters:

```
                       ┌─────────────────────┐
                       │  User is logged in   │
                       │  to Apollo in Chrome  │
                       └──────────┬──────────┘
                                  │
                     Cookies are stored for
                      app.apollo.io domain
                                  │
                    ┌─────────────┴─────────────┐
                    │                            │
              Apollo's own               YOUR extension's
              JavaScript makes           content.js can
              fetch() calls              also make fetch()
              to /api/v1/...             to /api/v1/...
                    │                            │
                    └─────────────┬─────────────┘
                                  │
                       Same cookies sent!
                       Same authentication!
                       Same permissions!
```

**Translation**: If the user is logged into Apollo, your extension can call Apollo's API **without any API keys or extra auth setup**. The browser handles it automatically.

---

## 4. The Key API Endpoints You Need

From the captured HAR session, here are the endpoints that replace your current scraping:

### 4.1 `POST /api/v1/mixed_people/search` — **THE MAIN ONE**

This replaces your entire `extractProfiles()` + `parseProfileRow()` + `getColumnIndexes()` flow.

**What it does**: Searches for people with filters and returns structured JSON — names, emails, titles, companies, LinkedIn URLs, phone numbers — everything.

**What you send** (request body):
```json
{
  "page": 1,
  "per_page": 30,
  "person_seniorities": ["owner", "founder", "c_suite"],
  "person_locations": ["India"],
  "organization_num_employees_ranges": ["3900,"],
  "organization_industry_tag_ids": ["5567cd4773696439b10b0000"],
  "q_organization_keyword_tags": ["staff"],
  "included_organization_keyword_fields": ["tags", "name"],
  "sort_ascending": true,
  "sort_by_field": "organization_estimated_number_employees",
  "display_mode": "explorer_mode",
  "per_page": 30,
  "context": "people-index-page",
  "finder_version": 2,
  "fields": [
    "contact.id", "contact.name", "contact.first_name", "contact.last_name",
    "contact.linkedin_url", "contact.title", "contact.email",
    "contact.email_status", "contact.phone_numbers",
    "contact.city", "contact.state", "contact.country",
    "contact.organization_name", "contact.organization_id",
    "account.estimated_num_employees", "account.domain",
    "account.industries", "account.website_url",
    "account.linkedin_url"
  ]
}
```

**What you get back** (response):
```json
{
  "pagination": {
    "page": 1,
    "per_page": 30,
    "total_entries": 389,
    "total_pages": 13
  },
  "people": [
    {
      "id": "54a48fbc7468692cf0780851",
      "name": "Dishant Kapadia",
      "first_name": "Dishant",
      "last_name": "Kapadia",
      "title": "Founder",
      "seniority": "founder",
      "linkedin_url": "http://www.linkedin.com/in/dishantkapadia",
      "email": "dishant@company.com",
      "email_status": "verified",
      "city": "Mumbai",
      "state": "Maharashtra",
      "country": "India",
      "phone_numbers": [
        { "raw_number": "+91 98765 43210", "type": "mobile" }
      ],
      "organization": {
        "name": "The Square Inc",
        "website_url": "https://thesquare.com",
        "estimated_num_employees": 4500,
        "industry": "Staffing & Recruiting",
        "linkedin_url": "https://linkedin.com/company/thesquare"
      }
    }
    // ... 29 more people
  ]
}
```

> [!IMPORTANT]
> **Look at what you get for FREE**: `email`, `email_status`, `phone_numbers`, `seniority`, `organization` with full details. Your current scraping CANNOT get `email` or `phone_numbers` because Apollo hides these in the DOM!

---

### 4.2 `POST /api/v1/mixed_people/search_metadata_mode` — Total Counts + Facets

**Replaces**: Reading the page count from the DOM.

**What you get**: `pipeline_total` (total matching people), `faceting` (breakdown by industry, employee count, etc.)

```json
{
  "pipeline_total": 389,
  "faceting": {
    "num_employees_facets": [...],
    "linkedin_industry_facets": [...]
  }
}
```

---

### 4.3 `POST /api/v1/organizations/load_snippets` — Org Details

**Replaces**: Reading employee count, industry, and address from table cells.

**What you send**: Organization IDs from the search results.
```json
{ "ids": ["57c4b974a6da98370bc96d12", "..."] }
```

**What you get**: Full company details including `estimated_num_employees`, `industry`, `city`, `country`, `revenue`.

---

### 4.4 `GET /api/v1/auth/check` — Session Validation

**Use this** at startup to confirm the user is logged in and get their team/credit info.

```json
// Response includes:
{
  "is_logged_in": true,
  "bootstrapped_data": {
    "current_user_id": "...",
    "teams": [{
      "num_credits": 100,
      "api_limit_hash": { "day": 600, "hour": 200, "minute": 50 }
    }]
  }
}
```

---

## 5. Authentication — How to Make API Calls

### The CSRF Token

Apollo uses CSRF (Cross-Site Request Forgery) protection. Every POST request needs a `X-CSRF-TOKEN` header. Here's how to get it:

```javascript
// Method 1: Read from cookie
function getCsrfToken() {
  const match = document.cookie.match(/X-CSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// Method 2: Read from meta tag (Apollo puts it there too)
function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.content : null;
}
```

### Making an API Call from content.js

```javascript
async function apolloApiCall(endpoint, method = 'GET', body = null) {
  const csrfToken = getCsrfToken();
  
  const options = {
    method: method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',  // ← THIS IS THE KEY! Sends cookies automatically
  };

  // Add CSRF token for POST/PUT/DELETE requests
  if (csrfToken && method !== 'GET') {
    options.headers['X-CSRF-TOKEN'] = csrfToken;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`https://app.apollo.io${endpoint}`, options);
  
  if (!response.ok) {
    throw new Error(`Apollo API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
```

> [!CAUTION]
> **Critical**: You MUST use `credentials: 'include'` in your `fetch()` call. Without this, the browser won't send the session cookies and Apollo will reject your request with a 401.

---

## 6. Migration Plan: What Changes, What Stays

### ✅ Files That STAY THE SAME (No Changes)

| File | Reason |
|------|--------|
| `storage.js` | Data storage logic is independent of how data is collected |
| `turso.js` | Cloud sync is independent of data source |
| `dashboard.html` | CRM dashboard displays stored data — doesn't care where it came from |
| `dashboard.js` | Same as above |
| `dashboard.css` | Styles unchanged |
| `sidebar.css` | Styles unchanged |
| `background.js` | Apify verification calls still needed (API gives `email_status` but not full email verification) |

### 🔄 Files That CHANGE

| File | What Changes |
|------|-------------|
| `content.js` | Major rewrite — replace DOM parsing with API calls |
| `manifest.json` | Minor — add Apollo API to `host_permissions` |

### What You're Replacing in content.js

```
REMOVE These Functions:              REPLACE With:
─────────────────────                ────────────
parseProfileRow()         →  API response already has structured data
getColumnIndexes()        →  Not needed — API returns named fields
getHighestEmployeeCount() →  Read from API response directly
handleNextPage()          →  Increment page number in API request body
advanceEmployeeFilter()   →  Change filter values in API request body
getCurrentMinFromUrl()    →  Track min in JS variable
getCurrentPageFromUrl()   →  Track page in JS variable
```

---

## 7. Code Mapping: Old Scraping → New API

### 7.1 Extracting Profiles (The Big One)

**OLD (DOM Scraping) — ~200 lines of fragile code:**
```javascript
// OLD: content.js L717-875
async function extractProfiles(isAuto) {
  const colMap = getColumnIndexes();           // Scan column headers
  const rows = document.querySelectorAll('[role="row"]'); // Find all rows
  rows.forEach(row => {
    const profile = parseProfileRow(row, colMap); // Parse each row
    // ... dedup, save, etc.
  });
}

function parseProfileRow(row, colMap) {
  const nameEl = row.querySelector('[data-testid="contact-name-cell"] a');
  // ... 100+ lines of querySelector chains that break when Apollo updates
}
```

**NEW (API) — ~30 lines of reliable code:**
```javascript
async function extractProfiles(isAuto) {
  const data = await apolloApiCall('/api/v1/mixed_people/search', 'POST', {
    page: state.currentPage,
    per_page: 30,
    // Use same filters the user has set in the UI:
    ...state.currentFilters,
    fields: PEOPLE_FIELDS,
  });

  const newProfiles = [];
  
  for (const person of data.people) {
    const profile = {
      id: person.id,                              // Real Apollo ID
      name: person.name,                          // Guaranteed field
      title: person.title || '',
      linkedin: person.linkedin_url || '',
      company: person.organization?.name || '',
      companyLinkedin: person.organization?.linkedin_url || '',
      domain: extractDomain(person.organization?.website_url),
      website: person.organization?.website_url || '',
      employees: String(person.organization?.estimated_num_employees || ''),
      industry: person.organization?.industry || '',
      email: person.email || '',                  // FREE from API!
      emailStatus: person.email_status || '',     // FREE from API!
      phoneNumbers: person.phone_numbers || [],   // FREE from API!
      city: person.city || '',
      state: person.state || '',
      country: person.country || '',
      seniority: person.seniority || '',
      location: [person.city, person.state, person.country].filter(Boolean).join(', '),
      emails: generateEmails(person.name, extractDomain(person.organization?.website_url)),
      selected: true,
      status: 'ready',
      results: []
    };

    newProfiles.push(profile);
  }

  // Save pagination info
  state.totalPages = data.pagination.total_pages;
  state.totalEntries = data.pagination.total_entries;

  // ... dedup + save (same logic as before)
}
```

### 7.2 Pagination

**OLD (DOM clicking):**
```javascript
// OLD: Find and physically CLICK a button
const nextBtn = document.querySelector('[aria-label="Next"]');
nextBtn.click();
await new Promise(r => setTimeout(r, 3000)); // Wait for page to load
```

**NEW (API parameter):**
```javascript
// NEW: Just increment a number
state.currentPage++;
const data = await apolloApiCall('/api/v1/mixed_people/search', 'POST', {
  page: state.currentPage,
  per_page: 30,
  ...state.currentFilters
});
// Instant. No waiting. No DOM interaction.
```

### 7.3 Reading the Employee Filter

**OLD (URL hash parsing):**
```javascript
// OLD: Parse the browser hash
const hash = decodeURIComponent(window.location.hash);
const match = hash.match(/organizationNumEmployeesRanges\[\]=(\d+),/);
return match ? parseInt(match[1], 10) : 0;
```

**NEW (JavaScript variable):**
```javascript
// NEW: It's just a variable you control
state.currentFilters.organization_num_employees_ranges = ["3900,"];

// To update:
state.currentFilters.organization_num_employees_ranges = [`${newMin},`];
```

### 7.4 Getting the Highest Employee Count

**OLD (Scanning DOM cells — 72 lines!):**
```javascript
// OLD: content.js L386-458
function getHighestEmployeeCount() {
  const counts = [];
  // Strategy 1: Try data-id
  empDataIds.forEach(did => { document.querySelectorAll(...) });
  // Strategy 2: Find column header
  // Strategy 3: Brute-force all cells
  return Math.max(...counts);
}
```

**NEW (Read from API response — 3 lines!):**
```javascript
function getHighestEmployeeCount(people) {
  const counts = people.map(p => p.organization?.estimated_num_employees).filter(Boolean);
  return counts.length > 0 ? Math.max(...counts) : null;
}
```

---

## 8. Step-by-Step Implementation

### Step 1: Read Current Filters from the URL

When the user navigates in Apollo, the URL hash contains their current search filters. You need to parse these into API parameters:

```javascript
function parseApolloUrlFilters() {
  const hash = decodeURIComponent(window.location.hash);
  const params = new URLSearchParams(hash.split('?')[1] || '');
  
  const filters = {};
  
  // Person Seniorities
  const seniorities = params.getAll('personSeniorities[]');
  if (seniorities.length) filters.person_seniorities = seniorities;
  
  // Person Locations
  const locations = params.getAll('personLocations[]');
  if (locations.length) filters.person_locations = locations;
  
  // Employee Ranges
  const empRanges = params.getAll('organizationNumEmployeesRanges[]');
  if (empRanges.length) filters.organization_num_employees_ranges = empRanges;
  
  // Industry Tags
  const industries = params.getAll('organizationIndustryTagIds[]');
  if (industries.length) filters.organization_industry_tag_ids = industries;
  
  // Keywords
  const keywords = params.getAll('qOrganizationKeywordTags[]');
  if (keywords.length) filters.q_organization_keyword_tags = keywords;
  
  // Sort
  filters.sort_ascending = params.get('sortAscending') === 'true';
  filters.sort_by_field = params.get('sortByField') || 'organization_estimated_number_employees';
  
  // Page
  filters.page = parseInt(params.get('page') || '1', 10);
  
  return filters;
}
```

### Step 2: Create the API Wrapper

```javascript
// ─── Apollo API Module ──────────────────────────────────────────
const ApolloAPI = {
  // Fields we want from the API (same ones Apollo's UI requests)
  PEOPLE_FIELDS: [
    "contact.id", "contact.name", "contact.first_name", "contact.last_name",
    "contact.linkedin_url", "contact.twitter_url", "contact.facebook_url",
    "contact.title", "contact.email", "contact.email_status",
    "contact.email_domain_catchall", "contact.phone_numbers",
    "contact.city", "contact.state", "contact.country",
    "contact.organization_name", "contact.organization_id",
    "account.estimated_num_employees", "account.domain",
    "account.industries", "account.website_url",
    "account.linkedin_url", "account.twitter_url"
  ],

  getCsrfToken() {
    // Try cookie first
    const match = document.cookie.match(/X-CSRF-TOKEN=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
    // Try meta tag
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.content : null;
  },

  async call(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const csrf = this.getCsrfToken();
    if (csrf && method !== 'GET') headers['X-CSRF-TOKEN'] = csrf;

    const opts = { method, headers, credentials: 'include' };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`https://app.apollo.io${endpoint}`, opts);
    if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
    return res.json();
  },

  async checkSession() {
    const data = await this.call('/api/v1/auth/check?timezone_offset=-330');
    return {
      isLoggedIn: data.is_logged_in,
      userId: data.bootstrapped_data?.current_user_id,
      teamId: data.bootstrapped_data?.current_team_id,
      credits: data.bootstrapped_data?.teams?.[0]?.num_credits,
      rateLimits: data.bootstrapped_data?.teams?.[0]?.api_limit_hash
    };
  },

  async searchPeople(filters = {}, page = 1, perPage = 30) {
    return this.call('/api/v1/mixed_people/search', 'POST', {
      page,
      per_page: perPage,
      display_mode: 'explorer_mode',
      context: 'people-index-page',
      finder_version: 2,
      show_suggestions: false,
      num_fetch_result: 1,
      fields: this.PEOPLE_FIELDS,
      typed_custom_fields: [],
      cacheKey: Date.now(),
      ...filters
    });
  },

  async getSearchMetadata(filters = {}) {
    return this.call('/api/v1/mixed_people/search_metadata_mode', 'POST', {
      display_mode: 'explorer_mode',
      context: 'people-index-page',
      per_page: 30,
      cacheKey: Date.now(),
      ...filters
    });
  },

  async loadOrganizations(ids) {
    return this.call('/api/v1/organizations/load_snippets', 'POST', {
      ids,
      cacheKey: Date.now()
    });
  }
};
```

### Step 3: Replace extractProfiles()

```javascript
async function extractProfiles(isAuto = false) {
  try {
    // 1. Read filters from the current Apollo URL
    const filters = parseApolloUrlFilters();
    
    // 2. Call the API
    const data = await ApolloAPI.searchPeople(filters, filters.page);
    
    if (!data.people || data.people.length === 0) {
      showToast("No results from API", "neutral");
      return 0;
    }

    // 3. Convert API people → our profile format
    const newProfiles = [];
    const globalProfiles = window.StorageWrapper
      ? await StorageWrapper.getAllProfiles()
      : [];

    // Build dedup maps (same as your current code)
    const linkedinMap = new Map();
    const nameMap = new Map();
    globalProfiles.forEach(p => {
      if (p.linkedin) linkedinMap.set(p.linkedin.trim().toLowerCase(), p);
      const nameKey = (p.name || '').trim().toLowerCase();
      if (nameKey && !nameMap.has(nameKey)) nameMap.set(nameKey, p);
    });

    for (const person of data.people) {
      const domain = extractDomain(person.organization?.website_url);
      if (!domain) continue; // Same strict check as before

      const profile = {
        id: person.id,  // Use Apollo's real ID instead of random
        name: person.name || `${person.first_name} ${person.last_name}`,
        title: person.title || '',
        location: [person.city, person.state, person.country].filter(Boolean).join(', '),
        linkedin: person.linkedin_url || '',
        company: person.organization_name || person.organization?.name || '',
        companyLinkedin: person.organization?.linkedin_url || '',
        domain: domain,
        website: person.organization?.website_url || '',
        employees: String(person.organization?.estimated_num_employees || ''),
        industry: person.organization?.industry || '',
        // NEW DATA you couldn't get before:
        apolloEmail: person.email || '',
        apolloEmailStatus: person.email_status || '',
        phoneNumbers: person.phone_numbers || [],
        seniority: person.seniority || '',
        // Your existing fields:
        emails: generateEmails(person.name, domain),
        selected: true,
        status: 'ready',
        results: [],
        old_results: []
      };

      // Dedup check (same logic as your current code)
      const inSession = state.profiles.some(p =>
        (p.linkedin && p.linkedin === profile.linkedin) ||
        (p.name === profile.name && p.domain === profile.domain)
      );
      if (inSession) continue;

      // Check CRM (same logic as before)
      let existing = null;
      if (profile.linkedin) {
        existing = linkedinMap.get(profile.linkedin.trim().toLowerCase());
      }
      if (!existing) {
        const nameKey = (profile.name || '').trim().toLowerCase();
        existing = nameMap.get(nameKey);
      }

      if (existing) {
        // Update existing (same merge logic as before)
        const domainChanged = existing.domain && profile.domain &&
          existing.domain.toLowerCase() !== profile.domain.toLowerCase();
        profile.id = existing.id;
        profile.status = domainChanged ? 'ready' : existing.status;
        profile.results = domainChanged ? [] : (existing.results || []);
      }

      newProfiles.push(profile);
    }

    // Save to storage (same as before)
    if (newProfiles.length > 0 && window.StorageWrapper) {
      state.profiles = [...state.profiles, ...newProfiles];
      await StorageWrapper.saveSidebarSession(state.profiles);
    }

    // Update pagination state
    state.totalPages = data.pagination.total_pages;
    state.totalEntries = data.pagination.total_entries;
    state.currentPage = data.pagination.page;

    // Update UI
    if (newProfiles.length > 0) {
      document.getElementById('av-results-area').classList.remove('av-hidden');
      showToast(`Extracted ${newProfiles.length} profiles via API`, "success");
      renderList();
    }

    return newProfiles.length;
  } catch (err) {
    console.error('[API] Extract failed:', err);
    showToast(`API Error: ${err.message}`, "error");
    return 0;
  }
}

function extractDomain(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch { return ''; }
}
```

---

## 9. Handling Pagination the API Way

### Old Way: Clicking Buttons + Waiting

```javascript
// OLD: Physical button clicking
const nextBtn = document.querySelector('[aria-label="Next"]');
nextBtn.click();
await new Promise(r => setTimeout(r, 3000)); // Hope it loads in time
```

### New Way: Just Change the Page Number

```javascript
// NEW: Instant pagination
async function handleNextPage() {
  state.currentPage++;
  
  if (state.currentPage > state.totalPages) {
    showToast("No more pages", "neutral");
    state.currentPage = state.totalPages;
    return;
  }

  const filters = parseApolloUrlFilters();
  const data = await ApolloAPI.searchPeople(filters, state.currentPage);
  
  // Process results...
  processSearchResults(data);
}
```

**You can even fetch ALL pages in a loop:**
```javascript
async function fetchAllPages(filters) {
  let page = 1;
  let allPeople = [];
  
  while (true) {
    const data = await ApolloAPI.searchPeople(filters, page);
    allPeople.push(...data.people);
    
    if (page >= data.pagination.total_pages) break;
    page++;
    
    // Respect rate limits: 50 req/min = 1 request per 1.2 seconds
    await new Promise(r => setTimeout(r, 1500));
  }
  
  return allPeople;
}
```

---

## 10. The Auto-Scrape Rewrite

Your current auto-scrape (`runAutoScrape()` at L513-663) is **200+ lines** of complex DOM manipulation. With the API, it becomes **much simpler**:

```javascript
async function runAutoScrape() {
  const filters = parseApolloUrlFilters();
  
  // Validate sort order (same check as before)
  if (!filters.sort_ascending || filters.sort_by_field !== 'organization_estimated_number_employees') {
    showToast('Auto-Scrape requires: Sort by Employees, Ascending ↑', 'error');
    return;
  }

  state.autoScraping = true;
  let currentMin = parseInt((filters.organization_num_employees_ranges?.[0] || '0').replace(',', ''));

  while (state.autoScraping) {
    // Update filter with current min
    const searchFilters = {
      ...filters,
      organization_num_employees_ranges: [`${currentMin},`]
    };

    let allPeopleInBatch = [];

    // Collect up to 5 pages
    for (let page = 1; page <= 5 && state.autoScraping; page++) {
      setAutoScrapeStatus(`[API] Page ${page}/5 (min employees: ${currentMin})`);
      
      const data = await ApolloAPI.searchPeople(searchFilters, page);
      
      if (!data.people || data.people.length === 0) break;
      allPeopleInBatch.push(...data.people);

      if (page >= data.pagination.total_pages) break;
      
      // Rate limit safety
      await new Promise(r => setTimeout(r, 1500));
    }

    if (allPeopleInBatch.length === 0) {
      showToast('Auto-Scrape complete — no more results', 'success');
      break;
    }

    // Process all collected people
    // (Convert to profiles, dedup, save — same as extractProfiles)
    
    // Find the max employee count for filter advancement
    const maxCount = Math.max(
      ...allPeopleInBatch
        .map(p => p.organization?.estimated_num_employees)
        .filter(Boolean)
    );

    // Verify batch
    if (state.autoScrapeMode === 'batch') {
      await verifyProfiles(false);
    }

    // Advance filter
    if (maxCount > currentMin) {
      currentMin = maxCount;
      setAutoScrapeStatus(`Advancing: min employees → ${currentMin}`);
      await new Promise(r => setTimeout(r, 1000));
    } else {
      showToast('Auto-Scrape complete', 'success');
      break;
    }
  }

  state.autoScraping = false;
}
```

> [!TIP]
> **Notice**: No more `clickNext()`, no more `advanceEmployeeFilter()` modifying URLs, no more `await wait(3500)` waiting for the page to render. It's all instant.

---

## 11. What You Get for FREE from the API (and What's LOCKED)

> [!CAUTION]
> ### ⚠️ CRITICAL CORRECTION: Emails Are NOT Free!
> 
> After analyzing the **actual HAR data**, I discovered that **ALL 312 people** across 11 search calls had their email set to the placeholder:
> ```
> email_not_unlocked@domain.com
> ```
> Apollo **gates email access behind credits**. The `email` field is useless until you spend 1 credit to "unlock" it. This applies even when `email_status` is `verified` or `extrapolated`.

### What's Actually Free vs Locked (Proven from HAR Data)

| Field | Free? | Value You Get | Notes |
|-------|:-----:|---------------|-------|
| `name` | ✅ | `"Dishant Kapadia"` | Always available |
| `first_name`, `last_name` | ✅ | `"Dishant"`, `"Kapadia"` | Split fields |
| `title` | ✅ | `"Founder"` | Job title |
| `seniority` | ✅ | `"founder"` | Seniority level |
| `headline` | ✅ | `"Entrepreneur / Founder - The Square Inc"` | Full headline |
| `linkedin_url` | ✅ | `"http://www.linkedin.com/in/..."` | **Direct field — huge improvement!** |
| `twitter_url` | ✅ | URL or `null` | |
| `facebook_url` | ✅ | URL or `null` | |
| `city` | ✅ | `"Mumbai"` | |
| `state` | ✅ | `"Maharashtra"` | |
| `country` | ✅ | `"India"` | |
| `time_zone` | ✅ | `"Asia/Kolkata"` | |
| `organization_id` | ✅ | `"57c4b974..."` | |
| `organization.name` | ✅ | `"Square"` | Embedded org object |
| `organization.website_url` | ✅ | `"http://www.squareup.com"` | **Get domain directly!** |
| `organization.estimated_num_employees` | ✅ | `5800` | Exact number |
| `organization.industries` | ✅ | `["Information Technology"]` | |
| `organization.linkedin_url` | ✅ | URL | Company LinkedIn |
| `organization.phone` | ✅ | `"+1 415-375-3176"` | **Company phone** |
| `organization.founded_year` | ✅ | `2009` | |
| `organization.logo_url` | ✅ | S3 URL | |
| `organization.headcount_growth` | ✅ | `0.0087` (6mo) / `-0.033` (12mo) | **Growth metrics!** |
| `email_status` | ✅ | `"verified"` / `"extrapolated"` / `"unavailable"` | Status is free, email is NOT |
| `email_domain_catchall` | ✅ | `true` / `false` | Whether domain is catch-all |
| `intent_strength` | ✅ | `"none"` / `"low"` / `"high"` | Buyer intent |
| `departments` | ✅ | `[]` | |
| `contact_job_change_event` | ✅ | `null` or event object | Job change tracking |
| **`email`** | **🔒 LOCKED** | `"email_not_unlocked@domain.com"` | **Costs 1 credit to unlock** |
| **`phone_numbers`** | **🔒 LOCKED** | `[]` (empty array) | **Costs 8 credits to unlock** |

### Email Status Breakdown (from captured data)

| `email_status` | Count | What It Means | Email Value |
|----------------|:-----:|---------------|-------------|
| `unavailable` | 157 | Apollo couldn't find an email | `email_not_unlocked@domain.com` |
| `verified` | 130 | Apollo found & verified an email | `email_not_unlocked@domain.com` (still locked!) |
| `extrapolated` | 25 | Apollo guessed the pattern | `email_not_unlocked@domain.com` (still locked!) |

> [!IMPORTANT]
> **Key Insight**: `email_status` tells you WHETHER Apollo has an email, not WHAT it is. Even `verified` status shows the placeholder until you spend a credit. However, `email_status` is still incredibly valuable — it tells you:
> - `verified` → Apollo has a verified email. You could unlock it OR use your own `generateEmails()` knowing the pattern exists.
> - `extrapolated` → Apollo guessed the email. Lower confidence. Your permutation approach might find it.
> - `unavailable` → Apollo couldn't find anything. Your `generateEmails()` + Apify is the only option.

### Impact on Your Verification Workflow

**Your current flow still works!** The API does NOT replace Apify verification. Here's the updated flow:

```
                    API Search
                        │
                  ┌─────┴─────┐
                  │  For each   │
                  │  person:    │
                  └─────┬─────┘
                        │
              ┌─────────┴──────────┐
              │                    │
         Has website_url?     No website_url?
              │                    │
         Extract domain      ⚠️ Skip (same as
              │              current behavior)
              │
    generateEmails(name, domain)
              │
    Send to Apify for verification
              │
         Results back ✅
```

**What's BETTER with the API approach**:
- `website_url` comes directly (99.4% fill rate!) — no more fragile link extraction
- `linkedin_url` comes clean — no more querySelector chains
- `email_status` helps prioritize which leads to verify first
- `estimated_num_employees` is an exact number — no more 3-strategy DOM hunting

---

## 12. Rate Limits & Safety

### Are There Rate Limits?

The short answer: **Not for web UI calls (that we observed).**

The captured HAR session shows **72 API calls in ~16 minutes** with **zero throttling**:
- First call: `2026-04-20T17:15:10` 
- Last call: `2026-04-20T17:31:01`
- No `429` responses, no rate-limit response headers, no blocks

Apollo's `/auth/check` response does include an `api_limit_hash` field:
```json
"api_limit_hash": { "day": 600, "hour": 200, "minute": 50 }
```

**However**, this is stored under `teams[0]` and appears to be for Apollo's **official public REST API** (the one that requires an API key at `https://api.apollo.io/api/v1/...`) — NOT for the internal web UI calls your extension makes via browser cookies.

> [!NOTE]
> **Source**: `api_limit_hash` comes directly from the `/auth/check` response → `bootstrapped_data.teams[0].api_limit_hash`. The HAR session proves 72 calls in 16 minutes went through without any rate limiting.

### Two Different APIs — Important Distinction

| | Apollo's Official REST API | Internal Web UI API (What We Use) |
|---|---|---|
| **URL** | `https://api.apollo.io/api/v1/...` | `https://app.apollo.io/api/v1/...` |
| **Auth** | API Key (header) | Browser cookies (session) |
| **Rate Limits** | `api_limit_hash` enforced (50/min, 200/hr, 600/day) | **Not observed** — no throttling in 72 calls |
| **Docs** | Officially documented | Undocumented (reverse-engineered from HAR) |
| **Cost** | Has its own credit system | Uses same credits as the web UI |

### Should You Still Be Careful?

**Yes.** Even though we saw no rate limiting in this session, here's why you should be cautious:

1. **Apollo might silently flag accounts** that make unusual request patterns
2. **Future updates** could add rate limiting at any time
3. **Very high volume** (hundreds of requests/minute) could trigger detection
4. Your extension is making calls **as** the user — if Apollo blocks the account, the user loses their Apollo access

### Recommended Safety Approach

Instead of a hard rate limiter, use a **sensible delay** between bulk operations:

```javascript
// For auto-scrape: add a short delay between pages
const DELAY_BETWEEN_PAGES = 2000; // 2 seconds — mimics human browsing speed

// For bulk operations (fetching all pages):
const DELAY_BETWEEN_REQUESTS = 1500; // 1.5 seconds

// Even the current DOM scraping already waits 2.5-3.5 seconds per page,
// so matching that cadence with API calls is a safe bet.
```

### Credit Costs (These ARE enforced)

Every time Apollo **reveals** an email or phone number to you (that wasn't already in your contacts), it costs credits:
- **1 credit** per lead (email reveal)
- **8 credits** per direct dial (phone reveal)
- Free tier: **100 credits/month**

> [!WARNING]
> **Critical**: The API uses the SAME credits as the web UI. If you burn through all credits via API, the user won't be able to click "Access Email" on the website either. Build in credit tracking!

### Sensible Request Pacer (Optional)

```javascript
// Simple pacer — not a hard limiter, just mimics human pacing
const Pacer = {
  lastRequest: 0,
  minGap: 1500, // ms between requests
  
  async pace() {
    const now = Date.now();
    const elapsed = now - this.lastRequest;
    if (elapsed < this.minGap) {
      await new Promise(r => setTimeout(r, this.minGap - elapsed));
    }
    this.lastRequest = Date.now();
  }
};

// Use it in your API wrapper:
async call(endpoint, method, body) {
  await Pacer.pace();  // ← Add this for bulk operations
  // ... rest of fetch call
}
```

---

## 13. Manifest.json Changes

Your current manifest:
```json
{
  "host_permissions": [
    "https://api.apify.com/*",
    "https://*.turso.io/*"
  ]
}
```

**You do NOT need to add `https://app.apollo.io/*`** to `host_permissions` because your content script already runs on that domain (it's in `content_scripts.matches`). Fetch calls from content scripts inherit the page's origin.

However, if you want to make API calls from `background.js` (service worker), you would need to add it:

```json
{
  "host_permissions": [
    "https://api.apify.com/*",
    "https://*.turso.io/*",
    "https://app.apollo.io/*"
  ]
}
```

> [!NOTE]
> **For the background.js approach**: Cookie access from the service worker requires the `cookies` permission AND the `host_permissions` entry. For now, keep all API calls in `content.js` — it's simpler since cookies are automatic.

---

## 14. Gotchas & Pitfalls

### 1. CSRF Token May Rotate

The CSRF token can change during a session. Always read it fresh before each POST request — don't cache it.

### 2. Apollo May Block Rapid Requests

If you send too many requests too fast, Apollo may return `429 Too Many Requests` or even temporarily lock the account. Always use the rate limiter.

### 3. ⚠️ `email` Field Is ALWAYS a Placeholder (Until Unlocked)

This was the biggest surprise from the HAR analysis. Every single person across all 312 results had:
```json
"email": "email_not_unlocked@domain.com"
```

**You MUST filter this out**:
```javascript
function getRealEmail(person) {
  const email = person.email || '';
  if (email.includes('email_not_unlocked')) return null;
  return email;
}
```

### 4. The API Returns the Same Data as the UI

The API enforces the same plan restrictions. Free tier users:
- Can only view up to ~10,000 results per search (`partial_results_limit: 10000`)
- Can't access some filters (advanced filters need Basic+ plan)
- Have limited exports

### 5. `organization` Object May Be Nested OR Flat

Some search results have embedded `organization` objects, others have flat `organization_name` fields. Handle both:

```javascript
const company = person.organization?.name || person.organization_name || '';
const website = person.organization?.website_url || '';
```

### 6. Don't Forget `cacheKey`

Apollo expects a `cacheKey` parameter (timestamp) on most requests. Without it, you might get stale cached responses:

```javascript
body.cacheKey = Date.now();
```

### 7. The User Must Be Logged In

Your extension should check `is_logged_in` before making any API calls:

```javascript
async function ensureLoggedIn() {
  try {
    const session = await ApolloAPI.checkSession();
    if (!session.isLoggedIn) {
      showToast("Please log into Apollo first", "error");
      return false;
    }
    return true;
  } catch (e) {
    showToast("Cannot reach Apollo — are you on the right page?", "error");
    return false;
  }
}
```

### 8. `organization_name` Can Be `null` (Use Embedded Org)

The top-level `organization_name` field was `null` for all 312 results in the HAR. The actual name lives inside the embedded `organization.name` object:
```javascript
// WRONG:
const name = person.organization_name;  // null!

// RIGHT:
const name = person.organization?.name || 'Unknown';
```

---

## 15. Complete Code Examples

### Example: Full Search + Extract in 1 Function

```javascript
/**
 * Searches Apollo API and returns structured profiles.
 * Drop-in replacement for the old extractProfiles().
 */
async function apiExtractProfiles(page = 1) {
  // 1. Ensure user is logged in
  if (!(await ensureLoggedIn())) return [];

  // 2. Parse filters from current URL
  const filters = parseApolloUrlFilters();

  // 3. Search via API
  const data = await ApolloAPI.searchPeople(filters, page);
  
  if (!data.people?.length) return [];

  // 4. Optionally load full org data
  const orgIds = [...new Set(data.people.map(p => p.organization_id).filter(Boolean))];
  let orgMap = {};
  if (orgIds.length > 0) {
    const orgData = await ApolloAPI.loadOrganizations(orgIds);
    orgMap = Object.fromEntries(orgData.organizations.map(o => [o.id, o]));
  }

  // 5. Convert to profile objects
  return data.people.map(person => {
    const org = orgMap[person.organization_id] || person.organization || {};
    const domain = extractDomain(org.website_url || '');
    
    // Check if email is real or placeholder
    const realEmail = (person.email && !person.email.includes('email_not_unlocked'))
      ? person.email : null;
    
    return {
      id: person.id,
      name: person.name,
      title: person.title || '',
      location: [person.city, person.state, person.country].filter(Boolean).join(', '),
      linkedin: person.linkedin_url || '',
      company: org.name || person.organization_name || '',
      companyLinkedin: org.linkedin_url || '',
      domain,
      website: org.website_url || '',
      employees: String(org.estimated_num_employees || ''),
      industry: (org.industries || [])[0] || '',
      apolloEmailStatus: person.email_status || '',
      seniority: person.seniority || '',
      headline: person.headline || '',
      companyPhone: org.phone || '',
      foundedYear: org.founded_year || '',
      headcountGrowth6mo: org.organization_headcount_six_month_growth || null,
      emails: realEmail
        ? [realEmail, ...generateEmails(person.name, domain)]
        : generateEmails(person.name, domain),
      selected: true,
      status: 'ready',  // Always 'ready' — we still need Apify to verify
      results: []
    };
  });
}
```

### Example: Get Total Results Count

```javascript
async function getTotalResults() {
  const filters = parseApolloUrlFilters();
  const meta = await ApolloAPI.getSearchMetadata(filters);
  console.log(`Total people matching filters: ${meta.pipeline_total}`);
  return meta.pipeline_total;
}
```

### Example: Smart Verification Priority

```javascript
/**
 * Prioritize which profiles to verify first based on email_status.
 * Verified → likely findable, verify first.
 * Extrapolated → might find with permutations, try next.
 * Unavailable → harder, try last.
 */
function sortByVerificationPriority(profiles) {
  const priority = { 'verified': 0, 'extrapolated': 1, 'unavailable': 2 };
  return profiles.sort((a, b) => 
    (priority[a.apolloEmailStatus] || 3) - (priority[b.apolloEmailStatus] || 3)
  );
}
```

---

## 16. Before vs After Comparison

### Lines of Code

| Component | Before (DOM) | After (API) | Reduction |
|-----------|:------------:|:-----------:|:---------:|
| `parseProfileRow()` | 115 lines | 0 (deleted) | -100% |
| `getColumnIndexes()` | 49 lines | 0 (deleted) | -100% |
| `getHighestEmployeeCount()` | 72 lines | 3 lines | -96% |
| `extractProfiles()` | 158 lines | ~60 lines | -62% |
| `handleNextPage()` | 18 lines | 8 lines | -56% |
| `advanceEmployeeFilter()` | 15 lines | 1 line | -93% |
| `getCurrentMinFromUrl()` | 5 lines | 0 (variable) | -100% |
| `runAutoScrape()` | 150 lines | ~60 lines | -60% |
| **New: ApolloAPI module** | 0 | ~80 lines | New |
| **New: Rate limiter** | 0 | ~15 lines | New |
| **TOTAL** | ~582 lines | ~227 lines | **-61%** |

### Reliability

| Metric | Before (DOM) | After (API) |
|--------|:------------:|:-----------:|
| Breaks when Apollo updates UI | Every ~2-4 weeks | Never |
| Works in background tab | ❌ No | ✅ Yes |
| Needs `setTimeout` waits | Yes (3-5 sec/page) | No |
| Gets email addresses | ❌ No | ⚠️ Only if unlocked |
| Gets phone numbers | ❌ No | ⚠️ Only if unlocked |
| Gets `email_status` | ❌ No | ✅ Yes (huge for prioritization) |
| Accurate pagination | ❌ Fragile | ✅ Exact |
| Speed (30 profiles) | ~5 seconds | ~0.5 seconds |

### Data Quality

| Field | Before | After |
|-------|--------|-------|
| Name | Sometimes missing due to DOM changes | Always present |
| Email | Never available (hidden in DOM) | Placeholder until unlocked — but `email_status` helps prioritize |
| Employee Count | 3 fallback strategies, often wrong | Exact number (e.g., `5800`) |
| Company Domain | Extracted from links (error prone) | Direct from `organization.website_url` (99.4% fill rate) |
| LinkedIn URL | Fragile querySelector chain | Direct field |
| Company Phone | Never available | Available via `organization.phone` |
| Headcount Growth | Never available | 6/12/24 month growth rates |

---

> [!TIP]
> **Start Small**: Don't rewrite everything at once. Begin by replacing `extractProfiles()` with the API version. Test it. Then replace `handleNextPage()`. Then `runAutoScrape()`. The storage layer and verification layer (Apify) stay the same throughout.

---

## Quick Reference Card

```
┌────────────────────────────────────────────────────────────────┐
│                    APOLLO API CHEAT SHEET                      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Base URL:     https://app.apollo.io/api/v1                    │
│  Auth:         Cookies (automatic in content.js)               │
│  CSRF:         X-CSRF-TOKEN header (read from cookie/meta)     │
│  Content-Type: application/json                                │
│  Rate Limit:   50/min, 200/hr, 600/day (free tier)             │
│                                                                │
│  SEARCH PEOPLE:                                                │
│    POST /mixed_people/search                                   │
│    Body: { page, per_page, fields, ...filters }                │
│    Returns: { people: [...], pagination: {...} }               │
│                                                                │
│  GET TOTALS:                                                   │
│    POST /mixed_people/search_metadata_mode                     │
│    Returns: { pipeline_total, faceting }                       │
│                                                                │
│  LOAD ORGS:                                                    │
│    POST /organizations/load_snippets                           │
│    Body: { ids: [...] }                                        │
│    Returns: { organizations: [...] }                           │
│                                                                │
│  CHECK SESSION:                                                │
│    GET /auth/check                                             │
│    Returns: { is_logged_in, bootstrapped_data }                │
│                                                                │
│  CREDITS:                                                      │
│    GET /teams/{teamId}/credit_usage_summary                    │
│    Returns: { team: { effective_num_lead_credits } }           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Appendix A: Exact Request Headers (from HAR capture)

These are the **real headers** Apollo's UI sends on a POST search. Your `fetch()` call should mimic these:

```
accept: */*
content-type: application/json
origin: https://app.apollo.io
referer: https://app.apollo.io/
x-csrf-token: KN_jzgFI6NiMKN2XOiSgYgy8s-ARh9O...  ← CRITICAL for POST
x-accept-language: en
x-referer-host: app.apollo.io
x-referer-path: /people
```

**Headers the browser adds automatically** (you don't need to set these):
```
user-agent: Mozilla/5.0 ...
sec-ch-ua: "Google Chrome";v="147"...
sec-fetch-dest: empty
sec-fetch-mode: cors
sec-fetch-site: same-origin
```

### Minimum Required Headers for Your API Calls

```javascript
const headers = {
  'Content-Type': 'application/json',
  'X-CSRF-TOKEN': getCsrfToken(),          // Required for POST
  // The rest is optional but adds safety:
  'X-Referer-Host': 'app.apollo.io',       // Helps avoid detection
  'X-Referer-Path': '/people',             // Match the page context
};
```

---

## Appendix B: All 54 Fields You Can Request

These are the exact fields Apollo's UI requests. You can use any subset:

### Person Fields (contact.*)
| # | Field | Returns |
|---|-------|---------|
| 1 | `contact.id` | Apollo person ID |
| 2 | `contact.name` | Full name |
| 3 | `contact.first_name` | First name |
| 4 | `contact.last_name` | Last name |
| 5 | `contact.title` | Job title |
| 6 | `contact.linkedin_url` | LinkedIn URL |
| 7 | `contact.twitter_url` | Twitter URL |
| 8 | `contact.facebook_url` | Facebook URL |
| 9 | `contact.city` | City |
| 10 | `contact.state` | State/Province |
| 11 | `contact.country` | Country |
| 12 | `contact.email` | Email (placeholder until unlocked) |
| 13 | `contact.email_status` | `verified` / `extrapolated` / `unavailable` |
| 14 | `contact.email_true_status` | True verification status |
| 15 | `contact.email_domain_catchall` | Boolean — is domain catch-all? |
| 16 | `contact.email_status_unavailable_reason` | Why email not found |
| 17 | `contact.email_needs_tickling` | Whether to retry verification |
| 18 | `contact.free_domain` | Boolean — is it gmail/yahoo etc? |
| 19 | `contact.failed_email_verify_request` | Previous verification failure |
| 20 | `contact.phone_numbers` | Phone array (empty until unlocked) |
| 21 | `contact.sanitized_phone` | Clean phone format |
| 22 | `contact.direct_dial_status` | Phone unlock status |
| 23 | `contact.direct_dial_enrichment_failed_at` | Phone enrichment failure |
| 24 | `contact.contact_emails` | Additional emails |
| 25 | `contact.organization_id` | Org ID for joining org data |
| 26 | `contact.organization_name` | Org name (often `null` — use org object) |
| 27 | `contact.intent_strength` | Buyer intent level |
| 28 | `contact.original_source` | Where the contact was sourced |
| 29 | `contact.next_contact_id` | Updated contact ID if merged |
| 30 | `contact.contact_job_change_event` | Job change signals |
| 31 | `contact.call_opted_out` | Do-not-call flag |
| 32 | `contact.label_ids` | Custom label IDs |
| 33 | `contact.emailer_campaign_ids` | Sequence IDs |
| 34 | `contact.flagged_datum` | Quality flags |
| 35 | `contact.crm_record_url` | CRM integration link |

### Account Fields (account.* and contact.account.*)
| # | Field | Returns |
|---|-------|---------|
| 36 | `contact.account` | Embedded account object |
| 37 | `contact.account.id` | Account ID |
| 38 | `contact.account.organization_id` | Org ID |
| 39 | `contact.account.domain` | Company domain |
| 40 | `contact.account.logo_url` | Company logo URL |
| 41 | `contact.account.name` | Company name |
| 42 | `contact.account.facebook_url` | Facebook URL |
| 43 | `contact.account.linkedin_url` | LinkedIn URL |
| 44 | `contact.account.twitter_url` | Twitter URL |
| 45 | `contact.account.crm_record_url` | CRM link |
| 46 | `contact.account.website_url` | Website URL |
| 47 | `account.linkedin_url` | Account-level LinkedIn |
| 48 | `account.twitter_url` | Account-level Twitter |
| 49 | `account.facebook_url` | Account-level Facebook |
| 50 | `account.website_url` | Account-level website |
| 51 | `account.crm_record_url` | Account CRM link |
| 52 | `account.domain` | Domain |
| 53 | `account.industries` | Industries array |
| 54 | `account.estimated_num_employees` | Headcount |

### Recommended Minimal Field Set (for your extension)

Only request what you need — smaller responses = faster:
```javascript
const MINIMAL_FIELDS = [
  "contact.id", "contact.name", "contact.first_name", "contact.last_name",
  "contact.title", "contact.linkedin_url",
  "contact.email", "contact.email_status",
  "contact.city", "contact.state", "contact.country",
  "contact.organization_id",
  "account.estimated_num_employees", "account.website_url", "account.industries"
];
```

---

## Appendix C: Filter Evolution Pattern

In the captured session, the user progressively added filters. Each filter reduced the result count:

```
Call  1: 389 results ← Base filters (seniority + location + employees + industry + keyword)
Call  3: 172 results ← Added: person_days_in_current_title_range (max 365 days)
Call  4: 105 results ← Added: person_total_yoe_range (min 10 years)
Call  5:  83 results ← Added: q_not_organization_search_list_id (exclude companies)
Call  6:  41 results ← Added: q_organization_search_list_id (include only specific companies)
Call 11:  42 results ← Page 2 of the final filtered set
```

### How Organization Search Lists Work

Apollo lets you create named lists of companies. The flow is:

```javascript
// 1. Save a company domain as a list
const result = await ApolloAPI.call('/api/v1/organization_search_lists/save_query', 'POST', {
  query: "http://www.mrisoftware.com/",
  cacheKey: Date.now()
});
const listId = result.listId;  // "69e662784645650015f46355"

// 2. Use the list in search filters
// INCLUDE people from these companies:
filters.q_organization_search_list_id = [listId];

// EXCLUDE people from these companies:
filters.q_not_organization_search_list_id = [listId];
```

This is powerful for your **auto-scrape** — you can exclude companies you've already scraped!

---

## Appendix D: Organization Object (Embedded in Person)

Every person in search results includes an embedded `organization` object with **18 fields**:

```json
{
  "id": "57c4b974a6da98370bc96d12",
  "logo_url": "https://zenprospect-production.s3.amazonaws.com/...",
  "name": "Square",
  "facebook_url": "https://www.facebook.com/square",
  "linkedin_url": "http://www.linkedin.com/company/joinsquare",
  "twitter_url": "https://twitter.com/Square",
  "website_url": "http://www.squareup.com",
  "industries": ["Internet"],
  "estimated_num_employees": 5800,
  "phone": "+1 415-375-3176",
  "sanitized_phone": "+14153753176",
  "label_ids": [],
  "founded_year": 2009,
  "languages": ["English"],
  "engagement_graph": null,
  "organization_headcount_six_month_growth": 0.0088,
  "organization_headcount_twelve_month_growth": -0.0333,
  "organization_headcount_twenty_four_month_growth": -0.0719
}
```

### Bonus Data You Can Show in Your CRM Dashboard

With this data, you can add new columns to your dashboard:
- **Company Phone** — direct company number
- **Founded Year** — company age
- **Headcount Growth** — is the company growing or shrinking?
- **Company Logo** — `logo_url` for rich UI display

---

## Appendix E: Intercepting Apollo's Own Requests (Advanced)

Instead of making your OWN API calls, you can **hijack** the ones Apollo's UI is already making. This is zero-risk because it doesn't add any extra requests:

```javascript
// Intercept all fetch() calls on the page
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const response = await originalFetch.apply(this, args);
  
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
  
  // Intercept people search responses
  if (url?.includes('/api/v1/mixed_people/search') && !url?.includes('metadata')) {
    // Clone the response so Apollo's UI still gets it
    const clone = response.clone();
    const data = await clone.json();
    
    if (data.people?.length > 0) {
      console.log(`[Extension] Intercepted ${data.people.length} people from Apollo's own search`);
      // Process the data — same as extractProfiles() but FREE
      processInterceptedPeople(data.people, data.pagination);
    }
  }
  
  return response;
};
```

**Advantages**:
- Zero extra API calls = zero rate limit impact
- Zero risk of detection
- Piggybacks on what Apollo is already doing
- Updates in real-time as the user browses

**Disadvantages**:
- Only captures what the user is viewing (can't do background bulk scraping)
- Must be injected before Apollo's JS runs (use `document_start` in manifest)

### Manifest Change for Early Injection

```json
{
  "content_scripts": [{
    "matches": ["https://app.apollo.io/*"],
    "js": ["interceptor.js"],
    "run_at": "document_start"    // ← BEFORE Apollo's JS loads
  }, {
    "matches": ["https://app.apollo.io/*"],
    "js": ["turso.js", "storage.js", "content.js"]
  }]
}
```

---

## Appendix F: Testing & Debugging Guide

### Test API Calls in Browser Console

Open the Apollo tab, press F12, and paste in the Console:

```javascript
// 1. Check if you're logged in
fetch('/api/v1/auth/check?timezone_offset=-330', { credentials: 'include' })
  .then(r => r.json())
  .then(d => console.log('Logged in:', d.is_logged_in));

// 2. Quick search test
fetch('/api/v1/mixed_people/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    page: 1, per_page: 5,
    person_locations: ["India"],
    person_seniorities: ["c_suite"],
    display_mode: "explorer_mode",
    context: "people-index-page",
    finder_version: 2,
    fields: ["contact.name", "contact.title", "contact.email_status"],
    cacheKey: Date.now()
  })
}).then(r => r.json()).then(d => {
  console.log('Total entries:', d.pagination.total_entries);
  d.people.forEach(p => console.log(p.name, '|', p.title, '|', p.email_status));
});
```

### Common Error Codes

| Status | Meaning | Fix |
|--------|---------|-----|
| `401` | Not authenticated | User needs to log in to Apollo |
| `403` | CSRF token invalid/missing | Re-read CSRF token from cookie/meta |
| `422` | Invalid request body | Check filter parameter names/types |
| `429` | Rate limited | Slow down — use the RateLimiter |
| `500` | Server error | Retry after delay, Apollo might be down |

### Debug Checklist

- [ ] User is logged into Apollo (check `GET /auth/check`)
- [ ] CSRF token is being sent in `X-CSRF-TOKEN` header
- [ ] `credentials: 'include'` is set on fetch()
- [ ] `Content-Type: application/json` is set
- [ ] `cacheKey: Date.now()` is included in body
- [ ] Filter values match Apollo's expected format (e.g., `"3900,"` not `"3900"`)
- [ ] `fields` array uses dot notation (e.g., `"contact.name"` not just `"name"`)
