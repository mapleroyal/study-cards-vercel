# Template foundation integration

The current shared source is [React template `1f79c91132e3e696278cb910d96733138739af2a`](https://github.com/mapleroyal/react-template/commit/1f79c91132e3e696278cb910d96733138739af2a), the November 2026 Base UI/Typeset/AI and interaction baseline. This includes the Chrome native-scrollbar correction synchronized in React PR 5. Product layout and action/search adaptations derive from [server app `7da41b699a04209aac6d6bbfb28b0f28d0889172`](https://github.com/mapleroyal/interactive-study-cards/commit/7da41b699a04209aac6d6bbfb28b0f28d0889172); this records a source comparison, not a backend port.

## Source boundaries

The app adopts all 63 tuned UI wrappers, six reusable AI composition modules, Typeset and shadcn CSS, configured semantic `cn`, highlighting, controlled appearance UI, AppCorners and SurfaceViewport. The isolated complete gallery lives in `tests/shared-ui`; the existing nested-overlay fixture remains in `tests/foundation`. Neither is an application route.

The squircle engine is copied without changes: `app/lib/app-corners.js`, `app/components/app-corners.jsx`, `app/components/surface-viewport.jsx`, and the shared corner CSS. Hyperellipse stays pinned to `1.0.5`. Preserve native `superellipse(1.5)`, fallback painting, state invalidation and intentional round controls together.

App-specific differences are intentional: Oooh Baby branding and the HTML canvas background; the existing theme storage key, ThemeSync and pre-paint public script; the hosted root loader and nonce-bearing hydration scripts; authentication/sign-out handling; service worker/offline reader; hosted API, Workflow, database and Blob behavior. Shared rich-response rendering does not replace the existing study-card Markdown renderer.

The root mounts UiProvider once for Tooltip and Toast context. Old direct Radix/Sonner utilities are removed; cmdk's internal dependencies remain owned by cmdk. Navigation remains a real link, rather than Base Button with a link render. See [composition contracts](ui-foundation.md), [design defaults](design-system.md) and [content typography](typography-design-system.md).

## Compatible stack

Package metadata and official documentation were checked on November 1, 2026. Node stays at Vercel-supported `24.x`. The foundation uses React `19.3.1`, React Router `8.5.1`, Base UI `1.9.0`, Vite `8.3.5`, Tailwind `4.3.3`, Vitest `5.0.5`, and Playwright `1.64.1`. DayPicker uses the current `@daypicker/react` package and its v10 adapter; charts use Recharts 3. The lockfile is the authoritative exact dependency record.

Hosted SSR is retained. Nitro `3.0.261029-rc` and Workflow `5.2.3` use their documented React Router 8 integration, including SSR environment input, shared build directory and explicit workflow source directory. Keep `routeDiscovery: initial` for offline reader routes. This app does not use the React template's static SPA deployment configuration.

- [React Router v8 migration](https://reactrouter.com/upgrading/v7)
- [Workflow's React Router v8 integration](https://workflow-sdk.dev/docs/getting-started/react-router/v8)
- [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

The runtime audit currently reports 23 moderate findings propagated from the minimatch glob-amplification advisory through Workflow's dependency graph, with no high or critical findings. The suggested Workflow downgrade is incompatible with this architecture. No unverified major transitive override is applied. Reassess against upstream releases; an audit count alone does not demonstrate an exposed product route.

## Validation boundary

Use the isolated fixture runner for unit, product build, hosted-flow and PWA checks. Both Vite and Nitro can load local dotenv files; the ordinary hosted checkout contains credentials and must not be used as an uncontrolled fixture environment. Shared gallery builds have no Nitro plugin and disable dotenv discovery.

Required qualification covers lint/unit tests, hosted SSR and Vercel output builds, product fixture flows, reader/offline behavior, appearance first paint, and the shared gallery in both themes at desktop/narrow widths with native/fallback corners. Results belong in the release evidence only after execution; prior server/template pass counts are not hosted-app acceptance.

## Local qualification

The isolated hosted source passed ESLint and all 345 unit/integration tests across 46 files, including the existing provider stream, durable workflow, Postgres/PGlite, auth, cancellation and persistence contracts. Node SSR and Vercel Build Output API builds both completed; the Vercel output retains Node 24, `maxDuration: max` and Workflow's generated queue trigger.

The complete shared gallery passed 224 Chromium cases across light/dark desktop/narrow layouts. A bounded WebKit interaction/scrollbar matrix passed 32 cases, including native and forced-fallback corners. Interaction screenshots were inspected in all four appearance/width combinations. These are hosted-checkout fixture results, not reused template counts.

A source comparison confirmed 85 shared files byte-identical to the pinned React commit; including the theme stylesheet, this is an 86-file foundation layer. Global CSS differs only by the Oooh Baby import/token and the explicit HTML canvas background. The production client contains neither gallery/demo markers nor the optional Mermaid/KaTeX bundle. The fixture runner's exclusion/allowlist/symlink tests pass; a real disposable-database probe verifies query access and cleanup, and a SIGTERM probe verifies exit 130 plus owned-container removal.

Product browser, PWA and deployed acceptance are reported separately in the release verification record. Raw local evidence is stored under `work/modernization/<run>`, with source digests and commands in `run.json`.

## Earlier provenance

The prior hosted foundation came from React `b8f0d5d0da94699aef2b4f848510a7568d34cfc7`, with a later tooltip/combobox follow-up. Those mixed Radix/Base wrappers, native-only corner enhancement and arrow scrollbar defaults are superseded by this integration. Historical validation records must not be reused as current hosted qualification.
