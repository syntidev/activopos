# ============================================================
# dev-reset.ps1 — ActivoPOS Dev Cache Reset
# SYNTIdev | Para uso de CLIs y Carlos
# Uso: .\dev-reset.ps1
# Uso silencioso (para CLIs): .\dev-reset.ps1 -Silent
# ============================================================

param(
    [switch]$Silent = $false
)

$PROJECT_PATH = "C:\laragon\www\activopos"
$BANNER = @"

  ╔═══════════════════════════════════════╗
  ║   ActivoPOS — Dev Reset               ║
  ║   SYNTIdev | Cache Cleaner v1.0       ║
  ╚═══════════════════════════════════════╝

"@

# ── FUNCIONES ──────────────────────────────────────────────

function Write-Step {
    param([string]$Icon, [string]$Message, [string]$Color = "Cyan")
    if (-not $Silent) {
        Write-Host "  $Icon  $Message" -ForegroundColor $Color
    }
}

function Write-Success {
    param([string]$Message)
    Write-Host "  ✅  $Message" -ForegroundColor Green
}

function Write-Fail {
    param([string]$Message)
    Write-Host "  ❌  $Message" -ForegroundColor Red
}

# ── INICIO ─────────────────────────────────────────────────

if (-not $Silent) {
    Write-Host $BANNER -ForegroundColor Blue
}

# 1. Verificar ruta del proyecto
if (-not (Test-Path $PROJECT_PATH)) {
    Write-Fail "Ruta no encontrada: $PROJECT_PATH"
    Write-Host "  Edita PROJECT_PATH en este script si el directorio cambió." -ForegroundColor Yellow
    exit 1
}

Set-Location $PROJECT_PATH
Write-Step "📁" "Directorio: $PROJECT_PATH"

# 2. Matar proceso Node.js en puerto 3000 si está corriendo
Write-Step "🔍" "Buscando proceso en puerto 3000..."

$nodeProcess = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -ErrorAction SilentlyContinue

if ($nodeProcess) {
    try {
        Stop-Process -Id $nodeProcess -Force -ErrorAction Stop
        Write-Success "Proceso Node.js detenido (PID: $nodeProcess)"
        Start-Sleep -Milliseconds 800
    } catch {
        Write-Step "⚠️" "No se pudo detener el proceso — puede que ya esté cerrado" "Yellow"
    }
} else {
    Write-Step "💤" "No había servidor corriendo en puerto 3000" "Gray"
}

# 3. Limpiar .next
Write-Step "🧹" "Limpiando cache .next..."

if (Test-Path ".next") {
    try {
        Remove-Item -Recurse -Force ".next" -ErrorAction Stop
        Write-Success "Cache .next eliminado"
    } catch {
        Write-Fail "No se pudo eliminar .next: $_"
        Write-Host "  Intenta cerrar VS Code o el terminal que lo bloquea." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Step "✨" "No había cache .next — ya estaba limpio" "Gray"
}

# 4. Limpiar node_modules/.cache si existe (Turbopack / Webpack)
if (Test-Path "node_modules\.cache") {
    Write-Step "🧹" "Limpiando node_modules/.cache..."
    Remove-Item -Recurse -Force "node_modules\.cache" -ErrorAction SilentlyContinue
    Write-Success "node_modules/.cache eliminado"
}

# 5. Verificar que node_modules existe
if (-not (Test-Path "node_modules")) {
    Write-Step "📦" "node_modules no encontrado — corriendo npm install..." "Yellow"
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "npm install falló"
        exit 1
    }
    Write-Success "Dependencias instaladas"
}

# 6. Verificar .env.local
if (-not (Test-Path ".env.local") -and -not (Test-Path ".env")) {
    Write-Step "⚠️" "No se encontró .env.local ni .env — verifica las variables de entorno" "Yellow"
}

# 7. Arrancar servidor
Write-Step "🚀" "Iniciando npm run dev..." "Cyan"

if (-not $Silent) {
    Write-Host ""
    Write-Host "  ─────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "  Servidor arrancando en http://localhost:3000" -ForegroundColor White
    Write-Host "  Presiona Ctrl+C para detener" -ForegroundColor DarkGray
    Write-Host "  ─────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host ""
}

npm run dev
