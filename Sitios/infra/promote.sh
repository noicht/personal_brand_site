#!/usr/bin/env bash
# Producción de un sitio estático: publica lo que vino de QA, o vuelve a la versión anterior.
# Corre en el servidor de producción. Lo manda .github/workflows/promote.yml por ssh:
#   ssh web-infra@<ip-prod> bash -s -- <accion> <host-qa> <dominio> < promote.sh
#
#   promover  pone incoming/<host-qa>/ en www/<dominio>/ tal cual, sin rebuild: sale lo que se vio
#             en QA. QA está en otro servidor: promote.yml copia su build a incoming/ antes.
#   volver    intercambia www/<dominio>/ con la versión anterior. Correrlo otra vez lo deshace
#
# Fuera de www/, así Caddy no los sirve:
#   incoming/<host-qa>/          el build de QA recién copiado (lo consume promover)
#   incoming/<host-qa>.version   su commit y fecha
#   versions/<dominio>           commit y fecha de lo publicado en producción
#   prev/<dominio>/              la versión anterior de producción
#   prev/<dominio>.version       su commit y fecha
#
# WEB_BASE reemplaza /opt/web (para probarlo en otra carpeta).
set -euo pipefail

accion="${1:-}"
qa="${2:-}"
domain="${3:-}"
base="${WEB_BASE:-/opt/web}"
www="$base/www"
prev="$base/prev"
versions="$base/versions"
incoming="$base/incoming"

fail() {
  echo "::error::$*"
  exit 1
}

# Un host: etiquetas [a-z0-9-] separadas por puntos, al menos dos. Así un valor vacío, con / o
# con .. nunca llega a los rm -rf de abajo.
HOST_RE='^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'

# Publicado = tiene index.html. Una carpeta vacía no cuenta.
has_site() {
  [ -f "$1/index.html" ]
}

version_of() {
  if [ -s "$1" ]; then cat "$1"; else echo "sin datos"; fi
}

case "$accion" in
  promover | volver) ;;
  *) fail "Acción desconocida: '$accion' (promover | volver)." ;;
esac
[[ $qa =~ $HOST_RE ]] || fail "Host de QA inválido: '$qa'."
[[ $domain =~ $HOST_RE ]] || fail "Dominio inválido: '$domain'."
[ "$qa" != "$domain" ] || fail "El dominio de producción no puede ser el de QA."

mkdir -p "$www" "$prev" "$versions"
live="$www/$domain"
old="$prev/$domain"

if [ "$accion" = promover ]; then
  src="$incoming/$qa"
  has_site "$src" || fail "No llegó el build de QA ($qa) a $src."
  v_qa=$(cat "$src.version" 2>/dev/null || true)

  tmp="$prev/.$domain.nuevo"
  rm -rf "$tmp"
  mv "$src" "$tmp"
  rm -f "$src.version"

  if has_site "$live"; then
    rm -rf "$old" "$old.version"
    mv "$live" "$old"
    if [ -f "$versions/$domain" ]; then mv "$versions/$domain" "$old.version"; fi
  else
    # Vacía o rota: no se guarda como anterior
    rm -rf "$live"
  fi
  mv "$tmp" "$live"
  if [ -n "$v_qa" ]; then printf '%s\n' "$v_qa" >"$versions/$domain"; else rm -f "$versions/$domain"; fi
else
  has_site "$old" || fail "No hay versión anterior de $domain."
  swap="$prev/.$domain.swap"
  rm -rf "$swap" "$swap.version"
  if [ -e "$live" ]; then mv "$live" "$swap"; fi
  mv "$old" "$live"
  if [ -e "$swap" ]; then mv "$swap" "$old"; fi
  # La versión se intercambia igual
  if [ -f "$versions/$domain" ]; then mv "$versions/$domain" "$swap.version"; fi
  if [ -f "$old.version" ]; then mv "$old.version" "$versions/$domain"; fi
  if [ -f "$swap.version" ]; then mv "$swap.version" "$old.version"; fi
fi

# Resumen (el workflow lo pone en la página del run)
echo "### $domain"
echo ""
echo "- Producción: $(version_of "$versions/$domain")"
if has_site "$old"; then
  echo "- Anterior (la que deja \`volver\`): $(version_of "$old.version")"
else
  echo "- Anterior: no hay"
fi
