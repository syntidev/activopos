# ARCHITECTURE REPORT — ActivoPOS
**Fecha:** 2026-06-16 | **Auditor:** Claude Code (Sonnet 4.6)
**Scope:** src/app/, src/components/, src/lib/ — archivos existentes al momento del audit

---

## 🔴 VIOLACIONES CRÍTICAS

### 1. Dashboard Layout es Client Component cuando debería ser Server Component
**Archivo:** `src/app/(dashboard)/layout.tsx` — línea 1 (`'use client'`)

El layout verifica la sesión con `fetch('/api/auth/me')` en un `useEffect`. Esto produce:
- **Flash de contenido vacío** antes del redirect (el shell renderiza antes de saber si hay sesión)
- **Doble round-trip**: cliente carga → pide sesión → redirige vs. server redirect inmediato
- **Pérdida de SSR** para todas las páginas bajo este layout

**Patrón correcto:** El middleware (`src/middleware.ts`) ya protege las rutas. El layout debe ser un Server Component que llame a `getSession()` directamente:
```typescript
// layout.tsx — Server Component
export default async function DashboardLayout({ children }) {
  const session = await getSession()
  if (!session) redirect('/login')
  // BCV rate, sidebar, header se pasan como props o via Context
}
```
Los estados de colapso del sidebar (UI pura) sí pueden vivir en un Client Component hijo.

---

### 2. Lógica de negocio duplicada entre Server Component y API Route
**Archivos:** `src/app/(dashboard)/escritorio/page.tsx` y `src/app/api/dashboard/kpis/route.ts`

Las funciones `getGreeting()`, `calcTrend()`, y toda la lógica de agregación de KPIs están **100% duplicadas**. El API route `/api/dashboard/kpis` existe pero la página no lo consume — calcula los KPIs directamente con Prisma como Server Component. El API route parece legado de un diseño anterior.

**Decisión requerida (no implementar sin consulta):**
- Opción A: Eliminar `/api/dashboard/kpis/route.ts`, mantener Server Component con Prisma directo (patrón actual de la página).
- Opción B: Convertir `KpiCards` en Client Component que consume `/api/dashboard/kpis`. Solo viable si la página necesita revalidación en tiempo real.

---

### 3. Tipo `SessionUser` duplicado — falta `src/types/index.ts`
**Archivos afectados:**
- `src/components/layout/Sidebar.tsx` línea 26 — define y exporta `SessionUser`
- `src/app/(dashboard)/layout.tsx` línea 9 — redefine `SessionUser` inline (sin exportar)

El CLAUDE.md especifica que las interfaces deben vivir en `src/types/`. Este archivo no existe. `SessionUser` debe moverse a `src/types/index.ts` e importarse en ambos archivos.

---

## 🟡 OBSERVACIONES MENORES

### 4. FOUC en cambio de tema (Flash of Unstyled Content)
**Archivo:** `src/app/(dashboard)/layout.tsx` líneas 57-63

El tema se restaura desde `localStorage` en un `useEffect`, lo que garantiza que el cliente renderiza primero con el tema por defecto (`dark`) y luego aplica el tema guardado. Esto es visible como flash.

**Solución:** Leer `businesses.theme` desde la DB en el Server Component layout y pasar `data-theme` directamente al `<html>` desde `src/app/layout.tsx`. Para el toggle en sesión activa, localStorage es aceptable como fallback.

---

### 5. BCV polling en el Layout — acoplamiento incorrecto
**Archivo:** `src/app/(dashboard)/layout.tsx` líneas 45-54, 66-71

El layout fetcha y hace polling de la tasa BCV cada 5 minutos. El layout no debería tener responsabilidades de datos externos. El BCV rate es compartido por Sidebar y Header vía prop drilling.

**Mejor patrón:** Un Client Component `<BcvRateProvider>` pequeño encapsula el polling y expone la tasa vía Context. El layout lo monta sin necesitar ser Client Component completo.

---

### 6. Login Page no usa los primitivos UI recién creados
**Archivo:** `src/app/(auth)/login/page.tsx`

Implementa `<input>`, `<label>`, `<button>` y spinner desde cero. Después de este sprint, debería migrar a `<Input>`, `<Button loading>` de `src/components/ui/`. No es urgente pero genera deuda técnica.

---

## ✅ LO QUE ESTÁ BIEN

- **Cero N+1 detectadas.** Todas las queries del escritorio usan `Promise.all` para paralelizar. Los `include` de Prisma en `login/route.ts` están explícitamente definidos.
- **Zod validación en API routes.** `login/route.ts` valida con `loginSchema.parse()` antes de tocar la DB.
- **`KpiCards` es un async Server Component correcto** que usa Prisma directamente y se envuelve en `<Suspense>`. Patrón ideal de App Router.
- **Separación de Sidebar/Header** en componentes independientes con sus propios CSS Modules.
- **`calcTrend` y `getGreeting` en la página** no son lógica de negocio crítica — son helpers de presentación aceptables en Server Components.
- **Sin branch_id** en ninguna tabla ni query visible.
- **Middleware existe** (`src/middleware.ts`) para protección de rutas — bien ubicado.

---

## PRIORIDAD DE REFACTORS (sin implementar — solo reportar)

| Prio | Archivo | Acción |
|------|---------|--------|
| 🔴 1 | `(dashboard)/layout.tsx` | Convertir a Server Component; extraer BCV polling a Provider; extraer toggle de sidebar a Client Component hijo |
| 🔴 2 | `src/types/index.ts` | Crear con `SessionUser`, `Role`, tipos base compartidos |
| 🔴 3 | `api/dashboard/kpis/route.ts` | Decidir entre eliminar (si se mantiene Server Component) o usarlo (si se migra a Client) |
| 🟡 4 | `(auth)/login/page.tsx` | Migrar a primitivos `<Input>` + `<Button>` |
| 🟡 5 | `layout.tsx` (root) | Leer tema inicial desde DB para evitar FOUC |

---

*Este reporte es solo de diagnóstico. Ningún archivo fue modificado.*
