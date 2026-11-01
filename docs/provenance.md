# Source provenance

This repository is the portable Vercel adaptation of the current Lumina server edition, with an independent Git history and deployment.

## Verified baseline

- Source repository: [mapleroyal/interactive-study-cards](https://github.com/mapleroyal/interactive-study-cards).
- Checkout baseline: `07c7f46cde9df8f000505d6162e0be7962ef00c0` (`Support native Vercel source builds without remote Git history`).
- Original deployed source recorded by its release manifest: `a3f93c2cf27ad73e6644b64071c5bc9dd7e5aa4b`.
- The two commits between that deployed source and the checkout baseline change build/deployment/version scaffolding. The inspected server application, source service, store, provider/agent modules, shared card validator, and generation skill matched the deployed payload byte for byte.
- Template/design foundation: React template `b8f0d5d0da94699aef2b4f848510a7568d34cfc7`, with a targeted October 31 tooltip/combobox follow-up recorded in [template-foundation.md](template-foundation.md).

The adaptation began from those source files, not from an older browser-only generation implementation. It does not copy the original database, uploaded documents, credentials, logs, or machine-specific service configuration.

## Retained contracts

The seven card formats, study reader, library organization, favorites, answer progress, offline cache/outbox, import/export, revisions, idempotent mutations, and Undo come from the server edition. The generator retains complete-source delivery, source-grounded explanations, requested count/types, explicit validation, and a successful-save receipt.

The inherited generation guidance and card reference are preserved in [generation/server-generation-contract.md](generation/server-generation-contract.md) and [generation/card-format.md](generation/card-format.md). References there to tools/subagents document the original contract. The current prompt and request construction live in `server/generation/openrouter.mjs`; `shared/study-set-validation.js` is the saved-card validator.

## Adaptation boundary

- Vercel/Nitro replaces the persistent machine-hosted HTTP process.
- Neon Postgres replaces local SQLite, retaining transactional mutation and Undo semantics.
- Private Blob replaces source files on a local disk.
- Vercel Workflow replaces the agent process and its process-local queues.
- Direct hosted OpenRouter generation replaces conversational agent/tool dispatch.
- The exact supplied source replaces natural-language chapter/page selection.
- The maintained hosted file parser and simple prompt exclusions replace the separate cleanup service. There is no OCR fallback or custom document-layout engine.
- One owner password and server-side provider-key configuration replace the original machine-specific access/authentication setup.

## Verification evidence

The baseline's historical validation is provenance, not proof that this adaptation passes its own checks. Current checks must be run against this repository. Keep fixture-based checks distinct from real Vercel/OpenRouter testing, and record only verified deployment URLs, commits, usage, and results. Never record credentials or private source content in this document.
