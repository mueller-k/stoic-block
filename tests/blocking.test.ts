import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BlockingService, emptySettings, normalizeHostname, readSettings, rulesFor, type BlockingPort } from '../src/blocking.ts';

function fixture() {
  let value: unknown;
  let pending: unknown;
  let installed: chrome.declarativeNetRequest.Rule[] = [];
  let failRules = false;
  let failStorage = false;
  const port: BlockingPort = {
    load: async () => structuredClone(value),
    store: async settings => {
      if (failStorage) { failStorage = false; throw new Error('storage unavailable'); }
      value = structuredClone(settings);
    },
    pending: async () => structuredClone(pending),
    begin: async previous => { pending = { previous: structuredClone(previous) }; },
    commit: async settings => { await port.store(settings); pending = null; },
    clearPending: async () => { pending = undefined; },
    clear: async () => { value = undefined; pending = undefined; },
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
  for (const value of ['', 'localhost', '127.0.0.1', '127.1', '0x7f000001', '[::1]', '*.example.com', 'example.com/path', 'a..com', '-a.com', 'a-.com', 'user@example.com', 'example.com:80', 'example.com?x=1', 'a%2ecom']) {
    assert.throws(() => normalizeHostname(value), Error, value);
  }
});

test('URL input normalizes to a hostname and public suffixes cannot be blocked', () => {
  assert.equal(normalizeHostname('https://BÜCHER.de.:8443/path%20name?q=*#part'), 'xn--bcher-kva.de');
  for (const input of ['https://user:pass@example.com/', 'ftp://example.com', 'co.uk', 'github.io']) {
    assert.throws(() => normalizeHostname(input), Error, input);
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
  assert.deepEqual(f.stored(), saved);
  assert.match(saved.revision!, /^[a-f0-9-]{36}$/);
  assert.deepEqual(f.installed(), rulesFor(saved));
  assert.deepEqual(f.installed()[0].condition, { regexFilter: '^https?://', requestDomains: ['example.test'], resourceTypes: ['main_frame'] });
  assert.deepEqual(f.installed()[0].action.redirect, { extensionPath: '/quote.html' });
  await assert.rejects(f.service.save('EXAMPLE.test.', true), /already/);
});

test('explicit children survive parent removal, and disabling preserves entries', async () => {
  const f = fixture();
  let settings = await f.service.save('news.example.test', true);
  settings = await f.service.save('example.test', true, settings);
  assert.deepEqual(settings.domains, ['news.example.test', 'example.test']);
  const stale = settings;
  settings = await f.service.remove('example.test', settings);
  assert.deepEqual(settings.domains, ['news.example.test']);
  await assert.rejects(f.service.setEnabled(false, stale), /another tab/);
  settings = await f.service.setEnabled(false, settings);
  assert.deepEqual(settings.domains, ['news.example.test']);
  assert.deepEqual(f.installed(), []);
  settings = await f.service.setEnabled(true, settings);
  assert.deepEqual(f.installed(), rulesFor(settings));
  settings = await f.service.remove('news.example.test', settings);
  assert.deepEqual(f.installed(), []);
});

test('blocklist capacity stops at 1,000 entries', async () => {
  const f = fixture();
  const settings = { version: 1 as const, domains: Array.from({ length: 1000 }, (_, i) => `site${i}.example.test`), enabled: true, consent: true };
  await f.port.store(settings);
  assert.equal((await f.service.current()).domains.length, 1000);
  await assert.rejects(f.service.save('extra.example.test', true, settings), /full/);
  assert.equal(f.installed().length, 1000);
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
  await assert.rejects(f.service.save('example.test', true), /Could not apply/);
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

test('malformed recovery data preserves the saved configuration and rules', async () => {
  const f = fixture();
  const saved = await f.service.save('example.test', true);
  await f.port.begin(undefined as unknown as null);
  await assert.rejects(f.service.current(), /Recovery data is unreadable/);
  assert.deepEqual(f.stored(), saved);
  assert.deepEqual(f.installed(), rulesFor(saved));
});

test('a rollback that cannot verify restored storage keeps recovery pending', async () => {
  const f = fixture();
  const saved = await f.service.save('example.test', true);
  const originalStore = f.port.store;
  let writes = 0;
  // Make the existing stored value disagree with the previous configuration only
  // after the service reads it, as an interrupted or defective storage write can.
  f.port.store = async settings => {
    writes++;
    if (writes === 1) {
      await originalStore({ ...settings, domains: ['unexpected.test'] });
      throw new Error('storage unavailable');
    }
    if (writes === 2) return;
    await originalStore(settings);
  };
  await assert.rejects(f.service.setEnabled(false, saved), /recovery could not finish/);
  assert.deepEqual(await f.port.pending(), { previous: saved });
  assert.deepEqual(await f.service.current(), saved);
  assert.deepEqual(f.installed(), rulesFor(saved));
});

test('interrupted recovery retains its marker until restored settings can be verified', async () => {
  const f = fixture();
  const saved = await f.service.save('example.test', true);
  await f.port.begin(saved);
  await f.port.store({ ...saved, domains: ['unexpected.test'] });
  const originalStore = f.port.store;
  f.port.store = async () => {};
  await assert.rejects(f.service.current(), /Recovery could not be verified/);
  assert.deepEqual(await f.port.pending(), { previous: saved });
  f.port.store = originalStore;
  assert.deepEqual(await f.service.current(), saved);
  assert.deepEqual(f.installed(), rulesFor(saved));
});
