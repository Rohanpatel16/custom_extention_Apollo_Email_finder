# Apollo Email Verifier Extension 🚀

A powerful Chrome Extension that integrates with Apollo.io to extract professional profiles, generate email permutations, and verify them using the Apify Million Verifier API—all from a sleek, persistent sidebar and a dedicated management dashboard.

## ✨ Features

- **Persistent Sidebar**: Stays open while you browse, preventing accidental data loss.
- **Dedicated Dashboard (Global CRM)**: Manages your successfully verified leads across sessions and handles multiple API keys.
- **Advanced API Key Management**: Add multiple Apify API tokens, track usage balance, and automatically rotate keys when one is exhausted.
- **One-Click Extraction & Pagination**: Grab all visible profiles from the Apollo search results and easily navigate to the "Next Page" from within the sidebar.
- **Smart Verification**:
    - Generates possible email patterns (e.g., `first.last@domain.com`).
    - Verifies them in real-time using Apify.
    - **Retry Logic** for failed API calls.
- **Selective Control**: Check/uncheck specific profiles to verify.
- **Results Filtering**: Toggle to see only valid emails or all attempts.
- **CSV Export**: Download your verified leads directly to CSV from the sidebar or the dashboard.
- **Premium UI**: Modern, clean interface with toast notifications and smooth animations.

## 🛠 Installation

1.  **Clone/Download** this repository.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** (top right).
4.  Click **Load unpacked**.
5.  Select the `ApolloEmailVerifier` folder.

## 📖 How to Use

1.  **Open Apollo**: Go to your [Apollo Find People](https://app.apollo.io/#/people) page.
2.  **Launch**: Click the extension icon 🧩 to open the sidebar.
3.  **Setup Keys**: Click **⚙️ Manage Keys in Dashboard** to open the dashboard. Add your Apify API Tokens.
4.  **Extract**: Back in Apollo, click **"Extract Profiles"**. Use the **Next Page** button to extract more.
5.  **Verify**: Select the profiles you want and click **"Verify Selected"**.
6.  **Export & Manage**: Click **"Download CSV"** in the sidebar, or open the **Dashboard** to view and manage all your historical valid leads (Global CRM).

## 🔒 Privacy & Security
- **Local Storage**: Your API tokens and extracted profiles are stored locally in your browser (`chrome.storage.local`).
- **Direct Communication**: The extension communicates directly with Apify APIs; no intermediate servers are used.

## 🤝 Contributing
Feel free to open issues or submit pull requests to improve the extractor logic or add new verification services.
