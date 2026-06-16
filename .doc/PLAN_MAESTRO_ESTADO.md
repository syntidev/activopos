# ACTIVOPOS — PLAN MAESTRO DE CONSTRUCCIÓN
# Estado actual + Ruta módulo a módulo
# Generado: 16 Junio 2026

---

## ✅ COMPLETADO HOY — SPRINT 1 PARCIAL

| # | Entregable | Estado |
|---|-----------|--------|
| 1 | Next.js 14 + TypeScript + CSS Modules instalado | ✅ |
| 2 | Prisma 7 + adapter-mariadb + MySQL conectado | ✅ |
| 3 | 14 tablas migradas (init) | ✅ |
| 4 | src/lib/prisma.ts — singleton con variables de entorno | ✅ |
| 5 | src/lib/bcv.ts — BCV service con cache + fallback | ✅ |
| 6 | /api/rates/bcv — endpoint live (587.40 Bs) | ✅ |
| 7 | src/styles/tokens.css — 436 líneas, 100% tokenizado | ✅ |
| 8 | src/styles/globals.css — reset + base + utilidades | ✅ |
| 9 | src/app/layout.tsx — Inter + data-theme dark + metadata | ✅ |
| 10 | .doc/ completo — 8 documentos fundacionales | ✅ |
| 11 | CLAUDE.md + AGENTS.md en raíz | ✅ |

---

## 🔨 EN PROGRESO — SPRINT 1 CONTINUACIÓN

| # | Entregable | Prompt | CLI |
|---|-----------|--------|-----|
| 12 | Auth completo (jwt, login, logout, me, middleware, seed) | CLI_A_AUTH_PROMPT.md | CLI-A |

---

## 📋 RUTA COMPLETA — MÓDULO A MÓDULO

### SPRINT 1 — Fundación (hoy)
```
✅ Setup + Prisma + BCV + Tokens
🔨 Auth: JWT + middleware + seed usuarios
⏳ Login Page: UI completa dark/light
⏳ AppLayout: Sidebar + Header
```

### SPRINT 2 — Design System + Productos
```
⏳ Primitives: Button, Input, Badge, Card, Table, Modal, Toast
⏳ BCV widget en sidebar (tasa en tiempo real)
⏳ Módulo Productos: CRUD + categorías + stock
⏳ API: /api/products CRUD completo con Zod
⏳ Import masivo XLSX
```

### SPRINT 3 — Punto de Venta (CORE)
```
⏳ POS Layout: dos paneles (grid productos + ticket)
⏳ Lógica ticket: qty × price_usd × rate = total_bs
⏳ Modal cobro: métodos de pago múltiples
⏳ Comprobante: ticket térmico + WhatsApp + PDF
⏳ /api/sales POST + PATCH (pay)
⏳ Descuento inventario al pagar
```

### SPRINT 4 — Cotizaciones + Clientes
```
⏳ Cotizaciones: sale.status='quote' → confirmar → cobrar
⏳ Clientes: directorio + crédito + historial
⏳ Abonos parciales (SaleAbono)
⏳ CxC visible en cliente
```

### SPRINT 5 — Gestión de Caja
```
⏳ Apertura turno: fondos iniciales por método
⏳ Movimientos: ingresos y retiros
⏳ Cuadre: conteo físico vs sistema
⏳ Historial de cierres
⏳ Alertas diferencias (sobrante/faltante)
```

### SPRINT 6 — Reportes + Dashboard
```
⏳ Dashboard Escritorio: Bento Grid KPIs
⏳ Ventas hoy/mes, utilidad, métodos de pago
⏳ Gráfica 7 días (Recharts o Chart.js)
⏳ Top 5 productos más vendidos
⏳ Reporte diario: export PDF + Excel
⏳ Reporte mensual: ingresos, costos, utilidad
```

### SPRINT 7 — Finanzas
```
⏳ P&L básico: resultado neto del mes
⏳ CxC: créditos pendientes por cobrar
⏳ CxP: gastos operativos (manual)
⏳ Alertas financieras en Dashboard
```

### SPRINT 8 — Configuración + Onboarding
```
⏳ Tab Negocio: nombre, RIF, logo, datos
⏳ Tab Usuarios: CRUD roles admin/cajero
⏳ Tab Pagos: activar/desactivar métodos
⏳ Tab Ticket: prefijo, footer, toggles
⏳ Tab Tema: dark/light + color de acento
⏳ Onboarding 4 pasos para nuevo negocio
```

### SPRINT 9 — Pulido + Certificación
```
⏳ /webapp-testing flujo completo E2E
⏳ /code-review ultra codebase completo
⏳ /security-review OWASP
⏳ /performance bundle + Core Web Vitals
⏳ /emil-design-eng polish invisible
⏳ Fix todos los issues P0/P1
```

### SPRINT 10 — Deploy Producción
```
⏳ Build producción + PM2 proceso activopos
⏳ Nginx virtual host puerto 3001
⏳ SSL Cloudflare
⏳ activopos.com live
⏳ Primer cliente onboarding
```

---

## ARQUITECTURA DE VENTANAS CLI

```
CLI-A  → Backend: API routes, Prisma, lógica de negocio
CLI-B  → Frontend: Componentes, CSS Modules, animaciones
CLI-C  → /software-architecture + /code-review continuo
CLI-D  → /webapp-testing certificación por módulo
```

---

## DECISIONES IRROMPIBLES (no renegociar)

| Decisión | Valor |
|----------|-------|
| Multi-tenant | ❌ NO en v1 — un negocio por instalación |
| Branch/sucursal | ❌ NO en v1 |
| branch_id en tablas | ❌ NUNCA |
| Paradigma de venta | qty × price_usd × rate — NUNCA bs→qty |
| Stack | Next.js 14 + TypeScript + CSS Modules + Prisma 7 |
| Catálogo digital | Fase 2 (LLEVA/Ordena.menu) |
| Punto de Equilibrio PRO | Fase 2 |
| CSS framework | CSS Modules — cero Tailwind |
| Iconos | Lucide React — cero emojis en UI |

---

## PRÓXIMO PROMPT PARA CLI-A

**CLI_A_AUTH_PROMPT.md** — Auth completo (6 archivos + seed)

Después de auth:
- **CLI_B_LOGIN_PAGE_PROMPT** — Login page UI
- **CLI_B_APPLAYOUT_PROMPT** — Sidebar + Header animado
- **CLI_A_PRODUCTS_API_PROMPT** — API productos
- **CLI_B_PRODUCTS_UI_PROMPT** — UI módulo productos

---

*ActivoPOS · syntidev · activopos.com · Junio 2026*
