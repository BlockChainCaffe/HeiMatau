const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('../url-core.js');

test('parseSite canonicalizes accepted forms', () => {
  assert.equal(U.parseSite('mail.google.com').host, 'mail.google.com');
  assert.equal(U.parseSite('https://Mail.Google.com/path?x=1').host, 'mail.google.com');
  assert.equal(U.parseSite('*.example.com').host, 'example.com');
  assert.equal(U.parseSite('example.com.').host, 'example.com');
  assert.equal(U.parseSite('münchen.de').host, 'xn--mnchen-3ya.de');
  assert.equal(U.parseSite('localhost').host, 'localhost');
  assert.equal(U.parseSite('192.168.1.1').host, '192.168.1.1');
});

test('parseSite rejects unsafe or incomplete entries', () => {
  assert.equal(U.parseSite('').error, 'empty');
  assert.equal(U.parseSite('user@example.com').error, 'userinfo');
  assert.equal(U.parseSite('co.uk').error, 'public-suffix');
  assert.equal(U.parseSite('com').error, 'needs-domain');
  assert.equal(U.parseSite('not a domain').error, 'invalid');
});

test('normalizeSites deduplicates and reports indexes', () => {
  const result = U.normalizeSites([
    'example.com',
    'https://example.com/path',
    'co.uk',
    '',
    'mail.google.com'
  ]);
  assert.deepEqual(result.sites, ['example.com', 'mail.google.com']);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].index, 2);
  assert.equal(result.errors[0].error, 'public-suffix');
});

test('isHostProtected matches hosts and subdomains only', () => {
  const sites = ['google.com', 'mail.google.com'];
  assert.equal(U.isHostProtected('google.com', sites), true);
  assert.equal(U.isHostProtected('mail.google.com', sites), true);
  assert.equal(U.isHostProtected('accounts.google.com', sites), true);
  assert.equal(U.isHostProtected('x.mail.google.com', sites), true);
  assert.equal(U.isHostProtected('notgoogle.com', sites), false);
  assert.equal(U.isHostProtected('google.com.evil.example', sites), false);
  assert.equal(U.isHostProtected('evil.example', sites), false);
});

test('unwrapUrl resolves Gmail redirects and double encoding', () => {
  const result = U.unwrapUrl('https://www.google.com/url?q=https%3A%2F%2Fevil.example%2Flogin%3Fa%3D1');
  assert.equal(result.url, 'https://evil.example/login?a=1');
  assert.equal(result.ambiguous, false);
  assert.equal(result.chain.length, 2);

  const double = U.unwrapUrl('https://www.google.com/url?q=https%253A%252F%252Fevil.example%252Fpath');
  assert.equal(double.url, 'https://evil.example/path');
  assert.equal(double.ambiguous, false);
});

test('unwrapUrl resolves other known wrappers', () => {
  const outlook = U.unwrapUrl('https://nam12.safelinks.protection.outlook.com/?url=https%3A%2F%2Fevil.example%2F&data=x');
  assert.equal(outlook.url, 'https://evil.example/');
  assert.equal(outlook.ambiguous, false);

  const facebook = U.unwrapUrl('https://l.facebook.com/l.php?u=https%3A%2F%2Fevil.example%2Fx');
  assert.equal(facebook.url, 'https://evil.example/x');

  const googleAmp = U.unwrapUrl('https://www.google.com/amp/s/evil.example/page');
  assert.equal(googleAmp.url, 'https://evil.example/page');
});

test('unwrapUrl resolves Google country redirects', () => {
  const result = U.unwrapUrl('https://www.google.co.uk/url?q=https%3A%2F%2Fevil.example%2F');
  assert.equal(result.url, 'https://evil.example/');
  assert.equal(result.ambiguous, false);
});

test('unwrapUrl does not trust lookalike Google hosts', () => {
  for (const host of ['google.xyz', 'google.com.evil', 'google.evil']) {
    const input = 'https://' + host + '/url?q=https%3A%2F%2Finternal.example%2F';
    const result = U.unwrapUrl(input);
    assert.equal(result.url, input);
    assert.equal(U.matchRedirector(input), null);
  }
});

test('unwrapUrl flags shorteners and unresolved redirects', () => {
  const shortener = U.unwrapUrl('https://bit.ly/abc123');
  assert.equal(shortener.ambiguous, true);
  assert.equal(shortener.reason, 'shortener');

  const unresolved = U.unwrapUrl('https://www.google.com/url?sa=D');
  assert.equal(unresolved.ambiguous, true);
  assert.equal(unresolved.reason, 'google');
});

test('cleanUrl removes tracking parameters but keeps content parameters', () => {
  const clean = U.cleanUrl('https://example.com/path?utm_source=x&id=1&fbclid=abc&utm_campaign=y#frag');
  assert.equal(clean, 'https://example.com/path?id=1#frag');
  assert.equal(U.cleanUrl('https://example.com/path?ref=abc'), 'https://example.com/path?ref=abc');
});

test('resolveLink uses saferedirect and produces a clean link', () => {
  const result = U.resolveLink({
    href: 'https://www.google.com/url?q=https%3A%2F%2Fevil.example%2Fpath%3Futm_source%3Dx%26id%3D1',
    saferedirect: 'https://evil.example/path?utm_source=x&id=1',
    baseURI: 'https://mail.google.com/'
  });
  assert.equal(result.originalUrl.indexOf('https://www.google.com/url?q='), 0);
  assert.equal(result.finalUrl, 'https://evil.example/path?utm_source=x&id=1');
  assert.equal(result.cleanUrl, 'https://evil.example/path?id=1');
  assert.equal(result.signals.some((signal) => signal.code === 'mismatch'), false);
});

test('resolveLink flags an inconsistent saferedirect', () => {
  const result = U.resolveLink({
    href: 'https://www.google.com/url?q=https%3A%2F%2Fevil.example%2F',
    saferedirect: 'https://other.example/',
    baseURI: 'https://mail.google.com/'
  });
  assert.equal(result.finalUrl, 'https://evil.example/');
  assert.equal(result.signals.some((signal) => signal.code === 'mismatch'), true);
});

test('resolveLink marks javascript URLs as unsafe', () => {
  const result = U.resolveLink({ href: 'javascript:alert(1)', baseURI: 'https://mail.google.com/' });
  assert.equal(result.unsafe, true);
  assert.equal(result.signals[0].code, 'unsafe');
});

test('analyzeHost decodes legitimate IDNs without homograph warning', () => {
  const analysis = U.analyzeHost('xn--mnchen-3ya.de');
  assert.equal(analysis.unicodeHost, 'münchen.de');
  assert.equal(analysis.homograph, false);
  assert.equal(analysis.confusable, false);
});

test('analyzeHost detects mixed-script homograph domains', () => {
  const analysis = U.analyzeHost('xn--pypal-4ve.com');
  assert.equal(analysis.unicodeHost, 'pаypal.com');
  assert.equal(analysis.homograph, true);
  assert.equal(analysis.mixedWithLatin, true);
  assert.equal(analysis.confusable, true);
  assert.equal(analysis.skeletonHost, 'paypal.com');
  assert.deepEqual(analysis.scripts.sort(), ['Cyrillic', 'Latin']);
});

test('resolveLink surfaces homograph signals and analysis', () => {
  const result = U.resolveLink({ href: 'https://xn--pypal-4ve.com/', baseURI: 'https://mail.google.com/' });
  assert.equal(result.hostAnalysis.homograph, true);
  assert.equal(result.hostAnalysis.unicodeHost, 'pаypal.com');
  assert.equal(result.signals.some((signal) => signal.code === 'homograph'), true);
});

test('link text containing a different domain raises a mismatch signal', () => {
  const result = U.resolveLink({
    href: 'https://evil.example/login',
    linkText: 'https://paypal.com/login',
    baseURI: 'https://mail.google.com/'
  });
  assert.equal(result.signals.some((signal) => signal.code === 'textMismatch'), true);
});
