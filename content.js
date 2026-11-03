(() => {
  const U = globalThis.LinkGuardUrl;
  if (!U) return;

  const XLINK = 'http://www.w3.org/1999/xlink';
  const isTop = window === window.top;
  let sites = [];
  let active = false;
  let popupHost = null;
  let popupDialog = null;
  let returnFocus = null;

  function tabHost() {
    try {
      const origins = location.ancestorOrigins;
      if (origins && origins.length) {
        return U.canonicalHost(new URL(origins[origins.length - 1]).hostname);
      }
    } catch (e) {}
    return U.canonicalHost(location.hostname);
  }

  function send(message) {
    try {
      const result = chrome.runtime.sendMessage(message);
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch (e) {}
  }

  function load() {
    chrome.storage.local.get({ sites: null, domains: [] }, (result) => {
      if (chrome.runtime.lastError) return;
      const source = Array.isArray(result.sites) ? result.sites : (Array.isArray(result.domains) ? result.domains : []);
      sites = U.normalizeSites(source).sites;
      active = U.isHostProtected(tabHost(), sites);
      if (isTop) send({ type: 'guard-status', active: active });
    });
  }

  function rawHref(element) {
    if (!element || !element.getAttribute) return '';
    const href = element.getAttribute('href');
    if (href !== null) return href;
    const xlink = element.getAttributeNS ? element.getAttributeNS(XLINK, 'href') : null;
    if (xlink !== null) return xlink;
    if (element.href) {
      return typeof element.href === 'string' ? element.href : (element.href.baseVal || '');
    }
    return '';
  }

  function findLink(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const node of path) {
      if (!(node instanceof Element)) continue;
      const tag = node.tagName ? node.tagName.toLowerCase() : '';
      if ((tag === 'a' || tag === 'area') && rawHref(node)) return node;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (target) {
      const closest = target.closest ? target.closest('a[href], area[href]') : null;
      if (closest && rawHref(closest)) return closest;
    }
    return null;
  }

  function textOfLink(element) {
    if (!element) return '';
    let text = (element.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) text = element.getAttribute('aria-label') || element.getAttribute('title') || '';
    if (!text && element.querySelector) {
      const image = element.querySelector('img[alt]');
      if (image) text = image.getAttribute('alt') || '';
    }
    return text.slice(0, 500);
  }

  function resolveNode(element) {
    const href = rawHref(element);
    if (!href) return null;
    let url;
    try {
      url = new URL(href, document.baseURI);
    } catch (e) {
      return null;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:' && !U.isUnsafe(url)) return null;
    const saferedirect = element.getAttribute ? (element.getAttribute('data-saferedirecturl') || '') : '';
    return U.resolveLink({
      href: href,
      saferedirect: saferedirect,
      baseURI: document.baseURI,
      linkText: textOfLink(element)
    });
  }

  function shouldBlock(resolved) {
    if (!resolved) return false;
    if (resolved.unsafe) return true;
    let finalUrl;
    try {
      finalUrl = new URL(resolved.finalUrl, document.baseURI);
    } catch (e) {
      return true;
    }
    if (!U.isHttp(finalUrl)) return true;
    if (resolved.ambiguous) return true;
    return !U.isHostProtected(finalUrl.hostname, sites);
  }

  function popupData(resolved, element, isForm) {
    let destinationHost = '';
    try {
      destinationHost = U.canonicalHost(new URL(resolved.finalUrl, document.baseURI).hostname);
    } catch (e) {}
    return {
      sourceHost: tabHost(),
      destinationHost: destinationHost,
      originalUrl: resolved.originalUrl,
      finalUrl: resolved.finalUrl,
      cleanUrl: resolved.cleanUrl,
      linkText: isForm ? '' : textOfLink(element),
      chain: resolved.chain || [],
      signals: resolved.signals || [],
      hostAnalysis: resolved.hostAnalysis || null,
      ambiguous: !!resolved.ambiguous,
      reason: resolved.reason || '',
      unsafe: !!resolved.unsafe,
      isForm: !!isForm
    };
  }

  function handleResolved(event, resolved, element, isForm) {
    if (!shouldBlock(resolved)) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    const data = popupData(resolved, element, isForm);
    if (isTop) showPopup(data);
    else send({ type: 'guard-external', data: data });
    return true;
  }

  function intercept(event) {
    if (!active || event.defaultPrevented) return;
    if (event.type === 'click' && event.button !== 0) return;
    if (event.type === 'auxclick' && event.button !== 1) return;
    const element = findLink(event);
    if (!element) return;
    const resolved = resolveNode(element);
    if (!resolved) return;
    handleResolved(event, resolved, element, false);
  }

  function onKeyDown(event) {
    if (!active || event.defaultPrevented) return;
    if (event.key !== 'Enter' || event.altKey || event.ctrlKey || event.metaKey) return;
    const element = findLink(event);
    if (!element) return;
    const resolved = resolveNode(element);
    if (!resolved) return;
    handleResolved(event, resolved, element, false);
  }

  function onSubmit(event) {
    if (!active || event.defaultPrevented) return;
    const form = event.target;
    if (!form || form.tagName !== 'FORM') return;
    let action = '';
    try {
      action = event.submitter && event.submitter.formAction ? event.submitter.formAction : form.action;
    } catch (e) {
      action = form.action || '';
    }
    if (!action) action = document.baseURI;
    const resolved = U.resolveLink({ href: action, baseURI: document.baseURI, linkText: '' });
    if (!resolved) return;
    handleResolved(event, resolved, null, true);
  }

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .dlg { position: fixed; inset: 0; width: 100%; height: 100%; max-width: none; max-height: none;
           margin: 0; padding: 0; border: 0; background: transparent; color: #111;
           font: 14px/1.45 system-ui, -apple-system, Segoe UI, sans-serif; }
    .dlg::backdrop { background: transparent; }
    .wrap { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
            padding: 16px; overflow: auto; background: rgba(0, 0, 0, .55); }
    .box { width: min(640px, 100%); max-height: calc(100vh - 32px); overflow: auto; padding: 20px 24px;
           border-radius: 12px; background: #fff; color: #111; box-shadow: 0 10px 40px rgba(0, 0, 0, .4); }
    .head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
    .logo { width: 32px; height: 32px; flex: none; }
    h2 { margin: 0; font-size: 18px; line-height: 1.25; }
    .desc { margin: 0 0 14px; color: #3c4043; }
    .field { margin: 0 0 10px; }
    .label { margin: 0 0 2px; font-size: 11px; font-weight: 600; letter-spacing: .04em;
             text-transform: uppercase; color: #5f6368; }
    .value { word-break: break-word; }
    .dest { font-size: 20px; font-weight: 650; word-break: break-all; }
    .mono { padding: 8px 10px; border-radius: 6px; background: #f1f3f4; color: #202124;
            font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            white-space: pre-wrap; word-break: break-all; user-select: text; }
    .quote { color: #3c4043; font-style: italic; word-break: break-word; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 12px; }
    .chip { padding: 2px 8px; border: 1px solid #dadce0; border-radius: 999px; background: #f8f9fa;
            color: #3c4043; font-size: 11px; line-height: 1.5; }
    .chip.danger { border-color: #fca5a5; background: #fef2f2; color: #991b1b; }
    .chip.warn { border-color: #fcd34d; background: #fffbeb; color: #92400e; }
    .chip.info { border-color: #93c5fd; background: #eff6ff; color: #1e40af; }
    .warn { margin: 12px 0; padding: 10px 12px; border: 1px solid; border-radius: 8px; }
    .warn strong { display: block; margin-bottom: 3px; }
    .warn p { margin: 4px 0; }
    .warn .field { margin: 8px 0 0; }
    .warn .label { color: inherit; opacity: .75; }
    .warn .mono { background: rgba(255, 255, 255, .7); color: inherit; }
    .warn.danger { border-color: #fca5a5; background: #fef2f2; color: #7f1d1d; }
    .warn.warn { border-color: #fcd34d; background: #fffbeb; color: #78350f; }
    .warn.info { border-color: #93c5fd; background: #eff6ff; color: #1e3a8a; }
    .chain { margin: 4px 0 10px; padding-left: 20px; }
    .chain li { margin: 2px 0; word-break: break-all; font: 12px ui-monospace, monospace; }
    .btns { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: 18px; }
    button { padding: 8px 14px; border: 1px solid #bdc1c6; border-radius: 7px; background: #fff;
             color: #111; font: inherit; cursor: pointer; }
    button:hover { background: #f1f3f4; }
    button:focus-visible { outline: 2px solid #1a73e8; outline-offset: 2px; }
    button.primary { border-color: #1a73e8; background: #1a73e8; color: #fff; }
    button.primary:hover { background: #1765cc; }
    button.clean { border-color: #ceead6; background: #e6f4ea; color: #137333; }
    button.clean:hover { background: #d2f0dc; }
    .foot { margin: 12px 0 0; color: #5f6368; font-size: 12px; }
  `;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function mono(text) {
    const node = el('div', 'mono');
    node.textContent = text || '';
    return node;
  }

  function field(label, value) {
    const wrap = el('div', 'field');
    wrap.appendChild(el('div', 'label', label));
    const body = el('div', 'value');
    if (typeof value === 'string') body.textContent = value;
    else if (value) body.appendChild(value);
    wrap.appendChild(body);
    return wrap;
  }

  function warnBox(level, title, text) {
    const box = el('div', 'warn ' + level);
    box.appendChild(el('strong', '', title));
    if (text) box.appendChild(el('p', '', text));
    return box;
  }

  function truncate(text, max) {
    const value = String(text || '');
    return value.length > max ? value.slice(0, max - 1) + '…' : value;
  }

  function closePopup() {
    if (!popupHost) return;
    try {
      if (popupDialog) popupDialog.close();
    } catch (e) {}
    popupHost.remove();
    popupHost = null;
    popupDialog = null;
    if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') {
      try {
        returnFocus.focus();
      } catch (e) {}
    }
    returnFocus = null;
  }

  function flash(button, text) {
    const label = button.dataset.label || button.textContent;
    button.textContent = text;
    if (button._guardTimer) clearTimeout(button._guardTimer);
    button._guardTimer = setTimeout(() => {
      button.textContent = label;
    }, 1600);
  }

  async function copyText(text, button) {
    const value = String(text || '');
    try {
      await navigator.clipboard.writeText(value);
      flash(button, 'Copied');
      return;
    } catch (e) {}
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0;';
    (document.body || document.documentElement).appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {}
    area.remove();
    flash(button, ok ? 'Copied' : 'Copy failed');
  }

  function showPopup(data) {
    if (!document.documentElement) return;
    closePopup();
    returnFocus = document.activeElement && typeof document.activeElement.focus === 'function'
      ? document.activeElement
      : null;

    popupHost = document.createElement('link-guard-dialog');
    popupHost.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important;';
    const shadow = popupHost.attachShadow({ mode: 'closed' });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    shadow.adoptedStyleSheets = [sheet];

    const dialog = document.createElement('dialog');
    dialog.className = 'dlg';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'guard-title');
    dialog.setAttribute('aria-describedby', 'guard-desc');
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closePopup();
    });

    const wrap = el('div', 'wrap');
    const box = el('div', 'box');
    const head = el('div', 'head');
    const logo = document.createElement('img');
    logo.className = 'logo';
    logo.alt = '';
    logo.src = chrome.runtime.getURL('icons/48.png');
    const title = el('h2', '', data.isForm ? 'Form submission blocked' : 'External link blocked');
    title.id = 'guard-title';
    head.append(logo, title);

    const desc = el('p', 'desc', data.isForm
      ? 'This form would send data to an external site.'
      : 'This link leads to an external site.');
    desc.id = 'guard-desc';

    box.append(head, desc);

    const destination = data.destinationHost || 'Not available';
    const destNode = el('div', 'dest', destination);
    box.appendChild(field('Destination', destNode));

    if (data.isForm) {
      box.appendChild(field('Form action', mono(data.finalUrl)));
    } else {
      box.appendChild(field('Clean link', mono(data.cleanUrl || data.finalUrl)));
    }

    if (data.originalUrl && data.originalUrl !== data.cleanUrl) {
      box.appendChild(field(data.isForm ? 'Original action' : 'Original link', mono(data.originalUrl)));
    }

    if (data.linkText) {
      box.appendChild(field('Link text', el('div', 'quote', '“' + truncate(data.linkText, 300) + '”')));
    }

    const chain = Array.isArray(data.chain) ? data.chain : [];
    if (chain.length > 2) {
      const list = el('ol', 'chain');
      chain.slice(1, -1).forEach((item) => {
        list.appendChild(el('li', '', item));
      });
      if (list.childNodes.length) box.appendChild(field('Redirects', list));
    }

    if (data.signals && data.signals.length) {
      const chips = el('div', 'chips');
      data.signals.forEach((signal) => {
        chips.appendChild(el('span', 'chip ' + (signal.level || 'info'), signal.label || signal.code));
      });
      box.appendChild(chips);
    }

    if (data.hostAnalysis && data.hostAnalysis.homograph) {
      const analysis = data.hostAnalysis;
      const prompt = warnBox('danger', 'Warning: confusable Unicode characters',
        'The domain uses characters that can be mistaken for Latin letters. It may be impersonating a nearly identical site.');
      if (analysis.unicodeHost) prompt.appendChild(field('Unicode', mono(analysis.unicodeHost)));
      if (analysis.asciiHost) prompt.appendChild(field('Punycode', mono(analysis.asciiHost)));
      if (analysis.confusable && analysis.skeletonHost && analysis.skeletonHost !== analysis.normalizedHost) {
        prompt.appendChild(field('Looks like', mono(analysis.skeletonHost)));
      }
      if (analysis.scripts && analysis.scripts.length > 1) {
        prompt.appendChild(el('p', '', 'Scripts detected: ' + analysis.scripts.join(', ') + '.'));
      }
      if (analysis.invisible) {
        prompt.appendChild(el('p', '', 'The domain contains invisible or control characters.'));
      }
      if (analysis.compatibility) {
        prompt.appendChild(el('p', '', 'The domain contains characters that change shape after Unicode normalization.'));
      }
      box.appendChild(prompt);
    } else if (data.hostAnalysis && data.hostAnalysis.asciiHost && data.hostAnalysis.asciiHost.indexOf('xn--') !== -1) {
      const analysis = data.hostAnalysis;
      const info = warnBox('warn', 'Internationalized domain',
        'The domain is displayed in Unicode. Verify that it is really the intended site.');
      if (analysis.unicodeHost) info.appendChild(field('Unicode', mono(analysis.unicodeHost)));
      if (analysis.asciiHost) info.appendChild(field('Punycode', mono(analysis.asciiHost)));
      box.appendChild(info);
    }

    if (data.unsafe) {
      box.appendChild(warnBox('danger', 'Unsafe protocol',
        'This link uses javascript:, data:, or a similar protocol and will not be opened.'));
    }

    if (data.ambiguous) {
      box.appendChild(warnBox('warn', 'Destination not resolved',
        'The link uses a redirect or shortener that could not be resolved. The clean link may not be final.'));
    }

    const buttons = el('div', 'btns');
    const copyButton = el('button', 'primary', 'Copy link');
    copyButton.type = 'button';
    copyButton.dataset.label = 'Copy link';
    copyButton.addEventListener('click', () => copyText(data.originalUrl, copyButton));

    const cleanButton = el('button', 'clean', 'Copy clean link');
    cleanButton.type = 'button';
    cleanButton.dataset.label = 'Copy clean link';
    cleanButton.addEventListener('click', () => copyText(data.cleanUrl || data.finalUrl || data.originalUrl, cleanButton));

    const cancelButton = el('button', '', 'Cancel');
    cancelButton.type = 'button';
    cancelButton.addEventListener('click', closePopup);

    buttons.append(copyButton, cleanButton, cancelButton);
    box.appendChild(buttons);
    box.appendChild(el('p', 'foot', data.isForm
      ? 'The form will not be submitted. Copy the action only if you trust the destination.'
      : 'The link will not open automatically. Paste it into the browser only if you trust the destination.'));

    wrap.appendChild(box);
    dialog.appendChild(wrap);
    shadow.appendChild(dialog);
    document.documentElement.appendChild(popupHost);
    popupDialog = dialog;

    try {
      dialog.showModal();
    } catch (e) {
      dialog.setAttribute('open', '');
    }
    cancelButton.focus();
  }

  window.addEventListener('click', intercept, true);
  window.addEventListener('auxclick', intercept, true);
  window.addEventListener('contextmenu', intercept, true);
  window.addEventListener('dragstart', intercept, true);
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('submit', onSubmit, true);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.sites || changes.domains)) load();
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (isTop && message && message.type === 'guard-show' && message.data) {
      showPopup(message.data);
    }
  });

  load();
})();
