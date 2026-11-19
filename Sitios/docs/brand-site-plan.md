# n0icht Brand Site: Plan

Companion to `docs/brand-site-brief.md`. Read both at the start of every session.
Paths are relative to `Sitios/` unless they start with `.github/`.

Status: Milestone 0 (discovery and plan) done. No application code, dependency or
config was changed. Items marked **[DECISION]** wait for the owner's answer; the
plan assumes the recommended option until then.

## 1. Findings

### 1.1 What the repository is

It is not a single SvelteKit app. `Sitios/` is an npm workspace
(`clients/*`, `services/*`, `packages/*`) that hosts many independent static
sites plus the infra that serves them.

| Area | What exists |
| ---- | ----------- |
| Sites | One: `clients/biblioteca/` (example site for students, Spanish, `lang="es"`). |
| Template | `templates/site-static/` (not a workspace). Copied to `clients/<slug>/` by `scripts/new-site.ps1` (PowerShell) or by hand (`cp -r` + placeholder replace + `npm install`). |
| Shared package | `packages/kit` (`@sitios/kit`): `Analytics.svelte` (GA4), `Calendly.svelte`, `api/client.js`, `host.js` (`isQa()`), `motion/reveal.js`, `fx.css` (`.fx-reveal`). |
| Shared API | `services/general/` (plain Node, only a `health` feature), behind `/api/*` in Caddy. |
| Infra | `infra/Caddyfile` (snippet `estatico`), `infra/compose.yml` (`caddy` + `general`), `infra/sites/qa.example.com.caddy`, `infra/promote.sh`. |
| CI | `.github/workflows/deploy.yml` (push to `main`), `.github/workflows/promote.yml` (manual). |

Resolved versions (`package-lock.json`, lockfile v3): svelte 5.57.3,
@sveltejs/kit 2.70.4, vite 5.4.21, @sveltejs/vite-plugin-svelte 4.0.4,
@sveltejs/adapter-static 3.0.11. No `typescript`, no `three`.

### 1.2 Routes and layouts (per site)

- `src/routes/+layout.js`: `export const prerender = true;` and nothing else.
- `src/routes/+layout.svelte`: imports the site CSS and `@sitios/kit/fx.css`,
  renders `<Analytics>`, header (logo + nav from data), `<slot />`, footer.
  Header and footer are inline in the layout, not components.
- `src/routes/+page.svelte`: one page. `<main>` with one `<section id="…">` per
  block; nav links are `/#id` anchors. No other routes, no `+error.svelte`,
  no `+server.js`, no stores, no `hooks`.
- `svelte.config.js`: `adapter-static` with default options (no `fallback`,
  no `paths.base`, no preprocessors). `vite.config.js`: only `sveltekit()`.
- `src/app.html`: `%sveltekit.assets%/favicon.svg`,
  `<body data-sveltekit-preload-data="hover">`. `biblioteca` loads Playfair
  Display from Google Fonts (the new site must not do this).

### 1.3 Conventions that must be followed

- **Svelte 4 syntax under Svelte 5** (non-runes mode): `export let`, `$:`,
  `on:click`, `<slot />`, `createEventDispatcher`, `use:action`,
  `bind:this`. No runes anywhere in the repo.
- **Plain JavaScript + JSDoc.** No TypeScript files. `jsconfig.json` extends
  `.svelte-kit/tsconfig.json` with `allowJs: true`, `checkJs: false`. Types are
  written as JSDoc (`/** @type {…} */`, `@param`).
- **Components** in `src/lib/Components/` (capital C), PascalCase files, a
  JSDoc block at the top of `<script>` explaining the component, documented
  `export let` props.
- **Styling:** global CSS in `src/lib/css/site.css`, imported once by the
  layout. Components have **no `<style>` blocks**. Tokens are CSS variables in
  `:root`. Class prefixes: `site-` for generic layout (`site-wrap`,
  `site-header`, `site-section`, `site-btn`), a short site prefix for
  site-specific blocks (`bib-`), `fx-` reserved for the kit, state classes
  `is-*`. No Tailwind, no CSS framework, no preprocessor.
- **Content** in a data module (`src/lib/data/site.js`), never in markup.
- **Browser-only code** in `onMount`, with cleanup returned from it
  (`LivingLibrary.svelte` is the reference: WebGL context, `ResizeObserver`,
  `matchMedia("(prefers-reduced-motion: reduce)")`, `webglcontextlost`
  fallback, DPR cap, `aria-hidden` canvas, static image when WebGL fails,
  camera driven by `main > section` offsets).
- **Build-time env:** `import * as env from "$env/static/public"` (namespace
  import so an undefined variable does not break the build), with a fallback
  value in the content module. CI builds without any `.env`, so a value that
  must reach production has to live in the content module.
- **Formatting (by observation, not enforced):** 2 spaces, double quotes,
  semicolons, trailing commas, lines up to about 120 columns.
- **Language:** docs, code comments, commit messages and UI copy are Spanish
  (Rioplatense voseo) per `CLAUDE.md`. See decision D7.
- **Placeholders:** `qa.example.com`, `example.com`, `web.example.net`,
  `<IP-QA>` etc. stay as they are.
- **Git:** one commit on `main` (`Initial commit`). `.gitattributes` forces LF.
  No hooks.

### 1.4 Lint, format, type-check, tests

**None exist.** No ESLint, Prettier, `svelte-check`, Vitest, Playwright,
`.editorconfig`, `.nvmrc` or `.npmrc`. Each site has only `dev`, `build`,
`preview`. CI runs no checks; it only builds.

This conflicts with the brief ("run lint, format, `svelte-check`, tests and
`vite build`"; "add Vitest tests where a runner exists"). See decision D2.

### 1.5 Static assets, i18n, fonts, sitemap

- Static assets: `static/favicon.svg` plus `static/assets/*` in `biblioteca`.
- i18n: none. No sitemap, no `robots.txt`, no OG tags, no JSON-LD anywhere.
- Fonts: system stack (`"Segoe UI", system-ui, sans-serif`); nothing self-hosted.
- The brand logo is **not** at `static/brand/` yet. It sits untracked at
  `Sitios/logo-b-glyph-mark.svg` (8,832 bytes, of which about 8 KB is an
  embedded C2PA `<metadata>` manifest; the drawing itself is 12 `<rect>`s).

### 1.6 How the build is served

- `npm run build -w <site>` writes `clients/<site>/build/` (HTML per route,
  `_app/immutable/*` hashed assets, `static/` copied to the root).
- **QA:** every push to `main` that touches `Sitios/clients/<site>/**` builds
  that site on the runner (Node 22, `npm ci`) and rsyncs it to
  `/opt/web/www/<site>.qa.example.com/` on the QA server. Caddy
  `on_demand_tls` + wildcard DNS: a new site needs no Caddy or DNS change.
  QA sends `X-Robots-Tag: noindex, nofollow`.
- **Production:** never changes on push. Needs `site.json` `domain`,
  `infra/sites/<domain>.caddy`, DNS, then the manual **Promover a producción**
  workflow, which copies the QA build without rebuilding. QA and production
  therefore share one build; anything that differs is decided in the browser
  (`isQa()`).
- Caddy `estatico` snippet: `encode gzip`, `/api/*` to `general:3100`,
  `try_files {path} {path}.html`, `file_server`. No cache headers, no custom
  404, gzip only (no zstd/brotli).
- A site gets a container only if it has a `Dockerfile`; the brand site stays
  static, so Docker is not involved.

### 1.7 Environment notes

- `node_modules` is not installed, so the baseline build was **not** verified
  in this milestone (installing was out of scope). M1 starts with `npm ci` and
  a baseline `npm run build -w biblioteca`.
- Local toolchain is Node 26.8.1 / npm 12.0.2; CI and docs use Node 22. No
  version manager is installed. See risk R8.
- Available locally: `rsvg-convert`, `magick`, `pyftsubset`, `woff2_compress`,
  `firefox`. Not available: Chrome/Chromium (needed by Lighthouse, risk R9).

## 2. Replace the home page or add routes? Neither: a new site

**Recommendation (most conservative): create a new site `clients/n0icht/` from
`templates/site-static/`.** [DECISION D1]

| Option | Effect | Verdict |
| ------ | ------ | ------- |
| A. Replace `biblioteca`'s home | Rewrites the example site students use; its layout wraps everything in `.bib` with the WebGL library, the door and Google Fonts. | Rejected: restructures existing code. |
| B. New routes inside `biblioteca` | The brand site would inherit `lang="es"`, the library background and 1,094 lines of unrelated CSS, or need layout groups and resets. | Rejected. |
| C. New site `clients/n0icht/` | Zero changes to existing sites, kit, template, infra or CI. It is the path the repo documents for a new site. QA URL comes for free: `n0icht.qa.example.com`. | **Recommended.** |

Consequences of C:

- Slug `n0icht` (valid for `^[a-z0-9]+(-[a-z0-9]+)*$`) is the folder name, the
  `package.json` `name`, the `-w` argument and the QA subdomain.
- The only file touched outside `clients/n0icht/` is `package-lock.json`
  (new workspace and its dependencies), plus optional doc lines in M5.
- Inside the new site the brand site **is** the home page (`/`), as a single
  page with anchored sections, matching the existing routing pattern.

## 3. Where new code will live

```
clients/n0icht/
  package.json  jsconfig.json  svelte.config.js  vite.config.js   # from the template
  site.json                      # { "domain": "" } until production is decided
  README.md  .env.example
  static/
    brand/logo-b-glyph-mark.svg  # moved from Sitios/, byte-identical
    brand/og.png  brand/apple-touch-icon.png      # M5, rasterised from the SVG
    fonts/*.woff2  fonts/OFL-*.txt
    robots.txt  sitemap.xml                       # M5, only once the domain is known
  src/
    app.html                     # lang="en", theme-color, icon, font preloads
    routes/
      +layout.js                 # prerender = true (unchanged from the template)
      +layout.svelte             # CSS imports, header/nav, <slot />, footer, SystemGraph, CommandPalette
      +page.svelte               # <main> composing one <section> per block
    lib/
      css/
        tokens.css               # :root variables (colors, type, spacing, z-index)
        site.css                 # base, layout, panels, sections
        terminal.css             # terminal + command palette
        playground.css           # imported by the lazy Playground component (own CSS chunk)
      content/                   # all copy and data, JS + JSDoc typedefs
        types.js  site.js  terminal.js  pipeline.js  projects.js  stack.js
        experience.js  writing.js  contact.js  playground.js  validate.js
      terminal/                  # pure logic, no DOM
        parser.js  commands.js  session.js  boot.js
      three/                     # the only code that imports "three"
        index.js  graph.js  nodes.js  edges.js  packets.js  camera.js  pulse.js  theme.js
      playground/                # pure simulation, no DOM
        model.js  simulate.js  prng.js
      stores/
        scene.js                 # active pipeline stage, pulse requests, scene status
        ui.js                    # palette open state, reduced-motion flag
      Components/
        Panel.svelte  StatusDot.svelte  PixelLoader.svelte  Seo.svelte
        Hero.svelte  Terminal.svelte  CommandPalette.svelte
        SystemGraph.svelte       # canvas shell + static SVG fallback
        Pipeline.svelte  Projects.svelte  ProjectCase.svelte  ArchDiagram.svelte
        StackPanel.svelte  Gauge.svelte  Experience.svelte  Writing.svelte  Contact.svelte
        Playground.svelte  PlaygroundDiagram.svelte  PlaygroundControls.svelte  PlaygroundMetrics.svelte
```

How it plugs into the existing layout and routing pattern:

- **Layout** keeps the template's shape: CSS imports, sticky header with
  `nav` from content, `<slot />`, footer. Additions: `<SystemGraph>` as a
  fixed, `aria-hidden` background behind an `isolation: isolate` wrapper (same
  technique as `.bib` / `.bib-bg`), and `<CommandPalette>`.
- **Page** keeps the `main > section#id` structure. Section ids: `top`,
  `pipeline`, `projects`, `playground`, `stack`, `experience`, `writing`
  (flag), `contact`. Nav uses `/#id` hrefs.
- **3D and scroll:** `SystemGraph.svelte` measures `main > section` like
  `LivingLibrary.svelte` does and feeds a `progress`/`stage` API exposed by
  `src/lib/three/index.js`. `Pipeline.svelte` writes the active stage to
  `stores/scene.js`; the terminal's `deploy --prod` and pointer clicks push
  pulse requests through the same store.
- **Terminal and palette** share one command registry
  (`terminal/commands.js`). Commands return data and effects
  (`{ type: "navigate", href }`, `{ type: "pulse" }`), never touch the DOM, so
  they are testable in Node.
- **Deviations from the template, on purpose:**
  - `src/lib/content/` replaces `src/lib/data/site.js` (the brief requires it).
  - `<Analytics>` is not rendered (brief: no tracking scripts, no runtime
    CDNs). `@sitios/kit` stays as a dependency for `reveal` and `fx.css`.
  - CSS is split into a few files under `src/lib/css/` instead of one, so the
    playground CSS can be code-split. Still global CSS, still no `<style>`
    blocks. Site-specific class prefix: `n0-`.
  - `src/app.html` uses `lang="en"`.

## 4. Dependencies

Nothing was installed in M0. Versions checked against the npm registry on
2026-11-18; all were published more than 7 days ago.

| Package | Version (exact) | Published | Type | Justification |
| ------- | --------------- | --------- | ---- | ------------- |
| `three` | `0.187.0` | 2026-10-30 | dependency | The 3D background (brief). Zero runtime dependencies, MIT, tree-shakeable core. Imported only through `await import()`. |
| `@types/three` | `0.187.0` | 2026-10-30 | devDependency | Types for `src/lib/three/*.js` (JSDoc + `// @ts-check`). Only useful to the editor unless D2 adds a checker. Pulls 6 type/tooling packages into the lockfile (dev only, never bundled). |
| `svelte-check` | `4.7.8` | 2026-11-01 | devDependency | **[D2]** The brief's `svelte-check` gate. Peer: `typescript ^5 \|\| ^6`. |
| `typescript` | `6.0.3` | 2026-04-16 | devDependency | **[D2]** Required by `svelte-check`. 6.x because `@sveltejs/kit` 2.70.4 and `svelte-check` 4.7.8 both declare `^5 \|\| ^6`; TypeScript 7.x (npm `latest`) is outside both ranges. No `.ts` files are written. |

Not proposed:

- **Vitest.** Current Vitest (4.x, 5.x) requires Vite 6 or newer; this repo is
  on Vite 5.4. Only the old `3.2.7` line (2026-07-06) supports Vite 5.
  Recommended instead: Node's built-in runner (`node --test`), zero
  dependencies, available in Node 22. See D2.
- **ESLint / Prettier.** The repo has neither config nor convention for them.
- **Threlte, GSAP, post-processing addons, zod, i18n libraries, font
  packages, icon packages.** Not needed.

Install commands for M1 (from `Sitios/`), after which the lock diff must only
add packages:

```bash
npm install -w n0icht --save-exact three@0.187.0
npm install -w n0icht --save-dev --save-exact @types/three@0.187.0 svelte-check@4.7.8 typescript@6.0.3
```

`three` itself can wait until M2; it is listed here so the lockfile changes once.

## 5. Decisions

| # | Topic | Recommendation |
| - | ----- | -------------- |
| D1 | Placement | New site `clients/n0icht/` (section 2). **[DECISION]** |
| D2 | Quality gates | Add `svelte-check` + `typescript` to the new site only; tests with `node --test`; no ESLint/Prettier, formatting follows the observed style. **[DECISION]** |
| D3 | Contact form | `mailto:` by default, optional external endpoint. |
| D4 | i18n | No i18n system exists. Single English content set in `src/lib/content/`, `lang="en"`. |
| D5 | Fonts | JetBrains Mono + Chakra Petch, self-hosted. **[DECISION]** on the display font. |
| D6 | Sitemap | The repo has none. Add a static one in M5 only if the production domain is known. |
| D7 | Language of comments, commits, README | Follow `CLAUDE.md` (Spanish); site copy in English. **[DECISION]** |
| D8 | Logo file | Use byte-identical, keep the embedded metadata. **[DECISION]**, low priority. |

### D2. Quality gates

Proposed scripts in `clients/n0icht/package.json`:

```json
"check": "svelte-kit sync && svelte-check --jsconfig ./jsconfig.json",
"test": "node --test \"src/**/*.test.js\""
```

- Type-checking is opt-in per file with `// @ts-check` and JSDoc typedefs
  (`content/types.js`), so the untyped kit code does not produce noise.
- Tests are colocated (`parser.test.js` next to `parser.js`). Modules under
  test use relative imports only (no `$lib`, `$app`, `$env`), which keeps
  `terminal/`, `playground/` and `content/` framework-free.
- Gate before finishing each milestone:
  1. `npm run check -w n0icht`
  2. `npm test -w n0icht`
  3. `npm run build -w n0icht` (and `-w biblioteca` whenever the lockfile changed)
  4. Runes guard: no match for
     `\$(state|derived|props|effect|bindable|inspect)\b|\{#snippet|\{@render`
     in `clients/n0icht/src`.
  5. Bundle guard (from M2): `three` only in lazy chunks (section 7, R2/R3).
- CI is not changed: it keeps building only. Gates run locally.
- If the owner prefers the strict reading of the brief ("tests only where a
  runner exists"), the fallback is: no new dev tooling, gate = build + guards.

### D3. Contact form under adapter-static

- Terminal-styled `<form>` with real `<label>`s, a honeypot field and an
  `aria-live` status line.
- **Default mode (no endpoint):** submit composes a `mailto:` URL (subject and
  body from the fields). A plain `mailto:` link and the social links are
  always in the prerendered HTML, so contact works without JavaScript.
- **Endpoint mode:** if `PUBLIC_CONTACT_ENDPOINT` (read with
  `import * as env from "$env/static/public"`) or `contact.endpoint` in
  `content/contact.js` is set, submit does `fetch(endpoint, { method: "POST" })`
  with JSON and falls back to the `mailto:` link on error. Because CI builds
  without `.env`, the production value goes in `content/contact.js` (a form
  endpoint URL is public, not a secret). This is the same pattern the repo
  uses for `gaMeasurementId`.
- Not proposed now: a `contact` feature in `services/general` behind
  `/api/v1/contact`. It is the repo's native route for forms, but it needs
  server code, mail credentials and compose changes, which the brief rules
  out. The form can point at it later by changing only the endpoint value.

### D5. Fonts

- **JetBrains Mono** (terminal, code, micro-labels, nav): variable weight
  file, Latin subset.
- **Display: Chakra Petch** (600 and 700) for `h1`–`h3`. It fits the
  industrial/control-room direction best (squared, chamfered shapes).
  Alternatives: **Space Grotesk** (variable, one file, more neutral, could
  also carry body text) or **Rajdhani** (condensed, weakest at small sizes).
- **Body text:** system sans stack (the repo's existing `--font` convention),
  zero bytes, best readability for case-study prose.
- Files: woff2 in `static/fonts/` with the OFL licence texts, downloaded once
  from the official sources and subset locally with `pyftsubset`
  (Latin + Latin-1, which covers "Martín" and "·"). `font-display: swap`,
  preload only the two files used above the fold, metric-adjusted fallback
  faces to limit layout shift. Budget: 100 KB total.
- Decorative glyphs (box drawing, arrows) are avoided in copy or drawn with
  CSS, so a missing glyph never falls back to another font inside the terminal.

### D6. SEO files

- `<title>`, description, canonical, Open Graph and Twitter tags and the
  Person JSON-LD (`name: "Martín Cabrera"`, `alternateName: "n0icht"`) come
  from `content/site.js` through `Seo.svelte`.
- Canonical and OG URLs must be absolute and QA shares the production build,
  so the production origin is a content value (`site.url`), `TODO(content)`
  until the domain exists.
- `static/sitemap.xml` (one URL) and `static/robots.txt` are added in M5 only
  if the domain is known by then. No `+server.js` endpoint.
- OG image: 1200×630 PNG rasterised from the provided SVG with `rsvg-convert`
  and composed with `magick` (logo on the dark background). The identity text
  stays in `og:title` as text, not in the image.

### D8. Logo usage

- Moved to `clients/n0icht/static/brand/logo-b-glyph-mark.svg` unchanged.
- Favicon: `<link rel="icon">` points at that file; no second copy.
- Always rendered as `<img>` of the provided file (nav, boot indicator, footer
  seal). The nav shows "Martín Cabrera · n0icht" as HTML text beside it, and
  the `<img>` gets `alt=""` there to avoid a double announcement.
- Motif elements (loaders, hover grids, status dots, cursor) are generic
  square cells in CSS. They never re-create the logo's pattern.
- Stripping the C2PA `<metadata>` block would cut the file from 8.8 KB to
  under 1 KB but changes the provided file, so it is not done unless approved.

## 6. Caddy, Docker, CI, DNS

**None needed** for M1–M5. A new static site is covered by the existing
wildcard QA block, the `estatico` snippet and `deploy.yml`.

Not part of these milestones, listed so nothing is a surprise:

1. **Going to production** (owner's decision, standard documented path): set
   `clients/n0icht/site.json` to `{ "domain": "<domain>" }` and add
   `infra/sites/<domain>.caddy`:

   ```
   <domain> {
   	import estatico <domain>
   }

   www.<domain> {
   	redir https://<domain>{uri} permanent
   }
   ```

   plus DNS (`@` and `www` CNAME to the origin), then **Promover a producción**.

2. **Optional, not required:** long-lived caching for hashed assets. Today
   `file_server` sends only `ETag`/`Last-Modified`, so repeat visits
   revalidate every file. It does not affect the Lighthouse Performance score
   directly. It changes the shared snippet for every site on both servers, so
   it is only proposed, to be decided after measuring in M5:

   ```diff
    (estatico) {
    	encode gzip
   +	# Los archivos de /_app/immutable/ llevan hash en el nombre: se cachean para siempre
   +	@inmutable path /_app/immutable/*
   +	header @inmutable Cache-Control "public, max-age=31536000, immutable"
    	handle_path /api/* {
   ```

3. **Known limitation left as is:** unknown URLs get Caddy's bare 404 (no
   custom page). Fixing it needs `handle_errors` in the snippet.

## 7. Risks and conflicts

| # | Risk | Mitigation |
| - | ---- | ---------- |
| R1 | **Svelte 4 syntax under Svelte 5.** One rune in a file silently switches that component to runes mode. Svelte 5 is also stricter: invalid HTML nesting (`<div>` in `<p>`, `<button>` in `<button>`) fails compilation or hydration; `new Component({ target })` no longer exists. | Runes guard in the gate (D2). No imperative component instantiation; lazy components via `{#await import(…)}` + `<svelte:component>`. `svelte.config.js` stays identical to the template (no global `runes` option). |
| R2 | **SSR/prerender with Three.js.** A static `import "three"` reachable from a route is evaluated during prerender and lands in the entry bundle; `window`, `matchMedia`, `localStorage` at module top level crash the build. | `three` is imported only inside `src/lib/three/`, and that folder is reached only through `await import()` in `onMount`. `graph.js` (pure data) is the one file there that does not import `three`, so the SVG fallback can be prerendered. Browser APIs only in `onMount`. No random or time-dependent markup, to avoid hydration mismatches. |
| R3 | **Bundle size.** `three` is large; estimate 120–180 KB gzip for a tree-shaken WebGL scene (not measured yet; Caddy serves gzip only). | Named imports from `"three"` only, no `examples/jsm` addons, no post-processing (glow via additive sprites/lines), `InstancedMesh` for nodes and packets, `LineSegments` for edges. Loaded after first paint on idle. Verified after build: no `three` code in the chunks listed as `modulepreload` in `build/index.html`. Playground and palette are lazy too. Budget for the initial JS of `/`: 60 KB gzip. |
| R4 | **LCP/CLS from the hero.** A typed boot sequence can delay the LCP text or shift layout. | `h1`, tagline and CTAs are static prerendered HTML outside the terminal; the terminal has a reserved height; the boot animation only replays inside it after hydration; with reduced motion it renders its final state at once. |
| R5 | **Style collisions.** The template's `:root` uses `--bg`, `--ink`, `--muted`, `--accent`, `--font`, and `.site-*` rules read them. The kit's `fx.css` defines only `.fx-reveal` and no variables. Each site has its own CSS, so nothing leaks between sites. | `tokens.css` replaces the template's `:root` block completely with namespaced tokens (`--c-bg`, `--c-panel`, `--c-border`, `--c-amber`, `--c-green`, `--c-cyan`, `--c-text`, `--c-muted`) and the `.site-*` rules are rewritten against them. The scene reads colors from the same variables (`getComputedStyle`), nothing hardcoded in JS. |
| R6 | **Contrast.** Measured: text 16.5:1, muted 6.6:1, amber 6.8:1, green 14.7:1, cyan 12.4:1 on `#0B0D10` (all pass AA, also on panels). Fails: white on amber (2.9:1) and the border `#232A33` (1.3:1) as the only boundary of an interactive control (WCAG 1.4.11 needs 3:1). | Buttons use dark text on amber (6.8:1). Add `--c-border-strong: #5B6A7A` (3.5:1 on background, 3.3:1 on panels) for inputs, toggles and other control outlines; `#232A33` stays for decorative panel borders. Focus rings in amber or green. |
| R7 | **Readability vs. atmosphere.** A moving graph behind text, scanlines and noise can hurt legibility and mobile performance. | Content sits on opaque panels; scene intensity is a CSS knob; DPR cap, fewer nodes and no hover picking on touch; render loop pauses when the tab is hidden; `prefers-reduced-motion` gives a static frame; WebGL failure or context loss leaves the static SVG graph. |
| R8 | **Toolchain drift.** Local Node 26.8.1 / npm 12 vs. CI Node 22 / its bundled npm. A lockfile written locally could behave differently under `npm ci` in CI. | Keep lockfile v3; inspect the lock diff after each install; first push to QA is the real check. Installing Node 22 locally (owner's machine) removes the risk. |
| R9 | **Verification tooling.** No Chrome/Chromium locally, so Lighthouse cannot run here; QA domains are still placeholders. | Responsive checks with headless Firefox screenshots at 360/768/1280 and the browser preview. Lighthouse in M5 needs Chromium installed or the owner running it; flagged again at M5. |
| R10 | **Brief vs. repo paths.** The brief assumes `static/brand/…`, `src/lib/…` at a repo root and `docs/` at the top level. | Mapped to `clients/n0icht/…` and `Sitios/docs/…` throughout this plan. |
| R11 | **Unknown content.** Email, social links, domain, real projects and experience are not in the repo. | Realistic placeholders marked `TODO(content)`, listed in each Progress entry. `content/validate.js` plus tests keep the shape honest. |
| R12 | **Interim dead anchors.** In M1 the hero CTAs point at `#projects` and `#contact`, which arrive in M3. | Nav lists only sections that exist; the two CTAs are a known M1 limitation, noted in its Progress entry. |

## 8. Milestones

Every milestone ends with the gate in D2, a commit on `feat/brand-site`, a
Progress entry here, a summary, and a stop for review. All paths below are
under `clients/n0icht/` unless noted.

### M1. Foundation (no 3D)

Tokens, fonts, layout, nav, logo/favicon, hero and terminal.

- Baseline: `npm ci`, `npm run build -w biblioteca`.
- Create the site from the template; then:
  - New/changed: `package.json` (name, `check`/`test` scripts, dev deps),
    `README.md`, `.env.example`, `site.json`, `src/app.html`,
    `src/routes/+layout.svelte`, `src/routes/+page.svelte`.
  - Unchanged from the template: `src/routes/+layout.js`, `svelte.config.js`,
    `vite.config.js`, `jsconfig.json`.
  - Removed from the copy: `src/lib/data/site.js`, `static/favicon.svg`.
- `static/brand/logo-b-glyph-mark.svg` (moved from `Sitios/`),
  `static/fonts/*.woff2` + licences.
- `src/lib/css/tokens.css`, `site.css`, `terminal.css`.
- `src/lib/content/types.js`, `site.js`, `terminal.js`, minimal `projects.js`,
  `stack.js`, `contact.js` (what the terminal commands print), `validate.js`.
- `src/lib/terminal/parser.js`, `commands.js`, `session.js`, `boot.js`.
- `src/lib/stores/ui.js`.
- `src/lib/Components/Panel.svelte`, `StatusDot.svelte`, `PixelLoader.svelte`,
  `Hero.svelte`, `Terminal.svelte`.
- Tests: `terminal/parser.test.js`, `terminal/commands.test.js`,
  `content/validate.test.js`.
- Outside the site: `package-lock.json`.

### M2. 3D background

- Dependency: `three` (if not already added in M1).
- `src/lib/three/graph.js` (nodes, edges, six stage waypoints; pure data),
  `index.js` (`createScene(canvas, options)` returning `setProgress`,
  `setStage`, `setPointer`, `pulseAt`, `resize`, `dispose`), `nodes.js`,
  `edges.js`, `packets.js`, `camera.js`, `pulse.js`, `theme.js`.
- `src/lib/Components/SystemGraph.svelte`: fixed `aria-hidden` canvas, static
  SVG fallback from `graph.js`, capability checks, lazy import, scroll
  progress from `main > section`, pointer parallax, hover glow, click pulse,
  visibility pause, context-loss fallback, reduced motion.
- `src/lib/stores/scene.js`.
- Edits: `src/routes/+layout.svelte` (mount the background),
  `src/lib/css/site.css` (background layer, blueprint grid, scene knobs),
  `src/lib/terminal/commands.js` (`deploy --prod` triggers a pulse).
- Tests: `three/graph.test.js` (edges reference existing nodes, six stages).
- Bundle guard added to the gate.

### M3. Content sections

Pipeline, projects, stack, experience, contact, writing flag, command palette.

- `src/lib/content/pipeline.js`, `projects.js` (full shape), `stack.js`,
  `experience.js`, `writing.js`, `contact.js`; `site.js` gains
  `features.writing` and the full nav.
- `src/lib/Components/Pipeline.svelte` (scroll-driven, writes the active stage
  to `stores/scene.js`), `Projects.svelte`, `ProjectCase.svelte`,
  `ArchDiagram.svelte` (SVG from project data), `StackPanel.svelte`,
  `Gauge.svelte`, `Experience.svelte`, `Writing.svelte`, `Contact.svelte`,
  `CommandPalette.svelte` (native `<dialog>`, lazy on first Cmd/Ctrl+K).
- Edits: `src/routes/+page.svelte`, `src/routes/+layout.svelte` (palette, nav),
  `src/lib/css/site.css`, `terminal.css`, `src/lib/terminal/commands.js`,
  `src/lib/content/validate.js`, `.env.example` (`PUBLIC_CONTACT_ENDPOINT`).
- Tests: extended `content/validate.test.js`, `terminal/commands.test.js`.
- The palette is not named in any milestone of the brief; it is placed here
  because it navigates to these sections. It can move to M1 or M5 on request.

### M4. System Design Playground

- `src/lib/playground/model.js` (topology, toggles, inputs), `simulate.js`
  (latency percentiles, throughput, error rate, saturation and failure
  behavior; deterministic), `prng.js` (seeded).
- `src/lib/content/playground.js` (labels, presets, explanations).
- `src/lib/Components/Playground.svelte` (lazy, loaded near the viewport),
  `PlaygroundDiagram.svelte` (SVG/DOM, not WebGL), `PlaygroundControls.svelte`
  (real buttons and switches), `PlaygroundMetrics.svelte` (throttled
  `aria-live`).
- `src/lib/css/playground.css`.
- Edits: `src/routes/+page.svelte`, `src/lib/terminal/commands.js` (optional
  `playground` command).
- Tests: `playground/simulate.test.js` (cache lowers read latency, load
  balancer raises capacity, queue trades errors for latency under overload,
  replica offloads reads, failure cases).

### M5. Polish

SEO, accessibility, performance, responsive, final docs.

- `src/lib/Components/Seo.svelte` (meta, OG, Person JSON-LD),
  `static/brand/og.png`, `static/brand/apple-touch-icon.png`; `static/robots.txt`
  and `static/sitemap.xml` if the domain is known.
- Accessibility pass (keyboard paths for terminal and palette, focus order,
  `aria-live`, contrast re-check), reduced-motion pass, WebGL-off pass.
- Performance pass (bundle sizes, font preloads, lazy boundaries, Lighthouse
  mobile ≥ 90; see R9). Responsive pass at 360, 768, 1280+.
- Edits across `src/lib/css/*.css`, `src/app.html`, components as needed.
- Docs: `clients/n0icht/README.md` (Spanish, like `biblioteca`'s). Proposed
  one-line additions, only if approved: the site list in `README.md`,
  `docs/arquitectura.md` and `CLAUDE.md`.
- Decide the optional Caddy cache header (section 6).

## Progress

### M1. Foundation (2026-11-18)

Built in `clients/n0icht/` (new site from `templates/site-static/`, D1 as recommended):

- Tokens (`css/tokens.css`), global styles and primitives (`css/site.css`), terminal and palette
  (`css/terminal.css`). CSS-only background (blueprint grid, inline-SVG noise, scanlines) in
  `.n0-bg`, which is also where the M2 canvas goes.
- Fonts: JetBrains Mono (variable 400–700) and Chakra Petch 600/700, Latin subset, 29 KB in total,
  with their OFL texts. Two preloads (the tagline face and the mono face).
- Primitives: `Panel`, `SectionHeader`, `Button`, `Tag`, `StatusDot`, `Container`.
- Sticky nav with logo + identity text, section links, and the command palette (Cmd/Ctrl+K or the
  header button; native modal `<dialog>`, combobox + listbox, lazy-loaded on first open). Below
  62rem the links collapse into that button.
- Favicon (provided SVG + 32px PNG + 180px touch icon), `theme-color`, meta/OG and Person JSON-LD
  (`Seo.svelte`, `content/seo.js`).
- Hero with static name, role, tagline and CTAs, plus the terminal: CSS-typed boot (skippable,
  instant under reduced motion), `help`, `whoami`, `ls projects`, `cat stack`, `contact`,
  `deploy --prod`, `clear`, unknown-command hint with "did you mean", Up/Down history, suggested
  commands as buttons for touch.
- Tests: 72 with `node --test` (parser, commands, session/history, boot timing, palette, content
  validation, JSON-LD).

Decisions and deviations from this plan:

- **TypeScript in `src/lib/terminal/`** (`.ts`, tests `.test.ts`), because the M1 prompt asked for
  the parser "as pure TypeScript"; section 1.3 and D2 had proposed JS + JSDoc. Node 22 strips the
  types natively, so tests still need no runner. Consequences: `jsconfig.json` gained
  `allowImportingTsExtensions`, and `@types/node` 22.20.5 was added (dev) so the test files
  type-check. Content stays JS + JSDoc with `// @ts-check`. Components stay plain `<script>`.
- Dev dependencies added, exact: `svelte-check` 4.7.8, `typescript` 6.0.3, `@types/node` 22.20.5.
  `three` and `@types/three` are **not** installed yet (out of scope for M1), so the lockfile
  changes once more in M2. The lock diff only adds entries.
- Moved forward from later milestones because the M1 prompt lists them: command palette (was M3),
  `Seo.svelte` and the touch icon (were M5). The OG image, sitemap and robots stay in M5.
- The boot sequence is a CSS animation driven by timings from `terminal/boot.ts`, not JS typing:
  the prerendered HTML already has every line, so nothing changes at hydration (R4).
- R12 was handled differently: instead of dead anchors, `pendingSections` in `content/site.js`
  renders one placeholder panel per unbuilt section (they also exercise the primitives). Each
  milestone removes its section from that list.
- Not built: `PixelLoader` (nothing loads yet). Added beyond the list in section 8: `Button`,
  `Tag`, `SectionHeader`, `Container`, `terminal/palette.ts`, `content/index.js`, `content/seo.js`.
- `deploy --prod` returns a `pulse` effect; in M1 the terminal panel flashes green. M2 routes it to
  the scene.
- `app.html` has a `<noscript>` rule so `.fx-reveal` content is visible without JavaScript.
- Node 22.23.5 is now available locally (nvm) and was used for install, tests and builds (R8).

Gate: `npm run check` (0 errors, 0 warnings), `npm test` (72 pass), `npm run build -w n0icht` and
`-w biblioteca`, runes guard clean. No lint or format step exists in the repo (D2), so none ran.
Initial JS for `/` is 50.8 KB gzip (budget 60), CSS 4.4 KB.

Browser checks (headless Firefox 153 driven over WebDriver BiDi, at 1280, 768, 360 and 320px, with
a touch profile and a reduced-motion profile): Tab order, terminal commands and history, palette
open/filter/arrows/Enter/Esc, focus trap and focus return, no horizontal scroll, no request to
another origin, no console errors. Not covered: activating a `<button>` with Enter/Space could not
be simulated by that harness (the checks use `click()` on the focused button), no screen reader
pass, no Chromium/Safari, no Lighthouse (R9).

Open `TODO(content)`:

- `content/contact.js`: real email; real GitHub and LinkedIn URLs (flagged `todo: true`, so they
  are left out of the JSON-LD `sameAs`).
- `content/projects.js`: the three projects are placeholders.
- `content/site.js`: `site.url` (production origin; enables canonical and `og:url`).

Known limitations:

- Without JavaScript the terminal input is disabled and, below 62rem, there is no menu.
- On small screens the terminal input is 16px (avoids iOS zoom) next to a 12px prompt.

### M2. 3D background (2026-11-19)

Done, in `clients/n0icht/`:

- `src/lib/three/`: `stages.ts` (the six stages), `camera.ts` (scroll-to-camera mapping, cluster
  selection and weights, Catmull-Rom pose over per-stage waypoints), `graph.ts` (seeded graph: six
  clusters of service/DB/queue/cache nodes, edges, adjacency), `pulse.ts` (BFS hops, nearest node
  in screen space, pulse brightness, cascade progress), `quality.ts` (low/high tiers, adaptive
  levels, effective DPR, software-renderer detection). All pure, each with a `.test.ts`.
  `scene.ts` is the only renderer file: type-only imports of `three` at module level, runtime
  symbols through `loadThree()` (`await import("three")`).
- Scene: one `InstancedMesh` per node kind (box, cylinder, hex disc, octahedron), `LineSegments`
  edges, `Points` for halos and packets, blueprint grid floor with corner brackets, fog. Colours
  are read from the CSS tokens. 9 draw calls; 60 nodes on the high tier, 36 on the low tier.
- `Components/Background3D.svelte`: fixed `aria-hidden` canvas with `pointer-events: none` inside
  the existing `.n0-bg` layer, whose CSS grid is the fallback. Start-up is `load` -> first paint ->
  idle -> WebGL2 context -> dynamic import -> `compileAsync`, each step in its own task.
- `stores/scene.js`: `stageAnchor` Svelte action (one shared `IntersectionObserver` on the middle
  line of the viewport plus a `ResizeObserver`; no scroll listener), `activeStage`, `sceneStatus`,
  `pulseRequests`. The scene reads the position once per frame inside its `requestAnimationFrame`.
- Pointer: parallax, hover glow (fine pointers only), click on empty background pulses from the
  nearest node with a packet cascade. `deploy --prod` pulses the deploy cluster.
- Performance: DPR capped at 2 (1.5 on the low tier), typed arrays and scratch objects reused
  (no per-frame allocations), loop stopped when the tab is hidden or the canvas is off-screen,
  adaptive quality steps down on slow frames, no post-processing on any tier, `dispose()` frees
  geometries, materials, textures, renderer and every listener/observer.
- Fallbacks: no WebGL2, software rendering (SwiftShader, llvmpipe), `Save-Data`, a failed import or
  a lost context all leave the CSS background and never download or keep `three`.
  `prefers-reduced-motion` renders a single still frame, redrawn only on stage change; clicks do
  not pulse.
- Debug: `?debug3d` shows a HUD (fps, cluster, quality, DPR, nodes, draw calls);
  `?debug3d=low|high` forces the tier. Off by default.
- Temporary: the `pendingSections` placeholders carry `use:stageAnchor={index}` so scroll sync can
  be tested. M3 moves the anchors to the real pipeline steps.

Decisions and deviations from this plan:

- File layout differs from section 8: TypeScript modules (as the M2 prompt asked) named above
  instead of `nodes.js`/`edges.js`/`packets.js`/`theme.js`; the component is `Background3D.svelte`,
  not `SystemGraph.svelte`; the fallback is the CSS grid, not a static SVG.
- The pulse is routed in `Terminal.svelte` through `requestPulse()` (the `pulse` effect already
  existed), so `terminal/commands.ts` did not change.
- Dependencies, exact: `three` 0.187.0, `@types/three` 0.187.0 (dev). The lock diff only adds
  entries; `biblioteca` still builds.
- Software renderers get the CSS fallback on purpose: a CPU-rendered scene costs more than it gives.

Gate: `npm run check` (0 errors, 0 warnings), `npm test` (158 pass, 37 suites),
`npm run build -w n0icht` and `-w biblioteca`, runes guard clean, no top-level runtime import of
`three`. No lint or format step exists in the repo (D2), so none ran. Initial JS for `/` is
54.7 KB gzip (budget 60); `three` and the scene are lazy chunks and `WebGLRenderer` appears only
there.

Measurements (Chrome for Testing 158 headless, production build under `vite preview`):

| Lighthouse mobile (median of runs) | Perf | FCP | LCP | TBT | CLS | SI | TTI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M1 baseline | 100 | - | - | - | - | - | - |
| M2, software GL (CSS fallback path, `three` never loads) | 99 | 762 ms | 762 ms | 143 ms | 0 | 1031 ms | 1805 ms |
| M2, hardware GL (Intel Iris Xe via ANGLE, scene live) | **77** | 762 ms | 762 ms | **1072 ms** | 0 | 2042 ms | 3384 ms |

- LCP is not blocked: 762 ms in both profiles, the same as FCP; the scene starts after it.
- Frame rate with the scene live: desktop 1280x800 60 fps (p99 16.8 ms, no long tasks, high tier,
  60 nodes); phone profile 360px with touch 59.8-60 fps (p99 16.8 ms, one frame over 20 ms, no
  long tasks, low tier, 36 nodes, DPR 1.5).
- Browser checks passed: live desktop and mobile, stage sync on all six anchors, hover, click
  pulse and cascade, `deploy --prod` pulse, off-screen and hidden-tab pause, reduced motion (one
  frame, no loop), no WebGL (CSS fallback, no `three` request), context loss, UI clickable above
  the canvas, no console or network errors.

Known limitations:

- **Lighthouse with the scene live is 77, below the 90 target.** The whole gap is TBT: under
  Lighthouse's 4x CPU throttle, parsing `three` and compiling shaders (synchronous waits on the GPU
  process) make long tasks after first paint. Unthrottled, the longest scene task is 86 ms.
  Start-up was already split into separate tasks and the context creation cut from ~508 ms to
  ~12 ms. Lighthouse also warned that the test machine is slower than its throttling model
  assumes. What is left to try: a smaller hand-picked `three` build, fewer shader programs, or
  starting the scene on first interaction. Deferring the start past the TTI window would raise the
  score without helping a real user, so it was not done.
- Measured on one laptop GPU in headless Chrome with a phone viewport and CPU throttle; no real
  phone, no Safari or Firefox pass for the scene.
- Screenshots in headless mode show the scene at `--scene-intensity: 0.8`; the final look
  (contrast behind text, cluster colours) needs an eye on a real screen.

Open `TODO(content)`: unchanged from M1.
