# Apollo Email Finder Extension 🚀

A high-performance Chrome Extension (Manifest V3) that integrates directly with Apollo.io's internal API to extract professional profiles, generate email permutations, and verify them via Apify Million Verifier. Features a built-in CRM dashboard with local persistence and high-scale support.

---

## ✨ Features

### 🔌 API-First Architecture
- **Direct Apollo API Integration** — Bypasses fragile DOM scraping by using Apollo's internal `/api/v1` endpoints. Data is structured, reliable, and immune to UI changes.
- **Multi-Source Domain Recovery** — Implements a 4-source fallback chain to recover missing company domains, ensuring high data enrichment rates.
- **Pass-2 Org Re-Query** — Secondary organizations lookup to recover domains for profiles that lack them in the initial search results.
- **Empty-Response Resilience** — Automatically detects and retries Apollo's empty `200 OK` responses often seen after filter shifts.

### 💾 Robust Data Persistence (Origin-Isolated)
- **IndexedDB Proxy Architecture** — All profile data is managed via the Background Service Worker. This ensures that data is shared seamlessly between the Apollo sidebar (app.apollo.io origin) and the Extension Dashboard (extension origin), bypassing cross-origin storage limitations.
- **High-Scale Performance** — Optimized for datasets of 15,000+ leads with virtualized rendering and efficient batch processing to prevent browser lag.
- **Local-First CRM** — Built-in storage using IndexedDB for persistence, supporting large lead volumes without performance degradation.

### 🤖 Auto-Scrape & Deadlock Breaking
- **Intelligent Batching** — Collects multiple pages silently before triggering verification to maximize throughput.
- **Employee Filter Auto-Advance** — Automatically increments filters to cycle through company sizes, enabling fully autonomous extraction of large lists.
- **Deadlock Breaker** — Detects when search filters are stuck and automatically builds/injects exclusion lists to push the scraper forward.

### 🔍 Smart Deduplication & Job Tracking
- **3-Tier Deduplication** — Matches by LinkedIn URL, Name + Domain, or Name-only fallback to prevent duplicates.
- **Job Change Awareness** — Detects when a contact changes companies; automatically archives old verified emails and resets the profile for re-verification.

### 🔑 API Key & Cost Management
- **Multi-Key Rotation** — Support for multiple Apify tokens with automatic failover when a key hits its quota.
- **Balance Tracking** — Real-time tracking of Apify usage and limits directly within the dashboard.

---

## 🛠 Installation

1. **Download** or clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (top right toggle).
4. Click **Load unpacked** and select the extension folder.

---

## 📖 How to Use

### Setup
1. Go to the **Dashboard** (click extension icon when not on Apollo).
2. Navigate to **Settings** and add your **Apify API Key**.
3. (Optional) Configure your **Turso** credentials if you wish to use cloud sync.

### Scraping
1. Open [Apollo Search](https://app.apollo.io/#/people).
2. Click the extension icon to toggle the **Sidebar**.
3. Choose your scraping mode (Manual or Auto-Scrape).
4. Extracted leads will appear in the Sidebar and sync to your **Dashboard**.

---

## 🗂 Project Structure

| File | Role |
|------|------|
| `background.js` | Service worker managing IndexedDB proxy, Apify calls, and dashboard tabs. |
| `indexed-db.js` | Core persistence layer using IndexedDB for high-volume storage. |
| `content-scraper.js`| Apollo API extraction logic and profile mapping. |
| `content-api.js`    | Wrapper for Apollo internal API calls. |
| `content-ui.js`     | Sidebar UI and interaction logic. |
| `dashboard.html`    | Full-page CRM dashboard for lead management. |
| `storage.js`        | Legacy/Helper storage utilities. |
| `turso.js`          | Turso Cloud Sync integration. |
| `manifest.json`     | Extension configuration (MV3). |

---

## 🔒 Privacy & Security

- **Local Storage** — Your lead data stays on your machine in the extension's private IndexedDB storage.
- **Direct Communication** — The extension communicates directly with `app.apollo.io` (using your session) and `api.apify.com`.
- **Private Cloud Sync** — If using Turso, data is synced to your personal private database.

---

## 🤝 Contributing

Contributions are welcome! Please focus on:
- Additional email verification providers.
- Supporting more complex Apollo filters.
- UI/UX improvements for the dashboard.

To contribute, simply fork the repo and submit a Pull Request.
