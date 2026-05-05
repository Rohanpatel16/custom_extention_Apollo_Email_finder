# Environment & Configuration

This project uses `chrome.storage.local` for persisting configuration and data. Below are the primary keys used.

<!-- AUTO-GENERATED -->
| Variable (Storage Key) | Required | Description | Example |
|----------|----------|-------------|---------|
| `av_profiles` | No | Persistent CRM data (Global) | `[{id: '...', name: '...'}]` |
| `av_sidebar_session` | No | Current Sidebar View/Session data | `[{id: '...', status: '...'}]` |
| `av_settings` | No | General extension settings | `{} ` |
| `apifyApiKeys` | Yes | Array of Apify API keys for verification | `[{key: '...', status: 'active'}]` |
| `av_balance` | No | Current account balance | `5.00` |
| `av_turso_config` | No | Turso Cloud credentials for syncing | `{dbUrl: '...', authToken: '...'}` |
<!-- AUTO-GENERATED -->

## How to Configure
Most of these values are managed automatically through the **Dashboard** UI.
- **Apify Keys**: Managed in the "Manage Keys" section of the Dashboard.
- **Turso Config**: Set in the Dashboard settings for cloud synchronization.
