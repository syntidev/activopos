# ACTIVOPOS_MASTER.md
# Documento único de verdad — árbitro del proyecto
# Última actualización: 2026-07-02 | Sprint 52
# Fuentes: CLAUDE.md + .doc/SYSTEM_MAP.md + .doc/HANDOFF_Sprint52_Sesion_2Jul2026.md + .doc/ACTIVOPOS_MASTER_V2.md (fusión)
# Árbitro: Este archivo. Si hay conflicto con otro doc que no sea CLAUDE.md, este gana. CLAUDE.md tiene prioridad absoluta sobre este archivo.

**Nota de fusión:** ya existía `.doc/ACTIVOPOS_MASTER_V2.md` (17 jun 2026), que se autodeclaraba árbitro. No se borra ni se sobreescribe — queda como archivo histórico. Este documento lo reemplaza como árbitro activo, incorporando lo que seguía vigente de V2 y actualizando todo lo que Sprints 27-52 volvieron obsoleto (marcado explícitamente abajo).

---

## 0. QUIÉN ES CARLOS Y CÓMO TRABAJAMOS

*(preservado de ACTIVOPOS_MASTER_V2.md §0 — no está en CLAUDE.md/SYSTEM_MAP/HANDOFF, sigue vigente)*

**Carlos Bolívar — Arquitecto de Software.** 20+ años en banca venezolana. Estratega, no programador. Usa voz-a-texto en móvil — habrá typos, interpretarlos bien, no corregirlos como si fueran errores de código. Directo: no acepta halagos, rodeos ni improvisación. Trabaja hasta cerrar el hilo, no se detiene a medias.

**Regla de oro — Cero fachadas** (coincide con Principio 5 de CLAUDE.md): el error más grave es código que parece funcionar pero no funciona. Prohibido: tablas en DB sin lógica conectada, botones sin acción real, endpoints con mock data, UI que simula funcionalidad sin backend. Si algo no está completo, decirlo explícitamente antes de commitear.

**Cómo se trabaja:** 4 CLIs en paralelo (CLI-A backend, CLI-B frontend, CLI-C calidad/auditoría — solo reporta, corrige solo P0 —, CLI-D features/testing/E2E). Cada CLI tiene scope exclusivo, no invade el de otro.

---

## 1. STACK SELLADO (fuente: CLAUDE.md)

```
Next.js 14.x       → Framework principal (App Router)
TypeScript 5.x     → Strict mode, nunca `any`
CSS Modules        → Sin Tailwind, sin styled-components, sin inline styles
Prisma 7.x         → ORM sobre MariaDB
MariaDB            → misma instancia VPS, DB: activopos
jose               → JWT HS256 (fail-closed, sin fallback secrets)
bcryptjs           → Hash de passwords
Framer Motion      → Animaciones y microinteracciones
Lucide React       → Iconos únicamente — NUNCA emojis en UI
Zod 4.x            → Validaciones (.issues NO .errors)
jsPDF              → Generación de tickets/facturas/cotizaciones PDF
html5-qrcode       → Scanner de código de barras en POS
sharp              → Procesamiento de imágenes WebP
```

**Multi-tenant (arquitectura real, confirmado en SYSTEM_MAP §0):** Prisma Client Extension (`src/lib/prisma-tenant.ts`) — inyecta `business_id` automáticamente en todo modelo que tenga esa columna, derivado del DMMF de Prisma en runtime, fail-closed (revienta al cargar si no resuelve ningún modelo, en vez de correr sin aislamiento).

---

## 2. REGLAS CRÍTICAS IRROMPIBLES (fuente: CLAUDE.md)

**Monetario — sellado:** todo valor monetario muestra USD **y** Bs simultáneamente, sin toggle:
```
$15.00
Bs. 8,951.73
```
`Bs = USD × rate_bcv` (dinámico, nunca hardcodeado). BCV API: `ve.dolarapi.com/v1/dolares/oficial`. Fallback: última tasa en `dollar_rates`. Nunca bloquear una operación por falta de tasa BCV.

**Paradigma de venta — irrompible:** cajero selecciona producto → ingresa CANTIDAD → sistema calcula `qty × price_usd × rate = total_bs`. Nunca el cajero ingresa monto en Bs para back-calcular cantidad. `sale_mode='weight'` → input decimal (kg). `sale_mode='unit'` → input entero.

**Inventario:** stock descuenta SOLO cuando `sale.status='paid'`. Tickets abiertos no afectan stock.

**Seguridad:**
- JWT fail-closed — sin fallback secrets, `algorithms: ['HS256']`.
- `business_id` siempre desde `getSession()`/`getAuthenticatedTenant()` — NUNCA del body ni query params.
- Rate limiting en login y todos los endpoints públicos.
- Slugs validados con regex antes de cualquier query a DB.
- `logo_path` solo acepta rutas `/uploads/` — nunca URLs externas.
- Precios en catálogo vienen del servidor — nunca del cliente (anti price-tampering).

**TypeScript:** `strict: true` — NUNCA `any`. Tipos explícitos en props/returns/parámetros. Zod v4 — `.issues` NO `.errors`. Interfaces en `src/types/` — nunca tipos inline en componentes.

**CSS:** solo CSS Modules — cero Tailwind, cero inline styles, cero hex hardcodeado fuera de `tokens.css`. Variables CSS (`var(--color-brand)`, `var(--space-4)`, etc.). Fraunces como display, Inter como cuerpo. Touch targets mínimo 44px. Sidebar SIEMPRE blanco (`#FAFBFC`), patrón Fina, independiente del tema.

**Next.js App Router:** Server Components por defecto, `'use client'` solo cuando se justifique. Lógica de negocio en API routes, nunca en componentes. Eager loading en Prisma, cero N+1. `include:` siempre explícito en queries con relaciones.

**Arquitectura:** sin `branch_id` en tablas transaccionales (v1). Un negocio = un tenant = una instalación activa. Multi-sucursal es Fase 2.

**Roles del sistema:**

| Rol | Acceso | Restricciones |
|---|---|---|
| super_admin | Todo el sistema | Solo Carlos Bolívar |
| admin | Todo excepto super_admin | No puede ver otros tenants |
| cashier | POS, Caja, Clientes | Sin finanzas, sin configuración |

**Lo que nunca se toca:** `C:\laragon\www\synticorex\` y `C:\laragon\www\syntimeat\` (producción activa de otros proyectos SYNTIdev). Panel `admin.activopos.com` (territorio exclusivo de Opus). El paradigma `qty × price` (nunca `bs → qty`). `git stash` que arriesgue perder trabajo de otro CLI en curso.

**⚠️ Explícitamente prohibido revivir (falló antes):** el sistema de 10 temas por segmento (`ACTIVOPOS_MASTER_V2.md §11`) causó *hydration mismatch* y quedó abandonado — CLAUDE.md lo marca expresamente como "NUNCA reutilizar el intento fallido de 10 segmentos con hydration mismatch". La paleta actual y única es **Persian Blue `#0038BD` + Carrot `#EF8E01`** (migración de teal completada Sprint 52, commit `1bbcc85`) — el estándar de "header teal" en reportería de `ACTIVOPOS_MASTER_V2.md §14` queda superado por esta paleta.

---

## 3. ESTADO ACTUAL DEL ROADMAP

*(fuente: `HANDOFF_Sprint52`, que heredó estas cifras de `HANDOFF_Sprint44-49` — Sprints 50-52 no tienen un % separado documentado en las fuentes disponibles; ver §4/§5/§6 para lo específico de esos sprints)*

```
Bloque 0: Cierre SYNTImeat          ✅ 100%
Bloque 1: Extracción reglas          ✅ 100%
Bloque 2: Rediseño visual            ✅ 100%
Bloque 3: Tenant Layer               ✅ 100% (123 endpoints sellados)
Bloque 4: Módulos                    ✅ 85%+ (proveedores ✅, planes ✅, modo servicio ✅ Sprint 51 — antes ⏳)
Bloque 5: Catálogo + Admin           ✅ 90% (catálogo ✅, admin ✅, registro ✅ verificado E2E en producción Sprint 52)
Bloque 6: Deploy producción          ⏳ 70% (VPS activo y verificado online Sprint 52, falta wildcard DNS)
Bloque 7: Lanzamiento                ⏳ 20% (falta demo cliente, primeros pagos)
```

**Progreso global (última cifra explícita disponible):** ~82% (Sprint 44-49). No hay una cifra recalculada para Sprint 52 en las fuentes — no inventar un número nuevo; el bloque 4 avanzó (modo de venta por segmento, antes "⏳", ahora ✅) desde entonces.

**Meta:** 95% para el 11 de julio de 2026 (fuente: `HANDOFF_Sprint44-49`).

---

## 4. MÓDULOS CERTIFICADOS Y SUS SPRINTS

*(fuente: `SYSTEM_MAP.md` §1-§2, actualizado con lo cerrado en Sprint 50-52 vía `HANDOFF_Sprint52`)*

### Certificados, sin cambios recientes
| Módulo | Evidencia |
|---|---|
| POS | `src/app/(dashboard)/pos/`, `src/lib/pos.ts` |
| Caja | `src/app/(dashboard)/caja/`, `/api/cash/*` |
| Ventas/Reportes | `/api/sales/*`, `/api/reports/*` — filtro `status:'paid'` confirmado |
| Inventario | `/api/inventory/*`, `InventoryEntry` con `entry_type` (ver §5) |
| Finanzas | `/api/finanzas/*` — CxC filtra `status:'credit'`, CxP separado |
| Catálogo digital | `/catalogo/[slug]`, stock en vivo vía `InventoryEntry.groupBy` |
| KDS | `/api/kds/orders` |
| Devoluciones | `/api/returns/*` |
| Cotizaciones | `/api/quotations/*` |

### Módulos nuevos (Sprints 35-52), con sprint de origen
| Módulo | Sprint | Descripción |
|---|---|---|
| `/registro` (onboarding self-service) | 35-44 | Wizard 7 pasos. **Verificado E2E en producción Sprint 52** (Playwright contra activopos.com, sin gaps P0). |
| Proveedores + Compras | 44.5 | CRUD proveedores + compras con `$transaction` atómica. |
| `entry_type` en InventoryEntry | 44.5 → **cerrado 50** | `purchase`/`adjustment`/`sale`/`return`. `sale` cableado en todos los decrementos de venta desde Sprint 50 (`b797989`). |
| Planes (límites) | Planes/44.5 | `PLAN_LIMITS` (trial/inicio/pro/business), `checkPlanLimit()`. |
| Plan enforcement — `create_supplier` | 50 | Cerrado (`cb672c7`). |
| Billing cycles | 50 | Descuentos por ciclo de pago (mensual/trimestral/semestral/anual), UI en TabPlan. |
| Cotización PDF profesional | 50 | RIF, dirección, correo, `quotation_footer` del negocio. |
| `pos_mode` + factura de servicio | 51 | Toggle ticket térmico 58mm / factura A4. `GET /api/sales/[id]/invoice` nuevo. Cierra el gap "sin decisión de documento" de auditorías previas. |
| PWA manifest fix | 52 | `manifest.json` 404 en producción, corregido. |
| SEO `/registro` | 52 | `metadata.title` propio. |
| Rebrand teal → Persian Blue | 52 | Sidebar y acentos migrados a `#0038BD`. |
| Admin Panel expandido | 44.5 | Tenants + stats + detalle, `super_admin`-only, no re-auditado en detalle desde entonces. |

---

## 5. DEUDA TÉCNICA ACTIVA (no ejecutar sin orden)

*(fuente: `SYSTEM_MAP.md` §7 + `HANDOFF_Sprint52`, consolidado)*

- `access_catalog` y `access_ai` sin guardia en ningún endpoint real (`checkPlanLimit` los define, nada los invoca) — un tenant `trial` puede usar catálogo digital e IA sin bloqueo.
- Encoding de tildes en PDF de cotizaciones — el gap reportado en Sprint 44-49 **no tiene evidencia de fix** en el código actual (sigue en fuente `helvetica` estándar de jsPDF sin cambios detectados). Verificar antes de dar por cerrado.
- `loadLogo` duplicado entre `quotations/[id]/pdf` y `sales/[id]/invoice` → extraer a `src/lib/pdf-utils.ts`.
- `SuccessTicketPanel.tsx` tiene `type PosMode` local — evaluar si unificar con `BusinessConfig`.
- Tenant `QA Test Registro SPRINT50` en producción — pendiente limpieza manual (creado en verificación E2E, sin endpoint de auto-limpieza).
- `Proveedores` sin `moduleKey` en el Sidebar — no participa del toggle de módulos por plan/config.
- `products/import` / `products/import-excel` crean `InventoryEntry` sin `entry_type` explícito (heredan default `'adjustment'`).
- `RateLimiterMemory` (todos los rate limiters) no es cluster-safe — pendiente Redis en producción.
- `pdf-report.ts` y `pdf-reports.ts` coexisten en `src/lib/` — nombre casi idéntico, no auditado si hay duplicación real.
- Desnormalización `business_id` en tablas hijas (`SaleItem`, `SalePayment`, etc.) — defensa en profundidad IDOR pendiente de evaluar.
- Compras a proveedores no generan deuda en CxP — módulos desconectados.

---

## 6. PRÓXIMAS TAREAS PRIORIZADAS

*(fuente: `HANDOFF_Sprint52` §Próximas tareas)*

1. **Cerrar `access_catalog`/`access_ai`** en plan enforcement — última pieza P1 abierta desde Sprint 44-49.
2. **Verificar/arreglar encoding de tildes** en PDF de cotizaciones.
3. **Wildcard DNS para catálogos** — bloquea Bloque 6 (Deploy producción) al 70%.
4. **Extraer `loadLogo`** a `src/lib/pdf-utils.ts`.
5. **Conectar Compras con CxP.**
6. **Limpieza manual** del tenant `QA Test Registro SPRINT50` en producción.
7. **Demo de cliente / primeros pagos** — Bloque 7 (Lanzamiento) en 20%, mayor impacto de negocio pendiente.

---

## 7. CONTEXTO PRESERVADO DE ACTIVOPOS_MASTER_V2.md (referencia, no bloqueante)

*(secciones de V2 que siguen siendo útiles como contexto de fondo — no representan trabajo pendiente activo salvo que se indique)*

**Análisis competitivo** (V2 §6, sin fecha de vencimiento):

| Competidor | Precio entrada | Fortaleza | Debilidad |
|---|---|---|---|
| SOFI | $15/mes | IA incluida, onboarding fácil | Sin dark, sin contexto VE, 1 usuario en Pro |
| Fina | ~$30/mes | Grid productos, diseño limpio | Sin dark, sin WhatsApp nativo |
| Venko | N/D | Reconocimiento de marca | Genérico, sin contexto VE |
| Control Total | N/D | Completo | Complejo, viejo |
| Negotiale | N/D | Verde, conocido | Sin POS real |

**Posicionamiento sellado (Sprint 21, V2 §14):**
> "ActivoPOS es tu sistema de control de ventas e inventario. No reemplaza tu facturación SENIAT — la complementa."
Usar en landing, onboarding y materiales de venta. No mezclar con terminología fiscal/SENIAT.

**Landing SEO por segmento (V2 §12):** estrategia aprobada Sprint 21, `activopos.com/para-<segmento>` (carnicería, ferretería, restaurante, etc.). **Explícitamente pausada hasta post-lanzamiento**, cuando haya 2-3 clientes reales por segmento. No bloquea el desarrollo del POS.

**Accesos y seeds (V2 §7):**
| Item | Valor |
|---|---|
| Local | `C:\laragon\www\activopos` |
| VPS | `187.124.241.213` |
| Producción | `activopos.com` |
| GitHub | `syntidev/activopos` |
| BCV API | `ve.dolarapi.com/v1/dolares/oficial` |
| Seeds dev | `admin@activopos.com` / `cajero@activopos.com` (passwords en V2, no repetidos aquí) |

**⚠️ Contenido de V2 superado, no usar como referencia activa:** §2-§3 (roadmap Sprint 8-26, completado hace tiempo), §10 (asignación de skills por CLI — usar la versión actual de `CLAUDE.md`, que incluye `database-migrations`, `api-design`, `e2e-testing`, `deployment-patterns` y el plugin `ecc`, ausentes en V2), §11 (10 temas por segmento — **falló, ver §2 arriba**), §14 (header teal en reportería — superado por Persian Blue Sprint 52), §15 (plan maestro Sprint 22-26 — completado).

---

*Este documento reemplaza a `ACTIVOPOS_MASTER_V2.md` como árbitro activo. V2 se conserva sin modificar como archivo histórico.*
