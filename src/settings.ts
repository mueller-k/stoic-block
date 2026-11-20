import { normalizeHostname, type Settings } from './blocking';

const form = document.querySelector<HTMLFormElement>('#site-form')!;
const hostname = document.querySelector<HTMLInputElement>('#hostname')!;
const preview = document.querySelector<HTMLElement>('#preview')!;
const confirmation = document.querySelector<HTMLElement>('#confirmation')!;
const consent = document.querySelector<HTMLInputElement>('#consent')!;
const save = document.querySelector<HTMLButtonElement>('#save')!;
const status = document.querySelector<HTMLElement>('#status')!;
const saved = document.querySelector<HTMLElement>('#saved')!;
let candidate = '';

async function request(message: object): Promise<Settings> {
  const reply = await chrome.runtime.sendMessage(message);
  if (!reply?.ok) throw new Error(reply?.error ?? 'Settings are unavailable. Reopen settings and try again.');
  return reply.settings;
}

function show(settings: Settings): void {
  if (!settings.domains.length) {
    form.hidden = false;
    status.textContent = 'No sites are blocked yet.';
    return;
  }
  form.hidden = true;
  saved.hidden = false;
  document.querySelector('#saved-domain')!.textContent = settings.domains[0];
  status.textContent = 'Saved and enabled. Blocking rules have been verified.';
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
    preview.textContent = `Block ${candidate} and all its subdomains, on every path.`;
    consent.checked = false;
    confirmation.hidden = false;
    status.textContent = 'Review the coverage and privacy explanation before saving.';
    consent.focus();
  } catch (error) {
    confirmation.hidden = true;
    status.textContent = (error as Error).message;
  }
});

save.addEventListener('click', async () => {
  if (!candidate || !consent.checked) {
    status.textContent = 'Read the privacy explanation and confirm before enabling blocking.';
    consent.focus();
    return;
  }
  const chosen = candidate;
  const controls = Array.from(form.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button'));
  controls.forEach(control => { control.disabled = true; });
  status.textContent = 'Saving and checking blocking rules…';
  try {
    show(await request({ type: 'save', hostname: chosen, consent: true }));
  } catch (error) {
    status.textContent = (error as Error).message;
  } finally {
    controls.forEach(control => { control.disabled = false; });
  }
});

void request({ type: 'load' }).then(show).catch(error => {
  status.textContent = error.message;
});
