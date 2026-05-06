$ErrorActionPreference = 'Stop'

if (-not (Test-Path 'package.json')) {
    Write-Host 'ERROR: run from project root.' -ForegroundColor Red
    exit 1
}

# 1. Remove orphan package.json from C:\Users\cmons
Write-Host '-> Removing orphan package.json from home dir' -ForegroundColor Cyan
Remove-Item C:\Users\cmons\package.json -Force -ErrorAction SilentlyContinue
Write-Host '  + done' -ForegroundColor Green

# 2. Patch proxy.ts to export `proxy` function (Next 16 convention)
Write-Host '-> Fixing proxy.ts function export' -ForegroundColor Cyan
$content = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('aW1wb3J0IHsgdXBkYXRlU2Vzc2lvbiB9IGZyb20gJ0AvbGliL3N1cGFiYXNlL21pZGRsZXdhcmUnOwppbXBvcnQgdHlwZSB7IE5leHRSZXF1ZXN0IH0gZnJvbSAnbmV4dC9zZXJ2ZXInOwoKZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHByb3h5KHJlcXVlc3Q6IE5leHRSZXF1ZXN0KSB7CiAgcmV0dXJuIGF3YWl0IHVwZGF0ZVNlc3Npb24ocmVxdWVzdCk7Cn0KCmV4cG9ydCBjb25zdCBjb25maWcgPSB7CiAgbWF0Y2hlcjogWwogICAgJy8oKD8hX25leHQvc3RhdGljfF9uZXh0L2ltYWdlfGZhdmljb24uaWNvfC4qXFwuKD86c3ZnfHBuZ3xqcGd8anBlZ3xnaWZ8d2VicCkkKS4qKScsCiAgXSwKfTsK'))
$fullPath = Join-Path -Path (Get-Location) -ChildPath 'proxy.ts'
[System.IO.File]::WriteAllText($fullPath, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host '  + proxy.ts' -ForegroundColor Green

Write-Host ''
Write-Host '====================================' -ForegroundColor Green
Write-Host '  Fixes applied' -ForegroundColor Green
Write-Host '====================================' -ForegroundColor Green
Write-Host 'Restart dev server: npm run dev' -ForegroundColor Cyan
