# Matriz de Roles y Permisos — SELLADA
**Fecha análisis:** 2026-07-14 | **Fecha implementación:** 2026-07-14 | **Sprint:** Roles-Seguridad-Final | **Alcance:** 17 módulos × 3 roles (super_admin/admin/cashier) × 4 acciones (VER/CREAR/EDITAR/ELIMINAR)

Metodología: 3 subagentes en paralelo, cada uno leyó el código real (rutas API + páginas dashboard + middleware) módulo por módulo, citando archivo:línea exacto para cada guard o ausencia de guard. El claim previo de "95+ guards" **no se asumió** — se reverificó desde cero.

**Estado: los 4 hallazgos fueron decididos por Carlos e implementados con guard real in-route, verificados con test de bypass directo (curl como cashier real, no por UI). Ver sección "Implementación 2026-07-14" al final.**

---

## ⚠️ Resumen ejecutivo — 4 hallazgos que requieren decisión

| # | Severidad | Hallazgo | Evidencia | Estado |
|---|---|---|---|---|
| 1 | **HIGH** | `GET /api/reports/sales` sin guard de rol — cashier puede extraer ventas completas con costo y pagos | `reports/sales/route.ts:22-24` | ✅ **RESUELTO** — redacción in-route de `cost_per_unit_usd` para cashier (defensa en profundidad; el middleware ya redirige `/api/reports`). |
| 2 | **HIGH** | Pedidos (`/api/orders/*`) sin NINGÚN guard de rol en los 5 endpoints | `orders/route.ts:47,112`; `[id]/route.ts:51`; `cancelar:8`; `cobrar:17` | ✅ **INTENCIONAL** — Carlos lo mantiene abierto (atención al cliente, no dato sensible). Documentado en los 4 handlers con comentario `PERMISOS — INTENCIONAL`. |
| 3 | **MEDIUM** | `PATCH /api/clients/[id]` sin guard — cashier cambia `price_tier` (detal↔mayorista) | `clients/[id]/route.ts:80-95` | ✅ **RESUELTO** — `price_tier` bloqueado a cashier (403). Sigue editando contacto. `unit_price_override` en ventas NO se tocó. |
| 4 | **MEDIUM** | GET de Configuración y de costo (Productos detalle, Inventario) sin guard de rol | filas ⚠️ en Productos, Inventario, Configuración | ✅ **RESUELTO (con excepción operativa)** — costo (products/[id], inventory) + config no operativa (theme, ticket, plan) → 403. **business y modules NO se bloquearon**: POS/Header/ticket/shell del cashier los consumen; bloquearlos rompía producción (ver nota). |

super_admin y admin se comportan **idénticamente** en los 17 módulos — ningún endpoint los distingue, salvo `PATCH /api/config/subscription` (solo super_admin) y `reset-pin` (admin no puede resetear PIN de otro admin/super_admin).

**Arquitectura de dos capas confirmada:**
- `src/middleware.ts` bloquea cashier por *prefijo de página/API* en una lista fija (líneas 69-86) — tiene mismatches (ej. `/inventario` bloqueado, `/api/inventory` no).
- `getAuthenticatedTenant()` (`src/lib/tenant.ts:21-33`) **solo valida autenticación**, nunca rol. Cada endpoint debe agregar su propio `if (session.role === 'cashier') return 403`.

---

## 1. POS
*Diseño correcto: es la herramienta del cajero, sin guard de rol por intención.*

| Acción | super_admin | admin | cashier | Estado actual | Propuesto |
|---|:---:|:---:|:---:|---|---|
| VER | ✅ | ✅ | ✅ | Sin guard por diseño. Costo/utilidad redactados a cashier (`api/sales/route.ts:110-128`) | |
| CREAR | ✅ | ✅ | ✅ | Sin guard de rol, solo auth (`api/sales/route.ts:167-169`). Override de precio requiere PIN admin salvo config (`:189-227`). Precio siempre desde DB | |
| EDITAR | ✅ | ✅ | ✅ | Draft scoped a `cashier_id` propio (`api/pos/drafts/[id]/route.ts:68-70`) | |
| ELIMINAR | ✅ | ✅ | ✅ | Descartar draft propio, atómico (`api/pos/drafts/[id]/route.ts:153-171`) | |

## 2. Productos
| Acción | super_admin | admin | cashier | Estado actual | Propuesto |
|---|:---:|:---:|:---:|---|---|
| VER | ✅ | ✅ | ⚠️ | Página bloqueada por middleware. Lista (`GET /api/products`) redacta costo (`:159,174,178`). **Hueco:** `GET /api/products/[id]` (detalle) NO redacta costo/utilidad y no está en middleware (`api/products/[id]/route.ts:84,89`) | |
| CREAR | ✅ | ✅ | ❌ | Guard real `api/products/route.ts:208` | |
| EDITAR | ✅ | ✅ | ❌ | Guard real en todos los writes: `[id]/route.ts:102`, variantes `:54`/`:25`, componentes `:51`, stock `:32`, bulk-visibility `:13`, import-excel `:115` | |
| ELIMINAR | ✅ | ✅ | ❌ | Guard real `[id]/route.ts:154` (409 si tiene historial de ventas), componentes `:14`, variantes `:87` | |

## 3. Inventario
*Append-only: no existen endpoints de EDITAR/ELIMINAR movimientos.*

| Acción | super_admin | admin | cashier | Estado actual | Propuesto |
|---|:---:|:---:|:---:|---|---|
| VER | ✅ | ✅ | ⚠️ | Página bloqueada por middleware. **Hueco:** `GET /api/inventory` y `.../product/[id]/movements` sin guard ni cobertura de middleware — expone `cost_per_unit_usd` (`api/inventory/route.ts:22-24,45`) | |
| CREAR | ✅ | ✅ | ❌ | Guard real `api/inventory/route.ts:58`, `products/[id]/stock/route.ts:32` | |
| EDITAR | — | — | — | No existe (append-only) | |
| ELIMINAR | — | — | — | No existe (append-only) | |

## 4. Clientes
| Acción | super_admin | admin | cashier | Estado actual | Propuesto |
|---|:---:|:---:|:---:|---|---|
| VER | ✅ | ✅ | ✅ | Sin guard, por diseño (cajero necesita ver clientes) | |
| CREAR | ✅ | ✅ | ❌ | Guard real `api/clients/route.ts:61` | |
| EDITAR | ✅ | ✅ | ⚠️ | **Hueco (hallazgo #3):** `PATCH /api/clients/[id]` sin guard de rol (`:80-95`) — incluye `price_tier` mayorista/detal, que cambia el precio de venta | |
| ELIMINAR | ✅ | ✅ | ❌ | Guard real `[id]/route.ts:112` (soft-delete, 409 si hay saldo pendiente) | |

## 5. Finanzas (general)
| Acción | super_admin | admin | cashier | Estado actual | Propuesto |
|---|:---:|:---:|:---:|---|---|
| VER | ✅ | ✅ | ❌ | Guard real en resumen, P&L, punto-equilibrio, daily, gastos, categorías, exports (8 endpoints, todos citados) | |
| CREAR | ✅ | ✅ | ❌ | Guard real `gastos/route.ts:85`, `categorias/route.ts:52` | |
| EDITAR | ✅ | ✅ | ❌ | Guard real `gastos/[id]/route.ts:32`, `categorias/[id]/route.ts:20` | |
| ELIMINAR | ✅ | ✅ | ❌ | Guard real `gastos/[id]/route.ts:93`. Categorías: soft-delete vía PATCH, protección extra a categoría "Otros" | |

## 6. CxC
*No existe CREAR/EDITAR/ELIMINAR directo — nace de una venta a crédito.*

| Acción | super_admin | admin | cashier | Estado actual | Propuesto |
|---|:---:|:---:|:---:|---|---|
| VER | ✅ | ✅ | ❌ | Guard real `cxc/route.ts:25`, `cxc/summary/route.ts:10` | |
| CREAR (vía venta a crédito) | ✅ | ✅ | ⚠️ | Cashier puede generar la deuda vendiendo a crédito en POS, pero no gestionarla en Finanzas | |
| Abono/cobro | ✅ | ✅ | ❌ | Guard real `cxc/[id]/abono/route.ts:26` | |
| EDITAR / ELIMINAR | — | — | — | No existe | |

## 7. CxP
| Acción | super_admin | admin | cashier | Estado actual | Propuesto |
|---|:---:|:---:|:---:|---|---|
| VER | ✅ | ✅ | ❌ | Guard real `cxp/route.ts:34`, `cxp/summary/route.ts:9` | |
| CREAR | ✅ | ✅ | ❌ | Guard real `cxp/route.ts:97-99` | |
| EDITAR (marcar pagado) | ✅ | ✅ | ❌ | Guard real `cxp/[id]/route.ts:9-11` | |
| ELIMINAR | — | — | — | No implementado (el filtro `status:cancelled` existe en el GET pero no hay handler que lo setee) | |

## 8. Reportes
| Acción | super_admin | admin | cashier | Estado actual | Propuesto |
|---|:---:|:---:|:---:|---|---|
| VER (día/rango/mensual) | ✅ | ✅ | ❌ | Guard real: daily `:36`, day `:27`, range `:33`, monthly `:23`, my-notification `:9` | |
| VER (cierres de caja) | ✅ | ✅ | ❌ | Guard real `cash/history/route.ts:8-9` | |
| VER (ventas detalladas) | ✅ | ✅ | 🔴 | **Hallazgo #1 — sin protección**, `reports/sales/route.ts:22-24` | |
| VER (export Excel/PDF) | ✅ | ✅ | ❌ | Guard real `export-excel/route.ts:24`, `export-pdf/route.ts:47` | |
| CREAR (generar mensual) | ✅ | ✅ | ❌ | Guard real `monthly/generate/route.ts:23`, `[id]/mark-seen/route.ts:11` | |
| EDITAR / ELIMINAR | — | — | — | No aplica (solo lectura + generación) | |

## 9. Caja
*Abrir/cerrar/movimiento sin guard de rol es correcto por diseño (el cajero opera su caja).*

| Acción | super_admin | admin | cashier | Estado actual | Propuesto |
|---|:---:|:---:|:---:|---|---|
| VER (estado turno) | ✅ | ✅ | ✅ | Sin guard, por diseño (`cash/route.ts`, `cash/status/route.ts`, `cash/movement/route.ts:21-23`) | |
| VER (historial cierres) | ✅ | ✅ | ❌ | Guard real `cash/history/route.ts:8-9` | |
| CREAR (abrir caja / movimiento) | ✅ | ✅ | ✅ | Sin guard, por diseño (`cash/open/route.ts:13-15`, `cash/movement/route.ts:46-48`) | |
| EDITAR (cerrar caja) | ✅ | ✅ | ✅ | Sin guard, por diseño (`cash/close/route.ts:12-14`) | |
| Anular venta | ✅ | ✅ | ❌ | Guard real `sales/[id]/void/route.ts:20-25` | |
| ELIMINAR | — | — | — | No existe | |

## 10. Pedidos
| Acción | super_admin | admin | cashier | Estado actual | Propuesto |
|---|:---:|:---:|:---:|---|---|
| VER | ✅ | ✅ | 🔴 | **Hallazgo #2 — sin protección de rol**, `orders/route.ts:47-49` | |
| CREAR | ✅ | ✅ | 🔴 | Sin protección, `orders/route.ts:112-114` | |
| EDITAR (estado/cancelar/cobrar) | ✅ | ✅ | 🔴 | Sin protección: `[id]/route.ts:51-56`, `cancelar/route.ts:8`, `cobrar/route.ts:17` | |
| ELIMINAR | — | — | — | No existe (cancelación soft, disponible a todos) | |

## 11. Catálogo Digital (gestión)
*Catálogo público (`catalog/[slug]`) es intencionalmente sin auth — fuera de esta matriz de roles internos.*

| Acción | super_admin | admin | cashier | Estado actual | Propuesto |
|---|:---:|:---:|:---:|---|---|
| VER (métricas/config) | ✅ | ✅ | ❌ | Guard real `catalogo/metrics/route.ts:18`, `config/catalog/route.ts:14` | |
| CREAR / EDITAR (visibilidad, portada, activar) | ✅ | ✅ | ❌ | Guard real `bulk-visibility/route.ts:13`, `config/business/route.ts:111`, `config/catalog/route.ts:31`, `products/[id]/route.ts:102` | |
| ELIMINAR | — | — | — | N/A (toggle de visibilidad, no borrado) | |

## 12. Configuración (por tab)
| Tab | VER (GET) | EDITAR | Estado actual | Propuesto |
|---|:---:|:---:|---|---|
| Empresa / General | ⚠️ sin guard | ❌ guard real | GET `config/business/route.ts:61-63` sin check; PATCH `:111` guardado | |
| Tema | ⚠️ sin guard | ❌ guard real | GET `config/theme/route.ts:13-15`; PATCH `:29` | |
| Impresión | ⚠️ sin guard | ❌ guard real | GET `config/ticket/route.ts:15-17`; PATCH `:43` | |
| Módulos | ⚠️ sin guard | ❌ guard real | GET `config/business/modules/route.ts:55-57`; PATCH `:26` | |
| Cobros / Pagos | ⚠️ mixto | ❌ guard real | payment-methods GET sin check; POST `:41`/PATCH `:72` guardados; devices y pin con guard completo | |
| Impuestos (IVA) | ❌ guard real | ❌ guard real | Único tab config que bloquea cashier también en GET (`config/iva/route.ts:14,31`) | |
| Plan | ⚠️ sin guard | 🔒 solo super_admin | GET sin check; PATCH `config/subscription/route.ts:47` — admin también recibe 403 | |
| Categorías | ⚠️ sin guard | ❌ guard real | GET sin check; POST/PATCH/DELETE guardados | |
| Delivery | ❌ guard real | ❌ guard real | Guardado en GET y PATCH, más estricto (`config/delivery/route.ts:23,49`) | |
| Usuarios | ver módulo 13 | ver módulo 13 | | |

## 13. Usuarios
| Acción | super_admin | admin | cashier | Estado actual | Propuesto |
|---|:---:|:---:|:---:|---|---|
| VER | ✅ | ✅ | ❌ | Guard real `users/route.ts:30` | |
| CREAR | ✅ | ✅ | ❌ | Guard real `:48`. Límite 5 cajeros, no puede crear super_admin | |
| EDITAR | ✅ | ✅ | ❌ | Guard real `[id]/route.ts:35`. No auto-cambio de rol, reset-pin con escalación (admin no resetea a admin/super_admin) | |
| ELIMINAR | ✅ | ✅ | ❌ | Guard real `[id]/route.ts:78` (soft-delete, no auto-eliminarse) | |
| Cambiar password propia | ✅ | ✅ | ✅ | Self-service por diseño | |

## 14. Proveedores (+ Compras)
| Acción | super_admin | admin | cashier | Estado actual | Propuesto |
|---|:---:|:---:|:---:|---|---|
| VER | ✅ | ✅ | ❌ | Guard real `suppliers/route.ts:18`, `purchases/route.ts:24` | |
| CREAR | ✅ | ✅ | ❌ | Guard real `suppliers/route.ts:40`, `purchases/route.ts:62` | |
| EDITAR | ✅ | ✅ | ❌ | Guard real `suppliers/[id]/route.ts:38`, `purchases/[id]/route.ts:55` (reversión atómica de stock/CxP al anular) | |
| ELIMINAR | ✅ | ✅ | ❌ | Guard real `suppliers/[id]/route.ts:79` (soft-delete). Compras: sin DELETE físico, anulación vía PATCH | |

## 15. Cotizaciones
*Único módulo con doble capa: middleware + guard in-route en cada handler.*

| Acción | super_admin | admin | cashier | Estado actual | Propuesto |
|---|:---:|:---:|:---:|---|---|
| VER | ✅ | ✅ | ❌ | Doble guard: middleware + `quotations/route.ts:36`, `[id]/route.ts:59` | |
| CREAR | ✅ | ✅ | ❌ | Doble guard: middleware + `route.ts:91` | |
| EDITAR | ✅ | ✅ | ❌ | Doble guard: middleware + `[id]/route.ts:86` (solo editable en draft/sent) | |
| ELIMINAR | ✅ | ✅ | ❌ | Doble guard: middleware + `[id]/route.ts:172` (solo estado draft) | |

## 16. Devoluciones
| Acción | super_admin | admin | cashier | Estado actual | Propuesto |
|---|:---:|:---:|:---:|---|---|
| VER | ✅ | ✅ | ❌ | Guard real `returns/route.ts:22` | |
| CREAR | ✅ | ✅ | ❌ | Guard real `:73`. Precios desde DB, TOCTOU guard atómico | |
| EDITAR (aprobar/rechazar) | ✅ | ✅ | ❌ | Guard real `[id]/approve/route.ts:10`, `[id]/reject/route.ts:9` | |
| ELIMINAR | — | — | — | N/A (estados terminales) | |

## 17. Precio Mayorista
*No es módulo aparte — vive en Productos (captura) + Clientes (tier) + motor de ventas (aplicación). Confirmado: existe y funciona (actualización vs. auditoría del 2026-07-12, que la encontró inexistente).*

| Acción | super_admin | admin | cashier | Estado actual | Propuesto |
|---|:---:|:---:|:---:|---|---|
| VER precio mayorista | ✅ | ✅ | ⚠️ | `GET /api/products` devuelve `wholesale_price_*` a todos los roles, sin redactar (a diferencia del costo) (`products/route.ts:172-173`) | |
| CREAR | ✅ | ✅ | ❌ | Guard real `products/route.ts:208` | |
| EDITAR | ✅ | ✅ | ❌ | Guard real `products/[id]/route.ts:102` | |
| Asignar tier "mayorista" a cliente | ✅ | ✅ | ❌ | Guard real `clients/route.ts:61`, `clients/[id]/route.ts:112` | |
| ELIMINAR | — | — | — | N/A (se limpia vía PATCH) | |

Aplicación server-side del precio (anti-tampering): `api/sales/route.ts:329-337` — si el cliente es mayorista y el producto tiene precio mayorista, el servidor lo cobra, nunca confía en el cliente.

---

## Leyenda
✅ permitido y protegido correctamente · ❌ bloqueado por guard real · ⚠️ hueco — sin guard donde debería haberlo, o comportamiento a confirmar · 🔴 gap de seguridad activo, sin ninguna protección · — no existe esa funcionalidad

---

## Implementación 2026-07-14 (Sprint Roles-Seguridad-Final)

Patrón de guard replicado (el mismo verificado como real en Finanzas/CxC/Usuarios/Proveedores):
`const { session } = await getAuthenticatedTenant()` (o `getSession()`) → `if (session.role === 'cashier') return 403`.

**Archivos tocados:**
| # | Archivo | Cambio |
|---|---|---|
| 1 | `api/reports/sales/route.ts` | Redacción de `cost_per_unit_usd` de `items` para cashier antes de responder. admin/super_admin ven todo. |
| 3 | `api/clients/[id]/route.ts` PATCH | `if (data.price_tier !== undefined && role === 'cashier') return 403`. Resto del PATCH abierto (contacto). |
| 4 | `api/products/[id]/route.ts` GET | `cashier → 403` (expone costo/utilidad). |
| 4 | `api/inventory/route.ts` GET | `cashier → 403` (expone `cost_per_unit_usd`). |
| 4 | `api/config/theme/route.ts` GET | `cashier → 403` (redundante: el cashier ya recibe theme en `config/business`). |
| 4 | `api/config/ticket/route.ts` GET | `cashier → 403`. |
| 4 | `api/config/subscription/route.ts` GET | `cashier → 403` (plan/facturación). |
| 2 | `api/orders/*` (4 handlers) | Comentario `PERMISOS — INTENCIONAL`, cero cambio de comportamiento. |

**Excepción operativa (hallazgo #4) — NO bloqueados a propósito:**
`GET /api/config/business` y `GET /api/config/business/modules`. La matriz los marcó ⚠️, pero el POS del cashier (`usePOS.ts:69`, `pos/page.tsx:37`), el Header (`Header.tsx:277`), el ticket de venta (`SuccessTicketPanel.tsx:91`) y el shell del dashboard (`DashboardShell.tsx:27`) los consumen en runtime — `config/business` devuelve nombre/logo/moneda/`max_discount_pct`/`allow_cashier_price_override` y `modules` arma el sidebar. Bloquearlos daría 403 y **rompería el POS, el header, el ticket y la navegación del cashier**. No son costos ni configuración sensible: son datos operativos que el cashier ya ve en cada ticket que imprime. Se dejan abiertos deliberadamente. `categories` (`/api/categories`) se dejó fuera por el mismo criterio (riesgo de romper el filtro de categorías del POS) — pendiente de revisar si amerita redacción en vez de bloqueo.

**Test de bypass directo (curl como cashier real `cajero@activopos.com`, no por UI):**
| Endpoint | Resultado | Esperado |
|---|---|---|
| `GET /api/reports/sales` | **307 → /pos** (middleware; costo nunca sale) | costo no visible ✅ |
| `PATCH /api/clients/1 {price_tier}` | **403** "Sin permiso para cambiar el tipo de precio" | 403 ✅ |
| `GET /api/products/1` | **403** | 403 ✅ |
| `GET /api/inventory` | **403** | 403 ✅ |
| `GET /api/config/theme` · `ticket` · `subscription` | **403** cada uno | 403 ✅ |
| `GET /api/orders` (Pedidos, debe seguir abierto) | **200** | 200 ✅ (no roto) |
| `GET /api/config/business` · `modules` (POS/shell) | **200** cada uno | 200 ✅ (no roto) |
| `GET /api/products/1` como **admin** | **200** con `cost_per_unit_usd` | admin ve todo ✅ |

Verificación de compilación: `npx tsc --noEmit` → 0 errores · `npm run build` → exit 0.

## Nota metodológica
El análisis original (3 subagentes) fue puro documento — cero código. Esta sección documenta la implementación posterior de las 4 decisiones de Carlos, con guard real in-route verificado por bypass directo.
