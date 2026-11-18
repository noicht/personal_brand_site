# Template: sitio estático

Esqueleto SvelteKit (`adapter-static`) + `@sitios/kit` (Analytics, reveal). Un CSS, sin Bootstrap ni jQuery. Si es tu primer sitio, la guía paso a paso está en [`docs/primeros-pasos.md`](../../docs/primeros-pasos.md#6-tu-primer-sitio).

## Crear un sitio

Desde `Sitios/`:

```powershell
.\scripts\new-site.ps1 -Slug mi-marca -Brand "Mi Marca"
```

Eso copia este template a `clients/<slug>`, reemplaza los placeholders (`__SLUG__`, `__BRAND__`) y corre `npm install`.

El slug va en minúsculas, números y guiones (`mi-marca`). Es el nombre de la carpeta, el `name` del `package.json` (lo que va en `-w`) y el subdominio de QA.

Si PowerShell no deja correr el script (`la ejecución de scripts está deshabilitada en este sistema`), corré una vez `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

### Sin PowerShell (Mac o Linux)

Lo mismo que hace el script, a mano, desde `Sitios/`:

```bash
cp -r templates/site-static clients/mi-marca
grep -rl -e __SLUG__ -e __BRAND__ clients/mi-marca | xargs perl -pi -e 's/__SLUG__/mi-marca/g; s/__BRAND__/Mi Marca/g'
npm install
```

### Versiones

El `package.json` declara las mismas versiones de Svelte, SvelteKit y Vite que `clients/biblioteca`. Así npm instala una sola copia para todos los sitios, en `Sitios/node_modules`. Si actualizás esas versiones en un sitio, actualizalas también acá.

## Después de crear

1. Editá `src/lib/data/site.js` (textos, links, GA).
2. Editá `src/lib/css/site.css` (colores/tipografía) y reemplazá `static/favicon.svg`.
3. `npm run dev -w <slug>`
4. Push a `main` → QA en `https://<slug>.qa.example.com` (con el dominio de QA que hayas configurado).
5. Producción: poné el dominio en `site.json` → `{ "domain": "example.com" }`, creá `infra/sites/<dominio>.caddy` (`import estatico <dominio>`) y el DNS: `@` y `www` como CNAME a tu origen (ej. `web.example.net`). Cuando QA quede aprobado: Actions → **Promover a producción**. Paso a paso en `docs/hetzner.md` y `docs/github-actions.md`.

El push publica solo en QA, tenga o no dominio. Producción cambia únicamente al promover.

Para probar Google Analytics en local, copiá `.env.example` a `.env` (ver `docs/local.md`).
