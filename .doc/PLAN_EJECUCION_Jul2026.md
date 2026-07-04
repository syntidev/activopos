# PLAN DE EJECUCIÓN — ActivoPOS Pre-Launch
# Fecha inicio: Martes 1 Julio 2026
# Fecha entrega: Viernes 11 Julio 2026
# Objetivo: Cliente prueba en segunda semana de julio, arranca agosto
# Tokens: plan Max (5x) — sesiones de 12h diarias

---

## REGLAS DEL PLAN

1. Cada día tiene un entregable verificable — no se avanza sin cerrar el día anterior
2. Cada prompt incluye skills + bloque commit — no hay improvisación
3. CLI-A y CLI-B trabajan en paralelo cuando no comparten archivos
4. CLI-C audita cada 3 días (días 3, 6, 9)
5. Si un día se atrasa, se come del buffer (día 10) — no se empuja todo
6. Los recortes ya están definidos — si el tiempo aprieta, se ejecutan sin debatir

---

## ESTADO DE PARTIDA (29 Jun 2026)

```
✅ POS completo (18 módulos)
✅ Catálogo digital premium (patrón LLEVA)
✅ Tenant Layer sellado (123 endpoints)
✅ Sistema multimedia (compresión + storage tenant)
✅ Bugs P0 corregidos (stock, filtros, upload)
✅ Selector de color por segmento (CAT-08 — en commit)
⬜ Onboarding — NO EXISTE
⬜ Admin Panel — PARCIAL (2 páginas básicas Sprint 25)
⬜ Planes/Suscripciones — NO EXISTE
⬜ Flujo E2E verificado — NO PROBADO
```

---

## DÍA 1 — Martes 1 Julio
### Tema: Deuda visual + Diseño onboarding

**CLI-B (3h):**
- Thumb 400px en cards del catálogo (cambiar images[0] por thumb URL)
- Modal producto mobile: imagen max-height 40vh
- Verificar CAT-08 en producción (deploy + test visual)

**Claude Web (2h):**
- Diseñar flujo onboarding completo:
  - Paso 1: Email + contraseña
  - Paso 2: Nombre negocio + segmento + ciudad + teléfono WhatsApp
  - Paso 3: Logo (opcional) + color del negocio (reusar CAT-08)
  - Paso 4: Métodos de pago (checkboxes de los venezolanos)
  - Pantalla de bienvenida con "Primeros pasos"
- Definir schema: ¿tabla tenants separada o businesses es el tenant?
- Definir seed por segmento: qué categorías, métodos de pago, config se crean automáticamente

**Entregable día 1:**
```
☐ Thumb 400px en cards verificado
☐ Modal mobile con imagen contenida
☐ Documento de diseño onboarding aprobado
☐ Schema onboarding definido
```

---

## DÍA 2 — Miércoles 2 Julio
### Tema: Onboarding backend

**CLI-A (8h):**
- POST /api/onboarding/register — crear user + business + defaults en $transaction
  - Validación Zod: email unique, password min 8, business name, segment, city
  - Crear business con plan='trial', subscription_status='trial', plan_expires_at=+30 días
  - Crear user con role='admin'
  - Seed categorías por segmento (5-8 categorías predefinidas según segmento)
  - Seed métodos de pago venezolanos (Pago Móvil, Zelle, Efectivo USD, Efectivo Bs)
  - Generar catalog_slug automático del nombre del negocio
  - Crear directorio storage/tenants/{id}/products/ y /logo/
  - Devolver JWT token en response (login automático post-registro)

- GET /api/onboarding/check-slug — verificar disponibilidad de slug
- GET /api/onboarding/segments — lista de segmentos disponibles

**Entregable día 2:**
```
☐ POST /api/onboarding/register funcional
☐ Seed por segmento creando categorías correctas
☐ Slug auto-generado y verificable
☐ JWT devuelto post-registro (login automático)
☐ Build limpio
```

---

## DÍA 3 — Jueves 3 Julio
### Tema: Onboarding frontend + auditoría

**CLI-B (6h):**
- Página /onboarding con wizard multi-step
  - Step indicator visual (1-2-3-4 con progress bar)
  - Step 1: email + contraseña + confirmar contraseña
  - Step 2: nombre negocio + segmento (select) + ciudad + WhatsApp
  - Step 3: logo upload (reusar compresión) + color selector (reusar CAT-08 grid)
  - Step 4: métodos de pago (checkboxes)
  - Validación por step — no avanza sin completar
  - Submit → llamar POST /api/onboarding/register
  - Success → redirect a /escritorio con toast de bienvenida

**CLI-C (2h):**
- Auditoría onboarding:
  - Email duplicado → error claro
  - SQL injection en nombre/email
  - Rate limiting en register
  - Password hashing (bcrypt, no plain)
  - CSRF / validación de origin
  - Slug collision handling

**Entregable día 3:**
```
☐ Wizard de 4 pasos funcionando E2E
☐ Registro crea negocio con categorías + métodos de pago
☐ Login automático post-registro
☐ Auditoría de seguridad limpia
☐ Build limpio
```

---

## DÍA 4 — Viernes 4 Julio
### Tema: Admin Panel

**CLI-A (4h):**
- GET /api/admin/tenants — lista paginada con métricas
  (nombre, plan, status, productos count, ventas count, último login)
- GET /api/admin/tenants/[id] — detalle completo
- PATCH /api/admin/tenants/[id] — activar/suspender/cambiar plan
- GET /api/admin/dashboard — KPIs globales
  (total tenants, activos, trial, revenue estimado, ventas totales)

**CLI-B (4h):**
- /admin/tenants → tabla con búsqueda, filtros por plan/status, paginación
- /admin/tenants/[id] → detalle con métricas del negocio
- /admin/dashboard → KPIs cards + gráfico de registros por día
- Sidebar admin separado del dashboard de tenant

**Entregable día 4:**
```
☐ Carlos puede ver lista de tenants registrados
☐ Puede activar/suspender un tenant
☐ Puede cambiar plan de un tenant
☐ Dashboard admin con KPIs globales
☐ Build limpio
```

---

## DÍA 5 — Sábado 5 Julio
### Tema: Planes y límites

**CLI-A (4h):**
- Schema: plan, plan_expires_at, subscription_status ya existen en businesses
- Middleware de plan: verificar límites antes de cada operación
  - free/trial: 50 productos, 2 usuarios, catálogo básico
  - starter: 200 productos, 5 usuarios, catálogo + analytics
  - pro: ilimitado
- Bloqueo suave: al alcanzar límite → mensaje claro, no error críptico
- Alerta de expiración: 7 días antes, 3 días antes, expirado

**CLI-B (4h):**
- Tab "Mi Plan" en Configuración
  - Plan actual con badge visual
  - Fecha de vencimiento
  - Barra de uso (productos usados / máximo)
  - Alerta si está por vencer
  - Botón "Cambiar plan" (placeholder — contactar por WhatsApp)

**Entregable día 5:**
```
☐ Límites enforced por plan (productos, usuarios)
☐ Mensaje claro al alcanzar límite
☐ Tab "Mi Plan" visible con info real
☐ Alerta de expiración funcionando
☐ Build limpio
```

---

## DÍA 6 — Domingo 6 Julio
### Tema: Polish + auditoría completa

**CLI-B (4h):**
- Dashboard de bienvenida para tenant nuevo:
  Checklist visual "Primeros pasos":
  ☐ Sube tu logo
  ☐ Crea tu primer producto
  ☐ Activa tu catálogo digital
  ☐ Comparte tu link por WhatsApp
  Cada item linkea a la sección correspondiente.
  Se oculta cuando completa todos.

**CLI-C (4h):**
- Auditoría completa: onboarding + admin + planes + catálogo
- Checklist OWASP top 10
- Verificar que tenant A no ve datos de tenant B
- Verificar límites de plan
- Verificar que el catálogo público funciona para tenants nuevos

**Entregable día 6:**
```
☐ Bienvenida con primeros pasos
☐ Auditoría de seguridad completa
☐ Cero leaks de tenant verificados
☐ Build limpio
```

---

## DÍA 7 — Lunes 7 Julio
### Tema: Desnormalizar business_id + E2E

**CLI-A (6h):**
- Migración Prisma: agregar business_id a SaleItem, SalePayment, SaleAbono,
  OrderItem, QuotationItem, ReturnItem, ProductVariant
- Script de backfill: popular business_id desde el padre (sale → saleItems, etc.)
- Actualizar tenant layer para cubrir estas tablas directamente

**CLI-D (4h):**
- Playwright E2E:
  - Test 1: Onboarding completo (registro → dashboard)
  - Test 2: Crear producto con imagen → aparece en catálogo
  - Test 3: Pedido por catálogo → llega a pedidos del admin
  - Test 4: Cobrar en POS → refleja en reportes
  - Test 5: Tenant A no ve productos de Tenant B

**Entregable día 7:**
```
☐ business_id en tablas hijas — backfill completo
☐ 5 tests E2E pasando
☐ Build limpio
```

---

## DÍA 8 — Martes 8 Julio
### Tema: Landing page + SEO catálogo

**CLI-B (6h):**
- Landing page activopos.com actualizada:
  - Hero con propuesta de valor
  - 3 bloques: Opera, Publica, Decide
  - Sección de planes con precios
  - Botón "Crear cuenta gratis" → /onboarding
  - Footer con links
  - Mobile responsive

- SEO catálogo público:
  - Meta tags dinámicos (título, descripción, OG image del logo)
  - Schema.org para LocalBusiness
  - Sitemap del catálogo

**Entregable día 8:**
```
☐ Landing con CTA a onboarding
☐ Planes visibles en landing
☐ Meta tags dinámicos en catálogo
☐ Build limpio
```

---

## DÍA 9 — Miércoles 9 Julio
### Tema: E2E completo como si fueras el cliente

**Todos los CLIs:**
- Registrarse como nuevo usuario
- Crear 10 productos con fotos
- Configurar métodos de pago
- Activar catálogo digital
- Compartir link y hacer pedido desde otro dispositivo
- Cobrar el pedido en POS
- Ver reportes del día
- Verificar que todo funciona en mobile

**CLI-C:**
- Auditoría final de seguridad
- Performance check (build size, LCP, CLS)
- Verificar que no hay console.errors en producción

**Entregable día 9:**
```
☐ Flujo E2E completo sin bugs
☐ Auditoría de seguridad final limpia
☐ Performance aceptable (LCP < 2.5s)
☐ Cero console.errors
```

---

## DÍA 10 — Jueves 10 Julio (BUFFER)
### Tema: Bugs + polish

- Bugs encontrados en día 9
- UX copy en español venezolano (tuteo)
- Textos de error claros y amigables
- Loading states en todas las páginas
- Empty states en todas las listas
- Favicon y PWA manifest

---

## DÍA 11 — Viernes 11 Julio
### Tema: Deploy final + cuenta demo

**Deploy:**
```bash
cd /var/www/activopos
git fetch origin && git merge origin/main --no-ff
npm install --legacy-peer-deps
npx prisma generate && npx prisma migrate deploy
rm -rf .next && npm run build && pm2 restart activopos
```

**Preparación para el cliente:**
- Crear cuenta demo con datos de ejemplo
- Verificar onboarding en producción
- Verificar catálogo público en producción
- Documentación rápida de uso (PDF de 1 página o video 5 min)

**Entregable día 11:**
```
☐ ActivoPOS en producción con onboarding funcional
☐ Admin panel operativo
☐ Cuenta demo lista para el cliente
☐ Documentación básica
```

---

## DÍA 12 — Sábado 12 Julio (BUFFER)
- Fixes de último minuto
- Soporte si el cliente empieza a probar

---

## RECORTES APROBADOS (si el tiempo aprieta)

```
PUEDE ESPERAR (no bloquea al cliente):
- Desnormalización business_id tablas hijas (día 7) → es seguridad extra
- SEO schema.org (día 8) → no afecta la prueba
- Playwright E2E suite (día 7) → testing manual suficiente
- PWA manifest (día 10) → nice-to-have
- Recovery de contraseña → Carlos resetea manual

NO PUEDE ESPERAR:
- Onboarding (días 2-3) — sin esto no se registra
- Admin Panel (día 4) — sin esto Carlos no gestiona
- Planes (día 5) — sin esto no hay modelo de negocio
- Deploy final (día 11) — sin esto no hay producción
```

---

## MÉTRICAS DE ÉXITO PARA EL 11 DE JULIO

```
1. Un usuario nuevo puede registrarse sin ayuda de Carlos
2. Puede crear productos, subir fotos, configurar métodos de pago
3. Su catálogo público es accesible por link y WhatsApp
4. Puede recibir pedidos y cobrarlos en el POS
5. Carlos puede ver quién se registró desde el admin
6. Los planes limitan correctamente según el tier
7. Cero leaks de datos entre tenants
8. Mobile responsive en todo el flujo
```

---

*Plan creado: 29 Junio 2026 | Meta: 11 Julio 2026*
*ActivoPOS — SYNTIdev | De 68% a 95% en 12 días*
