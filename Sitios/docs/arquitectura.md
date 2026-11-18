# Arquitectura

Dos servidores Ubuntu en Hetzner, uno de QA y otro de producción. En cada uno hay un Docker Compose con un Caddy, muchos sitios estáticos y un servicio Node compartido para features generales. La idea es tener muchos sitios por máquina (decenas), con HTTPS automático y sin un proceso de Node por cada landing.

## Carpetas

```
.github/workflows/
  deploy.yml              # push a main → publica en QA lo que cambió
  promote.yml             # manual: copia un sitio de QA a producción (o vuelve atrás)
Sitios/
  clients/
    biblioteca/           # sitio de ejemplo, estático (adapter-static)
  packages/
    kit/                  # @sitios/kit: piezas compartidas (se importan)
  services/
    general/              # API compartida (Node sin framework)
  templates/
    site-static/          # esqueleto para sitios nuevos (adapter-static + kit)
  scripts/
    new-site.ps1          # copia el template a clients/<slug>
  infra/
    compose.yml           # caddy + general (+ sitios con proceso, si hubiera)
    Caddyfile             # on_demand_tls de QA + snippet `estatico` + import de sites/*.caddy
    promote.sh            # publica en producción lo que vino de QA (lo corre promote.yml)
    sites/
      qa.example.com.caddy  # QA: *.qa.example.com
                            # producción: un archivo por dominio (<dominio>.caddy)
  docs/
    arquitectura.md       # este archivo
    local.md              # trabajar en tu máquina
    github-actions.md     # los workflows, paso a paso
    hetzner.md            # los servidores: instalación, QA, producción, DNS
    primeros-pasos.md     # de cero a correr un sitio en tu máquina
    servidores-desde-cero.md  # QA y producción por primera vez, en orden
    glosario.md           # los términos de los docs
```

`Sitios/` es un monorepo de npm (workspaces): un solo `npm install` en `Sitios/` instala todos los sitios, el kit y `general`. Cómo correrlo está en `local.md`.

## Un sitio es una app completa

Cada carpeta en `clients/<nombre>/` es una app SvelteKit con su `package.json`, su CSS, sus fuentes y sus componentes. El stack es Svelte 5 / SvelteKit 2.70 / Vite 5.4 (las versiones exactas están en el `package-lock.json`), con la sintaxis de Svelte 4: `export let`, `$:`, `on:click` y `<slot />`. Svelte 5 la sigue aceptando: un componente que no usa *runes* (`$state`, `$props`…) corre en modo compatible. El template de sitio nuevo declara las mismas versiones que `biblioteca`, así todos los sitios comparten una sola instalación.

Por convención, el contenido del sitio (marca, menú, textos, links) vive en `src/lib/data/site.js`, y las páginas lo leen de ahí. Así, cambiar un texto no obliga a tocar el markup.

Los sitios usan `adapter-static`: el build es una carpeta de HTML, CSS, JS e imágenes. En el servidor no corre nada por sitio: Caddy sirve esos archivos.

## `@sitios/kit`

Paquete workspace (`packages/kit`). Los sitios lo declaran como dependencia (`"@sitios/kit": "*"`) y lo importan:

```svelte
<script>
  import Analytics from "@sitios/kit/Analytics.svelte";
  import Calendly from "@sitios/kit/Calendly.svelte";
  import { reveal } from "@sitios/kit/motion/reveal.js";
  import { general } from "@sitios/kit/api/client.js";
  import { isQa } from "@sitios/kit/host.js";
  import "@sitios/kit/fx.css";
</script>

<section class="fx-reveal" use:reveal>…</section>
```

Exports: `Analytics.svelte`, `Calendly.svelte`, `api/client.js`, `host.js`, `motion/reveal.js` y `fx.css` (prefijo `.fx-reveal`). El reveal respeta `prefers-reduced-motion` y, si no hay IntersectionObserver, deja todo visible.

Como el kit se importa (no se copia), un cambio en `packages/kit` llega a todos los sitios en su próximo build. Por eso el CI vuelve a buildear todos los sitios que dependen de `@sitios/*` cuando cambia algo en `packages/`.

### QA o producción (`host.js`)

QA y producción reciben el mismo build (ver "Pipeline de deploy"). Lo que tiene que ser distinto se decide en el navegador: `isQa()` da `true` en `*.qa.example.com`. En el prerender no hay `location` y da `false`, así que se llama en `onMount`. Lo usa Analytics para no correr en QA, y sirve para mostrar herramientas de revisión que solo aparecen ahí.

### Calendly (plan free)

Embed client-side. El plan free permite un solo tipo de evento activo. No usa `general`.

```svelte
<Calendly url="https://calendly.com/usuario/evento" mode="inline" hideDetails />
```

`mode`: `inline` | `popup` | `link`.

### Google Analytics (GA4)

Un Measurement ID (`G-...`) por sitio. Por defecto no corre en `npm run dev`, y en QA nunca, así esas visitas no se cuentan en las estadísticas del sitio. Para probarlo: `PUBLIC_GA_MEASUREMENT_ID` + `PUBLIC_GA_ENABLE_IN_DEV=true` (ver `local.md`).

Los sitios estáticos no pueden leer `$env/dynamic/*` en el prerender, así que el layout usa `$env/static/public`: el valor queda fijo en el build.

## Sitio nuevo (estático)

1. Desde `Sitios/`: `.\scripts\new-site.ps1 -Slug mi-marca -Brand "Mi Marca"`, o copiá `templates/site-static/` a mano.
2. Editá los datos y el CSS.
3. Push a `main`: el CI lo publica en `mi-marca.qa.example.com` (QA). No hace falta tocar DNS ni Caddy: el registro `*.qa` y el bloque de QA ya cubren cualquier subdominio.
4. Producción: `site.json` con `{ "domain": "example.com" }`, `infra/sites/<dominio>.caddy` (`import estatico <dominio>` + redirect de `www`) y el DNS del dominio: `@` y `www` como CNAME al origen (`web.example.net`), nunca a la IP. Después, cada vez que QA quede aprobado: Actions → **Promover a producción**. Paso a paso en `hetzner.md`.

## Servicio general

Un solo contenedor (`general`) concentra las features que varios sitios pueden necesitar: formularios de contacto por mail, webhooks, proxies a APIs de terceros, etc. Los sitios **no** duplican esa lógica en un Node propio.

Flujo:

```
navegador (sitio)  →  /api/v1/<feature>  →  Caddy  →  general:3100  →  destino
```

```js
import { general } from "@sitios/kit/api/client.js";
await general("health");                       // GET  /api/v1/health
await general("contacto", { email, mensaje }); // POST /api/v1/contacto (si existiera)
```

Hoy trae un solo feature, `health`, que sirve para comprobar que responde. Un feature nuevo es un archivo en `services/general/src/features/` y una línea en `features/index.js`. Un proxy a terceros va acá aunque hoy lo use un solo sitio. Un contenedor propio solo se justifica con lógica que no tiene sentido fuera de ese sitio.

En local no hay Caddy: `npm run dev -w general` y un proxy `/api` → `http://localhost:3100` en el `vite.config.js` del sitio (ver `local.md`).

### Caddy por dominio

El snippet `estatico` del `Caddyfile` trae, antes del `file_server`:

```
handle_path /api/* {
	reverse_proxy general:3100
}
```

Así el sitio puede seguir siendo estático (`adapter-static`) y llamar a `/api/...` en su mismo dominio, en QA y en producción, sin CORS. Un sitio con proceso propio lo pone en su bloque, antes del `reverse_proxy` del sitio.

## Pipeline de deploy

Hay dos workflows de GitHub Actions. El detalle, paso por paso, está en `github-actions.md`.

- **Deploy** (`deploy.yml`, con cada push a `main`): detecta qué cambió y publica solo eso. Un sitio estático se buildea en el runner y se sube a `www/<sitio>.qa.example.com/` del servidor de QA. Si cambió `general`, arma su imagen Docker y la carga en los dos servidores. Si cambió `infra/`, sube `compose.yml`, el `Caddyfile` y los bloques de `sites/`. **Producción nunca cambia con un push.**
- **Promover a producción** (`promote.yml`, manual): baja el build de `www/<sitio>.qa.example.com/` del servidor de QA y lo publica en `www/<dominio>/` del de producción, sin volver a buildear. Guarda la versión anterior para poder `volver`.

Así producción recibe exactamente los archivos que se revisaron en QA.

## Servidores

Son dos, QA y producción. Cómo se arman, cómo se entra y qué revisar está en `hetzner.md`.

En los servidores no hay fuentes ni Node. Están el build de cada sitio, las imágenes Docker y Caddy:

```
/opt/web/
  compose.yml
  Caddyfile          # copia de Sitios/infra/Caddyfile
  sites/             # bloques de Caddy, uno por dominio
  www/               # builds de los sitios, uno por host
  data/              # certificados y estado de Caddy (no se borra)
```

## Cuando un sitio necesita servidor

La mayoría queda estática (`adapter-static`) y, si necesita una API compartida, Caddy le manda `/api/*` a `general`. Si un sitio tiene un endpoint **propio** (lógica que solo tiene sentido para ese sitio), corre en su propio contenedor y Caddy le hace de proxy. Para eso hace falta un `Dockerfile` en el sitio (con `Sitios/` como contexto de build) y un servicio en `compose.yml`. El resto sigue siendo archivos.
