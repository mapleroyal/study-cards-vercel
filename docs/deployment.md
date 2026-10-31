# Deployment

This app deploys as a single-owner Vercel project. Its database, files, and provider connection belong to that deployment. The instructions below create a fresh copy; they do not migrate an existing person's library or credentials.

## Requirements

- Access to the private [GitHub repository](https://github.com/mapleroyal/study-cards-vercel).
- A Vercel account, with Fluid compute enabled for the project.
- A Neon Postgres database, preferably near the Vercel function region configured in `vercel.json`.
- A **private** Vercel Blob store.
- An OpenRouter account/key, configured after deployment or through the environment.
- Node.js 24 and npm for development/builds; use the package lock.

The supported build combines React Router's server build, Nitro routes, and Workflow's generated handlers. Keep the handlers emitted by Nitro/Workflow; do not replace the output with a static SPA export. The [Workflow React Router v7 guide](https://workflow-sdk.dev/docs/getting-started/react-router/v7) describes this integration. [Vercel Workflow](https://vercel.com/docs/workflows) supplies managed persistence and execution; no always-running worker is required.

## Link the Vercel project

```sh
git clone git@github.com:mapleroyal/study-cards-vercel.git
cd study-cards-vercel
npm ci
npx vercel login
npx vercel link
```

Choose or create the Vercel project for this owner, then select Node 24 and Fluid compute:

```sh
npx vercel project update study-cards-vercel --node-version 24.x --fluid-compute --yes
```

Substitute your linked project's name when different. The repository's `vercel.json` sets the build command. Keep project IDs and `.vercel/` metadata out of commits. For Git-based deployments, connect the same repository and choose the production branch explicitly.

## Provision storage

The CLI path used for this adaptation provisions Neon beside the Vercel functions:

```sh
npx vercel integration accept-terms neon --yes
npx vercel integration add neon --name study-cards-vercel --billing-plan free_v3 --meta region=iad1 --meta auth=false --meta realtime=false
```

The integration connects the linked project and supplies environment values. The plan identifier is the observed free plan for this setup; check offered plans if it changes. You can also create a Neon database directly. Ensure its pooled connection string is available as `DATABASE_URL`. Use the SSL parameters supplied by Neon. The standard `pg` client handles interactive transactions. The app initializes its `lumina_*` tables and indexes on first use, serializing concurrent schema setup.

Create and connect a private Blob store using the linked Vercel project:

```sh
npx vercel blob create-store study-cards-files --access private --region iad1 --yes --environment production --environment preview --environment development
```

The command creates the private store and connects it to the linked project in the specified environments. The connection supplies `BLOB_READ_WRITE_TOKEN`. If you created the store independently, connect it to the project before deploying. PDF, TXT and Markdown files upload directly from the browser to private Blob using a short-lived, path-bound upload token issued by the authenticated app; they do not pass through the API request body. The app verifies the stored upload before making it available. Pasted text is saved through the API. Private files are never exposed as public download URLs. See [Vercel private storage](https://vercel.com/docs/vercel-blob/private-storage) and [client uploads](https://vercel.com/docs/vercel-blob/client-upload).

Use a separate database/branch and Blob store for a disposable test deployment. Do not point exploratory previews at another owner's production data.

## Configure environment variables

Start from `.env.example`. Add each value to the appropriate Vercel environment using the dashboard or interactive CLI prompts:

```sh
npx vercel env add DATABASE_URL preview
npx vercel env add APP_SECRET preview
npx vercel env add APP_PASSWORD preview
```

Repeat for production when ready. `BLOB_READ_WRITE_TOKEN` normally comes from the connected store. Do not paste secret values into shell command arguments, committed files, or chat output. The [Vercel environment CLI](https://vercel.com/docs/cli/env) also accepts values from standard input.

| Variable                | Meaning                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`          | Neon connection string for this deployment.                                                                                          |
| `BLOB_READ_WRITE_TOKEN` | Token for its private Blob store.                                                                                                    |
| `APP_SECRET`            | Random secret of at least 32 characters, used for session encryption and provider-key encryption. Keep it stable across deployments. |
| `APP_PASSWORD`          | Owner login password. Use a different password for each deployment.                                                                  |
| `OPENROUTER_API_KEY`    | Optional deployment key. Alternatively, sign in and save a key in Settings.                                                          |
| `OPENROUTER_MODEL`      | Deployment model, initially `anthropic/claude-haiku-5.5`; no user-facing model picker.                                               |

Login attempts share a Postgres-backed limit of 20 attempts per IP in 15 minutes across Vercel instances. Successful login clears that IP’s counter. The maintained `rate-limiter-flexible` adapter creates `lumina_login_limits`; database errors fail closed rather than falling back to per-process counters.

Changing `APP_PASSWORD` invalidates existing owner sessions. Changing `APP_SECRET` invalidates sessions and makes previously encrypted Settings credentials unreadable; reconnect the provider after rotating it. Redeploy after changing environment variables.

## Develop and validate

For development against provisioned test services, the current Vercel CLI can inject environment values without writing them into the repository:

```sh
npx vercel env run -e preview -- npm run dev
```

Alternatively, pull development values to an ignored `.env.local` and launch Node with that environment explicitly:

```sh
npx vercel env pull .env.local
node --env-file=.env.local node_modules/vite/bin/vite.js
```

Ordinary automated checks do not need paid inference:

```sh
npm run lint
npm run test:run
npm run build
npm run test:ui
```

Tests use provider fixtures and embedded PostgreSQL through PGlite. Browser suites named `hosted-flow` still mock inference; those tests do not establish real-model quality. Use [the verification record](verification.md) to distinguish mocked, hosted-service, and paid-inference checks.

For a regular production-mode Node preview using ignored development environment values:

```sh
npm run build
node --env-file=.env.local build/server/index.mjs
```

The ordinary build emits `build/server` and `build/client`. The Vercel build instead emits the standard `.vercel/output/config.json`, `functions/`, and `static/` layout. It temporarily keeps client files in `build/client` because React Router reads that manifest while compiling SSR; the build script copies those files into Vercel's static directory after compilation. Workflow's emitted queue-triggered function and webhook routes must remain in that output.

## Deploy

Deploy a preview from source so Vercel builds with its own deployment environment:

```sh
npx vercel deploy
```

After checking that preview, deploy production:

```sh
npx vercel deploy --prod
```

Source deployment is preferred, including when developing over SSH from macOS, so dependencies and native optional modules are built for the deployment platform. For an explicitly prebuilt deployment, use `vercel pull`, `vercel build`, and `vercel deploy --prebuilt` with matching environments. Prefer the source build when deployment/system variables are needed at build time. See [Vercel deployment commands](https://vercel.com/docs/cli/deploy).

Use the URL returned by Vercel. This guide intentionally does not hardcode a deployment hostname or project ID.

## Verify the deployed copy

1. Open the returned URL and confirm owner login works. Anonymous library, file, and generation requests must be denied.
2. Connect the owner's OpenRouter key in Settings if an environment key was not provided.
3. Paste a small supplied source, select a few cards/types, and generate. Confirm the saved set appears in the library and survives reload.
4. Upload a text-layer PDF and confirm the explicit `cloudflare-ai` parser/generation path completes. Source selection is the entire uploaded document. The small synthetic `tests/fixtures/generation-source.pdf` and matching `.txt` are available for qualification without private material.
5. Answer a card, favorite a set, reload, and confirm persisted state. Exercise an ordinary edit/delete and Undo.
6. Start a job, reload the page, and confirm its status/result remains available. Cancel a test job or delete its source before completion and confirm it cannot create a late set.

Use a disposable key with an authorized spending limit for live qualification. Verify its `limit`, `limit_remaining`, `limit_reset`, `expires_at` and `usage` through OpenRouter's `GET /api/v1/key` before and after testing. Record the tested deployment, source cases, model, result, and actual provider usage without recording secret values. Disable automatic retries of billable inference beyond the deliberate schema-repair attempt. At the end, revoke the disposable key at OpenRouter, disconnect/remove its app or environment copy, and redeploy if an environment value changed. Confirm the revoked key is rejected by a metadata request; that check requires no inference. OpenRouter's `DELETE /api/v1/keys/{hash}` requires a management key. An ordinary inference/OAuth key cannot revoke itself; use the owner's authenticated dashboard or a separately authorized temporary management key. Do not mistake removal from the app for revocation at OpenRouter.

## Operations

Neon owns persistent library/progress/job state; Blob owns uploaded files and parser artifacts. Back up and restore them as a matching deployment. Deploying new frontend code does not migrate or erase either service. Export individual study sets through the app for portable copies.

Workflow progress belongs to the job, not the browser tab. A failed job reports an error instead of silently narrowing the source or using another extraction route. Function/model limits still apply; a Workflow does not make an individual model request unlimited. The initial inference request and its optional repair share one 240-second deadline. Vercel application and Workflow functions are explicitly capped at 300 seconds. The save operation is idempotent, so retrying the save stage does not duplicate cards.

If deleting a source fails, its row remains visible for another Delete attempt, and it remains unavailable for generation. Active jobs are canceled before file removal; a late result cannot create a set from a source marked for deletion.

If PDF parsing is inadequate for a document, supply readable text or a better source document. Keep the maintained parser; do not add custom layout cleanup or an OCR service to this edition.
