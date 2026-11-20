export const SETTINGS_KEY = 'settings';

export interface Settings {
  version: 1;
  domains: string[];
  enabled: boolean;
  consent: boolean;
}

export function emptySettings(): Settings {
  return { version: 1, domains: [], enabled: false, consent: false };
}

// The first slice accepts hostnames only. URL/public-suffix management follows.
export function normalizeHostname(input: string): string {
  const text = input.trim().replace(/\.$/, '');
  if (!text || /[\s/:@?#%*\\]/u.test(text)) {
    throw new Error('Enter a hostname such as example.com, without a path or scheme.');
  }
  let hostname: string;
  try {
    hostname = new URL(`https://${text}`).hostname;
  } catch {
    throw new Error('Enter a valid hostname such as example.com.');
  }
  const labels = hostname.split('.');
  if (hostname.length > 253 || labels.length < 2 || /^[\d.]+$/.test(hostname) ||
      !labels.every(label => label.length <= 63 && /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label))) {
    throw new Error('Enter a valid public hostname, not an IP address or localhost.');
  }
  return hostname;
}

export function readSettings(value: unknown): Settings {
  if (value === undefined) return emptySettings();
  if (!value || typeof value !== 'object') throw new Error('Stored settings are unreadable. They have been preserved.');
  const data = value as Partial<Settings>;
  if (data.version !== 1 || !Array.isArray(data.domains) || data.domains.length > 1 ||
      typeof data.enabled !== 'boolean' || typeof data.consent !== 'boolean' ||
      data.domains.some(domain => typeof domain !== 'string' || normalizeHostname(domain) !== domain) ||
      (data.domains.length > 0 && (!data.consent || !data.enabled)) ||
      (data.domains.length === 0 && (data.consent || data.enabled))) {
    throw new Error('Stored settings are unreadable. They have been preserved.');
  }
  return { version: 1, domains: [...data.domains], enabled: data.enabled, consent: data.consent };
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
    const settings = readSettings(await this.port.load());
    // Committed local configuration wins if a previous worker stopped mid-save.
    await this.enforce(settings);
    return settings;
  }

  async save(hostname: string, consent: boolean): Promise<Settings> {
    if (consent !== true) throw new Error('Read the privacy explanation and confirm before enabling blocking.');
    const domain = normalizeHostname(hostname);
    const previous = await this.current();
    if (previous.domains.length) throw new Error('A site is already saved. This development version supports one site.');
    const next: Settings = { version: 1, domains: [domain], enabled: true, consent: true };
    try {
      await this.enforce(next);
      await this.port.store(next);
      if (JSON.stringify(readSettings(await this.port.load())) !== JSON.stringify(next)) {
        throw new Error('Settings could not be verified.');
      }
      return next;
    } catch {
      try {
        await this.port.store(previous);
        await this.enforce(previous);
      } catch {
        throw new Error('Saving failed and recovery could not finish. Reopen settings to retry recovery; blocking may be incomplete.');
      }
      throw new Error('Could not save and enable blocking. Previous settings were restored. Please try again.');
    }
  }
}
