# Hetzner

Documento general de los servidores. Vale para todos los sitios: un sitio no tiene servidor propio.

Este documento es la referencia, ordenado por tema. Si vas a armar los servidores por primera vez, seguí [`servidores-desde-cero.md`](servidores-desde-cero.md): va en orden y te manda a cada sección de acá cuando hace falta.

Son dos Ubuntu en Hetzner Cloud, uno para QA y otro para producción (ver "Servidores"). Cada uno tiene Docker Compose, un Caddy y los builds en disco. Los fuentes se quedan en el repo.

En este documento los datos propios van como placeholders. Reemplazalos por los tuyos:

| Placeholder | Qué es |
| ----------- | ------ |
| `<IP-QA>` | IP pública del servidor de QA |
| `<IP-PROD>` | IP pública del servidor de producción |
| `<FLOATING-IP>` | Floating IP de Hetzner asignada a producción |
| `qa.example.com` | Dominio de QA: cada sitio queda en `<sitio>.qa.example.com` |
| `web.example.net` | Origen: el nombre al que apuntan los dominios de producción |
| `example.com` | Un dominio de producción cualquiera |

## Consola

El servidor se crea, se reinicia y se apaga desde Hetzner Cloud. El firewall de esa consola deja entrar 22, 80 y 443, y el resto queda cerrado. El 22 es para SSH (vos y los workflows); el 80 y el 443 son para los visitantes y para que Let's Encrypt valide los certificados.

Antes de tocar el sistema (actualizar Ubuntu, cambiar Docker, agrandar el disco), sacá un snapshot. Un sitio nuevo no necesita snapshot: es una carpeta y un bloque de Caddy.

## Disco

QA:

```
/opt/web/
  compose.yml
  Caddyfile
  sites/
    qa.example.com.caddy
  www/
    biblioteca.qa.example.com/
  versions/
    biblioteca.qa.example.com
  data/
```

Producción:

```
/opt/web/
  compose.yml
  Caddyfile
  sites/
    example.com.caddy
  www/
    example.com/
  prev/
    example.com/
  incoming/
  versions/
    example.com
  data/
```

`www/<host>/` es lo publicado: en QA `<sitio>.qa.example.com`, en producción `<dominio>`. `sites/` son los bloques de Caddy, uno por dominio: el deploy le deja a QA solo `qa.example.com.caddy` y a producción todos los demás. `prev/<dominio>/` es la versión anterior de producción, para volver atrás. `incoming/` es donde promover deja el build que trae de QA, antes de publicarlo. `versions/<host>` dice qué commit está publicado en cada host. `prev/`, `incoming/` y `versions/` los escriben los workflows y Caddy no los sirve. `data/` es de Caddy: certificados y estado. No se borra al publicar un sitio.

## Clave y usuario

Root no entra por SSH desde afuera. El primer paso es la consola del servidor en Hetzner Cloud (Console, en el navegador). Ahí root entra con la contraseña del reset, y se crea el usuario:

```bash
useradd -m -s /bin/bash -G sudo web-infra
passwd web-infra
```

La clave de tu máquina va a ser `~/.ssh/id_ed25519_web-infra`. Desde afuera se entra como `web-infra`.

Generar la clave en tu máquina:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_web-infra -N ""
```

Ese comando es para bash (Mac, Linux o Git Bash en Windows). En PowerShell 5.1, `-N ""` falla: PowerShell no le pasa el texto vacío a `ssh-keygen`. Ahí va así:

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\id_ed25519_web-infra" -N '""'
```

Copiar la clave pública:

```bash
cat ~/.ssh/id_ed25519_web-infra.pub
```

En el servidor no se desactiva el password. Lo que evita que lo pida es esta línea pública dentro del `authorized_keys` de `web-infra`. Si el archivo no es de ese usuario, SSH la ignora y vuelve a pedir la contraseña de `passwd`. En la misma consola:

```bash
mkdir -p /home/web-infra/.ssh
nano /home/web-infra/.ssh/authorized_keys
chown -R web-infra:web-infra /home/web-infra/.ssh
chmod 700 /home/web-infra/.ssh
chmod 600 /home/web-infra/.ssh/authorized_keys
exit
```

Atajo, para no tipear la clave en la consola web: al crear el servidor, cargá tu clave pública en **SSH keys**. Hetzner la pone en el `authorized_keys` de root, y estos pasos se pueden hacer por SSH (`ssh -i ~/.ssh/id_ed25519_web-infra root@<ip>`). En vez del `nano`, se copia la de root:

```bash
mkdir -p /home/web-infra/.ssh
cp /root/.ssh/authorized_keys /home/web-infra/.ssh/
chown -R web-infra:web-infra /home/web-infra/.ssh
chmod 700 /home/web-infra/.ssh
chmod 600 /home/web-infra/.ssh/authorized_keys
```

Cuando `web-infra` ya entra, sacale el acceso a root para volver a "root no entra por SSH": `sudo rm /root/.ssh/authorized_keys`.

Entrar desde afuera:

```bash
ssh -i ~/.ssh/id_ed25519_web-infra web-infra@<ip>
```

Si pide contraseña, esa clave no se está usando. En Windows, OpenSSH la ignora cuando el archivo lo pueden leer otros usuarios. Hay que dejarla solo para tu usuario y volver a entrar:

```powershell
icacls $env:USERPROFILE\.ssh\id_ed25519_web-infra /inheritance:r
icacls $env:USERPROFILE\.ssh\id_ed25519_web-infra /grant:r "${env:USERNAME}:(R)"
```

La misma clave privada es la que usa GitHub Actions (secreto `HETZNER_SSH_KEY`, ver `github-actions.md`).

## Servidores

| Servidor | IP del servidor | Floating IP | Secreto | Sirve |
| -------- | --------------- | ----------- | ------- | ----- |
| `web-design-qa` | `<IP-QA>` | no | `HETZNER_HOST` | `*.qa.example.com` |
| `web-design-prod` | `<IP-PROD>` | `<FLOATING-IP>` | `HETZNER_PROD_HOST` | los dominios de producción |

SSH y los workflows usan la IP de cada servidor. A producción, los visitantes llegan por la Floating IP (ver "Origen"). QA no la necesita: su DNS apunta directo a la IP del servidor.

Los dos tienen el mismo usuario, la misma clave y la misma instalación. Si un servidor se arma desde el snapshot del otro, trae también las carpetas del otro ambiente: ver "Limpiar un servidor copiado".

## Instalación

El servidor llega vacío. No se instala Node ni los fuentes: en el host van Docker y un Caddy. Se corre una vez, como `web-infra`.

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker web-infra
```

Salí y volvé a entrar: el grupo `docker` no aplica en la sesión que ya estaba abierta.

El grupo `docker` deja a `web-infra` (y a los workflows, que entran como ese usuario) manejar los contenedores sin `sudo`. Tené en cuenta que eso equivale a root: quien tenga la clave tiene el servidor. Por eso la clave privada solo está en tu máquina y en los secretos de GitHub.

```bash
sudo mkdir -p /opt/web/sites /opt/web/www /opt/web/data/config
sudo chown -R web-infra:web-infra /opt/web
```

El compose está en `Sitios/infra/compose.yml` y el `Caddyfile` en `Sitios/infra/Caddyfile`. Desde la raíz del repo se copian al servidor:

```bash
scp -i ~/.ssh/id_ed25519_web-infra Sitios/infra/compose.yml Sitios/infra/Caddyfile web-infra@<ip>:/opt/web/
```

Cada dominio es un archivo en `sites/`. Con la carpeta vacía, Caddy igual arranca. La imagen `general` todavía no existe en el servidor (la carga el primer deploy), así que la primera vez se levanta solo Caddy:

```bash
cd /opt/web
docker compose up -d caddy
docker compose ps
```

Con `compose.yml` y `Caddyfile` en su lugar, GitHub → Actions → Deploy → **Run workflow** con alcance `todo` puebla los dos servidores: imagen `general`, infra y todos los sitios en QA. Producción queda sin sitios hasta promover cada uno.

### Floating IP en producción

Solo `web-design-prod` tiene Floating IP. Asignarla en la consola no alcanza: el servidor descarta los paquetes de una IP que su interfaz no tiene. Una vez, como `web-infra`:

```bash
sudo tee /etc/netplan/60-floating-ip.yaml <<EOF
network:
  version: 2
  renderer: networkd
  ethernets:
    eth0:
      addresses:
        - <FLOATING-IP>/32
EOF
sudo chmod 600 /etc/netplan/60-floating-ip.yaml
sudo netplan apply
ip -4 addr show eth0   # tiene que aparecer <FLOATING-IP>/32
```

Caddy publica 80 y 443 en todas las direcciones (`compose.yml`), así que atiende la Floating IP sin cambios. El firewall de Hetzner se aplica igual a la Floating IP.

### Limpiar un servidor copiado

Un servidor armado desde el snapshot del otro trae las carpetas de los dos ambientes. `sites/` lo limpia el próximo deploy de infra (o Run workflow con `todo`). `www/` y lo demás, una vez y a mano:

En QA, todo lo que no sea `*.qa.example.com`:

```bash
cd /opt/web
ls www versions                                   # revisar antes de borrar
find www versions -mindepth 1 -maxdepth 1 ! -name '*.qa.example.com' -exec rm -rf {} +
rm -rf prev incoming
docker compose restart caddy
```

En producción, todo lo de QA:

```bash
cd /opt/web
ls www versions
find www versions -mindepth 1 -maxdepth 1 -name '*.qa.example.com' -exec rm -rf {} +
docker compose restart caddy
```

`data/` no se toca en ninguno: los certificados que sobran no molestan y Caddy deja de renovarlos.

## Entrar

SSH con esa clave. El trabajo del día es en `/opt/web`.

```
ssh -i ~/.ssh/id_ed25519_web-infra web-infra@<ip>
cd /opt/web
docker compose ps
```

`docker compose ps` tiene que mostrar Caddy (y `general`) en marcha. Los logs:

```
docker compose logs -f caddy
```

## Varios sitios

En cada servidor hay un compose y un Caddy. Cada sitio se publica solo, y un cambio en uno no reinicia a los otros.

Un sitio estático es una carpeta en `www/<host>/` y, en producción, un archivo en `sites/`. Si un sitio llegara a tener proceso propio, es un servicio más en el mismo `infra/compose.yml`, sin puerto abierto a internet, y Caddy le hace de proxy. Hoy el único contenedor además de Caddy es `general`.

Cincuenta sitios son cincuenta carpetas y el mismo contenedor. GitHub Actions publica solo el sitio que cambió: no manda los cincuenta juntos ni hay un servidor por sitio.

## QA y producción

Cada sitio estático tiene dos direcciones:

- **QA**, `<sitio>.qa.example.com`. Cada push a `main` que toca el sitio lo publica ahí. Es para revisarlo (vos, el equipo o quien lo encargó) antes de salir. Tiene `noindex` y no corre Analytics.
- **Producción**, el dominio del sitio. Un push nunca la cambia. Se actualiza a mano con el workflow **Promover a producción**, que copia lo que está en QA.

El build es uno solo: producción recibe los mismos archivos que se vieron en QA, sin volver a compilar. Lo que tiene que ser distinto se decide en el navegador por el host, con `isQa()` de `@sitios/kit/host.js`. Así Analytics no corre en QA.

## Sitio con proceso

Hoy no hay ninguno. Un proxy o una integración con terceros va en `general`, no en un contenedor por sitio. Solo un endpoint con lógica de un único sitio justifica `Dockerfile` + servicio en `compose.yml`; el bloque de Caddy entonces hace `reverse_proxy <servicio>:3000` en vez de apuntar a `www/`. Promover a producción es solo para estáticos.

## QA: `qa.example.com` en `web-design-qa`

Cada sitio estático se publica siempre en `<sitio>.qa.example.com` (por ejemplo `biblioteca.qa.example.com`), tenga o no dominio propio.

En el DNS del dominio de QA (por ejemplo en Cloudflare: zona → DNS → Records), un solo registro, una vez:

| Type | Name | IPv4 address | Proxy status |
| ---- | ---- | ------------ | ------------ |
| A    | `*.qa` | IP de `web-design-qa` (`<IP-QA>`) | DNS only (nube gris) |

Con la nube gris, Cloudflare solo resuelve el nombre y el certificado lo saca Caddy. Si se activa el proxy (nube naranja), hay que cambiar el SSL/TLS de la zona a Full (strict) y el certificado se vuelve más difícil de diagnosticar. Mejor dejarla gris.

En el servidor no hay nada por sitio. `sites/qa.example.com.caddy` atiende `*.qa.example.com` con `import estatico {host}`, que sirve `www/<host>/`. El certificado de cada subdominio se pide en el primer acceso (`on_demand_tls` en el `Caddyfile`). Antes de pedirlo, Caddy le pregunta a `localhost:5555/check` si existe `www/<host>/index.html`, así un subdominio sin sitio publicado no gasta certificados. El primer acceso a un sitio nuevo tarda unos segundos: es Caddy pidiendo el certificado.

Para poblar QA con todos los sitios: GitHub → Actions → Deploy → **Run workflow**.

QA se sigue publicando con cada push aunque el sitio ya tenga dominio.

## Origen: `web.example.net`

El origen es un nombre en un dominio tuyo de infraestructura, que no es de ningún sitio y que los visitantes no ven. Apunta a `web-design-prod` a través de la Floating IP.

En el DNS de ese dominio (por ejemplo Cloudflare, zona `example.net` → DNS → Records):

| Type | Name  | Valor | Proxy status |
| ---- | ----- | ----- | ------------ |
| A    | `web` | Floating IP (`<FLOATING-IP>`) | DNS only (nube gris) |

Los dominios de producción no llevan la IP: son CNAME a `web.example.net`. No tiene AAAA: la IPv6 propia del VPS se pierde al mudar de servidor, y un AAAA que apunta a la máquina vieja deja afuera a los visitantes con IPv6. Si hace falta IPv6, se agrega una Floating IP IPv6 y su AAAA.

### Floating IP en `web-design-prod`

Una Floating IP de Hetzner es una IPv4 que no pertenece a ningún servidor y se asigna al que corresponda. Se asigna a `web-design-prod` en la consola de Hetzner.

Mudar todos los sitios de producción a otro servidor es reasignarla: Console → Floating IPs → **Assign** al servidor nuevo. No se toca DNS y el cambio es inmediato. El servidor nuevo tiene que tenerla configurada (ver "Floating IP en producción") y con los mismos archivos en `/opt/web/`. Después hay que cambiar el secreto `HETZNER_PROD_HOST` a la IP del servidor nuevo.

El dominio del origen tiene que tener activadas la renovación automática y el bloqueo de transferencia: si se vence, se caen todos los sitios de producción a la vez.

### Dónde está el DNS de cada dominio

- **Dominio comprado en Cloudflare**: ya está en la cuenta. Se cargan los registros del paso 4 de Producción.
- **Dominio en otro registrador**: el dominio sigue registrado ahí y lo renueva ese proveedor. Se agrega la zona en Cloudflare ("Add a domain", plan Free) y en el panel del registrador se cambian los nameservers por los dos que da Cloudflare. Antes:
  - Revisá que Cloudflare haya importado el MX y los TXT (SPF, DKIM). El correo se queda donde está y solo hay que copiar sus registros.
  - Desactivá DNSSEC en el registrador si está activo (común en `.de`). Con DNSSEC prendido, cambiar los nameservers deja el dominio sin resolver.

  Para irse, se vuelven a poner los nameservers del proveedor.
- **Dueño que no cede el DNS**: carga él `www` como CNAME a `web.example.net` y redirige `@` a `www` en su proveedor. Si su proveedor no redirige, `@` lleva A y AAAA con las IPs del VPS, y una mudanza obliga a pedirle el cambio. Es el caso a evitar.

## Producción

Una vez por dominio:

1. `clients/<sitio>/site.json` → `{ "domain": "example.com" }`. Lo lee el workflow de promover. El push no publica en el dominio.
2. `infra/sites/<dominio>.caddy`. El snippet `estatico` del `Caddyfile` es el mismo que usa QA: gzip, `/api/*` a `general` y `try_files` para que `/contacto` sirva `contacto.html` (así lo escribe `adapter-static`).

   ```
   example.com {
   	import estatico example.com
   }

   www.example.com {
   	redir https://example.com{uri} permanent
   }
   ```

3. Push a `main`. El deploy sube el bloque y recarga Caddy.
4. DNS del dominio, con la zona en Cloudflare (ver "Dónde está el DNS de cada dominio"):

   | Type  | Name        | Target            | Proxy status |
   | ----- | ----------- | ----------------- | ------------ |
   | CNAME | `@` y `www` | `web.example.net` | DNS only (nube gris) |

   En `@`, el DNS común no admite CNAME. Cloudflare sí, porque lo resuelve por dentro ("CNAME flattening"), y por eso la zona va en Cloudflare. Hay que borrar los A y AAAA viejos de `@` y `www`. Un AAAA que sigue en el hosting anterior manda a los visitantes con IPv6 a otro servidor, y Let's Encrypt, que prueba primero por IPv6, no puede validar el certificado. MX y los demás registros de correo no se tocan.
5. Actions → **Promover a producción** → Run workflow, con el sitio y `promover`.

Caddy pide el certificado cuando el dominio ya resuelve a esta IP. Si lo intentó antes y falló, reintenta solo, cada vez más espaciado. Para no esperar: `docker compose restart caddy`.

### Promover y volver

El día a día, con el dominio ya configurado:

1. Push a `main`. El cambio queda en QA, `<sitio>.qa.example.com`.
2. Se revisa en QA.
3. GitHub → Actions → **Promover a producción** → Run workflow. En `cliente` va el nombre de la carpeta (`biblioteca`), y la acción `promover`.

El workflow y sus dos acciones (`promover` y `volver`) están explicados en `github-actions.md`.

Lo mismo desde la terminal, con [GitHub CLI](https://cli.github.com/):

```bash
gh workflow run promote.yml -f cliente=biblioteca -f accion=promover
gh run watch
```

El trabajo en producción lo hace `infra/promote.sh`. Sin GitHub, desde `Sitios/` y con rsync, es lo mismo:

```bash
K="ssh -i ~/.ssh/id_ed25519_web-infra"
QA=biblioteca.qa.example.com
rsync -az --delete -e "$K" web-infra@<IP-QA>:/opt/web/www/$QA/ qa-build/
rsync -az --delete -e "$K" qa-build/ web-infra@<IP-PROD>:/opt/web/incoming/$QA/
$K web-infra@<IP-PROD> bash -s -- promover $QA example.com < infra/promote.sh
```

`volver` es solo la última línea, con `volver` en lugar de `promover`.

## Deploy

Lo hace `.github/workflows/deploy.yml` con cada push a `main`, y solo publica lo que cambió. Qué hace en cada caso, los secretos que necesita y cómo correrlo a mano está en `github-actions.md`.

Sitio estático nuevo: carpeta en `clients/` y push; queda en QA. Para producción, ver la sección Producción. Con proceso propio: además `Dockerfile` + servicio en `compose.yml`.

## Cuando un dominio no abre

- El dominio es CNAME a `web.example.net`, que resuelve a la Floating IP (`nslookup <dominio>`). No puede quedar un A o un AAAA viejo al lado del CNAME (`nslookup -type=AAAA <dominio>` no devuelve nada).
- La Floating IP está asignada a `web-design-prod` en la consola y configurada en su `eth0` (`ip -4 addr show eth0`).
- 80 y 443 siguen abiertos en el firewall de Hetzner, para IPv4 y para IPv6.
- Existe el bloque en `sites/` y, si es estático, `www/<dominio>/index.html`. Si falta, todavía no se promovió.
- Caddy está arriba (`docker compose ps`). Si el certificado falló, el dominio todavía no resolvía acá: recargá Caddy cuando ya resuelva.

En QA, lo mismo con `<sitio>.qa.example.com`: el `A *.qa` apunta a `<IP-QA>` y existe `www/<sitio>.qa.example.com/index.html` (si no existe, el `ask` niega el certificado).
