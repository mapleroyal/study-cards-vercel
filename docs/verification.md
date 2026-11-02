# Verification record

This record separates deterministic checks from hosted-service and paid-provider checks. Never add API keys, owner passwords, environment files, session cookies, private source text, or credential-bearing screenshots.

## Qualification run: 2026-10-31

| Check                                                 | Environment                                                         | Result                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Source and generation integration tests               | SSH checkout, fixture Blob/provider, actual PGlite PostgreSQL       | Passed: 20 tests                                                                        |
| Fetch-to-Express API adapter                          | Plain WHATWG Request without native Node context                    | Passed: 3 regression tests                                                              |
| Focused ESLint                                        | Source/generation services, Vite configuration, Vercel build script | Passed                                                                                  |
| Vercel production artifact                            | Node 24, Vite 8, Nitro Vercel preset                                | Passed after dependency refresh, Fetch API adapter and deadline fixes                   |
| Authentication/API/shared limiter tests               | SSH checkout, deterministic fixtures                                | Passed: 11 tests, reported by backend verification                                      |
| Neon schema and shared limiter                        | Provisioned hosted test database                                    | Passed; no inference                                                                    |
| Retained reader, sync, generation-form browser checks | Production SSR with fixture API responses                           | Passed: 52 checks across light/dark desktop/narrow                                      |
| Foundation components                                 | Light/dark desktop/narrow browser gallery                           | Passed: 64 checks                                                                       |
| Actual Vercel deployment                              | https://study-cards-vercel.vercel.app                               | Passed: real production functions and hosted storage                                    |
| Live pasted-text generation                           | Actual OpenRouter Haiku 5.5                                         | Passed; job cost $0.0012705                                                             |
| Live private PDF upload and generation                | Actual private Blob, explicit Cloudflare parser, Haiku 5.5          | Passed: 7 cards covering all 7 types; job cost $0.0011618                               |
| Live persistence/edit/Undo/reload                     | Actual Vercel and Neon                                              | Passed: rename/move/card edit/Undo, stable ID/slug, selective progress reset and reload |
| Actual HTTPS PWA                                      | Service worker, offline reader, outbox, hosted Postgres             | Passed: two offline reloads and reconnect persisted answer; no API/login cache          |
| Full unit suite                                       | Final implementation before commit                                  | Passed: 32 files / 222 tests; full lint clean                                           |
| Original home-server runtime                          | Existing untouched deployment                                       | Health check passed; revision 88                                                        |
| Experimental key usage and revocation                 | OpenRouter metadata and authenticated key management UI             | Passed: $0.0024323 total; revoked key returned 401; protected key file removed          |

Focused source/generation command:

```sh
npx vitest run server/sources.test.mjs server/generation
npx eslint server/sources.mjs server/sources.test.mjs server/generation vite.config.js scripts/build-vercel.mjs
npm run build:vercel
```

The 20 source/generation tests cover complete-source delivery, strict card count/type validation, a single schema-repair attempt, explicit Cloudflare parsing without fallback, usage accounting, duplicate inference/save prevention, cancellation and source deletion, upload completion races, parser-artifact cleanup after failed metadata writes, and retryable failed deletions.

The production artifact inspection confirmed a Build Output API v3 configuration, the Node 24 application/API functions with explicit 300-second limits, the Workflow queue trigger and webhook route, static assets, the complete-source generation prompt, strict response schema, parser configuration, and registered generation/save steps. The prompt is bundled code; no old skill file or home-server path is read at runtime.

Browser verification ran against a fresh production Node server, with actual SSR/authentication/nonces and mocked app/provider API responses:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4193 npx playwright test tests/ui/hosted-flow.pw.mjs tests/ui/reader.pw.mjs tests/ui/server-sync.pw.mjs --project=light-desktop --workers=2
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4193 npx playwright test tests/ui/hosted-flow.pw.mjs tests/ui/reader.pw.mjs tests/ui/server-sync.pw.mjs --project=dark-desktop --project=light-narrow --project=dark-narrow --workers=3
```

Results were 13 + 39 passing checks. The final full unit run passed 32 files / 222 tests; full lint passed. These counts are separate from paid inference qualification.

## Live evidence

- Deployment URL: https://study-cards-vercel.vercel.app (tested deployment alias; successful PDF run on study-cards-vercel-ifefqvpgl).
- Deployed commit/revision: source deployment tested before the repository's initial commit; deployment label and production URL are recorded above.
- Node/build versions: Node 24, Vite 8; locked dependency versions in package-lock.json.
- Synthetic source: `tests/fixtures/generation-source.txt` and native-text `generation-source.pdf` (1,703 bytes, one page).
- Text generation: completed real Haiku 5.5 job d3d904ac-91a3-4573-8511-fe6b20e448f8; source Reservoir station notes; reported cost $0.0012705.
- PDF upload: real browser upload intent 201, direct private Blob PUT success, upload-token request 200, completion 200. Job 571dca5f-b689-434b-8ffd-30cf981f1f3e completed in 17.8 seconds on its first inference attempt. Exactly 7 valid cards, one of each supported type. Hosted-parser source cache is ready with 1,234 characters. Usage: 3,108 input / 1,702 output tokens; $0.0011618. Saved as Examples / Reservoir station (PDF example); reader reload passed. Parser cache creation was verified; no additional paid cache-reuse generation was needed.
- Reader/library checks: Actual Vercel + Neon rename, move, card edit, Undo, stable ID/slug and selective progress reset passed using a disposable two-card fixture. Other-card answer survived reload; fixture deleted.
- Authentication/CSP: Actual HTTPS anonymous API 401, route redirect, UI login/logout, and generation form/Settings in four theme/viewport combinations passed. Streamed scripts have CSP nonces; no hydration or JavaScript errors in those checks. PDF upload initially exposed a blocked Blob API origin; adding the exact maintained SDK upload path fixed it. The successful repeat had no CSP, JavaScript or request failures. Failed upload metadata was deleted before the successful run.
- Cancellation/deletion: deterministic integration tests passed cancellation-during-inference and deletion-before-save fences. Failed live upload metadata was deleted successfully; no extra paid cancellation request was used.
- Actual OpenRouter usage before/after, final total in USD: OpenRouter key metadata confirmed $0.0024323 total against the authorized $5 limit. Text cost $0.0012705; PDF cost $0.0011618.
- Experimental inference key revoked and metadata request rejected: confirmed on 2026-10-31 around 18:58 UTC; GET /api/v1/key returned 401 after revocation.
- Temporary management credential revoked, if one was used: none was used. The disposable inference key was created and deleted through the authenticated OpenRouter UI.
- Experimental key copies removed from Settings/environment and ignored local files: Settings disconnect returned 200 with openRouterConfigured=false; protected experimental-key file removed after the 401 revocation check. No test key was committed.

The final library contains only the two generated Examples sets for manual review. Failed upload metadata and disposable UI/PWA fixtures were removed.

Use provider usage metadata as the spending authority; job cost summaries are useful diagnostics. Fixture tests do not consume inference credits. Live tests must remain within the authorized total budget and use the exact configured model without a silent fallback.

## Repeating checks

```sh
npm ci
npm run lint
npm run test:run
npm run build:vercel:test
```

Run browser checks through `npm run test:ui` or `npm run test:foundation`. The isolated runner creates a source snapshot and disposable loopback PostgreSQL instance, excludes hosted credentials, and rejects remote test origins. The ordinary browser fixtures mock generation endpoints. Record read-only deployed checks and real-provider tests separately.

For disposable live checks, use the supplied synthetic source, create identifiable temporary sets, record results and cost, then delete test sets/sources through the application. Keep private uploads private and revoke the experimental provider key when qualification is finished.

## Follow-up: study controls and first use (2026-10-31)

- Export is available beside Rename and Move in both the reader and library. Downloads contain the saved study-set JSON, with the original card order and answers and without database metadata or progress.
- Shuffle defaults on. Proportional scheduling plus a continuation-capacity bound spreads types while guaranteeing the smallest feasible maximum run of one type. Cards within each type are randomized. Global changes clear per-set overrides; local changes affect one set. Orders, overrides, answers and visible-card position survive the covered reload/tab scenarios.
- The live OpenRouter catalog supplies compatible models and their supported reasoning levels. The initial selection is `anthropic/claude-sonnet-5.5` with `xhigh`; model/effort choices persist in owner settings, while jobs retain their original selection.
- Generation history resolves results from current library IDs. Rename updates the result, deletion removes its Open set entry, Undo restores it, and an old generation URL does not navigate to a deleted or replacement set.
- The empty library presents only two centered main actions: Generate cards and Import set. Generate actions share a + icon. First use opens a compact key dialog, then continues to the generation form. Settings can remove a key without losing model preferences or reactivating an environment fallback.

Validation on the server:

- Lint and production builds passed.
- 254 unit/integration tests passed across 36 files.
- All 72 application browser scenarios and 64 shared-component scenarios passed across light/dark desktop/narrow viewports. Focused final reruns covered first-use entry/removal, pending-state labels, and deleted-generation navigation.
- First-use credential writes and removal were verified with fixtures; the owner's connected key was not removed or replaced.
- A real Vercel generation with Sonnet 5.5/xhigh produced seven valid cards covering all seven types in one provider call. Reported cost: **$0.030006**. Its synthetic verification set and source were removed afterward.
- The live history API passed Rename, Delete and Undo checks against that generated set. Both list and detail omit its result after deletion; the existing provider connection remained configured.

The final deployed browser check also passed model/effort changes across Settings, reload and Generate; per-set/global shuffle with answer preservation; exact JSON downloads from both menus; and the deleted-generation URL. It wrote no key fields and made no inference calls. Only its own temporary study set was deleted afterward.

## Follow-up: generation limits and failure controls (2026-10-31)

Investigation of a failed 25-card Haiku 5.5/max request showed a model capacity of 128,000 tokens but an application request cap of 32,768. OpenRouter reported 44,548 native input tokens and 32,768 native completion tokens, all attributed to reasoning, with native finish reason `max_tokens`. Its reported cost was $0.0208388. This was request-cap exhaustion, not evidence that the model exceeded 128,000 tokens. The metadata lookup made no inference call.

- Removed card-count-based output budgets. Requests use the model catalog's advertised completion maximum; unknown limits remain provider defaults. Usage records now retain the requested cap, reasoning/visible token counts when known, provider and native stop reason. Output exhaustion, context-window exhaustion, connection timeouts and hosting interruptions have distinct messages.
- Removed the custom 240-second inference deadline and build-time 300-second override. Nitro and Workflow functions use `maxDuration: "max"`. The current Hobby plan still has its real 300-second limit. This supersedes the fixed-duration artifact notes above.
- Removed the eight-job history cap, 5,000-character text-answer truncation, 50-character export-filename shortening and 100-entry offline-cache/warm-up caps. JSON parsing, model-catalog fetches, upload-token expiry and SSR rendering no longer impose smaller app-specific limits. Provider/platform requirements, schema validity, authentication and security controls remain.
- Failed job status is plain text. A separate Details link opens its error/retry view; the selected job does not offer a redundant self-link. Retry preserves count/types and reuses a source only if it still exists and is ready.

Validation: lint passed; all 270 unit/integration tests across 38 files passed; production and Vercel builds passed. All 20 affected browser scenarios passed across light/dark desktop/narrow viewports, including history beyond eight entries, status/details/retry, missing-source retry, whole-source completion and long-answer reload. Four history screenshots were visually inspected. A browser-test transition assertion was corrected before the final rerun; no product change was required. Offline regression verified the first and last of 105 warmed resources remain available. No new paid generation was run for this fix.

## Follow-up: source names, generation controls and streaming cancellation (2026-10-31)

- Saved-source options keep their full stored/searchable names while showing ellipsis within the combobox. Hovering or keyboard highlighting shows the full name in a wrapping tooltip; the list no longer scrolls horizontally.
- Settings links to a dedicated Generations view on the existing route. Active jobs refresh there and expose Cancel in both rows and details. Failed signal delivery shows an explicit retry action instead of implying that upstream cancellation succeeded.
- OpenRouter requests now stream through the maintained `eventsource-parser` package. A Workflow hook and durable AbortSignal carry cancellation into the running inference step; the database fence still prevents late saves. Provider-specific cancellation behavior applies, and tokens already processed can still be charged.
- The response header/first frame records the provider generation ID before completion. Final usage updates the same entry; unknown cost remains null, including failures before response headers. Truncated/error/refusal streams do not start a schema repair. Complete valid output retains the existing single schema-repair path when needed.
- The latest reported Haiku 5.5/max failure was confirmed in production runtime logs as a Vercel 300-second timeout. Its workflow then surfaced failure on queue recovery roughly four minutes later. The old non-streaming call supplied no generation ID or final usage before termination, so its actual charge is unknown. Streaming makes future cancellation/accounting more useful but does not extend a function invocation.

Validation: lint and production builds passed; all 292 unit/integration tests across 40 files passed; all 160 UI scenarios passed across light/dark desktop/narrow configurations. The new source-picker selectors were corrected and those four cases rerun successfully; no product changes were needed. Source tooltip and Generations screenshots were inspected in all four configurations.

A separate test using the maintained Workflow Vitest integration compiled the actual orchestration and cancellation helper, redirecting only their runtime import to a fixture. Actual durable-hook replay and AbortSignal transport closed a local HTTP SSE connection, retained its provider ID, made exactly one provider request, and saved no set. This used the real generation service with PGlite and synthetic provider data, not a paid model call. No new paid inference was needed for this follow-up.

## Follow-up: one-off instructions and tooltip polish (2026-10-31)

- Fresh owners default to Haiku 5.5 with high reasoning; an existing saved model/effort remains unchanged. The current public OpenRouter catalog confirms that selection is supported.
- Generate has an optional Instructions dialog beside its submit button. Guidance is kept separate from source contents, included in the generation snapshot and idempotency receipt, preserved during schema repair/retry, and cleared for a fresh generation. Blank guidance is omitted; there is no application-specific text-length cap.
- Tooltip uses Pulse MD's Base UI behavior: the default non-hoverable popup and arrow are excluded from pointer hit testing. App consumers use the native render contract. Saved-source names remain searchable and readable in full on highlight.
- Combobox items use symmetric 12 px horizontal padding until selected; selected items retain right-side checkmark clearance.

Validation on the server: lint and production build passed; 296 unit/integration tests across 40 files passed; all 172 browser scenarios passed across light/dark desktop/narrow configurations. The first unrestricted unit run encountered concurrent PGlite startup timeouts; the complete rerun with two workers passed without changing product behavior or test timeouts. Instructions and source-picker screenshots were inspected in all four configurations. Changed-file credential scanning found no secrets. No paid inference call was made for this follow-up.

Live verification on https://study-cards-vercel.vercel.app passed for source commit `4c3d6c9c67b250a4731c9b9ce683570014fd519d`: the catalog default is Haiku 5.5/high; Instructions opens, retains edits, clears, and resets for a new generation; saved-source padding and pointer-transparent tooltip hit testing pass; desktop/narrow layouts fit. Health returned 200 and unauthenticated library access returned 401. Owner settings were identical before and after. The initial live tooltip assertion used the old role selector; inspection confirmed Base UI's popup, correct visible behavior, and the option's complete accessible name. The corrected selector passed without a product change.

Both template repositories published the same tooltip and combobox behavior. React passed 23 unit tests, Electron passed 30; each passed 128 Chromium cases, 45 standard WebKit cases, 20 focused WebKit behavior cases, and 8 theme cases. Lint and production builds passed, including unsigned Electron packaging on its declared Node 22 runtime. Keyboard tests now await actual option focus before navigation; the tooltip focus check accommodates macOS WebKit's native Tab-navigation setting. No dependencies or theme tokens changed.

## Independent review follow-up (2026-10-31)

A fresh Astra Ultra review examined only Study Cards at `4c3d6c9c67b250a4731c9b9ce683570014fd519d`, with a generic code/product-polish brief and no inherited conversation history. All nine findings were accepted:

- Sign-out drains debounced, in-flight, and shared pending writes while still authenticated. A failed drain retains the session and local data, with a recovery download and separately confirmed discard action.
- Progress captures and enforces immutable set identity, so a deleted set's queued answers cannot attach to an identical replacement with the same slug. Legacy unidentified writes receive 428 and stay available for recovery instead of being silently rebound or discarded.
- Ordering edits preserve the presentation permutation independently from the correct answer.
- Reader loading failures retain the requested slug, expose Retry, use only a matching cached set offline, and recover to the requested set or confirmed not-found. The obsolete bundled fallback exception is removed.
- Generation detail actions require the loaded job to match the selected URL; delayed or failed navigation cannot leave controls targeting the previous job.
- Category paths normalize before validation, with invalid imports/moves rejected without changing saved data.
- Visible generation history refreshes even when initially idle and refreshes on focus/visibility changes. Polling pauses while hidden.
- Saved sources show date/size details and support simple label changes; source content, Blob identity and PDF-parser filenames remain unchanged.
- Failed uploads attempt cleanup. Incomplete records remain visible and removable if cleanup fails, including after reload.

Recovery downloads identify themselves as unsynced-change records for manual review, not study-set import files. Sign-out serializes concurrent attempts and drains already-entered shared changes; it does not claim atomicity with a new edit entered by another tab after the final drain.

The reviewer used isolated probes and read-only live checks. No paid inference was used for the review or its fixes.

Final validation: lint, formatting and production build passed; all **321 unit/integration tests across 42 files** passed. The final rebuilt app passed **148 product browser scenarios** in one run across light/dark desktop/narrow configurations. All **68 unchanged shared-foundation scenarios** passed in the preceding full run. That run exposed the cached-library/error-state race above and an overbroad generation-test write counter; both were corrected before the final product run. Reader error states, source metadata/tooltips/rename controls, and unsynced-change recovery/confirmation were visually inspected in all four configurations. Credential scanning of the changed files found no secrets.

## Shared baseline and hosted layout modernization — 2026-11-01

The hosted app adopts the modern template’s Base UI wrappers, Typeset, AI presentation, exact Hyperellipse/native corner engine and appearance controls. Library, Generate, generation history/detail, Settings and editors share quiet actions, padded text triggers, responsive drawers and instant fuzzy search. Generate cards navigation retains its plus icon; the Generate submit action omits it. Library actions have matching height and text alignment. The hosted generation/Blob/Workflow architecture is retained; no native agent or Chats backend is added.

A confirmed Linux Chrome scrollbar conflict is corrected in both apps and templates: standard thin/color utilities in MessageScroller and CodeBlock bypassed the global pseudo-element rules. Those viewports now inherit thumb-only styling, and a source guard prevents the conflicting classes from returning. A separate overlapping-delete test exposed an inherited Undo receipt race. Each delete now retains its own receipt, and stale-row no-ops offer no Undo.

Local qualification ran exclusively over SSH on home-server, with hosted secrets excluded from fixture source snapshots and environments. Checks requiring a database used disposable loopback PostgreSQL; fixtures used synthetic source data and made no paid inference calls.

- Full unit/integration run: **345 tests across 46 files**; lint and isolated Node SSR/Vercel production builds pass. Clean `npm ci` reproduction leaves the lockfile unchanged.
- Product Chromium: all **244 existing scenarios qualified** (232 in the broad run, then the 12 cases with corrected navigation/tooltip/status selectors passed separately). Four additional auth/appearance checks pass. The only related layout adjustment was narrow empty-state padding; the main library alignment is measured against real text bounds.
- Shared Chromium gallery: **240 distinct cases qualified** (the full 224-case baseline and 16 new actual-native/message/code scrollbar cases). The final 24-case native/custom scrollbar run passes all themes and widths. Linux Chromium also passes all 16 new actual-wrapper cases, including keyboard, wheel, thumb dragging and autoscroll thumb hiding.
- WebKit: **32 shared foundation cases** and **20 bounded hosted cases** qualified. Hosted tests retain the real signed session while relaxing Secure only for isolated HTTP loopback. The saved-source hover case repairs Playwright’s confirmed missing mouse deltas from actual consecutive pointer coordinates; Chromium verifies the unmodified hover behavior. Production components/authentication are unchanged by these test adapters.
- PWA: actual authenticated first-visit offline reload, durable queued answer, reload/reconnect and API/login-cache exclusion pass against disposable PostgreSQL, with no external browser origin or provider/Blob/OIDC credential present.
- Router 8’s `/login/_.data` request initially redirected incorrectly. The exact login-only path is now allowed; protected documents/data and owner APIs remain denied anonymously. Held application modules verify an opaque dark canvas before hydration, matching CSP nonces, and persisted Light/Dark/System through the custom switcher.

The Vercel artifact retains Build Output API v3, Node 24, all four application/API/Workflow handlers, the generated queue trigger and `maxDuration: max`. Runtime/schema/provider services and complete-source generation contracts are unchanged apart from the precise SSR login-data allowlist adjustment. Runtime audit has no high/critical findings; 23 moderate entries propagate from the single upstream minimatch advisory [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) through Workflow. The incompatible suggested Workflow downgrade is not applied.

Private deployment preparation includes a validated PostgreSQL custom dump, transactional table fingerprints, API snapshots, Blob metadata, provider-state and prior deployment identity. Repeated predeploy snapshots match. Deployed read-only evidence and the exact release identity are recorded separately after the staged build is verified and promoted. These checks do not claim new paid-provider quality acceptance.
