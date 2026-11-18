# GitHub Actions

Los dos workflows que publican los sitios. Están en `.github/workflows/` (en la raíz del repo, no en `Sitios/`), porque GitHub solo los busca ahí.

| Workflow | Archivo | Cuándo corre | Qué hace |
| -------- | ------- | ------------ | -------- |
| **Deploy** | `deploy.yml` | Con cada push a `main` (y a mano) | Publica en QA lo que cambió. También actualiza `general` y la infra en los dos servidores. |
| **Promover a producción** | `promote.yml` | Solo a mano | Copia un sitio de QA a producción, o vuelve a la versión anterior. |

La regla de fondo es esta: **un push nunca cambia producción**. Todo pasa primero por QA, y a producción llegan exactamente los mismos archivos que se revisaron ahí.

```
push a main ──► Deploy ──► QA: biblioteca.qa.example.com
                                   │
                    (lo revisás)   │
                                   ▼
Run workflow ──► Promover ──► producción: example.com
```

## Antes de empezar: configurar GitHub

Los workflows entran por SSH a los servidores. Para eso necesitan cuatro secretos. Van en un *environment* llamado `production`, que es el que declaran los dos workflows (`environment: production`).

1. En el repo: **Settings → Environments → New environment** → `production`.
2. Adentro, **Add environment secret**, uno por uno:

   | Secreto | Valor |
   | ------- | ----- |
   | `HETZNER_SSH_KEY` | La clave **privada** completa: el contenido de `~/.ssh/id_ed25519_web-infra`, con las líneas `-----BEGIN…` y `-----END…` |
   | `HETZNER_USER` | `web-infra` |
   | `HETZNER_HOST` | `<IP-QA>` |
   | `HETZNER_PROD_HOST` | `<IP-PROD>` |

   Cómo crear la clave y el usuario en el servidor está en `hetzner.md`, "Clave y usuario". La clave privada nunca va en el repo.

   **Repo privado con GitHub Free:** los *environments* no existen en ese plan para repos privados (hacen falta Pro, Team o Enterprise). Cargá los cuatro en **Settings → Secrets and variables → Actions → Repository secrets**, con los mismos nombres: `secrets.HETZNER_*` busca primero en el environment y, si no está ahí, en el repo. Si aun así el run falla porque no puede usar el environment `production`, borrá la línea `environment: production` de los dos workflows. GitHub Pro viene gratis con el [GitHub Student Developer Pack](https://education.github.com/pack).

3. El dominio de QA aparece en varios archivos y tiene que ser el mismo en todos. Si usás otro que no sea `qa.example.com`, cambialo en:
   - `.github/workflows/deploy.yml` → `env.QA_DOMAIN`
   - `.github/workflows/promote.yml` → `env.QA_DOMAIN`
   - `Sitios/packages/kit/src/host.js` → `QA_DOMAIN`
   - `Sitios/infra/Caddyfile` → el `endsWith('.qa.example.com')` del `ask`
   - `Sitios/infra/sites/qa.example.com.caddy` → el nombre del archivo (tiene que ser `<QA_DOMAIN>.caddy`) y el `*.qa.example.com` del bloque

Para comprobar que el secreto tiene la clave correcta: el paso "Publicar en Hetzner" imprime la huella de la clave. Tiene que coincidir con la de tu máquina:

```bash
ssh-keygen -lf ~/.ssh/id_ed25519_web-infra
```

## Deploy (`deploy.yml`)

### Cuándo corre

- **Push a `main`** que toca alguna de las rutas de `paths:` (`Sitios/clients/**`, `services/**`, `packages/**`, `infra/**`, los `package*.json` de `Sitios/` o el propio workflow). Un push que solo cambia los docs no lo dispara.
- **A mano** (Actions → Deploy → Run workflow), con un `alcance`:
  - `sitios`: rebuildea y publica todos los sitios estáticos. No toca Docker en el servidor.
  - `todo`: además arma la imagen de `general`, sube la infra y recrea los contenedores. Sirve para poblar un servidor nuevo.

### Paso 1: detectar qué cambió

El paso "Detectar cambios" arma la lista de archivos tocados con `git diff` entre el commit anterior al push (`github.event.before`) y el actual (`github.sha`). Si no hay commit anterior (por ejemplo, la primera vez de una rama), compara `HEAD^` con `HEAD`. Por eso el checkout usa `fetch-depth: 0`: sin todo el historial, el commit anterior no estaría.

Dos consecuencias de ese caso. Si la rama llega con varios commits nuevos de una, solo mira el último. Y en un repo con un solo commit (uno recién creado desde el template, por ejemplo) `HEAD^` no existe: el paso falla con `unknown revision`. Corré Deploy a mano (`todo` o `sitios`, que no comparan commits) o esperá al próximo commit.

Con esa lista decide:

| Si cambió… | Entonces… |
| ---------- | --------- |
| `Sitios/clients/<nombre>/…` | Ese sitio entra en la lista. |
| `Sitios/packages/…` (el kit) | Entran **todos** los sitios que tienen `@sitios/` en su `package.json`: el kit se importa, así que su cambio solo llega a un sitio cuando se rebuildea. |
| `Sitios/services/general/…` | `general=true`: se arma la imagen Docker. |
| `Sitios/infra/…` | `infra=true`: se suben `compose.yml`, `Caddyfile` y `sites/`. |
| `Sitios/infra/compose.yml` | Además `compose_changed=true`: se recrean los contenedores. |
| `Sitios/package.json` o el lock | Se corre `npm ci` igual, para validar el lockfile. |

Después separa los sitios en dos grupos: los que tienen `Dockerfile` (con proceso propio, hoy ninguno) y los estáticos.

El resultado se pasa a los pasos siguientes como *outputs* (`$GITHUB_OUTPUT`). Mirá el log de este paso para ver qué decidió: imprime los archivos que cambiaron y la lista final.

Si no hay nada para publicar, el job termina ahí ("Nada que desplegar").

### Paso 2: build en el runner

Todo se compila en la máquina de GitHub, no en el servidor:

- `actions/setup-node` instala Node 22 (con caché de npm) y `npm ci` instala exactamente lo del `package-lock.json`.
- Cada sitio estático: `npm run build -w <nombre>`. Queda en `Sitios/clients/<nombre>/build/`.
- Cada sitio con Dockerfile, y `general` si cambió: `docker build`, con `Sitios/` como contexto (así el Dockerfile ve los workspaces).

### Paso 3: publicar por SSH

El paso "Publicar en Hetzner (QA y PROD)":

1. **Prepara SSH.** Escribe la clave del secreto en `~/.ssh/id_ed25519`, imprime su huella y, para cada servidor, agrega su clave de host a `known_hosts` (`ssh-keyscan`) y prueba entrar. Si el 22 no contesta o la clave no sirve, el job falla con un mensaje claro en vez de colgarse.
2. **Imágenes Docker** (`general` y los sitios con proceso): `docker save | gzip | ssh … docker load`, a los **dos** servidores. No hay registry: la imagen viaja por SSH. Por eso `compose.yml` dice `pull_policy: never`.
3. **Infra**: `compose.yml` y `Caddyfile` a los dos. Los bloques de `sites/` se reparten con `rsync`: QA recibe solo `<QA_DOMAIN>.caddy` y producción todos los demás. `--delete-excluded` borra del servidor lo que no le toca.
4. **Sitios estáticos, solo a QA**: `rsync --delete` de `build/` a `/opt/web/www/<nombre>.<QA_DOMAIN>/`. Antes escribe `publicando` en `/opt/web/versions/<host>`, y al terminar escribe el commit y la fecha. Así Promover sabe si QA está a medio actualizar.
5. **Contenedores y Caddy**: `docker compose up -d` solo con lo que cambió (`--force-recreate` para tomar la imagen nueva, `--remove-orphans` si cambió el compose). Si cambió la infra, `caddy reload` (o un restart si el reload falla).

Producción solo recibe imágenes e infra. Sus sitios no cambian en un deploy.

Un detalle de bash que vale la pena entender: los loops que recorren la lista de sitios la leen por el descriptor 3 (`while read … <&3 … done 3<<EOF`), no por la entrada estándar. `ssh` lee la entrada estándar: si la lista viniera por ahí, el primer `ssh` del loop se la comería y solo se publicaría el primer sitio.

Si algo falla con un servidor, el job falla. Nunca queda uno actualizado y el otro no sin que se vea.

## Promover a producción (`promote.yml`)

Solo corre a mano: Actions → **Promover a producción** → Run workflow. Pide dos cosas:

- `cliente`: el nombre de la carpeta del sitio en `Sitios/clients/` (ej. `biblioteca`).
- `accion`: `promover` (QA → producción) o `volver` (vuelve a la versión anterior).

Desde la terminal, con [GitHub CLI](https://cli.github.com/):

```bash
gh workflow run promote.yml -f cliente=biblioteca -f accion=promover
gh run watch
```

`concurrency` hace que dos corridas sobre el mismo sitio esperen su turno en vez de pisarse.

### Paso 1: validar el sitio

Antes de tocar un servidor, el paso "Dominio del cliente" comprueba que:

- El nombre tiene solo minúsculas, números y guiones, y la carpeta existe.
- El sitio no tiene `Dockerfile` (promover es solo para estáticos).
- `site.json` tiene `domain`, y no es un dominio de QA.
- Existe `Sitios/infra/sites/<dominio>.caddy`.

Si falta algo, falla y dice qué falta. Para dejar un sitio listo para producción, ver `hetzner.md`, "Producción".

### Paso 2: copiar y publicar

QA y producción son servidores distintos, así que el build pasa por el runner:

1. Comprueba que producción ya tiene `sites/<dominio>.caddy` (lo sube Deploy con el push que lo agregó).
2. Con `promover`:
   - Lee `versions/` de QA. Si dice `publicando`, para: hay un deploy en curso.
   - Baja `www/<sitio>.<QA_DOMAIN>/` del servidor de QA al runner (`qa-build/`).
   - Vuelve a leer la versión. Si cambió durante la copia, para: la copia podría mezclar archivos de dos versiones.
   - Sube la copia a `/opt/web/incoming/` de producción.
3. Corre `Sitios/infra/promote.sh` en producción, por SSH (`ssh … bash -s -- <accion> <host-qa> <dominio> < promote.sh`). El script viaja por la entrada estándar: no hace falta que esté instalado en el servidor.

`promote.sh` hace el cambio con `mv` dentro del mismo disco, así que es casi instantáneo:

- `promover`: lo publicado pasa a `prev/<dominio>/` y lo que llegó a `incoming/` pasa a `www/<dominio>/`.
- `volver`: intercambia `www/<dominio>/` con `prev/<dominio>/`. Correrlo otra vez lo deshace.

El script valida los argumentos con una expresión regular antes de cualquier `rm -rf`, para que un valor vacío o con `/` nunca borre algo que no debe.

### Paso 3: probar

El último paso pide `https://<dominio>/` y espera un 200. Si no lo recibe, deja un *warning*: los archivos ya están publicados, y lo que falla suele ser el DNS o el certificado (ver `hetzner.md`, "Cuando un dominio no abre").

El resumen del run (la página del run en GitHub) muestra el commit que quedó en producción, el de la versión anterior y el de QA.

## Leer un run

Actions → el run → el job. Cada paso tiene su log desplegable. Para entender qué pasó, conviene mirar:

- **Deploy → "Detectar cambios"**: qué archivos cambiaron y qué decidió publicar.
- **Deploy → "Publicar en Hetzner"**: la huella de la clave, qué subió a cada servidor y los errores de SSH, si los hubo.
- **Promover → resumen del run**: qué versión quedó en producción.

Las líneas que empiezan con `::error::` o `::warning::` son anotaciones de GitHub: aparecen arriba, en el resumen del run.
