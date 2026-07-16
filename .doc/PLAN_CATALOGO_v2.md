# PLAN MAESTRO — CATÁLOGO DIGITAL v2
# ActivoPOS | 10 Jul 2026 | Arquitecto: Carlos Bolívar

---

## PÁGINAS A CONSTRUIR (3 superficies)

| Página | Ruta | Estado |
|---|---|---|
| HOME | `/catalogo/[slug]` | ✅ Existe — pendiente refinamiento visual Sprint 97 |
| GRID | `/catalogo/[slug]/productos` | ✅ Existe — pendiente verificación visual |
| PRODUCTO | `/catalogo/[slug]/p/[id]` | ✅ Existe — pendiente verificación visual |

---

## ESTADO ACTUAL POR SPRINT

| Sprint | Qué | CLI | Estado |
|---|---|---|---|
| 85 | Card 4:5 + botón full-width + semibold | B | ✅ |
| 86 | Shelves horizontales browse mode | B | ✅ |
| 87 | Grid 4 col desktop + breakpoints | B | ✅ |
| 88 | Checkout 3 pasos + schema delivery | A+B | ✅ |
| 89 | Fix botón ↑ + aviso delivery + refinamiento CSS | A+B | ✅ |
| 90 | HOME: categorías circulares + hero + nuevos ingresos | A+B | ✅ |
| 91 | page.tsx: legal_name + rif + address props | A | ✅ |
| 92 | Footer negocio + página /p/[id] + ProductoDetalle | B | ✅ |
| 93 | /productos page + catalogMode + fix redundancia chips | B | ✅ |
| 94 | Playwright capturas referencia tuproveedor.com.ve | D | ✅ |
| 95 | Footer rediseño completo + FAB WA condicional | B | ✅ |
| 96 | image_url Category schema + PATCH + admin + catálogo | A+B | 🔄 CLI-B ejecutando |
| 96-P0 | Fix botón Continuar → checkout paso 1 | B | ✅ |

---

## PENDIENTE — EN ORDEN ESTRICTO DE EJECUCIÓN

### Sprint 97 — CLI-B | Verificación y refinamiento visual 3 páginas
**Trigger:** Deploy del acumulado + capturas de Carlos de las 3 páginas
**Qué:** Ajustes visuales basados en capturas reales vs referencia
**Referencia:** `.e2e-screenshots/referencia-catalogo/` (5 imágenes en repo)
**Archivos:** `CatalogoGrid.tsx` + `catalogo.module.css` + `productoDetalle.module.css`

### Sprint 98 — CLI-B | HOME refinamiento visual con referencia
**Trigger:** Sprint 97 aprobado visualmente
**Qué:** 
- Sección "Nuevos Ingresos" con badge visible
- "Ver todos →" de círculos → `/catalogo/[slug]/productos?categoria=X`
- Menú hamburguesa: Inicio / Catálogo completo
- Fondo gris sutil entre secciones como en referencia
**Archivos:** `CatalogoGrid.tsx` + `catalogo.module.css`

### Sprint 99 — CLI-B | GRID /productos refinamiento visual
**Trigger:** Sprint 98 aprobado
**Qué:**
- Título "Catálogo de Productos" con dot de color
- Buscador visible full-width como referencia
- Contador "N productos" a la derecha
- Botón Filtros a la izquierda
**Archivos:** `CatalogoGrid.tsx` + `catalogo.module.css`

### Sprint 100 — CLI-B | PRODUCTO /p/[id] refinamiento visual
**Trigger:** Sprint 99 aprobado
**Qué:**
- Verificar layout 2 col desktop funciona
- Galería thumbnails navegables
- Precio dual USD+Bs correcto
- Variantes seleccionables
- BCV note visible
- Botón "Pedir ahora" abre WhatsApp correcto
**Archivos:** `ProductoDetalle.tsx` + `productoDetalle.module.css`

### Sprint 101 — CLI-A + CLI-B | Uploader imagen categoría
**Trigger:** Sprint 100 aprobado
**Qué:**
- CLI-A: endpoint upload imagen para categoría (mismo patrón que productos)
- CLI-B: admin categorías — botón upload real, no input URL
**Archivos:** `api/categories/[id]/image/route.ts` + admin categorías

### Sprint 102 — CLI-D | Demo accounts en VPS
**Trigger:** Sprint 101 aprobado
**Qué:** Crear 3 cuentas demo (pro/negocio/mostrador) con datos reales
**Archivos:** scripts de seed

### Sprint 103 — CLI-A | Fix blog P0 en local
**Trigger:** Cualquier momento — no bloquea catálogo
**Qué:** Commitear el fix de BLOG_CATEGORIES que está solo en VPS
**Archivos:** `src/app/(marketing)/blog/page.tsx`

---

## REGLA DE AVANCE

Ningún sprint avanza sin:
1. Deploy del anterior al VPS
2. Capturas de Carlos de las 3 páginas afectadas
3. Aprobación visual explícita

---

## PRÓXIMA ACCIÓN INMEDIATA

1. Carlos hace deploy del acumulado Sprints 92-96
2. Carlos envía capturas de `/catalogo/[slug]`, `/catalogo/[slug]/productos`, `/catalogo/[slug]/p/[id]`
3. Se genera Sprint 97 con ajustes específicos basados en lo que se vea
