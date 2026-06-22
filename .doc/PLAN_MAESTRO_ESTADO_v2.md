# ACTIVOPOS — PLAN MAESTRO DE CONSTRUCCIÓN v2
# Actualizado: 16 Junio 2026 — Sesión Fundacional Completa
# Commit: adf748e

---

## ✅ COMPLETADO HOY — SPRINTS 1-5

### Sprint 1 — Fundación
- Next.js 14 + TypeScript + Prisma 7 + MariaDB
- Auth JWT completo (login/logout/me/middleware/roles)
- BCV Service live + fallback + cache
- Design tokens 436 líneas (dark/light/sidebar)
- Login, Sidebar animado, Header, AppLayout
- Escritorio con KPIs reales de DB

### Sprint 2 — Inventario + Caja
- 7 endpoints productos (CRUD, search nombre+SKU+barcode, import XLSX)
- Fórmula precio: costo + margen% → sistema calcula
- 10 endpoints caja/ventas con transacciones atómicas
- UI Productos 4 modales
- 8 primitivos design system

### Sprint 3 — Punto de Venta
- Motor POS puro (pos.ts) — funciones puras
- Hook usePOS.ts con debounce + Promise.all
- POS dos paneles + 8 modales (Cobro mixto, Cliente, Cotización, etc.)
- Búsqueda: nombre + SKU + barcode + cámara html5-qrcode
- UI Clientes + Caja + Reportes
- Ticket PDF 58mm/80mm/carta

### Sprint 4 — Finanzas + Config + Onboarding
- Dashboard Bento Grid con Recharts (line/donut/bar)
- Finanzas: P&L, CxC, CxP, gastos
- Configuración 6 tabs completos
- Onboarding 5 pasos con polling
- Centro de Ayuda + chatbot offline
- PWA manifest + íconos

### Sprint 5 — Variantes + IVA + Pedidos
- Variantes: talla/color/personalizado con stock por variante
- Imágenes múltiples: hasta 3, storage local /uploads/products/
- IVA configurable 0-30% con desglose en ticket
- is_available: toggle visibilidad en POS
- show_in_catalog: toggle catálogo digital + CatalogUpgradeModal upsell
- Unidades: und/par/kg/g/lb/m/cm/L/ml/hora/sesión/combo (catálogo completo)
- Pedidos kanban 4 columnas + API completa
- Delivery con zonas configurables y precios
- WhatsApp link para pedidos
- Fix bug financiero overpayment epsilon
- Storage local reemplaza Cloudinary
- scripts/setup-uploads.sh para permisos VPS

---

## MIGRACIONES DB

```
20260616023908_init                 → 14 tablas fundacionales
20260616120000_add_gastos           → gastos operativos
20260616140000_add_variants_iva     → ProductVariant, iva_enabled, is_available
20260616183852_add_orders_delivery  → Order, OrderItem, delivery config
```

---

## DECISIONES SELLADAS

| Decisión | Valor |
|----------|-------|
| Stack | Next.js 14 + TypeScript + CSS Modules + Prisma 7 |
| Sin tenant/branch v1 | Un negocio = una instalación |
| Paradigma venta | qty × price — NUNCA monto→qty |
| Fórmula precio | costo + margen% → sistema calcula |
| Moneda | USD interno, Bs al cobrar, BCV auto |
| Sin SENIAT v1 | Ticket térmico propio |
| CSS | CSS Modules — cero Tailwind |
| Iconos | Lucide React — cero emojis |
| Sidebar | Siempre oscuro en dark Y light |
| PIN cajero | 4 dígitos para descuentos |
| Storage | Local /uploads/ — Cloudinary descartado |
| Commits | Siempre con identidad CLI + push en cada entrega |

---

## PRÓXIMOS SPRINTS

### Sprint 6 — Certificación End-to-End
- CLI-A: deploy VPS con todas las migraciones
- CLI-B: flujo completo localhost (abrir caja→venta→cobro→ticket)
- CLI-C: /code-review ultra + /security-review OWASP
- CLI-D: /webapp-testing Playwright flujo POS completo

### Sprint 7 — Catálogo Digital MVP
- Subdominio negocio.activopos.com
- Vitrina pública productos (show_in_catalog=true)
- QR personalizable
- Integración LLEVA.app
- Plan Catálogo Activo ($25/mes)

### Sprint 8 — Crédito Avanzado
- Límite de crédito por cliente
- Alertas al cajero
- Reporte cartera vencida

### Sprint 9 — N8N Automatizaciones
- BCV automático via N8N
- WhatsApp al dueño al cerrar caja
- Reporte diario 8PM
- Backup DB nocturno

### Sprint 10 — PWA Avanzado
- Offline mode + sync
- Push notifications stock bajo
- Instalable en tablet Android

### Sprint 11 — Primer Cliente
- /launch-ready checklist
- Demo con primer cliente
- Onboarding negocio real

### Sprint 12 — Fiscal (futuro, si cliente lo pide)
- IVA avanzado con declaraciones
- Impresora fiscal HKA
- SENIAT homologación

---

## BACKLOG COMPLETO

### V1.1 — Post-lanzamiento
- Recarga por concepto (servicios recurrentes)
- Devoluciones por ítem individual
- Export Excel de reportes
- Búsqueda global en Header

### V2 — Crecimiento
- Multi-sucursal plan Pro
- Dashboard consolidado multi-sede
- App móvil React Native

### V3 — Expansión
- API pública para terceros
- IA: predicción stock, sugerencias precio
- Marketplace integraciones bancarias

---

## COMPETIDORES

| App | Precio | Debilidad vs ActivoPOS |
|-----|--------|----------------------|
| Negotiale | $20/mes | Sin POS mostrador real |
| Venko | ~$25/mes | Firebase sin backend real |
| Pulpos | Variable | Sin BCV venezolano |
| Fina | $30/mes | Sistema admin, NO es POS |

**Diferenciadores únicos:**
- Variantes talla/color — ningún competidor venezolano lo tiene
- IVA configurable
- Pedidos kanban + delivery integrado
- Catálogo digital con LLEVA.app
- Ecosistema SYNTIdev completo

---

## INFRAESTRUCTURA

```
VPS: 187.124.241.213
  3001: Uptime Kuma
  3002: SportBar ← SOLO LECTURA
  3003: ActivoPOS ← ACTIVO
  5678: N8N ← disponible sin usar

GitHub: github.com/syntidev/activopos
Local: C:\laragon\www\activopos\

NUNCA tocar: synticorex, syntimeat
```

## WORKFLOW DIARIO

```
INICIO: git pull + npm run dev
DESARROLLO: 4 CLIs paralelos (A=backend B=frontend C=quality D=features)
CADA CLI: npm run build → commit con identidad → push
FIN JORNADA VPS: git pull → migrate deploy → npm run build → pm2 restart
```

---

*ActivoPOS · SYNTIdev · activopos.com*
*"El POS para negocios que andan activos"*
*16 Junio 2026 · Commit: adf748e*
