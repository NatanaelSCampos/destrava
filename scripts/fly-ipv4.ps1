$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$proxyFile = Join-Path $PSScriptRoot 'fly-ipv4-proxy.cjs'
$fly = Join-Path $env:USERPROFILE '.fly\bin\flyctl.exe'

if (-not (Test-Path -LiteralPath $proxyFile)) { throw 'Proxy IPv4 não encontrado.' }
if (-not (Test-Path -LiteralPath $fly)) {
  $fly = (Get-Command flyctl -ErrorAction Stop).Source
}
$node = (Get-Command node -ErrorAction Stop).Source
$previousHttpProxy = $env:HTTP_PROXY
$previousHttpsProxy = $env:HTTPS_PROXY
$proxy = Start-Process -FilePath $node -ArgumentList $proxyFile -WorkingDirectory $workspace -WindowStyle Hidden -PassThru

try {
  Start-Sleep -Milliseconds 400
  if ($proxy.HasExited) { throw 'O proxy IPv4 não iniciou; confira se a porta 18765 está livre.' }
  $env:HTTP_PROXY = 'http://127.0.0.1:18765'
  $env:HTTPS_PROXY = 'http://127.0.0.1:18765'
  & $fly @args
  if ($LASTEXITCODE -ne 0) { throw "O flyctl falhou (código $LASTEXITCODE)." }
} finally {
  if ($null -eq $previousHttpProxy) { Remove-Item Env:HTTP_PROXY -ErrorAction SilentlyContinue }
  else { $env:HTTP_PROXY = $previousHttpProxy }
  if ($null -eq $previousHttpsProxy) { Remove-Item Env:HTTPS_PROXY -ErrorAction SilentlyContinue }
  else { $env:HTTPS_PROXY = $previousHttpsProxy }
  if (-not $proxy.HasExited) {
    $proxy.Kill()
    $proxy.WaitForExit(5000) | Out-Null
  }
}
