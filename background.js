
chrome.action.onClicked.addListener((tab) => {
    if (tab.id) {
        if (tab.url && tab.url.includes("app.apollo.io")) {
            chrome.tabs.sendMessage(tab.id, { action: "toggle_sidebar" });
        } else {
            chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
        }
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "open_dashboard") {
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
        return;
    }

    if (request.action === "CALL_APIFY") {
        handleCallApify(request.emails, request.apiKey)
            .then(results => sendResponse({ success: true, data: results }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep message channel open for async response
    }
});

async function handleCallApify(emails, apiKey) {
    const actorId = "VJ5w50TP6mAbyimyO";

    // 1. Start Run
    const startRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: emails })
    });

    if (!startRes.ok) {
        const errorData = await startRes.json().catch(() => ({}));
        const status = startRes.status;
        throw new Error(JSON.stringify({ status, message: errorData.message || startRes.statusText }));
    }

    const startData = await startRes.json();
    const runId = startData.data.id;
    const datasetId = startData.data.defaultDatasetId;

    // 2. Poll Result
    while (true) {
        await new Promise(r => setTimeout(r, 2000));
        const pollRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs/${runId}?token=${apiKey}`);
        if (!pollRes.ok) throw new Error("Failed to poll run status");

        const pollData = await pollRes.json();
        const status = pollData.data.status;

        if (status === 'SUCCEEDED') break;
        if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
            throw new Error(`Run ${status}`);
        }
    }

    // 3. Fetch Items
    const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiKey}`);
    if (!itemsRes.ok) throw new Error("Failed to fetch results from dataset");

    return await itemsRes.json();
}
