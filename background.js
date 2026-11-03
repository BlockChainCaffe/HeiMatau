// Click sull'icona dell'estensione -> apre la pagina delle impostazioni
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

// Un iframe ha intercettato un link esterno: l'alert va mostrato nel frame principale della tab
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === 'guard-alert' && sender.tab) {
    chrome.tabs.sendMessage(sender.tab.id, msg, { frameId: 0 }).catch(() => {});
  }
});
