import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDynatraceScript, getDynatraceScriptUrl } from '../../dist/dynatrace/index.js';

const scriptUrl = 'https://js-cdn.dynatrace.com/jstag/example/complete.js?a=1&b=2';
const document = '<html><head><meta charset="utf-8"><script src="/main.js"></script></head><body></body></html>';

test('selects a valid URL only when enabled', () => {
  assert.equal(getDynatraceScriptUrl({ enabled: true, scriptUrl }), scriptUrl);
  assert.equal(getDynatraceScriptUrl({ enabled: false, scriptUrl }), undefined);
  assert.equal(getDynatraceScriptUrl({ enabled: true }), undefined);
  assert.equal(getDynatraceScriptUrl({ enabled: true, scriptUrl: 123 }), undefined);
});

test('returns an absolute URL that keeps the validated host when resolved by a browser', () => {
  const result = getDynatraceScriptUrl({
    enabled: true,
    scriptUrl: 'https:js-cdn.dynatrace.com/complete.js',
  });

  assert.equal(result, 'https://js-cdn.dynatrace.com/complete.js');
  assert.equal(new URL(result, 'https://opal.example/app').hostname, 'js-cdn.dynatrace.com');
});

test('rejects unsafe and malformed script URLs', () => {
  for (const invalidUrl of [
    'http://js-cdn.dynatrace.com/jstag/complete.js',
    'https://dynatrace.com.evil.test/complete.js',
    'https://js-cdn.dynatrace.com.evil.test/complete.js',
    'https://js-cdn.dynatrace.com:444/complete.js',
    'https://user@js-cdn.dynatrace.com/complete.js',
    'https://js-cdn.dynatrace.com/complete.js#fragment',
    'https://js-cdn.dynatrace.com/not-a-script',
    'javascript:alert(1)',
    'https://js-cdn.dynatrace.com/complete.js" onerror="alert(1)',
  ]) {
    assert.equal(getDynatraceScriptUrl({ enabled: true, scriptUrl: invalidUrl }), undefined, invalidUrl);
  }
});

test('inserts an escaped, nonblocking script before application scripts', () => {
  const result = addDynatraceScript(document, { enabled: true, scriptUrl });
  assert.match(
    result,
    /<head><script type="text\/javascript" src="https:\/\/js-cdn\.dynatrace\.com\/jstag\/example\/complete\.js\?a=1&amp;b=2" crossorigin="anonymous" async><\/script><meta/,
  );
  assert.ok(result.indexOf('js-cdn.dynatrace.com') < result.indexOf('/main.js'));
});

test('inserts after the complete head tag when quoted attributes contain angle brackets', () => {
  for (const head of [
    '<head data-label="a>b">',
    "<head data-label='a>b'>",
    `<head data-first="a'b>c" data-second='a"b>c'>`,
  ]) {
    const html = `<html>${head}</head><body></body></html>`;
    const result = addDynatraceScript(html, { enabled: true, scriptUrl });

    assert.equal(
      result,
      `<html>${head}<script type="text/javascript" src="https://js-cdn.dynatrace.com/jstag/example/complete.js?a=1&amp;b=2" crossorigin="anonymous" async></script></head><body></body></html>`,
    );
  }
});

test('leaves the document untouched for disabled, missing, invalid, or headless configuration', () => {
  for (const configuration of [
    { enabled: false, scriptUrl },
    { enabled: true },
    { enabled: true, scriptUrl: 'https://example.com/complete.js' },
  ]) {
    assert.equal(addDynatraceScript(document, configuration), document);
  }
  assert.equal(addDynatraceScript('<body></body>', { enabled: true, scriptUrl }), '<body></body>');
});
