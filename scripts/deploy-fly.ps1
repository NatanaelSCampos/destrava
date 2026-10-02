param(
  [string]$App = 'frecuencias-a1-natanael'
)

$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $workspace '.env.local'

if (-not (Test-Path -LiteralPath $envFile)) { throw '.env.local não encontrado.' }
$lines = Get-Content -LiteralPath $envFile

function Read-PublicSetting([string]$name) {
  foreach ($line in $lines) {
    if ($line.StartsWith("$name=")) {
      return $line.Substring($name.Length + 1).Trim('"', "'")
    }
  }
  throw "Configuração pública ausente: $name"
}

$url = Read-PublicSetting 'NEXT_PUBLIC_SUPABASE_URL'
$key = Read-PublicSetting 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
if (-not $url -or -not $key) { throw 'Configurações públicas do Supabase vazias.' }

& (Join-Path $PSScriptRoot 'fly-ipv4.ps1') deploy --remote-only --ha=false --app $App --build-arg "NEXT_PUBLIC_SUPABASE_URL=$url" --build-arg "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$key"
