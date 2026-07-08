# ROADMAP ActivoPOS v2 — Estado Real al 7 Jul 2026

> Documento de solo lectura, generado por síntesis de 7 fuentes (no se auditó código directamente en esta pasada — ver notas de fuente por sección). Los 2 nombres de archivo pedidos `HANDOFF_Sprint77_Sesion_7Jul2026.md` y `HANDOFF_Sprint64-76_Sesion_5Jul2026.md` **no existen** en `.doc/` — su contenido más reciente equivalente vive en `.doc/SYSTEM_MAP.md` (actualizado 2026-07-08, Sprint 78), usado aquí como fuente principal por ser la más nueva y basada en lectura directa de código.
>
> Fuentes usadas: `ACTIVOPOS_MASTER.md` (Sprint 52) · `SYSTEM_MAP.md` (Sprint 78) · `HANDOFF_Sprint55-63_Sesion_5Jul2026.md` · `HANDOFF_Sprint44-49_Sesion_1Jul2026.md` · `ACTIVOPOS_ROADMAP_STATUS_29Jun2026.md` · `PLAN_EJECUCION_Jul2026.md` · `CONNECTIVITY_AUDIT_Jul2026.md`.
>
> Donde una fuente más nueva contradice una más vieja, se marca explícitamente abajo — no se resuelve la contradicción por conjetura.

---

## COMPLETADO ✅

*(fuente principal: `SYSTEM_MAP.md` Sprint 78, "MÓDULOS — ESTADO VERIFICADO", confianza ALTA salvo que se indique)*

| Módulo | Evidencia / Sprint de origen |
|---|---|
| Autenticación / sesión | JWT HS256 fail-closed, `middleware.ts` gating por rol |
| Dashboard / escritorio | `/api/dashboard/{kpis,charts,credit-summary}` — rediseño completo Sprint 55-63 |
| Productos (CRUD, imágenes, importación) | Verificado con Prisma real |
| POS (venta, descuento, crédito, variantes) | Validación atómica de stock, PIN, selector de variantes conectado |
| Caja (apertura, cierre, historial) | Confianza MEDIA — no releída línea por línea Sprint 78 |
| Pedidos | `$transaction` real en creación, cobrar/cancelar/whatsapp |
| Inventario / movimientos | `findMany` + `$transaction` real, consumo interno (`entry_type='internal_use'`) |
| Clientes | CRUD + historial + balance vía `$queryRaw` |
| Proveedores + Compras | CRUD + compras con `$transaction` atómica, Sprint 44.5 |
| Finanzas (CxC, CxP, P&L, punto de equilibrio) | `$queryRaw`/Prisma real, export Excel conectado |
| Reportes — día/rango/Excel | Conectados (export-pdf es excepción, ver EN CURSO) |
| Catálogo digital — público | Hero, variantes, checkout, delivery, panel info negocio, Prisma real |
| Analytics | `top-products`/`trends` con `$queryRaw` real |
| Cotizaciones | CRUD + conversión a venta + PDF, transacciones reales |
| Devoluciones | `$transaction` real (return + items + ajuste stock) |
| Usuarios / permisos | CRUD + reset-pin + change-password, gating por rol |
| Onboarding (`/registro`, 7 pasos) | **Verificado E2E en producción Sprint 52** vía Playwright, sin gaps P0 |
| Notificaciones | CRUD + Web Push real |
| Super Admin / Panel Admin | Route group separado, gating exclusivo `super_admin`; invoices/tickets backend real (Sprint 55-63, elimina fachada Sprint 54) |
| Landing page / marketing — segmentos SEO | Segmentos, planes, FAQ, hero — Prisma real (Sprint 77-78) |
| Integración BCV | Fallback dual dolarapi→brecha-cambiaria, cache DB 1h |
| Integración pagos | `config/payment-methods` CRUD real |
| KDS, `pos_mode`+factura servicio, cotización PDF profesional, tasa manual + `RateContext` global | Certificados en sprints previos (44.5-63), sin regresión reportada |
| Sistema de variantes de producto — bugs P0 | **Cerrado Sprint 77-78** (commit `9519d58`): overselling corregido (valida `variant.stock` en `$transaction`), pérdida de stock al anular corregida, `outOfStock` en catálogo por variante correcto tras 3 iteraciones |
| Tenant Layer | 123+ endpoints sellados, Prisma Client Extension DMMF-driven, fail-closed |

**⚠️ Contradicción entre fuentes, no resuelta por conjetura:** `HANDOFF_Sprint55-63` (5 Jul) marca la **landing page como bloqueante pendiente** ("la landing actual es fachada"). `SYSTEM_MAP.md` Sprint 78 (8 Jul, 3 días después) la marca **✅ COMPLETADO** ("Landing page / marketing ✅ COMPLETADO — Segmentos SEO, planes, FAQ, hero"). Aparenta haberse resuelto en Sprint 64-77 (ventana sin handoff propio localizado) — verificar visualmente en `activopos.com` antes de asumir cerrado para el demo.

---

## EN CURSO / PARCIAL ⚠️

*(fuente: `SYSTEM_MAP.md` §1-§2, Sprint 78)*

| Feature | Gap conocido |
|---|---|
| Productos — variantes | P0 de overselling/anulación **cerrados**; **P1 abierto (DT-09)**: stock agregado del producto (`InventoryEntry`) no se resincroniza tras venta de variante — `GET /api/products` queda con `stock.net_qty` congelado para productos con variantes |
| Reportes | `GET /api/reports/export-pdf` implementado y funcional pero **huérfano** — ninguna UI lo invoca (DT-11) |
| Catálogo digital — admin | Conectado a `/api/catalogo/metrics` y `bulk-visibility`; resto de la página **no auditado a fondo** |
| Plan enforcement | Solo 2 de 5 acciones de `checkPlanLimit()` invocadas en endpoints reales (`create_product`, `create_user`); `access_catalog`/`access_ai` sin guardia (DT-02); `create_supplier` sí se cerró Sprint 50 |
| Integración WhatsApp | Solo genera link `wa.me/...` — sin API oficial de Meta, documentado como pendiente en `N8N_MONTHLY_REPORT_WORKFLOW.md` (por diseño, no bug) |
| Wiring de tasa activa | `RateContext`/tasa manual existen, pero **29 call-sites** de ventas/POS/catálogo siguen usando `getBcvRate()` directo — el override manual del tenant no afecta los cálculos reales de venta. Marcado como **riesgo monetario, requiere aprobación de Carlos antes de ejecutar** (`HANDOFF_Sprint55-63`) |
| Documentación interna | `.doc/CLAUDE.md` (v3.0) coexiste con `CLAUDE.md` raíz (v3.1/3.2) y **contradice reglas activas** (ej. dirección del sidebar) — riesgo de que un agente lea el archivo equivocado (DT-13) |

---

## PENDIENTE PRIORITARIO 🔴

*(lo que bloquea o pone en riesgo el demo del 11 julio — fuente: `HANDOFF_Sprint55-63` §Pendientes + `SYSTEM_MAP.md` DT-12, ambas post-Sprint-49)*

1. **Verificar landing page en producción** — ver contradicción documentada arriba; confirmar visualmente antes del demo, no asumir cerrada solo por `SYSTEM_MAP`.
2. **E2E completo como cliente en producción** — flujo registro → producto → catálogo → venta → reporte. Ninguna fuente confirma que se haya ejecutado y cerrado tras `HANDOFF_Sprint55-63` (que lo listaba como bloqueante).
3. **Limpieza de datos de la cuenta demo (DT-12, Sprint 78, dato no código)** — ~126 productos de prueba (`CLIC*`/`SP24*`/`SP25*`/`CLI-C19*`) en `business_id=1` local, con al menos 1 caso confirmado de divergencia real de stock (`Camisa Polo`: `variant.stock`=60 vs `InventoryEntry`=10 congelado). Debe limpiarse antes de mostrar esa cuenta al cliente.
4. **Tenant `QA Test Registro SPRINT50`** en producción — pendiente limpieza manual (creado en verificación E2E, sin endpoint de auto-limpieza). Mencionado en `ACTIVOPOS_MASTER.md`, sin confirmación posterior de cierre.
5. **Auditoría completa CLI-C** (OWASP, tenant isolation, límites de plan, console.errors en producción) — listada como pendiente en `HANDOFF_Sprint55-63`, sin evidencia de ejecución posterior en las fuentes leídas.

---

## PENDIENTE POST-DEMO 📋

*(fuente: `HANDOFF_Sprint55-63` §Puede esperar + `ACTIVOPOS_MASTER.md` §6 + `SYSTEM_MAP.md` §6, consolidado)*

- Desnormalización de `business_id` en tablas hijas (`SaleItem`, `SalePayment`, etc.) — defensa en profundidad IDOR.
- Conectar Compras con CxP (compras a proveedores no generan deuda automática).
- Wiring de los 29 call-sites de tasa activa a `getActiveRate()` — riesgo monetario, requiere aprobación de Carlos.
- Redis para rate limiters (`RateLimiterMemory` no es cluster-safe, DT-05).
- Paginación de inventario server-side (actualmente client-side, DT-14 en `HANDOFF_Sprint55-63`).
- Módulo de devaluación de margen (diferenciador post-lanzamiento, 10-12h estimadas).
- Exportar Excel en tabs Ventas e Inventario.
- Teclado numérico móvil (`inputMode="numeric"`) en todo el sistema.
- Módulo de métodos de cobro / datos bancarios del negocio.
- Dual brand header (logo cliente + ActivoPOS).
- SEO schema.org / sitemap para catálogo público.
- Landing SEO por segmento adicional (`activopos.com/para-<segmento>`) más allá de lo ya construido Sprint 77-78 — la estrategia original (V2 §12) la pausaba "hasta post-lanzamiento, cuando haya 2-3 clientes reales por segmento"; el trabajo de Sprint 77-78 aparenta haber adelantado esto — verificar con Carlos si fue una decisión explícita o un adelanto no planeado.

---

## DEUDA TÉCNICA 🔧

*(fuente: `SYSTEM_MAP.md` §6, Sprint 78 — la más reciente; se marca cuál sigue abierta vs. cerrada en sprints previos)*

| ID | Severidad | Descripción | Sprint origen |
|---|---|---|---|
| DT-02 | P1 | `access_catalog`/`access_ai` de `checkPlanLimit()` siguen sin invocarse en ningún endpoint real | 44.5, sin cambios |
| DT-03 | P2 | `Proveedores` sigue sin `moduleKey` en el sistema de toggle de módulos por plan/config | 44.5, sin cambios |
| DT-05 | P2 | `RateLimiterMemory` (todos los rate limiters) no es cluster-safe — pendiente Redis en producción | histórico |
| DT-08 | P2 | Deploy VPS usó `db push` en vez de `migrate deploy` — riesgo de drift en `_prisma_migrations`, no reverificado (sin acceso VPS en la auditoría Sprint 78) | 63 |
| DT-09 | P1 | Stock agregado de producto (`InventoryEntry`) no se resincroniza tras venta de variante | 78, nuevo |
| DT-10 | P2 | Formulario de producto no oculta "Stock Inicial" cuando `hasVariants=true` | 78, nuevo |
| DT-11 | P2 | `GET /api/reports/export-pdf` huérfano — ninguna UI lo invoca | 78, nuevo |
| DT-12 | P2 | ~126 productos de prueba en `business_id=1` local con divergencia real de stock — limpiar antes de demo (dato, no código) | 78, nuevo |
| DT-13 | P3 | `.doc/CLAUDE.md` (v3.0) contradice reglas activas de `CLAUDE.md` raíz — riesgo de que un agente aplique reglas obsoletas | 78, nuevo |

**Cerradas entre Sprint 44.5 y 78** (no re-litigar): DT-01 (`entry_type='sale'` en decrementos de venta, cerrado Sprint 50, commit `b797989`), DT-07 (leak cross-tenant de tasa manual, cerrado Sprint 63, commit `e94d1f0`), DT-06 previo (duplicación `pdf-report.ts`/`pdf-reports.ts` — descartada Sprint 78, el archivo singular no existe).

**Deuda técnica declarada en fuentes más viejas, sin confirmación posterior de cierre** (verificar antes de asumir resuelta):
- Encoding de tildes en PDF de cotizaciones (reportado `HANDOFF_Sprint44-49`, `ACTIVOPOS_MASTER.md` dice "sin evidencia de fix" a Sprint 52 — no vuelve a aparecer en `SYSTEM_MAP.md` Sprint 78, podría estar cerrado o simplemente no re-auditado).
- `products/import`/`products/import-excel` crean `InventoryEntry` sin `entry_type` explícito (heredan default `'adjustment'`) — presente desde Sprint 44.5, no mencionado en Sprint 78 (probablemente no re-auditado, no necesariamente cerrado).

---

## DESCARTADO / DECIDIDO NO HACER ❌

*(fuente: `ACTIVOPOS_MASTER.md` §2/§7 — decisiones explícitas, preservadas de `ACTIVOPOS_MASTER_V2.md`)*

- **Sistema de 10 temas por segmento** — causó *hydration mismatch*, quedó abandonado. `CLAUDE.md` raíz lo marca expresamente: "NUNCA reutilizar el intento fallido de 10 segmentos con hydration mismatch".
- **Header teal en reportería** — superado por la paleta Persian Blue `#0038BD` + Carrot `#EF8E01` (migración completada Sprint 52, commit `1bbcc85`). No revivir el estándar teal de documentos históricos.

---

*Documento generado por síntesis de lectura — no reemplaza a `ACTIVOPOS_MASTER.md` como árbitro (esa jerarquía la define `CLAUDE.md` raíz). Útil como mapa de estado real cruzando múltiples sprints; re-verificar contra código antes de tomar decisiones de negocio sobre cualquier punto marcado como contradicción o "no confirmado".*
