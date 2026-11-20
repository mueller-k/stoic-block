import { MAX_DOMAINS, normalizeHostname, type Settings } from './blocking';

const form = document.querySelector<HTMLFormElement>('#site-form')!;
const hostname = document.querySelector<HTMLInputElement>('#hostname')!;
const preview = document.querySelector<HTMLElement>('#preview')!;
const confirmation = document.querySelector<HTMLElement>('#confirmation')!;
const consent = document.querySelector<HTMLInputElement>('#consent')!;
const consentLabel = document.querySelector<HTMLElement>('#consent-label')!;
const save = document.querySelector<HTMLButtonElement>('#save')!;
const status = document.querySelector<HTMLElement>('#status')!;
const saved = document.querySelector<HTMLElement>('#saved')!;
const domains = document.querySelector<HTMLElement>('#domains')!;
const toggle = document.querySelector<HTMLButtonElement>('#toggle')!;
const recovery = document.querySelector<HTMLElement>('#recovery')!;
const coverage = document.querySelector<HTMLElement>('#coverage')!;
const checkAccess = document.querySelector<HTMLButtonElement>('#check-access')!;
const reset = document.querySelector<HTMLButtonElement>('#reset')!;
let candidate = '';
let current: Settings;

async function request(message: object): Promise<Settings> {
  const reply = await chrome.runtime.sendMessage(message);
  if (!reply?.ok) throw new Error(reply?.error ?? 'Settings are unavailable. Reopen settings and try again.');
  coverage.hidden = reply.coverage === true;
  checkAccess.hidden = reply.coverage === true;
  return reply.settings;
}

function show(settings: Settings, message?: string): void {
  current = settings;
  recovery.hidden = true;
  form.hidden = false;
  saved.hidden = !settings.consent;
  domains.replaceChildren();
  for (const domain of settings.domains) {
    const item = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = domain;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${domain}`);
    remove.addEventListener('click', () => {
      if (window.confirm(`Remove ${domain} from your blocklist?`)) void change({ type: 'remove', hostname: domain }, `Removed ${domain}. Blocking rules have been verified.`);
    });
    item.append(label, remove);
    domains.append(item);
  }
  toggle.textContent = settings.enabled ? 'Disable blocking' : 'Enable blocking';
  consentLabel.hidden = settings.consent;
  save.textContent = settings.consent ? 'Add site' : 'Save and enable';
  status.textContent = message ?? (settings.consent ? `Blocking is ${settings.enabled ? 'enabled' : 'disabled'}. ${settings.domains.length} of ${MAX_DOMAINS} sites saved.` : 'No sites are blocked yet.');
}

async function change(message: object, success: string): Promise<void> {
  const controls = Array.from(document.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button'));
  controls.forEach(control => { control.disabled = true; });
  status.textContent = 'Applying and checking blocking rules…';
  try {
    const result = await request({ ...message, expected: current });
    candidate = '';
    confirmation.hidden = true;
    hostname.value = '';
    show(result, success);
  } catch (error) {
    status.textContent = (error as Error).message;
  } finally {
    controls.forEach(control => { control.disabled = false; });
  }
}

hostname.addEventListener('input', () => {
  candidate = '';
  confirmation.hidden = true;
  consent.checked = false;
});

form.addEventListener('submit', event => {
  event.preventDefault();
  try {
    candidate = normalizeHostname(hostname.value);
    if (current.domains.includes(candidate)) throw new Error('This site is already in your blocklist.');
    if (current.domains.length >= MAX_DOMAINS) throw new Error('Your blocklist is full (1,000 sites).');
    const parent = current.domains.find(domain => candidate.endsWith(`.${domain}`));
    preview.textContent = `Block ${candidate} and all its subdomains, on every path.${parent ? ` ${parent} already covers this site; adding it keeps it blocked if the parent is removed.` : ''}`;
    consent.checked = false;
    confirmation.hidden = false;
    status.textContent = 'Review the coverage before saving.';
    (current.consent ? save : consent).focus();
  } catch (error) {
    confirmation.hidden = true;
    status.textContent = (error as Error).message;
  }
});

save.addEventListener('click', () => {
  if (!candidate || (!current.consent && !consent.checked)) {
    status.textContent = 'Read the privacy explanation and confirm before enabling blocking.';
    consent.focus();
    return;
  }
  void change({ type: 'save', hostname: candidate, consent: true }, current.consent ? `Added ${candidate}. Blocking rules have been verified.` : 'Saved and enabled. Blocking rules have been verified.');
});

toggle.addEventListener('click', () => {
  if (current.enabled && !window.confirm('Disable blocking? Your saved sites will be kept.')) return;
  void change({ type: 'enabled', enabled: !current.enabled }, `Blocking ${current.enabled ? 'disabled' : 'enabled'}. Blocking rules have been verified.`);
});

async function load(): Promise<void> {
  try { show(await request({ type: 'load' })); }
  catch (error) {
    form.hidden = true;
    saved.hidden = true;
    recovery.hidden = false;
    status.textContent = (error as Error).message;
  }
}

reset.addEventListener('click', async () => {
  if (!window.confirm('Reset blocklist and settings? All saved sites and blocking rules will be removed.')) return;
  reset.disabled = true;
  try { show(await request({ type: 'reset' }), 'Blocklist and settings reset. Blocking rules have been cleared.'); }
  catch (error) { status.textContent = `Reset failed. ${(error as Error).message} Reopen settings and try again.`; }
  finally { reset.disabled = false; }
});
checkAccess.addEventListener('click', () => { void load(); });
chrome.permissions.onAdded.addListener(() => { void load(); });
chrome.permissions.onRemoved.addListener(() => { void load(); });
void load();
