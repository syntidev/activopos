# GRAND HANDOFF v2 — ActivoPOS
# Actualizado: 14 Julio 2026 | Reemplaza GRAND_HANDOFF_ActivoPOS_13Jul2026.md (obsoleto)
# Todo lo de este documento fue verificado con datos reales (bypass curl, DevTools,
# grep, cómputo) en algún punto de la sesión — no son promesas de commit.

---

## 0. LEER PRIMERO

1. `.doc/MATRIZ_ROLES_PERMISOS_SELLADA.md` — NUEVO, reemplaza cualquier claim
   anterior de "95+ guards" — es el estado real, verificado con bypass directo
2. `CLAUDE.md` raíz — **tiene corrupción de encoding (mojibake) confirmada,
   pendiente de arreglar, no es un rumor**
3. Este documento

---

## 1. SEGURIDAD Y ROLES — ESTADO REAL (lo más importante de hoy)

### 1.1 Cerrado y verificado con bypass real (commit `69284fc`)
Los 3 roles (`super_admin`/`admin`/`cashier`) tienen guards de backend reales,
no fachada de frontend, verificados con `curl` directo como cashier autenticado:

| Hallazgo | Decisión | Estado |
|---|---|---|
| `reports/sales` exponía costo/utilidad a cashier | Redactar costo para cashier | ✅ Cerrado, doble capa (middleware + in-route) |
| Pedidos (5 endpoints) sin guard | Queda ABIERTO a propósito — atención al cliente, no dato sensible | ✅ Documentado como intencional, comentario en código para que nadie lo "corrija" sin preguntar |
| `price_tier` de cliente editable por cashier vía PATCH | Exclusivo admin/super_admin | ✅ Cerrado — 403 verificado, `unit_price_override` (venta puntual) intacto, no se tocó |
| Config/costo (Productos, Inventario, tema, ticket, subscription) sin guard | Exclusivo admin/super_admin | ✅ Cerrado — 403 verificado |

### 1.2 Excepción operativa documentada — NO es un hueco olvidado
`config/business`, `config/business/modules`, `categories` **quedaron sin bloquear
a propósito** — se rastreó su uso real y son consumidos por el POS del cashier, el
header, el ticket de venta y la navegación. Bloquearlos rompería el trabajo diario
del cashier, no cerraría un hueco real. Documentado en la matriz sellada.

**PENDIENTE DE DECISIÓN — Carlos:**
- `categories` — ¿se queda abierto igual que `config/business`, o se redacta
  información sensible en vez de bloquear el endpoint completo (para no romper
  el filtro de categorías del POS)?
- Si en algún momento se decide bloquear `config/business` de todas formas, es
  un sprint de refactor aparte (hay que desacoplar 4 consumidores primero:
  `usePOS.ts:69`, `pos/page.tsx:37`, `Header.tsx:277`, `SuccessTicketPanel.tsx:91`)
  — no es un simple 403.

### 1.3 Pendiente, no urgente — mejora de UX, no de seguridad
Patrón de Venko documentado (competidor): cards explicativas de qué puede hacer
cada rol, mostradas ANTES de crear un usuario nuevo — *"Cashier: ventas, caja,
pedidos, clientes. No ve costos ni configuración"* / *"Admin: todo + reportes,
productos, configuración"*. No construido. Bajo riesgo, alto valor percibido.

### 1.4 Nota operativa de proceso
La sesión de Opus que implementó esto tocó **27 archivos** — cerca del límite de
contexto recomendado. **Cualquier trabajo nuevo de roles/seguridad debe abrirse
en una sesión de Opus NUEVA**, no continuar en la misma.

---

## 2. LANDING PAGE — ESTADO FINAL (después de ~30+ rondas de iteración)

### 2.1 Cerrado y confirmado visualmente por Carlos
- Hero con `LivePulseSection` (gráfico tipo mercado + feed de eventos rotando)
- `ProductBentoSection` — Cobrado/Tu Día/Margen/Carrito (ticket reemplazado por
  carrito real, evita parecido a factura fiscal/SENIAT)
- `FeatureListBentoSection` — 20 funciones, muro 2 filas con scroll horizontal
  infinito, anchos 170/220px por longitud real de título, ícono fantasma de fondo
  (no flotante), sin overflow de texto
- Colorimetría unificada: cero crema/sand en toda la landing, ícono único
  (blanco + Persian Blue) en Segmentos/Catálogo/Funciones
- `TestimonialsSection` — foto real de fondo (gente trabajando, tratamiento
  azul/blanco, sin sensación fúnebre), bookend navy de 2 zonas (hero+footer)
  restaurado
- Footer — sin badge/ícono flotante, wordmark con color sutil, margen mobile
  corregido (hueco vacío resuelto)
- Contacto corregido en todo el sitio: WhatsApp `584243244788` (extraído a
  `src/lib/marketing-contact.ts`, constante única, 7 archivos migrados), link
  "Ver catálogo de ejemplo" apunta a `/catalogo/multi-demo`
- Overlay del slider del catálogo público reducido (0.55→0.35), ya no "ahuma" las fotos
- `DifferentiatorsSection` (código muerto) eliminado

### 2.2 Pendiente, sin decidir
- Precios de planes (Mostrador $15/Negocio $25/Pro $40) — Carlos considera que
  están mal calibrados vs. competencia, y quiere replantear segmentación
  POS-solo vs. POS+Catálogo. **Requiere sesión propia con precios reales de
  competidores verificados (no de memoria) antes de tocar un número.**

---

## 3. MÓDULO SOCIAL — GENERADOR DE CONTENIDO INSTAGRAM

### 3.1 Contexto
Se decidió clonar y adaptar Socialia (herramienta de $35/mes equivalente,
~2 semanas de desarrollo original de Carlos para SYNTIweb) en vez de partir de
cero. Documento completo de análisis: `PROYECTO_SOCIAL_ActivoPOS_Master.md`
(ya generado en sesión anterior — **leer ese documento para el detalle completo
de las 3 fases documentadas de las 8 capturas originales**).

### 3.2 Construido y verificado (Fase 1 de 3)
```
src/lib/social/
  brand.ts   — colores leídos en vivo de tokens.css, PRODUCT_CONTEXT real de
               ActivoPOS (features, 15+ segmentos, tono B2H) — SIN mención de
               SENIAT (decisión explícita de Carlos, no reintroducir)
  gemini.ts  — genera copy, verificado con contexto real de marca inyectado
  image.ts   — NVIDIA FLUX.1-dev (Gemini imagen tiene cuota 0, sin billing
               activado), prompt en positivo (lección: negar "no text" no
               funciona en modelos de difusión)
  compose.ts — sharp compone overlay de marca sobre el fondo, posiciones/
               tamaños FIJOS (sin editor todavía)

src/app/(admin)/social/page.tsx — formulario + grilla de generados
src/app/api/admin/social/ — generate (POST) + listado (GET), gate super_admin
Sidebar de admin — entrada "Contenido Social" cableada
```
Confirmado en vivo en `activopos.com/social`: formulario funcional, grilla
"Generados" presente (vacía porque los posts de prueba se limpiaron a propósito).

### 3.3 NO construido — Fases 2 y 3 completas (documentadas al detalle en
PROYECTO_SOCIAL_ActivoPOS_Master.md, sección 3 y 4)
- **Fase 2 — Editor de capas real**: drag de título/subtítulo/logo sobre el
  lienzo, sliders de tamaño, 8 swatches de color, alineación, toggle de sombra,
  mostrar/ocultar por capa. Requiere parametrizar `compose.ts` (hoy usa
  constantes fijas) + UI de canvas interactivo.
- **Fase 3 — Estrategia con "roles de experto"**: copy estructurado en Hook/
  Cuerpo/CTA/Pregunta/Hashtags (hoy es una estructura plana), + hora sugerida,
  + clasificación de objetivo, + tabs de Estrategia/Publicidad/SEO.
- **Publicación real vía Buffer** — token ya está en `.env` del VPS
  (`SOCIAL_BUFFER_ACCESS_TOKEN`), sin código que lo consuma. Requiere endpoint
  nuevo + cuenta de Instagram ya migrada a Business+Facebook (pendiente que
  Carlos lo complete, guía ya entregada).
- **Calendario con import/export Excel** — modelo `SocialCalendarEntry` no
  creado, patrón ya documentado (mismo shape que Socialia original).

### 3.4 Decisión pendiente de Carlos
¿Se construyen las Fases 2 y 3 completas (varios días de trabajo real), o se
queda como generador simple por ahora? Esto es decisión de negocio, no técnica.

---

## 4. P0/P1 HEREDADOS DEL HANDOFF ANTERIOR — releer estado

### 4.1 Cerrados desde el handoff v1 (ya no están pendientes)
- DT-09 (resync stock variantes) ✅
- Reportes-Banner-1 (banner de reporte notificado) ✅ (ya estaba hecho, solo se verificó)
- Bot de ayuda (desempate de keywords) ✅ commit confirmado, verificado empíricamente
- DT-13 (`.doc/CLAUDE.md` contradictorio) ✅ eliminado, contenido único rescatado
  y documentado antes de borrar

### 4.2 Siguen pendientes, sin tocar esta sesión
- **P0 — Tasa BCV con 29 call-sites usando `getBcvRate()` directo** en vez del
  override manual del tenant — **requiere aprobación explícita de Carlos antes
  de ejecutar, es decisión de negocio sobre dinero real, no solo código**
- **P0 — Verificar E2E completo como cliente en producción** (registro→producto→
  catálogo→venta→reporte) — no reconfirmado desde `Sprint55-63`
- **P0 — Limpieza de tenant QA en producción** (`QA Test Registro SPRINT50`)
- CxP (Cuentas por Pagar) — ✅ CERRADO esta sesión (commit `0ee1a9a`), corrección:
  esto SÍ se completó, moverlo de "pendiente" a "cerrado" en cualquier lectura
  futura de este documento
- Usuarios y Roles — **PARCIALMENTE AVANZADO** (ver sección 1 completa arriba,
  ya no está en cero, pero sigue habiendo trabajo — cards de UX, decisión de
  `categories`)
- Sucursales/multi-branch — sigue sin tocar, rompe decisión de arquitectura
  sellada v1, requiere sesión de arquitectura dedicada
- DT-03 (Proveedores sin `moduleKey`) — sin tocar
- DT-05 (RateLimiterMemory no cluster-safe) — sin tocar
- DT-08 (deploy usó `db push` no `migrate deploy`) — sin tocar
- DT-10 (Stock Inicial no se oculta con variantes) — sin tocar
- Encoding roto en base de datos LOCAL (no producción, confirmado con curl real
  contra activopos.com) — cosmético, sin urgencia, arreglar cuando haya tiempo
- Voseo argentino en headline de Carnicería — **SÍ está en producción**,
  confirmado en vivo (`/para-carniceria`: "Vendés al kilo. Cobrás en dólares y
  Bs.") — pendiente de decisión: ¿corregir a tuteo ahora, o esperar a resolver
  el encoding de los otros 8 segmentos junto?
- `CLAUDE.md` raíz con mojibake (encoding roto en el propio documento de
  gobernanza) — hallazgo nuevo de hoy, sin arreglar

---

## 5. DEPLOY — RECORDATORIO PERMANENTE

Secuencia completa, siempre, sin atajos:
```bash
cd /var/www/activopos
git fetch origin && git reset --hard origin/main
npm install --legacy-peer-deps
npx prisma generate && npx prisma db push
rm -rf .next
npm run build
pm2 restart activopos --update-env
sleep 5 && curl -I https://activopos.com
```
`--update-env` es obligatorio desde que se agregaron las keys de NVIDIA/Gemini al
`.env` del VPS — sin ese flag, PM2 puede seguir usando variables viejas cacheadas.

**Confirmar pendiente:** el último commit de roles (`69284fc`) y de landing
(varios) — verificar con `git log --oneline -15` si todo llegó a producción o si
falta correr este deploy una vez más.

---

## 6. LO QUE NO SE TOCA SIN APROBACIÓN EXPLÍCITA DE CARLOS

- Wiring de tasa BCV real en los 29 call-sites (dinero real)
- Bloquear `config/business`/`categories` del todo (rompe POS del cashier sin refactor previo)
- Cualquier cosa de Sucursales/multi-branch
- Fases 2/3 del módulo social (son días de trabajo, decisión de alcance pendiente)
- Precios de planes (necesita datos reales de competencia primero)

---

*Este documento reemplaza `GRAND_HANDOFF_ActivoPOS_13Jul2026.md`. Léelo completo
antes de retomar cualquier pendiente — no re-descubrir lo que ya está aquí.*
