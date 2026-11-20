import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BlockingService, emptySettings, normalizeHostname, readSettings, rulesFor, type BlockingPort } from '../src/blocking.ts';

function fixture() {
  let value: unknown;
  let installed: chrome.declarativeNetRequest.Rule[] = [];
  let failRules = false;
  let failStorage = false;
  const port: BlockingPort = {
    load: async () => structuredClone(value),
    store: async settings => {
      if (failStorage) { failStorage = false; throw new Error('storage unavailable'); }
      value = structuredClone(settings);
    },
    rules: async () => structuredClone(installed),
    replace: async rules => {
      if (failRules) { failRules = false; throw new Error('rule update rejected'); }
      installed = structuredClone(rules);
    },
  };
  return {
    service: new BlockingService(port), port,
    stored: () => value,
    installed: () => installed,
    failRules: () => { failRules = true; },
    failStorage: () => { failStorage = true; },
    corrupt: () => { value = { domains: ['example.test'] }; },
  };
}

test('hostname normalization preserves explicit subdomains and handles case, IDNs and trailing dots', () => {
  assert.equal(normalizeHostname(' News.Example.COM. '), 'news.example.com');
  assert.equal(normalizeHostname('bücher.de'), 'xn--bcher-kva.de');
  for (const value of ['', 'localhost', '127.0.0.1', '127.1', '0x7f000001', '[::1]', '*.example.com', 'https://example.com', 'example.com/path', 'a..com', '-a.com', 'a-.com', 'user@example.com', 'example.com:80', 'example.com?x=1', 'a%2ecom']) {
    assert.throws(() => normalizeHostname(value), Error, value);
  }
});

test('empty installation creates no rules or stored configuration, and consent is required', async () => {
  const f = fixture();
  assert.deepEqual(await f.service.current(), emptySettings());
  await assert.rejects(f.service.save('example.test', false), /confirm/);
  assert.equal(f.stored(), undefined);
  assert.deepEqual(f.installed(), []);
});

test('save installs one HTTP(S) top-level rule with a constant quote URL and only configuration in storage', async () => {
  const f = fixture();
  const saved = await f.service.save('EXAMPLE.TEST', true);
  assert.deepEqual(f.stored(), { version: 1, domains: ['example.test'], enabled: true, consent: true });
  assert.deepEqual(f.installed(), rulesFor(saved));
  assert.deepEqual(f.installed()[0].condition, { regexFilter: '^https?://', requestDomains: ['example.test'], resourceTypes: ['main_frame'] });
  assert.deepEqual(f.installed()[0].action.redirect, { extensionPath: '/quote.html' });
  await assert.rejects(f.service.save('other.test', true), /already saved/);
});

test('rule update failure restores previous settings and remains visibly failed', async () => {
  const f = fixture();
  f.failRules();
  await assert.rejects(f.service.save('example.test', true), /Previous settings were restored/);
  assert.deepEqual(f.installed(), []);
  assert.deepEqual(f.stored(), emptySettings());
});

test('storage failure rolls back newly installed rules', async () => {
  const f = fixture();
  f.failStorage();
  await assert.rejects(f.service.save('example.test', true), /Previous settings were restored/);
  assert.deepEqual(f.installed(), []);
  assert.deepEqual(f.stored(), emptySettings());
});

test('a new worker reconciles an interrupted uncommitted rule change to committed settings', async () => {
  const f = fixture();
  await f.port.replace(rulesFor({ version: 1, domains: ['example.test'], enabled: true, consent: true }));
  const restarted = new BlockingService(f.port);
  assert.deepEqual(await restarted.current(), emptySettings());
  assert.deepEqual(f.installed(), []);
});

test('committed configuration reinstates rules after restart without recording visits', async () => {
  const f = fixture();
  const saved = await f.service.save('example.test', true);
  await f.port.replace([]);
  assert.deepEqual(await new BlockingService(f.port).current(), saved);
  assert.deepEqual(f.installed(), rulesFor(saved));
});

test('unverified rules cannot be reported as a successful save', async () => {
  const f = fixture();
  f.port.replace = async () => {};
  await assert.rejects(f.service.save('example.test', true), /Could not save/);
  assert.deepEqual(f.stored(), emptySettings());
});

test('corrupt configuration is preserved and is not silently applied or reset', async () => {
  const f = fixture();
  f.corrupt();
  await assert.rejects(f.service.current(), /preserved/);
  assert.deepEqual(f.stored(), { domains: ['example.test'] });
  assert.deepEqual(f.installed(), []);
  assert.throws(() => readSettings({ version: 1, domains: ['example.test'], enabled: true, consent: false }));
});
