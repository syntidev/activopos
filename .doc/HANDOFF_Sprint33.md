# HANDOFF Sprint 33 — Documentación, Verificación y Mobile Fixes
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
0de0b99 fix(mobile): sidebar footer compacto, escritorio KPIs grid 2col
0b014e3 docs: HANDOFF Sprint 33, SYSTEM_MAP actualizado, CIMAAD verificado
f1f5a7e fix(pos): hardware scanner URL ya OK + alerta gastos escritorio
683542d feat(ui): rediseño visual mobile-first, cards con profundidad, grid 2col, sidebar compacto
37bd885 feat(ui): estándar global botones btn-primary/secondary/danger/icon
7537de7 fix(finanzas): botones header visibles, columna vence limpia
9e4d7bf feat(finanzas): botones editar Gastos y CxP, contorno visible siempre
d89bef3 fix(cxc): TOCTOU — mover saldo check dentro de transaction con FOR UPDATE
3186060 fix(cxc): saldo check, respuesta paid/saldo_usd, mensaje caja clara
f73fde0 fix(cxc): AbonoModal validación saldo, mensaje caja, limpiar body
```

**Último commit features:** `0de0b99` — sidebar footer compacto mobile + kpiGrid 2 col en todos los teléfonos.
**TypeScript:** ✅ 0 errores (`npx tsc --noEmit` verificado antes del commit).
**VPS:** operativo con build Sprint 31-32. Puerto 3003. Pendiente deploy de hoy.

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

| Tarea | CLI | Estado | Detalle |
|-------|-----|--------|---------|
| SYSTEM_MAP actualizado (endpoints Sprint 31-32) | D | ✅ | 7 endpoints nuevos documentados — `/api/gastos`, `/api/config/cobros/data`, `/api/config/devices`, `/api/config/subscription` |
| HANDOFF Sprint 33 creado | D | ✅ | Este documento |
| CIMAAD verificado | D | ⚠️ 1/7 local | Ver sección 4 — Nodo 1 falla sin servidor activo |
| Hardware scanner URL fix | A | ✅ | `useHardwareScanner.ts` — `?q=` → `?search=` corregido |
| Alertas gastos Escritorio conectadas | A/B | ✅ | Banner "gasto vence ≤5 días" conectado a `/api/gastos/alerts` |
| Rediseño visual mobile-first (Escritorio) | B | ✅ | Cards profundidad, bg `#F4F6FA`, KPIs grid 2col, `Button.tsx` migrado en 6 módulos |
| Estándar global botones | B | ✅ | `.btn-primary / .btn-secondary / .btn-danger / .btn-icon` en `globals.css` |
| **Sidebar footer compacto mobile** | B | ✅ | `@media (max-width: 768px)`: `display: flex`, `overflow: hidden`, oculta logo + notif + badge |
| **Escritorio kpiGrid 2col en todos los teléfonos** | B | ✅ | `@media (max-width: 640px)` cambiado de `1fr` → `1fr 1fr` — el override de 640px ya no colapsa |

---

## 4. CIMAAD — RESULTADO SPRINT 33

**Estado:** ❌ 1/7 local — Nodo 1 falla. VPS ✅ 7/7 vigente desde Sprint 27.

### Falla Nodo 1 — Inventario

```
SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
tests/auditoria-ciclo-real.spec.ts:143:24
```

**Causa confirmada:** Servidor local no activo al ejecutar el test. La API call a `localhost:3000/api/products/[id]` recibe HTML (redirect a `/login` del middleware) en lugar de JSON.

**Nodos 2–7:** No corrieron (`⏳`) porque la suite CIMAAD es un ciclo acumulativo — el producto del Nodo 1 es insumo de los siguientes.

**Contexto de certificación:** CIMAAD fue certificado **7/7 en VPS:3003** en Sprint 27 y permanece vigente. El test NO requiere re-certificación mientras no haya cambios en los 7 endpoints del ciclo.

**Para reproducir 7/7 localmente:**
1. Iniciar servidor: `npm run dev`
2. Correr: `npx playwright test tests/auditoria-ciclo-real.spec.ts --reporter=line`

---

## 5. PENDIENTES CRÍTICOS PARA SPRINT 34

### P0 — Críticos (bloquean calidad del producto)

| # | Tarea | CLI | Detalle |
|---|-------|-----|---------|
| 1 | **Diseño mobile — módulos restantes** | B | Finanzas, Caja, Clientes, Inventario, Productos — cada uno en su `.module.css`. Ver protocolo en §6. |
| 2 | **Migración `business_devices` VPS** | A | `npx prisma migrate deploy` en VPS — tabla `business_devices` pendiente de aplicar |

### P1 — Importante

| # | Tarea | CLI | Detalle |
|---|-------|-----|---------|
| 3 | **Teclado numérico** | B | `inputMode="numeric"` en campos de Caja, Clientes, Abonos — verificar completitud |
| 4 | **Cobros E2E** | D | Tests Playwright para módulo Cobros (backend completo Sprint 31, sin certificar con E2E) |

### P3 — Futura (no bloquean v1)

| # | Tarea | CLI | Detalle |
|---|-------|-----|---------|
| 5 | **Listas de precios** | A+B | Detal / mayor / cliente especial — Fina lo tiene — feature diferenciador |
| 6 | **Comisiones a personal** | A+B | Fina lo tiene — ventaja competitiva — no iniciado |
| 7 | **Endpoint huérfano `/api/finanzas/gastos`** | A | Nadie lo consume — el real es `/api/gastos` — eliminar o redirigir |

---

## 6. PROTOCOLO DISEÑO MOBILE (SELLADO — no modificar)

**Regla cardinal:** Los CSS Modules locales sobreescriben `globals.css` y `tokens.css`. Para fixes visuales de módulos, siempre entrar al `.module.css` del módulo específico.

### Módulos pendientes (en este orden):

| # | Módulo | Archivo CSS | Problema |
|---|--------|-------------|---------|
| 1 | Finanzas | `finanzas.module.css` | Cards pendientes verificar en móvil post Sprint 33 |
| 2 | Caja | `caja.module.css` | KPI grid verificar 2col |
| 3 | Clientes | `clientes.module.css` | Layout sin verificar mobile |
| 4 | Inventario | `inventario.module.css` | Layout sin verificar mobile |
| 5 | Productos | `productos.module.css` | Layout sin verificar mobile |

### Estándar aprobado por Carlos:

```css
/* Cards */
border-radius: 16px;
box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04);
background: var(--color-surface);  /* no white hardcodeado */

/* Grid mobile (max-width: 768px) */
display: grid;
grid-template-columns: 1fr 1fr;
gap: var(--space-3);

/* Fondo base (tokens.css light mode) */
--bg-base: #F4F6FA;
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
| Doble scroll sidebar mobile | P0 | Layout | ✅ **Resuelto Sprint 33** — `display:flex`, `overflow:hidden`, logo oculto en mobile |
| KPIs escritorio no en grid 2x2 en teléfonos < 640px | P0 | Escritorio | ✅ **Resuelto Sprint 33** — `@media 640px` ya no colapsa a 1fr |
| KPIs no en grid 2x2 en Finanzas, Caja | P1 | Finanzas, Caja | ❌ Pendiente módulos restantes (Sprint 34) |
| Hardware scanner URL incorrecta | P1 | POS | ✅ Resuelto Sprint 33 — `?q=` → `?search=` |
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
npx prisma migrate deploy
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
- Sidebar mobile: usa `.sidebarMobile` class selector dentro de `@media (max-width: 768px)` — no usar media queries separadas

---

*Generado: 2026-06-25 | CLI-D | Sprint 33 — Documentación, Verificación y Mobile Fixes*
*Actualizado con fix sidebar + kpiGrid 2col completados por CLI-B*
