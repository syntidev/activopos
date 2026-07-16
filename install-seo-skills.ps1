# ============================================================
# ACTIVOPOS — SEO Skills Installer
# Instala: AgriciDaniel/claude-seo en Claude Code CLI
# Genera:  activopos-seo-context.md  (contexto de negocio)
#          llms.txt                   (para activopos.com)
# Ejecutar desde: C:\laragon\www\activopos
# PowerShell 7+ recomendado
# ============================================================

param(
    [switch]$SkipPlugin,
    [switch]$SkipContext,
    [switch]$SkipLlmsTxt
)

$ErrorActionPreference = "Stop"
$ROOT = "C:\laragon\www\activopos"
$CLAUDE_DIR = "$env:USERPROFILE\.claude"
$SKILLS_DIR = "$CLAUDE_DIR\skills"
$PLUGINS_DIR = "$CLAUDE_DIR\plugins"

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  ActivoPOS — SEO Skills Installer" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. VERIFICAR PREREQUISITOS ──────────────────────────────
Write-Host "[1/4] Verificando prerequisitos..." -ForegroundColor Yellow

if (-not (Test-Path $ROOT)) {
    Write-Error "No se encontro el repo en $ROOT. Ejecuta desde el directorio correcto."
    exit 1
}

$claudeVersion = claude --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Claude Code CLI no encontrado. Instala con: npm install -g @anthropic-ai/claude-code"
    exit 1
}
Write-Host "   Claude Code: $claudeVersion" -ForegroundColor Green

# ── 2. INSTALAR PLUGIN claude-seo ───────────────────────────
if (-not $SkipPlugin) {
    Write-Host ""
    Write-Host "[2/4] Instalando plugin AgriciDaniel/claude-seo..." -ForegroundColor Yellow

    # Metodo 1: via plugin marketplace (Claude Code >= 1.x)
    $pluginResult = claude plugin install AgriciDaniel/claude-seo 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   Plugin instalado via marketplace." -ForegroundColor Green
    } else {
        Write-Host "   Marketplace fallo. Intentando via npx skills..." -ForegroundColor DarkYellow
        npx skills add AgriciDaniel/claude-seo 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "   npx skills fallo. Clonando manualmente..." -ForegroundColor DarkYellow

            if (-not (Test-Path $PLUGINS_DIR)) {
                New-Item -ItemType Directory -Path $PLUGINS_DIR -Force | Out-Null
            }

            $pluginPath = "$PLUGINS_DIR\claude-seo"
            if (Test-Path $pluginPath) {
                Write-Host "   Plugin ya existe en $pluginPath. Actualizando..." -ForegroundColor DarkYellow
                Set-Location $pluginPath
                git pull origin main 2>&1
                Set-Location $ROOT
            } else {
                git clone https://github.com/AgriciDaniel/claude-seo.git $pluginPath 2>&1
            }

            if (Test-Path "$pluginPath\SKILL.md") {
                Write-Host "   Plugin clonado en $pluginPath" -ForegroundColor Green
            } else {
                Write-Host "   ADVERTENCIA: No se encontro SKILL.md. Verifica $pluginPath" -ForegroundColor Red
            }
        }
    }
} else {
    Write-Host "[2/4] Plugin omitido (-SkipPlugin)" -ForegroundColor DarkGray
}

# ── 3. GENERAR activopos-seo-context.md ─────────────────────
if (-not $SkipContext) {
    Write-Host ""
    Write-Host "[3/4] Generando contexto de negocio para Claude Project..." -ForegroundColor Yellow

    $contextPath = "$ROOT\public\seo\activopos-seo-context.md"
    $contextDir = Split-Path $contextPath
    if (-not (Test-Path $contextDir)) {
        New-Item -ItemType Directory -Path $contextDir -Force | Out-Null
    }

$contextContent = @'
---
name: activopos-seo-context
description: >
  Contexto completo de negocio de ActivoPOS para todas las tareas SEO.
  Cargar SIEMPRE antes de ejecutar cualquier skill de auditoria, diagnostico,
  contenido o AI visibility. Este archivo es el briefing maestro.
---

# ActivoPOS — Briefing SEO Maestro

## Identidad del producto

**Nombre:** ActivoPOS
**URL:** https://activopos.com
**Tagline sellado:** "ActivoPOS es tu sistema de control de ventas e inventario. No reemplaza tu facturación SENIAT — la complementa."
**Empresa:** SYNTIdev
**Fundador:** Carlos Bolívar

## Qué es ActivoPOS

Sistema POS SaaS multi-tenant construido nativamente para PYMEs venezolanas.
Cubre: punto de venta, inventario, catálogo digital público, reportes financieros,
gestión de clientes y cierre contable diario.

**NO es:**
- Un sistema de facturación fiscal SENIAT (nunca afirmar esto)
- Un procesador de pagos (el sistema transporta datos de pago, no los procesa)

## Stack técnico (relevante para SEO técnico)

- Next.js 14 — SSR/SSG, rutas dinámicas
- TypeScript strict
- MariaDB + Prisma 7
- VPS propio: 187.124.241.213, puerto 3003, PM2 cluster
- Nginx como proxy reverso
- Dominio principal: activopos.com

## Mercado objetivo

**Primario:** PYMEs venezolanas — bodegas, boutiques, cafés, carnicerías,
restaurantes, farmacias, ferreterías, tiendas de electrónica, licorerías,
papelerías.
**Idioma:** Español venezolano (tuteo — "tú", nunca "vos")
**Ubicación geográfica:** Venezuela (Caracas, Maracaibo, Valencia, Barquisimeto)
**Segmento económico:** B2H (Business-to-Human) — dueños de negocio, no IT

## Propuesta de valor por segmento

| Segmento | Dolor principal | ActivoPOS resuelve |
|---|---|---|
| Bodega | No sabe qué productos se están agotando | Control de stock en tiempo real |
| Boutique | No puede vender online sin página web | Catálogo digital con WhatsApp |
| Restaurante | No sabe qué platos generan más utilidad | Reporte de utilidad por producto |
| Carnicería | Precio del dólar cambia cada día | Precios en USD + Bs simultáneos |
| Farmacia | Productos vencidos sin control | Alertas de stock mínimo |

## Planes de precios

| Plan | Precio mensual | Perfil |
|---|---|---|
| Mostrador | $9/mes | Negocio chico, 1 usuario |
| Negocio | $19/mes | PYME mediana, múltiples usuarios |
| Pro | $29/mes | Restaurantes, cocina KDS, catálogo |

Ciclos: Mensual / Semestral (20% OFF) / Anual (30% OFF)

## Contexto financiero venezolano (crítico para SEO local)

- Precios duales: USD + Bolívares simultáneos siempre
- Tasa BCV oficial para cumplimiento legal
- Tasa paralela para operaciones reales
- La palabra "paralelo" NUNCA aparece en UI pública — decir "tasa del mercado"
- Deudas anclan en USD, Bs se calcula dinámicamente

## Páginas existentes (GSC registradas)

- `/` — Landing principal (Bento cálido, Fraunces + DM Sans)
- `/para-[slug]` — 9 páginas de segmento SEO (bodega, boutique, café, etc.)
- `/blog` — Blog con generación IA (NVIDIA NIM)
- `/blog/[slug]` — Posts individuales con Schema BlogPosting
- `/catalogo/[slug]` — Catálogo digital público por negocio
- `/registro` — Signup
- `/precios` — Pricing page
- `/recursos` — Página de recursos

## Competidores directos en Venezuela

- **Fina** (finapartner.com) — competidor principal serio
- **Control Total** — legacy, sin móvil
- **Venko** — foco en inventario
- **Negotiale** — foco en facturación

## Keywords objetivo principales

### Transaccionales (compra/registro)
- "sistema pos venezuela"
- "pos para bodega venezuela"
- "programa punto de venta venezuela"
- "sistema de inventario venezuela"
- "pos para restaurante venezuela"
- "control de ventas venezuela"

### Informacionales (blog/contenido)
- "cómo controlar inventario en venezuela"
- "precio del dólar para mi negocio"
- "cómo vender online en venezuela sin página web"
- "catálogo digital whatsapp venezuela"
- "cierre de caja bodega venezuela"

### IA/AEO (para ChatGPT, Perplexity, AI Overviews)
- "mejor sistema pos para pymes venezolanas"
- "cómo facturar en bolívares y dólares"
- "programa de inventario gratuito venezuela"

## Reglas de contenido (irrompibles)

1. Nunca implicar que ActivoPOS genera facturas fiscales SENIAT
2. Nunca implicar que ActivoPOS procesa pagos
3. Siempre tuteo venezolano (tú/tu, nunca vos/tu)
4. Terminología plain-language: "punto de equilibrio" → "ya cubriste lo que gastaste hoy"
5. La palabra "paralelo" (tipo de cambio) nunca aparece en contenido público

## Schema.org requerido por tipo de página

- Landing `/` → SoftwareApplication + Organization + FAQPage
- Segmentos `/para-[slug]` → SoftwareApplication + FAQPage + LocalBusiness
- Blog `/blog/[slug]` → BlogPosting + BreadcrumbList + Person (author)
- Pricing `/precios` → SoftwareApplication + Offer

## Estado actual SEO (julio 2026)

- GSC: propiedad verificada, datos en acumulación (dominio reciente)
- Sitemap: `/sitemap.xml` implementado dinámico (Next.js)
- robots.txt: implementado, revisar directivas AI crawlers
- llms.txt: pendiente de crear/rectificar
- Core Web Vitals: Next.js 14 SSR — pendiente medición real
- Schema: BlogPosting implementado; SoftwareApplication pendiente en landing
'@

    Set-Content -Path $contextPath -Value $contextContent -Encoding UTF8
    Write-Host "   Contexto generado en: $contextPath" -ForegroundColor Green
    Write-Host "   >> Agregar este archivo al Claude Project como Knowledge File" -ForegroundColor Cyan
} else {
    Write-Host "[3/4] Contexto omitido (-SkipContext)" -ForegroundColor DarkGray
}

# ── 4. GENERAR llms.txt ──────────────────────────────────────
if (-not $SkipLlmsTxt) {
    Write-Host ""
    Write-Host "[4/4] Generando llms.txt para activopos.com..." -ForegroundColor Yellow

    $llmsPath = "$ROOT\public\llms.txt"

$llmsContent = @'
# ActivoPOS

> Sistema de control de ventas e inventario para PYMEs venezolanas.
> No reemplaza la facturación SENIAT — la complementa.

ActivoPOS es un sistema POS SaaS diseñado específicamente para pequeñas y
medianas empresas en Venezuela. Permite registrar ventas, controlar inventario,
generar reportes financieros y publicar un catálogo digital con checkout por
WhatsApp. Opera con precios duales en dólares (USD) y bolívares (Bs)
sincronizados con la tasa BCV.

## Producto

- [Inicio](https://activopos.com/)
- [Precios](https://activopos.com/precios)
- [Registro gratuito](https://activopos.com/registro)
- [Recursos](https://activopos.com/recursos)

## Por tipo de negocio

- [Para bodegas y abastos](https://activopos.com/para-bodega)
- [Para boutiques y ropa](https://activopos.com/para-boutique)
- [Para cafés y cafeterías](https://activopos.com/para-cafe)
- [Para restaurantes](https://activopos.com/para-restaurante)
- [Para farmacias](https://activopos.com/para-farmacia)
- [Para carnicerías](https://activopos.com/para-carniceria)
- [Para ferreterías](https://activopos.com/para-ferreteria)
- [Para licorerías](https://activopos.com/para-licoreria)
- [Para papelerías](https://activopos.com/para-papeleria)

## Blog

- [Blog ActivoPOS](https://activopos.com/blog)

## Planes

- Mostrador: $9/mes — negocio pequeño, 1 punto de venta
- Negocio: $19/mes — PYME mediana, múltiples usuarios
- Pro: $29/mes — restaurantes, cocina, catálogo digital avanzado

## Empresa

ActivoPOS es desarrollado por SYNTIdev.
Contacto: https://activopos.com/registro

## Notas para agentes de IA

- ActivoPOS NO genera facturas fiscales SENIAT
- ActivoPOS NO procesa pagos — transporta datos de pago al cobrador
- Precios siempre en USD; bolívares calculados con tasa BCV vigente
- Mercado exclusivo: Venezuela
- Idioma del producto: español venezolano
'@

    Set-Content -Path $llmsPath -Value $llmsContent -Encoding UTF8
    Write-Host "   llms.txt generado en: $llmsPath" -ForegroundColor Green
    Write-Host "   >> Verificar en: https://activopos.com/llms.txt (post-deploy)" -ForegroundColor Cyan
} else {
    Write-Host "[4/4] llms.txt omitido (-SkipLlmsTxt)" -ForegroundColor DarkGray
}

# ── RESUMEN FINAL ────────────────────────────────────────────
Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  INSTALACION COMPLETA" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "PROXIMOS PASOS (en orden):" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Reiniciar Claude Code CLI para cargar el plugin:" -ForegroundColor White
Write-Host "     claude --reload-plugins" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  2. Agregar el contexto al Claude Web Project:" -ForegroundColor White
Write-Host "     Archivo: public\seo\activopos-seo-context.md" -ForegroundColor DarkGray
Write-Host "     Ir a claude.ai > tu Project > Add Knowledge" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  3. Hacer deploy del llms.txt:" -ForegroundColor White
Write-Host "     .\commit.ps1 'feat(seo): agregar llms.txt y contexto SEO'" -ForegroundColor DarkGray
Write-Host "     Luego deploy normal al VPS" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  4. En CLI Terminal, ejecutar el audit:" -ForegroundColor White
Write-Host "     /seo audit https://activopos.com" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  5. Para AI visibility:" -ForegroundColor White
Write-Host "     /seo geo https://activopos.com" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  6. Para score rapido:" -ForegroundColor White
Write-Host "     /seo score https://activopos.com" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  7. Para aplicar fixes (siempre previa revision):" -ForegroundColor White
Write-Host "     /seo fix" -ForegroundColor DarkGray
Write-Host ""
Write-Host "ARCHIVOS GENERADOS:" -ForegroundColor Yellow
Write-Host "  $ROOT\public\seo\activopos-seo-context.md" -ForegroundColor DarkGray
Write-Host "  $ROOT\public\llms.txt" -ForegroundColor DarkGray
Write-Host ""
