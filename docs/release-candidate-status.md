# Release candidate status

Issue [#10](https://github.com/mueller-k/stoic-block/issues/10) is not complete. This document records preliminary findings, not release approval. Do not submit or publish on this evidence.

## Privacy and policy findings

- The manifest requests `storage`, `declarativeNetRequestWithHostAccess`, and HTTP/HTTPS host access, excludes incognito, and sets `connect-src 'none'` for extension pages. The worker uses local extension storage for configuration, recovery state, and a reset revision; dynamic redirect rules are derived from the blocklist. These are source observations, not a completed traffic or storage audit.
- The bundled privacy explanation previously stated that editing and disabling were unavailable. It now describes the existing controls and temporary recovery configuration. The final consent, listing, and policy copy still require comparison against the tested artifact and maintainer approval.
- Google's [user data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) says disclosure is required even when user data stays on a device, and describes an encryption-at-rest requirement. Whether the saved blocklist and this design satisfy the current dashboard categories and storage policy remains unresolved. Obtain an authoritative interpretation, including support clarification if necessary, before submission; reopen the design decision if changes are required. Do not infer dashboard answers from this note.

## Remaining release gates

- Test the exact packaged ZIP on Chrome 121 and current stable, covering the complete browser, permissions, accessibility, recovery, and privacy matrix in the [confirmed specification](https://github.com/mueller-k/stoic-block/issues/5#issuecomment-7022561461). Record browser versions, results, limitations, and sanitized evidence outside the ZIP.
- Audit the archive, generated assets, dependencies, storage, installed rules, logs, and attributable traffic. Source inspection alone does not establish absence of visit records or external traffic.
- Prepare and verify the static GitHub Pages policy, explicit user-action policy and support links, listing copy and assets, package metadata, publisher prerequisites, and intentional US-only distribution. Publishing is not authorized by the issue.
- Freeze the release commit, package and hash the exact ZIP, and obtain maintainer approval of the quotes, disclosures, and artifact. Resolve policy questions first. No release artifact or approval is claimed here.
