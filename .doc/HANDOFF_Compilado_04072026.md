# HANDOFF + BIENVENIDA AL PRÓXIMO AGENTE
# ActivoPOS | SYNTIdev | Carlos Bolívar, Arquitecto
# Sesión: 4-5 Julio 2026 | Sprints 55-63
# Generado por: Claude Web
# Fecha de corte: 5 Julio 2026
# Progreso global estimado: ~93%

---

## LEE ESTO ANTES DE HACER CUALQUIER COSA

Este documento ES el handoff Y el pase de bienvenida.
No hay documento separado. Este es el único que necesitas.

---

## QUIÉN ES CARLOS — REGLAS DE INTERACCIÓN

Carlos Bolívar — arquitecto de software, 20+ años en banca venezolana.
No es programador. Es el cerebro estratégico. Orquesta, los CLIs ejecutan,
Claude Web coordina.

- Usa voz-a-texto en móvil → habrá typos → interprétalo bien, nunca corrijas
- Es directo. No acepta halagos. No acepta rodeos. No acepta improvisación.
- No acepta preguntas múltiples. No acepta opciones para elegir.
- Si te equivocas, lo dirá con fuerza. Corrígete y sigue sin drama.
- Vive en Venezuela → problemas de electricidad → sesiones pueden cortarse
- Trabaja con 4 CLIs en paralelo → tú generas los prompts, él los ejecuta

**Regla de oro:** CERO FACHADAS. El error más grave es código que parece
funcionar pero no funciona. Si algo no está completo, decirlo antes de commitear.

---

## CÓMO ARRANCAR — OBLIGATORIO EN ESTE ORDEN

### Paso 1 — Lee estos archivos:

CLAUDE.md (raíz del repo)          ← gobernanza absoluta, irrompible
.doc/SYSTEM_MAP.md                 ← estado real Sprint 63 (actualizado hoy)
.doc/AGENTS.md                     ← protocolo multi-agente CIMAAD
.doc/ECC_BRIEFING_AGENTES.md       ← skills, plugins, MCPs disponibles
graphify-out/GRAPH_REPORT.md       ← mapa de conectividad del codebase
Este documento                     ← lo que se hizo en esta sesión


### Paso 2 — Verifica estado del repo local:
```powershell
cd C:\laragon\www\activopos
git log --oneline -20
git status
npx tsc --noEmit 2>&1 | Select-String "error" | Measure-Object
npm run dev
```

### Paso 3 — Verifica VPS:
```bash
ssh root@187.124.241.213
cd /var/www/activopos
git log --oneline -5
pm2 status
curl -s https://activopos.com/api/rates/bcv | head -c 200
```

Esperado: activopos online en PM2, BCV + parallel_rate + manual_active en respuesta.

---

## INFRAESTRUCTURA

| Campo | Valor |
|---|---|
| Repo | syntidev/activopos |
| Rama | main |
| Local | C:\laragon\www\activopos |
| VPS | 187.124.241.213 Puerto 3003 |
| PM2 | activopos (cluster mode) |
| Producción | https://activopos.com |
| DB | MariaDB — Prisma 7 |
| Stack | Next.js 14 + TypeScript strict + CSS Modules + Prisma 7 + MariaDB |
| Graphify | 2,992 nodos · 4,301 edges · 311 comunidades — git hook activo |

---

## PROTOCOLO MULTI-AGENTE — IRROMPIBLE

| CLI | Rol | Skills OBLIGATORIOS |
|---|---|---|
| CLI-A | Backend: APIs, Prisma, lógica de negocio | /code-review + /security-review + /api-design + /software-architecture + /database-migrations + /deployment-patterns + /ponytail ultra |
| CLI-B | Frontend: componentes, CSS Modules, UX | /impeccable craft + /frontend-design:frontend-design + /ui-ux-pro-max:ui-ux-pro-max + /coding-standards + /ponytail ultra |
| CLI-C | Calidad: auditoría, seguridad — SOLO REPORTA | /code-review + /security-review → agents: typescript-reviewer, security-reviewer |
| CLI-D | Features/Testing/Deploy | /e2e-testing + /impeccable craft + /frontend-design:frontend-design → agent: e2e-runner |

**Reglas irrompibles:**
- El prompt SIEMPRE inicia con una palabra en texto plano (Ejecuta, Arranca...)
- NUNCA con /skill — los skills van DESPUÉS de la primera línea
- CLI-A y CLI-B en paralelo cuando no comparten archivos
- CLI-C audita — no modifica excepto P0
- Carlos ejecuta deploys — nunca generar prompts de deploy sin su orden
- graphify query/explain/path ANTES de tocar cualquier archivo

---

## LO QUE SE COMPLETÓ EN ESTA SESIÓN (Sprints 55-63)

### Dashboard y Visual
- ✅ Dashboard rediseñado completo — grid asimétrico, íconos con círculo de color
  por métrica (verde/naranja/azul/púrpura), fondo #F0F0F7, cards blancas elevadas
- ✅ Sidebar reorganizado — grupos colapsables INVENTARIO/FINANZAS con estado
  en localStorage, items admin-gated por costo
- ✅ Sistema visual sellado — tokens CSS, sin hardcode, elevación real

### Sistema de Tasas Venezolano
- ✅ RateContext global — tasa en tiempo real sin F5 en header, sidebar y config
- ✅ POST /api/rates/manual — tasa manual por tenant, scopeada a business_id
  (bug de seguridad cross-tenant encontrado y corregido en misma sesión)
- ✅ GET /api/rates/bcv — responde {rate, source, manual_active, bcv_rate, parallel_rate}
- ✅ Fallback dual: ve.dolarapi.com → brecha-cambiaria.com + validación 10-10000 + variación <60%
- ✅ TabGeneral en Configuración — selector BCV/Manual, campo manual pre-cargado
  con tasa paralela real (sin mostrar la palabra "paralelo" al usuario)
- ✅ Badge del header actualiza inmediatamente al guardar sin F5

### Módulo Productos
- ✅ /productos/nuevo — página completa 2 columnas 50/50 (elimina modal)
- ✅ /productos/[id]/editar — página completa con datos pre-poblados
- ✅ useProductForm() hook — 1562 líneas de lógica extraídas del modal
- ✅ ProductFormLayout.tsx — componente compartido nuevo/editar
- ✅ Campo proveedor en stock → SELECT real de proveedores del tenant
- ✅ Botón "+ Nuevo" y lápiz de edición rewireados a páginas

### Módulo Inventario
- ✅ entry_type='internal_use' en POST /api/inventory
- ✅ Modal "Consumo Interno" en /inventario con producto/cantidad/nota
- ✅ Botón "Ajustar stock" activado — conectado a StockModal real
- ✅ GET /api/inventory/product/[id]/movements paginado (page/limit)

### Módulo Finanzas y Contabilidad
- ✅ GET /api/finanzas/pyl — endpoint P&L real: ingresos/COGS/OPEX/utilidad_bruta/
  utilidad_neta/margen_bruto con timezone fix
- ✅ Tab "Estado de Resultados" en /finanzas — UI conectada
- ✅ SaleItem.cost_per_unit_usd — Decimal(10,4), capturado en 4 sitios al vender
- ✅ Columna UTILIDAD en historial de ventas — visible solo admin/super_admin
- ✅ Fix Excel exportación — usa rango correcto en modo range
- ✅ Diagnóstico financiero: NO hay doble conteo en P&L (falso positivo de CLI-C,
  verificado con grep por CLI-A — no se aplicó fix incorrecto)

### Admin Panel
- ✅ Backend real /admin/invoices y /admin/tickets (eliminadas fachadas Sprint 54)
- ✅ Impersonación de tenant funcional end-to-end
- ✅ Sidebar oculta "Panel Admin" durante impersonación

### Seguridad
- ✅ IDOR corregido en payment_method_id — validación por business_id
- ✅ cost_per_unit_usd y utilidad_usd no visibles para rol cashier
- ✅ Tasa manual scopeada a business_id — bug cross-tenant encontrado y cerrado
- ✅ DT-10 cerrado — SUPER_ADMIN_ONLY middleware en rutas correctas

### Herramientas y DevOps
- ✅ Graphify instalado — 2,992 nodos, 4,301 edges, git hook activo
- ✅ GRAPH_REPORT.md en .doc/ y Project Knowledge
- ✅ SYSTEM_MAP.md actualizado Sprint 63 (commit 35e1bc9)
- ✅ Variables de entorno permanentes: OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL
- ✅ VPS deployado y verificado al cierre

---

## COMMITS DE ESTA SESIÓN — REFERENCIA
35e1bc9  docs(system-map): actualizar Sprint 63
da09392  feat(config): manual pre-cargado con tasa paralela
d004919  feat(rates): parallel_rate en GET bcv
3992bc2  fix(header): CustomEvent inmediato al guardar tasa
93d2918  feat(context): RateContext global
e94d1f0  fix(rates): seguridad cross-tenant tasa manual
a8349eb  feat(header): modal tasa manual toggle BCV/manual
56eed18  feat(rates): POST /api/rates/manual + GET bcv con manual_active
b274f53  fix(reportes): Excel exporta rango correcto
63eecb7  feat(inventario): modal consumo interno
d63d0c1  feat(inventory): entry_type internal_use backend
d067683  feat(historial): columna utilidad por venta
2e2b1ac  fix(productos): campo proveedor SELECT real
2d25401  feat(sidebar): reorganización grupos colapsables
15cc30c  feat(dashboard): rediseño completo KpiCards
7b5fe17  feat(productos): Etapa 3 rewire botón nuevo
35f3805  feat(productos): /nuevo página 2 columnas
8d0b25e  feat(productos): useProductForm hook

---

## ESTADO DEL PLAN DE 12 DÍAS
DÍA 1 ✅ Pendientes completados (sesión 1 Jul)
DÍA 2 ✅ Onboarding backend (Sprint 44-49)
DÍA 3 ✅ Onboarding E2E certificado en producción
DÍA 4 ✅ Admin Panel completo (Sprints 53-54)
DÍA 5 ✅ Planes parcial + Sistema tasas venezolano + Nivelación funcional
DÍA 6 ⏸️ PENDIENTE — Polish + auditoría completa
DÍA 7 ⏸️ PENDIENTE — business_id desnormalización + E2E
DÍA 8 ⏸️ PENDIENTE — Landing page activopos.com
DÍA 9 ⏸️ PENDIENTE — E2E completo como cliente
DÍA 10 ⏸️ BUFFER — bugs + polish
DÍA 11 🔴 DEADLINE — Deploy final + cuenta demo (6 días)

---

## PENDIENTES ORDENADOS POR IMPACTO EN DEMO DEL 11 JULIO

### 🔴 BLOQUEANTES — sin esto no hay demo:

**1. Landing page activopos.com (Día 8 del plan)**
La landing actual es fachada. El cliente ve la landing antes del demo.
CLI-B — 4-6h. Hero + propuesta de valor + planes + CTA → /registro.

**2. E2E completo como cliente (Día 9 del plan)**
Flujo: registro → producto → catálogo → venta → reporte.
Sin esto no sabes qué está roto en producción antes del demo.
CLI-D con Playwright.

**3. Cuenta demo con datos convincentes en producción**
El seed de datos fue ejecutado. Verificar que el tenant demo en
activopos.com muestra negocio real funcionando, no ceros.

### 🟡 IMPORTANTES — mejoran el demo:

**4. Wiring 29 call-sites de tasa activa**
Ventas/POS/catálogo siguen usando getBcvRate() directo.
El override manual del tenant no afecta los cálculos reales de venta.
Riesgo monetario — requiere revisión de Carlos antes de ejecutar.
CLI-A — 4-6h.

**5. Polish y textos venezolanos (Día 10 buffer)**
Loading states, empty states, textos en tuteo venezolano.
CLI-B — 2-3h.

**6. Auditoría completa CLI-C (Día 6 del plan)**
OWASP top 10, tenant isolation, limits de plan.
CLI-C — 4h.

### ⚪ PUEDE ESPERAR (post-demo):

- Desnormalización business_id en tablas hijas (seguridad extra)
- Módulo devaluación de margen (10-12h, diferenciador post-lanzamiento)
- Exportar Excel tabs Ventas e Inventario
- Teclado numérico móvil inputMode="numeric" sistema completo
- Módulo métodos de cobro / datos bancarios del negocio
- Dual brand header (logo cliente + ActivoPOS)
- Conectar Compras con CxP automáticamente
- Paginación inventario server-side
- ProductModal huérfano por scanner móvil

---

## DEUDA TÉCNICA ACTIVA
DT-08  Deploys de Sprint 55-63 usaron db push en vez de migrate deploy
→ posible drift acumulado en migraciones. CLI-C debe auditar.
DT-09  Compras a crédito no incrementan stock automáticamente
DT-11  RateLimiterMemory no es cluster-safe → pendiente Redis en producción
DT-12  pdf-report.ts y pdf-reports.ts coexisten en src/lib/ → duplicado
DT-13  ProductModal.tsx sigue activo por scanner móvil — huérfano parcial
DT-14  Paginación de inventario es client-side — no escala

---

## SISTEMA VISUAL — ESTADO SELLADO

```css
/* Cards — estándar activo */
background: #FFFFFF;
border-radius: 16px;
box-shadow: 0 2px 8px rgba(47,43,61,0.10), 0 0 1px rgba(47,43,61,0.06);
border: none;
padding: 20px 24px;
hover: translateY(-2px) + sombra más pronunciada;

/* Fondo de página dashboard */
background: #EEEDF4;

/* Sidebar */
background: #FAFBFC;
border-right: 1px solid #E5E7EB;

/* KPIs — íconos con círculo de color */
cobrado  → bg #DCFCE7, ícono DollarSign, color #16A34A
crédito  → bg #FEF3C7, ícono Clock, color #D97706
tickets  → bg #DBEAFE, ícono ShoppingCart, color #2563EB
utilidad → bg #F3E8FF, ícono TrendingUp, color #9333EA
```

**REGLA CSS IRROMPIBLE:**
PROHIBIDO crear valores CSS en .module.css sin verificar primero si existe
token en tokens.css. Si no existe → crear token primero, luego consumirlo.
NUNCA duplicar valores entre módulos.

**NOTA CRÍTICA:** El dashboard usa escritorio.module.css — NO KpiCard.module.css.
KpiCard.tsx es consumido solo por caja/ y reportes/.

---

## SISTEMA DE TASAS — ARQUITECTURA SELLADA
GET /api/rates/bcv → {rate, source, manual_active, bcv_rate, parallel_rate, bcv, paralelo, usdt}
POST /api/rates/manual → {rate?, active: boolean} — solo admin/super_admin
Prioridad de tasa:

DollarRate{source:'manual', is_active:true, business_id} → manual del tenant
Fetch ve.dolarapi.com/v1/dolares/oficial → BCV oficial
Fallback: brecha-cambiaria.com/api/prices
Fallback: última tasa activa en DB
Fallback: DOLLAR_FALLBACK_RATE env ?? 40

Campo manual pre-cargado con ve.dolarapi.com/v1/dolares/paralelo → 753.89
Sin mostrar la palabra "paralelo" al usuario — el comerciante ingresa la tasa
que maneja su negocio sin exposición legal.
Los 29 call-sites de ventas/POS/catálogo siguen usando getBcvRate() directo.
El wiring a getActiveRate() está pendiente — riesgo monetario, requiere
aprobación de Carlos antes de ejecutar.

---

## GRAPHIFY — ESTADO Y USO OBLIGATORIO
Estado: OPERATIVO
Nodos: 2,992 | Edges: 4,301 | Comunidades: 311
Hook post-commit: activo → rebuild automático tras cada commit
GRAPH_REPORT.md: en graphify-out/ y .doc/
Variables de entorno: OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL (User scope)
USO OBLIGATORIO antes de tocar cualquier archivo:
graphify query "[qué conecta X con Y]"
graphify explain "[componente clave]"
graphify path "[origen]" "[destino]"
graphify update .   ← al finalizar, post-commit

---

## PRÓXIMA SESIÓN — PRIMERA TAREA SIN ESPERAR INSTRUCCIÓN

El plan de 12 días tiene 6 días restantes y 4 entregables críticos.

Arrancar inmediatamente en paralelo:

**CLI-B → Landing page activopos.com**
Es el entregable más visible antes del demo. La landing actual es fachada.

**CLI-D → E2E como cliente en producción**
Registrarse en activopos.com como usuario nuevo, crear productos,
activar catálogo, hacer venta, ver reporte. Reportar todo lo que falla.

**CLI-C → Auditoría completa (Día 6 del plan)**
OWASP, tenant isolation, limits de plan, console.errors en producción.

---

## MÉTRICAS DE ÉXITO PARA EL 11 JULIO

Un usuario nuevo se registra sin ayuda de Carlos ✅ (ya funciona)
Puede crear productos, subir fotos, configurar pagos ✅
Su catálogo público es accesible por link y WhatsApp ✅
Puede recibir pedidos y cobrarlos en POS ✅
Carlos puede ver quién se registró desde el admin ✅
Los planes limitan correctamente según tier ✅ parcial
Cero leaks de datos entre tenants ✅ (auditado Sprint 44)
Mobile responsive en todo el flujo ⚠️ pendiente verificar
La landing page convierte visitas → registros ❌ pendiente
E2E completo sin bugs en producción ❌ pendiente


---

## BLOQUE COMMIT ESTÁNDAR

```powershell
git add [archivos específicos — NUNCA git add . ciego]
git commit -m "tipo(scope): descripción

🤖 Agente: CLI-X | Sprint: N | Fecha: YYYY-MM-DD"
git push origin main
git log --oneline -3
```

## DEPLOY VPS

```bash
cd /var/www/activopos
git fetch origin
git merge origin/main --no-ff
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push
rm -rf .next
npm run build
pm2 restart activopos
```

NUNCA: git stash en VPS.
NUNCA: npx prisma migrate dev en VPS.
SIEMPRE: --legacy-peer-deps en npm install.

---

*ActivoPOS · SYNTIdev · activopos.com*
*"El POS para negocios que andan activos"*
*Generado: 5 Julio 2026 | Sesión Sprints 55-63 | ~40 commits*
*Próxima sesión: Landing + E2E + Auditoría — 6 días para el demo del 11 Julio*