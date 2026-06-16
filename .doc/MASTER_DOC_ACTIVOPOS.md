# MASTER DOC — ActivoPOS
# Fuente de verdad del proyecto
# Versión: 1.0 | Junio 2026 | Carlos Bolívar — SYNTIdev
# ⚠️ Leer completo antes de cualquier sesión de desarrollo

---

## 1. VISIÓN DEL PRODUCTO

ActivoPOS es el sistema de punto de venta SaaS diseñado nativamente para el comercio venezolano.
No es un POS genérico adaptado. Es un producto construido desde cero para la realidad del mercado:
dualidad USD/Bolívares, tasa BCV automática, métodos de pago venezolanos (Pago Móvil, Zelle, Binance USDT),
y una experiencia de uso fluida para bodegas, tiendas, cafés, boutiques y cualquier PYME activa.

**Tagline:** El POS para negocios que andan activos.
**Dominio:** activopos.com

### Propuesta de valor única

Mientras Negotiale es el primer POS venezolano (básico, sin analytics, sin ecosistema)
y Pulpos es maduro pero mexicano (sin BCV, sin Pago Móvil), ActivoPOS es el único sistema que integra:

- POS físico de mostrador (como SYNTImeat, probado en producción real)
- Catálogo digital con vitrina web (Fase 2 — Ordena.menu/LLEVA)
- Analytics de demanda del negocio (Pulso del Negocio — Fase 2)
- Ecosistema SYNTIdev (POS + SYNTIweb en un mismo universo)

---

## 2. ARQUITECTURA DE DOMINIOS

| Dominio/Subdominio     | Propósito                               | Estado       |
|------------------------|-----------------------------------------|--------------|
| activopos.com          | App principal (login → dashboard)       | ✅ Comprado   |
| app.activopos.com      | Alias para la app (futuro)              | Pendiente    |
| nombre.activopos.com   | Catálogo digital del cliente (Fase 2)   | Pendiente    |
| admin.activopos.com    | Panel super_admin (Filament — futuro)   | Pendiente    |

---

## 3. STACK TÉCNICO — SELLADO

| Capa          | Tecnología                            | Justificación                                      |
|---------------|---------------------------------------|---------------------------------------------------|
| Framework     | Next.js 14 (App Router)               | SportBar lo usa y está en producción. PWA nativa. |
| Lenguaje      | TypeScript 5.x (strict)               | Sin `any`. Tipos en todo.                         |
| Estilos       | CSS Modules + design tokens           | Control total del pixel. Sin AI slop.             |
| Animaciones   | Framer Motion 12.x                    | Microinteracciones nivel Linear/Stripe.           |
| Componentes   | Radix UI (sin shadcn)                 | Accesibilidad sin estilos impuestos.              |
| Iconos        | Lucide React                          | Mismo que SportBar y SYNTImeat.                   |
| ORM           | Prisma 5.x                            | MySQL tipado y seguro.                            |
| DB            | MySQL en VPS compartido               | Misma instancia que SportBar.                     |
| Auth          | jose (JWT HS256) + bcryptjs           | Mismo patrón que SportBar.                        |
| Realtime      | Supabase FREE (Broadcast bus)         | Solo WebSocket. No guarda datos.                  |
| Validación    | zod 4.x                               | API routes tipadas y seguras.                     |
| Deploy        | PM2 + Nginx en VPS                    | Misma infra que SportBar.                         |
| Imágenes      | sharp                                 | Optimización servidor.                            |

**VPS:** 187.124.241.213 — 4GB RAM / 2 CPU / 50GB
**Puerto ActivoPOS:** 3001 (SportBar usa 3002)

---

## 4. ACTORES DEL SISTEMA

| Actor       | Código     | Acceso                              | Función                                    |
|-------------|------------|-------------------------------------|--------------------------------------------|
| Super Admin | (oculto)   | Sistema completo — todos los tenants| Solo Carlos Bolívar                        |
| Admin       | ADM-XXX    | Todo el negocio propio              | Dueño del negocio — configura, reporta     |
| Cajero      | CAJ-XXX    | POS, Caja, Clientes, Cotizaciones   | Operación de mostrador                     |

---

## 5. MODELO DE NEGOCIO

### Planes de monetización

| Plan            | Precio    | Incluye                                              |
|-----------------|-----------|------------------------------------------------------|
| Base Mostrador  | $15/mes   | POS, Inventario, Caja, 2 usuarios, BCV, ticket       |
| Catálogo Activo | $25/mes   | Todo Base + vitrina nombre.activopos.com + QR        |
| Pro Pulso       | $35/mes   | Todo Catálogo + analytics + usuarios ilimitados      |

**Meta conservadora:** 30 clientes × $20/mes promedio = $600 MRR en 3 meses post-lanzamiento.

### Sin precios en la landing

La landing NO muestra precios. Solo CTAs de WhatsApp con mensajes pre-escritos por plan.
Número: Carlos Bolívar (WhatsApp Business)

---

## 6. FLUJOS NÚCLEO

### Flujo A — Venta directa (POS)

```
Cajero abre POS → caja activa requerida
  → Busca/selecciona producto
  → Ingresa cantidad (kg o unidades) — NUNCA monto en Bs
  → Sistema calcula: qty × price_usd × rate_bcv = total_bs
  → Agrega al ticket
  → Modal cobro: selecciona método(s) de pago
  → Si efectivo: ingresa monto → sistema calcula cambio
  → Si Pago Móvil/Zelle: ingresa referencia
  → Confirmar → sale.status = 'paid'
  → Descuenta inventario automáticamente
  → Ticket: imprimir / WhatsApp / PDF
```

### Flujo B — Cotización

```
Cajero/Admin crea cotización (sale.status = 'quote')
  → NO descuenta stock
  → Genera ticket PDF o WhatsApp con número VEN-XXXXX
  → Cliente confirma → cajero convierte a venta
  → sale.status → 'paid' → descuenta stock → cobro
```

### Flujo C — Venta a crédito

```
Cajero crea venta → cliente sin pago completo
  → sale.status = 'pending' (crédito)
  → Descuenta stock al confirmar (no al pagar)
  → Cliente abona parcialmente → SaleAbono records
  → Al completar → sale.status = 'paid'
  → Visible en CxC del módulo Finanzas
```

### Flujo D — Caja

```
Admin/Cajero abre turno → fondos iniciales por método (Bs + USD)
  → Ventas del turno se acumulan por método de pago
  → Movimientos manuales (retiros, ingresos)
  → Al cierre: conteo físico vs sistema
  → Sistema detecta diferencias → nota de cierre
  → Historial de cierres disponible
```

---

## 7. MÓDULOS — SIDEBAR DEFINITIVO

```
PRINCIPAL
  Escritorio          ← Dashboard KPIs, gráficas, alertas

VENTAS
  Punto de Venta      ← POS completo
  Cotizaciones        ← Gestión de cotizaciones
  Clientes            ← CRM básico + crédito

INVENTARIO
  Productos           ← Catálogo + stock unificado (como Bind)
  Devoluciones        ← Historial de devoluciones

CAJA
  Gestión de Caja     ← Turno, movimientos, cuadre, cierre
  Reportes            ← Diario, mensual, export PDF/Excel

FINANZAS
  Finanzas            ← P&L, CxC, CxP (admin only)

─────────────────
ADMINISTRACIÓN
  Usuarios            ← CRUD usuarios + roles (admin only)
  Configuración       ← Negocio, pagos, ticket, tema (admin only)
  Ayuda               ← Centro de ayuda + WhatsApp soporte
```

**Total: 11 ítems de navegación · 5 grupos**

---

## 8. COMPETIDORES ANALIZADOS

| Competidor    | Mercado  | Precio | Fortaleza               | Debilidad vs ActivoPOS           |
|---------------|----------|--------|-------------------------|----------------------------------|
| Negotiale     | Venezuela| $20/mes| POS básico + BCV        | Sin analytics, sin ecosistema    |
| Venko         | Venezuela| Firebase| UI limpia, finanzas    | Sin backend real, sin BCV robusto|
| Pulpos        | México   | MXN    | POS maduro              | Sin BCV, sin Pago Móvil          |
| Control Total | LATAM    | $3-30  | Cotizaciones, WhatsApp  | No es POS real, sin inventario   |
| Bind          | México   | —      | Catálogo+Inventario=1   | Sin Venezuela, sin BCV           |

**Diferenciador real de ActivoPOS:** Stack Next.js production-grade + lógica POS certificada en producción real (SYNTImeat 209 productos, 3 sucursales, partido en vivo SportBar) + ecosistema SYNTIdev.

---

## 9. ECOSISTEMA SYNTI.DEV

```
SYNTIweb   → synticorex  [NUNCA TOCAR] → 20 tenants activos
SYNTImeat  → syntimeat   [SOLO LECTURA] → Carnicería Chaguaramas (producción)
SportBar   → sportbar    [SOLO LECTURA] → tusport.bar (producción)
ActivoPOS  → activopos   [PROYECTO ACTIVO] → activopos.com
MecaFlow   → (separado)  → Taller mecánico (producción)
SocialIA   → (separado)  → Uso interno
```

### Relación con SportBar

SportBar es el hermano mayor de ActivoPOS en Next.js.
- Mismo stack, misma infra, mismo VPS, mismo patrón de deploy
- SportBar resolvió el paradigma correcto de venta (qty × price)
- ActivoPOS hereda la arquitectura de componentes y los tokens de diseño
- En el futuro: SportBar se convierte en el módulo "venues/eventos" de ActivoPOS

---

## 10. REGLAS DE ORO DEL PROYECTO

1. **El cajero nunca hace aritmética** — el sistema calcula siempre
2. **Sin branch_id en v1** — un negocio, una caja, un catálogo
3. **Moneda en USD interna** — Bs al cobrar (price_usd × rate)
4. **Inventario descuenta solo al pagar** — tickets abiertos no afectan stock
5. **Paradigma de venta: qty × price** — NUNCA monto → qty (esto es la basura de SYNTImeat)
6. **CSS Modules siempre** — cero Tailwind, cero colores hardcodeados
7. **TypeScript strict** — cero `any`
8. **Eager loading Prisma** — cero N+1
9. **Acción crítica visible sin scroll** — touch targets mínimo 44px
10. **NUNCA tocar synticorex** — es sagrado

---

## 11. DOCUMENTOS DE REFERENCIA

| Documento            | Ubicación                                   | Propósito                      |
|----------------------|---------------------------------------------|--------------------------------|
| CLAUDE.md            | /activopos/ (raíz)                          | Gobernanza de agentes          |
| AGENTS.md            | /activopos/ (raíz)                          | Orquestación de agentes        |
| SYSTEM_MAP.md        | /activopos/.doc/                            | Estado actual del sistema      |
| DB_SCHEMA.md         | /activopos/.doc/                            | Modelo de datos canónico       |
| ROADMAP_MAESTRO.md   | /activopos/.doc/                            | Plan de desarrollo por sprints |
| DESIGN_SYSTEM.md     | /activopos/.doc/                            | Tokens, componentes, visual    |
| BRAND_PLAYBOOK.md    | /activopos/.doc/                            | Identidad de marca             |
| SESSION_HANDOFF_*    | /activopos/.doc/                            | Handoffs de sesión             |

---

## 12. DECISIONES TOMADAS (NO RENEGOCIAR)

| # | Decisión                         | Razón                                              |
|---|----------------------------------|----------------------------------------------------|
| 1 | Stack: Next.js, no Laravel       | SportBar lo validó en producción. Carlos lo domina.|
| 2 | Sin branch_id en v1              | Complejidad injustificada para el mercado inicial  |
| 3 | Catálogo + Inventario = 1 módulo | Bind lo demostró. Menos saltos de menú.            |
| 4 | Cotizaciones como módulo propio  | El mercado de servicios lo necesita               |
| 5 | Catálogo digital en Fase 2       | Primero el POS core. No correr antes de caminar.   |
| 6 | qty × price — NUNCA bs→qty       | La monstruosidad de SYNTImeat no se repite        |
| 7 | Un dominio, login diferencia     | Sin subdominio por cliente en v1                   |
| 8 | Tema: negocio elige              | Dark/light configurable en Configuración           |
| 9 | Métodos de pago venezolanos base | Efectivo Bs/USD, PM, Zelle, Transferencia, Binance |

---

*ActivoPOS — syntidev — activopos.com*
*Carlos Bolívar — Valle de la Pascua, Venezuela — Junio 2026*
