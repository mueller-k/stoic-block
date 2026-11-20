import { getDomain } from 'tldts';

export const SETTINGS_KEY = 'settings';
export const PENDING_KEY = 'pending';

export interface Settings {
  version: 1;
  domains: string[];
  enabled: boolean;
  consent: boolean;
  revision?: string;
}

export function emptySettings(): Settings {
  return { version: 1, domains: [], enabled: false, consent: false };
}

export const MAX_DOMAINS = 1000;

export function normalizeHostname(input: string): string {
  const text = input.trim();
  const isUrl = /^https?:\/\//i.test(text);
  const authority = isUrl ? text.split(/[\/?#]/)[2] : text;
  if (!text || /[\s\\]/u.test(text) || !authority || /[*%@]/u.test(authority) ||
      (!isUrl && /[\/:?#]/u.test(text))) {
    throw new Error('Enter a valid hostname or HTTP(S) URL.');
  }
  let url: URL;
  try {
    url = new URL(isUrl ? text : `https://${text}`);
  } catch {
    throw new Error('Enter a valid hostname or HTTP(S) URL.');
  }
  if (url.username || url.password) throw new Error('URLs with credentials are not supported.');
  const hostname = url.hostname.replace(/\.$/, '');
  const labels = hostname.split('.');
  if (hostname.length > 253 || labels.length < 2 || /^[\d.]+$/.test(hostname) ||
      !labels.every(label => label.length <= 63 && /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label)) ||
      !getDomain(hostname, { allowPrivateDomains: true })) {
    throw new Error('Enter a valid public hostname, not an IP address, localhost, or public suffix.');
  }
  return hostname;
}

export function readSettings(value: unknown): Settings {
  if (value === undefined) return emptySettings();
  if (!value || typeof value !== 'object') throw new Error('Stored settings are unreadable. They have been preserved.');
  const data = value as Partial<Settings>;
  if (data.version !== 1 || !Array.isArray(data.domains) || data.domains.length > MAX_DOMAINS ||
      typeof data.enabled !== 'boolean' || typeof data.consent !== 'boolean' ||
      (data.revision !== undefined && (typeof data.revision !== 'string' || !/^[a-f0-9-]{36}$/.test(data.revision))) ||
      data.domains.some(domain => typeof domain !== 'string' || normalizeHostname(domain) !== domain) ||
      new Set(data.domains).size !== data.domains.length ||
      ((data.domains.length > 0 || data.enabled) && !data.consent)) {
    throw new Error('Stored settings are unreadable. They have been preserved.');
  }
  return { version: 1, domains: [...data.domains], enabled: data.enabled, consent: data.consent, ...(data.revision ? { revision: data.revision } : {}) };
}

export function rulesFor(settings: Settings): chrome.declarativeNetRequest.Rule[] {
  if (!settings.enabled || !settings.consent) return [];
  return settings.domains.map((domain, index) => ({
    id: index + 1,
    priority: 1,
    action: {
      type: 'redirect' as chrome.declarativeNetRequest.RuleActionType,
      redirect: { extensionPath: '/quote.html' },
    },
    condition: {
      regexFilter: '^https?://',
      requestDomains: [domain],
      resourceTypes: ['main_frame' as chrome.declarativeNetRequest.ResourceType],
    },
  }));
}

export interface BlockingPort {
  load(): Promise<unknown>;
  store(settings: Settings): Promise<void>;
  pending(): Promise<unknown>;
  begin(previous: Settings | null): Promise<void>;
  commit(settings: Settings): Promise<void>;
  clearPending(): Promise<void>;
  clear(): Promise<void>;
  rules(): Promise<chrome.declarativeNetRequest.Rule[]>;
  replace(rules: chrome.declarativeNetRequest.Rule[]): Promise<void>;
}

function ruleSignature(rules: chrome.declarativeNetRequest.Rule[]): string {
  // Chrome may return object keys in a different order. Preserve all field values.
  const sorted = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sorted);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sorted(item)]));
    }
    return value;
  };
  return JSON.stringify(sorted([...rules].sort((a, b) => a.id - b.id)));
}

export class BlockingService {
  constructor(private readonly port: BlockingPort) {}

  private async enforce(settings: Settings): Promise<void> {
    const expected = rulesFor(settings);
    if (ruleSignature(await this.port.rules()) !== ruleSignature(expected)) {
      await this.port.replace(expected);
    }
    if (ruleSignature(await this.port.rules()) !== ruleSignature(expected)) {
      throw new Error('Chrome could not verify the blocking rules. Please try again.');
    }
  }

  async current(): Promise<Settings> {
    const pending = await this.port.pending();
    if (pending === null) await this.port.clearPending();
    else if (pending !== undefined) {
      if (!pending || typeof pending !== 'object' || !('previous' in pending)) throw new Error('Recovery data is unreadable. Settings have been preserved.');
      const previous = (pending as { previous: unknown }).previous;
      if (previous === undefined) throw new Error('Recovery data is unreadable. Settings have been preserved.');
      if (previous === null) {
        await this.enforce(emptySettings());
        await this.port.clear();
      } else {
        const authority = readSettings(previous);
        await this.enforce(authority);
        await this.port.store(authority);
        if (JSON.stringify(readSettings(await this.port.load())) !== JSON.stringify(authority)) {
          throw new Error('Recovery could not be verified. Reopen settings and try again.');
        }
        await this.enforce(authority);
        await this.port.clearPending();
      }
    }
    const settings = readSettings(await this.port.load());
    await this.enforce(settings);
    return settings;
  }

  async save(hostname: string, consent: boolean, expected?: Settings): Promise<Settings> {
    if (consent !== true) throw new Error('Read the privacy explanation and confirm before enabling blocking.');
    const domain = normalizeHostname(hostname);
    const previous = await this.current();
    this.checkExpected(previous, expected);
    if (previous.domains.includes(domain)) throw new Error('This site is already in your blocklist.');
    if (previous.domains.length >= MAX_DOMAINS) throw new Error('Your blocklist is full (1,000 sites).');
    return this.apply(previous, { ...previous, domains: [...previous.domains, domain], enabled: previous.consent ? previous.enabled : true, consent: true });
  }

  async remove(domain: string, expected: Settings): Promise<Settings> {
    const previous = await this.current();
    this.checkExpected(previous, expected);
    if (!previous.domains.includes(domain)) throw new Error('This site is no longer in your blocklist.');
    return this.apply(previous, { ...previous, domains: previous.domains.filter(item => item !== domain) });
  }

  async setEnabled(enabled: boolean, expected: Settings): Promise<Settings> {
    const previous = await this.current();
    this.checkExpected(previous, expected);
    if (!previous.consent) throw new Error('Save a site and confirm the privacy explanation first.');
    return this.apply(previous, { ...previous, enabled });
  }

  private checkExpected(previous: Settings, expected?: Settings): void {
    if (expected && JSON.stringify(previous) !== JSON.stringify(expected)) {
      throw new Error('Settings changed in another tab. Reload settings and try again.');
    }
  }

  async reset(): Promise<Settings> {
    await this.port.begin(null);
    await this.enforce(emptySettings());
    await this.port.clear();
    const cleared = readSettings(await this.port.load());
    if (cleared.domains.length || cleared.enabled || cleared.consent || await this.port.pending() !== undefined || (await this.port.rules()).length) {
      throw new Error('Reset could not be verified. Reopen settings and try again.');
    }
    return cleared;
  }

  private async apply(previous: Settings, next: Settings): Promise<Settings> {
    next = { ...next, revision: crypto.randomUUID() };
    try {
      await this.port.begin(previous);
      await this.enforce(next);
      await this.port.store(next);
      if (JSON.stringify(readSettings(await this.port.load())) !== JSON.stringify(next)) {
        throw new Error('Settings could not be verified.');
      }
      await this.enforce(next);
      await this.port.commit(next);
      // A committed marker is safe to clear later, including on worker restart.
      await this.port.clearPending().catch(() => undefined);
      return next;
    } catch {
      try {
        await this.port.begin(previous);
        await this.enforce(previous);
        await this.port.store(previous);
        if (JSON.stringify(readSettings(await this.port.load())) !== JSON.stringify(previous)) {
          throw new Error('Previous settings could not be verified.');
        }
        await this.enforce(previous);
        await this.port.clearPending();
      } catch {
        throw new Error('Saving failed and recovery could not finish. Reopen settings to retry recovery; blocking may be incomplete.');
      }
      throw new Error('Could not apply the change. Previous settings were restored. Please try again.');
    }
  }
}
