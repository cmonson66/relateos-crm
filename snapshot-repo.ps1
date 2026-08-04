<#
    snapshot-repo.ps1
    Packages a repo for upload: source only, no node_modules, no build output,
    no git history, and no .env files of any kind.

    Uses System.IO for every file operation. Copy-Item, New-Item and
    Compress-Archive all treat [ and ] as wildcards, which silently mangles
    Next.js route folders like app\dashboard\[slug]\page.tsx. .NET methods
    take paths literally, so bracket routes survive.

    Usage:
        .\snapshot-repo.ps1
        .\snapshot-repo.ps1 -Repo C:\Users\cmons\dev\nectarpay-scraper
#>

param(
    [string]$Repo   = "C:\Users\cmons\dev\protoseq-crm",
    [string]$OutDir = "$HOME\Downloads"
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (-not [System.IO.Directory]::Exists($Repo)) { throw "Repo not found: $Repo" }

$Repo  = [System.IO.Path]::GetFullPath($Repo).TrimEnd('\')
$name  = [System.IO.Path]::GetFileName($Repo)
$stage = [System.IO.Path]::Combine($env:TEMP, "$name-snapshot")
$zip   = [System.IO.Path]::Combine($OutDir, "$name-snapshot.zip")

# Directories that never need to travel
$excludeRx = '(^|\\)(node_modules|\.next|\.git|\.vercel|\.turbo|dist|build|coverage|out|\.cache)(\\|$)'

# Files that must never travel: secrets, junk, bulk data
$badNames = @('.env', '.env.*', '*.pem', '*.key', '*.pfx')
$badExt   = @('.zip', '.log', '.csv', '.sqlite', '.db', '.mp4', '.mov')

Write-Host "`nSnapshotting $name" -ForegroundColor Cyan

if ([System.IO.Directory]::Exists($stage)) { [System.IO.Directory]::Delete($stage, $true) }
if ([System.IO.File]::Exists($zip))        { [System.IO.File]::Delete($zip) }

# Enumerate with .NET too -- Get-ChildItem -Recurse also wildcard-expands
$all = [System.IO.Directory]::EnumerateFiles($Repo, '*', [System.IO.SearchOption]::AllDirectories)

$copied = 0
$skipped = 0

foreach ($full in $all) {
    $rel  = $full.Substring($Repo.Length + 1)
    $leaf = [System.IO.Path]::GetFileName($full)
    $ext  = [System.IO.Path]::GetExtension($full).ToLower()

    if ($rel -match $excludeRx)      { $skipped++; continue }
    if ($badExt -contains $ext)      { $skipped++; continue }

    $bad = $false
    foreach ($p in $badNames) { if ($leaf -like $p) { $bad = $true } }
    if ($bad) { $skipped++; continue }

    $dest = [System.IO.Path]::Combine($stage, $rel)
    [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($dest)) | Out-Null
    [System.IO.File]::Copy($full, $dest, $true)
    $copied++
}

[System.IO.Compression.ZipFile]::CreateFromDirectory($stage, $zip)
[System.IO.Directory]::Delete($stage, $true)

$mb = [math]::Round((New-Object System.IO.FileInfo($zip)).Length / 1MB, 2)
Write-Host "`n$copied files copied, $skipped skipped" -ForegroundColor Gray
Write-Host "$zip  ($mb MB)" -ForegroundColor Green

# Prove nothing sensitive is inside the finished archive
Write-Host "`nSecret check (reading the zip itself):" -ForegroundColor Yellow
$archive = [System.IO.Compression.ZipFile]::OpenRead($zip)
$leaked = $archive.Entries | Where-Object {
    $_.Name -like '.env*' -or $_.Name -like '*.pem' -or $_.Name -like '*.key'
}
$brackets = ($archive.Entries | Where-Object { $_.FullName -like '*`[*' }).Count
$archive.Dispose()

if ($leaked) { $leaked | ForEach-Object { Write-Host "  LEAK: $($_.FullName)" -ForegroundColor Red } }
else         { Write-Host "  clean - no .env, .pem or .key files in the archive" -ForegroundColor Green }
Write-Host "  bracket-route files preserved: $brackets" -ForegroundColor Gray
