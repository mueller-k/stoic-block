import { chromium, expect, test } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('a quote page load shows a selected historical excerpt with its attribution', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'stoic-quotes-'));
  const extension = resolve('dist');
  const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).hostname;
    await context.addInitScript(() => {
      crypto.getRandomValues = <T extends ArrayBufferView | null>(values: T): T => {
        if (values instanceof Uint32Array) values[0] = Number(window.name || '1');
        return values;
      };
    });
    const page = await context.newPage();
    await page.goto(`chrome-extension://${id}/quote.html`);
    await expect(page.locator('blockquote')).toHaveText('Let no act be done without a purpose, nor otherwise than according to the perfect principles of art.');
    await expect(page.locator('figcaption')).toContainText('Meditations');
    await expect(page.locator('figcaption')).toContainText('George Long');
    const expected = [
      'Attend to the matter which is before thee, whether it is an opinion or an act or a word.',
      'Let no act be done without a purpose, nor otherwise than according to the perfect principles of art.',
      'Look within. Let neither the peculiar quality of anything nor its value escape thee.',
      'Require not Things to happen as you wish; but wish them to happen as they do happen; and you will go on well.',
      'Begin therefore from little Things.',
      'Lay hold of to-day’s task, and you will not need to depend so much upon to-morrow’s.',
      'There is nothing so efficacious that it can be helpful while it is being shifted about.',
      'No good thing is pleasant to possess, without friends to share it.',
    ];
    for (const index of [0, 1, 2, 3, 4, 5, 6, 7, 7]) {
      await page.evaluate(value => { window.name = String(value); }, index);
      await page.reload();
      await expect(page.locator('blockquote')).toHaveText(expected[index]);
      await expect(page.locator('figcaption')).toContainText('Translated by');
    }
    expect(await worker.evaluate(() => chrome.storage.local.get(null))).toEqual({});
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('blockquote')).toHaveText(expected[7]);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 320, height: 568 });
    await expect(page.locator('blockquote')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.goto(`chrome-extension://${id}/settings.html`);
    await page.getByRole('link', { name: 'Read complete quote sources and credits' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Quote sources and credits' })).toBeVisible();
    await expect(page.getByText('Meditations 8.22', { exact: false })).toBeVisible();
    await expect(page.getByText('Enchiridion 12', { exact: false })).toBeVisible();
    await expect(page.getByText('Moral Letters to Lucilius 6.4', { exact: false })).toBeVisible();
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
