# Shared UI baseline

The reader follows the Pulse MD design language shared by the React and Electron templates. Its current foundation is [React template b8f0d5d](https://github.com/mapleroyal/react-template/commit/b8f0d5d0da94699aef2b4f848510a7568d34cfc7), published October 4, 2026 at 14:00 CDT and checked against upstream main on that date. The older `3fb2c76bb3f89334d3f4802e0799784df5a17bcb` identifier is the audited **Pulse MD reference**, not a React-template source revision. Unused registry scaffolding alone does not establish a product convention. The [foundation record](template-foundation.md) records the source lineage, adopted changes, app-specific differences, and validation.

## Theme and typography

- Inter is the UI font; Cascadia Code is the monospace font. Typography roles are defined in `app/globals.css` and documented in `docs/learnings/typography-design-system.md`.
- The application default is `text-body-md` (14/20). Shared primitives provide role-specific defaults; screens use semantic utilities for deliberate exceptions.
- Foreground and background generate the neutral surface palette. Primary actions contrast foreground and background; focus and destructive colors remain distinct.
- Native controls inherit the document color scheme. Browser-owned option menus retain native colors and behavior.

## Controls and surfaces

- Default controls are 36 px high with 12 px horizontal insets. Icon buttons use the shared `Button` sizes; unpressed ghost icon buttons emphasize their icon on hover. Controls which represent selected state expose it through their primitive or `aria-pressed`.
- Inputs and selects use a muted fill with no persistent outline. Focus uses the shared ring, and disabled/invalid states remain owned by the primitive.
- Popup lists own their 6 px outer padding. Optional grouping must not be necessary for a correctly inset select or menu. Selects grow to fit their options, remain at least trigger-width, and stay inside the viewport; selected labels shrink with ellipsis. Menus and dialogs use a subtle edge and shadow; overlays use black at 30% without blur.
- The radius ladder starts at 6/8/10/14 px for `rounded-sm` through `rounded-xl`, with 18/22/26 px for larger surfaces. Supported browsers scale the ladder by 1.25 and use `superellipse(1.5)`; other browsers retain ordinary rounded corners. Radios, avatars, sliders, switches, and spinners stay round.
- Intentional circles and pills use `rounded-full` and never receive the superellipse treatment. Scrollbar rails, corners, and arrow backgrounds stay transparent in both themes; only direction triangles and the thumb are painted. ScrollArea retains Radix thumb/scrolling mechanics and adds direction buttons. Firefox uses its browser-owned arrows and a transparent track.
- Product dropdowns, including Calendar month/year navigation, use the shared Select or Combobox. NativeSelect is restricted to the test gallery.
- Cards frame individual study questions. Ordinary page sections, metadata, progress, and actions do not each need another panel or outline.

## Component contracts

Import primitives from `@/components/ui/*`. Reusable defaults belong in these wrappers and the shared theme, not repeated screen overrides. `cn()` merges each semantic typography utility as a complete style.

Select, Dialog, Popover, Combobox, Tooltip, Sheet, Drawer, AlertDialog, DropdownMenu, and ContextMenu use Base UI so nested dropdowns share focus and dismissal management. Compose Base UI triggers and closes with `render`. Select roots with closed, preselected human-readable labels receive `items`; selection callbacks handle nullable values. Select lists use the native shared scrollbar, without automatically registering the optional arrow overlays that hide its draggable thumb.

Checkbox and other retained Radix wrappers keep their own `asChild` APIs. Do not pass `asChild` to Base UI. Tooltips follow Pulse MD: a 400 ms provider delay, zero trigger close delay, and non-hoverable popups by default. The entire Base UI tooltip positioner ignores pointer hit testing, including its arrow; explicit `disableHoverablePopup={false}` remains available for interactive content. The responsive appearance control retains the reader's theme persistence. `components.json` records the original Radix generator style, not permission to overwrite these tuned mixed-primitive wrappers.

Preserve keyboard navigation, checked/disabled states, dismissal, and focus return provided by the underlying primitive. Product policies belong at call sites. After shared visual changes, run unit tests, lint, the production build, and the reader's browser UI checks in light/dark themes and constrained viewports.

The test-only foundation gallery is a separate Vite entry, excluded from product routes. `npm run test:ui` runs its focused checks alongside the complete Study Cards browser suite in both themes and widths. Lint enforces shared dropdown use in product code.
