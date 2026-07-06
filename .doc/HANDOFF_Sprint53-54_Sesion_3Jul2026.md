# HANDOFF — Sprints 53–54 — Sesión 3 Julio 2026
# ActivoPOS | SYNTIdev | Carlos Bolívar, Arquitecto
# Generado por: Claude Web
# Fecha de corte: 3 Julio 2026, cierre de sesión
# Progreso global estimado: ~89%

---

## INSTRUCCIÓN INICIAL — CÓMO ARRANCAR (obligatorio, en este orden)

```
1. CLAUDE.md (raíz del proyecto)              ← gobernanza absoluta, reglas irrompibles
2. .doc/SYSTEM_MAP.md                         ← estado real del sistema
3. .doc/AGENTS.md                             ← protocolo multi-agente CIMAAD
4. .doc/ECC_BRIEFING_AGENTES.md               ← skills, plugins, MCPs disponibles
5. .doc/HANDOFF_Sprint52_Sesion_2Jul2026.md   ← sesión anterior
6. Este documento                             ← lo que se hizo hoy
```

Verificar estado del repo antes de cualquier acción:
```powershell
cd C:\laragon\www\activopos
git log --oneline -15
git status
npx tsc --noEmit 2>&1 | Select-String "error" | Measure-Object
npm run dev
```

Verificar VPS:
```bash
ssh root@187.124.241.213
cd /var/www/activopos
git log --oneline -5
pm2 status
curl -s -o /dev/null -w "%{http_code}" https://activopos.com/login
```

---

## ESTADO DEL REPO AL CIERRE

- **Rama:** `main`
- **Build:** ✅ pendiente confirmar `npm run build` tras commits de hoy
- **VPS:** deploy pendiente de esta sesión
- **TypeScript:** 0 errores (verificado por cada agente en sus commits)
- **Fachadas activas:** 1 documentada — UI facturas + tickets (CLI-B, contrato asumido, sin backend real aún)

---

## COMMITS DE ESTA SESIÓN — SPRINT 53 + 54

### Sprint 53 — Panel Admin: Arquitectura, Seguridad y Plan Enforcement

| Commit | Agente | Descripción |
|---|---|---|
| `3b06e30` | Opus/CLI-A | fix(admin): DT-10 — /businesses y /stats añadidos a SUPER_ADMIN_ONLY en middleware |
| `43a47db` | Opus/CLI-A | feat(plan): access_catalog read-time gate — isCatalogLive() en 3 endpoints públicos |
| `ae406a0` | CLI-B | feat(admin): búsqueda por nombre, filtro por plan, paginación 25/pág en /businesses |
| `fcbb380` | Opus/CLI-A | feat(admin): GET /api/admin/tenants + campos reales (subscriptionActive, subscriptionExpiresAt, userCount) + enum plan corregido |
| `6f30095` | CLI-B | fix(admin): planBadge usa tiers reales del schema — trial/inicio/pro/business |
| `4ea62bb` | CLI-B | feat(admin): link Panel Admin en Sidebar solo para super_admin — ícono Shield, var(--color-brand) |
| `2558bee` | CLI-B | fix(admin): PLANS array corregido — trial/inicio/pro/business (elimina 'starter' obsoleto) |
| `9641e36` | CLI-B | fix(admin): PLANS deriva de Object.keys(PLAN_LIMITS) — única fuente de verdad para tiers |

### Sprint 54 — Impersonación + Facturación + Tickets + Config Global

| Commit | Agente | Descripción |
|---|---|---|
| `a8276a6` | Opus/CLI-A | feat(admin): impersonación de tenant — cookie jose HS256, override business_id en getSession(), POST/DELETE /api/admin/impersonate/[id], banner en dashboard layout |
| `272f8c1` | CLI-B | feat(admin): UI /admin/invoices + /admin/tickets — contrato de datos asumido (⚠️ fachada documentada, backend pendiente) |
| `c0427ea` | CLI-B | feat(admin): página /admin/settings — info SaaS + tasa BCV real + tabla QA cleanup |
| `5f0492a` | Opus/CLI-A | fix(admin): link Panel Admin oculto durante impersonación — prop isImpersonating server→client |

**Total esta sesión: 12 commits**

---

## DECISIONES ARQUITECTÓNICAS TOMADAS HOY

### 1. Panel Admin — Separación de superficies (decisión de Carlos)
El problema identificado: el panel admin y el dashboard de tenant compartían route group, sidebar y login. Esto es incorrecto en cualquier SaaS serio.

**Diagnóstico:** las páginas admin estaban en `(dashboard)` mezcladas con el negocio. El middleware apuntaba a `/admin` pero las rutas reales eran `/businesses` y `/stats` — gate era código muerto (DT-10).

**Corrección aplicada:** middleware.ts corregido con rutas reales en SUPER_ADMIN_ONLY. La separación visual completa (layout propio, sin sidebar de negocio) queda pendiente para sesión futura.

### 2. access_catalog — Gate en read-time, no en escritura (Opus)
El endpoint de catálogo público es anónimo — un 403 expone estado de facturación del tenant.
**Decisión:** 404 en read-time cuando `isCatalogLive()` retorna false (plan no incluye catálogo O suscripción inactiva O expirada). Consistente con el comportamiento existente de slug no encontrado.

### 3. Impersonación — Diseño de seguridad sellado (Opus)
- Cookie separada `activopos_impersonation` firmada jose HS256, exp 2h
- Sesión real del super_admin intacta — nunca sobrescrita
- Override de `business_id` en `getSession()` SOLO si actor es `super_admin` Y cookie verifica
- Fail-closed: cookie manipulada o expirada → `jwtVerify` falla → null → sin override
- Middleware no requirió cambios (super_admin ya pasaba los checks de rol)
- Banner en dashboard layout — componente server lee cookie, prop `isImpersonating` pasado a DashboardShell → Sidebar
- Link "Panel Admin" oculto cuando `isImpersonating === true` — previene violación de frontera

### 4. PLANS array — Única fuente de verdad
`Object.keys(PLAN_LIMITS)` en `TenantActions.tsx` — cualquier cambio en tiers de plan-limits.ts se propaga automáticamente al selector y filtro del panel admin.

### 5. SYNTIweb como referencia arquitectónica
Carlos compartió el código fuente completo del panel admin de SYNTIweb (Laravel/Filament). Se estudió la lógica — no el código. Los flujos adoptados:
- Impersonación "Entrar como cliente" con banner y vuelta al panel ✅
- Facturación: aprobar/rechazar pago + activar suscripción (pendiente backend)
- Tickets de soporte con sugerencia IA (pendiente backend)
- Config global del SaaS (implementado como /admin/settings ✅)

---

## FEATURES COMPLETADOS Y VERIFICADOS VISUALMENTE

| Feature | Estado | Verificación |
|---|---|---|
| Panel admin /businesses con búsqueda + filtros + paginación | ✅ | Visual Carlos |
| Middleware SUPER_ADMIN_ONLY con rutas reales | ✅ | Código verificado |
| access_catalog read-time gate (isCatalogLive) | ✅ | Código verificado |
| Tiers de plan corregidos (trial/inicio/pro/business) — única fuente | ✅ | Código verificado |
| Link Panel Admin en Sidebar solo para super_admin | ✅ | Visual Carlos |
| Impersonación — entrar como tenant sin conocer contraseña | ✅ | Visual Carlos |
| Banner "Modo administrador" durante impersonación | ✅ | Visual Carlos |
| Link Panel Admin oculto durante impersonación | ✅ | Visual Carlos |
| /admin/settings — info SaaS + tasa BCV + tabla QA | ✅ | Visual Carlos |

---

## FACHADAS ACTIVAS — DOCUMENTADAS EXPLÍCITAMENTE

### FACHADA-01: UI /admin/invoices + /admin/tickets
**Commit:** `272f8c1` — CLI-B
**Estado:** UI construida y funcional visualmente, contra contrato de datos asumido.
**Lo que falta:** modelos Prisma Invoice y SupportTicket + migración + 10 endpoints reales.

**Contrato asumido por CLI-B (Opus debe matchear exactamente):**
```
GET  /api/admin/invoices?q=&status=
     → { ok, invoices: [{ id, invoice_number, business_name, amount_usd, channel, reference, created_at, status }] }

GET  /api/admin/invoices/[id]
     → { ok, invoice: { id, invoice_number, status, business:{name,email,phone}, channel, reference, amount_usd, created_at, period, review:{notes,reviewed_by,reviewed_at}|null } }

PATCH /api/admin/invoices/[id]
     → body { action:'approve'|'reject', notes }

GET  /api/admin/tickets?status=&category=
     → { ok, tickets: [{ id, business_name, subject, category, status, created_at }] }

GET  /api/admin/tickets?status=open&count=true
     → { ok, count }

GET  /api/admin/tickets/[id]
     → { ok, ticket: { id, subject, category, status, business_name, message, created_at, reply } }

POST /api/admin/tickets/[id]/ai-suggest
     → { ok, suggestion }

PATCH /api/admin/tickets/[id]/reply
     → body { reply }

PATCH /api/admin/tickets/[id]
     → body { status:'closed' }
```

**Enums reales:**
- InvoiceStatus: `pending | pending_review | paid | rejected`
- TicketCategory: `billing | technical | general`
- TicketStatus: `open | answered | closed`

---

## DEUDA TÉCNICA DOCUMENTADA

| ID | Severidad | Estado | Descripción | Archivo(s) |
|---|---|---|---|---|
| DT-01 | P2 | ⏳ Abierta | `loadLogo` duplicado en quotations y sales PDF | `quotations/[id]/pdf/route.ts` + `sales/[id]/invoice/route.ts` |
| DT-02 | P3 | ⏳ Abierta | `PosMode` local en SuccessTicketPanel — evaluar unificación con `BusinessConfig` | `src/components/pos/SuccessTicketPanel.tsx` |
| DT-03 | P1 | ✅ CERRADA | `access_catalog` sin guardia real — cerrada con isCatalogLive() en read-time | — |
| DT-04 | P2 | ⏳ Abierta | `RateLimiterMemory` no es cluster-safe — pendiente Redis | `src/lib/rate-limit.ts` |
| DT-05 | P3 | ⏳ Abierta | `pdf-report.ts` y `pdf-reports.ts` coexisten — posible duplicación | `src/lib/` |
| DT-06 | P2 | ⏳ Sin confirmar | Encoding tildes en PDF cotizaciones — no verificado si `a447dd7` lo resolvió | `src/app/api/quotations/[id]/pdf/route.ts` |
| DT-07 | P3 | ⏳ Abierta | Desnormalización `business_id` en tablas hijas — IDOR defensa en profundidad | `SaleItem`, `SalePayment`, etc. |
| DT-08 | P2 | ⏳ Abierta | Compras a proveedores no generan CxP | `src/app/api/purchases/route.ts` |
| DT-09 | P3 | ⏳ Abierta | `products/import` crea `InventoryEntry` sin `entry_type` explícito | `src/app/api/products/import/route.ts` |
| DT-10 | P1 | ✅ CERRADA | Middleware SUPER_ADMIN_ONLY apuntaba a rutas inexistentes | `src/middleware.ts` |
| DT-11 | P3 | ⏳ Inofensiva | `/api/ai/chat` sin try/catch TenantError | `src/app/api/ai/chat/route.ts` |
| DT-12 | P2 | ⏳ Abierta | UI /admin/invoices + /admin/tickets sin backend real — FACHADA-01 | Ver sección anterior |
| DT-13 | P3 | ⏳ Abierta | Badge "Super Admin" visible en Header durante impersonación — fuga de display, no accionable | `src/components/layout/Header.tsx` |
| DT-14 | P2 | ⏳ Abierta | access_ai sin guardia en escritura — solo read-time en catalog, ai/chat fue cableado pero sin endpoint de activación real | `src/app/api/ai/chat/route.ts` |

---

## PRÓXIMAS TAREAS — ORDEN DE EJECUCIÓN

### TAREA 1 — INMEDIATA: Deploy VPS (Carlos ejecuta)
Los 12 commits de hoy no están en producción. Build local no confirmado.

```bash
# En VPS:
cd /var/www/activopos
git fetch origin
git checkout -- package-lock.json
git merge origin/main --no-ff --no-edit
npm install --legacy-peer-deps
npx prisma generate
npm run build && pm2 restart activopos
pm2 status
curl -s -o /dev/null -w "%{http_code}" https://activopos.com/login
```

**IMPORTANTE:** No correr `rm -rf .next` antes de confirmar que `npm run build` termina limpio.

---

### TAREA 2 — Opus/CLI-A: Invoice model + migración + 5 endpoints

Greenfield. Diseño acordado en sesión:

**Modelo Prisma Invoice:**
```prisma
model Invoice {
  id                String    @id @default(cuid())
  businessId        String
  invoiceNumber     String    @unique  // auto: ACTI-YYYY-NNNN
  amountUsd         Decimal   @db.Decimal(10,2)
  paymentChannel    String?   // pago_movil | zinli | paypal | zelle | usdt
  paymentReference  String?
  paymentDate       DateTime?
  periodStart       DateTime?
  periodEnd         DateTime?
  receiptPath       String?
  status            InvoiceStatus @default(pending)
  adminNotes        String?   @db.Text
  reviewedBy        String?
  reviewedAt        DateTime?
  createdAt         DateTime  @default(now())
  business          Business  @relation(fields: [businessId], references: [id])
  reviewer          User?     @relation(fields: [reviewedBy], references: [id])
}

enum InvoiceStatus {
  pending
  pending_review
  paid
  rejected
  cancelled
}
```

**Endpoints a crear:**
- `GET /api/admin/invoices` — lista paginada con filtro status
- `POST /api/admin/invoices` — crear factura para un tenant
- `GET /api/admin/invoices/[id]` — detalle
- `PATCH /api/admin/invoices/[id]/approve` — aprobar + activar tenant + renovar `subscription_expires_at`
- `PATCH /api/admin/invoices/[id]/reject` — rechazar + notificar

**Lógica de aprobación (de SYNTIweb):**
```
approve → Invoice.status = 'paid'
        → Business.subscription_active = true
        → Business.subscription_expires_at = invoice.periodEnd
        → reviewed_at = now(), reviewed_by = actor.id
        → notificar al tenant (si hay sistema de notificaciones)
```

---

### TAREA 3 — Opus/CLI-A: SupportTicket model + migración + 5 endpoints

Greenfield. Commit separado del Invoice.

**Modelo Prisma SupportTicket:**
```prisma
model SupportTicket {
  id           String        @id @default(cuid())
  businessId   String
  userId       String?
  subject      String        @db.VarChar(255)
  message      String        @db.Text
  category     TicketCategory
  status       TicketStatus  @default(open)
  adminReply   String?       @db.Text
  aiSuggestion String?       @db.Text
  repliedAt    DateTime?
  createdAt    DateTime      @default(now())
  business     Business      @relation(fields: [businessId], references: [id])
  user         User?         @relation(fields: [userId], references: [id])
}

enum TicketCategory {
  billing
  technical
  general
}

enum TicketStatus {
  open
  answered
  closed
}
```

**Endpoints a crear:**
- `GET /api/admin/tickets` — lista con filtro status/category + `?count=true` para badge sidebar
- `GET /api/admin/tickets/[id]` — detalle
- `PATCH /api/admin/tickets/[id]/reply` — responder + cambiar status a 'answered'
- `PATCH /api/admin/tickets/[id]` — body { status:'closed' }
- `POST /api/admin/tickets/[id]/ai-suggest` — Claude Haiku con contexto del ticket

**Ruta tenant-facing:**
- `POST /api/support/tickets` — tenant crea ticket (usa getSession(), business_id del tenant)

**Lógica ai-suggest (de SYNTIweb/ViewSupportTicket.php):**
```
POST /api/admin/tickets/[id]/ai-suggest:
  - Leer ticket.subject + ticket.message + ticket.category
  - Prompt: "Eres agente de soporte de ActivoPOS. El cliente pregunta:
             Asunto: {subject}. Mensaje: {message}. Categoría: {category}.
             Escribe respuesta profesional, empática, concreta. Máx 150 palabras."
  - Model: claude-haiku-4-5-20251001
  - Guardar en ticket.aiSuggestion
  - Retornar { ok: true, suggestion }
```

---

### TAREA 4 — CLI-B: Reconciliar UI con contratos reales

**Solo después de que Opus entregue Tareas 2 y 3.**

Actualizar `src/app/(admin)/invoices/` y `src/app/(admin)/tickets/` para que los fetch apunten a los endpoints reales y el tipado coincida con la respuesta real de la API.

Verificar que:
- Badge de tickets abiertos en AdminSidebar funciona (GET ?count=true)
- Aprobar/rechazar factura actualiza estado en UI
- Sugerencia IA aparece en textarea antes de enviar respuesta

---

### TAREA 5 — CLI-B: Header durante impersonación (DT-13)

Badge "Super Admin" sigue visible en Header durante impersonación. Es una fuga de display — el tenant ve que quien lo está visitando es un super_admin.

Fix: en Header.tsx, si `isImpersonating === true` → ocultar el badge de rol o reemplazarlo por "Vista de administrador".

El prop `isImpersonating` ya existe en el layout — solo pasarlo al Header.

---

### TAREA 6 — Auditoría CLI-C (batched, al final de sesión)

Auditar en una sola pasada:
- Impersonación: verificar que no hay path alternativo donde `business_id` pueda venir de body durante impersonación
- Invoice y SupportTicket: verificar que tenant A no puede leer facturas de tenant B
- OWASP top 5 en endpoints nuevos
- TypeScript strict: cero any en archivos nuevos

---

## GAP IDENTIFICADO EN SESIÓN — PARA DECISIÓN FUTURA

### Separación total de superficies admin/tenant

**Situación actual:** el super_admin ve el sidebar de negocio + el link de admin mezclados. Durante impersonación, el link se oculta. Pero el layout sigue siendo el mismo.

**Lo correcto (patrón SYNTIweb):**
- `/admin/*` → layout propio: solo navbar SaaS, sin sidebar de negocio
- Login → detecta rol → super_admin → `/businesses`, admin normal → `/escritorio`
- El super_admin NUNCA entra al `(dashboard)` excepto vía impersonación explícita

**Estado actual:** parcialmente implementado. El comportamiento es correcto funcionalmente pero la UI no está separada visualmente.

**Impacto:** medio. No bloquea el demo. Bloquea escalar a equipo de soporte con roles distintos.

**Este gap no se ejecuta sin orden explícita de Carlos.**

---

## ESTADO DEL ROADMAP AL CIERRE

```
Bloque 0: Cierre SYNTImeat          ✅ 100%
Bloque 1: Extracción reglas          ✅ 100%
Bloque 2: Rediseño visual            ✅ 100%
Bloque 3: Tenant Layer               ✅ 100% (123 endpoints sellados)
Bloque 4: Módulos                    ✅ 92% (access_catalog ✅, access_ai ✅, planes ✅)
Bloque 5: Admin Panel                ✅ 85% (impersonación ✅, facturación ⚠️ UI sin backend, tickets ⚠️ UI sin backend)
Bloque 6: Deploy producción          ⏳ 70% (VPS activo, wildcard DNS pendiente)
Bloque 7: Lanzamiento                ⏳ 20% (primeros pagos, demo cliente)

Progreso global: ~89%
Meta: 95% para el 11 de Julio 2026
Días restantes: 8
```

---

## REGLAS QUE NO CAMBIAN

**Monetario:** USD y Bs siempre simultáneos — sin toggle. `Bs = USD × rate_bcv`. Nunca hardcodeado. Nunca bloquear operación por falta de tasa.

**Venta:** `qty × price` — NUNCA `monto_bs → qty`.

**Stock:** descuenta SOLO cuando `sale.status='paid'` o `sale.status='credit'`.

**Seguridad:**
- `business_id` siempre desde `getAuthenticatedTenant()` / `getSession()` — NUNCA del body
- Durante impersonación: override criptográficamente ligado al actor verificado via cookie jose HS256
- JWT fail-closed — sin fallback secrets
- Precios siempre del servidor — nunca del cliente

**TypeScript:** strict: true, cero any, cero cast inseguro.

**CSS:** solo CSS Modules, cero Tailwind, cero inline styles.

**Commits:** staging explícito siempre — nunca `git add .` ciego. CLAUDE.md, .claude/settings.json y graphify-out/ nunca se incluyen en commits de features.

**Auditorías:** batched al final de sesión — nunca por sprint individual.

**Fachadas:** declarar explícitamente antes de commitear. Nunca commitear fachada sin documentarla.

---

## STACK SELLADO — NO NEGOCIABLE

```
Next.js 14 App Router · TypeScript strict · CSS Modules · Prisma 7 · MariaDB
Lucide React (íconos únicamente)
Zod v4 (.issues NO .errors)
jsPDF · sharp · html5-qrcode · jose (JWT HS256)
```

---

## DEPLOY VPS — SECUENCIA OFICIAL

```bash
cd /var/www/activopos
git fetch origin
git checkout -- package-lock.json
git merge origin/main --no-ff --no-edit
npm install --legacy-peer-deps
npx prisma generate
npm run build && pm2 restart activopos
pm2 status
curl -s -o /dev/null -w "%{http_code}" https://activopos.com/login
```

**NUNCA:** `rm -rf .next` sin confirmar build exitoso.
**NUNCA:** `git stash` en VPS.
**SIEMPRE:** `--legacy-peer-deps` en npm install.
**SIEMPRE:** `npx prisma db push` en VPS si hay schema drift (nunca `migrate dev`).

---

## BLOQUE COMMIT ESTÁNDAR (obligatorio)

```bash
git add [archivos específicos — nunca git add . ciego]
git commit -m "tipo(scope): descripción

🤖 Agente: CLI-X | Sprint: N | Fecha: YYYY-MM-DD"
git push origin main
git log --oneline -3
```

---

*ActivoPOS · SYNTIdev · activopos.com*
*"El POS para negocios que andan activos"*
*Generado: 3 Julio 2026 | Sesión Sprints 53–54 | 12 commits*
*Próxima sesión: Invoice backend + SupportTicket backend + deploy VPS*
