# Downloads the latest official PocketBase release (Windows amd64) into pocketbase/.
# Idempotent: exits early if pocketbase\pocketbase.exe already exists.
$ErrorActionPreference = "Stop"

$Root          = Split-Path -Parent $PSScriptRoot
$PocketBaseDir = Join-Path $Root "pocketbase"
$ExePath       = Join-Path $PocketBaseDir "pocketbase.exe"
$ZipPath       = Join-Path $PocketBaseDir "pocketbase.zip"

New-Item -ItemType Directory -Path $PocketBaseDir -Force | Out-Null

if (Test-Path $ExePath) {
  Write-Host "PocketBase already installed at $ExePath"
  exit 0
}

Write-Host "Fetching the latest PocketBase release info from GitHub..."

$Headers  = @{ "User-Agent" = "cohorta-setup" }
$Release  = Invoke-RestMethod -Uri "https://api.github.com/repos/pocketbase/pocketbase/releases/latest" -Headers $Headers
$Version  = $Release.tag_name.TrimStart("v")   # e.g. "0.39.11"
$DownloadUrl = "https://github.com/pocketbase/pocketbase/releases/download/v$Version/pocketbase_${Version}_windows_amd64.zip"

Write-Host "Downloading $DownloadUrl ..."
Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath

Write-Host "Extracting..."
Expand-Archive -Path $ZipPath -DestinationPath $PocketBaseDir -Force
Remove-Item $ZipPath

Write-Host ""
Write-Host "PocketBase $Version installed."
Write-Host "Run: npm run pocketbase"
Write-Host "Admin UI: http://127.0.0.1:8090/_/"
Write-Host "API:      http://127.0.0.1:8090"