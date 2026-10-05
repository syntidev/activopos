# r.ps1 — Reset completo dev + build (ActivoPOS / Windows PowerShell)
# Uso:
#   .\r.ps1          → reinicia dev server (default)
#   .\r.ps1 build    → build limpio de producción
#
# Resuelve el race condition de Windows donde rm -rf .next && npm run build
# falla porque Node no libera los file handles a tiempo.

param([string]$mode = 'dev')

# 1. Matar SOLO los procesos Node de ESTA carpeta antes de tocar .next.
#    Antes mataba todos los de la máquina y tumbaba los dev servers y MCP de las
#    otras CLIs. Se reconoce por la ruta de la carpeta en la línea de comando
#    (next, node_modules\...); el "\" final evita que "activopos" coincida con
#    "activopos-b" / "activopos-c".
# ponytail: solo por línea de comando -- un node con cwd aquí pero sin la ruta en
#    su comando (el "npm run dev" padre) no se mata; cae solo al morir su hijo next.
$root = ((Get-Location).Path.TrimEnd('\') + '\').ToLower()
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -and $_.CommandLine.ToLower().Replace('/', '\').Contains($root) } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
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
