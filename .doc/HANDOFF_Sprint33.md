# HANDOFF Sprint 33 — Documentación y Verificación
## Fecha: 2026-06-25 | Agente: CLI-D | Fundador: Carlos Bolívar

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

## 1. ESTADO ACTUAL DEL SISTEMA (git log --oneline -10)

```
683542d feat(ui): rediseño visual mobile-first, cards con profundidad, grid 2col, sidebar compacto
37bd885 feat(ui): estándar global botones btn-primary/secondary/danger/icon
7537de7 fix(finanzas): botones header visibles, columna vence limpia
9e4d7bf feat(finanzas): botones editar Gastos y CxP, contorno visible siempre
d89bef3 fix(cxc): TOCTOU — mover saldo check dentro de transaction con FOR UPDATE
3186060 fix(cxc): saldo check, respuesta paid/saldo_usd, mensaje caja clara
f73fde0 fix(cxc): AbonoModal validación saldo, mensaje caja, limpiar body
bcd451e feat(ui): TabPlan conectado a subscription endpoint
598a04d feat(schema): subscription_expires_at + endpoint config/subscription
a9c2e00 fix(finanzas): ErrorBoundary, due_date modal, dual moneda KPI gastos
```

**Último commit de features:** `683542d` — rediseño mobile-first Escritorio (sidebar compacto + grid 2col).
**TypeScript:** ✅ 0 errores (verificar con `npx tsc --noEmit` antes del próximo commit).
**VPS:** operativo con build de Sprint 31-32. Puerto 3003.

---

## 2. SKILLS OBLIGATORIOS POR CLI (desde Sprint 32)

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

> **Nota:** `/ponytail` es skill externo. Si no está instalado, verificar con Carlos antes de correr.
> **REGLA:** Ningún CLI hace commit sin correr `/ponytail-review` primero.

---

## 3. BLOQUES COMPLETADOS EN SPRINT 33

Sprint 33 fue una sesión de **documentación, verificación y housekeeping** — no features nuevas.

| Tarea | Estado | Detalle |
|-------|--------|---------|
| Verificación CIMAAD 7/7 | ⚠️ FALLA | Ver sección 4 — Nodo 1 falla, causa identificada |
| SYSTEM_MAP.md actualizado | ✅ | Endpoints Sprint 31-32 añadidos (7 endpoints nuevos) |
| HANDOFF Sprint 33 creado | ✅ | Este documento |
| Diagnóstico DB VPS | ✅ | Users duplicados (ambos super_admin), ACR_TEST confirmados |

---

## 4. CIMAAD — RESULTADO SPRINT 33

**Estado:** ❌ 1/7 — Nodo 1 falla, 6 nodos no corren.

### Falla Nodo 1 — Inventario

```
SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
tests/auditoria-ciclo-real.spec.ts:143:24
```

**Causa probable:** El servidor local no está corriendo al ejecutar el test, o la sesión JWT del beforeAll falla y el middleware redirige a `/login` (HTML) en lugar de responder JSON.

**Contexto:** CIMAAD fue certificado 7/7 corriendo contra **VPS:3003** (ver SYSTEM_MAP §9). El test hace `beforeAll` con login fresco — si el servidor local está caído, la primera API call recibe HTML de Next.js (página de error/redirect).

**Acción requerida (CLI-D o CLI-A Sprint 34):**
1. Verificar que el servidor esté corriendo antes de ejecutar el test: `npm run dev`
2. Si la falla persiste con servidor activo → revisar `playwright.config.ts` para confirmar `baseURL`
3. Si el test apunta a `localhost:3000` y el VPS usa `3003` → puede requerir actualizar la config

**NO corregido en este sprint** — solo documentado.

---

## 5. PENDIENTES CRÍTICOS PARA SPRINT 34

### P0 — Críticos (bloquean calidad del producto)

| # | Tarea | CLI | Detalle |
|---|-------|-----|---------|
| 1 | **Diseño mobile — módulos restantes** | B | Finanzas, Caja, Clientes, Inventario, Productos — cada uno en su propio `.module.css`. Ver protocolo en sección 6. |
| 2 | **CIMAAD 7/7 restaurar** | D | Verificar `baseURL` en `playwright.config.ts`. Correr contra servidor activo. |
| 3 | **Hardware scanner URL** | A | `useHardwareScanner.ts` — cambiar `?q=` por `?search=` (1 línea) |
| 4 | **Migración `business_devices` VPS** | A | `npx prisma db execute --file prisma/migrations/20260624000001_add_business_devices/migration.sql` |

### P1 — Importante (teclado numérico y cobros — fixes de CLI-C)

| # | Tarea | CLI | Detalle |
|---|-------|-----|---------|
| 5 | **Teclado numérico** | B | `inputMode="numeric"` en campos de Caja, Clientes, Abonos — verificar completitud |
| 6 | **Cobros E2E** | D | Tests E2E para el módulo Cobros (backend hecho Sprint 31, sin certificar) |
| 7 | **Alertas gastos en Escritorio** | B | Conectar banner "gasto vence en ≤5 días" a `/api/gastos/alerts` — UI hecha, endpoint existe, sin conectar |

### P3 — Futura (no bloquean v1)

| # | Tarea | CLI | Detalle |
|---|-------|-----|---------|
| 8 | **Listas de precios** | A+B | Detal / mayor / cliente especial — Fina lo tiene — feature diferenciador |
| 9 | **Comisiones a personal** | A+B | Fina lo tiene — ventaja competitiva — no iniciado |
| 10 | **Endpoint huérfano** | A | `/api/finanzas/gastos` nadie lo llama — el real es `/api/gastos` — eliminar o redirigir |

---

## 6. PROTOCOLO DISEÑO MOBILE (SELLADO — no modificar)

**Regla cardinal:** Los CSS Modules locales sobreescriben `globals.css` y `tokens.css`. Para fixes visuales de módulos, siempre entrar al `.module.css` del módulo específico.

### Módulos pendientes (en este orden):

| # | Módulo | Archivo CSS | Problema |
|---|--------|-------------|---------|
| 1 | Finanzas | `finanzas.module.css` | Cards apiladas, tabla overflow horizontal |
| 2 | Caja | `caja.module.css` | Cards apiladas en columna |
| 3 | Clientes | `clientes.module.css` | Layout sin verificar mobile |
| 4 | Inventario | `inventario.module.css` | Layout sin verificar mobile |
| 5 | Productos | `productos.module.css` | Layout sin verificar mobile |

### Estándar aprobado por Carlos:

```css
/* Cards */
border-radius: 16px;
box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04);
background: white;

/* Grid mobile (max-width: 768px) */
display: grid;
grid-template-columns: 1fr 1fr;
gap: var(--space-3);

/* Fondo base */
--bg-base: #F4F6FA;  /* más cálido que #E8EEF4 */
```

### Reglas de proceso (irrompibles):
1. **Un módulo por prompt** — no intentar redesign global en un solo prompt
2. **Verificación visual de Carlos obligatoria** antes de pasar al siguiente módulo
3. **"Commiteado" ≠ "se ve"** — exigir captura de pantalla de confirmación
4. **NUNCA tocar `globals.css` o `tokens.css` para fixes visuales de módulos**

---

## 7. BUGS CONOCIDOS EN PRODUCCIÓN

| Bug | Severidad | Módulo | Estado |
|-----|-----------|--------|--------|
| Doble scroll sidebar mobile | P0 | Layout | ❌ Parcialmente resuelto — verificar |
| KPIs no en grid 2x2 en Finanzas, Caja | P1 | Finanzas, Caja | ❌ Pendiente módulos restantes |
| Hardware scanner URL incorrecta (`?q=` vs `?search=`) | P1 | POS | ❌ 1 línea pendiente |
| ACR_TEST_PROD en Top Productos Escritorio | P2 | DB + Escritorio | ❌ Confirmar limpieza DB VPS |
| Usuario duplicado admin (id=1 y id=3) | P2 | DB | ⚠️ Ambos son super_admin — pendiente decisión de Carlos |
| `/api/finanzas/gastos` huérfano | P3 | API | ❌ Endpoint existe pero nadie lo consume |

---

## 8. ESTADO DB VPS (verificado 2026-06-24)

### Users con email `admin@activopos.com`:
```
id=1  | super_admin | 2026-06-16
id=3  | super_admin | 2026-06-24
```
**No se ejecutó DELETE** — ambos son `super_admin`, no `admin`. Pendiente decisión de Carlos sobre id=3.

### Productos ACR_TEST:
- 10 registros `ACR_TEST_PROD` (ids 18–27) — datos de prueba visibles en Top Productos
- DELETE pendiente de aprobación de Carlos

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

**Verificación post-deploy:**
```bash
curl -s http://localhost:3003/api/rates/bcv
pm2 status
```

---

## 10. DECISIONES DE ARQUITECTURA VIGENTES

| Decisión | Regla |
|----------|-------|
| Deuda CxC | Ancla en USD. `saldo_usd × tasa_BCV_hoy` — nunca usar `total_bs` guardado |
| Tasa BCV | `ve.dolarapi.com/v1/dolares/oficial` — fallback última tasa en DB |
| Stock | Descuenta SOLO cuando `sale.status = 'paid'` |
| Sidebar | SIEMPRE blanco (#FAFBFC) con borde derecho — independiente del tema dark/light |
| Precios | Siempre del DB — nunca del body (SEC-01) |
| `business_id` | Siempre de `getSession()` — nunca del body ni query params |

---

## 11. NOTAS TÉCNICAS PARA PRÓXIMO AGENTE

- PowerShell no acepta `&&` entre comandos — usar `;` o comandos separados
- VPS siempre necesita `--legacy-peer-deps` por conflicto `use-scan-detection`
- Prisma en VPS: `npx prisma db execute` no acepta `--schema` en Prisma 7
- CIMAAD corre contra servidor activo — verificar que `npm run dev` esté corriendo antes de ejecutar test
- `tests/.auth-state.json` expira cada 8h — si tests fallan en masa, refrescar cookie (ver SYSTEM_MAP §9)

---

*Generado: 2026-06-25 | CLI-D | Sprint 33 — Documentación y Verificación*
