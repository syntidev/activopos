# CONTRATO — Pulso (analítica propia del catálogo público)
Versión 1 · 2026-10-29 · CLI-A · rama `feat/pulso`

Objetivo: cerrar el ciclo **visita → venta** del catálogo público (`/catalogo-premium/[slug]`) con datos propios, genéricos
multi-tenant. Primer cliente: OnBike (`catalogo-premium/onbike`). Sin terceros, sin cookies, sin IP, sin datos personales.

## 1. Eventos

| type | cuándo (cliente) | campos propios |
|---|---|---|
| `page_view` | cada cambio de ruta bajo `/catalogo-premium/[slug]` (home, `/productos`, `/p/[id]`, `/marca/[marca]`) | `path` (sin query) |
| `product_view` | monta la ficha `/p/[id]` | `product_id` |
| `deporte_select` | el visitante elige un deporte ("¿Qué practicas?") | `deporte` (slug) |
| `search` | búsqueda tipeada, debounce ≥ 800 ms, ≥ 2 caracteres | `query` (≤ 100), `results_count` |
| `add_to_cart` | `addToCart` del `CartContext` | `product_id` |
| `checkout_start` | se abre el checkout (una vez por apertura) | — |
| `whatsapp_click` | clic en cualquier enlace `wa.me` / `api.whatsapp.com` | — |
| `call_click` | clic en cualquier enlace `tel:` | — |
| `cashea_selected` | el cliente elige "Cashea" en el pago | — |
| `currency_switch` | el cliente cambia entre Bs y Divisa en el pago | `query` = `bs` \| `divisa` (ver DECISIONES) |
| `order_created` | **solo servidor**, en la ruta del pedido público | `order_id`, `value_usd` |

`order_created` NO se acepta por `POST /api/public/events` (el zod lo rechaza).

## 2. Esquema (`catalog_events`, migración aditiva `20261029000001_add_catalog_events`)

`id` BigInt PK · `business_id` Int (sin FK) · `session_id` VarChar(36) · `type` VarChar(24) · `path` VarChar(255) ·
`product_id` Int? · `brand_id` Int? · `deporte` VarChar(40)? · `query` VarChar(100)? · `results_count` Int? · `order_id` Int? ·
`value_usd` Decimal(10,2)? · `utm_source|medium|campaign|content` VarChar(80)? · `utm_term` VarChar(100)? · `referrer_host` VarChar(120)? ·
`device` VarChar(10)? (`mobile|tablet|desktop`) · `os` VarChar(24)? · `browser` VarChar(24)? · `country` VarChar(2)? · `city` VarChar(80)? ·
`created_at` DateTime default now.
Índices: `(business_id, created_at)` y `(business_id, type, created_at)`.
Sin FK a nada (`businesses`, `products`, `brands`, `orders`): una fila de analítica nunca bloquea un borrado ni toma el lock compartido de la fila del negocio.

## 3. API

### `POST /api/public/events` (público, sin sesión)
Body: `{ slug, session_id, attribution?, events: [{ type, path, product_id?, deporte?, query?, results_count? }] }`, lote **1..20**.
- `slug` regex `^[a-z0-9-]{3,50}$`; `session_id` UUID v4. `attribution`: `{ utm_source?, utm_medium?, utm_campaign?, utm_content?, utm_term?, referrer_host? }`
  (se aplica a todos los eventos del lote). zod **estricto** (`.strict()`): campo desconocido → 400.
- `business_id` se resuelve SIEMPRE desde `slug` (`catalog_slug`, `catalog_active`, `active`). Nunca del body. Slug desconocido → 404.
- Rate limit `pulsoEventsLimiter` por `ip:slug` (120 lotes/min). Excedido → 429. La IP solo vive en memoria del limitador.
- Bots (user-agent: bot, crawler, spider, headless, lighthouse, curl, wget, python-requests, facebookexternalhit, preview…) → `204` sin guardar.
- `user-agent` → `device`, `os`, `browser` con parser liviano propio (`src/lib/pulso-ua.ts`). El UA no se guarda.
- País/ciudad: `cf-ipcountry` (2 letras, no `XX`/`T1`) y `cf-ipcity` (si existe, ≤ 80). Nunca la IP.
- Integridad: `product_id` se valida contra `products` del negocio (un id ajeno descarta ese evento) y de ahí se rellena `brand_id`;
  en rutas `/marca/<slug>` el `brand_id` se resuelve por el slug de la marca visible del negocio (`brandSlug`).
- Respuesta: `204` (éxito, `sendBeacon` no lee el cuerpo). Errores: 400 / 404 / 429 con `{ error }`.
- Escritura: `createMany` en una sola sentencia; cualquier fallo → 500 genérico `{ error }`, el cliente lo ignora.

### `POST /api/catalog/[slug]/order` (existente, ampliado)
Body acepta `pulso?: { session_id (UUID), utm_source?, utm_medium?, utm_campaign?, utm_content?, utm_term?, referrer_host? }` (estricto).
Dentro de la **misma transacción** que crea el pedido se inserta `order_created` con `order_id`, `value_usd = total_usd`, `session_id`
y UTM del cliente, `device/os/browser/country/city` del request. Si el body no trae `pulso`, se registra con un `session_id` generado
(el pedido nunca falla por falta de analítica; la analítica nunca bloquea el pedido salvo error de DB, que sí deshace la transacción).

## 4. Privacidad
- `session_id`: UUID aleatorio en `localStorage` (clave `activopos_pulso_session`), renovado tras 30 min de inactividad. No es cookie.
- Nunca se guarda IP, user-agent crudo, teléfono, cédula ni nombre. `query` es texto libre de búsqueda de producto (≤ 100): no se cruza con clientes.
- Sin retención automática en v1 (ver DECISIONES).
- Respeta `navigator.doNotTrack === '1'`: el tracker no envía nada.

## 5. Tracker (cliente)
- `src/lib/pulso-client.ts`: `track(event)` (cola en memoria), `getAttribution()`, `getSessionId()`; envío por `navigator.sendBeacon`
  (fallback `fetch keepalive`), lote ≤ 20, flush cada 3 s y en `visibilitychange=hidden`/`pagehide`. Todo en `try/catch`, fallas silenciosas.
- `src/components/pulso/PulsoTracker.tsx` (client) montado en `catalogo-premium/[slug]/layout.tsx`: inicializa sesión + UTM,
  emite `page_view` por ruta, detecta clics `wa.me`/`tel:` por delegación.
- UTM: se leen de `location.search` al llegar, se persisten en la sesión (`activopos_pulso_attr`) y NO se sobrescriben dentro de la misma sesión
  si el siguiente page_view no trae UTM. `referrer_host` = host de `document.referrer` si es externo.
- Funciones puras testeadas: `parseUserAgent`, `parseUtm`, `nextSession`.

## 6. Panel "Pulso"
- Ruta `/pulso` en el dashboard (grupo CATÁLOGO del sidebar, ítem "Pulso"), **solo admin** (`ADMIN_ONLY` en `middleware.ts`), `requiresCatalogPlan`.
- `business_id` desde `getSession()`; rango `?dias=7|30` (default 7). Día = calendario de Venezuela (UTC−4 fijo).
- Consultas agregadas en servidor (`src/lib/pulso.ts`, `$queryRaw` parametrizado) usando los índices `(business_id, created_at)` / `(business_id, type, created_at)`.
- Bloques:
  1. **Tráfico**: visitantes únicos hoy / 7 d (o 30 d), tiempo promedio por sesión (sesiones con ≥ 2 eventos, tope 30 min), equipo (mobile/tablet/desktop), país y ciudad.
  2. **Origen**: sesiones por `utm_source` (sin UTM → `referrer_host` o "Directo") y por campaña.
  3. **Interés**: productos más vistos (con nombre), marcas más vistas, deportes más elegidos, **búsquedas sin resultados** (type `search`, `results_count = 0`).
  4. **Embudo**: sesiones con visita → ficha → carrito → pedido (`order_created`) → pagado (pedido cuyo `sale.status = 'paid'`), cruzando `orders`.
  5. **Ventas por origen**: USD y Bs por canal/campaña desde `orders` (vía `order_created.order_id`), Cashea (`payment_kind='cashea'`), BCV vs Divisa (`payment_kind` bs/divisa).
  6. **Contacto**: clics de WhatsApp y llamadas.
- Montos siempre USD **y** Bs (`orders.total_bs`, nunca recalculado con tasa de hoy).
- Visual: cards con elevación, fondo `#EEEDF4`, KPIs con ícono en círculo semántico, tokens de `tokens.css`, CSS Modules, móvil 375 px primero.

## 7. Aislamiento y límites
- No tocar: producción, `synticorex`, `syntimeat`, `admin.activopos.com`, kit-200k, flujos de venta/POS.
- Cambios al catálogo detrás de llamadas inertes: si el tracker falla o está desactivado, el catálogo funciona idéntico.
- Todo `business_id` del panel y de las consultas viene de `getSession()` o del slug; nunca del body.

## 8. DECISIONES (ambigüedades resueltas por lo más simple)
1. **`type` es `VarChar`, no enum**: agregar un tipo nuevo no exige migración; el zod es la lista cerrada.
2. **`currency_switch` guarda el destino en `query`** (`bs`|`divisa`) en vez de una columna nueva: el esquema pedido no tiene `detail`.
3. **`order_created` sin `session_id` del cliente** usa un UUID generado: el pedido nunca falla por analítica ausente.
4. **Sin retención automática en v1**: ~20 eventos por visita; purga (> 180 días) queda como tarea futura documentada, no se construye ahora (YAGNI).
5. **Zona horaria**: "hoy" y los días del rango usan UTC−4 fijo (Venezuela no tiene horario de verano).
6. **Sin FK a nada**, ni siquiera a `businesses`: alto volumen de escritura y una FK toma el lock compartido sobre la fila del negocio (mismo criterio que `web_order_locks`). Consecuencia: si se borra un negocio quedan eventos huérfanos; no afectan a nadie (todo se filtra por `business_id`).
7. **Bots**: lista de patrones en el user-agent; sin consultas externas ni dependencias.
8. **Panel solo admin** (el cajero no ve analítica comercial), y solo con plan de catálogo.
9. **Unit tests** corren con el runner de Playwright (sin navegador): el repo no tiene vitest/jest y no se agrega una dependencia.
10. **Despliegue**: tabla nueva y aditiva; la migración versionada es `20261029000001_add_catalog_events`. Ver pasos en el reporte final. **La tabla debe existir ANTES de desplegar el código**: el pedido público escribe `order_created` (protegido con try/catch, pero sin tabla no habría analítica).
11. **Lote atómico**: un evento inválido hace 400 en todo el lote (zod estricto). El tracker nunca arma eventos inválidos; relajarlo permitiría que un cliente adulterado mezcle basura con eventos válidos.
12. **Rate limit 60 lotes/min por `ip:slug`**, por proceso (como los demás limitadores). Inflar visitantes con `session_id` inventados no se elimina en un endpoint público: riesgo aceptado y documentado. Nginx debe pasar `x-real-ip`/`cf-connecting-ip`; sin ellos todos comparten el bucket `127.0.0.1`.
13. **Búsquedas con pinta de dato personal** (≥ 6 dígitos seguidos, `@`, secuencias tipo teléfono/cédula) se descartan en servidor: no se guardan.
14. **El pedido nunca depende de la analítica**: un bloque `pulso` mal formado se ignora (sesión generada, sin UTM) y un fallo del insert de `order_created` se registra y el pedido sigue.
15. **DNT / Sec-GPC** se respetan también en servidor (204 sin guardar). `order_created` se guarda siempre: el pedido existe de todos modos y es dato del negocio, no del visitante.
16. **Embudo**: sesiones distintas por etapa, NO estrictamente anidado (una sesión que renueva o no manda `pulso` puede tener pedido sin visita). "Pagado" = `sales.status IN ('paid','partial_return')` (regla contable sellada §4: `partial_return` sigue visible).
17. **"Valor de pedidos del catálogo"** suma todo `order_created` (incluye pedidos luego cancelados): está rotulado como valor de pedidos, no como ventas cobradas; lo cobrado es solo el paso "pagado" del embudo.
18. **`search.results_count`** solo se registra cuando no hay categoría/marca/precio activos: con filtros puestos `visible.length` no mide la búsqueda y un término que el catálogo sí tiene saldría como "sin resultados".
19. **`city`** (de `cf-ipcity`) se guarda a nivel ciudad; la IP nunca. Si un negocio o regulación lo exige, basta dejar de leer el header en `requestGeo`.
20. **El panel exige admin** (middleware + página). El plan de catálogo solo oculta el ítem del menú (`requiresCatalogPlan`); quien tenga la URL ve el panel (vacío si no hay eventos).
21. **Sin caché slug→negocio** en el endpoint de eventos en v1 (1–3 queries por lote, cada ~3 s por visitante); se agrega un `Map` con TTL de 60 s si el tráfico lo pide.
22. **Tráfico interno (afinado 2026-10-30)**: no cuenta quien tenga sesión válida de ActivoPOS (cualquier rol). Doble barrera: el tracker pregunta `GET /api/public/events` (`{internal}`; la cookie es httpOnly, solo el servidor la ve) y se apaga; el `POST` descarta con 204 todo lote que llegue con sesión. Si el GET falla, el tracker sigue y la barrera del servidor descarta igual. Un super_admin impersonando también cuenta como interno.
23. **Exclusión por dispositivo**: `?pulso=off` guarda `activopos_pulso_off=1` en localStorage y ese navegador deja de registrar; `?pulso=on` la quita. Silencioso, sin UI. Riesgo aceptado: cualquiera puede enviar un enlace `?pulso=off` y silenciar a un visitante (a lo sumo queda sin contar un visitante; sin exposición de datos). Endurecer (caducidad de la marca, o honrar `off` solo con sesión) si se abusa.
24. **`order_created` no se excluye**: el pedido hecho desde el catálogo por el personal es venta real; no pasa por `/api/public/events` y se registra siempre.
25. **Ayuda "?" en el panel**: textos fijos en `page.tsx` (`TIP`); el popover se ancla al ancho del bloque (nunca desborda a 375 px), abre con clic/toque/Enter, cierra con Esc o tocando fuera; botón ≥ 44 px.
