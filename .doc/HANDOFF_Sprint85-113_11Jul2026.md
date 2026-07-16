# HANDOFF — Sesión 10-11 Jul 2026
# Sprints 85-113 | Catálogo Digital v2 Completo
# Para: Próximo agente | Arquitecto: Carlos Bolívar — SYNTIdev

---

## 0. CREDENCIALES E INFRAESTRUCTURA

### Local (Windows 11, PowerShell)
```
Directorio:  C:\laragon\www\activopos
DB local:    activopos (mysql://root@127.0.0.1:3306/activopos)
Puerto dev:  3000
npm flags:   SIEMPRE --legacy-peer-deps
Commit:      .\commit.ps1 "mensaje"
```

### VPS Producción
```
IP:          187.124.241.213
Directorio:  /var/www/activopos
Puerto app:  3003 (PM2 cluster mode, proceso id=9)
Nginx:       Proxy → 3003, SSL Certbot
Storage:     /var/www/activopos/storage/tenants/{business_id}/
DB:          MariaDB local, DB: activopos (root, sin password)
```

### Deploy VPS — COMANDO DEFINITIVO (reemplaza el merge anterior)
```bash
cd /var/www/activopos
git fetch origin
git reset --hard origin/main
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push
rm -rf .next
npm run build && pm2 restart activopos
```
**NUNCA usar `git merge` en VPS — genera divergencia. Siempre `git reset --hard origin/main`.**

### Git / GitHub
```
Remote:  https://github.com/syntidev/activopos.git
Rama:    main (única rama activa)
Último commit sesión: aad3754 (fix catCircleTrack safe center)
```

### Cuentas Demo VPS
```
demo-pro@activopos.com      | Demo2026$ | plan: business | slug: boutique-demo
demo-negocio@activopos.com  | Demo2026$ | plan: pro      | slug: —
demo-mostrador@activopos.com| Demo2026$ | plan: inicio   | slug: —
```

---

## 1. LO QUE SE CONSTRUYÓ HOY (Sprints 85-113)

### CATÁLOGO DIGITAL v2 — 3 páginas públicas completas

| Ruta | Estado | Descripción |
|---|---|---|
| `/catalogo/[slug]` | ✅ | HOME: slider hero 3 banners, categorías circulares con imagen propia, destacados, shelves por categoría, footer negocio |
| `/catalogo/[slug]/productos` | ✅ | Grid puro: sidebar desktop, chips mobile, buscador, contador, grid 4 col desktop |
| `/catalogo/[slug]/p/[id]` | ✅ | Detalle producto: galería múltiple, variantes, BCV note, Pedir ahora WA, productos relacionados |

### CAMBIOS POR ARCHIVO

**`CatalogoGrid.tsx`**
- Cards → imagen 4:5, botón "Agregar" full-width, nombre semibold
- Browse mode → shelves horizontales por categoría (rail)
- Checkout → 3 pasos con stepper: Contacto → Entrega → Pago
- Cards conectadas a `/p/[id]` — modal desconectado del grid
- Slider hero: 3 banners con fade automático 5s, dots navegables
- Click en slider → `/catalogo/[slug]/productos`
- Menú hamburguesa: solo "Inicio" y "Catálogo"
- Logo header → Link clickeable al HOME
- Nav links desktop: Inicio + Catálogo (hamburguesa oculto ≥1024px)
- FAB WhatsApp: visible solo cuando `cart.length > 0`
- Botón ↑: oculto cuando overlays abiertos, z-index 30
- Categorías circulares: `safe center` + padding correcto

**`catalogo.module.css`**
- 3285 → ~3143 líneas (19 clases huérfanas eliminadas)
- Shelf/rail CSS completo
- Checkout multipaso CSS completo
- Sidebar desktop categorías CSS
- Hero slider con fade y dots
- Categorías en card blanca con sombra
- Fondo alternado entre secciones

**`ProductoDetalle.tsx`** — nuevo componente
- Layout 2 columnas desktop
- Galería con thumbnails navegables
- Variantes con chips, agotadas tachadas
- Precio dual USD+Bs
- BCV note verde
- "Pedir ahora" → WhatsApp con producto/variante/qty
- Productos relacionados 4 col desktop
- Header mini del negocio sticky
- Descripción del producto
- Max-width 1100px centrado

**`productoDetalle.module.css`** — nuevo

**`page.tsx` (HOME catálogo)**
- `getBusiness` selecciona: `legal_name`, `rif`, `address`, `catalog_cover_path_2`, `catalog_cover_path_3`
- Pasa `heroCovers[]` array de 3 banners
- `categoryImages` desde query directa a `Category.image_url`
- Footer completo: logo, nombre, RIF, dirección, teléfono, instagram, horario

**`/productos/page.tsx`** — nueva ruta
- Grid puro con `catalogMode="productos"`
- Sidebar desktop de categorías
- Filtro por URL `?categoria=X`

**`/p/[id]/page.tsx`** — nueva ruta
- SSR público, SEO metadata
- Fix IDOR (CLI-C Sprint 103): `business_id` scope en metadata
- Query de productos relacionados

### CAMBIOS EN ADMIN

**`ProductModal.tsx` + `ProductFormLayout.tsx` + `useProductForm.ts`**
- Campo `description` textarea en formulario crear/editar
- Hint: "Aparece en la página del producto en el catálogo digital"

**`configuracion/tabs/TabTema.tsx`**
- 3 uploaders de banner/slider (Banner 1, 2, 3)
- Mismo patrón de upload que productos
- Guarda en `catalog_cover_path`, `catalog_cover_path_2`, `catalog_cover_path_3`

**`CategoryModal.tsx`**
- Uploader imagen real (reemplaza input URL eliminado)
- Compresión Canvas 0.75 antes de subir
- Guarda en `storage/tenants/{id}/categories/`
- Hint: "Imagen visible en catálogo público"

### SCHEMA PRISMA — CAMPOS NUEVOS

```prisma
// Business
catalog_cover_path_2  String?  @db.VarChar(500)
catalog_cover_path_3  String?  @db.VarChar(500)

// Category
image_url  String?  @db.VarChar(500)

// Order (catálogo público)
delivery_type    String?  @default("pickup")
recipient_name   String?
delivery_address String?
```

### API — ENDPOINTS NUEVOS/MODIFICADOS

```
GET  /catalogo/[slug]/product/[id]   → detalle público producto
POST /catalog/[slug]/order           → agrega delivery_type, recipient_name, delivery_address
PATCH /api/categories/[id]           → acepta image_url
GET  /api/upload/image               → acepta type=category
```

### SEED DEMO

```bash
# Script idempotente con imágenes Unsplash reales
npx ts-node --compiler-options '{"module":"commonjs"}' scripts/seed-demo.ts

# Fix permisos storage VPS
bash scripts/fix-storage-permissions.sh
```

### HELP CONTENT

`src/lib/help-content.ts` — actualizado completo:
- Módulo `catalogo`: 12 pasos + 10 FAQs (flujo completo desde configuración hasta pedido WA)
- Todos los módulos actualizados con FAQs venezolanas específicas

---

## 2. ESTADO DEL SISTEMA POST-SESIÓN

| Campo | Valor |
|---|---|
| Último commit | `aad3754` fix catCircleTrack safe center |
| TypeScript | ✅ 0 errores |
| Build | ✅ exitoso |
| VPS | ✅ online PM2 restart 242 |
| Deploy VPS | `git reset --hard origin/main` (NO merge) |

### Módulos — estado actualizado

| Módulo | Estado | Cambios esta sesión |
|---|---|---|
| Catálogo HOME | ✅ COMPLETO | Slider 3 banners, categorías circulares imagen propia, shelves |
| Catálogo /productos | ✅ COMPLETO | Sidebar desktop, grid 4 col, buscador, contador |
| Catálogo /p/[id] | ✅ COMPLETO | Nueva página, galería, variantes, relacionados |
| Checkout catálogo | ✅ COMPLETO | 3 pasos, delivery, métodos pago como cards |
| Admin productos | ✅ COMPLETO | Campo descripción en formulario |
| Admin categorías | ✅ COMPLETO | Uploader imagen real |
| Admin configuración | ✅ COMPLETO | 3 campos banner/slider |
| Help content | ✅ COMPLETO | Catálogo 12 pasos, todos módulos actualizados |
| Landing marketing | ❌ PENDIENTE | Mezcla de estilos viejos y nuevos — ver §3 |

---

## 3. PENDIENTES — ORDEN DE PRIORIDAD

### P0 — Crítico para calidad

**Landing marketing homologación completa**
Documento completo en `.doc/SPRINT_LANDING_REDISENO.md`
Archivos:
```
src/components/marketing/sections/HeroSection.tsx
src/components/marketing/sections/TestimonialsSection.tsx
src/components/marketing/sections/PricingSection.tsx
src/components/marketing/sections/CTASection.tsx
src/components/marketing/sections/FooterSection.tsx
```
Reglas visuales:
- 65-70% fondos claros: #FFFFFF, #FAFBFC, #EEEDF4
- Navy #0D1B2E SOLO en footer y hero si aplica
- CTA ámbar #EF8E01 — UN solo CTA por viewport
- Copy venezolano: produces, vendes, cobras — NUNCA voseo

**Fix P0 catálogo — variant_id en order (reportado CLI-C Sprint 103)**
Archivo: `src/app/api/catalog/[slug]/order/route.ts`
Problema: `variant_id` llega del carrito pero Zod lo descarta silenciosamente. `precio_extra` de la variante nunca se suma al precio base.
CLI-A debe arreglar.

### P1 — Importante

- **SYSTEM_MAP actualizar** — ver §4 prompt para CLI-C
- **Blog P0 en local** — `blog/page.tsx` y `blog/[slug]/page.tsx` arreglados en VPS pero los archivos locales pueden divergir. Verificar con `git diff origin/main -- src/app/(marketing)/blog/`
- **Mojibake descripción boutique-demo** — "Boutique de ropa y accesorios ? cuenta demo" — encoding incorrecto en la descripción. Corregir desde admin.
- **DT-09** — Stock agregado InventoryEntry no resincroniza tras venta de variante

### P2 — Post-demo

- Wildcard DNS `*.activopos.com` para catálogos por subdominio
- Módulo banco/métodos pago compartibles
- Módulo suscripción — plan activo + alerta
- Dual brand header catálogo
- Listas de precio detal/mayor
- Numeric keyboard `inputMode="numeric"` sistema completo
- Login split-screen desktop

---

## 4. PROMPT PARA CLI-C — Actualizar SYSTEM_MAP

```
Ejecuta

/instinct-status
/code-review
/security-review
agents: typescript-reviewer, security-reviewer
```

## GRAPHIFY

```bash
graphify explain "catalogo/[slug]/page.tsx"
graphify explain "catalogo/[slug]/CatalogoGrid.tsx"
graphify explain "catalogo/[slug]/p/[id]/page.tsx"
graphify explain "catalogo/[slug]/ProductoDetalle.tsx"
graphify explain "catalogo/[slug]/productos/page.tsx"
graphify query "catalog_cover_path_2 catalog_cover_path_3 image_url delivery_type recipient_name delivery_address heroCovers categoryImages"
graphify query "ProductoDetalle relatedProducts helpContent TabTema CategoryModal"
```

## TAREA

Actualizar `.doc/SYSTEM_MAP.md` con el estado real post-Sprint 113.

### Cambios a documentar:

**§0 Estado general:**
- Último sprint: 113
- Último commit: `aad3754`
- Build: ✅ exitoso
- VPS: ✅ online

**§1 Módulos — actualizar:**
```
Catálogo digital — público   → ✅ COMPLETO (3 páginas: HOME/productos/p/[id])
Catálogo digital — admin     → ✅ COMPLETO (descripción producto, imagen categoría, 3 banners config)
```

**§2 Nuevo — Catálogo Digital v2 (agregar sección):**
Documentar las 3 rutas públicas nuevas, componentes nuevos, y cambios de schema.

**§3 Endpoints API — agregar:**
```
catalog/[slug]/product/[id]  → GET detalle público
```

**§4 Modelos Prisma — campos nuevos:**
```
Business: catalog_cover_path_2, catalog_cover_path_3
Category: image_url
Order: delivery_type, recipient_name, delivery_address
```

**§5 Scripts nuevos:**
```
scripts/seed-demo.ts              → seed idempotente boutique-demo
scripts/fix-storage-permissions.sh → permisos storage VPS
scripts/capture-referencia.ts     → Playwright capturas tuproveedor.com.ve
```

**§6 Deuda técnica — actualizar:**
```
DT-14 (nuevo, P1): variant_id descartado en catalog/[slug]/order/route.ts — precio_extra variante no suma al precio base del pedido público
DT-15 (nuevo, P2): Modal de producto en CatalogoGrid (~400 líneas JSX) es código muerto — openModal ya no se llama desde las cards del grid. Eliminar en sprint separado.
DT-16 (nuevo, P2): Landing marketing con mezcla de estilos viejos/nuevos — ver .doc/SPRINT_LANDING_REDISENO.md
```

**PROHIBIDO:** inventar. Leer los archivos reales antes de documentar.

## COMMIT

```bash
git add .doc/SYSTEM_MAP.md
git commit -m "docs(system-map): actualización Sprint 85-113 — Catálogo Digital v2 completo

🤖 Agente: CLI-C | Fecha: 2026-07-11"
git push origin main
```

## CRITERIO DE ÉXITO

✅ SYSTEM_MAP refleja estado real post-Sprint 113
✅ 3 rutas públicas del catálogo documentadas
✅ Campos nuevos de schema documentados
✅ DT-14/15/16 agregados
✅ Sin inventar — solo código real

---

## 5. REGLAS DE TRABAJO — PARA EL PRÓXIMO AGENTE

### Protocolo multi-agente CIMAAD

| CLI | Rol | Skills obligatorios |
|---|---|---|
| CLI-A | Backend, APIs, Prisma, schema | /instinct-status /ponytail ultra /code-review /security-review /software-architecture /api-design /database-migrations |
| CLI-B | Frontend, CSS Modules, UX | /instinct-status /ponytail ultra /impeccable craft /frontend-design:frontend-design /ui-ux-pro-max:ui-ux-pro-max /coding-standards /polish |
| CLI-C | Auditoría solo, reporta — NO modifica excepto P0 | /instinct-status /code-review /security-review agents: typescript-reviewer, security-reviewer |
| CLI-D | Testing, E2E, deploy, seeds | /instinct-status /e2e-testing /deployment-patterns |

### Reglas irrompibles

1. **Un archivo, un sprint** — si varios sprints tocan el mismo archivo, consolidar en uno
2. **Nunca `git merge` en VPS** — siempre `git reset --hard origin/main`
3. **Deploy incluye siempre** `npx prisma db push` cuando hay cambios de schema
4. **CLI-B nunca decide UX** — solo ejecuta lo que Carlos aprueba
5. **Cero fachadas** — código que parece funcionar pero no funciona es P0
6. **`business_id` siempre del servidor** — nunca del body ni del cliente
7. **Precios siempre del servidor** — anti price-tampering
8. **Stack sellado:** Next.js 14 + TypeScript strict + CSS Modules + Prisma 7 + MariaDB. NO Tailwind.
9. **`--biz-color`** es el nombre real de la variable de color del tenant en el catálogo — nunca `--tenant-color`
10. **Catálogo siempre light mode** — fondo #FFFFFF, sin sidebar, `--biz-color` del tenant

### Sobre Carlos

- Arquitecto de software, 20+ años banca venezolana. No programa — orquesta.
- Usa voz-a-texto en mobile — los typos son normales, interpretar contexto
- Directo. Sin halagos. Sin rodeos. Sin improvisación
- Una pregunta a la vez, respuesta sí/no cuando aplica
- Cuando dice "ya" significa ahora mismo, sin preguntar

### Stack de skills por CLI (obligatorio al inicio de cada prompt)

**CLI-A:**
```
/instinct-status
/ponytail ultra
/code-review
/security-review
/software-architecture
/api-design
/database-migrations
/deployment-patterns
```

**CLI-B:**
```
/instinct-status
/ponytail ultra
/impeccable craft
/frontend-design:frontend-design
/ui-ux-pro-max:ui-ux-pro-max
/coding-standards
/polish
/delight
/emil-design-eng
```

---

## 6. PRÓXIMA SESIÓN — ARRANCAR CON ESTO

### Paso 1 — Verificar estado
```powershell
cd C:\laragon\www\activopos
git log --oneline -5
git status
npx tsc --noEmit
```

### Paso 2 — Verificar VPS
```bash
ssh root@187.124.241.213
cd /var/www/activopos
git log --oneline -3
pm2 status
curl -s -o /dev/null -w "%{http_code}" https://activopos.com/catalogo/boutique-demo
```

### Paso 3 — Primera tarea
Lanzar CLI-C con el prompt de SYSTEM_MAP de §4 de este HANDOFF.
Luego CLI-B con la landing (`.doc/SPRINT_LANDING_REDISENO.md`).
Luego CLI-A con el fix DT-14 (variant_id en order route).

---

*ActivoPOS · SYNTIdev · activopos.com*
*Generado: 2026-07-11 | Sesión Sprints 85-113 | Catálogo Digital v2 completo*
*Carlos Bolívar — Arquitecto | Claude Web — Coordinador*
