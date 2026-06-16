# SYSTEM_MAP — ActivoPOS
# Estado actual del sistema — actualizar en cada sesión
# Versión: 0.1 | Junio 2026 | PROYECTO INICIANDO

---

## 1. ENTORNO

| Campo         | Valor                                          |
|---------------|------------------------------------------------|
| URL prod      | https://activopos.com                          |
| VPS           | 187.124.241.213 — PM2 proceso `activopos` puerto 3001 |
| DB            | MySQL · `activopos` @ 127.0.0.1:3306          |
| Repo          | github.com/syntidev/activopos                  |
| Local         | C:\laragon\www\activopos\                      |
| Versión       | 0.1 — Setup inicial                            |
| Commit actual | — (proyecto sin inicializar)                   |

### Stack

| Capa        | Tecnología                                          |
|-------------|-----------------------------------------------------|
| Framework   | Next.js 14.x · React 18 · TypeScript 5.x (strict)  |
| Estilos     | CSS Modules · tokens.css · sin Tailwind             |
| Animaciones | Framer Motion 12.x                                  |
| Componentes | Radix UI · Lucide React                             |
| ORM         | Prisma 5.x · MySQL                                  |
| Auth        | jose (JWT HS256) · bcryptjs                         |
| Realtime    | Supabase FREE tier (Broadcast bus)                  |
| Deploy      | PM2 + Nginx + Cloudflare + SSL                      |

### Deploy

```bash
cd /var/www/activopos && git pull && npx prisma migrate deploy && npm run build && pm2 restart activopos
```

---

## 2. ÁRBOL DE RUTAS

### App (planeado)

```
/                       → redirect a /login o /escritorio
/(auth)/
  /login                → Login con email + password
/(dashboard)/
  /escritorio           → Dashboard KPIs
  /pos                  → Punto de Venta
  /cotizaciones         → Gestión de cotizaciones
  /clientes             → Directorio de clientes
  /productos            → Inventario + Catálogo unificado
  /caja                 → Gestión de Caja
  /reportes             → Reportes y análisis
  /finanzas             → Estado de resultados, CxC, CxP
  /configuracion        → Config del negocio
    /configuracion/negocio
    /configuracion/usuarios
    /configuracion/pagos
    /configuracion/ticket
    /configuracion/tema
```

### API (planeado)

```
/api/auth/login
/api/auth/logout
/api/auth/me
/api/rates/bcv           → Tasa BCV actual
/api/products            → CRUD productos
/api/sales               → Crear/listar ventas
/api/sales/[id]/pay      → Cobrar ticket
/api/sales/[id]/void     → Anular (admin)
/api/cash/open           → Abrir turno
/api/cash/close          → Cerrar turno
/api/cash/movement       → Movimiento de caja
/api/clients             → CRUD clientes
/api/reports/daily       → Reporte del día
/api/reports/monthly     → Reporte mensual
/api/inventory           → Entradas de inventario
```

---

## 3. ESTADO DE MÓDULOS

| Módulo          | Estado        | Sprint | Notas                            |
|-----------------|---------------|--------|----------------------------------|
| Setup inicial   | ⏳ Pendiente  | 1      | npx create-next-app + config     |
| Design tokens   | ⏳ Pendiente  | 1      | tokens.css, dark/light themes    |
| Auth (login)    | ⏳ Pendiente  | 1      | JWT, middleware, session         |
| AppLayout       | ⏳ Pendiente  | 1      | Sidebar, header, navegación      |
| Design System   | ⏳ Pendiente  | 2      | Button, Input, Badge, Card, Table|
| BCV Service     | ⏳ Pendiente  | 2      | API rate + fallback              |
| Productos       | ⏳ Pendiente  | 2      | CRUD + inventario unificado      |
| Punto de Venta  | ⏳ Pendiente  | 3      | Grid, ticket, cobro              |
| Cotizaciones    | ⏳ Pendiente  | 3      | quote → paid flow                |
| Clientes        | ⏳ Pendiente  | 3      | CRM básico + crédito             |
| Gestión de Caja | ⏳ Pendiente  | 4      | Turno, cuadre, historial         |
| Reportes        | ⏳ Pendiente  | 4      | Diario, mensual, export          |
| Finanzas        | ⏳ Pendiente  | 4      | P&L básico, CxC, CxP            |
| Configuración   | ⏳ Pendiente  | 5      | Negocio, usuarios, tema, pagos   |
| Onboarding      | ⏳ Pendiente  | 5      | Setup inicial del negocio        |

---

## 4. MODELOS DB

Ver .doc/DB_SCHEMA.md para el esquema completo.

### Estado de migraciones

| Migración | Estado    | Tabla(s)         |
|-----------|-----------|------------------|
| —         | Pendiente | Proyecto sin init|

---

## 5. CERTIFICACIÓN

| Área           | Estado     |
|----------------|------------|
| Setup proyecto | ⏳ Pendiente|
| Auth flow      | ⏳ Pendiente|
| POS completo   | ⏳ Pendiente|
| Caja           | ⏳ Pendiente|
| Deploy VPS     | ⏳ Pendiente|

---

## 6. DEUDA TÉCNICA

*(ninguna aún — proyecto sin iniciar)*

---

## 7. REGLAS CRÍTICAS — NO VIOLAR

### TypeScript
- `strict: true` — nunca `any`
- Early return obligatorio
- Eager loading Prisma — cero N+1

### Moneda
- El negocio opera cobrando en Bs al cliente
- price_usd × rate_bcv = total_bs
- NUNCA bloquear venta por falta de tasa — usar fallback

### Paradigma de venta (irrompible)
- Cajero ingresa CANTIDAD — sistema calcula precio
- NUNCA al revés (monto → qty) — esto es la basura de SYNTImeat que NO va aquí

### Sin branches
- Cero branch_id en tablas transaccionales
- Un negocio, una caja, un catálogo

---

## 8. TAGS DE RESTAURACIÓN

*(ninguno aún)*

---

## 9. REFERENCIAS

- SportBar (arquitectura base): C:\laragon\www\sportbar\ [SOLO LECTURA]
- SYNTImeat (lógica POS referencia): C:\laragon\www\syntimeat\ [SOLO LECTURA]
- SYNTIweb: C:\laragon\www\synticorex\ [NUNCA TOCAR]

---

*Actualizar este archivo al completar cada módulo o sprint.*
*Generado: Junio 2026 | ActivoPOS v0.1*
