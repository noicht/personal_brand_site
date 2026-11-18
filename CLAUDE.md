# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

The project is `Sitios/`: landing sites, each built with SvelteKit, plus the infra that serves them from two Hetzner VPS (QA and production). The GitHub Actions workflows live in `.github/workflows/` at the repo root.

The docs, code comments, commit messages and site copy are in Spanish. UI copy uses Rioplatense voseo ("Escribí", "Probá"). Match that style.

Server IPs and domains in the docs and config are placeholders: `<IP-QA>`, `<IP-PROD>`, `<FLOATING-IP>`, `qa.example.com` (QA), `example.com` (a production domain) and `web.example.net` (the production origin). Don't replace them with real values unless asked.

## Commands

`Sitios/` is an npm workspace (`workspaces: ["clients/*", "services/*", "packages/*"]`). Run these from `Sitios/`:

```bash
npm install                     # installs every site, service and package
npm run dev -w biblioteca       # vite dev server
npm run build -w biblioteca     # adapter-static build -> clients/biblioteca/build
npm run preview -w biblioteca
npm run dev -w general          # shared API on :3100
```

New static site: `.\scripts\new-site.ps1 -Slug mi-marca` (copies `templates/site-static/`).

The repo has no tests, linter or type-check script. `jsconfig.json` extends the generated `.svelte-kit/tsconfig.json`, so run `dev` or `build` once before relying on editor types.

Deploy is only through CI (push to `main`).

## Architecture

### Sites are standalone apps

Each site in `Sitios/clients/<name>/` is a full SvelteKit app with its own `package.json`, CSS, fonts and components. The stack is Svelte 5 / SvelteKit 2.70 / Vite 5.4 (exact versions in `package-lock.json`), written in the Svelte 4 syntax that Svelte 5 still accepts in non-runes mode: `export let`, `$:`, `on:click` and `<slot />`. Don't introduce runes. `templates/site-static/package.json` declares the same versions as `biblioteca`, so every site shares one hoisted install; bump them together.

`biblioteca` is the example site. Its content (brand, nav, copy, links, contact) lives in `src/lib/data/site.js`; pages read from it. Its own components are `LivingLibrary.svelte` (WebGL background from `static/assets/biblioteca.jpg` + `biblioteca-mapas.png`), `Puerta.svelte` (entry door, once per session) and `FondoRegulador.svelte` (`?regulador` tuning panel).

### `@sitios/kit` is imported

`packages/kit` (`@sitios/kit`) holds shared foundations: Analytics, Calendly, `api/client.js`, `host.js`, `motion/reveal.js`, `fx.css`. Sites depend on `"@sitios/kit": "*"` and import from the package. A kit change reaches every site on its next build.

### Static vs. process-backed sites

The target is many sites per VPS. Sites use `adapter-static` and are served by Caddy as files from `/opt/web/www/<host>/`. A site gets its own Node container only if it has a **site-specific** server endpoint.

Shared features (contact mail, webhooks, third-party proxies) go in `Sitios/services/general/`, not in each site. Today it only has `health`. Caddy routes `/api/*` to that container with `handle_path`, so static sites can call `/api/v1/<feature>` same-origin. Use `import { general } from "@sitios/kit/api/client.js"`. In dev, a site needs a `/api` → `localhost:3100` proxy in its `vite.config.js` (see `docs/local.md`); `PUBLIC_GENERAL_URL` in a `.env` does not reach `import.meta.env` (Vite only exposes `VITE_*`). Prerendered pages can't read `$env/dynamic/*`, so layouts use `$env/static/public`.

A push to `main` publishes each changed static site to QA only, at `<site>.qa.example.com` (`/opt/web/www/<site>.qa.example.com/` on the QA server). QA uses Caddy `on_demand_tls`: a wildcard DNS record `*.qa` points at the QA server, and the `ask` endpoint in the `Caddyfile` only allows a certificate when `www/<host>/index.html` exists. A new site needs no Caddy or DNS change for QA.

Production never changes on a push. It needs `site.json` with `{ "domain": "example.com" }`, `infra/sites/<dominio>.caddy` and DNS (`@` and `www` as CNAME to the origin `web.example.net`, whose A record is the production Floating IP). The manual workflow **Promover a producción** (`.github/workflows/promote.yml`) then pulls the QA folder from the QA server through the runner into `/opt/web/incoming/` on production, and `infra/promote.sh` (run there over ssh) moves it to `/opt/web/www/<domain>/` without rebuilding, keeps the previous version in `/opt/web/prev/<domain>/` for `volver`, and records commits in `/opt/web/versions/<host>`. Because QA and production share one build, anything that must differ is decided in the browser with `isQa()` from `@sitios/kit/host.js`. Analytics never runs in QA.

The QA domain is repeated in `deploy.yml`, `promote.yml`, `packages/kit/src/host.js`, the `Caddyfile` `ask` and `infra/sites/<QA_DOMAIN>.caddy`. Keep them in sync.

### Docker build context is `Sitios/`

Images (today only `services/general/Dockerfile`) are built with `Sitios` as the context: `docker build -t general -f Sitios/services/general/Dockerfile Sitios`. `Sitios/.dockerignore` keeps `node_modules`, `.svelte-kit` and `build` out. If a site ever needs its own Dockerfile, `npm ci -w <name>` against the shared lockfile needs every workspace's `package.json` in the image, not a hardcoded list. Use `HOST=0.0.0.0`, never a public IP.

### Servers (`/opt/web` on each VPS)

Both servers have the same layout. They hold no sources and no Node install, only Docker images and files:

- `compose.yml` is a copy of `Sitios/infra/compose.yml`. It defines `caddy` and `general` (plus one service per process-backed site, none today). Images are loaded over ssh, not pulled (`pull_policy: never`).
- `Caddyfile` is versioned in `Sitios/infra/Caddyfile` (`import /etc/caddy/sites/*.caddy`). Each domain is one file in `sites/`. The repo copies live in `Sitios/infra/sites/`.
- `www/<host>/` holds static builds. `data/` holds Caddy certs and state. Never wipe `data/`.

Static `.caddy` blocks use the `estatico` snippet defined in the `Caddyfile` (`import estatico <folder>`): `handle_path /api/*` → `general:3100`, then `handle { root * /srv/<folder>; try_files {path} {path}.html; file_server }`. QA imports it with `{host}`; a production file imports it with its domain and adds a `www.` → apex redirect.

### CI deploy (`.github/workflows/deploy.yml`)

The workflow runs on pushes to `main`. It diffs `github.event.before`…`github.sha` (fallback `HEAD^`) and acts on changed sites/services/packages/infra:

- Site with `Dockerfile` → build image (context `Sitios/`), `docker save | ssh load` on both servers, `compose up -d --force-recreate <svc>`.
- Site without Dockerfile → `npm run build -w <name>`, rsync to `/opt/web/www/<name>.qa.example.com/` on the QA server only, and write commit + date to `/opt/web/versions/<name>.qa.example.com`.
- `services/general/` → image `general` on both servers.
- Manual `workflow_dispatch`: `sitios` rebuilds every static site; `todo` also does `general` and infra (use it to populate a new server).
- `Sitios/infra/` → `compose.yml` and `Caddyfile` to both servers. `sites/`: QA gets only `qa.example.com.caddy`, production gets every other block (`rsync --delete-excluded` removes what doesn't belong). Then `caddy reload`.
- `packages/` changes rebuild sites that depend on the kit.

The runner reaches both servers over plain SSH on their public IPs. Any ssh failure fails the job; nothing is silently skipped.

`.github/workflows/promote.yml` is manual only (inputs: site folder `cliente`, `promover` | `volver`). It is the only path to a production domain.

Secrets: `HETZNER_SSH_KEY`, `HETZNER_USER`, `HETZNER_HOST` (QA) and `HETZNER_PROD_HOST` (production) in the `production` environment.

## Docs

The repo is shared with students as a template repository. The audience of the docs is students: keep the guides step by step and Spanish (voseo).

- `Sitios/docs/primeros-pasos.md`: student guide, from zero to running a site locally (tools, Windows execution policy, first site, troubleshooting).
- `Sitios/docs/servidores-desde-cero.md`: student guide, QA and production for the first time, in order, each step linking to `hetzner.md` / `github-actions.md`.
- `Sitios/docs/glosario.md`: glossary of the terms used in the docs.
- `Sitios/docs/local.md`: working on your machine.
- `Sitios/docs/arquitectura.md`: the design (sites, kit, `general`, QA vs. production).
- `Sitios/docs/github-actions.md`: both workflows step by step, and the GitHub setup.
- `Sitios/docs/hetzner.md`: the operations runbook (SSH user `web-infra`, key `~/.ssh/id_ed25519_web-infra`, one-time server setup, QA, production, DNS, what to check when a domain doesn't open).

When the docs and the files disagree, trust the files.
