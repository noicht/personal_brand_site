# Local

Cómo trabajar el proyecto en tu máquina. Si es la primera vez, empezá por [`primeros-pasos.md`](primeros-pasos.md): es lo mismo, paso a paso y con qué hacer si algo falla. Los servidores y la publicación están en `hetzner.md` y `github-actions.md`.

## Qué hace falta

- Node 22 (la misma versión que usan el CI y el Dockerfile de `general`)
- npm (viene con Node)
- Git

No hace falta Docker para desarrollar. Docker y Caddy corren en los servidores.

## Primera vez

Desde la carpeta `Sitios` (no desde un sitio):

```bash
npm install
```

Eso instala todo el monorepo: los workspaces de `clients/*`, `services/*` y `packages/*`. Hacer `npm install` adentro de un sitio no es el camino: las dependencias se resuelven desde la raíz, con un solo `package-lock.json`.

## Correr un sitio

Desde `Sitios`:

```bash
npm run dev -w biblioteca
```

Vite arranca el sitio en `http://localhost:5173` y recarga solo cuando guardás un archivo. Para pararlo: Ctrl+C.

`-w biblioteca` elige el workspace. El nombre es el `name` del `package.json` del sitio, que coincide con el de su carpeta.

## Build y preview

Para comprobar el build de producción sin subir nada:

```bash
npm run build -w biblioteca
npm run preview -w biblioteca
```

`build` deja el sitio en `clients/biblioteca/build/`: HTML, CSS, JS e imágenes, listos para servir como archivos. Es lo mismo que sube el CI al servidor. `preview` sirve ese build en local.

## Sitio nuevo

```powershell
.\scripts\new-site.ps1 -Slug mi-marca -Brand "Mi Marca"
npm run dev -w mi-marca
```

El script copia `templates/site-static/` a `clients/mi-marca/`, reemplaza los placeholders y corre `npm install`. Detalle en `templates/site-static/README.md` y en `arquitectura.md`.

Si PowerShell no deja correr el script (`la ejecución de scripts está deshabilitada`), corré una vez `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. En Mac o Linux no hay PowerShell: los pasos a mano están en `templates/site-static/README.md`.

## `@sitios/kit`

Analytics, Calendly, el cliente de `general` (`api/client.js`), `host.js` y `reveal` se importan desde `@sitios/kit` (workspace `packages/kit`). Un cambio en el kit llega a todos los sitios en su próximo build.

## Servicio general

API compartida para features de varios sitios. Desde `Sitios`:

```bash
npm run dev -w general
```

Queda en `http://localhost:3100`. Para probarlo: `http://localhost:3100/v1/health` en el navegador.

En el servidor, Caddy manda `/api/*` del sitio a `general`. En local no hay Caddy. Para que un sitio en `npm run dev` le pegue a `general`, sumá un proxy en su `vite.config.js`:

```js
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  // En dev, /api/* va al general local (npm run dev -w general), como Caddy en el servidor
  server: {
    proxy: {
      "/api": "http://localhost:3100",
    },
  },
});
```

`general` acepta las dos formas de ruta: `/v1/health` (lo que manda Caddy, que le saca el `/api`) y `/api/v1/health` (lo que manda este proxy, que lo deja).

Y en el sitio:

```js
import { general } from "@sitios/kit/api/client.js";
const data = await general("health");
```

El proxy es el camino. `api/client.js` también mira `PUBLIC_GENERAL_URL`, pero ponerla en el `.env` no alcanza: la lee de `import.meta.env`, y Vite solo deja ahí las variables `VITE_*` (SvelteKit expone las `PUBLIC_*` por `$env/static/public`, no por `import.meta.env`). Con el proxy, además, el sitio llama a `/api` igual que en el servidor, sin CORS.

## Probar Google Analytics en local

GA4 no carga en `dev` a menos que lo actives. Una sola vez, con tu cuenta:

1. En [analytics.google.com](https://analytics.google.com) creá una propiedad GA4 y copiá el Measurement ID (`G-...`).
2. En el sitio (ej. `clients/biblioteca/`), copiá `.env.example` a `.env`:

   ```bash
   cp .env.example .env        # en PowerShell: copy .env.example .env
   ```

3. Editá `.env` y poné tu ID. Dejá `PUBLIC_GA_ENABLE_IN_DEV=true`.
4. `npm run dev -w biblioteca`, abrí el sitio y navegá un poco.
5. En GA: **Informes → Tiempo real** (puede tardar unos segundos).
6. Cuando termines, borrá `PUBLIC_GA_ENABLE_IN_DEV` o ponelo en `false` para no seguir mandando visitas de localhost.

El `.env` está en `.gitignore`. Para producción, el ID va en `site.gaMeasurementId` del `data/site.js` del sitio. En QA nunca corre (ver `arquitectura.md`, "QA o producción").

## Qué no se corre en local

- `infra/compose.yml`, el `Caddyfile` y `promote.sh`: son de los servidores. Los usa el CI con un push a `main` o al promover.
