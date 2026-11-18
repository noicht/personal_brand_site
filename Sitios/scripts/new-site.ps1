<#
.SYNOPSIS
  Crea un cliente estático desde templates/site-static.

.EXAMPLE
  .\scripts\new-site.ps1 -Slug mi-marca -Brand "Mi Marca"
#>
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-z0-9]+(-[a-z0-9]+)*$')]
  [string]$Slug,

  [Parameter(Mandatory = $false)]
  [string]$Brand
)

$ErrorActionPreference = "Stop"

$SitiosRoot = Split-Path -Parent $PSScriptRoot
$Template = Join-Path $SitiosRoot "templates\site-static"
$Dest = Join-Path $SitiosRoot "clients\$Slug"

if (-not $Brand) { $Brand = $Slug }

if (-not (Test-Path $Template)) {
  throw "No existe el template: $Template"
}
if (Test-Path $Dest) {
  throw "Ya existe clients/$Slug"
}

Write-Host "Copiando template → clients/$Slug ..."
Copy-Item -Recurse $Template $Dest

# Placeholders. Se lee y se escribe en UTF-8 (sin BOM) a mano: en Windows PowerShell 5.1,
# Get-Content y Set-Content usan ANSI por defecto y una marca con tilde quedaría rota.
$Utf8 = New-Object System.Text.UTF8Encoding $false
Get-ChildItem -Path $Dest -Recurse -File | ForEach-Object {
  $text = Get-Content -Raw -Encoding UTF8 -LiteralPath $_.FullName -ErrorAction SilentlyContinue
  if ($null -eq $text) { return }
  if ($text -notmatch '__SLUG__|__BRAND__') { return }
  $updated = $text.Replace('__SLUG__', $Slug).Replace('__BRAND__', $Brand)
  [System.IO.File]::WriteAllText($_.FullName, $updated, $Utf8)
}

Write-Host "npm install (workspaces)..."
Push-Location $SitiosRoot
try {
  npm install
} finally {
  Pop-Location
}

Write-Host @"

Listo: clients/$Slug

Siguiente:
  1. Editá src/lib/data/site.js y src/lib/css/site.css
  2. npm run dev -w $Slug
  3. Push a main → QA en https://$Slug.qa.example.com (el dominio de QA que configuraste)
  4. Producción: site.json → { "domain": "tu-dominio.com" }, infra/sites/<dominio>.caddy y DNS
     (CNAME a tu origen, ej. web.example.net); después Actions → Promover a producción
     (ver docs/hetzner.md y docs/github-actions.md)

"@
