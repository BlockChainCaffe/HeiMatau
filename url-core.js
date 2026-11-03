(function (root) {
  'use strict';

  const MAX_REDIRECTS = 6;
  const XLINK = 'http://www.w3.org/1999/xlink';

  const SHORTENERS = new Set([
    'bit.ly', 'bitly.com', 't.co', 'tinyurl.com', 'goo.gl', 'ow.ly', 'is.gd',
    'buff.ly', 'rebrand.ly', 'cutt.ly', 'shorturl.at', 'rb.gy', 's.id', 'tiny.cc',
    'lnkd.in', 'trib.al', 'dlvr.it', 'ift.tt', 'v.gd', 'shorte.st', 'adf.ly',
    'bl.ink', 't.ly', 'short.io', 'linktr.ee'
  ]);

  const GOOGLE_BASE_DOMAINS = new Set([
    'google.com', 'google.co.uk', 'google.ca', 'google.de', 'google.fr', 'google.it',
    'google.es', 'google.nl', 'google.com.au', 'google.co.jp', 'google.co.in',
    'google.com.br', 'google.com.mx', 'google.com.ar', 'google.com.tr', 'google.co.za',
    'google.ch', 'google.at', 'google.be', 'google.se', 'google.no', 'google.dk',
    'google.fi', 'google.pl', 'google.ru', 'google.com.ua', 'google.co.il',
    'google.com.sg', 'google.com.hk', 'google.com.tw', 'google.co.kr', 'google.co.nz',
    'google.pt', 'google.gr', 'google.cz', 'google.ro', 'google.hu', 'google.ie',
    'google.ae', 'google.com.sa', 'google.com.eg', 'google.com.ng', 'google.co.ke',
    'google.com.pk', 'google.com.ph', 'google.com.vn', 'google.co.id', 'google.com.my',
    'google.co.th', 'google.com.co', 'google.cl', 'google.com.pe', 'google.com.uy',
    'google.com.ec', 'google.com.ve', 'google.com.py', 'google.com.bo', 'google.com.do',
    'google.com.gt', 'google.com.sv', 'google.com.hn', 'google.com.ni', 'google.com.pa',
    'google.com.pr', 'google.co.cr', 'google.com.bz', 'google.com.jm', 'google.com.vc',
    'google.com.gi', 'google.com.mt', 'google.com.cy', 'google.cat'
  ]);

  const PUBLIC_SUFFIXES = new Set([
    'co.uk', 'org.uk', 'me.uk', 'ltd.uk', 'plc.uk', 'net.uk', 'sch.uk', 'ac.uk',
    'gov.uk', 'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'id.au', 'asn.au',
    'co.nz', 'net.nz', 'org.nz', 'govt.nz', 'ac.nz', 'co.jp', 'ne.jp', 'or.jp',
    'ac.jp', 'go.jp', 'co.kr', 'or.kr', 'ne.kr', 'go.kr', 'com.br', 'net.br',
    'org.br', 'gov.br', 'edu.br', 'com.mx', 'org.mx', 'net.mx', 'gob.mx', 'com.ar',
    'net.ar', 'org.ar', 'gov.ar', 'com.co', 'net.co', 'org.co', 'gov.co', 'com.cn',
    'net.cn', 'org.cn', 'gov.cn', 'edu.cn', 'com.hk', 'net.hk', 'org.hk', 'gov.hk',
    'edu.hk', 'com.tw', 'net.tw', 'org.tw', 'gov.tw', 'edu.tw', 'com.sg', 'net.sg',
    'org.sg', 'gov.sg', 'edu.sg', 'com.my', 'net.my', 'org.my', 'gov.my', 'edu.my',
    'com.ph', 'net.ph', 'org.ph', 'gov.ph', 'com.vn', 'net.vn', 'org.vn', 'gov.vn',
    'co.in', 'net.in', 'org.in', 'firm.in', 'gen.in', 'ind.in', 'gov.in', 'ac.in',
    'edu.in', 'co.za', 'net.za', 'org.za', 'gov.za', 'ac.za', 'co.il', 'net.il',
    'org.il', 'gov.il', 'ac.il', 'com.tr', 'net.tr', 'org.tr', 'gov.tr', 'edu.tr',
    'com.sa', 'net.sa', 'org.sa', 'gov.sa', 'edu.sa', 'com.eg', 'net.eg', 'org.eg',
    'gov.eg', 'edu.eg', 'com.ng', 'net.ng', 'org.ng', 'gov.ng', 'edu.ng', 'co.ke',
    'or.ke', 'ne.ke', 'go.ke', 'ac.ke', 'co.id', 'or.id', 'net.id', 'go.id', 'ac.id',
    'com.pk', 'net.pk', 'org.pk', 'gov.pk', 'edu.pk', 'com.ua', 'net.ua', 'org.ua',
    'gov.ua', 'edu.ua', 'com.ru', 'net.ru', 'org.ru', 'gov.ru', 'edu.ru'
  ]);

  const TRACKING_EXACT = new Set([
    'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid', 'twclid',
    'yclid', 'igshid', 'igsh', 'mc_cid', 'mc_eid', '_ga', '_gl', '_gac', 'srsltid',
    'mkt_tok', 'vero_id', 'vero_conv', 'wickedid', 'sc_cid', 'cmpid', 'campaign_id',
    'ad_id', 'adset_id', 'fb_action_ids', 'fb_action_types', 'fb_source', 'fb_ref',
    'si', 'spm', 'scm', 'trk', 'trkcampaign', 'ncid', 'oly_anon_id', 'oly_enc_id',
    '__twitter_impression', 'guccounter', 'guce_referrer', 'guce_referrer_sig',
    'soc_src', 'soc_trk', 'at_medium', 'at_campaign', '_hsenc', '_hsmi',
    'hsctatracking', 'elqtrackid', 'elqtrack', 'elqaid', 'elqat', 'elqcampaignid'
  ]);

  const TRACKING_PREFIXES = ['utm_', 'mtm_', 'pk_', 'hsa_', '_hs'];

  const SIGNALS = {
    unsafe: ['Unsafe protocol', 'danger'],
    unresolved: ['Destination not resolved', 'danger'],
    shortener: ['Shortened link', 'danger'],
    idn: ['Internationalized domain', 'warn'],
    homograph: ['Confusable Unicode characters', 'danger'],
    ip: ['IP address', 'warn'],
    userinfo: ['Credentials in URL', 'danger'],
    http: ['Unencrypted connection', 'warn'],
    port: ['Non-standard port', 'warn'],
    subdomains: ['Many subdomains', 'warn'],
    redirect: ['Redirect', 'info'],
    mismatch: ['Inconsistent destination', 'danger'],
    textMismatch: ['Link text differs from destination', 'danger']
  };

  const SCRIPT_PATTERNS = {
    Latin: /\p{Script=Latin}/u,
    Cyrillic: /\p{Script=Cyrillic}/u,
    Greek: /\p{Script=Greek}/u,
    Arabic: /\p{Script=Arabic}/u,
    Hebrew: /\p{Script=Hebrew}/u,
    Devanagari: /\p{Script=Devanagari}/u,
    Han: /\p{Script=Han}/u,
    Hiragana: /\p{Script=Hiragana}/u,
    Katakana: /\p{Script=Katakana}/u,
    Hangul: /\p{Script=Hangul}/u,
    Thai: /\p{Script=Thai}/u,
    Armenian: /\p{Script=Armenian}/u,
    Georgian: /\p{Script=Georgian}/u,
    Bengali: /\p{Script=Bengali}/u,
    Tamil: /\p{Script=Tamil}/u,
    Telugu: /\p{Script=Telugu}/u,
    Malayalam: /\p{Script=Malayalam}/u
  };

  const CONFUSABLES = {
    'а': 'a', 'в': 'b', 'г': 'r', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'x',
    'з': '3', 'и': 'u', 'й': 'u', 'к': 'k', 'л': 'n', 'м': 'm', 'н': 'h',
    'о': 'o', 'п': 'n', 'р': 'p', 'с': 'c', 'т': 't', 'у': 'y', 'ф': 'f',
    'х': 'x', 'ц': 'u', 'ч': '4', 'ш': 'w', 'щ': 'w', 'ъ': 'b', 'ы': 'bi',
    'ь': 'b', 'э': 'e', 'ю': 'io', 'я': 'r', 'ѐ': 'e', 'ѓ': 'r', 'ќ': 'k',
    'љ': 'n', 'њ': 'n', 'ћ': 'c', 'џ': 'u', 'ѕ': 's', 'і': 'i', 'ї': 'i',
    'ј': 'j', 'ԁ': 'd', 'ԛ': 'q', 'ԝ': 'w', 'һ': 'h', 'ӏ': 'l', 'ɡ': 'g',
    'ɑ': 'a', 'ɒ': 'a', 'ɔ': 'o', 'ɛ': 'e', 'ɩ': 'i', 'ʏ': 'y', 'α': 'a',
    'β': 'b', 'γ': 'y', 'δ': 'd', 'ε': 'e', 'ζ': 'z', 'η': 'n', 'θ': 'o',
    'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'u', 'ν': 'v', 'ξ': 'e', 'ο': 'o',
    'π': 'n', 'ρ': 'p', 'σ': 'o', 'ς': 's', 'τ': 't', 'υ': 'u', 'φ': 'f',
    'χ': 'x', 'ψ': 'y', 'ω': 'w', 'ı': 'i', 'ȷ': 'j', 'ℓ': 'l', 'æ': 'ae',
    'ø': 'o', 'đ': 'd', 'ð': 'd', 'þ': 'p', 'ß': 'ss'
  };

  function makeSignal(code) {
    const def = SIGNALS[code] || [code, 'info'];
    return { code: code, label: def[0], level: def[1] };
  }

  function isIp(host) {
    if (!host) return false;
    if (host.charAt(0) === '[' && host.charAt(host.length - 1) === ']') return true;
    const parts = host.split('.');
    if (parts.length !== 4) return false;
    return parts.every(function (part) {
      return /^\d{1,3}$/.test(part) && Number(part) <= 255;
    });
  }

  function canonicalHost(value) {
    if (value === null || value === undefined) return '';
    let text = String(value).trim().toLowerCase();
    if (!text) return '';
    if (text.charAt(0) === '[' && text.charAt(text.length - 1) === ']') return text;
    if (text.charAt(0) === '.') text = text.slice(1);
    try {
      return new URL('http://' + text).hostname.replace(/\.$/, '').toLowerCase();
    } catch (e) {
      return '';
    }
  }

  function isPublicSuffix(host) {
    return PUBLIC_SUFFIXES.has(host);
  }

  function parseSite(value) {
    let raw = value === null || value === undefined ? '' : String(value).trim();
    if (!raw) return { error: 'empty' };
    raw = raw.replace(/^\*\./, '');
    if (raw.slice(0, 2) === '//') raw = 'http:' + raw;
    let url;
    try {
      url = new URL(raw.indexOf('://') !== -1 ? raw : 'http://' + raw);
    } catch (e) {
      return { error: 'invalid' };
    }
    if (url.username || url.password) return { error: 'userinfo' };
    const host = canonicalHost(url.hostname);
    if (!host) return { error: 'invalid' };
    if (host.indexOf('*') !== -1) return { error: 'invalid' };
    if (isPublicSuffix(host)) return { error: 'public-suffix' };
    if (host.indexOf('.') === -1 && !isIp(host) && host !== 'localhost') {
      return { error: 'needs-domain' };
    }
    return { host: host };
  }

  function normalizeSites(list) {
    const sites = [];
    const errors = [];
    const seen = new Set();
    const values = Array.isArray(list) ? list : [];
    values.forEach(function (value, index) {
      const raw = value === null || value === undefined ? '' : String(value).trim();
      if (!raw) return;
      const parsed = parseSite(raw);
      if (parsed.error) {
        errors.push({ index: index, input: raw, error: parsed.error });
        return;
      }
      if (!seen.has(parsed.host)) {
        seen.add(parsed.host);
        sites.push(parsed.host);
      }
    });
    return { sites: sites, errors: errors };
  }

  function isHostInSite(host, site) {
    const h = canonicalHost(host);
    const s = canonicalHost(site);
    if (!h || !s) return false;
    return h === s || h.slice(-(s.length + 1)) === '.' + s;
  }

  function isHostProtected(host, sites) {
    if (!Array.isArray(sites)) return false;
    const h = canonicalHost(host);
    if (!h) return false;
    return sites.some(function (site) {
      return isHostInSite(h, site);
    });
  }

  function isHttp(value) {
    try {
      const url = value instanceof URL ? value : new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  function isUnsafe(value) {
    try {
      const url = value instanceof URL ? value : new URL(value);
      return url.protocol === 'javascript:' || url.protocol === 'data:' || url.protocol === 'vbscript:';
    } catch (e) {
      return false;
    }
  }

  function absoluteUrl(raw, base) {
    if (raw === null || raw === undefined) return null;
    try {
      return new URL(String(raw), base || undefined).href;
    } catch (e) {
      return null;
    }
  }

  function adapt(delta, numPoints, firstTime) {
    const base = 36;
    const tMin = 1;
    const tMax = 26;
    const skew = 38;
    const damp = 700;
    delta = firstTime ? Math.floor(delta / damp) : delta >> 1;
    delta += Math.floor(delta / numPoints);
    let k = 0;
    while (delta > (((base - tMin) * tMax) >> 1)) {
      delta = Math.floor(delta / (base - tMin));
      k += base;
    }
    return Math.floor(k + (((base - tMin + 1) * delta) / (delta + skew)));
  }

  function decodePunycode(input) {
    const base = 36;
    const tMin = 1;
    const tMax = 26;
    const initialBias = 72;
    const initialN = 128;
    let n = initialN;
    let i = 0;
    let bias = initialBias;
    const output = [];
    let basic = input.lastIndexOf('-');
    if (basic < 0) basic = 0;
    for (let j = 0; j < basic; j += 1) output.push(input.charCodeAt(j));
    let index = basic > 0 ? basic + 1 : 0;
    while (index < input.length) {
      const oldi = i;
      let w = 1;
      for (let k = base; ; k += base) {
        if (index >= input.length) return null;
        const code = input.charCodeAt(index);
        index += 1;
        let digit;
        if (code >= 48 && code <= 57) digit = code - 22;
        else if (code >= 65 && code <= 90) digit = code - 65;
        else if (code >= 97 && code <= 122) digit = code - 97;
        else return null;
        i += digit * w;
        const t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
        if (digit < t) break;
        w *= base - t;
        if (w > 0x7fffffff) return null;
      }
      const out = output.length + 1;
      bias = adapt(i - oldi, out, oldi === 0);
      n += Math.floor(i / out);
      i %= out;
      output.splice(i, 0, n);
      i += 1;
    }
    try {
      return String.fromCodePoint.apply(null, output);
    } catch (e) {
      return null;
    }
  }

  function toUnicodeHost(host) {
    return String(host || '').split('.').map(function (label) {
      if (!/^xn--/i.test(label)) return label;
      const decoded = decodePunycode(label.slice(4));
      return decoded === null ? label : decoded;
    }).join('.');
  }

  function scriptsOf(value) {
    const found = new Set();
    for (const ch of String(value || '')) {
      if (!/\p{L}/u.test(ch)) continue;
      for (const name in SCRIPT_PATTERNS) {
        if (SCRIPT_PATTERNS[name].test(ch)) {
          found.add(name);
          break;
        }
      }
    }
    return Array.from(found);
  }

  function analyzeHost(host) {
    const asciiHost = canonicalHost(host);
    const empty = {
      asciiHost: asciiHost,
      unicodeHost: asciiHost,
      normalizedHost: asciiHost,
      skeletonHost: asciiHost,
      scripts: [],
      mixedScript: false,
      mixedWithLatin: false,
      confusable: false,
      compatibility: false,
      invisible: false,
      homograph: false
    };
    if (!asciiHost || isIp(asciiHost)) return empty;
    const unicodeHost = toUnicodeHost(asciiHost);
    const lower = unicodeHost.toLowerCase();
    const normalizedHost = lower.normalize('NFKC');
    const skeletonHost = Array.from(normalizedHost).map(function (ch) {
      return CONFUSABLES[ch] || ch;
    }).join('');
    const scripts = scriptsOf(normalizedHost);
    const mixedScript = scripts.length > 1;
    const mixedWithLatin = scripts.indexOf('Latin') !== -1 && scripts.some(function (name) {
      return name !== 'Latin';
    });
    const confusable = skeletonHost !== normalizedHost;
    const compatibility = normalizedHost !== lower;
    const invisible = /[\u00ad\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u.test(unicodeHost);
    return {
      asciiHost: asciiHost,
      unicodeHost: unicodeHost,
      normalizedHost: normalizedHost,
      skeletonHost: skeletonHost,
      scripts: scripts,
      mixedScript: mixedScript,
      mixedWithLatin: mixedWithLatin,
      confusable: confusable,
      compatibility: compatibility,
      invisible: invisible,
      homograph: invisible || compatibility || mixedWithLatin
    };
  }

  function hostEndsWith(host, suffix) {
    return host === suffix || host.slice(-(suffix.length + 1)) === '.' + suffix;
  }

  function isGoogleRedirectHost(host) {
    const h = canonicalHost(host);
    if (!h) return false;
    return Array.from(GOOGLE_BASE_DOMAINS).some(function (base) {
      return hostEndsWith(h, base);
    });
  }

  function matchRedirector(input) {
    let url;
    try {
      url = input instanceof URL ? input : new URL(input);
    } catch (e) {
      return null;
    }
    if (!isHttp(url)) return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    const path = url.pathname;
    const get = function (name) {
      return url.searchParams.get(name);
    };

    if (isGoogleRedirectHost(host)) {
      if (path === '/url' || path === '/url/') {
        return { via: 'google', candidate: get('q') || get('url') };
      }
      if (path.indexOf('/amp/s/') === 0) {
        const rest = path.slice('/amp/s/'.length);
        if (rest) {
          return { via: 'google-amp', candidate: 'https://' + rest + url.search + url.hash };
        }
      }
    }

    if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
      if (path === '/redirect') {
        return { via: 'youtube', candidate: get('q') || get('url') };
      }
    }

    if (host === 'l.facebook.com' || host === 'lm.facebook.com') {
      if (path === '/l.php') return { via: 'facebook', candidate: get('u') };
    }

    if (host === 'l.instagram.com') {
      return { via: 'instagram', candidate: get('u') };
    }

    if (hostEndsWith(host, 'linkedin.com') && path.indexOf('/redir/redirect') === 0) {
      return { via: 'linkedin', candidate: get('url') };
    }

    if (hostEndsWith(host, 'safelinks.protection.outlook.com')) {
      return { via: 'outlook', candidate: get('url') };
    }

    if (hostEndsWith(host, 'urldefense.proofpoint.com') || hostEndsWith(host, 'urldefense.com')) {
      if (path.indexOf('/v3/__') !== -1) {
        const match = path.match(/\/v3\/__(.+?)__(?:;|$)/);
        return { via: 'proofpoint', candidate: match ? match[1] : null };
      }
      return { via: 'proofpoint', candidate: get('u') };
    }

    if (hostEndsWith(host, 'linkprotect.cudasvc.com')) {
      return { via: 'barracuda', candidate: get('a') || get('url') };
    }

    return null;
  }

  function isShortener(host) {
    const h = canonicalHost(host).replace(/^www\./, '');
    return SHORTENERS.has(h);
  }

  function normalizeCandidate(raw, baseUrl) {
    if (raw === null || raw === undefined) return null;
    let text = String(raw).trim();
    if (!text) return null;
    text = text.replace(/^['"]|['"]$/g, '');
    for (let i = 0; i < 3; i += 1) {
      if (!/%[0-9a-f]{2}/i.test(text)) break;
      try {
        const decoded = decodeURIComponent(text);
        if (decoded === text) break;
        text = decoded;
      } catch (e) {
        break;
      }
    }
    text = text.replace(/&amp;/g, '&');
    if (text.slice(0, 2) === '//') {
      text = (baseUrl ? baseUrl.protocol : 'https:') + text;
    } else if (!/^[a-z][a-z0-9+.-]*:/i.test(text) && /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/:?#]|$)/i.test(text)) {
      text = 'https://' + text;
    }
    try {
      return new URL(text, baseUrl || undefined);
    } catch (e) {
      return null;
    }
  }

  function unwrapUrl(input) {
    const absolute = absoluteUrl(input, undefined);
    if (!absolute) {
      return { url: String(input || ''), chain: [], ambiguous: false, reason: '' };
    }
    let current;
    try {
      current = new URL(absolute);
    } catch (e) {
      return { url: absolute, chain: [absolute], ambiguous: false, reason: '' };
    }
    const chain = [current.href];
    if (!isHttp(current)) {
      return { url: current.href, chain: chain, ambiguous: false, reason: '' };
    }
    const seen = new Set([current.href]);
    let ambiguous = false;
    let reason = '';
    for (let depth = 0; depth < MAX_REDIRECTS; depth += 1) {
      const match = matchRedirector(current);
      if (!match) break;
      if (!match.candidate) {
        ambiguous = true;
        reason = match.via;
        break;
      }
      const candidate = normalizeCandidate(match.candidate, current);
      if (!candidate) {
        ambiguous = true;
        reason = match.via;
        break;
      }
      if (seen.has(candidate.href) || candidate.href === current.href) {
        ambiguous = true;
        reason = 'loop';
        break;
      }
      seen.add(candidate.href);
      chain.push(candidate.href);
      current = candidate;
    }
    if (matchRedirector(current)) {
      ambiguous = true;
      reason = reason || 'depth';
    }
    if (isShortener(current.hostname)) {
      ambiguous = true;
      reason = reason || 'shortener';
    }
    return { url: current.href, chain: chain, ambiguous: ambiguous, reason: reason };
  }

  function isTracking(name) {
    const lower = name.toLowerCase();
    if (TRACKING_EXACT.has(lower)) return true;
    return TRACKING_PREFIXES.some(function (prefix) {
      return lower.indexOf(prefix) === 0;
    });
  }

  function cleanUrl(input) {
    const absolute = absoluteUrl(input, undefined);
    if (!absolute) return String(input || '');
    let url;
    try {
      url = new URL(absolute);
    } catch (e) {
      return absolute;
    }
    if (!isHttp(url)) return absolute;
    Array.from(url.searchParams.keys()).forEach(function (name) {
      if (isTracking(name)) url.searchParams.delete(name);
    });
    return url.href;
  }

  function extractHostsFromText(text) {
    const value = String(text || '');
    const hosts = new Set();
    const add = function (raw) {
      const absolute = absoluteUrl(raw, undefined);
      if (!absolute) return;
      try {
        const url = new URL(absolute);
        if (url.hostname) hosts.add(url.hostname);
      } catch (e) {}
    };
    let match;
    const urlRe = /\bhttps?:\/\/[^\s<>"'`]+/gi;
    while ((match = urlRe.exec(value))) add(match[0]);
    const wwwRe = /\bwww\.[a-z0-9-]+(?:\.[a-z0-9-]+)+[^\s<>"'`]*/gi;
    while ((match = wwwRe.exec(value))) add('http://' + match[0]);
    const whole = value.trim();
    if (/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(whole)) {
      hosts.add(whole);
    }
    return Array.from(hosts);
  }

  function linkTextMismatch(text, destinationHost) {
    const hosts = extractHostsFromText(text);
    if (!hosts.length) return false;
    const destination = canonicalHost(destinationHost);
    if (!destination) return false;
    return hosts.some(function (value) {
      const host = canonicalHost(value);
      if (!host) return false;
      return !(host === destination || host.slice(-(destination.length + 1)) === '.' + destination || destination.slice(-(host.length + 1)) === '.' + host);
    });
  }

  function classifyUrl(finalUrl, context) {
    const ctx = context || {};
    const out = [];
    const add = function (code) {
      if (!out.some(function (item) { return item.code === code; })) out.push(makeSignal(code));
    };
    let url;
    try {
      url = finalUrl instanceof URL ? finalUrl : new URL(finalUrl);
    } catch (e) {
      return out;
    }
    if (!isHttp(url)) {
      add('unsafe');
      return out;
    }
    const host = canonicalHost(url.hostname);
    const analysis = analyzeHost(host);
    if (host.indexOf('xn--') !== -1) add('idn');
    if (analysis.homograph) add('homograph');
    if (isIp(host)) add('ip');
    if (url.username || url.password) add('userinfo');
    if (url.protocol === 'http:') add('http');
    if (url.port && url.port !== '80' && url.port !== '443') add('port');
    if (host.split('.').length >= 5) add('subdomains');
    if (isShortener(host)) add('shortener');
    if (ctx.ambiguous) add(ctx.reason === 'shortener' ? 'shortener' : 'unresolved');
    if (Array.isArray(ctx.chain) && ctx.chain.length > 2) add('redirect');
    if (ctx.saferedirectMismatch) add('mismatch');
    if (ctx.linkText && linkTextMismatch(ctx.linkText, host)) add('textMismatch');
    return out;
  }

  function resolveLink(options) {
    const opts = options || {};
    const originalUrl = absoluteUrl(opts.href, opts.baseURI);
    if (!originalUrl) return null;
    let original;
    try {
      original = new URL(originalUrl);
    } catch (e) {
      return null;
    }
    if (!isHttp(original)) {
      const unsafe = isUnsafe(original);
      return {
        originalUrl: originalUrl,
        finalUrl: originalUrl,
        cleanUrl: originalUrl,
        chain: [originalUrl],
        ambiguous: false,
        reason: '',
        unsafe: unsafe,
        signals: unsafe ? [makeSignal('unsafe')] : [],
        hostAnalysis: analyzeHost('')
      };
    }
    const hrefResolution = unwrapUrl(originalUrl);
    let finalUrl = hrefResolution.url;
    let chain = hrefResolution.chain;
    let ambiguous = hrefResolution.ambiguous;
    let reason = hrefResolution.reason;
    let saferedirectMismatch = false;
    if (opts.saferedirect) {
      const safeAbsolute = absoluteUrl(opts.saferedirect, opts.baseURI);
      if (safeAbsolute) {
        let safeUrl;
        try {
          safeUrl = new URL(safeAbsolute);
        } catch (e) {
          safeUrl = null;
        }
        if (safeUrl && isHttp(safeUrl) && matchRedirector(original)) {
          const safeResolution = unwrapUrl(safeAbsolute);
          if (hrefResolution.ambiguous) {
            finalUrl = safeResolution.url;
            chain = [originalUrl].concat(safeResolution.chain.filter(function (item) {
              return item !== originalUrl;
            }));
            ambiguous = safeResolution.ambiguous;
            reason = safeResolution.reason;
          } else {
            const a = cleanUrl(hrefResolution.url);
            const b = cleanUrl(safeResolution.url);
            if (a && b && a !== b) saferedirectMismatch = true;
          }
        }
      }
    }
    const clean = cleanUrl(finalUrl);
    const signals = classifyUrl(finalUrl, {
      originalUrl: originalUrl,
      linkText: opts.linkText || '',
      chain: chain,
      ambiguous: ambiguous,
      reason: reason,
      saferedirectMismatch: saferedirectMismatch
    });
    let finalHost = '';
    try {
      finalHost = new URL(finalUrl).hostname;
    } catch (e) {}
    return {
      originalUrl: originalUrl,
      finalUrl: finalUrl,
      cleanUrl: clean,
      chain: chain,
      ambiguous: ambiguous,
      reason: reason,
      unsafe: false,
      signals: signals,
      hostAnalysis: analyzeHost(finalHost)
    };
  }

  function signalLabel(code) {
    const def = SIGNALS[code];
    return def ? def[0] : code;
  }

  const api = {
    MAX_REDIRECTS: MAX_REDIRECTS,
    XLINK: XLINK,
    parseSite: parseSite,
    normalizeSites: normalizeSites,
    canonicalHost: canonicalHost,
    isHostInSite: isHostInSite,
    isHostProtected: isHostProtected,
    isIp: isIp,
    isPublicSuffix: isPublicSuffix,
    isHttp: isHttp,
    isUnsafe: isUnsafe,
    absoluteUrl: absoluteUrl,
    matchRedirector: matchRedirector,
    unwrapUrl: unwrapUrl,
    cleanUrl: cleanUrl,
    resolveLink: resolveLink,
    classifyUrl: classifyUrl,
    analyzeHost: analyzeHost,
    toUnicodeHost: toUnicodeHost,
    decodePunycode: decodePunycode,
    extractHostsFromText: extractHostsFromText,
    signalLabel: signalLabel,
    isShortener: isShortener
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HeiMatauUrl = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
