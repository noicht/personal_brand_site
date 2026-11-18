# Sitios

Un proyecto para armar sitios web con SvelteKit y publicarlos en servidores propios. Cubre todo el camino:

- **Desarrollo**: cada sitio es una app SvelteKit, dentro de un monorepo de npm, con un kit de piezas compartidas.
- **Publicación**: con cada push a `main`, GitHub Actions publica el sitio en QA. Cuando está aprobado, un workflow manual lo pasa a producción.
- **Servidores**: dos VPS en Hetzner, con Docker, Caddy (HTTPS automático) y una API compartida.

Trae un sitio de ejemplo, `biblioteca`: la página de una biblioteca de barrio inventada, con un fondo animado en WebGL.

## Empezá acá

1. **Hacé tu copia**: arriba a la derecha, **Use this template → Create a new repository**, privada y en tu cuenta. No trabajes sobre este repo.
2. **Correlo en tu máquina**: [`Sitios/docs/primeros-pasos.md`](Sitios/docs/primeros-pasos.md). No hace falta servidor ni dominio.
3. **Publicalo en internet** (cuando tengas servidores y dominio): [`Sitios/docs/servidores-desde-cero.md`](Sitios/docs/servidores-desde-cero.md).

Si ya tenés Git y Node 22, lo mínimo es esto, desde la carpeta `Sitios` de tu copia:

```bash
npm install
npm run dev -w biblioteca
```

Abrí `http://localhost:5173`.

## Qué hay

```
.github/workflows/   deploy.yml y promote.yml: la publicación
Sitios/
  clients/           los sitios (hoy: biblioteca)
  packages/kit/      piezas compartidas: Analytics, Calendly, reveal, cliente de la API
  services/general/  API compartida (Node), detrás de /api/*
  templates/         esqueleto para sitios nuevos
  scripts/           new-site.ps1: crea un sitio desde el template
  infra/             lo que corre en los servidores: compose, Caddy, promote.sh
  docs/              la documentación
```

## Qué leer

Las guías van en orden, de arriba hacia abajo. Las referencias se consultan cuando hace falta.

| Quiero… | Leé | Tipo |
| ------- | --- | ---- |
| Instalar todo y ver el sitio de ejemplo por primera vez | [`primeros-pasos.md`](Sitios/docs/primeros-pasos.md) | Guía |
| Armar QA y producción por primera vez | [`servidores-desde-cero.md`](Sitios/docs/servidores-desde-cero.md) | Guía |
| Entender una palabra de los docs | [`glosario.md`](Sitios/docs/glosario.md) | Referencia |
| Todo lo que se puede hacer en local (Analytics, la API, el kit) | [`local.md`](Sitios/docs/local.md) | Referencia |
| Entender cómo encaja todo | [`arquitectura.md`](Sitios/docs/arquitectura.md) | Referencia |
| Entender qué hacen los workflows de GitHub | [`github-actions.md`](Sitios/docs/github-actions.md) | Referencia |
| Los servidores, el DNS y producción, por tema | [`hetzner.md`](Sitios/docs/hetzner.md) | Referencia |
| Conocer el sitio de ejemplo y practicar con él | [`clients/biblioteca/README.md`](Sitios/clients/biblioteca/README.md) | Referencia |
| Crear un sitio nuevo | [`templates/site-static/README.md`](Sitios/templates/site-static/README.md) | Referencia |

Las IPs y los dominios de los docs y de la config son de ejemplo (`<IP-QA>`, `qa.example.com`, `example.com`…). Para publicar de verdad hacen falta tus propios servidores y dominios: qué reemplazar y dónde está en [`servidores-desde-cero.md`](Sitios/docs/servidores-desde-cero.md).

## Stack

Node 22 · SvelteKit 2 con Svelte 5 (sintaxis de Svelte 4) · Vite 5 · `adapter-static` · Docker Compose · Caddy 2 · GitHub Actions · Hetzner Cloud · Cloudflare DNS.
