# Hosted screen design

The hosted app shares the template’s typography, appearance switcher, squircle surfaces and Base UI controls. Its product navigation contains Library and Generate; Settings remains in the study-set drawer. It has no native Chats screen.

## Library and chooser

The library is a top-aligned browse/search view. Import set and Generate cards use the same small action height and shared ghost treatment. Generate cards retains its plus icon; the Generate form submit action uses its text label without a plus. Empty and failed states show the appropriate creation or retry action instead of an empty list.

Search ranks complete local records by title and category with accent-insensitive, typo-tolerant matching. It never changes record identity or source contents. A set’s highlighted row, including its upper and lower padding, opens the reader; its favorite marker and padded options control remain separate actions. The options menu contains rename, move, export, reset and delete as applicable. Destructive actions retain their existing confirmation or Undo policy.

The chooser uses a right-side Drawer on desktop and a bottom Drawer on narrow screens. Search and creation actions stay above the scrollable set list; Settings, fullscreen and appearance controls stay in the footer. Nested menus and editors return focus to their initiating control before the drawer itself closes.

## Reader and editing

Keep the main study-card appearance, answer behavior, prompt content and shuffle persistence intact. Shuffle is an explicit labeled Switch. Matching’s input-mode buttons use Base UI ToggleGroup array values. Study-card layout belongs to the Card viewport; the answer disclosure explicitly supplies its own padded native button so the shared trigger default does not change its geometry.

Set editors focus on one task. Card editors scroll their fields while keeping Save and Cancel visible. Category suggestions share the library’s local fuzzy matching. Revision checks, canonical IDs, progress synchronization, reset/delete Undo, mutation idempotency and cancellation fences remain owned by the hosted runtime. Imported browser-only fixtures retain local reset/delete behavior without acquiring hosted edit actions.

The brand’s stacked card layers use opaque theme-derived fills. The foreground card continues to cover the layers behind it in either appearance mode. Public PWA assets and theme bootstrap are separate contracts and must not be replaced as a side effect of a screen port.

## Generate, history, and preferences

Generate places the complete source first and output options beside it on desktop, stacking them on narrow screens. Upload file and Paste text remain mutually exclusive. Saved sources use the shared Attachment with metadata, a separate removal action, editable labels, and permanent deletion in Source options. Removal only detaches the source from the draft. Incomplete uploads and failed deletions stay visible and removable; they never become valid saved-source choices. Local source and model search use the same instant fuzzy matching as the library.

Card types are a disclosure with a visible selection summary. The generation model summary opens a Popover containing the canonical model and supported reasoning-effort controls. Settings keeps those controls expanded, alongside the OpenRouter connection. Both surfaces read and write the same Postgres-backed preferences; changing a model does not erase or replace the provider key. The optional Message dialog keeps one-off instructions across dismissal and retry, clears them for a fresh set, and does not send blank instructions.

A generation detail uses one real Trace stage from the durable job snapshot. Preparing, generating and saving shimmer; queued, failed, canceled and completed states do not. Reduced motion disables the animation. Marker presents actual failures, including unconfirmed cancellation delivery. The history view keeps actual pending and failed jobs, hides deleted results, and links successful results by canonical identity. Cancel, retry and polling keep their existing request fences; switching job URLs cannot expose a stale job's actions.

The source body reaches the hosted upload/workflow path intact. These screens add no page/chapter scope, parser fallback, local agent, or chat transport. Settings preserves sign-out drain, downloadable unsynced changes, and explicit discard confirmation.

## Verification

Reader browser checks cover all seven prompt types, saved answers and shuffle, long content, full-row hit areas, keyboard context menus, fuzzy search, nested Drawer focus, persistent editor actions, opaque branding and narrow layouts. Server-sync checks retain offline/reload behavior, queued mutations, Undo and favorite persistence. These checks use isolated fixtures; they do not establish live-provider acceptance. Hosted-flow checks cover full-source payloads, durable job reload, current-job action fences, cancellation retry, complete retry settings, incomplete upload cleanup, saved-source metadata, fuzzy search, source removal versus deletion, real-stage shimmer, reduced motion, sign-out drain/download/discard and owner-session boundaries.

The hosted WebKit fixture retains the real signed owner session but removes its Secure transport flag only on the isolated HTTP loopback origin; production HTTPS cookies are unchanged. The saved-source hover case also accounts for a Playwright WebKit limitation: injected mouse moves change client coordinates while reporting zero movement deltas. That one fixture reconstructs missing deltas from consecutive coordinates, preserving zero for stationary events so Base UI's stationary-pointer guard remains effective. Chromium covers unmodified native hover and tooltip hit testing; adapted WebKit coverage is not a claim of physical-pointer Safari validation.
