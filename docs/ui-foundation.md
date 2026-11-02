# UI foundation

This app integrates the React template’s November 2026 source-owned UI system: shadcn `base-luma` on Base UI, including chat and agent interface primitives. The exact source and app-specific differences are recorded in [template-foundation.md](template-foundation.md). App routing, theme persistence, PWA, hosted Nitro/Workflow runtime and data contracts remain app-owned.

## Layers

1. **Tokens and geometry:** `app/globals.css` defines the neutral palette, Inter/Cascadia fonts, semantic UI type scale and the existing squircle rules. `app-corners.js`, `AppCorners` and `SurfaceViewport` are unchanged. Intentional circles remain round.
2. **Content typography:** `styles/typeset.css` is the pinned upstream Typeset source. `styles/typeset-presets.css` adds `typeset-docs`, `typeset-chat` and `typeset-reading`, using the same theme and fonts. Typeset controls semantic content rhythm; UI text continues to use the existing semantic utilities. See [typography](typography-design-system.md).
3. **Primitives:** `components/ui` contains the current Base UI wrappers, plus shadcn's specialist libraries for command search, charts, calendars, OTP, resizing and carousels. `UiProvider` installs tooltips and Base UI toast notifications once in the app shell.
4. **AI presentation:** `components/ai` contains reusable streaming Markdown and AI SDK compositions. The hosted Generate flow uses the shared Trace, Marker and Attachment presentation for actual job states and sources. Vercel Workflow and OpenRouter retain generation, cancellation and persistence. The generic `AiChat` transport and rich-response renderer remain available source, not mounted product routes. See [AI interfaces](ai-foundation.md).

Product routes import only the presentation they use. The complete template gallery and local demo transport live under `tests/shared-ui`; the reader nesting fixture lives under `tests/foundation`. Neither directory is an application route or part of the production route bundle.

## Current shadcn additions

The checked-in primitives include Attachment, Bubble, Message, Message Scroller, Marker, Questionnaire, Trace, Code Block and Base UI Toast. The conversation layer covers streaming text and code, reasoning, source links, files, tool progress/results and explicit tool approval. The gallery includes a local streamed conversation, questionnaire, history loading and new-message navigation.

The current AI Elements are compositions, not an extra package. The retired AI SDK Elements package is intentionally absent. The former Radix/VAUL/Sonner layer has been replaced with Base UI equivalents, including Drawer, Navigation Menu, Scroll Area, menus and notifications. The legacy React Hook Form `Form` wrapper is superseded by the composable `Field` system; select a form library per application.

## Composition changes

Use Base UI's `render` prop to compose interactive primitives:

```jsx
<DialogTrigger render={<Button variant="outline" />}>Open</DialogTrigger>
<a href="/settings" className={buttonVariants({ variant: "outline" })}>Settings</a>
```

Use an anchor or router Link styled with `buttonVariants` for navigation. Base UI Button enforces button semantics even with `nativeButton={false}`; it must not wrap navigation links. See the [official Button usage guidelines](https://base-ui.com/react/components/button). PaginationLink likewise renders a real anchor.

Import `cn` from `@/lib/utils`. It now uses the current `cn/config` engine with this template's semantic typography groups. Directly importing the unconfigured `cn` would bypass those groups. New registry code must use the local helper.

Other intentional API changes:

- Accordion uses Base UI values (an array) and `multiple`, rather than Radix `type`/`collapsible`.
- Checkbox uses `indeterminate` separately from `checked`. Its expanded hit area and shaped paint surface are retained.
- Tabs preserve selection on arrow-key focus through `TabsList`'s `activateOnFocus` default.
- Menu labels belong inside their corresponding Group.
- HoverCard delay belongs on `HoverCardTrigger` as `delay`.
- Drawer uses `swipeDirection`; its nested/snap-point primitives follow Base UI.
- Progress accepts `value={null}` for indeterminate state and exports Track, Indicator, Label and Value parts.
- `toast.add({ title, description, type })` and `toast.promise(...)` come from `@/components/ui/toast`. The app shell already mounts the toaster.

The [design-system map](design-system.md) describes the preserved popup, tooltip, typography and geometry contracts.

## Downstream alignment

The app integrates copied source from the exact React commit recorded in [template-foundation.md](template-foundation.md). Keep UI primitives, AI compositions, shared CSS, Typeset, corners, controlled appearance, and the isolated gallery aligned as a unit. App routing, theme persistence, PWA, hosted server, and deployment policies remain app-owned. The upstream React/Electron templates have a shared-source check; that check is not an app script.

## Updating upstream source

`components.json` retains the `base-luma` style, JavaScript output and Hugeicons. The current baseline was generated with `shadcn@4.23.0`; its Tailwind utilities are ejected into `styles/shadcn.css` with the upstream MIT license. The generator is not a runtime dependency.

Use the current CLI's `add --dry-run`/`--diff` in a scratch copy, then merge the relevant API changes. Check the local `cn` import, typography roles, popup viewport split, hover behavior and corner paint before accepting generated files. Do not overwrite the tuned wrappers wholesale. Refresh the ejected stylesheet when upgrading the generator so new variants and utilities are available.

## Sources verified November 1, 2026

- [shadcn changelog](https://ui.shadcn.com/docs/changelog): October AI compositions and primitives, September `cn`, Base UI migration.
- [AI Elements](https://ui.shadcn.com/docs/ai-elements): current source-owned composition patterns.
- [Typeset](https://ui.shadcn.com/docs/typeset) and [Typeset documentation preview](https://ui.shadcn.com/preview/typeset/docs).
- [Base UI React documentation](https://base-ui.com/react/overview/quick-start): primitive APIs, composition and accessibility.
- [`cn` custom themes](https://github.com/shadcn-ui/cn#custom-themes): configured semantic class merging.
- [shadcn CLI](https://ui.shadcn.com/docs/cli): inspecting and adding registry source.

Shared hover, cursor, label-inset, responsive Drawer, and thumb-only scrollbar contracts are documented in [the design system](design-system.md#interaction-defaults). Explicit `render` composition preserves the supplied control's dimensions and styling; bare dropdown/disclosure triggers provide usable defaults.
