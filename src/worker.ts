import { BlockingService, SETTINGS_KEY, PENDING_KEY, emptySettings, readSettings } from './blocking';

const service = new BlockingService({
  load: async () => {
    const data = await chrome.storage.local.get([SETTINGS_KEY, 'resetRevision']);
    return data[SETTINGS_KEY] === undefined && data.resetRevision !== undefined
      ? { ...emptySettings(), revision: data.resetRevision }
      : data[SETTINGS_KEY];
  },
  store: async settings => { await chrome.storage.local.set({ [SETTINGS_KEY]: settings }); },
  pending: async () => (await chrome.storage.local.get(PENDING_KEY))[PENDING_KEY],
  begin: async previous => { await chrome.storage.local.set({ [PENDING_KEY]: { previous } }); },
  commit: async settings => { await chrome.storage.local.set({ [SETTINGS_KEY]: settings, [PENDING_KEY]: null }); },
  clearPending: async () => { await chrome.storage.local.remove(PENDING_KEY); },
  clear: async () => {
    await chrome.storage.local.set({ resetRevision: crypto.randomUUID() });
    await chrome.storage.local.remove([SETTINGS_KEY, PENDING_KEY]);
  },
  rules: () => chrome.declarativeNetRequest.getDynamicRules(),
  replace: async rules => {
    const installed = await chrome.declarativeNetRequest.getDynamicRules();
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: installed.map(rule => rule.id),
      addRules: rules,
    });
  },
});

async function recoverySnapshot(): Promise<string> {
  const data = await chrome.storage.local.get([SETTINGS_KEY, PENDING_KEY, 'resetRevision']);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

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
  const request = message as { type?: unknown; hostname?: unknown; consent?: unknown; expected?: unknown; enabled?: unknown; recoverySnapshot?: unknown } | null;
  if (!request || !['load', 'save', 'remove', 'enabled', 'reset'].includes(String(request.type))) return false;
  let snapshot: string | undefined;
  void serialize(async () => {
    if (request.type === 'load') {
      try { return await service.current(); }
      catch (error) {
        snapshot = await recoverySnapshot().catch(() => undefined);
        throw error;
      }
    }
    if (request.type === 'reset') {
      if (typeof request.recoverySnapshot !== 'string') throw new Error('Settings are unavailable. Reopen settings and try again.');
      if (request.recoverySnapshot !== await recoverySnapshot()) throw new Error('Settings changed in another tab. Reload settings and try again.');
      return service.reset();
    }
    const expected = readSettings(request.expected);
    if (request.type === 'save' && typeof request.hostname === 'string' && request.consent === true) {
      return service.save(request.hostname, true, expected);
    }
    if (request.type === 'remove' && typeof request.hostname === 'string') return service.remove(request.hostname, expected);
    if (request.type === 'enabled' && typeof request.enabled === 'boolean') return service.setEnabled(request.enabled, expected);
    throw new Error('Invalid settings change.');
  }).then(async settings => respond({ ok: true, settings, coverage: await chrome.permissions.contains({ origins: ['http://*/*', 'https://*/*'] }).catch(() => false) }), error => {
    respond({ ok: false, error: error instanceof Error ? error.message : 'Settings could not be saved. Please try again.', recoverySnapshot: snapshot });
  });
  return true;
});
