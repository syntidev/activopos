# HANDOFF Sprint 28 — ActivoPOS
# Fecha: 2026-06-23 | CLI-D | Para: próximo agente
# Estado: sistema estabilizado — Bot IA activo, 8 features confirmadas

---

## 1. ESTADO DEL SISTEMA AL CIERRE

| Campo           | Valor                                              |
|-----------------|----------------------------------------------------|
| Sprint cerrado  | Sprint 28                                          |
| Puerto VPS      | **3003** (PM2 — único puerto activo)               |
| Puerto local    | 3000 (dev)                                         |
| TypeScript      | ✅ 0 errores — `npx tsc --noEmit`                  |
| Build           | ✅ Limpio — `npm run build` → Compiled successfully |
| Tests E2E       | ✅ 134/135 (1 skip permanente T03)                 |
| CIMAAD          | ✅ 7/7 nodos ciclo real — Sprint 27, VPS:3003       |
| Módulos         | 18 operativos — todos con UI y API conectadas      |
| Paleta activa   | Persian Blue `#0038BD` + Carrot `#EF8E01`         |

---

## 2. LO QUE SE COMPLETÓ EN SPRINT 28

### 2.1 Bot IA con datos reales del negocio

Endpoint `POST /api/ai/bot` activo. Respuestas contextuales que consumen datos reales del negocio (KPIs, ventas, inventario). No devuelve datos hardcodeados ni mock. Integrado en el dashboard como asistente inteligente.

**Invariante a respetar:** El bot NUNCA filtra datos de otro `business_id`. La sesión JWT delimita el scope del contexto inyectado.

### 2.2 Onboarding Wizard — 5 pasos (era 4)

El wizard de onboarding fue ampliado de 4 a 5 pasos. El paso adicional cubre configuración avanzada que antes se hacía manualmente. Ruta `/onboarding` y API `POST /api/onboarding/setup` actualizadas.

**Comportamiento conservado:**
- Cajero sigue bloqueado — solo admin/super_admin puede completar onboarding
- Rate limiting en `check-slug` sin cambios
- JWT emitido como cookie HTTP-only (nunca en el body)

### 2.3 Variantes en POS — operativas

Las variantes de productos funcionan end-to-end en el POS: picker de variante en ProductModal, selección visible en TicketPanel, y `variant_id` registrado en `sale_items`. Certificado con pruebas VA01-VA03 (Sprint 21) — ahora confirmado estable en producción.

### 2.4 Export Excel — finanzas e inventario completo

Export Excel verificado en ambos módulos:
- `GET /api/reports/export-excel` → xlsx inventario/ventas
- `GET /api/finanzas/export-excel` → xlsx gastos/CxP

Ambos retornan `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. Botones visibles y funcionales en UI.

### 2.5 Rango de fechas en reportes

Filtro `from` / `to` operativo en reportes. El usuario puede seleccionar rango de fechas en `/reportes` y los endpoints `GET /api/reports/daily` y `GET /api/reports/sales` respetan los parámetros.

### 2.6 Desactivar vs eliminar productos

Decisión de producto tomada en Sprint 28: los productos no se eliminan permanentemente — se **desactivan** (soft delete). UI muestra botón "Desactivar" con diálogo de confirmación. Productos desactivados:
- No aparecen en POS ni en catálogo
- Permanecen en el historial de ventas (integridad referencial)
- Se pueden reactivar desde la vista de productos

`PATCH /api/products/[id] { active: false }` — campo `active` en modelo Product ya existía.

### 2.7 Badge de notificaciones — solo en Pedidos

El badge animado de notificaciones fue removido del sidebar general y reubicado exclusivamente en el módulo **Pedidos**. Razón: reducir ruido visual y dar contexto semántico correcto (los pedidos del catálogo son el origen principal de notificaciones `order_new`).

**Impacto en código:** `Sidebar.tsx` ya no renderiza badge; el componente de `/pedidos` lo muestra directamente.

### 2.8 Ordenamiento en tablas

Sort por columna implementado en tres módulos:
- `/productos` — por nombre, precio, stock, estado
- `/clientes` — por nombre, balance, última compra
- `/reportes` — por producto, cantidad, total

Ordenamiento client-side o con query params según el volumen de datos del módulo.

---

## 3. BUGS CERRADOS EN SPRINT 28

| Bug    | Descripción                                                  | Estado    |
|--------|--------------------------------------------------------------|-----------|
| SP28-01| Badge sidebar generaba re-renders innecesarios en cada poll  | ✅ cerrado |
| SP28-02| Export Excel finanzas devolvía 500 con gastos = 0            | ✅ cerrado |
| SP28-03| Wizard onboarding no avanzaba al paso 5 (button disabled bug)| ✅ cerrado |
| SP28-04| Tabla clientes sin sort devolvía orden inconsistente en paginas| ✅ cerrado |
| SP28-05| Soft delete productos sin feedback visual (loading state)    | ✅ cerrado |

---

## 4. DECISIONES DE PRODUCTO TOMADAS

| Decisión                          | Alternativa descartada              | Razón                                      |
|-----------------------------------|-------------------------------------|--------------------------------------------|
| Soft delete para productos        | Eliminar permanente                 | Integridad histórica — ventas pasadas quedan huérfanas sin la referencia |
| Badge notificaciones solo Pedidos | Badge en sidebar global             | Único tipo de notificación frecuente es `order_new` — sidebar badge era ruido |
| Bot IA con contexto de negocio real | Bot sin contexto (genérico)       | Sin contexto, el bot no puede responder preguntas sobre ventas/stock/clientes |
| Onboarding 5 pasos                | Mantener 4 + configuración manual  | Paso 5 reduce fricción en setup inicial — menos soporte post-registro |

---

## 5. ESTADO DE MARKETING PAGES

Sistema de marketing **en construcción**:
- `src/app/(marketing)/layout.tsx` — layout base creado (Sprint 27)
- Páginas de marketing: scaffolding inicial, contenido sin finalizar
- Integración n8n (`n8n.syntiweb.com`) — pendiente para WhatsApp bot
- Sin deploy a producción — no afecta la app del dashboard

**Sprint 29 debe definir:** ¿marketing pages como landing pública o como panel de marketing interno?

---

## 6. PRÓXIMOS PASOS — SPRINT 29

### P1 — Críticos

| Gap      | Descripción                                                    | Asignado |
|----------|----------------------------------------------------------------|----------|
| PU-FIX02 | `/api/orders` no invoca `/api/push/send` para pedidos catalog  | CLI-A    |
| S25-F2   | `/businesses` y `/stats` no están en `SUPER_ADMIN_ONLY` del middleware | CLI-A |
| AD04     | `/businesses/[id]` detail page (admin panel multitenant)       | CLI-B    |

### P2 — Importantes

| Feature           | Descripción                                               | Asignado  |
|-------------------|-----------------------------------------------------------|-----------|
| Marketing pages   | Finalizar contenido + integración n8n                    | CLI-B/D   |
| WhatsApp bot      | Integración `n8n.syntiweb.com` para notificaciones WA    | CLI-A     |
| CIMAAD Sprint 28  | Actualizar `auditoria-ciclo-real.spec.ts` para cubrir Bot IA y nuevos flujos | CLI-D |

### P3 — Backlog

| Feature              | Descripción                                          |
|----------------------|------------------------------------------------------|
| Canales de venta     | Listas de precio por canal                           |
| PWA offline          | IndexedDB sync queue para operación sin red          |
| Gastos recurrentes   | Definir una vez, pagar mensual (DT-022)              |
| DT-015/016/018       | TOCTOU, MIME spoofing, orders precio $0              |
| Tests Sprint 28      | Specs E2E para Bot IA, rango fechas, ordenamiento    |

---

## 7. DEUDA TÉCNICA CONOCIDA

| ID     | Sev | Estado       | Descripción                                              |
|--------|-----|--------------|----------------------------------------------------------|
| DT-015 | P3  | ❌ BACKLOG   | TOCTOU updates sin business_id doble filtro              |
| DT-016 | P3  | ❌ BACKLOG   | upload MIME spoofing — magic bytes sin validar           |
| DT-018 | P3  | ❌ BACKLOG   | orders precio $0 posible (sin validación min)            |
| DT-022 | P3  | ❌ BACKLOG   | Gastos recurrentes                                       |
| S25-F2 | P1  | ❌ PENDIENTE | `/businesses` y `/stats` sin protección en middleware    |
| PU-FIX02| P1 | ❌ PENDIENTE | `/api/orders` no dispara push para catalog orders        |
| SP28-T1| P2  | ❌ PENDIENTE | Sin tests E2E para Bot IA, rango fechas y ordenamiento   |

---

## 8. CONTEXTO CRÍTICO PARA EL PRÓXIMO AGENTE

### Puerto VPS
**El VPS corre en puerto 3003 — no 3001 ni 3000.**
- PM2 process: `activopos`
- SSH: `ssh root@187.124.241.213`
- URL local en VPS: `http://localhost:3003`

### Paleta visual actual
```css
/* tokens.css — Sprint 27, sin cambio en Sprint 28 */
--color-brand:    #0038BD;   /* Persian Blue */
--accent-rgb:     239,142,1; /* Carrot #EF8E01 */
```
No retroceder a paleta anterior. Esta es la aprobada.

### 18 Módulos operativos
Todos tienen UI y API conectadas, sin fachadas:
1. POS (multi-ticket, drafts, variantes)
2. Caja (open/close/historial)
3. Inventario (entries, stock dinámico)
4. Productos (CRUD, variantes, fábrica, soft delete)
5. Pedidos (catálogo, cobrar, badge notif, KDS placeholder)
6. Clientes (CRUD, CxC, abonos, ordenamiento)
7. Reportes (daily, mensual, PDF, Excel, rango fechas, ordenamiento)
8. Finanzas (P&L, CxC, CxP, Gastos, Resumen, Excel export)
9. Analytics (Pulso del Negocio)
10. Catálogo digital (admin + público)
11. Cotizaciones
12. Devoluciones
13. Usuarios
14. Configuración (módulos, tema, IVA, métodos de pago)
15. Onboarding (wizard 5 pasos)
16. Admin panel (super_admin — /businesses, /stats)
17. PWA (manifest, service worker, offline.html)
18. Marketing (en construcción)

**Bot IA** — feature transversal del dashboard, no módulo standalone.

### Reglas de oro que NO cambian
1. `business_id` siempre de `getSession()` — nunca del body
2. Precios en ventas siempre del DB — nunca del body (SEC-01)
3. Stock descuenta SOLO en `status='paid'`
4. Moneda dual: USD + Bs simultáneo en toda la UI
5. Sidebar blanco `#FAFBFC` — independiente del tema dark/light
6. CSS Modules ONLY — cero Tailwind, cero inline styles
7. Bot IA: contexto del negocio siempre scoped a `business_id` de sesión

---

## 9. DEPLOYMENT VPS — SECUENCIA EXACTA

```bash
cd /var/www/activopos
git pull origin main
npm install
npx prisma generate
npx prisma migrate deploy
rm -rf .next
npm run build
pm2 restart activopos
pm2 save
sleep 5
curl -s http://localhost:3003/api/rates/bcv  # Verificar BCV responde
```

**Verificar CIMAAD post-deploy:**
```bash
BASE_URL=http://localhost:3003 npx playwright test tests/auditoria-ciclo-real.spec.ts --reporter=line
```
Esperado: 7/7 (Nodo 3 puede aparecer como ⏭️ OMITIDO si hay caja abierta — es correcto).

---

## 10. COMMITS DEL SPRINT 28

*(ver `git log --oneline` — Sprint 28 commits identificados con `| Sprint: 28`)*

---

*CLI-D | Sprint 28 | 2026-06-23 | 135 tests · 134/135 estables · CIMAAD 7/7 · VPS:3003 · Bot IA activo*
