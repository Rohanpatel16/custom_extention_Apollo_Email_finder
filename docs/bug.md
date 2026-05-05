# Apollo Email Finder - Bug Report & Suggested Fixes

During the code analysis of the `custom_extention_Apollo_Email_finder` project, several bugs and potential edge cases were identified. Below is a detailed report of the findings and suggested fixes.

## 1. Race Condition in API Key Exhaustion Logic
**File**: `content.js`  
**Function**: `callApify(emails)`

**Description**:
When an Apify API key is exhausted (HTTP 402), the extension fetches the current list of keys from storage (`StorageWrapper.getApiKeys()`) and attempts to mark the exhausted key using `keys[state.activeKeyIndex].status = 'exhausted'`. 
If a user adds, deletes, or reorders keys in the Dashboard while the background scraping process is running, `state.activeKeyIndex` becomes stale. This leads to the script potentially marking the *wrong* API key as exhausted or throwing an out-of-bounds error.

**Suggested Fix**:
Look up the key by its actual token string rather than relying on a potentially stale index.
```javascript
const keys = await StorageWrapper.getApiKeys();
const currentIdx = keys.findIndex(k => k.key === state.activeKey.key);
if (currentIdx > -1) {
    keys[currentIdx].status = 'exhausted';
    await StorageWrapper.saveApiKeys(keys);
}
```

## 2. Invalid URI Encoding in CSV Export
**File**: `content.js`  
**Function**: `downloadCSV()`

**Description**:
The CSV export in `content.js` generates the download link using `encodeURI(csvContent)`. The `encodeURI` function does not encode special characters like `#`, `?`, `&`, or `+`. Since job titles often contain characters like `#` (e.g., C# Developer) or `+` (e.g., C++), the resulting Data URI becomes malformed. The browser interprets `#` as a hash fragment, causing the downloaded CSV to be truncated or silently fail.

**Suggested Fix**:
Change `encodeURI` to `encodeURIComponent`, which safely encodes all special characters. (Note: This bug is properly handled in `dashboard.js`, but was missed in `content.js`). 
```javascript
// Change this:
const encodedUri = encodeURI(csvContent);

// To this:
const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
```
*Alternatively, use `URL.createObjectURL(new Blob([csvContent], { type: 'text/csv' }))` to prevent URI length limit issues on huge exports.*

## 3. Potential Error on API Polling Timeout
**File**: `background.js`  
**Function**: `handleCallApify(emails, apiKey)`

**Description**:
The extension polls Apify for run completion. If the API returns `FAILED`, `ABORTED`, or `TIMED-OUT`, the code throws an error (`throw new Error(\`Run ${status}\`)`). However, when throwing this error, the error object format is inconsistent with other error handling mechanisms that parse `error.message`. This unformatted error text might be displayed to the user as `Run FAILED`, hiding the actual reason.

**Suggested Fix**:
Provide more context in the error or attempt to fetch the Apify run log to see why it failed, returning a formatted JSON string as done in HTTP errors so that `content.js` can parse it cleanly.

## 4. "Show Valid Only" Filter Hides Profiles with Archived Emails
**File**: `dashboard.js`  
**Function**: `applyFilters()`

**Description**:
The "Show Valid Only" filter toggle currently evaluates only the *current* `p.results` array:
```javascript
const hasValid = p.results && p.results.some(r => r.result === 'ok');
```
If a profile changed jobs, its new email might be invalid, but it might still have a valid archived email in `p.old_results`. As written, the filter will hide this profile completely.

**Suggested Fix**:
Update the logic to check both current and archived results for validity.
```javascript
const hasValidCurrent = p.results && p.results.some(r => r.result === 'ok');
const hasValidOld = p.old_results && p.old_results.some(r => r.result === 'ok');
if (!hasValidCurrent && !hasValidOld) return false;
```

## 5. Potential RegExp Flaw in Employee Filter Advancement
**File**: `content.js`  
**Function**: `advanceEmployeeFilter(newMin)`

**Description**:
The Auto-Scrape loop advances the employee filter using this regex:
```javascript
hash = hash.replace(
    /organizationNumEmployeesRanges\[\]=[^&]*/,
    `organizationNumEmployeesRanges[]=${encodeURIComponent(newMin + ',')}`
);
```
If a user happens to select *multiple* employee ranges in the Apollo UI (e.g., `[1-10, 11-50]`), the URL will contain multiple `organizationNumEmployeesRanges[]` parameters. The current regex only replaces the *first* instance it finds, which corrupts the filter state and might lead to an endless loop where Apollo still returns the old sizes.

**Suggested Fix**:
Remove all existing instances of the parameter before appending the new one.
```javascript
// Remove all employee ranges
hash = hash.replace(/&?organizationNumEmployeesRanges\[\]=[^&]*/g, '');
// Append the new one cleanly
hash += (hash.includes('?') ? '&' : '?') + `organizationNumEmployeesRanges[]=${encodeURIComponent(newMin + ',')}`;
```
