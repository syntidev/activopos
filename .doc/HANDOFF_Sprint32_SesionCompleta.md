# HANDOFF Sprint 32 — Sesión Completa
## Documento maestro de todo lo discutido, ejecutado y pendiente
### Fecha: 2026-06-25 | Arquitecto: Claude Web | Fundador: Carlos Bolívar

---

## 0. IDENTIDAD DEL PROYECTO

**ActivoPOS** — POS SaaS venezolano para PYMEs.
- **Stack SELLADO:** Next.js 14 + TypeScript strict + CSS Modules + Prisma 7 + MariaDB
- **Local:** `C:\laragon\www\activopos` (Windows 11 + PowerShell + Laragon)
- **VPS:** `187.124.241.213` | Puerto: `3003` | PM2 proceso id=9
- **Repo:** `syntidev/activopos` | Rama: `main`
- **Producción:** activopos.com
- **DB:** `mysql://root@127.0.0.1:3306/activopos`
- **Credenciales admin:** `admin@activopos.com` / `Admin2026!`

---

## 1. SKILLS INSTALADOS EN ESTA SESIÓN

| Skill | Comando | Uso |
|-------|---------|-----|
| Ponytail | `/ponytail ultra` | Anti-sobreingeniería — OBLIGATORIO en todos los CLIs |
| Taste Skill | `/taste redesign-existing-projects` | Rediseño UI existente — CLI-B únicamente |

### Stack de skills por CLI (OBLIGATORIO desde Sprint 33):

**CLI-A:**
```
/ponytail ultra
/code-review max --fix
/security-review
/software-architecture
```

**CLI-B:**
```
/ponytail ultra
/taste redesign-existing-projects
/impeccable craft
/frontend-design
/ui-ux-pro-max
```

**CLI-C:**
```
/ponytail-audit
/ponytail-review
/code-review max
/security-review
```

**CLI-D:**
```
/ponytail full
/webapp-testing
/impeccable craft
```

**REGLA NUEVA:** Ningún CLI hace commit sin correr `/ponytail-review` primero.

---

## 2. LO QUE SE COMPLETÓ EN ESTA SESIÓN (Sprint 31-32)

### Sprint 31 — Completado ✅

| Tarea | CLI | Estado |
|-------|-----|--------|
| Scanner botón visible en Inventario y Productos | B | ✅ commit 76e1b01 |
| Backend Gastos (5 endpoints) | A | ✅ commit b732ed0 |
| Backend Cobros (6 endpoints) | A | ✅ commit b732ed0 |
| `src/lib/cobros.ts` → `generateCobroMessage()` | A | ✅ |
| `useHardwareScanner.ts` | B | ✅ commit b1e3fed |
| Auditoría IDOR clients | C | ✅ documentado |
| Fix IDOR clients/[id] (3 líneas) | A | ✅ commit c996cb5 |
| Migración `business_devices` tabla | A | ✅ schema + SQL |

### Sprint 32 — Completado ✅

| Tarea | CLI | Estado |
|-------|-----|--------|
| Fix P1-A: due_date serializado YYYY-MM-DD en `/api/gastos` | A | ✅ commit 98c9da3 |
| Fix P2-B: CxP vencidas por due_date no fecha registro | A | ✅ |
| Fix P2-C: CxP spread fechas explícitas | A | ✅ |
| Fix P1-B: GastoModal RangeError due_date | B | ✅ commit a9c2e00 |
| Fix P1-C: ErrorBoundary en finanzas/page.tsx | B | ✅ |
| Fix P1-D: Dual moneda en KPI Gastos | B | ✅ |
| GastosSection rediseño completo | B | ✅ commit f3aee9b |
| CategoriasGastos modal (movido de Configuración a Finanzas) | B | ✅ |
| GastoModal mejorado (select categorías, tipo toggle) | B | ✅ |
| Seed automático 6 categorías de sistema | A | ✅ |
| TabPlan conectado a subscription_expires_at | A+B | ✅ |
| Fix CxC: saldo check en abono, mensaje caja, TOCTOU | A | ✅ commit d89bef3 |
| Fix AbonoModal: validación cliente, mensaje error | B | ✅ commit f73fde0 |
| Botones Editar en Gastos y CxP | B | ✅ commit 9e4d7bf |
| Estándar global botones (globals.css) | B | ✅ |
| Migración a Button.tsx en módulos principales | B | ✅ |
| Rediseño visual parcial (cards sombra, background) | B | ✅ |

---

## 3. ARQUITECTURA FINANCIERA — DECISIÓN CRÍTICA

### Modelo de deuda en Venezuela (SELLADO):

**La deuda ancla en USD. Los Bs son referencia del día.**

- `total_usd` = verdad permanente e inmutable
- `total_bs` = snapshot histórico del momento de la venta (NO usar para calcular deuda actual)
- `rate_used` = tasa BCV al momento de la venta (registro histórico)
- Al mostrar deuda: `saldo_usd × tasa_BCV_hoy` — NUNCA usar `total_bs` guardado
- Al abonar: cliente paga en Bs a la tasa del día del pago
- Cada abono guarda: `amount_usd`, `amount_bs`, `rate_used` propios

**Verificado por auditoría CLI-C:** El sistema ya implementa esto correctamente. ✅

---

## 4. AUDITORÍA MÓDULO FINANZAS — HALLAZGOS

### P1 resueltos:
- ✅ `due_date` serializado a YYYY-MM-DD (antes retornaba ISO datetime)
- ✅ RangeError en GastoModal al editar gasto Fijo
- ✅ ErrorBoundary en finanzas/page.tsx
- ✅ Dual moneda en KPI Gastos

### P1 CxC resueltos:
- ✅ Saldo check en abono (no permite abonar más del saldo)
- ✅ TOCTOU cerrado con SELECT FOR UPDATE
- ✅ Mensaje claro cuando no hay caja abierta

### P2 pendientes (documentados, no ejecutar sin orden):
- `clients/[id]/route.ts` — IDOR en aggregate de abono (bajo riesgo, v1)
- `reports/monthly/route.ts` — regex débil en parseo de período
- `finanzas/daily/route.ts` — inline parsePeriod duplicado
- Endpoint huérfano: `/api/finanzas/gastos` — nadie lo llama (el real es `/api/gastos`)

---

## 5. PROBLEMA CRÍTICO NO RESUELTO — DISEÑO MOBILE

### El problema raíz (IMPORTANTE para próximo agente):

**CLI-B modifica `globals.css` y `tokens.css` pero los CSS Modules locales de cada página sobreescriben esos valores.** Los cambios no se ven porque cada módulo tiene su propio CSS aislado.

### Lo que se intentó y NO funcionó:
1. Agregar clases a `globals.css` — sobreescritas por CSS modules
2. Modificar `tokens.css` — no afecta clases ya definidas en modules
3. Prompt genérico "rediseña todo" — CLI-B toca globals, no los modules

### La única solución que funciona:
**Entrar a cada CSS module individualmente y cambiar el CSS directamente.**

### Diagnóstico visual (capturas revisadas por Carlos):

| Módulo | Problema | Archivo CSS a modificar |
|--------|----------|------------------------|
| Escritorio | KPIs apiladas en columna, no grid 2x2 | `escritorio.module.css` |
| Sidebar mobile | Doble scroll, zona inferior ocupa 40% | `Sidebar.module.css` |
| Finanzas Resumen | Cards apiladas, tabla overflow horizontal | `finanzas.module.css` |
| Caja | Cards apiladas en columna | `caja.module.css` |
| General | Background #E8EEF4 frío, no #F4F6FA | `tokens.css` (--bg-base) |
| KPI cards | Línea color izquierda recta + card redondeada = esquina rota | Todos los módulos con KPI |

### Estándar visual aprobado por Carlos:

```css
/* Cards */
border-radius: 16px;
box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04);
background: white;
/* NO flat. NO border visible. Solo sombra suave. */

/* Línea color KPI — respetar border-radius */
border-left: 4px solid <color-semantico>;
border-radius: 16px; /* en la card, no pseudo-elemento */

/* Background */
--bg-base: #F4F6FA; /* más cálido */

/* Grid mobile (max-width: 768px) */
display: grid;
grid-template-columns: 1fr 1fr;
gap: var(--space-3);
/* Aplica en: Escritorio, Finanzas, Caja — NO POS, NO Pedidos */

/* Sidebar mobile */
/* Footer = una sola fila: [tasa BCV] [Cerrar sesión] */
/* Eliminar: Notificaciones, Admin badge, logo negocio del sidebar */
```

### Orden de ejecución aprobado (módulo por módulo, verificación visual obligatoria):
1. Sidebar mobile (aparece en TODAS las páginas — impacto máximo)
2. Escritorio (primera pantalla que ve el usuario)
3. Finanzas (módulo más complejo, recién rediseñado)
4. Caja
5. Clientes
6. Inventario
7. Productos

---

## 6. BLOQUES DE DESARROLLO — ESTADO COMPLETO

### Bloques del HANDOFF Sprint 30 — estado real:

| # | Bloque | Descripción | Estado |
|---|--------|-------------|--------|
| 1 | **Teclado numérico móvil** | `inputMode="numeric"` en campos de caja, clientes, abonos | ⚠️ Parcial — verificar completitud |
| 2 | **Base de datos bancos/cobros** | Módulo Datos para Cobrar — UI lista Sprint 30, backend creado Sprint 31 | ⚠️ Backend hecho, pendiente verificación E2E |
| 3 | **Módulo suscripción/plan** | TabPlan.tsx + endpoint `subscription_expires_at` | ✅ COMPLETADO Sprint 32 |
| 4 | **Dual Brand Header** | Logo negocio cliente en header desktop | ⚠️ UI hecha, sin verificar con logo real de cliente |
| 5 | **CxP — Cuentas por Pagar** | Ventaja vs Fina — UI existe en Finanzas tab "Por Pagar" | ⚠️ UI existe, backend parcial, sin certificar |
| 6 | **Gastos fijos con alerta** | Banner 5 días antes del vencimiento en Escritorio | ⚠️ UI hecha Sprint 30, backend `/api/gastos/alerts` creado Sprint 31, sin conectar a UI Escritorio |
| 7 | **Listas de precios** | Detal/mayor/cliente especial — Fina lo tiene | ❌ No iniciado |
| 8 | **Comisiones a personal** | Fina lo tiene — ventaja competitiva | ❌ No iniciado |

### Bloques nuevos Sprint 31-32 — estado real:

| # | Bloque | Descripción | Estado |
|---|--------|-------------|--------|
| 9 | **Hardware scanner barcode** | `useHardwareScanner.ts` creado — URL incorrecta `?q=` en lugar de `?search=` | ❌ 1 línea pendiente |
| 10 | **Diseño mobile completo** | Mobile-first en todos los módulos | ❌ Parcial — ver sección 5 |
| 11 | **Migración business_devices VPS** | SQL pendiente de ejecutar en VPS | ❌ `npx prisma db execute --file prisma/migrations/20260624000001_add_business_devices/migration.sql` |
| 12 | **Alertas gastos en Escritorio** | Banner cuando gasto vence en ≤5 días — UI hecha, endpoint existe, sin conectar | ❌ Conexión pendiente |

### Bloques completados esta sesión ✅:

| # | Bloque | Commits |
|---|--------|---------|
| Backend Gastos CRUD | 5 endpoints + alerts | b732ed0 |
| Backend Cobros CRUD | 6 endpoints + generateCobroMessage | b732ed0 |
| Fix módulo Finanzas | 4 P1 bugs + auditoría completa | 98c9da3, a9c2e00 |
| Fix CxC abonos | Saldo check + TOCTOU + mensajes | d89bef3, f73fde0 |
| TabPlan suscripción | UI + backend completo | bcd451e |
| Categorías Gastos | Movido de Configuración a Finanzas | f3aee9b |
| IDOR clients | Fix security 3 líneas | c996cb5 |
| Skills instalados | Ponytail + Taste Skill | — |

### Nuevos pendientes de esta sesión:

| # | Tarea | Detalle |
|---|-------|---------|
| 1 | Diseño mobile completo | Ver sección 5 — módulo por módulo |
| 2 | Hardware scanner en POS | URL correcta: `?search=` no `?q=` — 1 línea en `useHardwareScanner.ts` |
| 3 | Endpoint huérfano `/api/finanzas/gastos` | Eliminar o conectar al frontend |
| 4 | Usuario duplicado DB | `admin@activopos.com` id=1 y id=3 ambos super_admin |
| 5 | ACR_TEST_PROD en dashboard | 10 productos de prueba visibles en Top Productos |
| 6 | Migración SQL `business_devices` en VPS | `npx prisma db execute --file ...` |

---

## 7. BUGS CONOCIDOS EN PRODUCCIÓN

| Bug | Severidad | Módulo | Estado |
|-----|-----------|--------|--------|
| Doble scroll sidebar mobile | P0 | Layout | ❌ No resuelto |
| KPIs no en grid 2x2 mobile | P1 | Escritorio, Finanzas, Caja | ❌ No resuelto |
| Hardware scanner URL incorrecta | P1 | POS | ❌ 1 línea pendiente |
| ACR_TEST_PROD en Top Productos | P2 | Escritorio | ❌ Pendiente limpieza DB |
| Usuario duplicado admin | P2 | DB | ❌ Pendiente confirmación |

---

## 8. REGLAS CRÍTICAS PARA PRÓXIMO AGENTE

### Sobre el diseño mobile:
1. **NUNCA tocar globals.css o tokens.css para fixes visuales de módulos** — los CSS modules los sobreescriben
2. **Siempre entrar al archivo `.module.css` específico del módulo**
3. **Un módulo por prompt** — no intentar redesign global en un solo prompt
4. **Verificación visual de Carlos obligatoria** antes de pasar al siguiente módulo
5. **"Commiteado" ≠ "se ve"** — exigir captura de pantalla

### Sobre los CLIs:
- PowerShell no acepta `&&` — comandos uno por línea o con `;`
- VPS siempre necesita `--legacy-peer-deps` por conflicto `use-scan-detection`
- Deploy VPS: nunca `rm -rf .next` antes del build exitoso
- Prisma en VPS: `npx prisma db execute` no acepta `--schema` en Prisma 7

### Sobre el sistema:
- `business_id` siempre de `getSession()` — nunca del body
- Deuda CxC en USD — Bs calculados con tasa del día, nunca con `total_bs` guardado
- Stock descuenta SOLO cuando `status='paid'`
- Sidebar siempre oscuro — independiente del tema

---

## 9. DEPLOY VPS — COMANDO ESTÁNDAR

```bash
git fetch origin
git checkout -- package-lock.json
git merge origin/main --no-ff -m "merge: descripción"
npm install --legacy-peer-deps
npx prisma generate
npm run build && pm2 restart activopos
```

---

## 10. ESTADO DEL VPS AL CIERRE DE SESIÓN

- **PM2 proceso id=9** — online ✅
- **Build:** exitoso con todos los cambios de Sprint 31-32
- **CIMAAD 7/7** — pasando (no se tocaron tests E2E)
- **URL:** activopos.com operativa

---

*Generado al cierre de Sprint 32 — Claude Web*
*Fecha: 2026-06-25*
*Sesión: Sprint 31 + 32 completos*
