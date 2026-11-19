# Chrome Web Store release requirements

Research date: 2026-11-19. Supports [Establish Chrome Web Store release requirements](https://github.com/mueller-k/stoic-block/issues/4), under [Map the public release of Stoic Block](https://github.com/mueller-k/stoic-block/issues/1).

This is planning research. No extension exists in this checkout to audit or test; no account, payment, upload, or submission was performed. Requirements below reflect official documentation consulted on the research date. Dashboard fields and policies must be rechecked before submission. Recommendations and proposed copy are explicitly provisional.

## Outcome

A local site blocker can be submitted through the ordinary extension workflow. Local operation does not remove privacy disclosure obligations. The release needs a justified minimal manifest, truthful listing, privacy policy, publisher setup, release ZIP, and functional verification. Approval is Google's decision, not something this research can guarantee.

Architecture assumptions come from [Chrome blocking and local privacy constraints](https://github.com/mueller-k/stoic-block/blob/19b3dbd/docs/research/chrome-blocking-local-privacy.md): Manifest V3, declarative redirects to a constant bundled quote page, local blocklist/preferences, no visit callbacks or records, and no extension-originated external requests. These remain specification proposals.

## Publisher prerequisites: human actions

- **Mandatory:** register a Chrome Web Store developer account, accept its agreement/policies, and pay the one-time registration fee. Use an eligible country/region and an account email the maintainer intends to keep: the registration email cannot subsequently be changed on that account. The consulted page does not establish a current fee amount; use the amount displayed at registration. [Registration](https://developer.chrome.com/docs/webstore/register)
- **Mandatory:** set a publisher name and verify the contact email. The account guide makes a physical address conditional for items offering purchases/features/subscriptions; that is separate from trader verification. Trusted testers are optional. [Account setup](https://developer.chrome.com/docs/webstore/set-up-account)
- **Mandatory before publishing/updating:** enable Google Account 2-Step Verification. [2-Step Verification policy](https://developer.chrome.com/docs/webstore/program-policies/two-step-verification)
- **Mandatory:** the publisher must accurately declare trader/non-trader status; free distribution alone does not settle this classification. Traders undergo verification. [Trader disclosure](https://developer.chrome.com/docs/webstore/program-policies/trader-disclosure)
- **Conditional, human-only:** trader verification can require legal name, address, contact phone, and identity/business evidence. Verified trader information is public on listings; the FAQ describes SMS phone verification and a Payments profile requirement. The maintainer must choose the correct individual/organization identity and complete the account-specific flow. Do not put identity documents, phone numbers, payment details, verification codes, or account tokens in research artifacts. [Trader FAQ](https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq)

Registration, legal declarations, payment, personal verification and final submission remain outside this planning effort. No existing account status was inspected.

## Permissions and single purpose

**Mandatory policy:** request the narrowest permissions that implement existing features; optional permissions also require scrutiny. Do not request future capabilities. [Use of permissions](https://developer.chrome.com/docs/webstore/program-policies/permissions)

**Mandatory dashboard fields:** describe one clear purpose; explain each declared permission; declare remote-code use accurately; complete data-use disclosures and Limited Use certification; supply the privacy policy URL. Manifest V3 does not permit ordinary remotely hosted executable files. [Privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)

**Proposed single purpose:** help people avoid chosen distracting sites by replacing blocked navigations with a bundled Stoic quote.

Proposed reviewer explanations, to revise against the actual manifest:

| Capability | Explanation for this design |
| --- | --- |
| `storage` | Retain the person's blocklist and necessary preferences locally across restarts; do not use sync or store visits. |
| `declarativeNetRequestWithHostAccess` | Install browser-enforced top-level redirect rules for blocked domains, replacing navigation with the bundled quote page. |
| Host access | Redirect HTTP/HTTPS navigations for domains the person blocks. Explain precisely whether grants are per-site or broad, and how denial/revocation affects coverage. |

These explanations are design inferences supported by the linked architecture research, not permission approvals. Avoid `history`, `tabs`, `webRequest`, `webNavigation`, content scripts, scripting, feedback permissions and unlimited storage unless a separately justified design needs them. Broad access must be defended against narrower alternatives. A powerful permission is a capability, not proof that visits are logged.

Bundle all scripts and logic. Reviewable Manifest V3 functionality must be discernible from submitted code; remotely downloaded executable logic is restricted. Stoic Block's stronger local-only promise also excludes remote quotes, fonts and analytics, even where Chrome policy might permit remote data. [Manifest V3 requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements)

## Privacy obligations and unresolved interpretation

**Mandatory:** local processing/storage still counts as handling user data and requires disclosure and a privacy policy. The FAQ also calls for prominent in-product disclosure and affirmative consent before handling, rather than relying solely on a store description. It discusses encryption for transmissions and data at rest. Its breadth should not be silently interpreted as an exemption for `storage.local`. [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)

**Mandatory:** transparently explain collection, use and sharing; disclose changed practices. [Disclosure requirements](https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements)

**Mandatory:** limit user-data use to the disclosed purpose. Browsing activity use must support a prominently described user-facing feature. Include an affirmative Limited Use compliance statement on the extension's website or linked policy. No advertising, resale, profiling, or telemetry is proposed here. [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use)

**Recommended policy contents for this particular design:** identify the extension/publisher and contact channel; describe user-entered domains/preferences and derived browser redirect rules; explain local matching and bundled quotes; state that no visited-URL list, timestamps, counts, browsing-history log, identifiers or telemetry is retained or transmitted; describe changes/removal, retention and uninstall behavior after verifying them. Separate extension activity from Chrome's installation/update services and from a person's voluntary visit to a hosted policy/support page. A policy host may itself keep server logs; do not claim the entire distribution ecosystem has zero data processing.

**Proposed public claim, only after verification:** “Your blocklist and settings stay in your Chrome profile. Stoic Block does not record your browsing activity or send it to us. Quotes are bundled; the extension makes no external requests.” Avoid “we handle no data” and “Chrome never makes network requests.”

**Still requires resolution against the final implementation/dashboard:** the collected-data category checkboxes cannot safely be inferred merely from “nothing leaves the device.” The reviewed prose does not conclusively map user-entered domains and browser-only declarative matching to every current checkbox. Explain the local data flow accurately, compare the live field definitions, and ask Chrome developer support if unclear; do not automatically certify an empty category list. Likewise, determine how the FAQ's at-rest encryption wording applies to the selected Chrome storage mechanism. Do not claim application-level encryption without implementing/verifying it or invent cryptography to satisfy an assumed interpretation. These are explicit release gates for the specification ticket, potentially requiring a narrowly scoped follow-up investigation.

**Recommended consent flow for discussion:** before the first saved blocklist/rule is activated, show what is stored and how local matching works, link the policy, and require an explicit Save-and-enable action. Keep later site additions/removals and global disable understandable. Whether this satisfies all policy requirements must be checked with final wording and behavior.

## Listing and package requirements

**Required package preparation:** valid manifest metadata, including name, version, icons and a description no longer than 132 characters. Submit a ZIP containing all extension files with `manifest.json` at its root. Test the extension locally before upload; subsequent uploads need increasing versions. [Prepare your extension](https://developer.chrome.com/docs/webstore/prepare)

**Required listing details:** accurate detailed description, appropriate category and language. Required graphic assets are a 128×128 store icon and at least one screenshot; up to five screenshots are supported. The listing guide specifies 1280×800 screenshots. Promotional video and the 440×280 small / 1400×560 marquee images are optional. [Listing fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)

**Image details:** include a PNG 128×128 extension icon in the ZIP. For screenshots use full-bleed square corners; the image guide also accepts 640×400, while preferring 1280×800. Use 1280×800 to satisfy both guides. Show actual settings and quote-page behavior, not imaginary capabilities. Icon padding/visual balance is design guidance; small promotional imagery helps visibility but is not mandatory for submission. [Images](https://developer.chrome.com/docs/webstore/images)

**Policy obligations:** avoid misleading claims, respect intellectual-property rights, test functionality, maintain accurate contact information and provide meaningful support. Keep quotation/translation provenance and rights evidence from the separate quote research. [Program policies](https://developer.chrome.com/docs/webstore/program-policies/policies)

**Recommended listing scope:** explain whole-domain matching, subdomains, how to reach settings/remove a site/disable blocking, that already-open pages remain, and the agreed navigation/incognito/permission limitations. Do not market it as an unavoidable security control or promise universal interception. Recommend Productivity as category subject to the live category list, screenshots of settings plus light/dark quote views, a public policy page without login, and a maintained support link. Website/domain verification for publisher prominence is distinct from ordinary account prerequisites.

## Proposed release evidence: not yet executed

The following are project acceptance recommendations derived from the local-only promise, not a claim that Chrome mandates a particular test framework or uploaded evidence dossier.

1. Freeze the release commit and hash the exact ZIP. Record browser/OS versions, build command/dependency lockfile, archive contents and manifest. Exclude secrets, development servers, test fixtures and unrelated files.
2. Audit generated JS/HTML/CSS, dependencies and assets as well as source. Search for analytics/crash SDKs, remote imports/fonts/images, fetch/XHR/WebSocket/beacon, external navigation, native messaging, sync, debug URL output and visit counters. Review each result; absence of a search match is insufficient proof.
3. Inspect local storage, IndexedDB, caches, installed dynamic rules and console/debug output before and after many blocked/unblocked visits, settings changes, worker restart and browser restart. Persistent values may contain configuration and necessary recovery state only. Never carry the destination URL/domain/timestamp into the quote-page address, messages or logs. Rules duplicate configuration; they must not become visit records.
4. Capture extension worker/settings/quote-page traffic during install, configuration, blocking, reload, disable, restart, idle and offline use. Attribute traffic to its initiator and compare a clean profile baseline so browser-managed update/services and ordinary browsing are not mistaken for extension requests. Preserve sanitized evidence with the release, outside the distributed ZIP. Offline success alone is insufficient evidence of zero traffic.
5. Run the architecture research's navigation/input, host-grant, incognito, restart/update, empty-list and failure-recovery matrix on the actual packaged artifact at minimum supported and current stable Chrome. Exercise removals/global disable and verify effective rules before success is shown. Record accessibility/keyboard and light/dark checks and absence of extension errors.
6. Compare the verified behavior with every listing claim, permission explanation, privacy policy, consent screen and dashboard certification. Capture their final text. Unresolved data categories/encryption interpretation block release; no speculative “no data collected” certification.

## Submission sequence for the later release owner

After the above gates: upload the ZIP as a new dashboard item; complete Store listing, Privacy, Distribution and, where helpful, Test instructions; choose public visibility and intentional regions. Test instructions can describe adding a safe test domain, seeing the quote page, and removing/disabling it; no account credentials should be needed. Submit for review. Deferred publishing allows a later manual release after approval; recommend it for a controlled first release. The documented maximum ZIP size is 2 GB, far above this project's expected needs. [Publishing workflow](https://developer.chrome.com/docs/webstore/publish)

All new items and updates are reviewed. Broad host permissions, new publishers and complex code can lengthen review. Timing is variable: most reviews take days, some weeks; the guide suggests contacting support after more than three weeks. Do not commit to a launch date based on review estimates. [Review process](https://developer.chrome.com/docs/webstore/review-process)

## Handoff to the existing specification decision

[Settle the implementation-ready release specification](https://github.com/mueller-k/stoic-block/issues/5) owns the remaining choices:

- Final permission/grant model and user-facing coverage promises.
- Privacy policy wording/hosting/contact, initial disclosure and affirmative consent flow, with deletion/retention semantics.
- How to resolve dashboard category and local-storage encryption interpretation before release; create a focused research ticket if official clarification is needed after selecting the implementation approach.
- Publisher identity/trader self-declaration, support ownership, region choices, final asset set and deferred publishing gate.
- Acceptance of the evidence matrix, minimum Chrome version and release sign-off owner.

No extra decision ticket is created now: these are specific inputs within the existing specification ticket's stated scope. Account creation, assets, implementation and publication remain outside the map's destination. This report establishes requirements and flags uncertainty; it does not settle product choices or certify compliance of unbuilt code.
