$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ExePath = Join-Path $Root "pocketbase\pocketbase.exe"

if (-not (Test-Path $ExePath)) {
  Write-Host "PocketBase not found. Run: npm run setup:pocketbase"
  exit 1
}

Set-Location (Join-Path $Root "pocketbase")
Write-Host "Starting PocketBase at http://127.0.0.1:8090"
Write-Host "Admin panel: http://127.0.0.1:8090/_/"
& $ExePath serve --http=127.0.0.1:8090
