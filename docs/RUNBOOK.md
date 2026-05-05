# Runbook: Operations & Deployment

This runbook provides procedures for deploying and maintaining the Apollo Email Finder extension.

## Deployment Procedures

### Internal Distribution (Manual)
1. Ensure the `version` in `manifest.json` is updated.
2. Zip the root directory (excluding `node_modules`, `.git`, `.agent`, and `tests`).
3. Distribute the `.zip` file to users for "Load unpacked" or installation via policy.

### Chrome Web Store (Production)
1. Run a final test suite: `npm test`.
2. Increment the version in `manifest.json`.
3. Create a production zip: `zip -r extension.zip . -x "node_modules/*" ".git/*" ".agent/*" "tests/*" "playwright/*"`.
4. Upload to the Chrome Web Store Developer Dashboard.

## Health Checks & Monitoring
- **Apollo API**: Check if Apollo has changed its internal API structure by verifying if profile extraction still works.
- **Apify Integration**: Monitor the Dashboard for "exhausted" status on API keys.
- **Turso Sync**: Check the Dashboard logs for sync errors.

## Common Issues & Fixes
| Issue | Potential Cause | Fix |
|-------|-----------------|-----|
| No profiles extracted | Apollo API change | Update `content.js` with new selectors or endpoints. |
| Verification fails | Apify token exhausted | Add or rotate API keys in the Dashboard. |
| Turso sync error | Invalid credentials | Re-configure Turso `dbUrl` and `authToken` in settings. |
| Extension not loading | Manifest error | Check Chrome Developer Mode console for manifest errors. |

## Rollback Procedures
- **Manual**: Revert to the previous stable version from Git and reload the extension.
- **Web Store**: Use the Chrome Web Store dashboard to revert to a previous version if possible, or upload a patch immediately.
