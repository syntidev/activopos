# HANDOFF — Auditoría de 4 Módulos de Estado Desconocido
**Fecha:** 2026-07-12 | **Modo:** solo lectura, solo reporte — nada corregido

---

## 1. Ayuda — panel lateral de 2 tabs (flujo + FAQ)

**SÍ existe, funciona, pero está aislado a 1 solo módulo de ~13.**

- `src/components/help/HelpModal.tsx` — panel lateral real, deslizante (`x: '100%' → 0`), con **2 tabs de verdad** (`role="tablist"`, líneas 82-101): **"Cómo funciona"** (steps) y **"Preguntas frecuentes"** (faqs acordeón). Lee de `src/lib/help-content.ts`.
- Se dispara con `src/components/help/HelpButton.tsx` (botón `?` flotante) que recibe un `module: HelpModule` como prop.
- **Importado en un solo lugar de todo el dashboard**: `src/app/(dashboard)/productos/page.tsx`. Ningún otro módulo (Inventario, POS, Clientes, Reportes, Caja, Finanzas, Proveedores, Compras, Usuarios, Configuración, Catálogo Digital, Devoluciones) lo usa.
- El hub central `/ayuda` (`src/app/(dashboard)/ayuda/page.tsx`) **no usa este componente** — tiene su propia función `HelpModal` local (líneas 274-360, nombre duplicado pero código distinto) que solo renderiza `steps` + un box de `tip` — **sin pestaña de FAQ**, aunque `help-content.ts` sí trae `faqs` para los módulos que cubre.
- `help-content.ts` (fuente única declarada por comentario en el propio código, línea 244-248) **no cubre todos los módulos todavía**: Devoluciones, Proveedores, Compras y Usuarios usan un `HELP_TOPICS` local en `ayuda/page.tsx` en su lugar (solo steps+tip, sin faqs, ese contenido nunca tuvo FAQ).

**Conclusión:** el componente de 2 tabs está bien construido y funcional, pero el Sprint que lo creó solo lo conectó a Productos. El hub de Ayuda general — la puerta de entrada principal — usa una versión inferior sin FAQ.

---

## 2. Bot de ayuda — mecanismo real

**Híbrido: keyword matching instantáneo + LLM real con contexto del negocio (no "sin contexto").**

Archivo: `src/app/(dashboard)/ayuda/page.tsx` líneas 362-435 (frontend) + `src/app/api/ai/chat/route.ts` (backend).

1. **Capa 1 — keyword matching local** (`BOT_RULES`, 20 reglas, `botReply()` línea 421-435): normaliza texto (minúsculas, sin tildes) y puntúa por cantidad de keywords coincidentes por regla — no hay embeddings ni scoring semántico, es matching literal de substrings. Responde instantáneo como relleno mientras se espera la IA.
2. **Capa 2 — llamada real a Claude Haiku 4.5** (`api/ai/chat/route.ts`): construye un `systemPrompt` con contexto REAL del negocio del usuario — ventas de hoy (monto y cantidad), pedidos activos en cocina/sala, cobros CxC vencidos, hasta 5 productos con stock bajo (todo vía queries Prisma/raw SQL al momento de la consulta) — y lo envía a `https://api.anthropic.com/v1/messages` con el mensaje del usuario.
3. **Gates antes de llamar a la IA**: sesión autenticada (401 si no), rol ≠ `cashier` (403 solo admin), `checkPlanLimit('access_ai')` (403 si el plan no incluye IA), rate limit por usuario (`aiChatLimiter`, 429 si excede).
4. **Fallback**: si el fetch falla, tarda más de 8s, o Anthropic responde error/5xx, el frontend usa la respuesta de la Capa 1 (keyword) sin que el usuario vea un error — solo el texto cambia de "Consultando..." a la respuesta local.

**Conclusión:** no es un bot "de mentira" — la IA real recibe contexto operativo verdadero del negocio, no una llamada genérica.

---

## 3. Reporte mensual — endpoints n8n

**2 de 3 endpoints existen y funcionan. `mark-notified` no existe en ningún lado del código.**

| Endpoint requerido | Archivo | Estado |
|---|---|---|
| `mark-pending` | `src/app/api/reports/monthly/mark-pending/route.ts` | ✅ Existe. POST protegido por `x-api-key === N8N_API_KEY`. Crea `MonthlyReport` status=`pending` para todos los negocios activos del período (skip duplicados), resetea los que quedaron en `failed` de vuelta a `pending`. No toca `ready`/`generating`. |
| `pending` | `src/app/api/reports/monthly/pending/route.ts` | ✅ Existe. GET protegido igual. Lista reportes `status=pending` con datos del negocio (`name`, `whatsapp`, `catalog_slug`) — exactamente lo que n8n necesitaría para saber a quién generarle/notificarle. |
| `mark-notified` | — | ❌ **No existe.** Ningún archivo `route.ts` con ese nombre en todo `src/app/api/reports/`. El modelo `MonthlyReport` en `prisma/schema.prisma` **sí tiene** la columna `notified_at DateTime?` lista para esto — el dato tiene dónde vivir, pero nunca se construyó el endpoint que lo setea. |

**`N8N_API_KEY`**: no está definido en el `.env` local (grep vacío). Si el workflow de n8n intenta pegarle a `mark-pending`/`pending` contra este entorno local, recibirá 401 siempre (`apiKey !== undefined` nunca es falso). No puedo confirmar si está seteado en el `.env` del VPS de producción — requiere verificación manual de Carlos ahí.

**Workflow instalado en n8n.syntiweb.com**: no verificable desde el código ni desde esta sesión (sin acceso a esa instancia externa) — pendiente de confirmación manual.

**Reporte de prueba — ya existen 2 reales, generados antes de esta auditoría:**
```
business: Mi Negocio Demo | period: 2026-05 | status: ready | download_token: sí
business: Mi Negocio Demo | period: 2026-06 | status: ready | download_token: sí
```
Esto confirma que el pipeline de generación (`api/reports/monthly/generate/route.ts` → `generateMonthlyPDF()` en `src/lib/reports.ts`) **sí funciona end-to-end** — no lo tuve que probar yo mismo, ya hay evidencia real de éxito previo. Contenido del PDF (leyendo `generateMonthlyPDF`): nombre/teléfono/ciudad del negocio, total de ventas del mes en USD y Bs, cantidad de ventas, desglose día por día, tasa BCV cacheada al momento de generar — construido con `jsPDF`.

---

## 4. Mayoristas / Lista de precios al mayor

**No existe absolutamente nada — ni parcial.**

Búsqueda de "mayorista", "lista de precio", "precio al mayor", "wholesale" en todo `src/` y en `prisma/schema.prisma`: el único resultado real es que **"mayorista" es el slug de un segmento de marketing** (`Distribuidora`, ver `SegmentIcon.tsx`/`SegmentsMenu.tsx`/`segment-accent.ts`) — es decir, una categoría de negocio a la que se le vende ActivoPOS (landing page), no una funcionalidad de precios por volumen dentro del sistema.

Verificado en `prisma/schema.prisma`: ningún modelo `PriceList`, ningún campo `precio_mayor`/`wholesale_price`/`bulk_price`/`tier_price` en `Product` ni en ningún otro modelo. `ProductVariant` solo tiene `precio_extra` (recargo por variante, no nivel de precio por cantidad).

**Conclusión:** 0% construido. Si Carlos necesita esto, es una feature completamente nueva — no hay ni un modelo de datos parcial del que partir.

---

## Resumen para decisiones

| Módulo | Estado real | Qué falta |
|---|---|---|
| Ayuda (panel 2 tabs) | Construido y funcional, aislado a 1 módulo | Conectar `HelpButton` en los ~12 módulos restantes; completar `help-content.ts` para Devoluciones/Proveedores/Compras/Usuarios; unificar el hub `/ayuda` para usar el mismo `HelpModal` con FAQ |
| Bot de ayuda | Real, híbrido, con contexto de negocio | Nada roto — funciona como está diseñado |
| Reporte mensual | 2/3 endpoints n8n existen y funcionan | Construir `mark-notified`; confirmar `N8N_API_KEY` en VPS; confirmar instalación del workflow en n8n.syntiweb.com (manual) |
| Mayoristas/lista de precios | No existe | Feature nueva desde cero — sin modelo de datos previo |

No se corrigió nada en este pase — reporte puro, según instrucción.
