# Primeros pasos

Esta guía te lleva de cero a ver el sitio de ejemplo en tu navegador y crear el tuyo. Todo corre en tu máquina: no hace falta servidor, dominio ni cuenta en Hetzner. Publicar en internet es otra etapa, en [`servidores-desde-cero.md`](servidores-desde-cero.md).

Si ya tenés Git y Node 22, esto es todo:

```bash
git clone https://github.com/<tu-usuario>/<tu-repo>.git
cd <tu-repo>/Sitios
npm install
npm run dev -w biblioteca      # abrí http://localhost:5173
```

El resto de la guía son esos mismos pasos explicados: qué tenés que ver en cada uno y qué hacer si algo falla.

## 1. Tu copia del repositorio

No trabajes sobre el repo del curso: hacé tu copia.

1. En la página del repo en GitHub: **Use this template → Create a new repository**.
2. En *Owner*, tu cuenta. El nombre que quieras. Visibilidad: **Private**.
3. **Create repository**.

Una copia hecha desde un template es independiente del repo del curso: tiene su propio historial, le vas a cargar tus propios secretos y servidores, y sigue siendo tuya cuando termina el curso.

Hasta que tengas servidores, apagá GitHub Actions en tu copia: **Settings → Actions → General → Disable actions**. Si no lo apagás, cada push que toca `Sitios/` corre el workflow de Deploy, y falla porque no tiene adónde publicar. Si ves un Deploy en rojo apenas creaste la copia, es eso y no rompiste nada. Lo volvés a prender en la etapa de servidores.

## 2. Instalar las herramientas

| Herramienta | Para qué | Comprobá con |
| ----------- | -------- | ------------ |
| [Git](https://git-scm.com/) | Bajar y subir el código | `git --version` |
| [Node.js 22](https://nodejs.org/) | Correr y buildear los sitios. Trae `npm` | `node -v` → `v22.…` |
| [VS Code](https://code.visualstudio.com/), con la extensión **Svelte for VS Code** (recomendado) | Editar los `.svelte` con colores y autocompletado | |

- **Node 22** es la versión del CI y del servidor. Con otra puede andar, pero si algo raro pasa, probá primero con la 22. Si ya tenés otro Node instalado, un gestor de versiones te deja tener los dos: `nvm` en Mac o Linux, `nvm-windows` en Windows.
- En **Windows**, Git trae **Git Bash**. Para lo local alcanza PowerShell. Para los servidores te va a servir Git Bash.
- Después de instalar, cerrá la terminal y abrí una nueva. Si no, puede no encontrar `node` ni `git`.

### Windows: permitir scripts en PowerShell

En un Windows recién instalado, PowerShell no deja correr scripts, y `npm` es uno. Si ves algo como:

```
No se puede cargar el archivo C:\Program Files\nodejs\npm.ps1 porque la ejecución de scripts está deshabilitada en este sistema.
```

corré esto una vez:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Solo cambia tu usuario, y también habilita `scripts/new-site.ps1`. Si bajaste el repo como ZIP en vez de clonarlo, Windows marca los archivos como descargados y los sigue bloqueando. Cloná con Git.

## 3. Clonar e instalar

```bash
git clone https://github.com/<tu-usuario>/<tu-repo>.git
cd <tu-repo>/Sitios
npm install
```

- Como tu repo es privado, Git te pide iniciar sesión en GitHub. En Windows se abre el navegador. En Mac o Linux, lo más simple es instalar [GitHub CLI](https://cli.github.com/) y correr `gh auth login` una vez.
- `npm install` va **en `Sitios/`**, no adentro de un sitio. Instala todo junto (los sitios, el kit y `general`) con un solo `package-lock.json`. Tiene que terminar con `added … packages`.
- Si al final dice `N vulnerabilities`, no frena nada: ver [Si algo falla](#si-algo-falla).

## 4. Ver el sitio de ejemplo

Desde `Sitios/`:

```bash
npm run dev -w biblioteca
```

Abrí <http://localhost:5173>. Tenés que ver una puerta que dice "Bienvenido". Tocala y entrás a la biblioteca, con el fondo animado. Cuando guardás un archivo, la página se actualiza sola. Para parar el servidor: **Ctrl+C** en la terminal.

`-w biblioteca` elige el *workspace*: el sitio con ese `name` en su `package.json`, que es también el nombre de su carpeta en `clients/`.

Probá:

- Cambiá `hero.title` en `clients/biblioteca/src/lib/data/site.js`, guardá y mirá el navegador.
- `http://localhost:5173/?regulador` abre el panel del fondo, y `?puerta` vuelve a mostrar la puerta.

Hay más ejercicios en [`clients/biblioteca/README.md`](../clients/biblioteca/README.md#para-practicar).

## 5. Build: lo que se publica

```bash
npm run build -w biblioteca
npm run preview -w biblioteca     # http://localhost:4173
```

`build` genera `clients/biblioteca/build/`: HTML, CSS, JS e imágenes. Es exactamente lo que GitHub Actions sube al servidor. `preview` sirve ese build en tu máquina para que lo compruebes. Si `build` falla acá, también falla en GitHub: correlo antes de pushear.

## 6. Tu primer sitio

Primero elegí el *slug*, el nombre del sitio: minúsculas, números y guiones (por ejemplo `mi-marca`). Va a ser el nombre de la carpeta, lo que va en `-w` y el subdominio de QA (`mi-marca.qa.example.com`).

**Windows** (PowerShell, desde `Sitios/`):

```powershell
.\scripts\new-site.ps1 -Slug mi-marca -Brand "Mi Marca"
```

**Mac o Linux** (desde `Sitios/`). El script es de PowerShell, así que hacés a mano lo mismo que hace él: copiar el template, reemplazar los placeholders e instalar.

```bash
cp -r templates/site-static clients/mi-marca
grep -rl -e __SLUG__ -e __BRAND__ clients/mi-marca | xargs perl -pi -e 's/__SLUG__/mi-marca/g; s/__BRAND__/Mi Marca/g'
npm install
```

Después, en los dos casos:

```bash
npm run dev -w mi-marca
```

Si `biblioteca` sigue corriendo, el sitio nuevo arranca en el puerto siguiente (5174). Usá la URL que imprime la terminal.

Qué tocar en `clients/mi-marca/`:

- `src/lib/data/site.js`: textos, menú y links. Las páginas leen todo de acá.
- `src/lib/css/site.css`: colores (en `:root`) y tipografía.
- `static/`: imágenes y favicon.

Más detalle en [`templates/site-static/README.md`](../templates/site-static/README.md).

## 7. La API compartida (opcional)

`general` es un servicio Node que comparten todos los sitios (formularios, webhooks, proxies). Corre en otra terminal, también desde `Sitios/`:

```bash
npm run dev -w general
```

<http://localhost:3100/v1/health> tiene que devolver `{"ok":true,"service":"general",…}`. Para que un sitio en `dev` lo llame, sumale un proxy en su `vite.config.js`: ver [`local.md`](local.md#servicio-general).

## 8. Guardar tus cambios en GitHub

```bash
git add -A
git commit -m "Mi primer sitio"
git push
```

Con Actions apagado, el push solo guarda el código. Cuando tengas servidores y prendas Actions, cada push a `main` que toque un sitio lo publica en QA ([`servidores-desde-cero.md`](servidores-desde-cero.md)).

`node_modules/`, `build/`, `.svelte-kit/` y `.env` no se suben: están en `.gitignore`.

## Si algo falla

| Ves… | Qué pasa | Qué hacer |
| ---- | -------- | --------- |
| `node`, `npm` o `git` no se reconoce como comando | No está instalado, o la terminal se abrió antes de instalar | Instalalo y abrí una terminal nueva |
| `npm.ps1 … la ejecución de scripts está deshabilitada` | La política de scripts de PowerShell | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` ([paso 2](#windows-permitir-scripts-en-powershell)) |
| `npm error code ENOENT` y una ruta que termina en `package.json` | Corriste npm fuera de `Sitios/`, por ejemplo en la raíz del repo | `cd Sitios` |
| `No workspaces found: --workspace=…` | No hay un sitio con ese nombre | Usá el `name` del `package.json` del sitio, que es el nombre de su carpeta en `clients/` |
| `npm warn EBADENGINE` | Tu Node no es el 22 | `node -v` tiene que dar `v22.…` |
| `N vulnerabilities` al terminar `npm install` | Avisos de `npm audit` sobre dependencias de desarrollo | No frena nada. No corras `npm audit fix --force`: sube versiones mayores y puede romper el proyecto |
| El editor marca errores en `$lib`, `$app` o `$env` | Todavía no existe `.svelte-kit/`, que se genera al correr | `npm run dev` o `npm run build` una vez |
| Cambiaste el `.env` y no se nota | Vite lee el `.env` al arrancar | Ctrl+C y volvé a correr `dev` |
| El fondo de la biblioteca no se mueve | El navegador no tiene WebGL, o el sistema tiene activado "reducir movimiento" | Es lo previsto: queda la foto quieta |
| `new-site.ps1` dice `Ya existe clients/<slug>` | Ya hay un sitio con ese nombre | Elegí otro slug |
| El sitio arrancó en otro puerto | El 5173 estaba ocupado | Usá la URL que imprime la terminal |

## Para seguir

- [`local.md`](local.md): todo lo que se puede hacer en local (Analytics, `general`, el kit).
- [`arquitectura.md`](arquitectura.md): cómo encajan las piezas.
- [`glosario.md`](glosario.md): las palabras que aparecen en los docs.
