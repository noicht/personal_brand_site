# n0icht

Sitio de marca personal de Martín Cabrera · n0icht. Es estático (`adapter-static`) y usa `@sitios/kit`, como cualquier sitio del proyecto. El contenido del sitio está en inglés; los comentarios y esta guía, en español.

El encargo y el plan por hitos están en [`docs/brand-site-brief.md`](../../docs/brand-site-brief.md) y [`docs/brand-site-plan.md`](../../docs/brand-site-plan.md).

```bash
# desde Sitios/
npm run dev -w n0icht        # http://localhost:5173
npm run build -w n0icht      # deja el sitio en clients/n0icht/build/
npm run preview -w n0icht    # sirve ese build
npm run check -w n0icht      # svelte-check: tipos y accesibilidad
npm test -w n0icht           # tests con el runner de Node (node --test)
```

Antes de pushear: `check`, `test` y `build`. El CI solo buildea.

## Dónde está cada cosa

| Archivo | Qué hace |
| ------- | -------- |
| `src/lib/content/` | Todo el contenido: identidad, menú, hero, textos de la terminal y de la paleta, proyectos, stack y contacto. Para cambiar un texto se toca acá, no en los `.svelte`. `types.js` describe la forma y `validate.js` la comprueba en los tests. |
| `src/lib/terminal/` | La lógica de la terminal y de la paleta, en TypeScript y sin DOM: `parser.ts`, `commands.ts`, `session.ts` (pantalla e historial), `boot.ts` (tiempos del arranque) y `palette.ts`. Cada uno tiene su `.test.ts` al lado. |
| `src/lib/Components/` | Piezas de interfaz (abajo). |
| `src/lib/stores/ui.js` | Estado compartido (paleta abierta, comando pedido a la terminal) y `runEffects`, que aplica lo que devuelven los comandos. |
| `src/lib/stores/scene.js` | El fondo 3D: estado (`sceneStatus`, `pulseRequests`, `activeStage`) y `stageAnchor`, la acción que marca una sección como parada del recorrido. |
| `src/lib/three/` | La escena: `stages.ts` (las seis etapas), `camera.ts` (matemática de la cámara), `graph.ts` (el grafo de arquitectura), `pulse.ts` (la onda de un pulso), `quality.ts` (tiers y nivel adaptativo) y `scene.ts` (el renderer). Todo puro salvo `scene.ts`, que recibe `three` por `loadThree()`. Cada módulo puro tiene su `.test.ts`. |
| `src/lib/css/` | `tokens.css` (colores, tipografía, espaciado, capas), `site.css` (base, fondo — la escena 3D y su respaldo CSS —, layout, piezas) y `terminal.css` (terminal y paleta). Los componentes no llevan `<style>`. |
| `src/routes/+layout.svelte` | Lo que se repite: fondo (`Background3D`), header con el menú, footer, atajo Cmd/Ctrl+K y la paleta. |
| `src/routes/+page.svelte` | La página: una `<section id>` por bloque. |
| `src/app.html` | `lang`, color del tema, íconos y precarga de fuentes. |
| `static/brand/` | El logo (SVG, tal como se entregó) y sus PNG: favicon de 32px e ícono de 180px. |
| `static/fonts/` | JetBrains Mono y Chakra Petch en woff2 (subset latino) con sus licencias OFL. No se pide ninguna fuente a otro dominio. |
| `site.json` | `domain` de producción. Vacío: el sitio solo existe en QA. |

## Las piezas

- **`Panel`**, **`SectionHeader`**, **`Button`**, **`Tag`**, **`StatusDot`**, **`Container`**: las piezas base. Panel con corchetes en las esquinas, encabezado `SYS//01`, botón (o link con forma de botón), etiqueta, punto de estado (una celda cuadrada; verde es "activo") y contenedor.
- **`Hero`**: identidad, rol, lema y los dos botones, como HTML prerenderizado, más la terminal.
- **`Terminal`**: arranque tipeado (una animación de CSS; se saltea, y con movimiento reducido no se anima) y línea de comandos. Comandos: `help`, `whoami`, `ls projects`, `cat stack`, `contact`, `deploy --prod`, `clear`. Flechas arriba y abajo recorren el historial.
- **`CommandPalette`**: Cmd/Ctrl+K o el botón del header. Va a una sección, corre un comando en la terminal o abre un link. En pantallas chicas es el menú.
- **`Seo`**: título, descripción, Open Graph y el JSON-LD de la persona.
- **`Background3D`**: el fondo. Dibuja un grafo de arquitectura (nodos, aristas, paquetes, pulsos) sobre un piso con plano, y la cámara lo recorre siguiendo el scroll por las seis etapas del pipeline. Three se descarga después de `load`, del primer pintado y cuando el navegador está ocioso, y solo con WebGL2 de hardware y sin ahorro de datos; con render por software (SwiftShader, llvmpipe) o sin WebGL2 queda la grilla CSS. El scroll mueve la cámara por las `stageAnchor` de cada sección, el puntero hace paralaje y hover, y un click en el fondo (o `deploy --prod` en la terminal) manda un pulso al grafo. Con `prefers-reduced-motion` queda un cuadro fijo. `?debug3d` muestra un HUD con fps, cluster y calidad; `?debug3d=low|high` fuerza el tier.

## Cómo se agrega…

- **Un comando**: el texto de ayuda en `content/terminal.js` (`commands`) y la función en `handlers` de `terminal/commands.ts`. Un test de `commands.test.ts` falla si uno de los dos falta.
- **Una sección**: mientras no esté construida, una entrada en `pendingSections` de `content/site.js` le reserva el ancla. Al construirla, sale de esa lista y va como `<section id>` en `+page.svelte`.
- **Una parada del recorrido 3D**: `use:stageAnchor={"build"}` (o el índice numérico) en la sección que marca esa etapa; hoy las `pendingSections` lo usan de forma provisional.
- **Un color o una medida**: en `tokens.css`, nunca suelto en otro archivo.

## Contenido pendiente

Lo que todavía es un placeholder está marcado `TODO(content)` en `src/lib/content/`: el mail, los perfiles (GitHub, LinkedIn), los proyectos y `site.url` (el dominio de producción). Los perfiles marcados `todo: true` no salen en el JSON-LD.

## Reglas del sitio

- Sintaxis de Svelte 4 (`export let`, `$:`, `on:click`, `<slot />`). Sin runes.
- Nada que use `window` o `document` fuera de `onMount` o de un manejador de eventos: todo se prerenderiza.
- `three` solo se carga con un `import()` dinámico desde `onMount` (`loadThree()` en `three/scene.ts`), nunca a nivel de módulo.
- Sin pedidos a otros dominios ni scripts de terceros.
