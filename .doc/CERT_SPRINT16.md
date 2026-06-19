# CERT_SPRINT16.md
# Certificación Sprint 16 — Onboarding Wizard + next-themes + Layout Sweep
# CLI-C | Auditoría + Code Review + E2E | Fecha: 2026-06-19

---

## Resumen ejecutivo

| Estado              | Tests  | Seguridad                              | Code Review |
|---------------------|--------|----------------------------------------|-------------|
| ⚠️ NOT CERTIFICADO | 4/5 ✗  | P2 pendiente → ON05 falla (CLI-A)     | 1 P2, 1 P3  |

**Bloqueante:** `/onboarding` no está en `ADMIN_ONLY` → cajero puede acceder al wizard.
**No bloqueante:** next-themes integrado correctamente, page-container sweep limpio.

---

## Estado git al inicio de certificación

```
12bcda0 fix(sprint-16): segment en PATCH /api/config/business + race condition wizard
c822733 fix(sprint-16): corrige prefix /onboarding/ en middleware
...
```

- ✓ TypeScript strict: `npx tsc --noEmit` → 0 errores

---

## Auditoría de seguridad

### ✗ P2 — `middleware.ts:23`: `/onboarding` no está en ADMIN_ONLY (CLI-A)

**Archivo:** `src/middleware.ts`
**Línea:** 23 (array ADMIN_ONLY)
**Problema:** El array `ADMIN_ONLY` no incluye `/onboarding`. Un cajero con sesión válida puede navegar a `/onboarding` y ver el wizard de configuración. El middleware solo tiene `/onboarding/` (con trailing slash) en `PUBLIC_PREFIXES` — esto cubre las llamadas API (`/api/onboarding/`), pero no restringe la ruta UI a admins.

La ruta UI llama `PATCH /api/config/business` que sí tiene cashier 403 (línea 63), así que no hay escritura no autorizada. Sin embargo, la defense-in-depth está incompleta: cajero ve UI de administración.

**Confirmado por:** ON05 falla — cajero permanece en `/onboarding` en vez de ser redirigido a `/pos`.

**Fix (CLI-A):**
```typescript
const ADMIN_ONLY = [
  '/configuracion', '/finanzas', '/api/reports',
  '/analytics', '/api/analytics',
  '/api/quotations',
  '/cotizaciones', '/devoluciones', '/usuarios',
  '/api/returns', '/api/users',
  '/onboarding',   // ← añadir esta línea
]
```

---

### ✓ Rate limiting en setup + check-slug

`src/app/api/onboarding/setup/route.ts:52`: `onboardingLimiter.consume(getClientIp(req))` ✓
`src/app/api/onboarding/check-slug/route.ts:10`: `onboardingLimiter.consume(getClientIp(req))` ✓

Ambos endpoints públicos usan rate limiting antes de cualquier lógica de negocio.

---

### ✓ Validación de slug con regex antes de DB query

`check-slug/route.ts:6`: `const SLUG_RE = /^[a-z0-9-]{3,50}$/`
`setup/route.ts:11`: `z.string().regex(/^[a-z0-9-]+$/).min(3).max(50)` ✓

Slug validado con regex antes de cualquier query a DB. Caracteres prohibidos rechazados con 400.

---

### ✓ bcrypt con saltRounds=10 en setup

`setup/route.ts:87`: `const hashed = await bcrypt.hash(data.password, 10)` ✓

Password hasheado con bcryptjs antes de crear el usuario. Nunca se almacena el plaintext.

---

### ✓ Unicidad de slug y email verificada antes de transacción

`setup/route.ts:75-85`: Checks paralelos con `Promise.all`:
```typescript
const [slugTaken, emailTaken] = await Promise.all([
  prisma.business.findFirst({ where: { catalog_slug: slug }, select: { id: true } }),
  prisma.user.findFirst({ where: { email }, select: { id: true } }),
])
```
Fail-fast fuera de la transacción. Conflicto → 409 con `field` identificando cuál campo. ✓

---

### ✓ Token en cookie HTTP-only, no en body de respuesta

`setup/route.ts:137-150`: `signToken(...)` → `setSessionCookie(token)` (cookie HTTP-only, 8h) → response con `{ ok, business_id, user_id }`.

El token de sesión NO se expone en el body de la respuesta. `setSessionCookie` usa `cookies().set(...)` de `next/headers` con `httpOnly: true`. Arquitectura correcta — el cliente no accede al token directamente. ✓

---

### ✓ complete/route.ts — cashier guard + token re-emitido

`complete/route.ts:9-11`: guard de rol (`admin` o `super_admin` únicamente) ✓
`complete/route.ts:19-26`: re-emite token con `onboardingCompleted: true` ✓
`complete/route.ts:32-54`: DELETE resetea onboarding (para "Reiniciar Tour") con mismo guard ✓

---

### ✓ business_id desde sesión en complete/route.ts

`complete/route.ts:13`: `where: { id: session.businessId }` — `business_id` siempre de `getSession()`, nunca del body. ✓

---

## Auditoría next-themes

### ✓ Control point único en layout.tsx

`src/app/layout.tsx:3,49-57`: `ThemeProvider` importado y montado UNA SOLA VEZ en el root layout. No hay `ThemeProvider` duplicado en ningún layout hijo (verificado por grep). ✓

### ✓ Configuración correcta del ThemeProvider

```tsx
<ThemeProvider
  attribute="data-theme"      // ✓ coincide con [data-theme] en tokens.css
  defaultTheme="dark"         // ✓ dark por defecto per CLAUDE.md
  enableSystem={false}        // ✓ sin interferencia del sistema operativo
  storageKey="activopos-theme" // ✓ key explícita (no colisiona con otros proyectos)
  themes={['light', 'dark']}  // ✓ solo los dos temas válidos
>
```

### ✓ suppressHydrationWarning en `<html>`

`layout.tsx:47`: `<html lang="es" suppressHydrationWarning>` ✓

Previene hydration mismatch cuando next-themes aplica el tema en el cliente antes de que React compare con el HTML del servidor.

### ✓ useTheme() solo en componentes client-side con 'use client'

`Header.tsx:5` + `TabTema.tsx:4`: `useTheme()` importado solo donde existe `'use client'` al inicio del archivo. ✓

### P3 — CLAUDE.md desactualizado: menciona "inline script" ya no necesario

**Archivo:** `CLAUDE.md` sección "Reglas de tema"
**Nota:** CLAUDE.md dice "Inline script en `layout.tsx` aplica tema antes del primer paint". Esta era la aproximación pre-next-themes. Con next-themes + `suppressHydrationWarning`, el FOUC se resuelve de forma diferente (ThemeProvider aplica el clase antes del primer paint del cliente). El inline script ya no existe ni es necesario. CLAUDE.md debería actualizarse para reflejar la nueva arquitectura. No es un bug de código.

**Fix sugerido (para CLAUDE.md):** Reemplazar "Inline script en layout.tsx aplica tema antes del primer paint" por "next-themes ThemeProvider con suppressHydrationWarning en `<html>` previene FOUC".

---

## Auditoría layout sweep — page-container

Búsqueda en `src/app/(dashboard)/**/*.tsx`:

| Página          | Clase raíz                           | Estado |
|-----------------|--------------------------------------|--------|
| escritorio      | `${styles.page} page-container`      | ✓      |
| analytics       | `${styles.page} page-container`      | ✓      |
| reportes        | `${styles.page} page-container`      | ✓      |
| finanzas        | `${styles.page} page-container`      | ✓      |
| productos       | `${styles.page} page-container`      | ✓      |
| clientes        | `${styles.page} page-container`      | ✓      |
| cotizaciones    | `${styles.page} page-container`      | ✓      |
| devoluciones    | `${styles.page} page-container`      | ✓      |
| usuarios        | `${styles.page} page-container`      | ✓      |
| caja            | `${styles.page} page-container`      | ✓      |
| caja/historial  | `${styles.page} page-container`      | ✓      |
| tu-dia          | `${styles.page} page-container`      | ✓      |
| ayuda           | `${styles.page} page-container`      | ✓      |
| pedidos         | `${styles.page} page-container-full` | ✓ (full-width intencional) |
| onboarding      | `${styles.page}` (sin page-container) | ✓ (wizard aislado, no dashboard) |

**Sweep limpio.** Onboarding usa su propio layout centrado (card + wizard), no es una página de dashboard — la ausencia de `page-container` es intencional.

---

## Resultados E2E — tests/onboarding.spec.ts

| Test | ID  | Descripción                                                          | Estado |
|------|-----|----------------------------------------------------------------------|--------|
| ON01 | ✓   | /onboarding carga wizard paso 1 con sesión admin                     | PASS   |
| ON02 | ✓   | GET check-slug slug válido → 200 `{ available: boolean }`            | PASS   |
| ON03 | ✓   | POST setup slug duplicado → 409 `{ field: 'business_slug' }`         | PASS   |
| ON04 | ✓   | POST setup válido → 201 `{ ok, business_id }` — token en cookie, no body | PASS |
| ON05 | ✗   | Cajero en /onboarding → redirigido (FALLA — P2 pendiente)            | FAIL   |

**4/5 en 24.1s** — chromium headless. ON05 falla confirmando P2.

---

## Checklist de certificación

- [x] Rate limiting en setup + check-slug (endpoints públicos)
- [x] Slug validado con regex `/^[a-z0-9-]{3,50}$/` antes de DB
- [x] bcrypt(10) para password en setup
- [x] business_id desde sesión en complete/route.ts
- [x] Token en cookie HTTP-only, NO en body de respuesta
- [x] Cashier 403 en complete route (PATCH + DELETE)
- [x] next-themes: control point único en layout.tsx
- [x] ThemeProvider: `attribute="data-theme"`, `defaultTheme="dark"`, `enableSystem=false`
- [x] `suppressHydrationWarning` en `<html>`
- [x] Layout sweep: todos los módulos dashboard con `page-container` ✓
- [x] TypeScript strict: 0 errores
- [ ] **P2 — `/onboarding` no en ADMIN_ONLY** → cajero accede al wizard (ON05 falla)

---

## Hallazgos pendientes por agente

### Para CLI-A — P2 BLOQUEANTE:
| Severidad | Archivo | Acción |
|-----------|---------|--------|
| **P2** | `middleware.ts:23` | Añadir `/onboarding` a ADMIN_ONLY → cajero redirigido a /pos |

### Para CLI-A — No bloqueante:
| Severidad | Archivo | Acción |
|-----------|---------|--------|
| P3 | `CLAUDE.md` sección "Reglas de tema" | Actualizar nota de inline script a ThemeProvider |

---

*CLI-C | Sprint 16 | 2026-06-19*
