import { BlockingService, SETTINGS_KEY } from './blocking';

const service = new BlockingService({
  load: async () => (await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY],
  store: async settings => { await chrome.storage.local.set({ [SETTINGS_KEY]: settings }); },
  rules: () => chrome.declarativeNetRequest.getDynamicRules(),
  replace: async rules => {
    const installed = await chrome.declarativeNetRequest.getDynamicRules();
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: installed.map(rule => rule.id),
      addRules: rules,
    });
  },
});

// Every settings mutation passes through this worker and queue.
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(async () => {
    await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
    return work();
  });
  queue = result.catch(() => undefined);
  return result;
}

chrome.action.onClicked.addListener(() => { void chrome.runtime.openOptionsPage(); });
chrome.runtime.onInstalled.addListener(() => { void serialize(() => service.current()).catch(() => undefined); });
chrome.runtime.onStartup.addListener(() => { void serialize(() => service.current()).catch(() => undefined); });

chrome.runtime.onMessage.addListener((message: unknown, sender, respond) => {
  // The publicly accessible quote page is never a settings authority.
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('settings.html')) return false;
  const request = message as { type?: unknown; hostname?: unknown; consent?: unknown } | null;
  if (!request || (request.type !== 'load' && request.type !== 'save')) return false;
  void serialize(async () => {
    if (request.type === 'load') return service.current();
    if (typeof request.hostname !== 'string' || request.consent !== true) {
      throw new Error('Confirm a hostname and the privacy explanation before saving.');
    }
    return service.save(request.hostname, request.consent);
  }).then(settings => respond({ ok: true, settings }), error => {
    respond({ ok: false, error: error instanceof Error ? error.message : 'Settings could not be saved. Please try again.' });
  });
  return true;
});
