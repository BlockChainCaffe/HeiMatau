try {
  importScripts('url-core.js');
} catch (e) {}

const U = self.LinkGuardUrl;

function migrateSites() {
  chrome.storage.local.get({ sites: null, domains: [] }, (result) => {
    if (chrome.runtime.lastError) return;
    if (result.sites !== null && result.sites !== undefined) return;
    const domains = Array.isArray(result.domains) ? result.domains : [];
    if (!domains.length) return;
    const sites = U && U.normalizeSites ? U.normalizeSites(domains).sites : domains;
    chrome.storage.local.set({ sites: sites }, () => {
      if (chrome.runtime.lastError) return;
      chrome.storage.local.remove('domains');
    });
  });
}

chrome.runtime.onInstalled.addListener(migrateSites);
chrome.runtime.onStartup.addListener(migrateSites);

try {
  chrome.action.setBadgeBackgroundColor({ color: '#1a73e8' });
} catch (e) {}

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || !sender.tab) return;
  if (message.type === 'guard-external' && message.data) {
    chrome.tabs.sendMessage(sender.tab.id, { type: 'guard-show', data: message.data }, { frameId: 0 }).catch(() => {});
    return;
  }
  if (message.type === 'guard-status' && sender.frameId === 0) {
    chrome.action.setBadgeText(
      { tabId: sender.tab.id, text: message.active ? 'ON' : '' },
      () => void chrome.runtime.lastError
    );
  }
});
