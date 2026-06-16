# ROADMAP MAESTRO — ActivoPOS
# Plan de desarrollo completo por sprints
# Versión: 1.0 | Junio 2026

---

## VISIÓN

ActivoPOS es el POS SaaS para PYMES venezolanas.
Inspirado visualmente en Venko. Construido sobre la arquitectura de SportBar.
POS físico + Catálogo digital + Analytics — en un solo producto nativo para Venezuela.

**Stack:** Next.js 14 + TypeScript + CSS Modules + Prisma + MySQL
**Meta:** Primer cliente pagando en 60 días.

---

## FASES MACRO

| Fase | Objetivo                    | Duración | Entregable                        |
|------|-----------------------------|----------|-----------------------------------|
| 0    | Setup + Fundación           | 2 días   | Proyecto corriendo local + VPS    |
| 1    | Core UX + Design System     | 3 días   | Sidebar, tokens, auth, layout     |
| 2    | Inventario + BCV            | 3 días   | Productos CRUD + tasa BCV         |
| 3    | POS completo                | 4 días   | Venta → cobro → ticket            |
| 4    | Cotizaciones + Crédito      | 2 días   | Quote flow completo               |
| 5    | Clientes + Caja             | 3 días   | CRM + turno + cuadre              |
| 6    | Reportes + Finanzas         | 3 días   | Dashboard analítico               |
| 7    | Configuración + Onboarding  | 2 días   | Setup negocio + usuarios          |
| 8    | Pulido + Certificación      | 3 días   | /webapp-testing + /code-review    |
| 9    | Deploy producción           | 1 día    | activopos.com live                |

**Total estimado: ~26 días de desarrollo activo**

---

## SPRINT 1 — Setup + Fundación
**Objetivo:** Proyecto corriendo local y en VPS con auth funcional.
**Agentes:** CLI-A (setup) + CLI-B (tokens)

### Tareas

#### S1.1 — Inicializar proyecto
```bash
npx create-next-app@14 activopos \
  --typescript \
  --app \
  --no-tailwind \
  --import-alias "@/*"
cd activopos
npm install prisma @prisma/client jose bcryptjs framer-motion
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select
npm install lucide-react zod xlsx sharp
npm install @supabase/supabase-js
npm install -D @types/bcryptjs
```

#### S1.2 — Configurar Prisma
```bash
npx prisma init --datasource-provider mysql
# Editar DATABASE_URL en .env
npx prisma migrate dev --name init
```

#### S1.3 — Design tokens (CLI-B)
- Crear `src/styles/tokens.css` con todas las variables CSS
- Crear `src/styles/globals.css` con reset y base
- Crear `src/styles/themes/dark.css` y `light.css`
- Aplicar /ui-ux-pro-max para definir paleta y tipografía

#### S1.4 — Auth completo (CLI-A)
- `src/lib/auth.ts` — JWT helpers (signToken, verifyToken)
- `src/lib/prisma.ts` — Cliente Prisma singleton
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/auth/me/route.ts`
- `src/app/(auth)/login/page.tsx` + `login.module.css`
- Middleware Next.js para proteger rutas

#### S1.5 — AppLayout + Sidebar (CLI-B)
- `src/components/layout/Sidebar.tsx` + CSS
- `src/components/layout/Header.tsx` + CSS
- `src/app/(dashboard)/layout.tsx`
- Tasa BCV visible en sidebar (fondo)
- Toggle dark/light persistente

#### S1.6 — Deploy inicial VPS
- Configurar Nginx virtual host puerto 3001
- PM2 proceso `activopos`
- SSL Cloudflare
- Verificar activopos.com en vivo

**Entregable Sprint 1:** activopos.com con login funcional y sidebar navegable.

---

## SPRINT 2 — BCV Service + Productos
**Objetivo:** Tasa BCV funcionando y CRUD de productos completo.
**Agentes:** CLI-A (API) + CLI-B (UI)

### Tareas

#### S2.1 — BCV Service (CLI-A)
- `src/lib/bcv.ts` — fetch ve.dolarapi.com/v1/dolares/oficial
- Fallback a última tasa en dollar_rates
- Cache 1 hora en memoria
- Cron cada 6 horas para actualizar (o manual desde Config)
- `/api/rates/bcv` endpoint

#### S2.2 — Módulo Productos (CLI-A + CLI-B)
- Migración Prisma: products + categories + inventory_entries
- `/api/products` — CRUD completo con Zod
- `src/app/(dashboard)/productos/page.tsx`
- Vista lista: nombre, categoría, precio USD, precio Bs, stock, modo
- Modal crear/editar producto
- Toggle sale_mode: weight | unit | service
- Importación masiva XLSX
- Alertas stock bajo

#### S2.3 — Design System Primitives (CLI-B)
- `src/components/ui/Button.tsx`
- `src/components/ui/Input.tsx`
- `src/components/ui/Select.tsx`
- `src/components/ui/Badge.tsx`
- `src/components/ui/Card.tsx`
- `src/components/ui/Table.tsx`
- `src/components/ui/Modal.tsx`
- `src/components/ui/EmptyState.tsx`
- `src/components/ui/Skeleton.tsx`
- Aplicar /impeccable craft en todos

**Entregable Sprint 2:** Productos funcional con BCV en tiempo real.

---

## SPRINT 3 — Punto de Venta (CORE)
**Objetivo:** Flujo de venta completo: producto → ticket → cobro → comprobante.
**Agentes:** CLI-A (lógica) + CLI-B (UI) + CLI-D (/webapp-testing)

### Tareas

#### S3.1 — POS Layout (CLI-B)
- Layout de dos paneles: grid productos (izq) + ticket (der)
- Filtro por categorías con colores
- Buscador con autocompletado
- Toggle "Solo con stock"
- Cards de producto con precio USD y Bs

#### S3.2 — Lógica de ticket (CLI-A)
- Agregar ítem → calcular qty × price_usd × rate = subtotal_bs
- Editar cantidad, eliminar ítem
- Subtotal / Total en USD y Bs
- Soporte sale_mode: weight (decimales) y unit (enteros)
- Validar stock antes de crear venta
- `/api/sales` POST — crear venta

#### S3.3 — Cobro (CLI-A + CLI-B)
- Modal de cobro con métodos de pago dinámicos
- Pago mixto: múltiples métodos en una venta
- Cálculo de cambio en efectivo
- Referencia por método (Pago Móvil, Zelle)
- `/api/sales/[id]/pay` PATCH
- Descuento de inventario al pagar

#### S3.4 — Comprobante (CLI-B)
- Ticket térmico HTML 58/80mm
- Auto-print en iOS/Android
- Envío por WhatsApp (enlace wa.me con texto)
- PDF descargable
- Configuración: qué mostrar en ticket

#### S3.5 — Cotizaciones básicas (CLI-A)
- sale.status = 'quote' — no descuenta stock
- Listar cotizaciones pendientes
- Convertir cotización → venta con un click

#### S3.6 — Certificación POS (CLI-D)
- /webapp-testing flujo completo POS
- /code-review high
- /security-review

**Entregable Sprint 3:** POS completo certificado.

---

## SPRINT 4 — Clientes + Caja
**Objetivo:** CRM básico y gestión de caja con turnos.
**Agentes:** CLI-A + CLI-B

### Tareas

#### S4.1 — Módulo Clientes (CLI-A + CLI-B)
- Migración: clients
- CRUD clientes con cédula venezolana
- Búsqueda en tiempo real
- Asignar cliente a venta desde POS
- Control de crédito: deuda pendiente, abonos
- Historial de compras por cliente

#### S4.2 — Gestión de Caja (CLI-A + CLI-B)
- Migración: cash_registers + cash_movements
- Apertura de turno: fondos iniciales USD + Bs por método
- Movimientos: ingreso y retiro durante turno
- Ventas por método de pago en tiempo real
- Declarar cierre: conteo físico vs sistema
- Detección de diferencias (sobrante/faltante)
- Historial de cierres
- Alertas bancarias (5PM Venezuela)

**Entregable Sprint 4:** Clientes y Caja funcionales.

---

## SPRINT 5 — Reportes + Finanzas
**Objetivo:** Reportería completa y módulo financiero básico.
**Agentes:** CLI-A + CLI-B

### Tareas

#### S5.1 — Reportes (CLI-A + CLI-B)
- Reporte diario: ventas, cobros, métodos de pago, top productos
- Reporte mensual: ingresos, costos, utilidad bruta
- Historial BCV del mes
- Exportar PDF y Excel
- Filtros por período y vendedor

#### S5.2 — Dashboard Escritorio (CLI-B)
- KPIs: Ventas Hoy/Mes, Utilidad Hoy/Mes (USD + Bs)
- Gráfica ventas últimos 7 días
- Ventas por método de pago (pie chart)
- Top 5 productos más vendidos
- Alertas CxC/CxP pendientes
- Tasa BCV del día prominente

#### S5.3 — Finanzas (CLI-A + CLI-B)
- Resultado neto del mes (ingresos - gastos operativos)
- Cuentas por cobrar (créditos pendientes)
- Cuentas por pagar (básico — manual)
- Gastos operativos categorizados

**Entregable Sprint 5:** Reportería completa y dashboard analítico.

---

## SPRINT 6 — Configuración + Onboarding
**Objetivo:** Setup completo del negocio y usuarios.
**Agentes:** CLI-A + CLI-B

### Tareas

#### S6.1 — Configuración (CLI-A + CLI-B)
- Tab Negocio: nombre, RIF, logo, dirección, teléfono
- Tab Usuarios: CRUD usuarios con roles
- Tab Pagos: activar/desactivar métodos de pago
- Tab Ticket: toggles qué mostrar, footer, prefijo
- Tab Tema: light/dark + color de acento

#### S6.2 — Onboarding (CLI-A + CLI-B)
- Flow 4 pasos: negocio → métodos de pago → primer producto → primera caja
- Progreso guardado — retomable
- Checklist de setup completo

**Entregable Sprint 6:** Configuración completa y onboarding funcional.

---

## SPRINT 7 — Pulido + Certificación Total
**Objetivo:** Producto production-ready.
**Agentes:** CLI-C + CLI-D

### Tareas

- /webapp-testing flujo completo de extremo a extremo
- /code-review ultra en todo el codebase
- /security-review OWASP completo
- /performance — bundle, lazy load, Core Web Vitals
- /accessibility WCAG 2.2
- /web-design-guidelines auditoría completa
- /emil-design-eng polish invisible
- Corrección de todos los issues P0 y P1

**Entregable Sprint 7:** activopos.com production-ready para primer cliente.

---

## NO ENTRA EN V1

- Catálogo digital / vitrina web (Fase 2 — LLEVA/Ordena.menu)
- Punto de Equilibrio PRO (Fase 2)
- Multi-sucursal (Fase 2 — plan Pro)
- Integración Supabase Realtime completa (Fase 2)
- App móvil nativa (Fase 3)
- Asistente IA (Fase 3)
- E-commerce / pagos online (Fase 3)

---

## ESTRATEGIA DE VENTANAS CLI

```
CLI-A  →  Arquitectura, API routes, Prisma, lógica de negocio
CLI-B  →  Componentes UI, CSS Modules, animaciones
CLI-C  →  /software-architecture + /code-review continuo
CLI-D  →  /webapp-testing certificación por módulo
```

### Trabajo paralelo por sprint

Sprint 3 (POS) en paralelo:
- CLI-A: lógica de venta, API routes, Prisma queries
- CLI-B: UI del POS, ticket panel, modal de cobro
- CLI-D: tests al completar cada subtarea

---

## MÉTRICAS DE ÉXITO

- [ ] Login → Venta → Cobro → Ticket en < 60 segundos
- [ ] Cero N+1 en todas las páginas (verificado con Prisma)
- [ ] Lighthouse > 90 en Performance, A11y y Best Practices
- [ ] Cero `any` en TypeScript (strict check)
- [ ] /webapp-testing: 100% flujos core PASS
- [ ] Primer cliente pagando en 60 días desde inicio

---

*Roadmap sujeto a ajuste según feedback del primer cliente real.*
*Carlos Bolívar — SYNTIdev — Junio 2026*
