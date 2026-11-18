# Glosario

Las palabras que aparecen en los docs, explicadas en una o dos líneas y con lo que significan en este proyecto.

## Desarrollo

| Término | Qué es |
| ------- | ------ |
| **Svelte** | Framework de componentes. Cada `.svelte` tiene su HTML, su `<script>` y su `<style>`. Acá se usa Svelte 5 con la sintaxis de Svelte 4 (`export let`, `$:`, `on:click`, `<slot />`). |
| **SvelteKit** | Framework de aplicaciones sobre Svelte: rutas (`src/routes/`), layouts y build. Cada sitio de `clients/` es una app SvelteKit. |
| **Vite** | La herramienta que corre el servidor de desarrollo (`npm run dev`) y arma el build. Recarga la página sola cuando guardás un archivo. |
| **Build** | Convertir el código fuente en los archivos que se publican. `npm run build -w <sitio>` deja el resultado en `clients/<sitio>/build/`. |
| **Sitio estático** | Un sitio que es solo archivos (HTML, CSS, JS, imágenes). El servidor los entrega tal cual, sin correr código por cada visita. Todos los sitios de este proyecto son estáticos. |
| **`adapter-static`** | El adaptador de SvelteKit que genera un sitio estático. |
| **Prerender** | Generar el HTML de cada página durante el build, en vez de en cada visita. Lo activa `export const prerender = true` en `+layout.js`. |
| **npm workspaces / monorepo** | Varios paquetes en un solo repo, instalados juntos. Acá `Sitios/` es la raíz: un `npm install` instala todos los sitios, el kit y `general`. `-w <nombre>` elige uno. |
| **`@sitios/kit`** | El paquete compartido (`packages/kit/`): Analytics, Calendly, el cliente de la API, `host.js` y las animaciones de entrada. Los sitios lo importan, así que un cambio llega a todos en su próximo build. |
| **`general`** | La API compartida (`services/general/`), un servicio Node sin framework. Cada *feature* es un archivo y queda en `/api/v1/<feature>`. |
| **`site.js`** | `src/lib/data/site.js` de cada sitio: todo el contenido (textos, menú, links). Las páginas leen de ahí. |
| **`site.json`** | Archivo de cada sitio con su `domain` de producción. Vacío, el sitio existe solo en QA. |
| **`.env`** | Variables para tu máquina (por ejemplo, el ID de Google Analytics para probar). No se sube al repo. `.env.example` muestra qué va. |
| **Template** | `templates/site-static/`, el esqueleto de un sitio nuevo. Lo copia `scripts/new-site.ps1`. |

## Publicación

| Término | Qué es |
| ------- | ------ |
| **QA** | El ambiente de revisión: `<sitio>.qa.example.com`. Cada push a `main` publica ahí. No lo indexan los buscadores y no corre Analytics. |
| **Producción** | El dominio real del sitio. Solo cambia cuando alguien lo promueve a mano. |
| **Promover** | Copiar a producción exactamente los archivos que están en QA, sin volver a buildear. Lo hace el workflow **Promover a producción**. |
| **Volver** | Restaurar en producción la versión anterior. Correrlo otra vez lo deshace. |
| **GitHub Actions** | El sistema de GitHub que corre tareas automáticas. Acá publica los sitios. |
| **Workflow** | Un archivo de `.github/workflows/` que dice qué tareas correr y cuándo. Hay dos: `deploy.yml` y `promote.yml`. |
| **Runner** | La máquina de GitHub donde corre un workflow. El build se hace ahí, no en el servidor. |
| **Job / step** | Un workflow tiene *jobs*, y cada job tiene *steps* (pasos). Cada paso tiene su log en la página del run. |
| **`workflow_dispatch`** | Un workflow que se corre a mano: Actions → el workflow → **Run workflow**. |
| **Secret** | Un valor privado que GitHub guarda cifrado y le pasa al workflow (por ejemplo, la clave SSH). No aparece en los logs. |
| **Environment** | Un grupo de secretos y reglas con nombre (acá, `production`). En repos privados requiere GitHub Pro o Team. Con Free, los secretos van como *repository secrets*. |
| **Template repository** | Un repo de GitHub marcado como plantilla. **Use this template** crea una copia nueva e independiente, sin el historial del original. |

## Servidores

| Término | Qué es |
| ------- | ------ |
| **VPS** | Un servidor virtual que alquilás, con su IP pública. Acá hay dos en Hetzner Cloud: `web-design-qa` y `web-design-prod`. |
| **Snapshot** | Una copia completa del disco del servidor, para volver atrás si un cambio del sistema sale mal. |
| **Firewall** | Las reglas de qué puertos aceptan conexiones. Acá están abiertos el 22 (SSH), el 80 y el 443 (web). |
| **SSH** | La forma de entrar a la terminal de un servidor de forma segura: `ssh usuario@ip`. |
| **Clave pública / privada** | Un par de claves. La pública va al servidor (en `authorized_keys`) y la privada queda con vos. Quien tiene la privada entra sin contraseña. |
| **`authorized_keys`** | El archivo del servidor con las claves públicas que pueden entrar como ese usuario. |
| **Huella (fingerprint)** | Un resumen corto de una clave, para comparar dos claves sin mirarlas enteras. `ssh-keygen -lf <clave>` la muestra. |
| **`scp` / `rsync`** | Copiar archivos por SSH. `rsync` copia solo lo que cambió, y con `--delete` borra en el destino lo que ya no está en el origen. |
| **Docker** | Corre programas en *contenedores*, aislados y con todo lo que necesitan. |
| **Imagen / contenedor** | La imagen es el paquete (por ejemplo `general` o `caddy:2`) y el contenedor es esa imagen corriendo. |
| **Docker Compose** | Define varios contenedores en un archivo (`compose.yml`) y los maneja juntos: `docker compose up -d`, `ps`, `logs`. |
| **Caddy** | El servidor web. Entrega los archivos de cada sitio, saca solo los certificados HTTPS y le pasa `/api/*` a `general`. |
| **Reverse proxy** | Un servidor que recibe el pedido y se lo pasa a otro. Caddy es el reverse proxy de `general`: el navegador nunca habla directo con `general`. |
| **Same-origin / CORS** | Si la página y la API están en el mismo dominio (*same-origin*), el navegador no pide permisos extra. Si están en dominios distintos, la API tiene que permitirlo (CORS). Acá todo va por `/api` del mismo dominio, así que no hace falta CORS. |
| **Certificado / Let's Encrypt** | El certificado hace que el sitio abra con `https://`. Let's Encrypt los da gratis, y Caddy los pide y los renueva solo. |
| **`on_demand_tls`** | Que Caddy pida el certificado de un subdominio en su primera visita, y no de antemano. Así funciona QA con cualquier `<sitio>.qa.…` sin configurar nada por sitio. |
| **`noindex`** | Un aviso a los buscadores para que no muestren la página. QA lo manda en cada respuesta. |

## DNS

| Término | Qué es |
| ------- | ------ |
| **DNS** | El sistema que traduce un nombre (`example.com`) a una IP. |
| **Registro A / AAAA** | Un nombre que apunta a una IPv4 (A) o a una IPv6 (AAAA). |
| **CNAME** | Un nombre que apunta a otro nombre. Acá los dominios de producción son CNAME al origen. |
| **CNAME flattening** | Cloudflare permite un CNAME en la raíz del dominio (`@`), que el DNS común no admite. Por eso las zonas van en Cloudflare. |
| **Wildcard (`*.qa`)** | Un registro que vale para cualquier subdominio: `biblioteca.qa…`, `mi-marca.qa…`. |
| **Nameservers** | Los servidores que responden el DNS de un dominio. Pasar un dominio a Cloudflare es cambiar sus nameservers. |
| **Nube gris / naranja** | En Cloudflare, gris (*DNS only*) solo resuelve el nombre. Naranja pone a Cloudflare en el medio como proxy. Acá va siempre gris. |
| **Origen** | El nombre al que apuntan todos los dominios de producción (`web.example.net`). Apunta a la Floating IP. |
| **Floating IP** | Una IP de Hetzner que no es de ningún servidor y se asigna al que corresponda. Mudar producción a otro servidor es reasignarla, sin tocar DNS. |
