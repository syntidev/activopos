# r.ps1 — Reset completo dev + build (ActivoPOS / Windows PowerShell)
# Uso:
#   .\r.ps1          → reinicia dev server (default)
#   .\r.ps1 build    → build limpio de producción
#
# Resuelve el race condition de Windows donde rm -rf .next && npm run build
# falla porque Node no libera los file handles a tiempo.

param([string]$mode = 'dev')

# 1. Matar TODO proceso Node antes de tocar .next
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 800

# 2. Limpiar cache
Remove-Item -Recurse -Force .next  -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .turbo -ErrorAction SilentlyContinue

# 3. Ejecutar modo pedido
if ($mode -eq 'build') {
    Write-Host "▶ Build limpio..." -ForegroundColor Cyan
    npm run build
} else {
    Write-Host "▶ Dev server..." -ForegroundColor Cyan
    npm run dev
}
