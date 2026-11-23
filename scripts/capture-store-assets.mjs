import { chromium } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const profile = await mkdtemp(join(tmpdir(), 'stoic-store-'));
const extension = resolve('dist');
const context = await chromium.launchPersistentContext(profile, { channel:'chromium', headless:true, viewport:{width:1280,height:800}, colorScheme:'dark', args:[`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
try {
 const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
 const id = new URL(worker.url()).hostname;
 const page = await context.newPage();
 async function capture(name, caption) {
   await page.evaluate(text => { document.querySelector('#store-caption')?.remove(); const note=document.createElement('div'); note.id='store-caption'; note.textContent=text; Object.assign(note.style,{position:'fixed',right:'28px',top:'24px',zIndex:'9999',font:'600 14px system-ui, sans-serif',color:'#d8e5d5',background:'#2d4435',border:'1px solid #718a75',borderRadius:'8px',padding:'10px 14px',maxWidth:'220px'}); document.body.append(note); }, caption);
   await page.screenshot({path:`store-assets/screenshots/${name}.png`});
 }
 await page.goto(`chrome-extension://${id}/quote.html`);
 await page.locator('blockquote').waitFor();
 await capture('01-quote-page','A moment to refocus');
 await page.goto(`chrome-extension://${id}/settings.html`);
 await page.getByRole('status').waitFor();
 await page.getByLabel('Site hostname or URL', {exact:true}).fill('example.com');
 await capture('02-add-site','Choose a distracting site');
 await page.getByRole('button',{name:'Preview'}).click();
 await page.locator('#preview').waitFor();
 await page.locator('#confirmation').scrollIntoViewIfNeeded();
 await capture('03-preview-coverage','Preview what will be blocked');
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Save and enable'}).click();
 await page.getByText('Saved and enabled', {exact:false}).waitFor();
 await page.locator('#saved').scrollIntoViewIfNeeded();
 await capture('04-saved-blocklist','Manage your blocklist');
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Disable blocking'}).click();
 await page.getByText('Blocking disabled',{exact:false}).waitFor();
 await page.locator('#saved').scrollIntoViewIfNeeded();
 await capture('05-disabled','Turn blocking on or off');
} finally { await context.close(); await rm(profile,{recursive:true,force:true}); }
