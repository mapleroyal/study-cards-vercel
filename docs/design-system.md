# Shared UI

The visual reference is [Pulse MD](https://github.com/mapleroyal/pulse-md/tree/3fb2c76bb3f89334d3f4802e0799784df5a17bcb): quiet neutral surfaces, Inter UI text, Cascadia Code for code, and restrained rounded controls. Use ChatGPT as the reference for cases Pulse does not cover.

Defaults are implemented and tested here; this document only maps the code and the composition API.

| Contract                                                                  | Implementation                                                  | Verification                                                                    |
| ------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Palette, type scale, radii, circles, transparent scrollbars               | `app/globals.css`                                               | `tests/shared-ui/global-style.pw.mjs`, `tests/shared-ui/corners.pw.mjs`         |
| Popup padding, bounds, truncation, focus, disabled/selected states        | `app/components/ui/`                                            | `tests/shared-ui/components.pw.mjs`, `tests/shared-ui/calendar-dropdown.pw.mjs` |
| Native and fallback superellipses, clipped content, visible shadows/rings | `app/lib/app-corners.js`, `app/components/surface-viewport.jsx` | `tests/shared-ui/corners.pw.mjs`, `tests/shared-ui/control-corners.pw.mjs`      |
| Reduced motion                                                            | `app/globals.css`                                               | `tests/shared-ui/components.pw.mjs`                                             |
| Semantic typography merging                                               | `app/lib/utils.js`                                              | `app/lib/utils.test.js`                                                         |
| Shared primitive imports and product dropdowns                            | `eslint.config.mjs`                                             | `tests/design-contract.test.mjs`                                                |

## Composition API

- Navigation uses real anchors or router links styled with `buttonVariants`; Base UI Button is for actions, including when `nativeButton={false}`.
- Import controls from `@/components/ui/*`. All primitive wrappers compose with Base UI `render`. See [the foundation and migration guide](ui-foundation.md) for current APIs and AI composition layers.
- Card, Dialog, AlertDialog, Popover, HoverCard and menu surfaces use `className` for shell placement, size and paint, and `viewportClassName` for inner layout and padding. For a custom surface radius, set `[--surface-radius:40px]` once on the shell; its viewport follows automatically.
- Input, Textarea and Checkbox keep refs, events and form attributes on the native control; their `className`/`style` customize the paint surface. InputGroup owns its surface.
- Use `rounded-full` for round geometry. `data-app-corner` opts a custom painted surface into the app shape; `data-corner-shape="round"` opts it out. Custom corner surfaces reserve `::before` and `::after` for fallback paint; add `data-app-corner-focus-within` when focus lives on a descendant. Shared wrappers already handle their own shape.
- Tooltips follow Pulse MD: the popup and arrow ignore pointer input by default and close when the pointer leaves the trigger. Use `disableHoverablePopup={false}` only when hoverable tooltip content is intentional. Keyboard focus and Escape remain supported.
- Combobox items use equal horizontal padding until selected, when the trailing indicator reserves space. Plain labels truncate inside the item; custom child layouts keep control of their own content.
- [Typography roles](typography-design-system.md) describe when to choose a semantic text utility.

## App integration and maintenance

The current baseline is [React template e3b8d947c90ad50e886475592a008130dd7cebd8](https://github.com/mapleroyal/react-template/commit/e3b8d947c90ad50e886475592a008130dd7cebd8). See [the integration record](template-foundation.md) for source boundaries and qualification evidence.

The app preserves its Oooh Baby wordmark font, explicit HTML canvas background, the existing appearance storage key, pre-paint `public/theme-init.js`, service-worker/offline behavior, reader Markdown CSS, and hosted Node 24/Nitro/Workflow runtime. The controlled appearance switcher uses the app store through its existing adapter. AI presentation components do not replace the hosted generation and provider contracts.

Product dropdowns use the shared Select or Combobox, including Calendar navigation. NativeSelect remains a test-only fixture. Selected labels require the Select root's `items` mapping. Base UI ToggleGroup values are arrays; indeterminate Progress uses `value={null}`. Use `toast.add({ title, description, type, actionProps })` from `@/components/ui/toast`; the root UiProvider supplies Toast and Tooltip context.

Run `npm run lint`, `npm run test:run`, `npm run build:test`, `npm run test:ui`, and `npm run test:foundation`. The product suite includes the reader's existing overlay/chooser fixture on port 4181. The full template contract suite runs a separate production gallery on port 4182; neither gallery ships as an application route. Inspect both themes and narrow widths; counts alone do not establish visual quality.

Use `docs/learnings/typography-design-system.md` for reader-specific type decisions and [Typeset presets](typography-design-system.md) for rich document/AI compositions. Keep reusable behavior in wrappers, preserve the debugged corner implementation, and selectively review new registry source instead of regenerating tuned wrappers.

## Interaction defaults

Buttons and action/disclosure controls use the native default cursor; links use the pointer, text fields use the text cursor, and draggable handles retain their grab/resize cursors. This follows [shadcn's Tailwind v4 button default](https://ui.shadcn.com/docs/components/base/button#cursor). Do not add a pointer cursor to ordinary actions or suppress their hover feedback. Ghost icon and text buttons share a muted background hover; `aria-current="page"` gives a ghost navigation link its selected surface and stronger selected hover. Checked toggles and expanded ghost actions also retain visible hover feedback.

Product actions use the shared ghost variant: visible text or a meaningful icon at rest, a muted surface on hover, and the shared focus ring. This includes creation/import, send/stop, retry, account connection and editor save/cancel actions. Placement and labels establish the next action; ordinary actions do not need filled or outlined emphasis. Keep destructive styling for delete, reset confirmations, replacement and discard. Selects, toggles and switches retain their selection styling. Generate cards navigation retains its plus icon; only the Generate form submit action omits the plus. Library Import set and Generate cards use the same small height and centered action-row alignment.

Text triggers own their label inset. Select and an uncomposed ComboboxTrigger share one filled field style, 12px horizontal padding, hover/open feedback, and default/small heights. Input, Textarea and InputGroup own the same field hover treatment. Bare Collapsible, DropdownMenu, Popover, Dialog, AlertDialog, Sheet and Drawer triggers (and bare dialog/sheet/drawer close actions) use padded ghost action defaults; an explicit `render` supplies the composed control's style instead. Use `render={<Button variant="ghost" size="icon" />}` for an icon action with its own fixed hit area. Do not remove horizontal padding from a text trigger to align it with nearby content. Accordion keeps its 16px inset; menu items and labels keep 12px inside the padded popup viewport. Trace disclosures keep auto-height text-action styling with a 12px label inset, rather than inheriting a fixed Button height.

`className` still owns a popup's outer shell; `viewportClassName` owns content padding. Trigger insets and content insets solve separate boundaries and must not cancel each other. Drawer supports `swipeDirection="down" | "up" | "left" | "right"`; its inner viewport scrolls and defaults to 8px padding, with 16px Header/Footer padding. Top and bottom drawers show a swipe handle by default; left and right drawers omit it without reserving a side rail. Use the direction that suits the current layout; explicit render composition remains available for all triggers.

Native scrollbars and ScrollArea paint only the draggable thumb. Rails/corners stay transparent, scrollbar arrows are absent, and wheel, trackpad, thumb dragging and keyboard viewport scrolling remain available. Firefox uses its thin, transparent-rail native scrollbar. No custom direction buttons or reserved arrow space should be added.

Chromium and WebKit must retain computed `scrollbar-width: auto` and `scrollbar-color: auto` so our custom scrollbar parts are used. Standard `scrollbar-thin`, `scrollbar-thumb-*` and `scrollbar-track-*` utilities override those parts and can restore platform rails and arrows; ESLint rejects them in source, including shared wrappers. Change thumb visibility with `--scrollbar-thumb-color` instead (the message scroller uses transparent during autoscroll). Intentional `scrollbar-none` remains supported. This follows the [CSS Scrollbars compatibility requirements](https://drafts.csswg.org/css-scrollbars/); Linux Chromium raster and actual MessageScroller/CodeBlock interaction tests cover the regression.

The isolated interaction and scrollbar gallery tests verify label bounds, matching selection styles, hover/cursor states, icon geometry, native/fallback corners, and scrolling in both themes at desktop and narrow widths.

Dynamic navigation links should mirror selected `aria-current="page"` into `data-active`, as the app header does. The preserved Hyperellipse observer watches `data-active`; keep the corner implementation unchanged.

## Search behavior

All product searches update locally on input, without a submit action or debounce delay. `createFuzzySearch` indexes set titles/categories; `createFuzzyFilter` integrates the same matching with Base UI source, model and category pickers. Model searches include both the displayed label and stable provider model ID. Search does not index private document bodies or change selection/provider settings merely because the query changes.

The maintained Fuse.js 7.5 engine provides [token search](https://www.fusejs.io/token-search.html): every query word must match, words can appear in any order, accents/case are ignored, and a restrained 0.35 fuzzy threshold tolerates ordinary misspellings. Matching applies anywhere in a label, including long filename endings. Indexes are memoized per collection; Base UI predicates cache matches per query instead of rescanning for every option. Clearing restores the complete original collection; library results retain their category/favorite structure. No result or source-content cap is introduced.

Chrome's standard `scrollbar-width` and `scrollbar-color` override `::-webkit-scrollbar` parts whenever their computed values are not `auto`. In particular, `scrollbar-thin` restores platform tracks and arrow buttons on Linux Chrome. MessageScroller and CodeBlock inherit the global thumb-only policy; autoscroll visibility uses `--scrollbar-thumb-color`, including hover/active states. Keep intentional `scrollbar-none`/`no-scrollbar` hiding, but do not add standard width/color utilities to components. ESLint rejects the conflicting classes, and the actual message/code viewport fixtures verify keyboard, wheel and thumb dragging. See the [CSS scrollbar interaction rules](https://drafts.csswg.org/css-scrollbars/) and `native-scrollbars.pw.mjs` in the shared gallery.
