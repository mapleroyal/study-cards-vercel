# React template foundation

## Current source

The foundation is synchronized with [mapleroyal/react-template main at
b8f0d5d0da94699aef2b4f848510a7568d34cfc7](https://github.com/mapleroyal/react-template/commit/b8f0d5d0da94699aef2b4f848510a7568d34cfc7),
published **October 4, 2026 at 14:00:54 America/Chicago**. The authenticated Git
remote was checked on October 4. A template foundation is an explicit source
integration; changing AGENTS.md alone does not update it.

The app has a separate Git root, so its exact initial template revision cannot
be established from ancestry. Its initial April 22 tree shares 59 of 77 common
blobs with then-current template 38bfa7e, which is evidence of lineage rather
than proof of an identical starting tree. The last substantive app alignment
was c553ba4, corresponding to template cb0b7ca (September 7).

The old 3fb2c76bb3f89334d3f4802e0799784df5a17bcb identifier is a **Pulse MD**
design-reference commit, not a React-template commit. The later 9b90a2e record
described an AGENTS-only refresh. This distinction explains why subsequent
template fixes were missing even though the instructions looked current.

## Adopted source and deliberate app differences

| Area                  | Current integration                                                                                                                                                                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared CSS            | Current template theme/typography, true circle/pill geometry, transparent native scrollbar rails and direction triangles/thumb. Preserve the app's explicit HTML background.                                                                                                                                |
| Select                | Current Base UI wrapper: option-driven popup width, viewport bounds, selected-label ellipsis and native scrollbar without overlay arrows. Preselected product values provide human-readable items.                                                                                                          |
| Dialog and Popover    | Current Base UI wrappers so nested Select/Combobox/Calendar share focus and dismissal. Consumers migrated to render; no legacy asChild adapter added.                                                                                                                                                       |
| Calendar              | Current shared Select month/year controls preserve DayPicker navigation callbacks.                                                                                                                                                                                                                          |
| ScrollArea            | Current Radix scrolling/thumb mechanism with transparent rails and accessible repeated direction buttons, for both axes.                                                                                                                                                                                    |
| Tabs                  | Current Radix orientation and active-state selectors.                                                                                                                                                                                                                                                       |
| Governance            | Current template instructions, product-dropdown lint enforcement, and push/PR browser-validation workflow, with app-specific ownership/history links retained.                                                                                                                                              |
| Browser evidence      | Separate test-only foundation gallery plus the existing full product suite, across both themes and desktop/narrow widths. No gallery route ships in the app.                                                                                                                                                |
| Base UI runtime       | Pin 1.7.0 to the version locked by this template revision. Dependent Babel/Floating UI/Reselect packages follow the npm lock. This is not a claim to use every library's newest independent release.                                                                                                        |
| App framework/runtime | Keep Router 7.18.2, Vite 7.3.6, Vitest 4.1.11, Vercel adapter 1.3.4, and Node >=22.19; the template versions are older. The Vercel variant preserves the study UI/PWA contracts; its hosted runtime is documented in deployment.md.                                                                         |
| Other components      | Sheet, Drawer, AlertDialog, DropdownMenu, and ContextMenu use Base UI to support the app’s nested overlays. Other retained Radix wrappers keep their existing APIs. The unused Vaul dependency is removed. components.json records the original generator style; never regenerate tuned wrappers wholesale. |

The six changed upstream wrappers—Calendar, Dialog, Popover, ScrollArea,
Select, and Tabs—are adopted with their shared theme and convention changes. Wrapper
contracts are documented in [the design guide](design-system.md).

The app needs five additional wrapper integrations beyond this template tree.
A first production-browser run passed 88/104 cases but failed nested chooser
controls and generation-menu focus in every theme/viewport. Radix Sheet/Vaul
Drawer focus scopes and portaled Base UI children disagreed about modal
ownership; Escape from a Radix menu also dismissed its Base UI parent dialog.
Sheet, Drawer, AlertDialog, DropdownMenu, and ContextMenu now use their native Base UI
primitives with the app's tuned appearance. The Drawer retains native swipe
gestures. No focus trap bypass, pointer-event override, or package patch is used.
The production-build keyboard test also confirmed delayed parent dismissal
after Escape from the Radix ContextMenu. Its native Base UI replacement shares
the overlay tree and hands off to the unfavorite confirmation through
onOpenChangeComplete and boolean finalFocus, replacing the old animation-frame/timer
scheduling. Normal focus restoration retains the library default: a callback
returning true forces focus and can dismiss a newly opened popup during menu
exit. The pointer/keyboard race repair passed 24 stress cases without sleeps
or weaker assertions. Product checks cover keyboard favorite/confirmation flows as well
as pointer interaction. The production-build suite is authoritative:
concurrent writes to HTML browser reports can trigger Vite development reloads
and contaminate dev-only traces.

The foundation gallery exercises these nesting paths, alert acknowledgment,
drawer gestures, Select/Combobox/Calendar keyboard access, scrollbars, tabs,
and intentional circles. Chromium's default scrollbar-hiding test flag is
disabled, as in the template, so scrollbar assertions exercise painted rails.

The production dependency audit also required two compatible lockfile updates:
Mammoth's @xmldom/xmldom 0.8.13 → 0.8.15 and Express/body-parser's qs
6.15.3 → 6.16.0. Existing parent version ranges permit both. No broad
dependency refresh or parent API change was needed.

## Validation

Baseline at app 3947d76: lint passed; 270 unit tests across 35 files passed.
The completed integration was validated on October 4, 2026.

- Lint, whole-repository formatting, and production build passed.
- All 270 unit/integration tests across 35 files passed.
- All 172 browser cases passed in one fresh run with no retries or skips:
  108 product checks and 64 shared-foundation checks.
- Chromium 152 exercised light/dark themes at 1280×900 and 390×844, plus
  the product's constrained 320×568 layout. Desktop and touch drawer gestures,
  nested focus/dismissal, provider/model choices, offline synchronization, and
  the keyboard favorite/confirmation path were exercised.
- The menu-close/confirmation focus repair additionally passed 24 repeated
  pointer/keyboard cases; failed traces and measured focus reasons are retained.
- Representative light/dark desktop/narrow screenshots were inspected.
- Production npm audit reports zero vulnerabilities after the two bounded
  lockfile updates; real DOCX/source parsing tests passed 21/21.

The results above belong to the inherited foundation integration and are not current acceptance results for this Vercel adaptation. Its source provenance is recorded in [provenance.md](provenance.md). Machine-specific deployment evidence and PDF-service instructions are not dependencies of this repository.

Run the current validation in the authorized checkout:

```sh
npm run lint
npm run test:run
npm run build
npm run test:ui
```

Inspect browser screenshots in both themes and at narrow widths after intentional visual changes. Counts alone do not establish visual quality. The test-only foundation gallery uses `tests/foundation/vite.config.mjs` and is not an app route.

## Future updates

Fetch the current template default branch and record its full commit and
timestamp. Compare shared CSS, wrappers, lint/instructions, and browser
coverage together. Adapt actual consumers when primitive APIs change and run
the full product suite, including mixed-library overlays. Preserve newer app
framework versions and app-owned runtime/data policies. Update this record and
the provenance record so future agents can distinguish template source, app
source, built payload, and deployed version.

## Tooltip and combobox follow-up

Tooltip now follows [Pulse MD 7152d271](https://github.com/mapleroyal/pulse-md/blob/7152d271dd630213bbda8df076a2a78c46193ac3/src/components/ui/tooltip.tsx)
through Base UI, preserving the app's semantic typography and viewport bounds.
Appearance controls, sidebar triggers, and saved-source options use its render
contract. Non-hoverable tooltips ignore pointer hit testing across the popup and arrow; source
options still expose full filenames on pointer and keyboard highlight.

Combobox text labels truncate visually with 12 px padding on both sides.
Only selected items reserve 32 px on the right for the existing 16 px checkmark.
Full values and search labels remain unchanged.
