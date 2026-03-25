# Apollo Email Verifier Extension 🚀

A powerful Chrome Extension that integrates with Apollo.io to extract professional profiles, generate email permutations, and verify them using the Apify Million Verifier API—all from a sleek, persistent sidebar and a dedicated management dashboard with Turso Cloud Sync.

## ✨ Features

- **Smart Extraction**: Automatically pulls Name, Title, Company, Location, **Industry**, and **Employee Count** (company size).
- **Persistent Sidebar**: Stays open while you browse, preventing accidental data loss during navigation.
- **Dedicated Dashboard (Global CRM)**:
    - **Advanced Filtering**: Filter by Industry, Company, Title, or **Employee Range** (including custom min/max options).
    - **Live Auto-Refresh**: The dashboard updates instantly when the extension verifies data in the background.
    - **Cloud Sync (Turso)**: Real-time SQLite backup of all leads. Never lose your CRM data.
- **Smart Deduplication & Job Tracking**:
    - **LinkedIn-First Matching**: Tracks leads even if they move to a new company.
    - **Job Change Detection**: Automatically archives old verified emails to history and resets for re-verification at the new job.
    - **🔄 Job-Change Badge**: Easily spot leads who have moved to new roles.
- **Advanced API Key Management**: Add multiple Apify tokens, track usage balance, and auto-rotate keys.
- **Smart Verification**:
    - Generates possible email patterns and verifies them via Apify.
    - **Retry Logic** and **Selective Control** for specific profile verification.
- **CSV/JSON Export**: Download your filtered leads in multiple formats.
- **Legal Compliance**: Integrated Terms & Conditions and Privacy Policy for professional use.

## 🛠 Installation

1.  **Clone/Download** this repository.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode**.
4.  Click **Load unpacked** and select the extension folder.

## 📖 How to Use

1.  **Open Apollo**: Go to your [Apollo Find People](https://app.apollo.io/#/people) page.
2.  **Launch**: Click the extension icon 🧩 to open the sidebar.
3.  **Setup Keys**: Click **⚙️ Manage Keys** in the dashboard to add your Apify tokens.
4.  **Extract**: Click **"Extract Profiles"**. Use the **Next Page** button to capture multiple pages.
5.  **Verify**: Select profiles and click **"Verify Selected"**. Data syncs to the dashboard and Turso cloud instantly.
6.  **Manage**: Open the **Dashboard** to filter, track job changes, and export your validated leads.

## 🔒 Privacy & Security

- **Local Storage**: Data is stored locally using `chrome.storage.local`.
- **Cloud Backup**: If configured, lead data is securely synced to your private **Turso** database. No data is shared with third parties.
- **Direct APIs**: Communicates directly with Apify—no intermediate middleware.

## 🤝 Contributing

Feel free to open issues or submit pull requests to improve extractor logic or add new verification services.
