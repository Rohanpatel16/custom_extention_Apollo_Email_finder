# Apollo Email Finder Extension 🚀

A Chrome Extension that directly integrates with Apollo.io's internal API to extract professional profiles at scale, generate email permutations, verify them via Apify, and persist all leads to a dashboard CRM with Turso Cloud Sync — all without touching the DOM.

---

## ✨ Features

### 🔌 API-First Architecture
- **Direct Apollo API Integration** — replaces fragile DOM scraping with Apollo's internal `/api/v1` endpoints. Data is structured, reliable, and not affected by UI layout changes.
- **Multi-Source Domain Recovery** — 4-source fallback chain (`org.website_url` → `snippet.website_url` → `org.primary_domain` → `snippet.primary_domain`) recovers domains that the search endpoint returns as `null`.
- **Pass-2 Org Re-Query** — for profiles still missing a domain after pass-1, a secondary `loadOrganizations` call is made to recover them before they are dropped.
- **Empty-Response Retry** — Apollo returns empty `200 OK` responses immediately after filter changes. The scraper retries up to 3× with a 3 s delay, preventing premature stops.

### 🤖 Auto-Scrape Mode
- **Batch** — collects 5 pages silently, then verifies in one shot and advances the employee filter.
- **Per-Page** — verifies after each page for real-time results.
- **Employee Filter Auto-Advance** — automatically increments `organizationNumEmployeesRanges` min to the highest seen employee count, cycling through all company sizes without user input.

### 🔒 Deadlock Breaker
- Detects when the employee filter is stuck (same max count across a full batch).
- Registers all seen company domains as an Apollo exclusion list (`save_query`) and injects the list ID back into the URL so both the Apollo UI and our API calls respect the exclusion simultaneously.
- **Cumulative exclusion** — each deadlock cycle builds on all previous ones. A second or third deadlock correctly carries over every previously excluded company, preventing them from re-appearing in results.

### 🔍 3-Tier Smart Deduplication
Prevents the same lead from being saved twice while correctly tracking job changes:

| Tier | Match Key | Condition |
|------|-----------|-----------|
| 1 | LinkedIn URL | Always (globally unique) |
| 2 | Name + Domain | Exact company match — separates "Rajesh Shah @ CompanyA" from "Rajesh Shah @ CompanyB" |
| 3 | Name only | Last resort — only when **neither** the stored nor incoming profile has a LinkedIn URL |

- **Job Change Detection** — if a person's domain changes, old verified emails are archived to `old_results` and the profile is reset for re-verification.

### 🔑 API Key Management
- Add multiple Apify tokens with labels, balances, and renewal dates.
- **Auto-rotation** — when a key hits quota (402), the next active key is picked up automatically without stopping the scraper.
- **Auto-renewal** — keys are reset to active on their configured monthly renewal date.

### 📊 Dashboard CRM
- Filter by industry, company, title, employee range, and verification status.
- **CSV Export** — all leads with their verification results.
- **Turso Cloud Sync** — real-time SQLite backup via Turso HTTP API. Pull or push between local and cloud at any time.
- Per-profile delete synced to cloud.

---

## 🛠 Installation

1. **Clone or download** this repository.
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** → select the extension folder.

---

## 📖 How to Use

### Basic (Manual)
1. Go to [Apollo Find People](https://app.apollo.io/#/people) and set your filters.
2. Click the extension icon 🧩 to open the sidebar.
3. Add your Apify API token via **⚙️ Manage Keys in Dashboard**.
4. Click **Extract Profiles** → **Verify Selected**.

### Auto-Scrape (Recommended for large lists)
1. On Apollo, set:
   - Sort by **Employees ↑ (Ascending)**
   - Set `# Employees ≥ 1`
   - Optionally add **Organization domain = Known** filter to guarantee every result has a website
2. Enable **🤖 Auto-Scrape Mode** in the sidebar.
3. Choose **Batch** (faster) or **Per-Page** (real-time) mode.
4. The scraper will automatically:
   - Extract 5 pages → verify → advance employee filter
   - Detect and break deadlocks by building exclusion lists
   - Stop when all results are exhausted

---

## 🗂 File Structure

| File | Role |
|------|------|
| `content.js` | Apollo API client, filter parser, profile mapper, auto-scrape loop, dedup, sidebar UI |
| `background.js` | Apify run management (start → poll → fetch results) |
| `storage.js` | `chrome.storage.local` wrapper + Turso sync triggers |
| `turso.js` | Turso HTTP API client, schema migrations, upsert/delete/pull |
| `dashboard.html/js/css` | CRM dashboard UI |
| `sidebar.css` | Sidebar styles |
| `manifest.json` | Extension manifest (MV3) |

---

## 🔒 Privacy & Security

- All lead data is stored locally via `chrome.storage.local`.
- Cloud backup uses your own private **Turso** database — no data is shared with third parties.
- The extension communicates directly with `app.apollo.io` (same-origin, uses your existing session cookie) and `api.apify.com`.

---

## 🤝 Contributing

Open an issue or submit a pull request. For detailed information on scripts, configuration, and how to contribute, please see the following guides:

- [Contributing Guide](docs/CONTRIBUTING.md)
- [Project Scripts](docs/SCRIPTS.md)
- [Environment & Configuration](docs/ENV.md)
- [Operations Runbook](docs/RUNBOOK.md)

Key areas for contribution:
- Additional email verification providers
- Improved email pattern generation for non-Western name formats
- Rate-limit handling for very large scrape sessions (10,000+ leads)
