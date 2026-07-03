# HANDOFF — Sprint 52 — Sesión 2 Julio 2026
# ActivoPOS — SYNTIdev

---

## ESTADO DEL REPO

- **Último commit:** `1bbcc85` fix(tokens): sidebar y acentos migrados de teal a Persian Blue #0038BD
- **Rama:** `main` (sin divergencia con `origin/main` a la hora de este handoff)
- **Build:** ✅ `npm run build` limpio, `npx tsc --noEmit` → 0 errores (verificado en el deploy de esta sesión)
- **VPS:** ✅ online — `pm2 status` muestra `activopos` en `online`; `https://activopos.com/login` → `200`; `pm2 logs activopos` sin errores tras el último deploy (commit `1bbcc85`)

**Nota:** `.doc/ACTIVOPOS_MASTER.md` (referenciado en `CLAUDE.md` como lectura obligatoria #3) **no existe** en el repo — no se pudo usar como fuente para "Próximas tareas"; esa sección se basó en los gaps abiertos del handoff anterior y el roadmap ahí documentado.

---

## SPRINTS COMPLETADOS HOY (50, 51, 52)

### Sprint 50
| Commit | Descripción | Agente |
|---|---|---|
| `e5adc5a` | fix(config): número WhatsApp soporte real en TabPlan | CLI-A |
| `b797989` | fix(inventory): entry_type='sale' en todos los decrementos de venta | CLI-A |
| `24d16cc` | feat(plans): BILLING_CYCLES con descuentos por ciclo de pago | CLI-A |
| `cb672c7` | feat(plans): plan enforcement en suppliers y catalog | CLI-A |
| `a447dd7` | feat(quotations): PDF profesional con RIF, dirección, correo y condiciones del negocio | CLI-A |
| `37a266c` | feat(plans): selector billing cycles con descuentos en TabPlan UI | CLI-B |
| `014bd45` | feat(config): quotation_footer en PatchSchema de config/business | CLI-A |
| `df7c0e5` | feat(config): textarea condiciones de cotización en TabEmpresa | CLI-B |
| `6861e4d` | fix(config): quotation_footer en GET select de config/business | CLI-A |

### Sprint 51
| Commit | Descripción | Agente |
|---|---|---|
| `26b29e4` | feat(sales): pos_mode en businesses + endpoint GET /api/sales/[id]/invoice PDF carta | CLI-A |
| `5cf49db` | feat(config): pos_mode en GET select y PatchSchema de config/business | CLI-A |
| `a952a55` | feat(pos): toggle pos_mode en configuración + lógica documento por tipo de venta | CLI-B |
| `03d94ea` | fix(types): pos_mode en BusinessConfig — elimina intersecciones locales | CLI-A |
| `912b336` | chore(config): eliminar comentario obsoleto quotation_footer en TabEmpresa | CLI-A |

### Sprint 52
| Commit | Descripción | Agente |
|---|---|---|
| `3dd26f6` | fix(seo): metadata.title propio en página /registro | CLI-B |
| `22c2bb3` | fix(pwa): manifest.json corregido — elimina 404 PWA en producción | CLI-A |
| `1bbcc85` | fix(tokens): sidebar y acentos migrados de teal a Persian Blue #0038BD | CLI-B |

*(17 commits, todos del 2026-07-02. No incluye `1286ba2`/`792b7cf`/`ba5d6ab` — esos son de Sprint 44.5/Proveedores P1/Planes, previos a esta sesión.)*

---

## GAPS CERRADOS HOY

Contra la lista de `GAPS PENDIENTES` del handoff anterior (`HANDOFF_Sprint44-49_Sesion_1Jul2026.md`):

- ✅ **P1 #2 — entry_type en ventas**: cerrado (`b797989`) — `sales/route.ts`, `sales/[id]/pay`, `sales/[id]/void`, `orders/[id]/cobrar` ahora setean `entry_type='sale'`.
- ✅ **P1 #3 — Número de WhatsApp soporte**: cerrado (`e5adc5a`) — `584243244788` real en `TabPlan.tsx`.
- ✅ **P1 #5 — Verificar /registro E2E en producción**: cerrado — flujo completo verificado contra `activopos.com` con Playwright (7 pasos + submit + redirect a `/escritorio` con sesión activa, sin errores 4xx/5xx propios del flujo).
- ⚠️ **P1 #1 — Plan enforcement incompleto**: **parcialmente cerrado**. `create_supplier` sí quedó cableado en `POST /api/suppliers` (`cb672c7`). **`access_catalog` y `access_ai` siguen sin ningún endpoint que los invoque** — un tenant `trial` puede seguir usando catálogo digital y el chat de IA sin bloqueo real, pese a `PLAN_LIMITS`. No cerrar como resuelto.
- ✅ **P2 #6 — Modo de venta POS por segmento**: cerrado — `pos_mode` (ticket térmico / factura de servicio) en `Business`, toggle en Configuración (`a952a55`), tipo unificado en `BusinessConfig` (`03d94ea`).
- ✅ **P2 #7 — Factura PDF para ventas de servicio**: cerrado — `GET /api/sales/[id]/invoice` (PDF carta A4) (`26b29e4`), `SuccessTicketPanel` elige ticket térmico o factura según `pos_mode`.

**Cerrados hoy que no estaban en la lista P1/P2 pero sí en reportes de esta sesión:**
- ✅ `manifest.json` 404 en producción (`22c2bb3`) — reportado en la auditoría de conectividad de producción.
- ✅ `/registro` sin `metadata.title` propio (`3dd26f6`) — mismo reporte.
- ✅ PDF de cotización sin RIF/dirección/correo/condiciones del negocio (`a447dd7`) — cierra el gap documentado en el reporte "Campos de negocio para cotización/factura".

**No confirmado (no dar por cerrado):**
- ⚠️ **P1 #4 — Encoding PDF cotizaciones** (caracteres corruptos con tildes): no se encontró evidencia de fix específico en `quotations/[id]/pdf/route.ts` (sigue usando fuente `helvetica` estándar de jsPDF, sin cambios de encoding/fuente detectados). Verificar manualmente antes de marcarlo resuelto.

---

## DEUDA TÉCNICA DOCUMENTADA (no ejecutar sin orden)

- `loadLogo` duplicado entre `quotations/[id]/pdf` y `sales/[id]/invoice` → extraer a `src/lib/pdf-utils.ts`.
- `SuccessTicketPanel.tsx` tiene `type PosMode` local — evaluar si unificar con `BusinessConfig`.
- Tenant `QA Test Registro SPRINT50` en producción — pendiente limpieza manual (creado durante verificación E2E de `/registro`, sin endpoint de auto-limpieza).
- `access_catalog` y `access_ai` sin guardia en ningún endpoint real (ver Gaps Cerrados Hoy, P1 #1 parcial).
- `Proveedores` sigue sin `moduleKey` en el Sidebar — no participa del toggle de módulos por plan/config.
- `products/import` / `products/import-excel` crean `InventoryEntry` sin `entry_type` explícito (heredan default `'adjustment'`).
- `RateLimiterMemory` (todos los rate limiters) no es cluster-safe — pendiente Redis en producción.
- `pdf-report.ts` y `pdf-reports.ts` coexisten en `src/lib/` — nombre casi idéntico, no auditado si hay duplicación real.
- Encoding de tildes en PDF de cotizaciones — sin confirmar si sigue roto (ver arriba).
- Desnormalización `business_id` en tablas hijas (`SaleItem`, `SalePayment`, etc.) — defensa en profundidad IDOR pendiente de evaluar.
- Compras a proveedores no generan deuda en CxP — módulos desconectados.
- `.doc/ACTIVOPOS_MASTER.md` no existe pese a estar referenciado en `CLAUDE.md` como lectura obligatoria.

---

## PRÓXIMAS TAREAS (ordenadas por prioridad)

*(Basado en gaps abiertos de handoffs anteriores + roadmap de `HANDOFF_Sprint44-49` — `ACTIVOPOS_MASTER.md` no disponible, ver nota arriba)*

1. **Cerrar `access_catalog`/`access_ai` en plan enforcement** — última pieza P1 abierta desde Sprint 44-49; un trial puede usar catálogo e IA sin restricción real.
2. **Verificar/arreglar encoding de tildes en PDF de cotizaciones** — no confirmado si el rework de `a447dd7` lo resolvió.
3. **Wildcard DNS para catálogos** — Bloque 6 (Deploy producción) seguía en ⏳70% al cierre del handoff anterior, bloqueando subdominios de catálogo.
4. **Extraer `loadLogo` a `src/lib/pdf-utils.ts`** — deuda técnica de esta sesión, duplicado entre cotizaciones y facturas.
5. **Conectar Compras con CxP** — compras a proveedores deberían generar cuentas por pagar.
6. **Limpieza manual del tenant de QA** (`QA Test Registro SPRINT50`) en producción.
7. **Demo de cliente / primeros pagos** — Bloque 7 (Lanzamiento) en ⏳20% al cierre del handoff anterior; sigue siendo el bloque de mayor impacto de negocio pendiente.

---

## REGLAS QUE NO CAMBIAN

*(El handoff anterior, `HANDOFF_Sprint44-49_Sesion_1Jul2026.md`, no incluye un bloque de "reglas selladas" propio — se usa como fuente el bloque canónico de `CLAUDE.md`, que es la referencia autoritativa del proyecto.)*

**Monetario — sellado:** todo valor monetario muestra USD y Bs simultáneamente, sin toggle. `Bs = USD × rate_bcv` (dinámico, nunca hardcodeado). Fallback: última tasa en `dollar_rates`. Nunca bloquear una operación por falta de tasa BCV.

**Paradigma de venta — irrompible:** cajero selecciona producto → ingresa CANTIDAD → sistema calcula `qty × price_usd × rate = total_bs`. Nunca el cajero ingresa monto en Bs para back-calcular cantidad.

**Inventario:** stock descuenta SOLO cuando `sale.status = 'paid'`. Tickets abiertos no afectan stock.

**Seguridad:** JWT fail-closed (sin fallback secrets, `algorithms: ['HS256']`). `business_id` siempre desde `getSession()`/`getAuthenticatedTenant()` — nunca del body ni query params. Rate limiting en login y endpoints públicos. Slugs validados con regex antes de cualquier query. `logo_path` solo acepta rutas `/uploads/` — nunca URLs externas. Precios de catálogo vienen del servidor, nunca del cliente.

**TypeScript:** `strict: true`, nunca `any`. Zod v4 — `.issues` NO `.errors`.

**CSS:** solo CSS Modules, cero Tailwind, cero inline styles, cero hex hardcodeado fuera de `tokens.css`.

**Arquitectura:** sin `branch_id` en tablas transaccionales (v1). Un negocio = un tenant = una instalación activa. Multi-sucursal es Fase 2.

**Lo que nunca se toca:** `C:\laragon\www\synticorex\`, `C:\laragon\www\syntimeat\` (producción activa de otros proyectos). Panel `admin.activopos.com` (territorio Opus). El paradigma `qty × price` (nunca `bs → qty`). `git stash` sobre trabajo ajeno sin commitear.

---

## PARA EL PRÓXIMO AGENTE — ARRANCAR ASÍ

```bash
git log --oneline -5
npm run dev
```

Verificar que el VPS está online antes de continuar:
```bash
curl -s -o /dev/null -w "%{http_code}" https://activopos.com/login
pm2 status   # (vía ssh root@187.124.241.213)
```

Leer en orden: `CLAUDE.md` → `.doc/SYSTEM_MAP.md` → este handoff → `.doc/CONNECTIVITY_AUDIT_Jul2026.md`.

Primera tarea sugerida: cerrar `access_catalog`/`access_ai` en `checkPlanLimit` (única pieza P1 que sigue abierta de Sprint 44-49).

---

*Generado: 2 Julio 2026 | ActivoPOS — SYNTIdev*
