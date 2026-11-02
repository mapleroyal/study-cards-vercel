# AI interface foundation

This hosted app includes the current shadcn agent interface primitives and reusable compositions in `app/components/ai`. The Generate flow maps real generation activity to Trace and Marker and represents actual source identities with Attachment. Vercel Workflow, OpenRouter, Postgres and private Blob retain generation, source processing, cancellation and persistence. There is no chat route or native agent runtime in this deployment.

The generic `AiChat`, `AiConversation`, `AiComposer`, `AiResponse` and lazy `AiRichResponse` compositions are available for future application use. They are not substituted for the hosted generation API. The deterministic AI SDK demo lives under `tests/shared-ui`, outside production routes, and never contacts a provider.

## Shared presentation

[shadcn AI Elements](https://ui.shadcn.com/docs/ai-elements) are compositions over regular UI primitives. This app vendors the current source; it does not install the retired AI Elements package. Trace owns observable activity and disclosures, Marker owns status and error notes, and CodeBlock owns formatted code and copy controls. Display only states and details provided by the existing hosted API; do not fabricate model reasoning, percentages, approvals, future plans or tool results.

`AiResponse` combines Streamdown's partial-Markdown parser with `typeset-chat`. Semantic content shares the application fonts and theme. Fenced code uses the shared CodeBlock and incremental highlighting hook, with languages loaded on demand. Shiki uses its JavaScript regex engine, preserving the hosted CSP without a WASM evaluation allowance. Unsupported languages remain readable plain text.

Set `isStreaming` accurately. Partial syntax completion applies only while a part is streaming; appending content must not restyle earlier blocks. Tables remain semantic and scroll inside the content measure.

The renderer sanitizes raw HTML and uses `rehype-harden`. Remote and data images are disabled by default. Only application-controlled `imageOrigins` may enable approved image hosts. External links retain Streamdown's safety policy. An override in `components` owns its own behavior and sanitization. [Streamdown security](https://streamdown.ai/docs/security), [link safety](https://streamdown.ai/docs/link-safety), [Typeset](https://ui.shadcn.com/docs/typeset).

## Optional rich responses

`AiRichResponse` lazily loads official Streamdown math, Mermaid and CJK plugins, including matching KaTeX CSS. Basic `AiResponse` remains the fallback during loading. Import this renderer only in flows that need it; ordinary setup, library and reader routes do not mount it.

Math uses double-dollar delimiters and accessible MathML while retaining KaTeX's untrusted-command restrictions. The lockfile's targeted KaTeX override keeps all consumers on patched `0.19.1`; consumers use the public `renderToString` API. Recheck the override when plugin ranges catch up. [KaTeX migration](https://katex.org/docs/migration).

Completed Mermaid fences render through the shared CodeBlock; partial fences remain text. Source/copy controls, a keyboard-scrollable diagram region and readable error fallback remain available. The renderer fixes strict security, disables HTML labels and click actions, rejects resource-capable metadata/directives/custom styles/image labels before rendering, and sanitizes returned SVG with DOMPurify. It accepts no model-controlled configuration. Unsupported syntax falls back to source. [Mermaid security](https://mermaid.js.org/config/usage.html#securitylevel), [DOMPurify](https://github.com/cure53/DOMPurify).

## Optional AI SDK transport

`AiChat` requires an explicitly supplied transport; it does not silently call a fabricated endpoint. A future integration must choose and qualify its backend before mounting it. Keep the transport stable, use `key={threadId}` when changing chats, and close an owned transport when no longer shared. The adapter stops its active response on unmount.

`chatOptions` forwards SDK callbacks and schemas. The default continuation predicate records real tool approvals before allowing a backend continuation; approval controls do not execute tools in the browser. No approval UI should be mounted without a corresponding backend contract.

Use the lower-level conversation/message/composer components independently when another data layer owns the data. MessageScroller requires a constrained height and stable message IDs to preserve reader position and earlier-history anchoring.

`AiComposer` calls `onSubmit({ text, files })` with a real FileList. Resolve once the draft is accepted. Rejection preserves the draft and displays an error. Enter submits, Shift+Enter inserts a line, and IME composition never submits. Duplicate submissions are locked while acceptance is pending. Its generic default file policy is not the hosted source policy; a future caller must supply its own application limits and independently enforce them on the server.

## Verification and backend boundary

`npm run test:foundation` exercises the real shared components and deterministic AI SDK lifecycle: IME, attachments, stop/retry, approval, safe Markdown, code, questionnaire, scrolling/history anchoring, Typeset rhythm, math/diagrams/CJK, themes and native/fallback corners. This is reusable component evidence, not a live OpenRouter qualification.

Product tests separately verify actual hosted generation/source/library flows with isolated fixtures. Preserve existing mutation identities, revision handling, deletion/cancellation fences and saved-set completion semantics. Credentials remain server-only. This port does not introduce a chat service, provider migration, source truncation, content repair or a native-server compatibility layer.
