# HANDOFF — Sprint 17 → Sprint 18
# ActivoPOS | 2026-06-21
# Entregado por: CLI-A + CLI-B + CLI-C + CLI-D (Sprint 17 completo)

---

## ANTES DE HACER CUALQUIER COSA

Lee estos archivos en este orden:
```
1. CLAUDE.md (raíz)
2. .doc/SYSTEM_MAP.md          ← v17, actualizado hoy
3. .doc/ACTIVOPOS_MASTER_V2.md
4. .doc/AGENTS.md
```

## INICIO DE SESIÓN — SIEMPRE

```powershell
.\r.ps1
# Esperar "Ready on http://localhost:3000"
curl http://localhost:3000/api/rates/bcv
# Esperado: {"rate":607.xx,"source":"bcv","ok":true}
```

Verificar tests antes de tocar código:
```bash
npx playwright test --reporter=list
# Esperado: 57/57 pasando
```

**CRÍTICO — auth token expira en 8h:**
Si los tests fallan en masa con HTML en lugar de JSON, el JWT expiró.
Ver sección de refresh en HANDOFF_Sprint17.md.

---

## QUÉ SE COMPLETÓ EN SPRINT 17

### Tokens v3.0 (CLI-A ✅)
- **Light mode por defecto:** next-themes configurado con `defaultTheme: "light"`
- **Light:** sidebar blanco (#FFFFFF), fondo #F1F5FB, cards blancas con border sutil
- **Dark:** sidebar navy (#0D1B2E), fondo #0D1B2E, cards navy medio (#112240)
- **5 bordes semánticos:** `--border-alert`, `--border-positive`, `--border-info`, `--border-success`, `--border-warning`
- **Tabla:** `--table-header-bg` / `--table-header-text` — teal semántico en light, teal oscuro en dark
- **Eliminado:** `#2563EB` y `#1E3A5F` del codebase (ES01 verifica en HTML renderizado)
- **next-themes:** hydration mismatch eliminado, `mounted` guard en Header/configuracion

### Escritorio v3.0 (CLI-B ✅)
- **2 KPI cards teal:** Facturación (`aria-label="Facturación total"`) + Ítems vendidos (`aria-label="Ítems vendidos"`)
- **2 KPI cards blancas:** Ticket Prom. + Órdenes cobradas
- **Tabla métodos de pago:** `<thead>` con columnas Método / Total USD — teal header
- **Sidebar:** toggle Abrir/Cerrar Caja + sección "Invita y gana" + "Crear usuarios" en footer
- **Sistema A+C glow:** restaurado en todas las cards del dashboard (commit 2cc3fd6)
- **WCAG AA:** skip link, focus rings, `prefers-reduced-motion` aplicado

### analytics/summary fix (CLI-A ✅)
- `utilidad_neta` en `GET /api/analytics/summary` corregido (commit fd6c5f3)

### Tests — 57/57 sin regresiones
- `sprint17-visual.spec.ts` — ES01-ES05 todos verdes
- `pos-core.spec.ts` T01/T06 actualizados: `'Ventas hoy'` → `aria-label="Facturación total"`
  (Escritorio v3.0 renombró el KPI)

---

## ESTADO DEL CORE — COMPLETADO + SPRINT 17

```
Productos ✅ → POS ✅ → Caja ✅ → Reportes ✅ →
Finanzas ✅ → Catálogo ✅ → Analytics ✅ →
Cotizaciones ✅ → Devoluciones ✅ → Usuarios ✅ →
Expense Categories ✅ → Onboarding ✅ →
Tokens v3.0 ✅ → Escritorio v3.0 ✅
```

**57/57 tests E2E certificados.**

---

## SPRINT 18 — PRIORIDADES

### Prioridad 1: DT-020 / DT-021 — Export Excel

| ID     | Sev | Descripción                  | CLI   | Notas                                       |
|--------|-----|------------------------------|-------|---------------------------------------------|
| DT-020 | P3  | Export Excel en reportes     | CLI-B | Botón en /reportes — columnas: fecha, método, total_usd, total_bs |
| DT-021 | P2  | Export Excel en finanzas     | CLI-B | Botón en /finanzas — columnas: concepto, categoria, monto_usd, fecha |

Biblioteca recomendada: `xlsx` (SheetJS Community Edition).
- CLI-A: instala `xlsx`, expone helper `generateXlsx(rows, headers)` en `src/lib/excel.ts`
- CLI-B: añade botón "Exportar Excel" con onClick que llama el helper

### Prioridad 2: DT-014 — BCV cache cluster-safe

| ID     | Sev | Descripción                              | CLI   |
|--------|-----|------------------------------------------|-------|
| DT-014 | P2  | lib/bcv.ts cache no cluster-safe en PM2  | CLI-A |

En VPS, PM2 corre 2 workers con `cachedRate` separado en memoria.
Fix recomendado: añadir `dollar_rates` lookup como fallback con TTL de 5min en DB (ya existe la tabla).
Alternativa: guardar la tasa en un archivo JSON compartido entre procesos.

### Prioridad 3: DT-038 — @unique constraint en slug

| ID     | Sev | Descripción                              | CLI   |
|--------|-----|------------------------------------------|-------|
| DT-038 | P2  | Slug sin @unique en DB — onboarding hace findFirst pero sin constraint a nivel DB | CLI-A |

Fix: nueva migración que añade `@@unique([business_slug])` en `businesses` table.

### Prioridad 4: Escritorio v3.0 mobile responsive

El diseño actual está optimizado para desktop.
- Breakpoints: ≤768px → stack vertical, KPIs 2 columnas
- Tabla métodos de pago: scroll horizontal en mobile

### Prioridad 5: Admin multitenant

- `admin.activopos.com` — panel para Carlos
- Ver tenants, plans, activar/desactivar negocios
- **Territorio exclusivo de Opus (sesión aislada)**
- CLI-A solo crea API `/api/admin/tenants/...`; CLI-B la UI

---

## NOTAS TÉCNICAS PARA SPRINT 18

### T01/T06 en pos-core.spec.ts — referencia
En Escritorio v3.0, el KPI principal fue renombrado de "Ventas hoy" a "Facturación".
Los tests T01/T06 fueron actualizados en Sprint 17 para usar `aria-label="Facturación total"`.
Si en Sprint 18 el label vuelve a cambiar, actualizar el selector en los tests.

### ES02 en sprint17-visual.spec.ts — corrección post-Sprint 17
CLI-C cambió el KPI 4 de "Ítems vendidos" a "Utilidad neta" en Sprint 17 (commits CLI-C post-badbab7).
ES02 fue corregido al inicio de Sprint 18 (commit 15b2a04): selector actualizado a `aria-label="Utilidad neta"`.
Resultado: 57/57 pasando tras la corrección.

### Sistema A+C glow — restaurado (referencia)
Sprint 17 CLI-B inicialmente eliminó el glow en algunas cards (commit 6e5b86d).
CLI-C lo detectó como regresión y CLI-B lo restauró en 2cc3fd6.
El sistema de glow es APROBADO y no debe modificarse sin autorización de Carlos.

### next-themes — comportamiento
- `defaultTheme: "light"` — el primer render es siempre light
- Toggle en Header (ThemeToggle): llama `setTheme('dark'|'light')`
- Sin `mounted` guard → hydration mismatch; ya corregido en Sprint 17
- El toggle en Configuración fue eliminado (simplificación); solo existe en Header

### analytics/summary — utilidad_neta fix
`/api/analytics/summary` ahora devuelve `utilidad_neta` correcta.
Antes: calculaba sobre ventas brutas sin restar gastos.
Ahora: `utilidad_neta = ingresos_netos - gastos_mes`

### trabajo local no commiteado al cierre de Sprint 17
CLI-A dejó sin push en rama local:
- `prisma/schema.prisma` — `catalog_slug @unique` (DT-038 parcial)
- `prisma/migrations/20260621000001_add_unique_catalog_slug_business/` — migración DT-038
- `src/lib/bcv.ts` — refactor DB cache (DT-014)

**Acción inicio Sprint 18:** verificar que esos cambios son correctos y commitearlos primero
(CLI-A scope) ANTES de que CLI-B toque CSS o CLI-D corra tests. Si hay TypeScript errors o
el build falla, bloquear el sprint hasta que CLI-A commitee y pushee.

DT-038 migración existe localmente pero NO está aplicada en DB aún.
Correr `npx prisma migrate deploy` al inicio del Sprint 18.

---

## DATOS DE PRUEBA — DB LOCAL

| Entidad           | Datos seed                                                    |
|-------------------|---------------------------------------------------------------|
| Business          | "Mi Negocio Demo" — slug: demo — catalog: activo             |
| Admin user        | admin@activopos.com / admin123                                |
| Cashier user      | cajero@activopos.com / cajero123                             |
| Expense Categories| 6 de sistema: Alquiler, Servicios públicos, Nómina, Insumos, Marketing, Otros |
| Producto servicio | id=18 "Corte de Cabello" — sale_mode=service                 |
| Producto con stock| id=10 "Arepa con Pollo" — stock ~30+                         |
| Ventas totales    | > 30 ventas pagadas (cada run de T05 agrega 1)               |

---

## ARCHIVOS CRÍTICOS PARA SPRINT 18

```
src/app/(dashboard)/reportes/page.tsx     ← añadir botón Export Excel (DT-020)
src/app/(dashboard)/finanzas/page.tsx     ← añadir botón Export Excel (DT-021)
src/lib/excel.ts                          ← crear helper xlsx (CLI-A)
src/lib/bcv.ts                            ← fix cluster-safe (DT-014)
prisma/migrations/                        ← nueva migración @unique slug (DT-038)
.doc/SYSTEM_MAP.md                        ← actualizar a v18 al cerrar sprint
```

---

## COMMITS SPRINT 17 (referencia)

```
2cc3fd6 fix(sprint-17/CLI-B): restaurar sistema A+C glow — profundidad visual en todo el sistema
6fa1581 test(sprint-17/CLI-C): certificación tokens v3.0 + Escritorio v3.0 ES01-ES05
fd6c5f3 fix(sprint-17/CLI-A): utilidad_neta en analytics/summary
6e5b86d feat(sprint-17/CLI-B): escritorio v3.0 + tokens sweep + WCAG AA
5ff6d26 feat(sprint-17/CLI-A): tokens v3.0 + next-themes light default + sweep colores
```

---

*Generado: 2026-06-21 | HEAD: post Sprint 17 | Entregado por: CLI-D Sprint 17*
*57/57 tests E2E — CORE + Sprint 15-17 certificado*
