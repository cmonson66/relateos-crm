$ErrorActionPreference = 'Stop'

if (-not (Test-Path 'package.json')) {
    Write-Host 'ERROR: run from project root.' -ForegroundColor Red
    exit 1
}

Write-Host '-> Killing any running node processes' -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Write-Host '  done' -ForegroundColor Green

Write-Host '-> Removing stale Next cache' -ForegroundColor Cyan
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item node_modules\.cache -Recurse -Force -ErrorAction SilentlyContinue
Write-Host '  done' -ForegroundColor Green

Write-Host '-> Cleaning orphan files in C:\Users\cmons' -ForegroundColor Cyan
Remove-Item C:\Users\cmons\package.json -Force -ErrorAction SilentlyContinue
Remove-Item C:\Users\cmons\package-lock.json -Force -ErrorAction SilentlyContinue
Remove-Item C:\Users\cmons\node_modules -Recurse -Force -ErrorAction SilentlyContinue
Write-Host '  done' -ForegroundColor Green

Write-Host '-> Pinning turbopack root in next.config.ts' -ForegroundColor Cyan
$content = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('aW1wb3J0IHR5cGUgeyBOZXh0Q29uZmlnIH0gZnJvbSAibmV4dCI7CmltcG9ydCBwYXRoIGZyb20gInBhdGgiOwoKY29uc3QgbmV4dENvbmZpZzogTmV4dENvbmZpZyA9IHsKICB0dXJib3BhY2s6IHsKICAgIHJvb3Q6IHBhdGguam9pbihfX2Rpcm5hbWUpLAogIH0sCn07CgpleHBvcnQgZGVmYXVsdCBuZXh0Q29uZmlnOwo='))
$fullPath = Join-Path -Path (Get-Location) -ChildPath 'next.config.ts'
[System.IO.File]::WriteAllText($fullPath, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host '  + next.config.ts' -ForegroundColor Green

Write-Host '-> Verifying tailwindcss is in node_modules' -ForegroundColor Cyan
if (Test-Path 'node_modules/tailwindcss') {
    Write-Host '  + tailwindcss found' -ForegroundColor Green
} else {
    Write-Host '  ! tailwindcss missing - reinstalling' -ForegroundColor Yellow
    npm install
}

Write-Host ''
Write-Host '====================================' -ForegroundColor Green
Write-Host '  Stabilized' -ForegroundColor Green
Write-Host '====================================' -ForegroundColor Green
Write-Host ''
Write-Host 'Now run: npm run dev' -ForegroundColor Cyan
