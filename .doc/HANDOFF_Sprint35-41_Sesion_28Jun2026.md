# HANDOFF — Sprints 35–41 | Sesión 28-29 Junio 2026
# ActivoPOS | Entregado por: Claude Opus 4.6 (Web + CLI)
# La sesión más productiva del proyecto hasta la fecha

---

## ANTES DE HACER CUALQUIER COSA

Lee estos archivos en este orden:
```
1. CLAUDE.md (raíz)
2. .doc/SYSTEM_MAP.md
3. .doc/ACTIVOPOS_MASTER_V2.md
4. .doc/AGENTS.md
5. .doc/ECC_BRIEFING_AGENTES.md
```

## INICIO DE SESIÓN — SIEMPRE

```powershell
Remove-Item -Recurse -Force .next
npx prisma generate
npm run dev
# Esperar "Ready on http://localhost:3000"
curl http://localhost:3000/api/rates/bcv
# Esperado: {"rate":XXX.xx,"source":"bcv","ok":true}
```

---

## QUÉ SE COMPLETÓ EN ESTA SESIÓN (12+ horas de trabajo)

### Sprint 35 — Rediseño visual catálogo público
- Hero comprimido 72px con `--biz-color` dinámico por negocio
- Métodos de pago eliminados del drawer (solo en checkout como `<select>`)
- Precio Bs por ítem en el carrito
- Badges semánticos: Popular=warning, Nuevo=info, Promo=danger, Recomendado=success
- Glassmorphism `backdrop-filter: blur(20px)` en drawer, modal y checkout
- Animación celebración: confeti 60 partículas + tarjeta Framer Motion spring

### Sprint 35.1 — Correcciones P1/P2
- 4 clases CSS huérfanas `drawerPayments*` eliminadas
- 17 `#fff` migrados a `var(--color-white)`
- `#6ee7b7` / `#10b981` → `var(--color-success)`
- `.cancelBtn` min-height subido a `var(--touch-min)` (44px)
- `CONFETTI_COLORS` documentado como excepción decorativa

### Sprint 35.2 — Fix contraste heroBadgeOpen
- Badge "Abierto": `background: var(--color-success)` + `color: var(--color-white)`
- Garantiza contraste sobre cualquier `--biz-color`

### Sprint 36 — Design taste + animaciones premium
- Cards: `@keyframes cardEnter` con delay escalonado `i × 40ms` (cap 12)
- Grid: key por categoría+subcategoría → re-stagger al filtrar
- Cart badge: `@keyframes cartBounce` (cubic-bezier spring 0.34,1.56)
- Empty states: `@keyframes iconFloat` 2.8s/3s
- `prefers-reduced-motion` respetado en todo

### Sprint 36.1 — Doble header patrón LLEVA.app
- H1 sticky top:0 (52px): logo + nombre + carrito
- H2 sticky top:52px (48px): hamburguesa + lupa + chips categoría
- Lupa expandible: `searchSlideIn 200ms translateX`
- Dropdown categorías con glassmorphism desde hamburguesa
- Hero: separado como contenido scrolleable (no sticky)

### Sprint 36.2 — Fix sticky (causa raíz)
- Causa: `overflow-x: hidden` en globals.css anulaba sticky en todo el catálogo
- Fix: `.root` → `height: 100dvh; overflow: hidden auto` (scroll container propio)
- `flex-shrink: 0` en ambos headers para evitar compresión flex

### Sprint 37 — Clonación LLEVA.app completa
- Hero/banner ELIMINADO completamente
- Solo 2 headers (H1 identidad + H2 navegación)
- Cards con sombra 2 niveles, accent `scaleX` hover, aspect 4:5
- Dropdown categorías, chips con glow del `--biz-color`
- Orden H2: hamburguesa → lupa → chips (no fijo "Todos")

### Sprint 38 — Cards premium + Modal showcase
- Card: padding interno 8px, imagen radius 10px dentro de card 14px
- Imagen: lazy fade-in 300ms + zoom 1.03 hover + guard anti-caché
- Badge: micro-icono Lucide (Flame/Sparkles/Tag/ThumbsUp)
- Separador imagen-texto degradado sutil
- Botón "+" circular 44px con sombra del `--biz-color`
- Modal: imagen full-bleed, precio `$` chico + número grande, "Agregar · $X.XX"
- Footer branding "Catálogo digital con ActivoPOS"
- `prefers-reduced-motion` en todo lo nuevo

### Sprint 38.1 — Estética + accesibilidad WCAG
- Cards sin stock: `opacity: 0.55` + `grayscale(30%)` + `tabIndex={-1}`
- Placeholder imagen: gradiente 145° + sombra interna
- Touch targets: todos los botones ≥44px
- Focus-visible en cards, botones, chips

### Sprint 39 — Auditoría módulo Productos + Inventario
- **BUG-1 Stock CONFIRMADO Y CORREGIDO**: API devolvía `stock: { quantity, waste, net_qty }`, frontend leía `product.stock_quantity` — naming mismatch
- **BUG-2 Filtros CONFIRMADO Y CORREGIDO**: frontend enviaba `?categoryId=`, backend leía `category_id` — filtro nunca llegaba a Prisma
- **BUG-3 Catálogo parcial**: stock estático vs real → corregido en 39.1
- Seguridad: IDOR OK, Zod OK, SQL injection OK

### Sprint 39.1 — Stock real en catálogo + inputMode
- `catalog/[slug]/route.ts`: `InventoryEntry.groupBy` + `computeAvailability` real
- Productos agotados ahora muestran `outOfStock: true` en catálogo público
- StockModal inputs: `inputMode="decimal"` para teclado móvil

### Sprint 40 — Sistema multimedia completo
- **BUG P0**: endpoint `/api/products/upload-image` NO EXISTÍA — upload 100% roto
- Backend: `MAX_SIZE` 5MB, dual output full 1200px + thumb 400px WebP
- Frontend: compresión Canvas API antes de upload (1600px max, WebP 0.85)
- Badge "WebP" en slot de imagen
- Accept explícito `jpeg/png/webp`
- Spinner "Comprimiendo y subiendo..."

### Sprint 40.1 — Storage tenant + Nginx
- Upload diferenciado: `type=product` → `storage/tenants/{id}/products/`, `type=logo` → `storage/tenants/{id}/logo/`
- Nginx: duplicado `activopos.com` eliminado, `location ^~ /storage/` con alias
- Guard en `config/business/route.ts` actualizado para aceptar `/storage/tenants/`

### Sprint 41 — TENANT LAYER v1 (fundacional)
- `prisma-tenant.ts`: Prisma Client Extension DMMF-driven (auto-detecta modelos con business_id)
- `tenant.ts`: `getAuthenticatedTenant()` helper
- 22 modelos con business_id auto-scoped
- 7 tablas hijas aisladas vía FK al padre
- Test de aislamiento: 5/5 verde
- IDOR prevention: `findUnique` valida ownership post-query

### Sprint 41.1 — Migración masiva (4 oleadas)
- **Oleada 1**: 50 GET de lectura migrados
- **Oleada 2**: 13 mutaciones (productos, clientes, config-tenant)
- **Oleada 3**: 23 endpoints de dinero ($transaction) — tx en prisma base con business_id manual
- **Oleada 4**: 20 mutaciones restantes
- **TOTAL**: 123 endpoints auditados, 92 sobre tenant layer, 3 raw-only, 13 públicos, 9 business-root, cero leaks

---

## ESTADO ACTUAL DEL SISTEMA

### Commits de esta sesión (en orden cronológico)
```
334a720  feat(catalogo/CLI-B): rediseño visual + animación celebración — Sprint 35
81c6165  fix(catalogo/CLI-B): correcciones P1/P2 post-auditoría
001df5c  fix(catalogo/CLI-B): contraste heroBadgeOpen
76d065b  feat(catalogo/CLI-B): design taste — stagger, bounce, idle
d4d82ed  feat(catalogo/CLI-B): doble header LLEVA pattern
c109d2c  fix(catalogo/CLI-B): sticky headers — overflow fix
b99b1ef  feat(catalogo/CLI-B): clonación LLEVA.app — 2 headers, cards profundidad
9f0008c  feat(catalogo/CLI-B): cards premium — padding, radius, fade-in, badges
c406e42  fix(catalogo/CLI-B): estética sin-stock + accesibilidad WCAG
3646ae0  fix(productos/CLI-C): stock display + filtro categoría
ce3f836  fix(catalog+stock/CLI-A): stock real + inputMode StockModal
52265f7  feat(upload/CLI-A): sistema multimedia completo
9c9ba31  fix(upload/CLI-A): storage tenant diferenciado
380a660  feat(tenant/CLI-A): Tenant Layer v1 — Prisma Client Extension
4af3c19+ (múltiples) Oleada 1-4 tenant migration
7934839  feat(tenant/CLI-A): Oleada 4 cierre — 100% tenant layer
```

### Módulos operativos — 20+ total
| Módulo | Estado | Notas sesión |
|--------|--------|-------------|
| Catálogo público | ✅ Rediseñado | Patrón LLEVA clonado |
| Productos | ✅ Bugs corregidos | Stock display + filtros |
| Upload/Multimedia | ✅ Reconstruido | Era P0 roto, ahora completo |
| Tenant Layer | ✅ SELLADO | 123 endpoints, 4 oleadas |
| Storage | ✅ Reestructurado | `storage/tenants/{id}/` |
| Nginx | ✅ Corregido | Duplicado eliminado, storage alias |

---

## PENDIENTES PARA PRÓXIMA SESIÓN

### Prioridad alta
1. **Verificar multimedia en producción** — subir foto real desde teléfono, confirmar que se ve en card y catálogo
2. **Desnormalizar business_id a tablas hijas** (SaleItem, SalePayment, etc.) — defensa en profundidad IDOR
3. **Selector de color de banner por segmento** (CAT-08) — UI en TabTema.tsx con los 10 colores del sistema
4. **Actualizar documento ActivoPOS_Catalogo_Diseño_v1.docx** con todo lo definido en esta sesión

### Prioridad media
5. **Modal de producto en catálogo** — imagen ocupa mucho viewport en mobile, precio queda fuera de vista
6. **Local dev no sirve /storage/** — necesita rewrite en next.config o symlink
7. **`@default("#2563EB")` en schema.prisma** — hex hardcodeado en el default de theme_color
8. **Deuda CSS**: 2 `style={{...}}` inline en ProductModal.tsx con Loader2

### Roadmap
9. **Bloque 4 — Módulos**: Sucursales, Fábrica completa, Delivery
10. **Bloque 5 — Admin Panel**: admin.activopos.com con Filament v5
11. **Bloque 6 — Deploy**: Nginx wildcard, SSL, 2 tenants reales
12. **Bloque 7 — Lanzamiento**: Demo Margarita, primeros 10 clientes

---

## ARCHIVOS CLAVE MODIFICADOS

```
src/lib/prisma-tenant.ts          ← NUEVO — Prisma Client Extension DMMF-driven
src/lib/tenant.ts                 ← NUEVO — getAuthenticatedTenant()
src/app/api/upload/image/route.ts ← Reconstruido — dual size, storage tenant
src/app/catalogo/[slug]/CatalogoGrid.tsx ← Rediseño completo
src/app/catalogo/[slug]/catalogo.module.css ← Rediseño completo
src/components/products/ProductModal.tsx ← Fix upload URL + compresión
src/components/products/StockModal.tsx ← inputMode decimal
tests/tenant-isolation.spec.ts    ← NUEVO — 5 tests aislamiento
Todos los route.ts en src/app/api/ ← Migrados a tenant layer
```

---

## VPS — ESTADO

```
Nginx: /etc/nginx/sites-available/activopos (único, sin duplicado)
  location ^~ /storage/ → /var/www/activopos/storage/
Storage: /var/www/activopos/storage/tenants/{id}/products/
         /var/www/activopos/storage/tenants/{id}/logo/
PM2: activopos (cluster mode, puerto 3003)
SSL: Certbot activo
```

---

*Generado: 29 Junio 2026 | Sesión: 28-29 Jun | Claude Opus 4.6*
*Sprints 35-41 completados | Tenant Layer SELLADO*
