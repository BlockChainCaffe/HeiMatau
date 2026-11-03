(() => {
  const U = globalThis.HeiMatauUrl;
  const rows = document.getElementById('rows');
  const message = document.getElementById('msg');
  const testResult = document.getElementById('test-result');

  const ERROR_TEXT = {
    invalid: 'Invalid domain',
    userinfo: 'Do not enter credentials or @',
    'public-suffix': 'Enter a full domain, not a public suffix',
    'needs-domain': 'Enter a full domain (e.g. example.com)'
  };

  function errorText(code) {
    return ERROR_TEXT[code] || 'Invalid domain';
  }

  function setMessage(text, error) {
    message.textContent = text;
    message.classList.toggle('error', !!error);
  }

  function addRow(value) {
    const row = document.createElement('div');
    row.className = 'row';

    const input = document.createElement('input');
    input.className = 'site';
    input.type = 'text';
    input.placeholder = 'mail.google.com';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.value = value || '';
    input.addEventListener('input', () => {
      input.classList.remove('invalid');
      input.removeAttribute('title');
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      row.remove();
      if (!rows.querySelector('.site')) addRow('');
    });

    row.append(input, remove);
    rows.appendChild(row);
    return input;
  }

  function render(values) {
    rows.textContent = '';
    const list = Array.isArray(values) ? values : [];
    list.forEach((value) => addRow(value));
    if (!list.length) addRow('');
  }

  function readValues() {
    return Array.from(rows.querySelectorAll('.site')).map((input) => input.value);
  }

  function clearInvalid() {
    rows.querySelectorAll('.site').forEach((input) => {
      input.classList.remove('invalid');
      input.removeAttribute('title');
    });
  }

  function load() {
    chrome.storage.local.get({ sites: null, domains: [] }, (result) => {
      if (chrome.runtime.lastError) return;
      const source = Array.isArray(result.sites)
        ? result.sites
        : (Array.isArray(result.domains) ? result.domains : []);
      render(source);
    });
  }

  function save() {
    clearInvalid();
    const normalized = U.normalizeSites(readValues());
    if (normalized.errors.length) {
      const inputs = rows.querySelectorAll('.site');
      normalized.errors.forEach((error) => {
        const input = inputs[error.index];
        if (!input) return;
        input.classList.add('invalid');
        input.title = errorText(error.error);
      });
      setMessage('Fix the highlighted fields.', true);
      return;
    }
    chrome.storage.local.set({ sites: normalized.sites }, () => {
      if (chrome.runtime.lastError) {
        setMessage('Error while saving.', true);
        return;
      }
      chrome.storage.local.remove('domains');
      setMessage('Saved', false);
      setTimeout(() => setMessage('', false), 1800);
    });
  }

  function addResultLine(container, label, value) {
    const line = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = label;
    const text = document.createElement('span');
    text.textContent = value;
    line.append(strong, text);
    container.appendChild(line);
  }

  function addResultMono(container, label, value) {
    const line = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = label;
    const mono = document.createElement('div');
    mono.className = 'mono';
    mono.textContent = value;
    line.appendChild(strong);
    container.appendChild(line);
    container.appendChild(mono);
  }

  function runTest() {
    testResult.textContent = '';
    testResult.className = 'result';
    const input = document.getElementById('test-url');
    const value = input.value.trim();
    if (!value) {
      testResult.className = 'result blocked';
      testResult.textContent = 'Enter a URL.';
      return;
    }
    const resolved = U.resolveLink({ href: value, baseURI: location.href, linkText: '' });
    if (!resolved) {
      testResult.className = 'result blocked';
      testResult.textContent = 'Invalid URL.';
      return;
    }
    const normalized = U.normalizeSites(readValues());
    const sites = normalized.sites;
    let host = '';
    try {
      host = U.canonicalHost(new URL(resolved.finalUrl, location.href).hostname);
    } catch (e) {}
    const inside = !resolved.unsafe && !resolved.ambiguous && U.isHostProtected(host, sites);
    testResult.className = 'result ' + (inside ? 'allowed' : 'blocked');

    const title = document.createElement('strong');
    title.textContent = inside ? 'Internal link: would not be blocked' : 'External link: would be blocked';
    testResult.appendChild(title);
    addResultLine(testResult, 'Destination: ', host || 'Not available');
    if (resolved.cleanUrl) addResultMono(testResult, 'Clean link:', resolved.cleanUrl);
    if (resolved.originalUrl && resolved.originalUrl !== resolved.cleanUrl) {
      addResultMono(testResult, 'Original link:', resolved.originalUrl);
    }
    if (resolved.hostAnalysis && resolved.hostAnalysis.asciiHost.indexOf('xn--') !== -1) {
      addResultLine(testResult, 'Unicode: ', resolved.hostAnalysis.unicodeHost);
      addResultLine(testResult, 'Punycode: ', resolved.hostAnalysis.asciiHost);
    }
    if (resolved.hostAnalysis && resolved.hostAnalysis.homograph) {
      addResultLine(testResult, 'Warning: ', 'the domain uses Unicode characters that can be confused with Latin letters.');
      if (resolved.hostAnalysis.skeletonHost && resolved.hostAnalysis.skeletonHost !== resolved.hostAnalysis.normalizedHost) {
        addResultLine(testResult, 'Looks like: ', resolved.hostAnalysis.skeletonHost);
      }
    }
    if (resolved.signals && resolved.signals.length) {
      addResultLine(testResult, 'Signals: ', resolved.signals.map((signal) => signal.label).join(' · '));
    }
    if (resolved.ambiguous) {
      addResultLine(testResult, 'Note: ', 'the final destination was not fully resolved.');
    }
  }

  document.getElementById('add').addEventListener('click', () => {
    addRow('').focus();
  });

  document.getElementById('save').addEventListener('click', save);

  document.getElementById('test').addEventListener('click', runTest);
  document.getElementById('test-url').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') runTest();
  });

  document.getElementById('export').addEventListener('click', () => {
    const normalized = U.normalizeSites(readValues());
    const blob = new Blob([JSON.stringify({ sites: normalized.sites }, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hei-matau-sites.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  document.getElementById('import').addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || ''));
        const list = Array.isArray(data)
          ? data
          : (Array.isArray(data.sites) ? data.sites : (Array.isArray(data.domains) ? data.domains : []));
        if (!list.length) throw new Error('empty');
        render(list);
        setMessage('Imported. Remember to save.', false);
      } catch (e) {
        setMessage('Invalid file.', true);
      } finally {
        event.target.value = '';
      }
    };
    reader.onerror = () => {
      setMessage('Could not read the file.', true);
      event.target.value = '';
    };
    reader.readAsText(file);
  });

  load();
})();
