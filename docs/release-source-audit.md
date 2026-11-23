# Preliminary source audit

This is source-level evidence only, not the required audit of a final packaged artifact or a network capture. Performed on 2026-11-22 against the working tree for issue #10.

- `public/manifest.json` declares local storage, declarative net request with host access, HTTP/HTTPS host permissions, incognito exclusion and a `connect-src 'none'` extension-page CSP. The web-accessible quote page and stylesheet are the only resources exposed to ordinary sites.
- Source and generated JavaScript were searched for `fetch(`, `XMLHttpRequest`, `sendBeacon`, and `WebSocket`; none were found. HTTP URLs found in runtime code are host-access patterns and hostname parsing, while URLs in HTML are user-selected external links. This search does not prove the absence of all possible network traffic.
- Configuration and rule behavior have unit coverage, including a constant quote URL and configuration-only state. This does not substitute for inspecting the exact installed storage, rules and logs before and after real navigation, nor for attributable network capture across the required scenarios.
- `npm run check` passed outside the sandbox: typecheck, 15 unit tests, and 12 browser tests using Playwright Chromium 159.0.8154.6. This is an unpacked build, not a test of the final ZIP or either required Chrome release. The sandboxed run could not start the test runner's IPC socket.

Archive contents, bundled dependency licenses, installed state and traffic must be audited from the exact release ZIP. Browser versions and complete navigation, accessibility, recovery and traffic results remain release gates. The proposed GitHub Pages policy is not yet published or verified.
