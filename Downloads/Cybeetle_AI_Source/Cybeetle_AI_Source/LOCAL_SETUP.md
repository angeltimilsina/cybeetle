# Cybeetle AI — local source export

This is the current Site source, commit 5614eba011aba6b44c5111a37e2a6657182d5cb1. The live Site was not changed. Secrets, dependencies, generated output, repository history, browser state, and production database records are excluded.

## Open in VS Code

Extract the ZIP, choose File > Open Folder, and select Cybeetle_AI_Source (the folder containing package.json). Install Node.js 22.13 or newer and pnpm 11.25.0, matching package.json. In the VS Code terminal:

```sh
pnpm install --frozen-lockfile
```

Use pnpm, because this project has pnpm-lock.yaml rather than package-lock.json. If pnpm is unavailable, install the exact version with `npm install -g pnpm@11.25.0`.

## Environment and local database

Copy `.dev.vars.example` to `.dev.vars` at the project root and fill in only the services you need. It supplies Cloudflare Worker runtime bindings. Do not put secrets in NEXT_PUBLIC variables or commit local configuration. The website can open without an AI key; live AI requires your own key. Existing hosted secrets are not exported.

Build once to generate the local Wrangler configuration, then apply the included initial database migration:

```sh
pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_slimy_franklin_storm.sql
pnpm dev
```

Open http://localhost:5173 (or the address printed in the terminal). The database is a separate local copy; hosted users and conversations are not included. Apply each migration only once to that database.

For local simulated sign-in, visit http://localhost:5173/signin-with-chatgpt?return_to=/ . The portable development profile supplies a mock identity; it is not a real ChatGPT OAuth login. See README.md for its details. Admin access depends on the application's existing access rules, so the mock user may not be an admin.

## Chromium/Playwright service

The actual browser backend is in `browser-worker/`; its server, safety layer, tests, Dockerfile, and README are included. Read browser-worker/README.md before exposing it. This service is independent of the frontend.

For a Linux development host capable of running sandboxed Chromium:

```sh
cd browser-worker
npm install
npx playwright install --with-deps chromium
npm test
```

Copy browser-worker/.env.example to browser-worker/.env. Generate a shared secret with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Put it in SESSION_SECRET in both browser-worker/.env and root .dev.vars. Set worker ALLOWED_ORIGIN=http://localhost:5173, and DATA_DIR to a writable directory. Start the worker in a second terminal:

```sh
node --env-file=.env server.mjs
```

For local development, set `BROWSER_BACKEND_URL=http://localhost:8080` and `BROWSER_WS_URL=ws://localhost:8080` in root `.dev.vars`, then restart the frontend. HTTP and WS are supported for loopback addresses only. Open the frontend at `http://localhost:5173` so it matches the worker's `ALLOWED_ORIGIN`. Sign in using the local sign-in link above before browsing.

For a remote worker, use HTTPS with WebSocket upgrades and the corresponding WSS address. The worker's allowed origin must match the frontend origin. For locally hosted HTTPS, trust the certificate in both the Worker runtime and the browser. No HTTPS certificate or reverse proxy is supplied by this export.

With both services running, `node check-browser-live.cjs` verifies local sign-in, session creation, navigation, page reading, live frames, events, and tabs, then closes its test session. `node check-browser-session.cjs` checks concurrent session creation and stream recovery without running services. Refresh the workspace after frontend edits. Interrupted streams reconnect automatically; Settings > Check connection also reconnects an existing session.

On Windows, use WSL2 or the provided Dockerfile for the sandboxed Chromium worker. Keep the frontend in your preferred environment. No Browserless service or extension is required. See the worker README for container sandbox and network requirements.

The frontend pnpm lockfile is included. The original worker has no committed lockfile; `npm install` creates one locally. No new worker lockfile was invented for this export.

## Project map

- app/: UI pages, server routes, authentication helpers, browser/AI endpoints.
- components/, hooks/, lib/: interface and shared application code.
- db/, drizzle/: access rules, schema, SQL migrations.
- public/: original assets.
- browser-worker/: Playwright/Chromium browser-session service.
- build/: source for the Vite plugins and Cloudflare Worker entrypoint; retain this directory. It is source code, not generated build output.
- scripts/, vite.config.ts, package.json, pnpm-lock.yaml: development and build configuration.
- .openai/hosting.json: original Site identifier and logical database binding; contains no credentials.

## Existing limitations

The export preserves existing functionality and limitations. Turn-by-turn browser speech features depend on browser/microphone support. Identity Vault, VPN routing, and full-duplex voice are not implemented by merely exporting the code. Persistent browser state needs explicit opt-in and writable storage. A running Chromium worker with matching configuration is required for live browser execution.

## Validation

Archive contents and ZIP integrity were checked, and included text files were scanned for common secret formats. A clean local dependency install, build, microphone test, and live Chromium loop were not run as part of this export. Refer to README.md and browser-worker/README.md for further architecture and deployment details.
