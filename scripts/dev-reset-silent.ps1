# ============================================================
# dev-reset-silent.ps1 — Para uso exclusivo de CLIs
# No muestra banners. Mata proceso, limpia cache, arranca dev.
# Los CLIs lo llaman así:
#   powershell -ExecutionPolicy Bypass -File "scripts\dev-reset-silent.ps1"
# ============================================================

$PROJECT_PATH = "C:\laragon\www\activopos"

Set-Location $PROJECT_PATH -ErrorAction Stop

# Matar proceso en puerto 3000
$proc = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -ErrorAction SilentlyContinue
if ($proc) {
    Stop-Process -Id $proc -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 600
}

# Limpiar cache
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next" -ErrorAction Stop
}
if (Test-Path "node_modules\.cache") {
    Remove-Item -Recurse -Force "node_modules\.cache" -ErrorAction SilentlyContinue
}

Write-Output "Cache limpio. Iniciando servidor..."

npm run dev
