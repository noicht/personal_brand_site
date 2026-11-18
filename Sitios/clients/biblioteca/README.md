# biblioteca

Sitio de ejemplo: la página de una biblioteca de barrio inventada ("Biblioteca del Ombú"). Es estático (`adapter-static`) y usa `@sitios/kit`, como cualquier sitio del proyecto. Sirve para ver todo el recorrido, desde `npm run dev` hasta QA y producción.

```bash
# desde Sitios/
npm run dev -w biblioteca        # http://localhost:5173
npm run build -w biblioteca      # deja el sitio en clients/biblioteca/build/
npm run preview -w biblioteca    # sirve ese build
```

## Dónde está cada cosa

| Archivo | Qué hace |
| ------- | -------- |
| `src/lib/data/site.js` | Todo el contenido: marca, menú, textos, salas, links y contacto. Para cambiar un texto se toca acá, no en los `.svelte`. |
| `src/routes/+layout.svelte` | Lo que se repite en todas las páginas: fondo, puerta, header, footer y Analytics. |
| `src/routes/+page.svelte` | La página: una `<section>` por bloque, armada con los datos de `site.js`. |
| `src/routes/+layout.js` | `prerender = true`: en el build cada página sale como HTML. |
| `src/lib/css/site.css` | Todo el estilo. Los colores están en `:root` (`--navy`, `--accent`, `--ink`). |
| `src/lib/Components/` | Las tres piezas propias de este sitio (abajo). |
| `static/` | Archivos que se sirven tal cual: foto del salón, sus mapas, logo y favicon. |
| `site.json` | `domain` de producción. Vacío: el sitio solo existe en QA. |
| `.env.example` | Variables para probar Google Analytics en local (ver `docs/local.md`). |

## Las piezas propias

- **`LivingLibrary.svelte`**: el fondo. Es una foto del salón animada en WebGL con `biblioteca-mapas.png`, una imagen del mismo tamaño que guarda en cada canal de color una máscara: R = profundidad, G = plantas, B = lámparas. Con eso hace parallax al scrollear y mover el mouse, balancea las lámparas y mueve las plantas. La cámara recorre el salón: cada `<section>` de la página es un tramo. Sin WebGL queda la foto fija.
- **`Puerta.svelte`**: la entrada. La primera vez en la sesión el sitio arranca frente a una puerta cerrada, y al tocarla se abre y se entra. Se configura con `door` en `site.js` (`door = null` la saca).
- **`FondoRegulador.svelte`**: un panel para ajustar el fondo en vivo (transparencia, calma, contraste). Una vez elegidos, los valores se copian a `.bib` en `site.css`.

## Parámetros en la URL

| URL | Qué hace |
| --- | -------- |
| `/?puerta` | Muestra la puerta aunque ya hayas entrado en esta sesión. |
| `/?regulador` | Abre el panel del fondo. |
| `/?fondo` | Muestra en qué tramo del recorrido está la cámara. |

## Para practicar

1. Cambiá la marca y los textos en `site.js` y mirá cómo se actualiza el sitio con `npm run dev`.
2. Cambiá `--accent` en `site.css`.
3. Agregá una sección nueva: los datos en `site.js`, la `<section>` en `+page.svelte` y el link en `nav`. Fijate cómo cambia el recorrido de la cámara.
4. Sacá la puerta (`door = null`).
