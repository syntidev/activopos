# HANDOFF + BIENVENIDA AL PRÓXIMO AGENTE
# ActivoPOS | SYNTIdev | Carlos Bolívar, Arquitecto
# Sesión: 5 Julio 2026 | Sprints 64-71
# Generado por: Claude Web
# Fecha de corte: 5 Julio 2026
# Progreso global estimado: ~96%

---

## LEE ESTO ANTES DE HACER CUALQUIER COSA

Este documento ES el handoff Y el pase de bienvenida.
No hay documento separado. Este es el único que necesitas.
Leer también: HANDOFF_Sprint55-63_Sesion_5Jul2026.md para historia completa.

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

**Regla CLI-C nueva:** Todo hallazgo debe incluir archivo + línea + código exacto +
confianza (ALTA/MEDIA/BAJA). Sin evidencia de código real → no es hallazgo válido.

---

## CÓMO ARRANCAR — OBLIGATORIO EN ESTE ORDEN

### Paso 1 — Lee estos archivos:
```
CLAUDE.md (raíz del repo)                ← gobernanza absoluta, irrompible
.doc/SYSTEM_MAP.md                       ← estado real Sprint 71
.doc/AGENTS.md                           ← protocolo multi-agente CIMAAD
.doc/ECC_BRIEFING_AGENTES.md            ← skills, plugins, MCPs disponibles
.doc/AUDIT_FINANZAS_conectividad.md     ← auditoría contable hoy — decisiones selladas
graphify-out/GRAPH_REPORT.md            ← mapa de conectividad del codebase
Este documento                           ← lo que se hizo en esta sesión
```

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
| Graphify | ~3,400 nodos · git hook activo — rebuild automático post-commit |

---

## PROTOCOLO MULTI-AGENTE — IRROMPIBLE

| CLI | Rol | Skills OBLIGATORIOS |
|---|---|---|
| CLI-A | Backend: APIs, Prisma, lógica de negocio | /code-review + /security-review + /api-design + /software-architecture + /database-migrations + /deployment-patterns + /ponytail ultra |
| CLI-B | Frontend: componentes, CSS Modules, UX | /impeccable craft + /frontend-design:frontend-design + /ui-ux-pro-max:ui-ux-pro-max + /coding-standards + /ponytail ultra |
| CLI-C | Calidad: auditoría — SOLO REPORTA con evidencia | /code-review + /security-review → agents: typescript-reviewer, security-reviewer |
| CLI-D | Features/Testing | /e2e-testing + /impeccable craft + /frontend-design:frontend-design → agent: e2e-runner |

**Reglas irrompibles:**
- El prompt SIEMPRE inicia con una palabra en texto plano (Ejecuta, Arranca...)
- NUNCA con /skill — los skills van DESPUÉS de la primera línea
- CLI-A y CLI-B en paralelo cuando no comparten archivos
- CLI-C audita — no modifica excepto P0 — siempre con evidencia de código real
- Carlos ejecuta deploys — nunca generar prompts de deploy sin su orden
- graphify query/explain/path ANTES de tocar cualquier archivo

---

## DECISIONES DE NEGOCIO TOMADAS HOY — IRROMPIBLES

Estas decisiones definen la arquitectura contable del sistema.
El próximo agente DEBE conocerlas antes de tocar cualquier módulo financiero.

### 1. Modelo contable híbrido
- Ingreso se reconoce cuando se vende (contado O crédito)
- COGS se reconoce cuando se vende → fuente: SaleItem.cost_per_unit_usd ÚNICAMENTE
- OPEX se reconoce cuando se registra → fuente: Expense ÚNICAMENTE
- Compra a crédito = mercancía física recibida = suma stock inmediatamente

### 2. Separación absoluta Compra vs Gasto
- Compra = adquisición de inventario → fluye a COGS al vender
- Gasto = consumo operativo (renta, combustible, servicios) → OPEX siempre
- NUNCA mezclar — categoria='proveedor' en Expense excluida de OPEX en P&L
- Esta exclusión aplica en: finanzas/pyl, finanzas/resumen,
  finanzas/punto-equilibrio, analytics/summary, reports/export-pdf

### 3. Supplier es entidad propia
- Tabla Supplier con FK en Purchase y Expense.supplier_id
- Campo texto libre legacy preservado como nullable — no eliminar
- CRUD completo en /api/suppliers con role guard

### 4. Soft delete financiero — regla global
- NUNCA deleteMany en tablas financieras
- CxP anulada: status='cancelled' + cancelled_reason + cancelled_at + cancelled_by
- cancelled_by desde session.userId — NUNCA del body
- Esta regla aplica a toda tabla que mueve dinero

### 5. PurchaseStatus semántica
- pending = mercancía recibida físicamente, pago pendiente
- pending → received = deuda formalizada (CxP creada/confirmada), sin tocar stock
- cancelled = rollback stock (InventoryEntry reversal) + soft delete CxP
- POST /api/purchases NO acepta status='cancelled' — solo vía PATCH

### 6. COGS fuente unificada — aplicada en todos los módulos hoy
SaleItem.cost_per_unit_usd es la fuente de verdad del costo histórico.
product.cost_per_unit_usd NO debe usarse para calcular utilidad histórica.
Solo válido para mostrar el costo actual del producto en formularios.

Migrado hoy en:
- finanzas/resumen ✅ finanzas/punto-equilibrio ✅
- analytics/summary ✅ dashboard/kpis ✅ dashboard/charts ✅
- reports/day ✅ reports/range ✅ reports/export-pdf ✅

---

## LO QUE SE COMPLETÓ HOY (Sprints 64-71)

### Módulo Finanzas — Integridad Contable Completa
- ✅ Doble conteo COGS/OPEX eliminado — GAP-2/DT-2 resuelto (6345b4e)
- ✅ Supplier FK en Expense y CxP — GAP-1/GAP-8 resueltos (9a2c563)
- ✅ Compra pending suma stock inmediatamente — GAP-3/DT-3 resuelto (786879b)
- ✅ CxP anulada usa soft delete con trazabilidad completa (752fec4)
- ✅ Punto de Equilibrio conectado al endpoint real — GAP-6 resuelto (8ced706)
- ✅ Sin ventas en PE → "Sin ventas registradas" no "margen negativo" (6dd9746)
- ✅ AUDIT_FINANZAS_conectividad.md generado en .doc/

### Módulo Compras — Backend + Frontend Completo
- ✅ PATCH /api/purchases/[id] creado con transiciones de status (2a478fd)
- ✅ pending → received: CxP creada/confirmada, sin tocar stock
- ✅ cancelled: rollback stock + soft delete CxP en $transaction atómico
- ✅ POST rechaza status='cancelled' — solo alcanzable vía PATCH
- ✅ /proveedores y /proveedores/compras extendidos (f7f9dfd):
  KPIs mes, badges color, botones Confirmar/Anular, radio estado,
  modal detalle solo lectura, "+" proveedor inline en modal compra

### Módulo Reportes — COGS Histórico Unificado
- ✅ day/route.ts + range/route.ts migrados a si.cost_per_unit_usd (9391c13)
- ✅ export-pdf/route.ts migrado + filtro categoria='proveedor' (9391c13)
- ✅ export-pdf:69 migrado también — GAP-R1 completo (610e89f)
- ✅ pdf-report.ts (singular) eliminado — dead code, DT-12 cerrado (109651b)

### Módulo Analytics y Dashboard
- ✅ analytics/summary + dashboard/kpis + dashboard/charts migrados (db16089)
- ✅ analytics/summary excluye categoria='proveedor' en gastos
- ✅ KPI cards más compactas — padding/ícono reducidos (6d6e178)
- ✅ Mensaje "Vendiste $X hoy" condicional al período activo (6d6e178)

### Módulo Caja — Auditado y Certificado Limpio
- ✅ TOCTOU del cierre sigue intacto ($transaction + findFirst)
- ✅ Solo ventas status='paid' en cálculos — abonos de crédito separados
- ✅ business_id desde sesión en los 6 endpoints
- ✅ Validación cruzada USD/Bs en movimientos ±5% tolerancia (a7d8563)
- ✅ POST /api/cash/movement rechaza montos incoherentes → 400

### Módulo POS — Auditado y Certificado Limpio
- ✅ cost_per_unit_usd capturado server-side en POST /api/sales
- ✅ Precio siempre desde DB — SEC-01 vigente
- ✅ GAP-P1 resuelto — lápiz precio deshabilitado post-pendingSale (d72ac9e)
- ✅ DescuentoModal.tsx identificado como dead code (GAP-P2, post-demo)
- ✅ business_id desde sesión en todos los endpoints

### Sistema Modal Tasa Manual — Resuelto Definitivamente
- ✅ parallel_rate pre-cargado al abrir modal (e0ba33e)
- ✅ RateContext.tsx corregido — parallel_rate llega a consumidores
- ✅ createPortal — modal escapa stacking context del header fixed (d55a130)
- ✅ white-space: nowrap eliminado de rateApplyBtn — sin overflow

---

## COMMITS DE ESTA SESIÓN — REFERENCIA

```
d55a130  fix(header): RateModal via createPortal — escapa contexto fixed
c99bc98  fix(header): modal tasa max-width mobile min(380px,100vw-32px)
6d6e178  fix(escritorio): mensaje período sincronizado + KPI cards compactas
db16089  fix(analytics): costo historico SaleItem + filtro gastos proveedor
610e89f  fix(reports): export-pdf costo historico SaleItem linea 69
9391c13  fix(reports): day + range costo historico + filtro gastos proveedor
109651b  chore(lib): eliminar pdf-report.ts dead code — DT-12 cerrado
a7d8563  fix(caja): validacion cruzada USD/Bs en movimiento ±5%
d72ac9e  fix(pos): bloquear edicion precio post-pendingSale
2a478fd  feat(purchases): PATCH endpoint transicion status + rollback atomico
f7f9dfd  feat(proveedores): KPIs badges confirmar/anular detalle radio estado
8ced706  fix(finanzas): punto equilibrio conectado al endpoint real
6dd9746  fix(punto-equilibrio): sin-ventas vs margen-negativo semántica
752fec4  fix(cxp): soft delete trazabilidad — cancelled_reason/at/by
786879b  fix(purchases): pending suma stock + rollback atomico en anulacion
9a2c563  fix(finanzas): supplier_id FK en Expense + join en CxP y Gastos
6345b4e  fix(finanzas): eliminar doble conteo COGS/OPEX en P&L
```

---

## ESTADO DEL PLAN DE 12 DÍAS

```
DÍA 1  ✅ Pendientes completados (sesión 1 Jul)
DÍA 2  ✅ Onboarding backend (Sprint 44-49)
DÍA 3  ✅ Onboarding E2E certificado en producción
DÍA 4  ✅ Admin Panel completo (Sprints 53-54)
DÍA 5  ✅ Tasas venezolano + Nivelación funcional
DÍA 6  ✅ Integridad contable + Auditoría conectividad 5 módulos
DÍA 7  ⏸️ PENDIENTE — E2E completo como cliente en producción
DÍA 8  ⏸️ PENDIENTE — Landing page activopos.com
DÍA 9  ⏸️ PENDIENTE — Polish + textos venezolanos
DÍA 10 ⏸️ BUFFER — bugs + datos demo convincentes
DÍA 11 🔴 DEADLINE — Deploy final + demo (5 días)
```

---

## PENDIENTES ORDENADOS POR IMPACTO EN DEMO DEL 11 JULIO

### 🔴 BLOQUEANTES — sin esto no hay demo:

**1. Deploy VPS** — commits Sprints 65-71 sin deployar en producción.
Ejecutar antes de cualquier verificación en activopos.com.

**2. E2E completo como cliente en producción**
Flujo: registro → producto → venta → reporte.
CLI-D con Playwright contra activopos.com.

**3. Landing page activopos.com**
La landing actual es fachada. El cliente la ve antes del demo.
CLI-B — 4-6h.

**4. Datos demo convincentes en producción**
Verificar que el tenant demo muestra negocio real, no ceros.

### 🟡 IMPORTANTES — mejoran el demo:

**5. Módulo Ayuda — CLI-D ejecutando Sprint 71**
Secciones por módulo + bot actualizado. Lenguaje venezolano, tuteo.

**6. Wiring 29 call-sites getBcvRate → getActiveRate**
Ventas/POS ignoran override manual del tenant.
Riesgo monetario — requiere autorización Carlos antes de ejecutar.

### ⚪ PUEDE ESPERAR (post-demo):

- DescuentoModal.tsx dead code — eliminar (GAP-P2)
- cancelled_by como relación Prisma formal (hoy Int? plano)
- Tabla mobile /proveedores/compras sin fallback cards
- Teclado numérico móvil inputMode="numeric" sistema completo
- Módulo métodos de cobro / datos bancarios
- Dual brand header (logo cliente + ActivoPOS)
- Desnormalización business_id tablas hijas
- RateLimiterMemory → Redis cluster-safe (DT-11)
- Paginación inventario server-side (DT-14)

---

## DEUDA TÉCNICA ACTIVA

```
DT-08  Drift migraciones — db push acumulado, CLI-C auditar antes de schema change
DT-11  RateLimiterMemory no cluster-safe → Redis pendiente producción
DT-13  ProductModal.tsx huérfano parcial (scanner móvil)
DT-14  Paginación inventario client-side — no escala
DT-15  DescuentoModal.tsx dead code — sin importadores
DT-16  cancelled_by en CxP es Int? plano — sin relación Prisma formal
DT-17  Tabla /proveedores/compras sin fallback mobile cards
DT-18  29 call-sites getBcvRate en ventas/POS ignoran override manual tenant
```

---

## METODOLOGÍA DE AUDITORÍA — PATRÓN ESTABLECIDO HOY

```
1. CLI-C lee código real (no documentación) con graphify primero
2. Reporta: archivo + línea + código exacto + confianza ALTA/MEDIA/BAJA
3. Carlos toma decisiones de modelo de negocio
4. CLI-A/CLI-B ejecutan quirúrgico — un commit por bloque
5. Verificación con datos reales (curl contra endpoint)
6. Verificación visual en navegador — Carlos aprueba
7. Avanzar al siguiente módulo solo con aprobación visual
```

**Lección crítica aprendida:** CLI-C diagnosticó premisas falsas
(PATCH purchases "no existía", /compras "sin frontend"). La causa:
leer documentación en vez de código real. El formato de evidencia
(archivo + línea + código exacto + confianza) previene esto.

---

## SISTEMA DE TASAS — ARQUITECTURA SELLADA

```
GET /api/rates/bcv → {rate, source, manual_active, bcv_rate, parallel_rate}
POST /api/rates/manual → {rate?, active: boolean} — admin/super_admin only

Prioridad:
1. DollarRate{source:'manual', is_active:true, business_id} → override manual
2. ve.dolarapi.com/v1/dolares/oficial → BCV oficial
3. brecha-cambiaria.com/api/prices → fallback
4. Última tasa activa en DB → fallback
5. DOLLAR_FALLBACK_RATE env ?? 40 → fallback final

Campo manual pre-cargado con paralelo real — sin mostrar "paralelo" en UI.
29 call-sites en ventas/POS siguen con getBcvRate() — DT-18, pendiente.
```

---

## GRAPHIFY — ESTADO Y USO OBLIGATORIO

Estado: OPERATIVO — hook post-commit activo
```
graphify query "[qué conecta X con Y]"
graphify explain "[componente clave]"
graphify path "[origen]" "[destino]"
graphify update .  ← ejecutar post-commit al finalizar sesión
```

---

## PRÓXIMA SESIÓN — PRIMERA TAREA SIN ESPERAR INSTRUCCIÓN

**Deploy VPS primero:**
```bash
ssh root@187.124.241.213
cd /var/www/activopos
git fetch origin
git merge origin/main --no-ff
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push
rm -rf .next
npm run build
pm2 restart activopos
pm2 status
```

Luego en paralelo:
- **CLI-D → E2E como cliente en producción** (bloqueante del demo)
- **CLI-B → Landing page** (bloqueante del demo)

---

## MÉTRICAS DE ÉXITO PARA EL 11 JULIO

```
Un usuario nuevo se registra sin ayuda de Carlos    ✅
Puede crear productos, fotos, configurar pagos      ✅
Catálogo público accesible por link y WhatsApp      ✅
Puede cobrar en POS — contado y crédito             ✅
Carlos ve quién se registró desde admin             ✅
Finanzas con integridad contable real               ✅ (hoy)
COGS histórico correcto en todos los módulos        ✅ (hoy)
Caja validada — sin fachadas                        ✅ (hoy)
POS sin divergencia precio mostrado/facturado       ✅ (hoy)
Modal tasa manual funcional en mobile               ✅ (hoy)
Landing page convierte visitas → registros          ❌ pendiente
E2E completo sin bugs en producción                 ❌ pendiente
Datos demo convincentes en activopos.com            ⚠️ verificar
```

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
*Generado: 5 Julio 2026 | Sesión Sprints 64-71 | ~20 commits*
*Próxima sesión: Deploy VPS → E2E producción → Landing — 5 días para el demo del 11 Julio*
