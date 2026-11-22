# Stoic Block

A local-only Chrome extension that replaces supported visits to distracting sites with a quiet Stoic quote.

## Develop

Requires Node.js 22+ and npm.

```sh
npm ci
npm run build
```

In Chrome 121 or newer, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select this repository's `dist` directory. Click Stoic Block's toolbar icon (pin it first if needed) to open settings. Enter a hostname or HTTP(S) URL, preview its coverage, read the privacy explanation, then confirm **Save and enable**. Navigate or reload a tab for that hostname to see the quote page. Already-open pages remain untouched.

Rebuild and reload the extension after changes. Configuration and dynamic rules persist across normal browser restarts. Only development builds are available; there is no store release yet.

## Verify

```sh
npx playwright install chromium
npm run check
```

The browser smoke test loads the actual build into a temporary Chromium profile and uses a local HTTP server and `.test` hostnames. It checks explicit consent, installed rules, real parent/subdomain redirects, unchanged existing pages, unrelated navigation, iframe exclusion, configuration-only storage, quote-page isolation and persistence after a full browser restart. It never changes your normal browser profile. Unit checks cover normalization, failures and baseline reconciliation. Browser tests use Playwright's bundled Chromium; Chrome 121 and current branded Chrome release validation are later gates.

## Current slice and remaining work

[Manage a validated blocklist](https://github.com/mueller-k/stoic-block/issues/7) supports up to 1,000 hostnames, including internationalized names and HTTP(S) URLs. A bundled public-suffix dataset validates entries without network access. Preview and confirm each addition, confirm removals and disabling, and re-enable immediately from settings. Explicit subdomains remain saved independently of their parents. Disabling preserves the blocklist.

The quote page selects uniformly from eight bundled historical excerpts on each page load, allowing repeats without recording selections. Settings links to offline credits with the editions, scans, contextual notes and US rights evidence. See the [collection review](docs/research/quote-collection-review.md) for verification and the maintainer's editorial and visual approvals.

Advanced concurrency, permission-loss and corruption recovery belong to [Recover settings and explain incomplete coverage](https://github.com/mueller-k/stoic-block/issues/8). The first slice serializes worker operations, verifies rules, rolls back failed saves, and reconciles to committed settings when settings load or the browser starts, but it does not claim the complete fault-recovery matrix.

Incognito is excluded. Offline/service-worker responses, restored history and protected browser surfaces may evade declarative redirects. This is a focus aid, not a security control. No accounts, configuration sync, visit records, analytics, remote quotes/fonts or extension-originated external requests are used. Chrome's own installation/update/browser traffic is separate. The web-accessible quote resource can reveal extension presence; settings and configuration are not exposed as web-accessible resources.

The canonical behavior and release gates are in the [confirmed release specification](https://github.com/mueller-k/stoic-block/issues/5#issuecomment-7022561461). [Verify privacy and prepare the public release candidate](https://github.com/mueller-k/stoic-block/issues/10) covers the broader browser matrix, privacy evidence, final disclosures and unresolved Chrome policy interpretation. No implementation smoke test constitutes release approval.
