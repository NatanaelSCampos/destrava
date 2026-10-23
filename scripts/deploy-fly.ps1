param(
  [string]$ReleaseProfile,
  [string]$ExpectedApp,
  [string]$ExpectedSupabaseProject,
  [string]$ExpectedOrigin,
  [string]$ExpectedSha,
  [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$workspace = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))

# Explicit JSON production identity only; never load .env.local as a fallback.
try {
  if ($args.Count -ne 0) { throw 'Unexpected release arguments.' }
  foreach ($value in @($ReleaseProfile, $ExpectedApp, $ExpectedSupabaseProject, $ExpectedOrigin, $ExpectedSha)) {
    if ([string]::IsNullOrWhiteSpace($value)) { throw 'Missing explicit release identity.' }
  }
  if ((Test-Path Env:NODE_OPTIONS) -or (Test-Path Env:NODE_PATH)) { throw 'Node overrides are forbidden.' }
  $node = (Get-Command node -CommandType Application -ErrorAction Stop).Source
  $guard = Join-Path $PSScriptRoot 'release-guards/deployment-plan.mjs'
  $output = & $node $guard $ReleaseProfile $workspace $ExpectedApp $ExpectedSupabaseProject $ExpectedOrigin $ExpectedSha 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $output) { throw 'Release preflight failed.' }
  $plan = ($output -join "`n") | ConvertFrom-Json
  if ($plan.commit -ne $ExpectedSha -or $plan.app -ne $ExpectedApp) { throw 'Release identity changed.' }
} catch {
  throw 'Release configuration rejected before Fly; configuration values suppressed.'
}

if ($ValidateOnly) {
  # Omit the public key from the diagnostic/manifest summary.
  [ordered]@{
    phase = $plan.phase
    commit = $plan.commit
    tree = $plan.tree
    app = $plan.app
    origin = $plan.origin
    supabaseProject = $plan.supabaseProject
    files = $plan.files
    migrations = $plan.migrations
    runtimeSecretsVerified = $false
    imageDigest = $null
    courseVersion = $null
  } | ConvertTo-Json -Depth 6
  return
}

$flyArgs = @('deploy', $workspace, '--config', (Join-Path $workspace 'fly.toml'),
  '--dockerfile', (Join-Path $workspace 'Dockerfile'), '--remote-only', '--ha=false', '--app', $plan.app)
foreach ($property in $plan.buildArgs.PSObject.Properties) {
  $flyArgs += @('--build-arg', ($property.Name + '=' + $property.Value))
}

# Preserve IPv4 transport and fix both the caller directory and build context.
Push-Location -LiteralPath $workspace
try {
  # External tools may include sensitive context in either stream. Do not echo them.
  $null = & (Join-Path $PSScriptRoot 'fly-ipv4.ps1') @flyArgs 2>&1
  if ($LASTEXITCODE -ne 0) { throw 'Fly build/deploy failed.' }
  Write-Output 'Fly command completed for the validated release identity.'
} catch {
  throw 'Fly build/deploy did not complete; no automatic retry or rollback was attempted.'
} finally {
  Pop-Location
}
