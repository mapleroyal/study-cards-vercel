# Study Cards for Vercel

A private, single-owner study-card app adapted from Lumina's current server edition. Supply the exact chapter, section, notes, or excerpt you want to study, choose card types and a count, and generate a saved set through OpenRouter.

The library, favorites, study progress, source documents, and generation jobs persist on hosted services. The seven card types are multiple choice, multiple response, true/false, short answer, fill in the blank, ordering, and matching. The existing quiet study interface, JSON import/export, and offline study cache are retained.

## How generation works

1. Paste text or upload the specific PDF, TXT, or Markdown source document.
2. Choose the number and types of cards.
3. The app passes the entire supplied source to the configured hosted pipeline. It does not choose chapters or pages inside a larger book.
4. OpenRouter returns structured cards. The app checks the card contract and requested settings, permits one targeted repair for a concrete validation error, then saves the result atomically.

PDF parsing explicitly uses OpenRouter's maintained `file-parser` plugin with the `cloudflare-ai` engine. There is no OCR fallback, home-server service, local AI model, or custom PDF cleanup system. Straightforward exclusions are part of the generation prompt: focus on instructional text and ignore visual material and document furniture. These instructions guide generation; they are not a custom layout-analysis engine.

The deployment model is **Claude Haiku 5.5** (`anthropic/claude-haiku-5.5`) by default. There is no model picker or silent model fallback. Set your own OpenRouter key in **Settings**, or configure a deployment key through an environment variable.

## Hosted architecture

| Component                                           | Service                                            |
| --------------------------------------------------- | -------------------------------------------------- |
| App and API                                         | React Router + Nitro on Vercel                     |
| Durable generation                                  | Vercel Workflow                                    |
| Library, progress, favorites, jobs, source metadata | Neon Postgres through `pg`                         |
| Private source files and parser artifacts           | Private Vercel Blob                                |
| PDF parsing and card generation                     | OpenRouter                                         |
| Owner access                                        | Password login with an encrypted HTTP-only session |

Each deployment belongs to one person. Anyone given that deployment's password shares its library and configured provider key. Deploy a separate copy for a different owner.

## Set up a copy

Follow [the deployment guide](docs/deployment.md). It covers Vercel CLI setup, Neon, private Blob storage, environment variables, development, deployment, verification, and key rotation. The private repository is [mapleroyal/study-cards-vercel](https://github.com/mapleroyal/study-cards-vercel).

No populated database, personal documents, provider credentials, or existing server runtime is included. [Provenance](docs/provenance.md) records the source baseline and retained behavior.

## Development and checks

Use Node.js 24 (the locked deployment target) and install the locked dependencies:

```sh
npm ci
npm run lint
npm run test:run
npm run build
npm run test:ui
```

`npm run dev` starts Vite/Nitro for development. `npm start` runs a regular built Node server; `npm run build:vercel` emits Vercel output. Runtime credentials belong in the development environment, never in browser `VITE_` variables. See the deployment guide for the supported environment-loading commands.

Unit/integration tests use deterministic provider fixtures and PGlite PostgreSQL. Browser checks cover the study interface and shared components. A real deployment/OpenRouter smoke test is a separate check and can incur provider charges. [Verification](docs/verification.md) distinguishes fixture checks from live results.

The visual conventions are documented in [the design guide](docs/design-system.md), [typography guide](docs/learnings/typography-design-system.md), and [template foundation record](docs/template-foundation.md).
