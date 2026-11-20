import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer, type Server } from 'node:http';

async function recoverySnapshot(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const data = await chrome.storage.local.get(['settings', 'pending', 'resetRevision']);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  });
}

test('consent → saved rules → actual redirected navigation, with configuration surviving a browser restart', async ({}, testInfo) => {
  const profile = await mkdtemp(join(tmpdir(), 'stoic-block-browser-'));
  const extension = resolve('dist');
  const externalRequests: string[] = [];
  const browserErrors: string[] = [];
  let context: BrowserContext | undefined;
  let server: Server | undefined;
  try {
    server = createServer((request, response) => {
      response.setHeader('Content-Type', 'text/html');
      response.end(request.url === '/frame' ? '<h1>Frame content</h1>' : '<h1>Ordinary site</h1><iframe src="/frame"></iframe>');
    });
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No test server address');
    const port = address.port;
    const launch = async () => {
      const browser = await chromium.launchPersistentContext(profile, {
        channel: 'chromium',
        headless: true,
        args: [
          `--disable-extensions-except=${extension}`, `--load-extension=${extension}`,
          '--no-proxy-server',
          '--host-resolver-rules=MAP example.test 127.0.0.1,MAP *.example.test 127.0.0.1,MAP unrelated.test 127.0.0.1',
        ],
      });
      browser.on('page', page => page.on('pageerror', error => browserErrors.push(error.message)));
      browser.on('request', request => {
        if (!/^https?:/.test(request.url())) return;
        const host = new URL(request.url()).hostname;
        if (host.endsWith('.test') || host === '127.0.0.1') return;
        const initiator = request.serviceWorker()?.url() ?? request.frame().url();
        if (initiator.startsWith('chrome-extension://')) externalRequests.push(request.url());
      });
      return browser;
    };
    context = await launch();
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).hostname;
    const state = () => worker.evaluate(async () => ({
      storage: await chrome.storage.local.get(null),
      rules: await chrome.declarativeNetRequest.getDynamicRules(),
    }));
    const untouched = await context.newPage();
    await untouched.goto(`http://example.test:${port}/already-open`);
    await expect(untouched.getByRole('heading', { name: 'Ordinary site' })).toBeVisible();

    // Exercise the options-page API used by the toolbar's onClicked listener.
    await worker.evaluate(() => chrome.runtime.openOptionsPage());
    await expect.poll(() => context!.pages().find(page => page.url() === `chrome-extension://${extensionId}/settings.html`)).not.toBeUndefined();
    const settings = context.pages().find(page => page.url() === `chrome-extension://${extensionId}/settings.html`)!;
    await expect(settings.getByRole('status')).toHaveText('No sites are blocked yet.');
    expect(await state()).toEqual({ storage: {}, rules: [] });
    await settings.getByLabel('Site hostname or URL', { exact: true }).fill('ftp://example.test/path');
    await settings.getByRole('button', { name: 'Preview' }).click();
    await expect(settings.getByRole('status')).toContainText('valid hostname');
    await settings.getByLabel('Site hostname or URL', { exact: true }).fill('EXAMPLE.TEST');
    await settings.getByRole('button', { name: 'Preview' }).click();
    await expect(settings.locator('#preview')).toHaveText('Block example.test and all its subdomains, on every path.');
    await settings.screenshot({ path: testInfo.outputPath('settings-preview.png'), fullPage: true });
    await settings.getByRole('button', { name: 'Save and enable' }).click();
    await expect(settings.getByRole('status')).toContainText('confirm before enabling');
    expect(await state()).toEqual({ storage: {}, rules: [] });
    await settings.getByRole('checkbox').check();
    await settings.getByRole('button', { name: 'Save and enable' }).click();
    await expect(settings.getByRole('status')).toContainText('Saved and enabled');
    await settings.getByLabel('Site hostname or URL').fill('https://news.example.test:443/path?q=1');
    await settings.getByRole('button', { name: 'Preview' }).click();
    await expect(settings.locator('#preview')).toContainText('example.test already covers this site');
    await settings.getByRole('button', { name: 'Add site' }).click();
    await expect(settings.getByRole('status')).toContainText('Added news.example.test');
    settings.once('dialog', dialog => dialog.accept());
    await settings.getByRole('button', { name: 'Remove example.test', exact: true }).click();
    await expect(settings.getByRole('status')).toContainText('Removed example.test');
    await expect(settings.getByText('news.example.test', { exact: true })).toBeVisible();
    const managementVisit = await context.newPage();
    await managementVisit.goto(`http://news.example.test:${port}/child`);
    await expect(managementVisit).toHaveURL(`chrome-extension://${extensionId}/quote.html`);
    await managementVisit.goto(`http://other.example.test:${port}/sibling`);
    await expect(managementVisit.getByRole('heading', { name: 'Ordinary site' })).toBeVisible();
    settings.once('dialog', dialog => dialog.accept());
    await settings.getByRole('button', { name: 'Disable blocking' }).click();
    await expect(settings.getByRole('status')).toContainText('Blocking disabled');
    expect((await state()).rules).toHaveLength(0);
    await managementVisit.goto(`http://news.example.test:${port}/disabled`);
    await expect(managementVisit.getByRole('heading', { name: 'Ordinary site' })).toBeVisible();
    await settings.getByRole('button', { name: 'Enable blocking' }).click();
    await expect(settings.getByRole('status')).toContainText('Blocking enabled');
    await managementVisit.goto(`http://news.example.test:${port}/enabled`);
    await expect(managementVisit).toHaveURL(`chrome-extension://${extensionId}/quote.html`);
    await settings.getByLabel('Site hostname or URL').fill('example.test');
    await settings.getByRole('button', { name: 'Preview' }).click();
    await settings.getByRole('button', { name: 'Add site' }).click();
    await expect(settings.getByRole('status')).toContainText('Added example.test');
    const savedState = await state();
    expect(savedState.storage).toEqual({ settings: { version: 1, domains: ['news.example.test', 'example.test'], enabled: true, consent: true, revision: expect.any(String) } });
    expect(savedState.rules).toHaveLength(2);
    await expect(untouched.getByRole('heading', { name: 'Ordinary site' })).toBeVisible();

    const visit = await context.newPage();
    for (const hostname of ['example.test', 'news.example.test']) {
      await visit.goto(`http://${hostname}:${port}/private-path?secret=not-to-be-stored`);
      await expect(visit).toHaveURL(`chrome-extension://${extensionId}/quote.html`);
      await expect(visit.locator('blockquote')).not.toBeEmpty();
      await expect(visit.locator('figcaption')).toContainText('Translated by');
      await expect(visit.getByRole('link')).toHaveCount(0);
      await expect(visit.getByRole('button')).toHaveCount(0);
    }
    await visit.reload();
    await expect(visit.locator('blockquote')).toBeVisible();
    await visit.goto(`http://unrelated.test:${port}/`);
    await expect(visit.getByRole('heading', { name: 'Ordinary site' })).toBeVisible();
    await visit.setContent(`<iframe src="http://example.test:${port}/frame"></iframe>`);
    await expect(visit.frameLocator('iframe').getByRole('heading', { name: 'Frame content' })).toBeVisible();
    expect(await state()).toEqual(savedState);

    // An explicitly opened quote page ignores arbitrary input and cannot mutate settings.
    await visit.goto(`chrome-extension://${extensionId}/quote.html?hostname=evil.test#save`);
    const result = await visit.evaluate(() => chrome.runtime.sendMessage({ type: 'save', hostname: 'evil.test', consent: true }).catch(() => 'rejected'));
    // Chrome versions either resolve an ignored message without a response or reject it.
    expect([undefined, 'rejected']).toContain(result);
    expect(await state()).toEqual(savedState);
    await visit.screenshot({ path: testInfo.outputPath('quote-light.png'), fullPage: true });
    await visit.emulateMedia({ colorScheme: 'dark' });
    expect(await visit.locator('body').evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(25, 30, 27)');
    await visit.screenshot({ path: testInfo.outputPath('quote-dark.png'), fullPage: true });

    await context.close();
    context = await launch();
    const restartedWorker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const restarted = await context.newPage();
    await restarted.goto(`http://example.test:${port}/after-restart`);
    await expect(restarted).toHaveURL(`chrome-extension://${extensionId}/quote.html`);
    expect(await restartedWorker.evaluate(async () => ({ storage: await chrome.storage.local.get(null), rules: await chrome.declarativeNetRequest.getDynamicRules() }))).toEqual(savedState);
    expect(externalRequests).toEqual([]);
    expect(browserErrors).toEqual([]);
    console.log(`Browser smoke test: Chromium ${context.browser()?.version()}; restart, redirects, consent and configuration-only storage verified.`);

    const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
    expect(manifest.incognito).toBe('not_allowed');
    expect(manifest.permissions).toEqual(['storage', 'declarativeNetRequestWithHostAccess']);
    expect(manifest.content_security_policy.extension_pages).toContain("connect-src 'none'");
  } finally {
    await context?.close();
    await new Promise<void>(resolve => server ? server.close(() => resolve()) : resolve());
    await rm(profile, { recursive: true, force: true });
  }
});

test('preserves corrupt settings until a confirmed reset clears settings and rules', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'stoic-block-recovery-'));
  const extension = resolve('dist');
  const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).hostname;
    await worker.evaluate(() => chrome.storage.local.set({ settings: { broken: true } }));
    const page = await context.newPage();
    await page.goto(`chrome-extension://${id}/settings.html`);
    await expect(page.getByRole('status')).toContainText('preserved');
    await expect(page.getByRole('button', { name: 'Reset blocklist and settings' })).toBeVisible();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Reset blocklist and settings' }).click();
    await expect(page.getByRole('status')).toContainText('reset');
    expect(await worker.evaluate(() => chrome.declarativeNetRequest.getDynamicRules())).toEqual([]);
    expect((await worker.evaluate(() => chrome.storage.local.get('settings'))).settings).toBeUndefined();
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('stale settings are rejected and interrupted changes recover the last successful configuration', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'stoic-block-interrupted-'));
  const extension = resolve('dist');
  const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).hostname;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${id}/settings.html`);
    const call = (message: object) => page.evaluate(message => chrome.runtime.sendMessage(message), message);
    const initial = (await call({ type: 'load' })).settings;
    const first = await call({ type: 'save', hostname: 'example.test', consent: true, expected: initial });
    expect(first.ok).toBe(true);
    const stale = await call({ type: 'save', hostname: 'another.test', consent: true, expected: initial });
    expect(stale.ok).toBe(false);
    expect(stale.error).toContain('another tab');
    await worker.evaluate(async previous => {
      await chrome.storage.local.set({ pending: { previous }, settings: { ...previous, domains: ['another.test'] } });
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [1] });
    }, first.settings);
    const recovered = await call({ type: 'load' });
    expect(recovered.settings).toEqual(first.settings);
    expect(await worker.evaluate(() => chrome.declarativeNetRequest.getDynamicRules())).toHaveLength(1);
    expect((await worker.evaluate(() => chrome.storage.local.get(null))).pending).toBeUndefined();
    expect((await call({ type: 'reset', recoverySnapshot: await recoverySnapshot(page) })).ok).toBe(true);
    const staleAfterReset = await call({ type: 'save', hostname: 'stale.test', consent: true, expected: initial });
    expect(staleAfterReset.ok).toBe(false);
    expect(staleAfterReset.error).toContain('another tab');
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('restricted site access is visible and can be checked again after restoration', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'stoic-block-access-'));
  const extension = resolve('dist');
  const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).hostname;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${id}/settings.html`);
    await expect(page.getByText('Blocking coverage is incomplete.', { exact: false })).toBeHidden();
    const details = await context.newPage();
    await details.goto(`chrome://extensions/?id=${id}`);
    const hostAccess = details.locator('extensions-runtime-host-permissions select#hostAccess');
    await hostAccess.selectOption('ON_CLICK');
    await expect(page.getByText('Blocking coverage is incomplete.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Check site access' }).click();
    await expect(page.getByText('Blocking coverage is incomplete.', { exact: false })).toBeVisible();
    await hostAccess.selectOption('ON_ALL_SITES');
    await expect(page.getByText('Blocking coverage is incomplete.', { exact: false })).toBeHidden();
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('failed rule updates and reset remain visible and recoverable', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'stoic-block-failure-'));
  const extension = resolve('dist');
  const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).hostname;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${id}/settings.html`);
    const call = (message: object) => page.evaluate(message => chrome.runtime.sendMessage(message), message);
    const initial = (await call({ type: 'load' })).settings;
    const saved = await call({ type: 'save', hostname: 'example.test', consent: true, expected: initial });
    expect(saved.ok).toBe(true);
    await worker.evaluate(() => {
      (globalThis as typeof globalThis & { originalUpdate?: typeof chrome.declarativeNetRequest.updateDynamicRules }).originalUpdate = chrome.declarativeNetRequest.updateDynamicRules;
      chrome.declarativeNetRequest.updateDynamicRules = async () => { throw new Error('injected failure'); };
    });
    const disable = await call({ type: 'enabled', enabled: false, expected: saved.settings });
    expect(disable.ok).toBe(false);
    expect((await worker.evaluate(() => chrome.storage.local.get('settings'))).settings).toEqual(saved.settings);
    const reset = await call({ type: 'reset', recoverySnapshot: await recoverySnapshot(page) });
    expect(reset.ok).toBe(false);
    expect((await worker.evaluate(() => chrome.storage.local.get('settings'))).settings).toEqual(saved.settings);
    await worker.evaluate(() => {
      chrome.declarativeNetRequest.updateDynamicRules = (globalThis as typeof globalThis & { originalUpdate: typeof chrome.declarativeNetRequest.updateDynamicRules }).originalUpdate;
    });
    expect((await call({ type: 'load' })).settings.domains).toEqual([]);
    expect(await worker.evaluate(() => chrome.declarativeNetRequest.getDynamicRules())).toEqual([]);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('worker termination at each save boundary recovers the correct configuration', async () => {
  for (const stage of ['pending', 'rules', 'settings', 'commit'] as const) {
    const profile = await mkdtemp(join(tmpdir(), `stoic-block-stop-${stage}-`));
    const extension = resolve('dist');
    const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
    try {
      const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
      const id = new URL(worker.url()).hostname;
      const page = await context.newPage();
      await page.goto(`chrome-extension://${id}/settings.html`);
      const call = (message: object) => page.evaluate(message => chrome.runtime.sendMessage(message), message);
      const initial = (await call({ type: 'load' })).settings;
      const saved = (await call({ type: 'save', hostname: 'example.test', consent: true, expected: initial })).settings;
      await worker.evaluate(stage => {
        const local = chrome.storage.local;
        const set = local.set.bind(local);
        const updateRules = chrome.declarativeNetRequest.updateDynamicRules.bind(chrome.declarativeNetRequest);
        const stopHere = async () => {
          (globalThis as typeof globalThis & { saveBoundaryReached?: boolean }).saveBoundaryReached = true;
          await new Promise<void>(() => {});
        };
        local.set = async values => {
          await set(values);
          const entry = values as Record<string, unknown>;
          if ((stage === 'pending' && entry.pending && typeof entry.pending === 'object') ||
              (stage === 'settings' && entry.settings && !('pending' in entry)) ||
              (stage === 'commit' && entry.pending === null)) await stopHere();
        };
        chrome.declarativeNetRequest.updateDynamicRules = async options => {
          await updateRules(options);
          if (stage === 'rules') await stopHere();
        };
      }, stage);
      const interrupted = call({ type: 'save', hostname: 'another.test', consent: true, expected: saved }).catch(() => undefined);
      await expect.poll(() => worker.evaluate(() => (globalThis as typeof globalThis & { saveBoundaryReached?: boolean }).saveBoundaryReached === true)).toBe(true);
      const cdp = await context.newCDPSession(page);
      const targets = await cdp.send('Target.getTargets');
      const target = targets.targetInfos.find(item => item.type === 'service_worker' && item.url === worker.url());
      expect(target).toBeDefined();
      expect(await cdp.send('Target.closeTarget', { targetId: target!.targetId })).toEqual({ success: true });
      await interrupted;
      const result = await call({ type: 'load' });
      expect(result.ok).toBe(true);
      expect(result.settings.domains).toEqual(stage === 'commit' ? ['example.test', 'another.test'] : ['example.test']);
      const actual = await page.evaluate(async () => ({
        storage: await chrome.storage.local.get(null),
        rules: await chrome.declarativeNetRequest.getDynamicRules(),
      }));
      expect(actual.storage.pending).toBeUndefined();
      expect(actual.storage.settings).toEqual(result.settings);
      expect(actual.rules.map(rule => rule.condition.requestDomains?.[0])).toEqual(result.settings.domains);
    } finally {
      await context.close();
      await rm(profile, { recursive: true, force: true });
    }
  }
});

test('extension upgrade reconciles an interrupted save before settings are opened', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'stoic-block-upgrade-'));
  const extension = join(temp, 'extension');
  await cp(resolve('dist'), extension, { recursive: true });
  const context = await chromium.launchPersistentContext(join(temp, 'profile'), { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).hostname;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${id}/settings.html`);
    const initial = (await page.evaluate(() => chrome.runtime.sendMessage({ type: 'load' }))).settings;
    const saved = (await page.evaluate(expected => chrome.runtime.sendMessage({ type: 'save', hostname: 'example.test', consent: true, expected }), initial)).settings;
    await worker.evaluate(async previous => {
      await chrome.storage.local.set({ pending: { previous }, settings: { ...previous, domains: ['another.test'] } });
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [1] });
    }, saved);
    await page.close();
    const manifestPath = join(extension, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.version = '0.1.1';
    await writeFile(manifestPath, JSON.stringify(manifest));
    const details = await context.newPage();
    await details.goto(`chrome://extensions/?id=${id}`);
    await details.locator('extensions-toolbar #devMode').click();
    await details.locator('extensions-detail-view #dev-reload-button').evaluate(element => (element as HTMLElement).click());
    await expect.poll(async () => details.locator('extensions-detail-view').evaluate(element => element.shadowRoot?.textContent?.includes('0.1.1'))).toBe(true);
    const upgraded = context.serviceWorkers().find(item => item.url().includes(id)) ?? await context.waitForEvent('serviceworker');
    await expect.poll(() => upgraded.evaluate(async () => ({
      data: await chrome.storage.local.get(null),
      rules: await chrome.declarativeNetRequest.getDynamicRules(),
    }))).toMatchObject({ data: { settings: saved }, rules: [{ condition: { requestDomains: ['example.test'] } }] });
    expect((await upgraded.evaluate(() => chrome.storage.local.get(null))).pending).toBeUndefined();
    const settings = await context.newPage();
    await settings.goto(`chrome-extension://${id}/settings.html`);
    await expect(settings.getByText('example.test', { exact: true })).toBeVisible();
  } finally {
    await context.close();
    await rm(temp, { recursive: true, force: true });
  }
});

test('two settings tabs reject stale edits and storage failures preserve the applied blocklist', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'stoic-block-tabs-'));
  const extension = resolve('dist');
  const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).hostname;
    const first = await context.newPage();
    const stale = await context.newPage();
    await first.goto(`chrome-extension://${id}/settings.html`);
    await stale.goto(`chrome-extension://${id}/settings.html`);
    await expect(first.getByRole('status')).toHaveText('No sites are blocked yet.');
    await expect(stale.getByRole('status')).toHaveText('No sites are blocked yet.');
    for (const [page, hostname] of [[first, 'example.test'], [stale, 'another.test']] as const) {
      await page.getByLabel('Site hostname or URL').fill(hostname);
      await page.getByRole('button', { name: 'Preview' }).click();
      await page.getByRole('checkbox').check();
    }
    await first.getByRole('button', { name: 'Save and enable' }).click();
    await expect(first.getByRole('status')).toContainText('Saved and enabled');
    await stale.getByRole('button', { name: 'Save and enable' }).click();
    await expect(stale.getByRole('status')).toContainText('another tab');
    await worker.evaluate(() => {
      const local = chrome.storage.local;
      const set = local.set.bind(local);
      let failed = false;
      local.set = async values => {
        if (!failed && 'settings' in values && !('pending' in values)) {
          failed = true;
          throw new Error('injected storage failure');
        }
        await set(values);
      };
    });
    first.once('dialog', dialog => dialog.accept());
    await first.getByRole('button', { name: 'Disable blocking' }).click();
    await expect(first.getByRole('status')).toContainText('Previous settings were restored');
    await expect(first.getByRole('button', { name: 'Disable blocking' })).toBeVisible();
    const actual = await first.evaluate(async () => ({ settings: (await chrome.storage.local.get('settings')).settings, rules: await chrome.declarativeNetRequest.getDynamicRules() }));
    expect(actual.settings).toMatchObject({ domains: ['example.test'], enabled: true });
    expect(actual.rules.map(rule => rule.condition.requestDomains?.[0])).toEqual(['example.test']);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('profile restart reconciles a save interrupted after the settings write', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'stoic-block-restart-'));
  const extension = resolve('dist');
  const launch = () => chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  let context = await launch();
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).hostname;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${id}/settings.html`);
    const initial = (await page.evaluate(() => chrome.runtime.sendMessage({ type: 'load' }))).settings;
    const saved = (await page.evaluate(expected => chrome.runtime.sendMessage({ type: 'save', hostname: 'example.test', consent: true, expected }), initial)).settings;
    await worker.evaluate(() => {
      const set = chrome.storage.local.set.bind(chrome.storage.local);
      chrome.storage.local.set = async values => {
        await set(values);
        if ('settings' in values && !('pending' in values)) {
          (globalThis as typeof globalThis & { settingsWritten?: boolean }).settingsWritten = true;
          await new Promise<void>(() => {});
        }
      };
    });
    const interrupted = page.evaluate(expected => chrome.runtime.sendMessage({ type: 'save', hostname: 'another.test', consent: true, expected }), saved).catch(() => undefined);
    await expect.poll(() => worker.evaluate(() => (globalThis as typeof globalThis & { settingsWritten?: boolean }).settingsWritten === true)).toBe(true);
    await context.close();
    await interrupted;
    context = await launch();
    const restarted = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await expect.poll(() => restarted.evaluate(async () => ({ data: await chrome.storage.local.get(null), rules: await chrome.declarativeNetRequest.getDynamicRules() }))).toMatchObject({ data: { settings: saved }, rules: [{ condition: { requestDomains: ['example.test'] } }] });
    expect((await restarted.evaluate(() => chrome.storage.local.get(null))).pending).toBeUndefined();
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('unavailable storage shows recovery and saved settings return when storage is available', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'stoic-block-unavailable-'));
  const extension = resolve('dist');
  const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).hostname;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${id}/settings.html`);
    const initial = (await page.evaluate(() => chrome.runtime.sendMessage({ type: 'load' }))).settings;
    const saved = (await page.evaluate(expected => chrome.runtime.sendMessage({ type: 'save', hostname: 'example.test', consent: true, expected }), initial)).settings;
    await worker.evaluate(() => {
      const local = chrome.storage.local;
      const originalGet = local.get.bind(local);
      (globalThis as typeof globalThis & { restoreStorage?: () => void }).restoreStorage = () => { local.get = originalGet; };
      local.get = async () => { throw new Error('Storage is unavailable.'); };
    });
    await page.reload();
    await expect(page.getByRole('status')).toContainText('Storage is unavailable');
    await expect(page.getByText('Your stored configuration has been preserved.', { exact: false })).toBeVisible();
    await worker.evaluate(() => (globalThis as typeof globalThis & { restoreStorage: () => void }).restoreStorage());
    await page.reload();
    await expect(page.getByText('example.test', { exact: true })).toBeVisible();
    expect((await page.evaluate(() => chrome.storage.local.get('settings'))).settings).toEqual(saved);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('a stale recovery screen cannot reset settings changed in another tab', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'stoic-block-stale-reset-'));
  const extension = resolve('dist');
  const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).hostname;
    await worker.evaluate(() => chrome.storage.local.set({ settings: { broken: true } }));
    const stale = await context.newPage();
    const current = await context.newPage();
    await stale.goto(`chrome-extension://${id}/settings.html`);
    await current.goto(`chrome-extension://${id}/settings.html`);
    await expect(stale.getByRole('button', { name: 'Reset blocklist and settings' })).toBeVisible();
    await expect(current.getByRole('button', { name: 'Reset blocklist and settings' })).toBeVisible();
    current.once('dialog', dialog => dialog.accept());
    await current.getByRole('button', { name: 'Reset blocklist and settings' }).click();
    await expect(current.getByRole('status')).toContainText('reset');
    await current.getByLabel('Site hostname or URL').fill('example.test');
    await current.getByRole('button', { name: 'Preview' }).click();
    await current.getByRole('checkbox').check();
    await current.getByRole('button', { name: 'Save and enable' }).click();
    await expect(current.getByRole('status')).toContainText('Saved and enabled');
    stale.once('dialog', dialog => dialog.accept());
    await stale.getByRole('button', { name: 'Reset blocklist and settings' }).click();
    await expect(stale.getByRole('status')).toContainText('changed in another tab');
    expect((await current.evaluate(() => chrome.storage.local.get('settings'))).settings).toMatchObject({ domains: ['example.test'], enabled: true });
    expect(await current.evaluate(() => chrome.declarativeNetRequest.getDynamicRules())).toHaveLength(1);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
