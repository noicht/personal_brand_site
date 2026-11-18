# Servidores desde cero

Esta guía pone en marcha QA y producción la primera vez, en orden. Cada paso dice qué hacer, cómo comprobar que salió y dónde está el detalle. La referencia completa está en [`hetzner.md`](hetzner.md) (servidores y DNS) y en [`github-actions.md`](github-actions.md) (los workflows). Esta guía da el orden.

Antes de empezar tenés que tener el proyecto andando en tu máquina y tu propia copia del repo en GitHub ([`primeros-pasos.md`](primeros-pasos.md)).

## Qué vas a armar

```
tu máquina ── git push ──► GitHub Actions
                                │
                  Deploy        │  automático, con cada push a main
                                ▼
                         web-design-qa      <sitio>.qa.tudominio.com
                                │           (DNS: A *.qa → IP de QA)
                  Promover      │  a mano, cuando QA está aprobado
                                ▼
                         web-design-prod    tu-sitio.com
                                            (DNS: CNAME → web.tudominio.com → Floating IP)
```

Son dos servidores Ubuntu, y en cada uno corren Docker, Caddy y el contenedor `general`. El flujo necesita los dos: los workflows fallan si falta uno. Tampoco sirve apuntar los dos secretos al mismo servidor, porque cada deploy le borraría al otro sus bloques de Caddy.

## Qué necesitás

| Qué | Para qué | Nota |
| --- | -------- | ---- |
| Cuenta en [Hetzner Cloud](https://console.hetzner.cloud/) | Los dos servidores y la Floating IP | Pide un medio de pago. Se cobra por mes mientras existan |
| Un dominio tuyo "de infraestructura" | El dominio de QA y el origen | Alcanza con uno: `qa.tudominio.com` y `web.tudominio.com` |
| Cuenta en [Cloudflare](https://dash.cloudflare.com/) (plan Free) | El DNS | Producción necesita su "CNAME flattening" (ver `hetzner.md`, "Producción") |
| Tu repo en GitHub | Los workflows | |
| Una terminal con `ssh` | Entrar a los servidores | En Mac o Linux, la terminal. En Windows, **Git Bash**: los comandos de esta guía son de bash |
| El dominio de un sitio (opcional) | Producción | Sin dominio, el sitio vive solo en QA |

Anotá cada valor a medida que lo tengas, porque se usa en varios pasos. En los docs aparecen como placeholders:

| En los docs | Qué es | Tu valor |
| ----------- | ------ | -------- |
| `<IP-QA>` | IP del servidor de QA | |
| `<IP-PROD>` | IP del servidor de producción | |
| `<FLOATING-IP>` | Floating IP de producción | |
| `qa.example.com` | Tu dominio de QA | ej. `qa.tudominio.com` |
| `web.example.net` | Tu origen | ej. `web.tudominio.com` |
| `example.com` | El dominio de un sitio | |

## Paso 1. Tu dominio de QA en el repo

El repo trae `qa.example.com`. Cambialo por el tuyo en estos cinco lugares, que tienen que coincidir:

| Archivo | Qué cambiar |
| ------- | ----------- |
| `.github/workflows/deploy.yml` | `QA_DOMAIN: qa.example.com` |
| `.github/workflows/promote.yml` | `QA_DOMAIN: qa.example.com` |
| `Sitios/packages/kit/src/host.js` | `QA_DOMAIN = "qa.example.com"` |
| `Sitios/infra/Caddyfile` | `endsWith('.qa.example.com')` |
| `Sitios/infra/sites/qa.example.com.caddy` | El `*.qa.example.com` del bloque, y el nombre del archivo |

En VS Code: **Ctrl+Shift+H** (reemplazar en archivos), buscá `qa.example.com`, reemplazá por tu dominio y en *files to include* poné `.github, Sitios/infra, Sitios/packages`. Así los docs quedan como están. Después renombrá el bloque de Caddy, desde la raíz del repo:

```bash
git mv Sitios/infra/sites/qa.example.com.caddy Sitios/infra/sites/qa.tudominio.com.caddy
```

**Comprobá** que no quedó ninguno (no tiene que imprimir nada):

```bash
git grep -n "qa.example.com" -- .github Sitios/infra Sitios/packages
```

Commiteá y pusheá. Con Actions apagado (como quedó en `primeros-pasos.md`), el push no publica nada.

## Paso 2. La clave SSH, en tu máquina

Es una sola clave para todo: con ella entran a los dos servidores vos y GitHub Actions.

En Git Bash, Mac o Linux:

```bash
mkdir -p ~/.ssh
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_web-infra -N ""
cat ~/.ssh/id_ed25519_web-infra.pub
```

Si preferís PowerShell, cambian las comillas y la ruta:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.ssh" | Out-Null
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\id_ed25519_web-infra" -N '""'
Get-Content "$env:USERPROFILE\.ssh\id_ed25519_web-infra.pub"
```

En PowerShell 5.1, `-N ""` no funciona: PowerShell no le pasa el texto vacío al programa y `ssh-keygen` falla. Con `'""'` sí llega.

- La línea que imprime el último comando empieza con `ssh-ed25519`. Es la clave **pública** y va a los servidores.
- La clave **privada** (`id_ed25519_web-infra`, sin `.pub`) no tiene contraseña, porque GitHub Actions la usa sin que nadie la escriba. Por eso no va nunca al repo ni se comparte: vive solo en tu máquina y en los secretos de GitHub. Quien la tenga controla los dos servidores.

## Paso 3. Crear los dos servidores

En la consola de Hetzner Cloud, dentro de un proyecto:

1. **Firewalls → Create Firewall**, con reglas de entrada para TCP 22, 80 y 443, desde cualquier IPv4 e IPv6. El 22 es para SSH. El 80 y el 443 son para los visitantes y para que Let's Encrypt valide los certificados.
2. **Servers → Add Server**, dos veces:
   - Imagen: **Ubuntu**, la última LTS.
   - Tipo: el más chico alcanza para empezar, porque los sitios son archivos.
   - Ubicación: la misma para los dos.
   - Firewall: el del punto 1.
   - SSH keys: opcional, ver el atajo de [`hetzner.md`, "Clave y usuario"](hetzner.md#clave-y-usuario).
   - Nombre: `web-design-qa` y `web-design-prod`.
3. Anotá la IPv4 pública de cada uno: son `<IP-QA>` y `<IP-PROD>`.

Detalle en [`hetzner.md`, "Consola"](hetzner.md#consola) y ["Servidores"](hetzner.md#servidores).

## Paso 4. El usuario `web-infra`, en cada servidor

Root crea el usuario `web-infra` y le carga tu clave pública. Los comandos están en [`hetzner.md`, "Clave y usuario"](hetzner.md#clave-y-usuario).

**Comprobá**, desde tu máquina, que entra sin pedir contraseña:

```bash
ssh -i ~/.ssh/id_ed25519_web-infra web-infra@<IP-QA>
ssh -i ~/.ssh/id_ed25519_web-infra web-infra@<IP-PROD>
```

Si pide contraseña, la clave no se está usando: la misma sección de `hetzner.md` dice qué revisar.

## Paso 5. Docker y `/opt/web`, en cada servidor

Como `web-infra`, corré los comandos de [`hetzner.md`, "Instalación"](hetzner.md#instalación): Docker, el grupo `docker` y las carpetas de `/opt/web`. Después de agregar el usuario al grupo `docker`, salí y volvé a entrar.

**Comprobá** que esto responde sin `sudo`:

```bash
docker compose version
ls -ld /opt/web    # dueño: web-infra
```

Si dice `permission denied while trying to connect to the Docker daemon socket`, te faltó salir y volver a entrar.

## Paso 6. Caddy arriba, en cada servidor

Desde la raíz de tu repo, en tu máquina (ya con tu dominio de QA del paso 1):

```bash
scp -i ~/.ssh/id_ed25519_web-infra Sitios/infra/compose.yml Sitios/infra/Caddyfile web-infra@<IP-QA>:/opt/web/
scp -i ~/.ssh/id_ed25519_web-infra Sitios/infra/compose.yml Sitios/infra/Caddyfile web-infra@<IP-PROD>:/opt/web/
```

En cada servidor:

```bash
cd /opt/web
docker compose up -d caddy
docker compose ps
```

**Comprobá** que `caddy` aparece en marcha. Por ahora se levanta solo Caddy: la imagen `general` todavía no existe en el servidor, y la carga el primer deploy (paso 9).

## Paso 7. La Floating IP, solo en producción

1. En la consola de Hetzner: **Floating IPs → Create**, IPv4, en la misma ubicación, asignada a `web-design-prod`. Anotala: es `<FLOATING-IP>`.
2. En `web-design-prod`, configurala en la red con los comandos de [`hetzner.md`, "Floating IP en producción"](hetzner.md#floating-ip-en-producción). Asignarla en la consola no alcanza.

**Comprobá** en el servidor que `ip -4 addr show eth0` muestra `<FLOATING-IP>/32`.

## Paso 8. El DNS, en Cloudflare

En la zona de tu dominio de infraestructura van dos registros, los dos con la nube **gris** (*DNS only*):

| Type | Name | Valor |
| ---- | ---- | ----- |
| A | `*.qa` | `<IP-QA>` |
| A | `web` | `<FLOATING-IP>` |

**Comprobá** (puede tardar unos minutos en resolver):

```bash
nslookup cualquiera.qa.tudominio.com    # → <IP-QA>
nslookup web.tudominio.com              # → <FLOATING-IP>
```

Por qué la nube gris y por qué el origen no lleva AAAA: [`hetzner.md`, "QA"](hetzner.md#qa-qaexamplecom-en-web-design-qa) y ["Origen"](hetzner.md#origen-webexamplenet).

## Paso 9. Secretos y primer deploy

1. **Los cuatro secretos.** Qué va en cada uno está en [`github-actions.md`, "Antes de empezar"](github-actions.md#antes-de-empezar-configurar-github). Dónde se cargan depende de tu plan de GitHub:
   - Con GitHub Free y repo privado no hay *environments*. Cargalos en **Settings → Secrets and variables → Actions → Repository secrets**. Si el run se queja del environment `production`, ver [`github-actions.md`](github-actions.md#antes-de-empezar-configurar-github).
   - Con GitHub Pro (gratis con el [GitHub Student Developer Pack](https://education.github.com/pack)) o Team, podés cargarlos en el environment `production`, como dice `github-actions.md`.
2. **Prendé Actions**: Settings → Actions → General → *Allow all actions and reusable workflows*.
3. **Primer deploy**: Actions → **Deploy** → **Run workflow**, con alcance `todo`. Ese run carga la imagen `general` y sube la infra a los dos servidores, y publica todos los sitios en QA.

**Comprobá**:

- El run termina en verde. En el paso "Publicar en Hetzner" aparece la huella de tu clave, que tiene que coincidir con la de `ssh-keygen -lf ~/.ssh/id_ed25519_web-infra`.
- `https://biblioteca.qa.tudominio.com` abre. La primera vez tarda unos segundos, mientras Caddy saca el certificado.
- `https://biblioteca.qa.tudominio.com/api/v1/health` devuelve `{"ok":true,…}`: eso es `general` respondiendo detrás de Caddy.
- En el servidor de QA, `docker compose ps` muestra `caddy` y `general`, y `cat /opt/web/versions/*` muestra el commit publicado.

Desde acá, cada push a `main` que toca un sitio lo publica solo en QA.

## Paso 10. Un sitio en producción

Se hace una vez por sitio:

1. Poné el dominio en `site.json`.
2. Creá `Sitios/infra/sites/<dominio>.caddy`.
3. Push.
4. En el DNS del dominio, `@` y `www` como CNAME a `web.tudominio.com`.
5. Actions → **Promover a producción**.

Está paso a paso en [`hetzner.md`, "Producción"](hetzner.md#producción).

**Comprobá** que el run de Promover termina sin *warning* y que `https://<dominio>/` abre.

## El día a día

1. Cambiás el sitio y lo probás en local, con `dev` y `build`.
2. Push a `main`: el cambio queda en `https://<sitio>.qa.tudominio.com`.
3. Lo revisás vos o quien encargó el sitio.
4. Actions → **Promover a producción** → `promover`. Si algo salió mal, el mismo workflow con `volver` deja la versión anterior.

## Errores comunes

| Dónde | Ves… | Qué revisar |
| ----- | ---- | ----------- |
| `ssh` | Te pide contraseña | El `authorized_keys` de `web-infra` (dueño y permisos). En PowerShell, los permisos del archivo de la clave. Ver [`hetzner.md`, "Clave y usuario"](hetzner.md#clave-y-usuario) |
| `ssh` | `Connection timed out` | Que sea la IP del servidor y que el firewall de Hetzner tenga abierto el 22 |
| Servidor | `permission denied … docker.sock` | Salí y volvé a entrar después de `usermod -aG docker` |
| Deploy | `Falta el secreto HETZNER_HOST` | Los secretos no están donde el workflow los busca: *Repository secrets* (Free) o environment `production` (Pro/Team), con el nombre exacto |
| Deploy | `No se llega al SSH de …` | El secreto tiene la IP del servidor (no un dominio) y el firewall deja entrar al 22 |
| Deploy | `… rechazó la clave de HETZNER_SSH_KEY` | El secreto tiene la clave **privada** completa, con las líneas `BEGIN` y `END`, y `HETZNER_USER` es `web-infra`. Compará la huella del log con la de tu máquina |
| Deploy | Falla en "Detectar cambios" con `unknown revision` | El repo tiene un solo commit y no hay contra qué comparar. Corré Deploy a mano (Run workflow) o hacé otro commit |
| Navegador | QA no abre, o da error de certificado | El registro `*.qa` con la nube gris, y que exista `www/<host>/index.html` en el servidor. Ver [`hetzner.md`, "Cuando un dominio no abre"](hetzner.md#cuando-un-dominio-no-abre) |
| Promover | `no tiene "domain" en site.json` o `Falta Sitios/infra/sites/<dominio>.caddy` | El paso 10 |
| Promover | *Warning*: `https://<dominio>/ respondió '…'` | Los archivos ya están publicados. Lo que falta es el DNS o el certificado: [`hetzner.md`, "Cuando un dominio no abre"](hetzner.md#cuando-un-dominio-no-abre) |

## Cuando termines el curso

Los servidores y la Floating IP se cobran mientras existan, aunque no reciban visitas. Si no los vas a usar más, borralos en la consola de Hetzner. En los servidores no hay nada que no esté en el repo: los podés volver a armar con esta misma guía cuando quieras.
