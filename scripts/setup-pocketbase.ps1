$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$PocketBaseDir = Join-Path $Root "pocketbase"
$ZipPath = Join-Path $PocketBaseDir "pocketbase.zip"
$ExePath = Join-Path $PocketBaseDir "pocketbase.exe"
$Version = "0.25.9"
$DownloadUrl = "https://github.com/pocketbase/pocketbase/releases/download/v$Version/pocketbase_${Version}_windows_amd64.zip"

New-Item -ItemType Directory -Path $PocketBaseDir -Force | Out-Null

if (Test-Path $ExePath) {
  Write-Host "PocketBase already installed at $ExePath"
  exit 0
}

Write-Host "Downloading PocketBase v$Version..."
Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath

Write-Host "Extracting..."
Expand-Archive -Path $ZipPath -DestinationPath $PocketBaseDir -Force
Remove-Item $ZipPath

Write-Host ""
Write-Host "Done. Run: npm run pocketbase"
Write-Host "Admin UI: http://127.0.0.1:8090/_/"
Write-Host "API:      http://127.0.0.1:8090"
