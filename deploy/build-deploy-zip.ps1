param(
    [string]$OutputPath = "deploy/sisdmk2-casaos-deploy.zip"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$tempBase = Join-Path ([System.IO.Path]::GetTempPath()) "sisdmk2-casaos-deploy"
$stagingRoot = Join-Path $tempBase ([Guid]::NewGuid().ToString("N"))
$packageRoot = Join-Path $stagingRoot "sisdmk2-casaos-deploy"
$resolvedOutput = Join-Path $repoRoot $OutputPath
$tempOutput = Join-Path $repoRoot ("deploy/sisdmk2-casaos-deploy-" + [Guid]::NewGuid().ToString("N") + ".zip")
$archiveOutput = $resolvedOutput

New-Item -ItemType Directory -Path $tempBase -Force | Out-Null

function Copy-Tree {
    param(
        [string]$Source,
        [string]$Destination
    )

    $null = New-Item -ItemType Directory -Path $Destination -Force
    $null = robocopy $Source $Destination /E /XD node_modules .next .git
    if ($LASTEXITCODE -gt 7) {
        throw "Robocopy failed for $Source with exit code $LASTEXITCODE"
    }
}

New-Item -ItemType Directory -Path $packageRoot | Out-Null

if (Test-Path $resolvedOutput) {
    try {
        Remove-Item -LiteralPath $resolvedOutput -Force
    } catch {
        $archiveOutput = $tempOutput
        Write-Warning "Zip target utama sedang dipakai. Paket baru akan dibuat di: $archiveOutput"
    }
}

Copy-Tree -Source (Join-Path $repoRoot "backend") -Destination (Join-Path $packageRoot "backend")
Copy-Tree -Source (Join-Path $repoRoot "frontend") -Destination (Join-Path $packageRoot "frontend")
Copy-Tree -Source (Join-Path $repoRoot "docs") -Destination (Join-Path $packageRoot "docs")

Copy-Item -LiteralPath (Join-Path $repoRoot "docker-compose.yml") -Destination (Join-Path $packageRoot "docker-compose.yml") -Force
Copy-Item -LiteralPath (Join-Path $repoRoot "README.md") -Destination (Join-Path $packageRoot "README.md") -Force
Copy-Item -LiteralPath (Join-Path $repoRoot ".env.casaos.example") -Destination (Join-Path $packageRoot ".env.casaos.example") -Force

Compress-Archive -Path (Join-Path $packageRoot "*") -DestinationPath $archiveOutput -CompressionLevel Optimal

try {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force
} catch {
    Write-Warning "Temporary staging folder tidak bisa dihapus otomatis: $stagingRoot"
}

Write-Host "Deploy package created at $archiveOutput"
