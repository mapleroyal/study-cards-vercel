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
npm run build:vercel
```

Use the Playwright project's light/dark desktop/narrow configurations for the retained interface. `PLAYWRIGHT_BASE_URL` targets an already-running app and `PLAYWRIGHT_STORAGE_STATE` may point to an ignored authenticated session file. The ordinary browser fixtures mock generation endpoints. Record real-provider tests separately.

For disposable live checks, use the supplied synthetic source, create identifiable temporary sets, record results and cost, then delete test sets/sources through the application. Keep private uploads private and revoke the experimental provider key when qualification is finished.
