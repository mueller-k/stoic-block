# Stoic Block

A local-only Chrome extension that replaces supported visits to distracting sites with a quiet Stoic quote.

## Develop

Requires Node.js 22+ and npm.

```sh
npm ci
npm run build
```

In Chrome 121 or newer, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select this repository's `dist` directory. Click Stoic Block's toolbar icon (pin it first if needed) to open settings. Enter a hostname, preview its coverage, read the privacy explanation, then confirm **Save and enable**. Navigate or reload a tab for that hostname to see the quote page. Already-open pages remain untouched.

Rebuild and reload the extension after changes. Configuration and dynamic rules persist across normal browser restarts. Only development builds are available; there is no store release yet.

## Verify

```sh
npx playwright install chromium
npm run check
```

The browser smoke test loads the actual build into a temporary Chromium profile and uses a local HTTP server and `.test` hostnames. It checks explicit consent, installed rules, real parent/subdomain redirects, unchanged existing pages, unrelated navigation, iframe exclusion, configuration-only storage, quote-page isolation and persistence after a full browser restart. It never changes your normal browser profile. Unit checks cover normalization, failures and baseline reconciliation. Browser tests use Playwright's bundled Chromium; Chrome 121 and current branded Chrome release validation are later gates.

## Current slice and remaining work

[Save one domain and redirect a blocked visit to a bundled quote](https://github.com/mueller-k/stoic-block/issues/6) is the initial development slice. It accepts one hostname (not full URLs yet), previews hostname/subdomain coverage, obtains consent, and installs a verified redirect. To stop blocking in this slice, disable or remove the extension in Chrome. Blocklist editing/removal and global enable/disable controls follow in [Manage a validated blocklist](https://github.com/mueller-k/stoic-block/issues/7).

The excerpt in the quote page is a **provisional development fixture**, from the research candidate for Marcus Aurelius, *Meditations* 8.22, translated by George Long. It has not passed historical-scan collation, rights review or maintainer editorial approval. Do not distribute this as an approved corpus or release candidate. Eight reviewed excerpts and complete credits follow in [Ship the reviewed quote collection and accessible presentation](https://github.com/mueller-k/stoic-block/issues/9).

Advanced concurrency, permission-loss and corruption recovery belong to [Recover settings and explain incomplete coverage](https://github.com/mueller-k/stoic-block/issues/8). The first slice serializes worker operations, verifies rules, rolls back failed saves, and reconciles to committed settings when settings load or the browser starts, but it does not claim the complete fault-recovery matrix.

Incognito is excluded. Offline/service-worker responses, restored history and protected browser surfaces may evade declarative redirects. This is a focus aid, not a security control. No accounts, configuration sync, visit records, analytics, remote quotes/fonts or extension-originated external requests are used. Chrome's own installation/update/browser traffic is separate. The web-accessible quote resource can reveal extension presence; settings and configuration are not exposed as web-accessible resources.

The canonical behavior and release gates are in the [confirmed release specification](https://github.com/mueller-k/stoic-block/issues/5#issuecomment-7022561461). [Verify privacy and prepare the public release candidate](https://github.com/mueller-k/stoic-block/issues/10) covers the broader browser matrix, privacy evidence, final disclosures and unresolved Chrome policy interpretation. No implementation smoke test constitutes release approval.
