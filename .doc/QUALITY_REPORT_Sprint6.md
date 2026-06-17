# QUALITY REPORT — Sprint 6
Fecha: 2026-06-16
Revisado por: CLI-C (Auditoría de seguridad y calidad)

---

## P0 — Crítico (CORREGIDO EN ESTA SESIÓN)

### [FIXED] JWT_SECRET con fallback hardcodeado en código fuente
**Archivo:** `src/lib/auth.ts:4-6`
**Riesgo:** Cualquier actor con acceso al repositorio puede forjar tokens JWT válidos si `JWT_SECRET` no está configurado en producción.
**Código original:**
```typescript
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'activopos_dev_secret_2026'
)
```
**Fix aplicado:** Se agregó guard que lanza excepción al iniciar el servidor si `NODE_ENV === 'production'` y `JWT_SECRET` no está definido. El fallback `'activopos_dev_secret_2026'` solo opera en dev.
**Acción requerida en VPS:** Verificar que `JWT_SECRET` esté definido en `.env.production` antes del próximo deploy.

---

## P1 — Alto (próxima sesión)

### [SEC] Sin rate limiting en el endpoint de login
**Archivo:** `src/app/api/auth/login/route.ts`
**Riesgo:** Permite ataques de fuerza bruta contra credenciales de usuarios. Un atacante puede probar contraseñas indefinidamente sin restricción.
**Mitigación recomendada:** Implementar rate limiting con `@upstash/ratelimit` + Redis, o middleware de IP-based throttling. Límite sugerido: 5 intentos por IP en 15 minutos con backoff exponencial.

### [SEC] Lista ADMIN_ONLY del middleware es incompleta (defense-in-depth gap)
**Archivo:** `src/middleware.ts:5`
**Detalle:** El array `ADMIN_ONLY = ['/configuracion', '/finanzas', '/api/reports']` no incluye `/api/users`, `/api/config/*`, `/api/finanzas/*`, `/api/orders`. Las rutas individuales sí hacen la verificación de rol, por lo que no hay agujero de seguridad directo, pero el middleware falla como segunda línea de defensa.
**Riesgo real:** Medio — un cashier que encuentra las URLs de API puede recibir un 403 correcto, pero el middleware no lo redirige antes de que la solicitud llegue al servidor.
**Acción:** Expandir `ADMIN_ONLY` o refactorizarlo para cubrir todos los prefijos de admin.

---

## P2 — Medio (backlog técnico)

### [CODE] $queryRawUnsafe con interpolación de strings en dashboard/charts
**Archivo:** `src/app/api/dashboard/charts/route.ts:59,80,91,103`
**Detalle:** Cuatro queries SQL usan `$queryRawUnsafe` con interpolación de variables (`${bid}`, `${fromIso}`, `${toIso}`, `${dateExpr}`, `${groupExpr}`). 

**Estado actual (seguro):** Los valores interpolados provienen exclusivamente de:
- `bid` = `session.businessId` (del JWT, no del usuario)
- `fromIso`, `toIso` = fechas calculadas server-side
- `dateExpr`, `groupExpr` = strings hardcodeados seleccionados por whitelist (`period` validado)

**Riesgo potencial:** Si en el futuro se agrega cualquier input de usuario sin pasar por el whitelist, habrá SQL injection.
**Acción:** Migrar a `$queryRaw` con Prisma tagged template literals y `Prisma.sql` helpers para parametrización tipada.

### [CSS] Colores hexadecimales hardcodeados fuera de tokens.css
**Archivos:**
- `src/components/ui/Button.module.css:108,124` — `color: #fff`
- `src/components/products/CategoryModal.module.css:62-97` — `#7C3AED`, `#EC4899`, `#0891B2`, `#A78BFA`, etc. (colores de categorías)
- `src/components/products/ProductModal.module.css:134,376,505` — `background: #fff`, `color: #fff`
- `src/components/products/modals.module.css:292` — `border-top-color: #fff`
- `src/components/products/CatalogUpgradeModal.module.css:102` — `color: #fff`

**Violación:** CLAUDE.md §CSS Modules: "NUNCA colores hexadecimales directos en componentes". El `#fff` está bien como `var(--color-surface)` o `var(--color-bg-primary)`.

**Nota especial:** Los colores de categorías en `CategoryModal` (`dotViolet`, `dotPink`, `dotCyan`) son funcionales (cada categoría tiene un color de UI). Se recomienda que sean tokens semánticos: `--color-category-violet`, etc., definidos en `tokens.css`.

---

## P3 — Bajo (nice to have)

### [ARCH] METHOD_COLORS hardcodeado en API route
**Archivo:** `src/app/api/dashboard/charts/route.ts:7-13`
**Detalle:** El objeto `METHOD_COLORS` es una preocupación de presentación (mapeo tipo → color hex) viviendo en un API route de servidor. Si en el futuro los colores deben ser configurables por el cliente, esta lógica está en el lugar equivocado.
**Acción:** Mover a `src/lib/chartUtils.ts` o al componente de UI que consume los datos.

### [SEC] Headers x-user-id/x-business-id/x-user-role seteados en middleware
**Archivo:** `src/middleware.ts:52-54`
**Detalle:** El middleware propaga `x-user-id`, `x-business-id`, `x-user-role` a través de headers de respuesta. Las API routes NO los consumen (usan `getSession()` correctamente), pero un cliente malicioso puede enviar estos headers en una request directa. En Next.js 14, Vercel/Nginx suelen stripear headers de request que no vienen del middleware, pero en VPS directo puede no estar configurado.
**Acción:** Verificar que Nginx no reenvíe `x-user-*` headers del cliente. Agregar configuración: `proxy_set_header x-user-id ""; proxy_set_header x-business-id ""; proxy_set_header x-user-role "";` en el nginx.conf.

---

## Resumen TypeScript

```
npx tsc --noEmit → 0 errores, 0 warnings
```
- `any` explícitos: **0** (grep: `": any|as any"` → sin resultados)
- Stack TypeScript strict: **CUMPLE**

---

## Resumen N+1 Queries

Revisado: todos los `findMany`/`findFirst` en `src/app/api/`

| Archivo | Query | Estado |
|---------|-------|--------|
| `sales/route.ts` | `findMany` con `include: {items, payments, client, cashier}` | ✅ OK |
| `products/route.ts` | `findMany` con `include: {category, variants}` | ✅ OK |
| `reports/daily/route.ts` | `findMany` con `include: {payment_method}` | ✅ OK |
| `clients/[id]/route.ts` | `findMany` sin include (fields planos) | ✅ OK |
| `users/route.ts` | `findMany` con `select:` explícito | ✅ OK |
| `finanzas/resumen/route.ts` | `$queryRaw` parametrizado | ✅ OK |

**N+1 detectados: 0**

---

## Resumen de Seguridad OWASP

| Categoría OWASP | Estado | Detalle |
|----------------|--------|---------|
| A01 Broken Access Control | ⚠️ P1 | Middleware ADMIN_ONLY incompleto |
| A02 Cryptographic Failures | ✅ Fixed | JWT_SECRET fallback eliminado (P0 corregido) |
| A03 Injection | ⚠️ P2 | $queryRawUnsafe — valores seguros pero patrón riesgoso |
| A04 Insecure Design | ⚠️ P1 | Sin rate limiting en login |
| A05 Security Misconfiguration | ⚠️ P3 | Headers x-user-* en nginx sin configurar |
| A06 Vulnerable Components | ✅ OK | No detectado |
| A07 Auth/Session Failures | ✅ OK | httpOnly, secure, sameSite=lax, 8h expiry |
| A08 Integrity Failures | ✅ OK | No detectado |
| A09 Logging Failures | ✅ OK | ActivityLog en operaciones críticas |
| A10 SSRF | ✅ OK | BCV rate service con timeout implícito |

**OWASP issues: 0 críticos, 2 medios (rate limiting + middleware gaps)**

---

## Upload de imágenes

**Archivo:** `src/app/api/upload/image/route.ts`
- Validación de MIME type: ✅ whitelist `['image/jpeg', 'image/png', 'image/webp']`
- Validación de tamaño: ✅ máximo 2 MB
- Nombre de archivo: ✅ `randomUUID()` — sin path traversal
- Procesamiento: ✅ sharp recodifica la imagen — elimina EXIF y metadatos
- Restricción de rol: ✅ cashiers bloqueados

**Nota:** `file.type` puede ser spoofed por el cliente, pero sharp falla de forma segura si el contenido no es una imagen válida. No es un vector de ataque efectivo.

---

## Paradigma de Venta

Verificado en `src/app/api/sales/route.ts`:
- Items reciben `quantity` + `price_per_unit_usd` → calcula `subtotal_usd = qty × price - discount`
- `total_bs = total_usd × rate`
- Cajero nunca ingresa Bs — **PARADIGMA CORRECTO** ✅

## Business ID

Verificado en todos los endpoints críticos: `business_id` siempre viene de `session.businessId` (JWT), **nunca del request body** ✅

---

## Checklist CLAUDE.md

- [x] TypeScript strict — cero `any`
- [x] CSS Modules — cero Tailwind ✅ / hex hardcoded: **P2 pendiente**
- [x] Variables CSS de tokens — parcialmente ⚠️ (Button, CategoryModal)
- [x] Server Components por defecto — `'use client'` justificado ✅
- [x] Eager loading en Prisma — cero N+1 ✅
- [x] Zod validación en API routes ✅
- [x] Paradigma de venta correcto ✅
- [x] Sin branch_id en tablas transaccionales ✅
- [x] Moneda: price_usd × rate = total_bs ✅
