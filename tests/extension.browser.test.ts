import { chromium, expect, test, type BrowserContext } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer, type Server } from 'node:http';

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
    expect(savedState.storage).toEqual({ settings: { version: 1, domains: ['news.example.test', 'example.test'], enabled: true, consent: true } });
    expect(savedState.rules).toHaveLength(2);
    await expect(untouched.getByRole('heading', { name: 'Ordinary site' })).toBeVisible();

    const visit = await context.newPage();
    for (const hostname of ['example.test', 'news.example.test']) {
      await visit.goto(`http://${hostname}:${port}/private-path?secret=not-to-be-stored`);
      await expect(visit).toHaveURL(`chrome-extension://${extensionId}/quote.html`);
      await expect(visit.locator('blockquote')).toContainText('Attend to the matter');
      await expect(visit.locator('figcaption')).toContainText('George Long');
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
