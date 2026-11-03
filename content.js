// Link Guard — content script
(() => {
  // "https://www.Example.com/path:8080" -> "example.com"
  const norm = s => s.trim().toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/[/?#:].*$/, '')
    .replace(/^(\*\.|www\.)/, '');

  // host è d oppure un suo sottodominio
  const inDomain = (host, d) => host === d || host.endsWith('.' + d);

  const isTop = window === window.top;

  // hostname della tab (frame principale), anche quando siamo dentro un iframe
  function tabHost() {
    try {
      const o = location.ancestorOrigins;
      if (o && o.length) return new URL(o[o.length - 1]).hostname.toLowerCase();
    } catch {}
    return location.hostname.toLowerCase();
  }

  // null = estensione inattiva su questa pagina; altrimenti lista dei domini "interni"
  let allowed = null;

  function load() {
    chrome.storage.local.get({ domains: [] }, ({ domains }) => {
      const here = tabHost();
      const matched = domains.map(norm).filter(d => d && inDomain(here, d));
      allowed = matched.length ? matched : null;
    });
  }
  load();
  chrome.storage.onChanged.addListener(load); // aggiorna al volo se cambi la lista

  // ---------- intercettazione ----------
  function findLink(e) {
    for (const n of e.composedPath()) {
      if (n instanceof Element && n.matches('a[href], area[href]')) return n;
    }
    return null;
  }

  // restituisce l'URL assoluto se il link esce dal dominio, altrimenti null
  function externalUrl(a) {
    let u;
    try { u = new URL(a.getAttribute('href'), document.baseURI); } catch { return null; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null; // mailto:, tel:, javascript:, #...
    const h = u.hostname.toLowerCase();
    return allowed.some(d => inDomain(h, d)) ? null : u.href;
  }

  function intercept(e) {
    if (!allowed) return;
    if (e.type === 'auxclick' && e.button !== 1) return; // solo tasto centrale, non il destro
    const a = findLink(e);
    if (!a) return;
    const url = externalUrl(a);
    if (!url) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (isTop) showAlert(url);
    else {
      try { chrome.runtime.sendMessage({ type: 'guard-alert', url }); } catch {}
    }
  }

  // fase di cattura su window: scatta prima dei listener della pagina
  window.addEventListener('click', intercept, true);
  window.addEventListener('auxclick', intercept, true);

  // ---------- alert (Shadow DOM, così la pagina non può toccarlo né stilarlo) ----------
  const CSS = `
    .ov { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: flex;
          align-items: center; justify-content: center; font: 14px/1.45 system-ui, sans-serif; }
    .box { background: #fff; color: #111; width: min(560px, 90vw); padding: 20px 24px;
           border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,.4); box-sizing: border-box; }
    h2 { margin: 0 0 8px; font-size: 17px; }
    p { margin: 0 0 8px; }
    .url { margin: 0 0 16px; padding: 10px; background: #f3f3f3; border-radius: 6px;
           font: 12px ui-monospace, monospace; white-space: pre-wrap; word-break: break-all;
           max-height: 30vh; overflow: auto; user-select: none; pointer-events: none; }
    .btns { display: flex; gap: 8px; justify-content: flex-end; }
    button { font: inherit; padding: 7px 14px; border-radius: 6px; border: 1px solid #bbb;
             background: #fff; color: #111; cursor: pointer; }
    button.copy { background: #1a73e8; border-color: #1a73e8; color: #fff; }
    .head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .head h2 { margin: 0; }
    .logo { width: 32px; height: 32px; }
  `;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  };

  let host = null;
  const closeAlert = () => { host?.remove(); host = null; };

  async function copyText(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = document.createElement('textarea');
      t.value = text;
      document.body.append(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    btn.textContent = 'Copiato ✓';
  }

  function showAlert(url) {
    closeAlert();
    host = document.createElement('div');
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;';
    const root = host.attachShadow({ mode: 'closed' });

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    root.adoptedStyleSheets = [sheet];

    const copyBtn = el('button', 'copy', 'Copia link');
    const closeBtn = el('button', '', 'Chiudi');
    copyBtn.onclick = () => copyText(url, copyBtn);
    closeBtn.onclick = closeAlert;

    const btns = el('div', 'btns');
    btns.append(copyBtn, closeBtn);

    const box = el('div', 'box');
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'true');

    const logo = document.createElement('img');
    logo.className = 'logo';
    logo.alt = '';
    logo.src = chrome.runtime.getURL('icons/48.png');

    const head = el('div', 'head');
    head.append(logo, el('h2', '', 'Link esterno bloccato'));

    box.append(
      head,
      el('p', '', 'Questo link porterebbe a:'),
      el('pre', 'url', url),   // testo semplice, non è un <a>
      btns
    );

    const ov = el('div', 'ov');
    ov.append(box);
    root.append(ov);
    document.documentElement.append(host);
    closeBtn.focus();
  }

  window.addEventListener('keydown', e => {
    if (host && e.key === 'Escape') { e.stopPropagation(); closeAlert(); }
  }, true);
  chrome.runtime.onMessage.addListener(msg => {
    if (isTop && msg && msg.type === 'guard-alert') showAlert(msg.url);
  });
})();
