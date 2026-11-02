# Typography design system

- Product UI typography is centralized in `app/globals.css` theme tokens. Rendered content uses the Typeset presets below with the same fonts and theme. Avoid component-level type overrides unless there is a clear blocker.
- Product UI text should use the semantic utilities below. Do not define product typography in components with raw Tailwind `text-*`, `font-*`, `tracking-*`, or `leading-*` utilities when a semantic token fits.
- Shared primitives should carry the correct semantic defaults so screens inherit the system by composition rather than one-off overrides.
- Each semantic utility owns size, line height, weight, and tracking as one rule. Override it with another semantic utility instead of layering raw typography utilities on top.
- `text-body-md` (14/20) is the application default. Add a utility only when the text has a more specific role.
- `cn()` is configured to merge the semantic utilities as complete type styles. Keep its type-style list synchronized with the tokens below.
- Allowed exceptions:
  - code/monospace
  - third-party rendering hooks such as charts and calendars
  - 16px mobile form controls that prevent browser zoom
  - purposeful responsive or state-specific typography changes

| Utility            | Spec                 | Intended use                        |
| ------------------ | -------------------- | ----------------------------------- |
| `text-display-lg`  | 40/48, 600, -0.03em  | hero only, max 2 lines              |
| `text-display-md`  | 32/40, 600, -0.02em  | major feature heading               |
| `text-display-sm`  | 28/36, 600, -0.015em | large promo / empty state heading   |
| `text-headline-lg` | 24/32, 600, -0.012em | primary page title                  |
| `text-headline-md` | 20/28, 600, -0.01em  | section title                       |
| `text-headline-sm` | 18/24, 600, -0.008em | dense section/card heading          |
| `text-title-lg`    | 16/24, 500, 0        | card/dialog title                   |
| `text-title-md`    | 14/20, 500, 0        | compact title, nav group title      |
| `text-title-sm`    | 13/18, 500, 0        | small supporting title              |
| `text-body-lg`     | 16/24, 400, 0        | long-form/default reading           |
| `text-body-md`     | 14/20, 400, 0        | standard app copy                   |
| `text-body-sm`     | 12/16, 400, 0.002em  | secondary/supporting text           |
| `text-label-lg`    | 14/20, 500, 0        | buttons, tabs, field labels         |
| `text-label-md`    | 12/16, 500, 0        | badges, compact controls            |
| `text-label-sm`    | 11/16, 600, 0.02em   | eyebrow/meta only, never paragraphs |

## Rendered content: Typeset

Typeset is the content layer for rendered Markdown, documentation, articles and
streaming messages. UI controls keep using the semantic roles above. Both layers
use self-hosted Inter and Cascadia Code and the same light/dark theme tokens.

Importing `globals.css` loads the owned upstream stylesheet at
`app/styles/typeset.css`, followed by our font and rhythm presets at
`app/styles/typeset-presets.css`. There is no runtime Typeset package, remote
font request or second color palette.

| Wrapper classes           | Base size                  | Leading | Flow   | Use                                          |
| ------------------------- | -------------------------- | ------- | ------ | -------------------------------------------- |
| `typeset typeset-docs`    | 16px, `text-body-lg` token | 1.75    | 1.25em | Documentation and structured Markdown        |
| `typeset typeset-chat`    | 14px, `text-body-md` token | 1.6     | 1em    | Chat responses and compact generated content |
| `typeset typeset-reading` | 18px                       | 1.85    | 1.5em  | Long-form articles and reading views         |

Upstream multiplies the base size by 1.125 below 48rem for readability. Width
belongs to the layout: add `type-measure` for the existing 68ch reading measure,
or let a conversation column set its own width. Presets set `min-width: 0` on
the content container so code and tables can scroll inside flex/grid layouts
without forcing the whole page wider.

```jsx
<article className="typeset typeset-docs type-measure">
  <MarkdownRenderer>{content}</MarkdownRenderer>
</article>
```

Typeset styles semantic HTML; it neither parses Markdown nor sanitizes HTML.
Choose a renderer appropriate to the content source and keep its unsafe HTML
support disabled unless an application deliberately sanitizes that content.
For streaming responses, use the shared Message components and their streaming
renderer; apply the chat preset to the content container.

The stylesheet uses the `components` layer so a semantic utility such as
`text-label-md` on a particular element overrides its default prose style.
Shadcn components with `data-slot` automatically keep their own element styles.
Use `not-typeset` or `data-not-typeset` around other embedded UI; those escape
hatches cover descendants, even nested `typeset` containers. They prevent prose
selectors from styling the subtree, but do not reset inherited font properties:
apply a semantic UI role to the island when it needs one.

```jsx
<div className="typeset typeset-docs">
  <p>Document content.</p>
  <div className="not-typeset text-body-md">
    <DocumentActions />
  </div>
  <div className="typeset-scroll">
    <table>{/* table remains semantic, with horizontal scrolling */}</table>
  </div>
</div>
```

The shared response renderer uses Streamdown. Its built-in root spacing utilities
are reset with a scoped `revert-layer` rule in `typeset-presets.css`, so Typeset
owns paragraph rhythm in both static and streaming mode. This integration does
not alter Streamdown or global spacing utilities.

Streaming spacing belongs to the block being appended. Preserve the upstream
one-direction margin rules; do not introduce `:last-child`, `:has()` or `:empty`
layout rules into the content layer. `tests/shared-ui/typeset.pw.mjs` exercises real
appends, UI escapes, theme changes, preset rhythm and narrow content overflow.
The native/fallback squircle system is unchanged; interactive and painted
surfaces continue to use the shared UI wrappers.

## Upstream provenance

The Typeset stylesheet was retrieved on November 1, 2026 from the official
[CSS endpoint](https://ui.shadcn.com/typeset.css). It is vendored unchanged;
product presets live separately to make upstream review straightforward.
The source at retrieval is
[shadcn/ui c0d63c3](https://github.com/shadcn-ui/ui/blob/c0d63c339d6cd2fc26135590a54cf1f362269451/apps/v4/app/%28app%29/%28typeset%29/typeset.css),
under the MIT license retained in `styles/shadcn.LICENSE`.
Refer to the current [Typeset documentation](https://ui.shadcn.com/docs/typeset)
and [documentation preview](https://ui.shadcn.com/preview/typeset/docs) when
reviewing upstream changes. Replace the upstream file deliberately; keep local
preset changes in `typeset-presets.css`.
