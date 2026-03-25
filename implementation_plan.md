# Implementation Plan: Smart Profile Deduplication & Update

## Problem
The current dedup key is `name + domain`. If a person changes jobs, their domain changes, so the extension creates a **duplicate entry** instead of updating the existing one.

## Goal
Match returning profiles intelligently and **update in-place** — refreshing company, domain, title, emails, employees, and industry — while **preserving** old verification results and ID.

---

## Match Priority (in order)

| Priority | Key | Why |
|---|---|---|
| 1 | `linkedin URL` | Never changes — most reliable |
| 2 | `name` (exact, case-insensitive) | Fallback when LinkedIn not available |

> If a match is found via Priority 1 or 2, the profile is treated as an **update**, not a new entry.

---

## Proposed Changes

### `content.js` — `extractProfiles()`

**Current logic:**
```
key = name + domain
if key exists in CRM → reuse ID/status/results (but keep NEW scraped data)
if key not found → add as new
```

**New logic:**
```
1. Try match by linkedin URL (if present)
2. If no match, try match by name (exact, normalized)
3. If match found:
    - Keep: id, status, results (verified emails)
    - Update: title, company, domain, website, companyLinkedin,
              employees, industry, linkedin
    - Regenerate: emails[] from new name + new domain
    - Flag: profile.jobChanged = true  (if domain changed)
4. If no match found:
    - Add as new entry (existing behaviour)
```

**New global lookup maps to build:**
```js
const linkedinMap = new Map();   // linkedin URL → profile
const nameMap     = new Map();   // normalized name → profile
```

---

### `dashboard.js` — `render()`

- If `profile.jobChanged === true`, show a small 🔄 badge next to the company name so you can see at a glance who has moved.

---

### `storage.js` — No changes needed
The update writes back through the existing `overwriteGlobalProfiles()` path.

---

## Verification Plan

1. Scrape a person → verify their email → save to CRM.
2. Manually change their company/domain in storage (simulate a job change).
3. Clear sidebar, re-extract from Apollo page with the same person appearing.
4. Confirm:
   - No duplicate row in dashboard.
   - Company/domain/title updated.
   - Old verified email results preserved.
   - 🔄 badge visible on that row.

---

## Files to Change

| File | Change |
|---|---|
| `content.js` | New dedup logic in `extractProfiles()` |
| `dashboard.js` | 🔄 badge render in `render()` |

