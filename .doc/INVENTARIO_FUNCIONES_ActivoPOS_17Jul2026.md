# INVENTARIO DE FUNCIONES — ActivoPOS
# Generado: 17 Julio 2026 | Fuente: barrido directo del código, 21 carpetas de
# src/app/(dashboard)/, ~225 funciones catalogadas
# Ejecutado por: Opus (sesión de rediseño de planes) | Compilado por: Claude Web

# ESTE DOCUMENTO REEMPLAZA las secciones de features de ADN_ActivoPOS_v1.md
# (§4 "Catálogo funcional completo" y cualquier lista de features usada para
# copy de marketing). ADN_ActivoPOS_v1.md tenía errores confirmados: "10 temas
# de segmento" que en realidad eran 8 y ni siquiera aplicaban al cliente, KDS
# listado sin marcar que está excluido de venta pública, etc. — causaron
# múltiples rondas de corrección en la sesión de rediseño de planes de esta
# misma fecha. Este documento es la fuente única de aquí en adelante para
# cualquier copy de marketing, tabla de comparación de planes, o pregunta de
# "¿esto existe de verdad?".

# IMPORTANTE — lo que este documento NO resuelve: cuáles de estas ~225
# funciones están (o deben estar) gateadas por plan más allá de lo ya decidido
# (catálogo, finanzas, proveedores, exportables, tema visual). La mayoría de
# funciones de POS/Inventario/Pedidos/Devoluciones no tienen gating de plan
# confirmado en plan-guard.ts — es una decisión pendiente aparte, no cubierta
# aquí. Este documento es INVENTARIO, no es la política de qué va en cada plan.

---

## RESUMEN POR MÓDULO (21 carpetas, ~225 funciones)

| Módulo | # funciones | Nota |
|---|---|---|
| analytics | 6 | Dashboard "Pulso del Negocio" |
| ayuda | 7 | Chat con IA + fallback de 20 reglas sin IA |
| caja | 9 | Apertura/cierre, movimientos, historial |
| catalogo-digital | 8 | Panel de gestión (no el catálogo público en sí) |
| clientes | 10 | CRUD, historial, CxC, abonos |
| configuracion | 10 pantallas (9 tabs + Categorías embebido) | El módulo más grande |
| cotizaciones | 8 | Crear, descargar PDF, convertir a venta |
| devoluciones | 7 | Flujo de 3 pasos |
| escritorio | 12 | Dashboard principal, bienvenida, accesos rápidos |
| finanzas | 20 | 6 tabs: Resumen+PE, P&L, Gastos, CxC, CxP, Categorías |
| inventario | 9 | Entradas, consumo interno, escáner, historial |
| kds | 4 | Pantalla de cocina — **excluido de vitrina pública** |
| onboarding | 7 | Checklist de 5 pasos |
| pedidos | 7 | Kanban 4 estados, WhatsApp automático |
| pos | 18 | El módulo más denso — ver detalle abajo |
| productos | 20 | Listado + formulario (8 secciones internas) |
| proveedores (+compras) | 11 | CRUD + compras con transacción |
| reportes | 15 | 4 tabs: Día, Ventas, Inventario, Caja |
| tu-dia | 1 | Narrativa generada, solo lectura |
| usuarios | 3 | CRUD standalone (distinto de la tab en Configuración) |
| ventas | 8 | Historial con detalle |

---

## POR CATEGORÍA COMERCIAL (para armar copy de planes)

### VENTA
- POS con escáner triple: cámara, manual, foto, y pistola USB — no requiere
  comprar hardware para empezar
- Multi-ticket paralelo (hasta 5 tabs simultáneos)
- Venta por peso (kg con steppers) — relevante para carnicería, charcutería, víveres
- Variantes simples y combinadas (2 dimensiones, ej. talla + color)
- Pago único o mixto (varios métodos en una misma venta)
- Venta a crédito con plazos preset (7/14/21/30 días) o custom
- Descuento con PIN de autorización + cargo adicional configurable
- Override de precio con PIN (control de qué puede tocar un cajero)
- Cotización desde el POS → PDF descargable (botón real, endpoint distinto al
  de reportes) → convertible a venta
- Devoluciones — flujo de 3 pasos con restauración de stock opcional

### CATÁLOGO
- Catálogo digital público con QR descargable
- Gestión de visibilidad por producto (individual y masiva)
- Pedidos vía WhatsApp automático (mensaje generado, no manual)
- Panel de pedidos en Kanban (4 estados, drag&drop)
- Tema visual: 10 colores curados por rubro + modo oscuro/claro + portada
  personalizable (3 banners)

### CLIENTES
- Directorio con historial completo de compras y pagos
- Cuentas por cobrar con registro de abonos
- Tipo de cliente (precio mayorista vs. detal)
- Cliente rápido desde el POS sin salir del flujo de venta

### PROVEEDORES
- CRUD de proveedores
- Compras con transacción — confirmar/anular revierte stock y CxP automáticamente
- Cuentas por pagar con estado (vencido/por vencer/vigente)

### FINANZAS
- Estado de resultados visual con barras proporcionales
- Punto de equilibrio con proyección de fin de mes
- Gastos fijos/variables con categorías (propias + del sistema)
- Cuentas por cobrar y por pagar en un solo lugar
- Export a Excel

### EQUIPO
- Roles (Cajero/Administrador) con permisos diferenciados
- PIN de seguridad para operaciones sensibles (anulaciones, ajustes, cierres)
- Multi-usuario con activar/desactivar individual

### OTROS (no encajan en categoría de venta, pero suman valor real)
- "Tu Día" — página narrativa diaria generada automáticamente (saludo, resumen,
  producto estrella, alertas de cobro) — nadie en la competencia analizada
  tiene algo así
- Consumo interno de inventario con nota obligatoria (control de merma)
- Notificaciones push (PWA)
- Reporte mensual automático con banner de aviso
- Centro de ayuda con chat (IA + 20 reglas de respaldo sin IA, funciona sin
  conexión al modelo)

---

## DETALLE CRUDO POR MÓDULO (referencia completa, sin curar)

### analytics/ — "Pulso del Negocio"
Tabs período: Semana / Mes / Trimestre. KPI cards: Ventas (USD+Bs), Tickets,
Ticket promedio, Items vendidos, vs período anterior (badge tendencia).
Gráfico de línea de tendencia. Tabla productos más vendidos con tendencia por
fila. Desglose por método de pago (barra de %). Insights: mejor día.

### ayuda/ — "Centro de Ayuda"
Buscador live sobre 13 help cards por módulo. Botón "Reiniciar Tour". Chat
flotante: IA con fallback local de 20 reglas por keyword (cubre productos,
venta, pagos, descuentos, crédito, escáner, tasa BCV/paralela, variantes,
catálogo, caja, inventario, clientes, finanzas, compras, reportes,
configuración, planes, SENIAT, notificaciones, KDS, tickets, PWA). Tag de
fuente de respuesta (IA/Rápida). Solo admin.

### caja/
Apertura con fondos iniciales USD+Bs. Estado abierta: 4 KPIs (fondos, ventas
del turno, cobros de crédito, efectivo esperado). Movimientos manuales
(entrada/salida). Ventas por método de pago. Declarar cierre con conteo y
diferencia. Polling cada 30s. Historial con filtro de fechas y diferencia
coloreada (verde/rojo).

### catalogo-digital/ (panel de gestión, no el catálogo público)
Link a catálogo público. QR descargable. 4 KPIs (pedidos, visibles, ocultos,
consultar). Tabla top productos pedidos con toggle rápido de visibilidad.
Acciones masivas (publicar/ocultar/consultar en bloque).

### clientes/
CRUD con buscador (nombre/teléfono/cédula). Tabla ordenable por saldo
pendiente. Tipo de precio (mayorista/detal). Historial en panel lateral: tabs
Compras/Pagos CxC, imprimir ticket, registrar abono con validación de saldo.

### configuracion/ (9 tabs + Categorías embebido)
- **General:** fuente de tasa (BCV auto / manual con sugerencia paralela), PIN
  de seguridad, cambio de contraseña con medidor de fortaleza.
- **Empresa:** logo, datos fiscales, tipo de documento de venta (ticket
  térmico / factura de servicio), datos del catálogo público.
- **Impresión:** prefijo de ticket, tamaño de papel, moneda a mostrar, pie de
  ticket personalizable.
- **Medios de Cobro:** dispositivos físicos (26 bancos venezolanos), datos
  para cobrar por método (Pago Móvil, Zelle, Zinli, PayPal, Binance Pay,
  USDT) con preview en vivo del mensaje de WhatsApp generado.
- **Tema Visual:** modo oscuro/claro, 10 colores curados por rubro
  (Azul Clásico-Tienda, Rojo Bodega, Verde Mercado, Ámbar Panadería, Púrpura
  Boutique, Rosa Belleza, Teal Farmacia, Índigo Tech, Naranja Comida, Slate
  Servicios), portada con 3 banners.
- **Módulos:** activar/desactivar Caja, Pedidos, Catálogo WhatsApp, Finanzas,
  Reportes, Pulso del Negocio, Proveedores (POS e Inventario siempre ON).
  Módulos opcionales: KDS, Delivery (por segmento).
- **Notificaciones:** push vía PWA.
- **Tu Plan:** estado del plan, fecha de vencimiento con barra de progreso,
  uso actual (productos/usuarios con % de consumo), features on/off, ciclo de
  facturación con ahorro calculado, botón mejorar plan.
- **Usuarios:** CRUD con roles y permisos diferenciados por tipo.
- **Categorías de Gastos** (embebido en Finanzas, no en el sidebar principal):
  categorías propias + del sistema (no editables).

### cotizaciones/
Crear cotización, listado con estado (Borrador/Enviada/Aceptada/Rechazada/
Vencida), **botón descargar PDF real** (`api/quotations/:id/pdf`), convertir a
venta si está en borrador.

### devoluciones/
Flujo de 3 pasos: buscar venta por ticket → seleccionar ítems y cantidad a
devolver → confirmación con motivo obligatorio y opción de restaurar stock.
Historial con estado (Aprobada/Rechazada/Pendiente).

### escritorio/
Banner de reporte mensual. Checklist de bienvenida para tenants nuevos (<7
días). Saludo dinámico. Tabs de período. Accesos rápidos (nueva venta, agregar
gasto, nueva compra). CTA final al POS.

### finanzas/ (6 tabs)
Export a Excel. Resumen con estado de resultados visual (barras
proporcionales) y punto de equilibrio con proyección. P&L por período. Gastos
con categorías propias/sistema. CxC y CxP con estado (vencido/por vencer/
vigente) y acción de pago/abono.

### inventario/
Consumo interno con nota obligatoria. Escáner de cámara integrado en buscador.
4 KPIs. Panel lateral de producto con movimientos del día. Historial completo
con filtros y export a Excel.

### kds/ — EXCLUIDO de vitrina pública por decisión de negocio
Pantalla de cocina en tiempo real, tablero por segmento (restaurantes,
cafeterías, dark kitchens).

### onboarding/
Barra de progreso, 5 pasos secuenciales con CTA directo a cada módulo,
auto-poll cada 30s, celebración al completar.

### pedidos/ — Kanban
4 columnas (Recibido/Preparando/Listo/Despachado) con drag&drop. Indicador de
tiempo transcurrido por tarjeta (amarillo/rojo). Notificación WhatsApp
automática. Cobro directo desde la tarjeta.

### pos/ — el módulo más denso (18 funciones)
Escáner triple (cámara/manual/foto) + pistola USB silenciosa. Multi-ticket
(hasta 5 tabs). Variantes simples y combinadas. Venta por peso. Pago único o
mixto. Crédito con plazos preset. Descuento y cargo con PIN. Override de
precio con PIN. Cotización con PDF. Cliente rápido inline. Caja de apertura
integrada.

### productos/ (listado + formulario de 8 secciones)
Escáner en buscador y botón dedicado. Importación y exportación Excel. 3 KPIs
de inversión/venta estimada/utilidad. Formulario: información básica (con tipo
de venta: unidad/peso/servicio/combo), imágenes (3 slots, compresión WebP),
catálogo (badges, visibilidad con gate de plan), precio (con precio
mayorista), inventario, variantes (simples y combinadas con generador
automático).

### proveedores/ (+compras)
CRUD con buscador. Compras con transacción atómica — confirmar/anular revierte
stock y CxP automáticamente.

### reportes/ (4 tabs)
Banner de reporte mensual automático. Día (con modo rango personalizado,
export Excel/PDF). Ventas (embebe historial). Inventario (export Excel). Caja
(diferencias por cajero).

### tu-dia/
Página 100% narrativa, sin interacción — resumen del día en texto natural,
producto estrella, alertas de cobro, cierre motivacional.

### usuarios/ (standalone, distinto de la tab en Configuración)
CRUD con activar/desactivar, roles con permisos diferenciados.

### ventas/
Historial con detalle por venta.

---

## NOTA DE CORRECCIÓN — 17 jul 2026

"Cotizaciones en PDF" fue excluido del copy de marketing por precaución,
confundido con el PDF de reportes (DT-11, roto). El barrido confirma que son
dos endpoints distintos: `api/quotations/:id/pdf` (cotizaciones, con botón
real) vs. `api/reports/export-pdf` (reportes, huérfano). Verificar con una
prueba real antes de restaurar "Cotizaciones en PDF" al copy — probablemente
es una función legítima que se sacó por error de asociación, no por ser falsa.
