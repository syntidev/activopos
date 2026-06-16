# PLAN MAESTRO — ActivoPOS
# Estado real + Ruta módulo a módulo
# Actualizado: 16 Junio 2026 — Sesión fundacional completa

---

## CONTEXTO DEL ARQUITECTO

Carlos viene de 10 años fuera de Venezuela. Regresa con visión global,
experiencia bancaria de 20+ años, y la capacidad de construir lo que el
mercado local necesita con estándares que el mercado local no tiene.
La investigación de competidores (Negotiale, Pulpos, Control Total, Venko)
no es copia — es inteligencia para construir algo mejor con identidad propia.

---

## ✅ COMPLETADO — SESIÓN DE HOY

| # | Entregable | Notas |
|---|-----------|-------|
| 1 | Next.js 14 + TypeScript + CSS Modules | Stack sellado |
| 2 | Prisma 7 + adapter-mariadb + MySQL | 14 tablas migradas |
| 3 | BCV Service live (587.40 Bs) | ve.dolarapi.com + fallback |
| 4 | /api/rates/bcv funcionando | Responde en <200ms |
| 5 | Auth completo | JWT + middleware + roles |
| 6 | Seed: admin + cajero + 6 métodos de pago | DB lista |
| 7 | Login page | Dark card, Framer Motion, toggle password |
| 8 | Sidebar | Grupos, BCV live, drawer móvil, spring animation |
| 9 | Header | Toggle tema, BCV pill, badge rol, avatar |
| 10 | AppLayout | Grid sidebar+main, responsive |
| 11 | Escritorio | KPIs reales de DB, trend badges, Suspense streaming |
| 12 | Toggle dark/light | localStorage persistente |
| 13 | tokens.css + globals.css | 436 líneas, 100% tokenizado |
| 14 | .doc/ completo | 8 documentos fundacionales |
| 15 | Intel competitiva completa | Negotiale, Pulpos, Control Total, Venko |

---

## LECCIONES CLAVE DE VENKO (adoptadas)

**Fórmula de precio de productos:**
`Costo ($)` + `Margen (%)` → sistema calcula `Precio Venta ($)` + `Utilidad Estimada ($)` en tiempo real.
Toggle `Usar Precios Fijos` para override manual. Mucho mejor que precio directo.

**Modal de cobro:**
Toggle `¿Pago Mixto?` + Calculadora de Vuelto USD/BS en el mismo modal.
Métodos como cards grandes con icono — no lista desplegable.

**Gestión de Caja:**
Pantalla única que muestra estado cerrado/abierto.
Fondos iniciales USD + Bs + Nota de turno → "Iniciar Turno".
Movimientos con Tipo Divisa (USD/Bs) + Tipo (Retiro/Entrada) + Monto + Motivo.
Historial de cierres con columnas: Ventas Turno, Efectivo Esperado, Contado, Diferencia.

**Configuración de Impresión:**
3 formatos: Tamaño Carta (Cotización), Ticket 80mm, Ticket 58mm.
3 opciones de moneda en recibo: Ambas (USD+Bs), Solo USD, Solo Bs.
Toggle "Ocultar Tasa de Cambio" en pie de recibo.

**Usuarios:**
PIN de autorización para descuentos de empleados (4 dígitos). Inteligente para control de cajeros.
Dos roles visibles: Empleado / Administrador.

**Centro de Ayuda:**
Grid de cards por módulo + buscador + WhatsApp soporte + reiniciar tour.
AI contextual que responde sobre el sistema Y sobre los datos del negocio.

**Lo que NO adoptamos de Venko:**
- Firebase como backend (sin persistencia real)
- Pesos COP como moneda (innecesario para mercado objetivo v1)
- Glassmorphism y paleta violeta/morada

---

## 🔨 PRÓXIMOS SPRINTS — ORDEN EXACTO

### SPRINT 2 — Productos (próximo en CLI-A + CLI-B)

**CLI-A — API + lógica:**
```
/api/products         → CRUD completo con Zod
/api/categories       → CRUD categorías
/api/products/import  → Import masivo XLSX
/api/inventory        → Entradas de inventario
```

**Modelo de precio a implementar (Venko-inspired):**
```typescript
// El sistema calcula — el usuario solo ingresa costo y margen
const precio_venta = costo / (1 - margen/100)
const utilidad_estimada = precio_venta - costo

// Toggle precio fijo: el usuario overridea el precio calculado
// sale_mode: 'unit' | 'weight' | 'service'
// product_type: 'physical' | 'service' | 'intangible'
```

**CLI-B — UI:**
```
/productos/page.tsx     → Tabla: Producto, Precio REF, Precio Bs, Stock, Utilidad, Acciones
Modal Nuevo Producto:
  - Nombre, SKU/Barcode, Categoría
  - Vendido por (Unidad / Kg / Servicio)
  - Ingresar Costo Por: Unidad / Bulto
  - Costo Unitario ($)
  - Toggle "Usar Precio Fijo"
  - Margen (%) → Precio Venta ($) calculado en tiempo real
  - Utilidad Estimada ($) — card verde
  - Stock inicial
Modal Reporte de Inventario: por categorías
Modal Migración: descarga plantilla + upload XLSX
Modal Generar Etiquetas: Todo / Por Categoría / Búsqueda actual
Buscador + filtro por categoría
```

---

### SPRINT 3 — Punto de Venta (CORE)

```
Layout dos paneles: búsqueda+grid (izq) + ticket (der)
Buscador con scanner de cámara (html5-qrcode)
Grid vacío → "Escanea un código o escribe para buscar"
Panel ticket:
  - Cliente General / Cambiar cliente
  - Ítems con qty -, qty, qty+, precio USD, Bs
  - Botones: Descuento Global, Cargo Global
  - Total USD prominente + En Bs
  - 3 acciones: Procesar Pago / Venta a Crédito / Generar Cotización

Modal Cobro (Venko-inspired):
  - Toggle ¿Pago Mixto?
  - Calculadora de Vuelto: toggle USD/Bs + monto recibido
  - Métodos como cards grandes con icono
  - Notas de venta (40 chars máx)
  - Confirmación antes de cobrar

Modal Cotización:
  - Monedas a mostrar (USD, Bs — checkboxes)
  - Días de validez (default: 7)
  - Notas / Observaciones
  - Generar PDF / Imprimir

Modal Seleccionar Cliente:
  - Búsqueda por nombre o cédula
  - Botón + crear nuevo desde el POS
  - Aviso: "Debe seleccionar cliente para ventas a crédito"

Comprobante post-venta:
  - Ticket térmico 58/80mm (según config)
  - PDF descargable
  - WhatsApp directo (wa.me)
```

---

### SPRINT 4 — Clientes + Cotizaciones

```
Clientes:
  - Tabla: Cédula/RIF, Nombre, Dirección, Teléfono, Acciones
  - Modal Nuevo Cliente: nombre, cédula, dirección, teléfono, email
  - Búsqueda en tiempo real
  - Historial de compras por cliente
  - Saldo de crédito pendiente (CxC)

Cotizaciones (módulo separado en sidebar):
  - Lista de cotizaciones activas/expiradas/convertidas
  - Filtros: estado, fecha, cliente
  - Acción: Convertir en Venta (un click)
  - Acción: Reenviar por WhatsApp
  - Vista detalle expandible
```

---

### SPRINT 5 — Gestión de Caja

```
Pantalla principal (Venko-inspired):
  Estado cerrado: fondos iniciales USD + Bs + Nota → "Iniciar Turno y Abrir Caja"
  Estado abierto: 4 KPIs del turno
    - Fondos Iniciales (USD + Bs) con "Por: [nota]"
    - Ventas del Turno ($0.00 / Bs0.00 / N tickets)
    - Cobros de Crédito ($0.00 / N abonos)
    - Efectivo Esperado (USD + Bs) — incluye ventas + cobros efectivo
  Panel izquierdo: Movimientos de Caja + botón "Agregar Movimiento"
  Panel derecho: Declarar Cierre (conteo físico USD + Bs) + "Cerrar Caja" rojo

Modal Movimiento:
  - Tipo Divisa: USD / Bs
  - Tipo: Retiro-Salida / Ingreso-Entrada
  - Monto + Motivo (placeholder: "Pago proveedor, comprar hielo...")

Historial de Cierres (debajo o tab separado):
  Filtro por rango de fechas
  Columnas: Fecha, Usuario, Ventas Turno, Efectivo Esperado, Contado, Diferencia USD, Diferencia Bs

Ventas por Método de Pago (sección en turno activo):
  Desglose por método al cerrar
```

---

### SPRINT 6 — Reportes

```
Historial de Ventas (tabla):
  Filtros: Hoy / 7 Días / Mes + Filtros avanzados
  Columnas: Fecha, Orden ID, Cliente, Método, Total USD, Desc., Cargos, Total Bs, Notas, Utilidad
  Acción por fila: ver detalle expandido
  Exportar PDF

Detalle de Venta (expandido al click):
  Items, subtotales, método de pago, tasa usada, cajero

Devoluciones (módulo propio):
  Búsqueda por ID de venta
  Reintegra al inventario automáticamente
  Historial con rango de fechas: Fecha, Venta Original, Monto, Motivo
```

---

### SPRINT 7 — Dashboard Escritorio (completar)

```
Completar lo iniciado hoy:
  Análisis Detallado: selector Hoy/7días/30días/12meses
  Gráfica "Ventas últimos 30 días" (line chart)
  Gráfica "Ventas por método de pago" (pie/donut)
  Gráfica "Utilidad últimos 7 días" (bar chart)
  Contadores operativos: Total ventas hoy, Devoluciones hoy, Ventas a crédito hoy, Stock bajo
  Alertas CxC vencidas o por vencer (rojo)
  Alertas CxP vencidas o por vencer (naranja)
  Top 5 productos más vendidos (lista + bar horizontal)
```

---

### SPRINT 8 — Finanzas

```
4 KPIs: Ingresos Totales, Gastos Totales, Por Cobrar, Por Pagar
3 Tabs: Por Cobrar / Por Pagar / Ingresos-Gastos

CxC (Por Cobrar):
  Tabla: Cliente, Vencimiento, Total ($), Saldo ($), Estado, Acciones
  Acciones: registrar abono, marcar pagado, recordatorio WhatsApp
  Búsqueda por cliente

CxP (Por Pagar):
  Gastos operativos manuales: alquiler, nómina, proveedores
  Tabla similar a CxC

Estado de Resultados:
  KPIs: Ventas Netas, Utilidad Bruta, Gastos Operativos, Utilidad Neta
  Desglose contable:
    (+) Ventas Netas
    (-) Costo de Ventas (COGS)
    (=) Utilidad Bruta
    (-) Gastos Operativos (Fijos y Variables)
    (=) Utilidad Neta
  Insight Automático al fondo
  Selector Mes + Descargar PDF
```

---

### SPRINT 9 — Configuración + Usuarios

```
Configuración (3 tabs):

Tab General:
  Toggle "Actualización Automática BCV" (sincroniza diariamente)
  Campo manual "Tasa Bolívares (VES)" si BCV falla
  Toggle "Habilitar otras monedas" (futuro)

Tab Empresa (= Perfil):
  Nombre del negocio, Dirección, Teléfono
  PIN de Autorización (4 dígitos) — para descuentos de empleados
  Logo (upload)
  Color de acento del tema

Tab Impresión:
  Formato: Tamaño Carta / Ticket 80mm / Ticket 58mm
  Moneda en recibo: Ambas (USD+Bs) / Solo USD / Solo Bs
  Toggle "Ocultar Tasa de Cambio" en pie de recibo
  Footer personalizado

Usuarios (módulo propio):
  2 cards resumen: Administradores / Empleados
  Tabla: Avatar, Usuario, Datos de Acceso, Rol/Permisos, Acciones
  Modal "Crear Usuario": nombre, email, contraseña temporal, rol
  Roles: Empleado (cajero) / Administrador (admin)
```

---

### SPRINT 10 — Módulo Ayuda

```
Centro de Ayuda:
  Grid de cards por módulo (8 cards)
  Buscador de artículos
  Contactos rápidos:
    - Soporte WhatsApp (número de Carlos)
    - Reiniciar tour interactivo

Tour interactivo (onboarding):
  Paso 1: Configurar tasa BCV → guardar
  Paso 2: Crear primer producto
  Paso 3: Hacer primera venta → cobrar
  Paso 4: Ver el reporte generado
  Paso 5: "Ya dominas ActivoPOS"
  No permite avanzar hasta completar cada paso
```

---

### SPRINT 11 — PWA + Pulido + Certificación

```
PWA:
  manifest.json + service worker
  Íconos en todos los tamaños
  Instalable en Android, iOS, desktop

Pulido:
  /impeccable craft en todas las pantallas
  /emil-design-eng polish invisible
  /webapp-testing flujo E2E completo
  /code-review ultra
  /security-review OWASP
  /performance bundle + Core Web Vitals
  Fix todos los issues P0/P1
```

---

### SPRINT 12 — Deploy Producción

```
Build producción optimizado
PM2 proceso "activopos" puerto 3001
Nginx virtual host en 187.124.241.213
SSL Cloudflare
activopos.com live
Primer cliente onboarding real
```

---

## NO ENTRA EN V1 (Fase 2+)

| Feature | Fase | Razón |
|---------|------|-------|
| Catálogo digital / Vitrina web | 2 | LLEVA/Ordena integración |
| Punto de Equilibrio PRO | 2 | Necesita historial real primero |
| Multi-sucursal | 2 | Solo para clientes Pro |
| Asistente AI contextual | 3 | Después de tener datos suficientes |
| E-commerce / pagos online | 3 | Infraestructura mayor |
| Facturación SENIAT | 3 | Regulación compleja |

---

## ARQUITECTURA DE VENTANAS

```
CLI-A  → Backend: API routes, Prisma, lógica de negocio
CLI-B  → Frontend: Componentes, CSS Modules, animaciones
CLI-C  → /software-architecture + /code-review continuo
CLI-D  → /webapp-testing certificación por módulo
Claude Design → Prototipos visuales de referencia antes de implementar
```

---

## DECISIONES SELLADAS

| Decisión | Valor |
|----------|-------|
| Stack | Next.js 14 + TypeScript + CSS Modules + Prisma 7 |
| Sin tenant/branches v1 | Un negocio = una instalación |
| Paradigma venta | qty × price — NUNCA monto → qty |
| Precio productos | Costo + Margen % → sistema calcula precio |
| Moneda | USD interno, Bs al cobrar, BCV automático |
| CSS | CSS Modules — cero Tailwind |
| Iconos | Lucide React — cero emojis en UI |
| Tema | dark/light configurable, sidebar siempre oscuro |
| Ticket | 3 formatos, 3 opciones moneda, configurable |
| PIN cajero | 4 dígitos para autorizar descuentos |

---

*ActivoPOS — syntidev — activopos.com*
*Carlos Bolívar — Valle de la Pascua, Venezuela — Junio 2026*
*"El POS para negocios que andan activos"*
