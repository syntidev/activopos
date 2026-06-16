# CLAUDE.md — ActivoPOS
# Instrucciones maestras para Claude Code y todos los agentes
# ⚠️ LEER COMPLETO ANTES DE CUALQUIER ACCIÓN
# Versión: 1.0 | Junio 2026 | Carlos Bolívar — SYNTIdev

---

## 🚦 GOBERNANZA — LEER PRIMERO, SIEMPRE

### Modos de operación

| MODO      | Palabra clave | Qué hacer                          | PROHIBIDO                              |
|-----------|---------------|------------------------------------|----------------------------------------|
| CONSULTA  | [CONSULTA]    | Responder en ≤5 líneas, sin código | Abrir archivos, escribir código        |
| DISEÑO    | [DISEÑO]      | Proponer arquitectura              | Implementar, tocar archivos            |
| EJECUCIÓN | [EJECUTA]     | Implementar lo acordado            | Inferir cambios fuera del scope        |
| REVISIÓN  | [REVISA]      | Auditar código existente           | Proponer refactors no solicitados      |
| DEBUG     | [DEBUG]       | Diagnosticar SOLO el error         | Tocar código fuera del scope           |

**Si el modo no está declarado → preguntar: "¿Modo CONSULTA, DISEÑO o EJECUCIÓN?" y PARAR.**
**NUNCA asumir modo EJECUCIÓN por defecto.**

### Protocolo anti-deriva (irrompible)

Antes de cada respuesta verificar internamente:
1. ¿Me pidieron código? → Solo entonces escribo código
2. ¿El scope es claro? → Si no, preguntar en UNA línea y parar
3. ¿Voy a modificar algo fuera de lo pedido? → PARAR
4. ¿Encontré un bug fuera del scope? → Reportar en 1 línea, NO corregir

**Límites duros:**
- NUNCA abrir archivos adicionales sin permiso explícito
- NUNCA proponer "ya que estoy aquí, también arreglé..."
- NUNCA continuar después de completar el pedido
- Máximo 1 archivo modificado por request salvo instrucción explícita

---

## 🏗️ PROYECTO

**ActivoPOS** — Sistema POS SaaS para PYMES venezolanas.
**Dominio:** activopos.com
**Local:** C:\laragon\www\activopos\
**VPS:** 187.124.241.213 (compartido con SportBar) | Puerto: 3001
**Repo:** github.com/syntidev/activopos
**Deploy:** PM2 + Nginx + Cloudflare + SSL

---

## 🔧 STACK SELLADO — NO NEGOCIABLE

```
Next.js 14.x       → Framework principal (App Router)
TypeScript 5.x     → Strict mode, nunca `any`
CSS Modules        → Sin Tailwind, sin styled-components
Prisma 5.x         → ORM sobre MySQL
MySQL              → misma instancia VPS, DB: activopos
jose               → JWT HS256
bcryptjs           → Hash de passwords
Framer Motion 12.x → Animaciones e microinteracciones
Radix UI           → Componentes accesibles sin estilos
Lucide React       → Iconos únicamente — NUNCA emojis en UI
Supabase FREE      → Broadcast bus (realtime) — NO guarda datos
sharp              → Optimización de imágenes
zod 4.x            → Validaciones
xlsx               → Importación de productos
```

**Referencia de arquitectura:** C:\laragon\www\sportbar\ (SOLO LECTURA — nunca modificar)

---

## 🚨 REGLAS CRÍTICAS — NUNCA VIOLAR

### TypeScript
- `strict: true` en tsconfig — NUNCA `any`
- Tipos explícitos en todos los props, returns y parámetros
- Zod para validación de inputs en API routes
- Interfaces en `src/types/` — nunca tipos inline en componentes

### CSS Modules
- SOLO CSS Modules (`*.module.css`) — cero Tailwind, cero inline styles
- Design tokens en `src/styles/tokens.css` — cero valores hardcodeados
- Variables CSS: `var(--color-brand)`, `var(--spacing-md)`, etc.
- Dark/Light: clase `.dark` en `<html>` — tokens se adaptan automáticamente
- NUNCA colores hexadecimales directos en componentes

### Next.js App Router
- Server Components por defecto — Client solo con `'use client'` justificado
- Lógica de negocio en API routes (`/app/api/`) — NUNCA en componentes
- Eager loading en Prisma — cero N+1 toleradas
- `include:` siempre definido en queries con relaciones

### Moneda — CRÍTICO
- Precios definidos en USD (`price_usd`) — referencia interna
- Al cobrar: `price_usd × rate_bcv = total_bs` — el cliente paga en Bs.
- Ticket al cliente siempre muestra Bs. — NUNCA dólares al cliente
- En DB guardar siempre: `price_usd` + `rate_used` + `total_bs`
- Tasa BCV: `dollar_rates` table — fallback a última disponible
- NUNCA bloquear venta por falta de tasa — usar fallback

### Venta — PARADIGMA CORRECTO (irrompible)
- Cajero selecciona producto → ingresa CANTIDAD (kg o unidades)
- Sistema calcula: `qty × price_usd × rate = total_bs`
- NUNCA el cajero ingresa monto en Bs para back-calcular cantidad
- `sale_mode = weight` → input decimal (kg) → `qty × price_per_kg_usd`
- `sale_mode = unit`   → input entero (und) → `qty × price_per_unit_usd`
- El operador NUNCA hace aritmética — el sistema calcula solo

### Inventario
- Stock descuenta SOLO cuando `sale.status = 'paid'`
- Tickets abiertos NO afectan el stock
- `net_qty = quantity - waste` (campo VIRTUAL en DB)

### Auditoría
- Toda anulación registra en `activity_logs`: user_id, motivo, timestamp
- Solo rol `admin` puede anular — motivo obligatorio (mínimo 10 chars)
- Toda acción crítica: cambio de precio, ajuste de inventario, cierre de caja

### Arquitectura sin branches
- NO existe `branch_id` en ninguna tabla transaccional
- Un negocio = un tenant = una instalación
- Multi-sucursal es feature de fase 2 (plan Pro futuro)

---

## 👥 ROLES DEL SISTEMA

| Rol         | Acceso                                              | Restricciones                        |
|-------------|-----------------------------------------------------|--------------------------------------|
| super_admin | Todo el sistema — oculto al cliente                 | Solo Carlos Bolívar                  |
| admin       | Todo excepto super_admin — el dueño del negocio     | No puede ver otros tenants           |
| cashier     | POS, Caja, Clientes, Cotizaciones, anular propias   | Sin costos, sin finanzas, sin config |

---

## 🗂️ ESTRUCTURA DEL PROYECTO

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── (dashboard)/
│   │   ├── layout.tsx          ← AppLayout con sidebar
│   │   ├── page.tsx            ← Escritorio (Dashboard)
│   │   ├── pos/                ← Punto de Venta
│   │   ├── cotizaciones/       ← Cotizaciones
│   │   ├── clientes/           ← Clientes
│   │   ├── productos/          ← Inventario + Catálogo unificado
│   │   ├── caja/               ← Gestión de Caja
│   │   ├── reportes/           ← Reportes
│   │   ├── finanzas/           ← Finanzas
│   │   └── configuracion/      ← Configuración
│   └── api/
│       ├── auth/
│       ├── sales/
│       ├── products/
│       ├── cash/
│       ├── clients/
│       ├── reports/
│       └── rates/
├── components/
│   ├── ui/                     ← Primitives: Button, Input, Badge, Card...
│   ├── layout/                 ← Sidebar, Header, AppLayout
│   ├── pos/                    ← Componentes del POS
│   ├── cash/                   ← Componentes de Caja
│   └── shared/                 ← Componentes compartidos
├── lib/
│   ├── prisma.ts               ← Cliente Prisma singleton
│   ├── auth.ts                 ← JWT helpers
│   ├── bcv.ts                  ← BCV rate service
│   └── supabase.ts             ← Broadcast bus
├── styles/
│   ├── tokens.css              ← Design tokens (colores, spacing, tipografía)
│   ├── globals.css             ← Reset y estilos base
│   └── themes/
│       ├── dark.css            ← Tokens dark mode
│       └── light.css           ← Tokens light mode
└── types/
    ├── index.ts                ← Tipos globales
    ├── api.ts                  ← Tipos de respuestas API
    └── prisma.ts               ← Tipos extendidos de Prisma
```

---

## 💱 BCV SERVICE

```typescript
// src/lib/bcv.ts
// Consulta ve.dolarapi.com/v1/dolares/oficial
// Fallback: última tasa en dollar_rates table
// Cache: 1 hora en memoria
// NUNCA bloquear operación por falta de tasa
const FALLBACK_RATE = 36.50 // Actualizar manualmente si API falla
```

---

## 🎨 DISEÑO

- **Tema:** El negocio elige (dark/light) en Configuración — persiste en `businesses.theme`
- **Fuente:** Inter via `next/font/google`
- **Iconos:** Lucide React únicamente
- **Animaciones:** Framer Motion — máximo 300ms, `prefers-reduced-motion` respetado
- **Touch targets:** mínimo 44px de altura en elementos interactivos
- **Acción crítica visible sin scroll siempre**

---

## ✅ CHECKLIST PRE-ENTREGA

- [ ] TypeScript strict — cero `any`
- [ ] CSS Modules — cero Tailwind, cero inline
- [ ] Variables CSS de tokens — cero hex hardcodeados
- [ ] Server Components por defecto — `'use client'` justificado
- [ ] Eager loading en Prisma — cero N+1
- [ ] Zod validación en API routes
- [ ] Paradigma de venta correcto (qty × price, NUNCA bs → qty)
- [ ] Sin branch_id en tablas transaccionales
- [ ] Moneda: price_usd × rate = total_bs al cobrar
- [ ] Máximo 1 archivo modificado salvo instrucción explícita

---

## 🚀 COMANDOS CLAVE

```bash
# Setup inicial
npm install
npx prisma generate
npx prisma migrate dev

# Desarrollo
npm run dev         # Next.js dev server puerto 3001

# Build producción
npm run build
npm start

# Deploy VPS
cd /var/www/activopos && git pull && npx prisma migrate deploy && npm run build && pm2 restart activopos

# Prisma Studio
npx prisma studio

# Ver logs producción
pm2 logs activopos --lines 50
```

---

## 🔗 REFERENCIAS

- SportBar (arquitectura base): C:\laragon\www\sportbar\ [SOLO LECTURA]
- SYNTIweb (ecosistema): C:\laragon\www\synticorex\ [NUNCA TOCAR]
- SYNTImeat (referencia lógica POS): C:\laragon\www\syntimeat\ [SOLO LECTURA]
- Docs del proyecto: C:\laragon\www\activopos\.doc\
