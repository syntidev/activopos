/* ============================================================
   ActivoPOS — Contenido de ayuda contextual por módulo
   Venezolano. Específico. Sin paja.
   Actualizado: Sprint 112 — Inventario completo de 17 módulos
   Nota: cotizaciones, pedidos, analytics y tu-dia son módulos nuevos sin
   card en ayuda/page.tsx todavía (HELP_CARDS + TITLE_TO_MODULE no los
   referencian) — contenido listo, falta la card para que sean alcanzables
   desde la grilla. El chat de texto libre (BOT_RULES) sí los cubre ya.
   ============================================================ */

export interface HelpStep {
  title: string
  body:  string
}

export interface HelpFaq {
  q: string
  a: string
}

export interface HelpContent {
  title: string
  steps: HelpStep[]
  faqs:  HelpFaq[]
  tip?:  string
}

export const helpContent = {

  /* ── POS ──────────────────────────────────────────────── */
  pos: {
    title: 'Punto de Venta',
    steps: [
      {
        title: 'Abre la caja',
        body:  'Antes de vender debes abrir la caja declarando el efectivo inicial. La tasa BCV se congela en ese momento.',
      },
      {
        title: 'Busca el producto',
        body:  'Escribe el nombre, código de barras, o escanea con la cámara del celular o una pistola USB. La búsqueda empieza desde 3 caracteres.',
      },
      {
        title: 'Selecciona variante',
        body:  'Si el producto tiene tallas, colores o sabores, elige la opción antes de agregar al carrito. El stock es independiente por variante.',
      },
      {
        title: 'Ajusta la cantidad',
        body:  'Toca los botones + y − del carrito, o escribe kilos si el producto se vende por peso (carnicería, víveres, charcutería). El precio total se calcula automáticamente en USD y Bs.',
      },
      {
        title: 'Usa varios tickets en paralelo',
        body:  'Puedes tener hasta 5 ventas abiertas al mismo tiempo. Pausa una para atender a otro cliente y retómala después sin perder el carrito.',
      },
      {
        title: 'Convierte a cotización si el cliente no decide',
        body:  'Desde el ticket actual genera una cotización en PDF descargable en vez de cobrar — útil cuando el cliente quiere pensarlo.',
      },
      {
        title: 'Procesa el pago',
        body:  'Elige el método: Pago Móvil, Zelle, Efectivo Bs, Efectivo USD, USDT, Binance. Puedes combinar varios métodos en una sola venta (pago mixto).',
      },
      {
        title: 'Cierra la venta',
        body:  'El ticket se genera en pantalla, el stock descuenta automáticamente y la venta queda registrada en Reportes.',
      },
    ],
    faqs: [
      {
        q: '¿Puedo cobrar en Bs y dólares a la vez?',
        a: 'Sí. El sistema muestra ambos precios con la tasa BCV del día. Puedes recibir pago mixto (varios métodos en la misma venta).',
      },
      {
        q: '¿Cómo aplico un descuento?',
        a: 'Toca el precio del producto en el carrito para editarlo. Descuentos por encima del límite configurado requieren el PIN de un administrador.',
      },
      {
        q: '¿Puedo cambiar el precio de un producto en el momento de vender?',
        a: 'Sí, con override de precio protegido por PIN de administrador — útil para negociaciones puntuales sin tocar el precio base del catálogo.',
      },
      {
        q: '¿Qué pasa si me equivoco en la venta?',
        a: 'Puedes anular la venta desde Historial o Devoluciones. El stock se restaura automáticamente.',
      },
      {
        q: '¿Por qué no aparece el producto en el POS?',
        a: 'Verifica que el producto esté activo y con la opción "Disponible en POS" marcada.',
      },
      {
        q: '¿Cómo vendo a crédito?',
        a: 'Selecciona el método de pago "Crédito", elige el cliente registrado y el plazo (7, 14, 21 o 30 días). El saldo y la fecha de vencimiento quedan en su ficha.',
      },
      {
        q: '¿Puedo escanear con la cámara del celular?',
        a: 'Sí. El escáner por cámara funciona en el buscador del POS sin necesidad de una pistola física. También puedes usar una pistola USB o escribir el código a mano.',
      },
    ],
    tip: 'Puedes pausar una venta y atender otra al mismo tiempo — hasta 5 tickets abiertos en paralelo.',
  },

  /* ── INVENTARIO ───────────────────────────────────────── */
  inventario: {
    title: 'Inventario',
    steps: [
      {
        title: 'Ve el stock disponible',
        body:  'Stock actual por producto con su mínimo configurado. El badge rojo indica que estás bajo el mínimo.',
      },
      {
        title: 'Registra entradas con proveedor y costo',
        body:  'Cuando recibes mercancía, registra la entrada con el proveedor y el costo real — así el sistema calcula tu utilidad con precisión.',
      },
      {
        title: 'Registra consumo interno con nota',
        body:  'Para mermas, roturas o uso propio del negocio, registra el consumo con una nota obligatoria — queda trazado quién y por qué se descontó stock sin venta.',
      },
      {
        title: 'Usa el escáner de cámara en el buscador',
        body:  'Encuentra el producto más rápido escaneando el código de barras con la cámara del celular directamente en el buscador de Inventario.',
      },
      {
        title: 'Revisa el historial completo',
        body:  'Cada entrada y salida queda registrada con fecha, usuario y motivo. Filtra por producto, tipo de movimiento o rango de fechas y exporta a Excel.',
      },
      {
        title: 'Consulta los 4 KPIs de inventario',
        body:  'Inversión total en stock, venta estimada al precio de catálogo, utilidad potencial si vendes todo, y cantidad de productos con stock crítico.',
      },
    ],
    faqs: [
      {
        q: '¿Por qué el stock no bajó después de una venta?',
        a: 'El stock descuenta solo cuando la venta está en estado Pagado, no cuando se crea el ticket.',
      },
      {
        q: '¿Cómo corrijo un stock mal ingresado?',
        a: 'Usa Entrada Manual con cantidad negativa para restar unidades incorrectas.',
      },
      {
        q: '¿El stock de variantes es independiente?',
        a: 'Sí. Cada variante (talla, color) tiene su propio stock que descuenta por separado.',
      },
      {
        q: '¿Qué diferencia hay entre consumo interno y una venta anulada?',
        a: 'El consumo interno es stock que sale sin venta (merma, uso propio) y exige una nota. La venta anulada revierte una venta real ya cobrada.',
      },
      {
        q: '¿Puedo exportar el historial de movimientos?',
        a: 'Sí, a Excel, con los mismos filtros que tengas aplicados en pantalla.',
      },
    ],
    tip: 'Cada movimiento queda guardado — revisa el historial completo desde cada producto o exporta todo a Excel.',
  },

  /* ── PRODUCTOS ────────────────────────────────────────── */
  productos: {
    title: 'Productos',
    steps: [
      {
        title: 'Crea el producto',
        body:  'Nombre, precio en USD y categoría son obligatorios. El costo es importante para calcular tu utilidad real.',
      },
      {
        title: 'Elige el tipo de producto',
        body:  'Unidad (cantidad entera), Peso (kg, para carnicería o víveres), Servicio (sin stock) o Combo (agrupa varios productos en uno).',
      },
      {
        title: 'Sube hasta 3 fotos',
        body:  'La primera foto es la principal. Se comprimen automáticamente a WebP para que el catálogo cargue rápido. Usa imágenes claras con fondo neutro.',
      },
      {
        title: 'Agrega variantes si aplica',
        body:  'Activa el toggle Variantes, elige el preset (talla, color, sabor + tamaño o combinado) y el generador crea automáticamente todas las combinaciones con su stock individual.',
      },
      {
        title: 'Configura el precio mayorista',
        body:  'Si tienes clientes con tier mayorista, el sistema aplica automáticamente el precio correspondiente según el tipo de cliente en el POS.',
      },
      {
        title: 'Configura visibilidad en catálogo',
        body:  'Marca "Visible en catálogo" para que aparezca en tu tienda online. Puedes tener productos solo en el POS sin mostrarlos al público, o controlar la visibilidad variante por variante.',
      },
      {
        title: 'Marca como Destacado',
        body:  'Los productos destacados aparecen primero en la sección Destacados del catálogo. Úsalo para tus mejores productos o promociones.',
      },
      {
        title: 'Importa o exporta por Excel',
        body:  'Usa el botón Migración para importar productos masivamente con la plantilla descargable, o exportar tu catálogo completo a Excel.',
      },
    ],
    faqs: [
      {
        q: '¿Cuántas fotos puedo subir por producto?',
        a: 'Hasta 3 imágenes por producto, comprimidas automáticamente a WebP. Se muestran como galería en el catálogo con miniaturas navegables.',
      },
      {
        q: '¿Cómo agrego tallas y colores?',
        a: 'Activa el toggle Variantes, elige el preset y el generador automático crea todas las combinaciones (ej. talla + color). Asigna stock a cada una.',
      },
      {
        q: '¿Puedo importar productos desde Excel?',
        a: 'Sí. Usa el botón Migración en la esquina superior derecha de Productos y descarga la plantilla si es tu primera vez.',
      },
      {
        q: '¿Cómo funciona la venta por peso?',
        a: 'Marca el tipo Peso al crear el producto. En el POS, el cajero ingresa los kilos (con decimales) en vez de unidades enteras.',
      },
      {
        q: '¿Qué es el precio mayorista?',
        a: 'Un precio distinto que se aplica automáticamente en el POS cuando vendes a un cliente marcado como mayorista en su ficha.',
      },
      {
        q: '¿Qué es "Visible en catálogo"?',
        a: 'Controla si el producto aparece en tu tienda pública. Puedes tenerlo activo en el POS pero oculto al público, y también ocultar variantes específicas.',
      },
      {
        q: '¿Por qué no veo el producto en el catálogo?',
        a: 'Verifica que tenga: precio mayor a 0, opción "Visible en catálogo" marcada, y que el catálogo esté activo en Configuración.',
      },
    ],
    tip: 'Agrégale el código de barras para venderlo más rápido con el escáner.',
  },

  /* ── CATÁLOGO DIGITAL ─────────────────────────────────── */
  catalogo: {
    title: 'Catálogo Digital',
    steps: [
      {
        title: 'Activa el catálogo en Configuración',
        body:  'Ve a Configuración → Catálogo Digital. Activa el módulo, elige un slug (tu-negocio) y guarda. Tu URL queda lista: activopos.com/catalogo/tu-negocio',
      },
      {
        title: 'Descarga tu código QR',
        body:  'Configuración → Catálogo Digital genera un QR descargable de tu URL — imprímelo para el local o compártelo digital.',
      },
      {
        title: 'Personaliza tu tienda',
        body:  'Sube tu logo, hasta 3 banners de portada, descripción del negocio y elige entre 10 temas visuales por segmento (retail, comida, moda, etc.).',
      },
      {
        title: 'Crea y organiza las categorías',
        body:  'Ve a Productos → Categorías. Crea las categorías con nombre y color. Sube una imagen representativa a cada una — aparece como ícono circular en la vitrina.',
      },
      {
        title: 'Da de alta los productos para el catálogo',
        body:  'En cada producto activa "Visible en catálogo". Agrega precio, descripción y al menos una foto. Sin foto el producto muestra solo la inicial del nombre.',
      },
      {
        title: 'Configura los métodos de pago',
        body:  'En Configuración → Métodos de pago activa los que aceptas. Estos aparecen en el checkout del cliente con tus datos de cobro reales.',
      },
      {
        title: 'El cliente hace el pedido por WhatsApp',
        body:  'El cliente explora el catálogo, agrega productos al carrito y confirma. El pedido llega automáticamente por WhatsApp con todos los detalles y se crea en el módulo Pedidos.',
      },
      {
        title: 'Gestiona los pedidos en el Kanban',
        body:  'Cada pedido entra al tablero Kanban en la columna Recibido y avanza por Preparando → Listo → Despachado según tu flujo de trabajo.',
      },
      {
        title: 'Comparte tu catálogo',
        body:  'Comparte la URL o el QR por WhatsApp, Instagram, o donde quieras. También puedes compartir la URL directa de cualquier producto.',
      },
    ],
    faqs: [
      {
        q: '¿El catálogo tiene costo extra?',
        a: 'No. Está incluido en el plan Negocio Activo sin costo adicional. En el plan Gratis el catálogo digital no está disponible.',
      },
      {
        q: '¿Por qué no aparece mi producto en el catálogo?',
        a: 'Verifica: precio mayor a 0, "Visible en catálogo" activado, producto activo, y catálogo habilitado en Configuración.',
      },
      {
        q: '¿Los pedidos me llegan por WhatsApp?',
        a: 'Sí. Al confirmar el pedido se abre WhatsApp con un mensaje estructurado, y el pedido queda registrado en el Kanban de Pedidos para que lo gestiones.',
      },
      {
        q: '¿Puedo personalizar el catálogo con mi marca?',
        a: 'Sí. Sube tu logo, elige entre 10 temas visuales por segmento, y agrega hasta 3 banners de portada.',
      },
      {
        q: '¿Qué es el slug del catálogo?',
        a: 'Es la parte final de tu URL, por ejemplo activopos.com/catalogo/mi-boutique. Lo defines en Configuración → Catálogo Digital.',
      },
      {
        q: '¿El cliente puede ver el precio en bolívares?',
        a: 'Sí. Todos los precios se muestran en USD y Bs simultáneamente con la tasa BCV del día.',
      },
      {
        q: '¿Puedo descargar un código QR de mi catálogo?',
        a: 'Sí, desde Configuración → Catálogo Digital. Imprímelo para tu local o compártelo por redes.',
      },
    ],
    tip: 'El stock del catálogo se actualiza solo — si se acaba un producto, nadie lo puede pedir.',
  },

  /* ── PEDIDOS ──────────────────────────────────────────── */
  pedidos: {
    title: 'Pedidos',
    steps: [
      {
        title: 'Recibe pedidos del catálogo',
        body:  'Cuando un cliente compra desde tu Catálogo Digital, el pedido entra automáticamente al Kanban en la columna Recibido.',
      },
      {
        title: 'Avanza el estado con drag & drop',
        body:  'Arrastra la tarjeta del pedido entre las columnas Recibido → Preparando → Listo → Despachado según avanza tu preparación.',
      },
      {
        title: 'Vigila el tiempo transcurrido',
        body:  'Cada tarjeta muestra hace cuánto llegó el pedido. Un indicador amarillo o rojo te alerta si un pedido lleva demasiado tiempo sin avanzar.',
      },
      {
        title: 'Notifica al cliente automáticamente',
        body:  'Al cambiar el estado de un pedido, el sistema puede enviar una notificación por WhatsApp al cliente con el nuevo estado.',
      },
      {
        title: 'Solicita el pago',
        body:  'Desde la tarjeta del pedido envía al cliente los datos de cobro del negocio (Pago Móvil, Zelle, etc.) por WhatsApp.',
      },
      {
        title: 'Cobra directamente desde el Kanban',
        body:  'Cuando el cliente confirma el pago, cóbralo directo desde la tarjeta del pedido sin tener que recrearlo en el POS.',
      },
    ],
    faqs: [
      {
        q: '¿De dónde salen los pedidos?',
        a: 'Todo pedido hecho por un cliente desde tu Catálogo Digital entra automáticamente al Kanban de Pedidos.',
      },
      {
        q: '¿Cómo sé si un pedido lleva mucho tiempo esperando?',
        a: 'La tarjeta muestra el tiempo transcurrido y cambia a amarillo o rojo según cuánto lleve sin avanzar de estado.',
      },
      {
        q: '¿Puedo cobrar un pedido sin pasar por el POS?',
        a: 'Sí, directamente desde la tarjeta del pedido en el Kanban.',
      },
      {
        q: '¿El cliente se entera cuando cambio el estado?',
        a: 'Sí, puede recibir una notificación automática por WhatsApp cuando avanzas el pedido a un nuevo estado.',
      },
    ],
    tip: 'Arrastra las tarjetas entre columnas — no necesitas abrir cada pedido para cambiar su estado.',
  },

  /* ── COTIZACIONES ─────────────────────────────────────── */
  cotizaciones: {
    title: 'Cotizaciones',
    steps: [
      {
        title: 'Crea la cotización',
        body:  'Desde el editor de dos paneles (igual que el POS) agrega productos de tu catálogo o ítems libres para cosas que no manejas en inventario.',
      },
      {
        title: 'Ítems libres sin producto',
        body:  'Si necesitas cotizar algo que no está en tu catálogo, agrega un ítem libre con nombre, cantidad y precio manual.',
      },
      {
        title: 'Genera el PDF',
        body:  'Descarga la cotización como PDF real, listo para enviar o imprimir, con tu logo y datos del negocio.',
      },
      {
        title: 'Envíala por WhatsApp',
        body:  'Comparte la cotización directamente por WhatsApp con los datos del cliente ya cargados en el mensaje.',
      },
      {
        title: 'Sigue el estado',
        body:  'La cotización avanza por los estados Borrador → Enviada → Aceptada → Cobrada según la respuesta del cliente.',
      },
      {
        title: 'Convierte a venta',
        body:  'Cuando el cliente acepta, convierte la cotización a venta real: se abre el POS con todos los ítems ya precargados, listo para cobrar.',
      },
    ],
    faqs: [
      {
        q: '¿Puedo cotizar algo que no tengo en mi catálogo?',
        a: 'Sí, con un ítem libre: escribe el nombre, la cantidad y el precio manualmente sin necesidad de crear el producto.',
      },
      {
        q: '¿Cómo convierto una cotización en venta?',
        a: 'Desde la cotización usa "Convertir a venta" — se abre el POS con los mismos ítems precargados para cobrar de inmediato.',
      },
      {
        q: '¿Puedo enviar la cotización por WhatsApp?',
        a: 'Sí, con un botón directo que arma el mensaje con los datos del cliente.',
      },
      {
        q: '¿Qué significan los estados de una cotización?',
        a: 'Borrador (en edición), Enviada (compartida con el cliente), Aceptada (el cliente confirmó) y Cobrada (ya se convirtió en venta pagada).',
      },
    ],
    tip: 'El editor de cotizaciones es igual al del POS — si sabes vender, ya sabes cotizar.',
  },

  /* ── CLIENTES ─────────────────────────────────────────── */
  clientes: {
    title: 'Clientes',
    steps: [
      {
        title: 'Registra el cliente',
        body:  'Nombre y teléfono son suficientes. La cédula es opcional pero recomendada para clientes a crédito.',
      },
      {
        title: 'Configura el tier de precio',
        body:  'Marca si el cliente es mayorista para que el POS le aplique automáticamente el precio mayorista de cada producto.',
      },
      {
        title: 'Vende a crédito',
        body:  'En el POS selecciona Crédito, elige el cliente y el plazo (7, 14, 21 o 30 días). El saldo y la fecha de vencimiento quedan en su ficha.',
      },
      {
        title: 'Registra abonos parciales',
        body:  'Cuando el cliente abona parte de su deuda, entra a su ficha y registra el pago con el método y el monto — no tiene que pagar todo de una vez.',
      },
      {
        title: 'Revisa el historial completo',
        body:  'Ve todas sus compras, pagos y saldo pendiente desde la ficha del cliente.',
      },
      {
        title: 'Envíale tus datos de cobro',
        body:  'Comparte por WhatsApp los datos de cobro del negocio (Pago Móvil, Zelle, etc.) directamente desde la ficha del cliente.',
      },
      {
        title: 'Recuérdale la deuda pendiente',
        body:  'Envía un recordatorio de deuda por WhatsApp con el monto y la fecha de vencimiento.',
      },
    ],
    faqs: [
      {
        q: '¿Puedo darle crédito sin registrar el cliente?',
        a: 'No. El crédito requiere cliente registrado para hacer seguimiento de la deuda y su plazo.',
      },
      {
        q: '¿Cómo veo quién me debe?',
        a: 'En Clientes filtra por Estado: Con deuda. Se ordena por monto pendiente.',
      },
      {
        q: '¿Puedo cobrar solo parte de la deuda?',
        a: 'Sí, con abonos parciales. El saldo se actualiza con cada pago registrado.',
      },
      {
        q: '¿Qué es el precio mayorista de un cliente?',
        a: 'Un tier configurado en su ficha que hace que el POS le aplique automáticamente un precio distinto al de detal.',
      },
    ],
    tip: 'Los clientes con crédito quedan registrados en Finanzas para su cobranza.',
  },

  /* ── PROVEEDORES ───────────────────────────────────────── */
  proveedores: {
    title: 'Proveedores',
    steps: [
      {
        title: 'Registra el proveedor',
        body:  'Ve a Proveedores → botón "Nuevo" y escribe el nombre, RIF y teléfono del proveedor.',
      },
      {
        title: 'Guarda para usarlo en Compras',
        body:  'Una vez guardado queda disponible para asignarlo al registrar una Compra.',
      },
      {
        title: 'Búscalo cuando crezca tu lista',
        body:  'Usa el buscador por nombre o RIF para encontrarlo rápido.',
      },
    ],
    faqs: [
      {
        q: '¿Puedo editar los datos de un proveedor?',
        a: 'Sí. Desde la lista de Proveedores, toca el proveedor y edita sus datos en cualquier momento.',
      },
      {
        q: '¿Qué pasa si borro un proveedor con compras registradas?',
        a: 'Las compras ya registradas quedan intactas en el historial, solo se pierde el vínculo para compras nuevas.',
      },
    ],
    tip: 'Búscalo por nombre o RIF cuando tu lista de proveedores crezca.',
  },

  /* ── COMPRAS ───────────────────────────────────────────── */
  compras: {
    title: 'Compras',
    steps: [
      {
        title: 'Crea una nueva compra',
        body:  'Ve a Proveedores → Compras → "Nueva Compra".',
      },
      {
        title: 'Elige proveedor y productos',
        body:  'Selecciona el proveedor y agrega los productos con su cantidad y costo real.',
      },
      {
        title: 'Marca el estado',
        body:  'Marca "Recibida" si ya tienes la mercancía, o "Pendiente" si quedaste a deber al proveedor.',
      },
      {
        title: 'El stock sube solo',
        body:  'Si la compra queda "Recibida", el stock de cada producto se actualiza automáticamente.',
      },
      {
        title: 'Anula si hubo un error',
        body:  'Anular una compra revierte automáticamente el stock que había subido y la deuda registrada en Cuentas por Pagar — es una operación atómica, todo o nada.',
      },
    ],
    faqs: [
      {
        q: '¿Qué diferencia hay entre compra y entrada manual de inventario?',
        a: 'La compra registra el costo real y el proveedor, y puede quedar como deuda (CxP). La entrada manual es solo un ajuste de stock sin esos datos.',
      },
      {
        q: '¿Qué pasa si anulo una compra por error?',
        a: 'La anulación revierte el stock y la deuda (CxP) generados por esa compra en una sola operación — no quedan datos sueltos.',
      },
      {
        q: '¿Puedo editar una compra ya recibida?',
        a: 'No directamente — si hay un error, anúlala y crea una nueva, o registra un ajuste de inventario para mantener el historial correcto.',
      },
    ],
    tip: 'Una compra pendiente aparece como deuda en Finanzas → Cuentas por Pagar.',
  },

  /* ── CAJA ─────────────────────────────────────────────── */
  caja: {
    title: 'Caja',
    steps: [
      {
        title: 'Abre la caja',
        body:  'Declara el monto inicial en efectivo, en USD y en Bs. La tasa BCV se registra en ese momento y no cambia durante la sesión.',
      },
      {
        title: 'Registra las ventas',
        body:  'El POS alimenta la caja automáticamente. No necesitas hacer nada manual.',
      },
      {
        title: 'Registra movimientos manuales',
        body:  'Entradas o salidas de efectivo que no son ventas (un retiro, un aporte) se registran con nota para que el cuadre sea exacto.',
      },
      {
        title: 'Declara el cierre',
        body:  'Cuenta el efectivo físico e ingresa el monto real. El sistema calcula la diferencia con lo esperado, por cajero.',
      },
      {
        title: 'Revisa el historial de aperturas y cierres',
        body:  'Consulta cada sesión de caja pasada con su cuadre, cajero responsable y diferencia registrada.',
      },
    ],
    faqs: [
      {
        q: '¿Puedo tener la caja abierta varios días?',
        a: 'Sí, pero se recomienda cerrar diario para tener control preciso de cada jornada.',
      },
      {
        q: '¿Qué pasa si hay diferencia en el efectivo?',
        a: 'El sistema registra el sobrante o faltante por cajero. Queda documentado en el historial de cierres.',
      },
      {
        q: '¿La tasa BCV cambia durante el día?',
        a: 'No. La tasa se congela al abrir la caja y se mantiene hasta el cierre.',
      },
      {
        q: '¿Cómo registro un retiro de efectivo que no es una venta?',
        a: 'Con un movimiento manual de salida, con nota — queda reflejado en el cuadre del cierre.',
      },
    ],
    tip: 'Haz cortes de caja al mediodía si manejas mucho efectivo.',
  },

  /* ── FINANZAS ─────────────────────────────────────────── */
  finanzas: {
    title: 'Finanzas',
    steps: [
      {
        title: 'Revisa el estado de resultados',
        body:  'Ventas, costos y gastos del período con barras visuales que muestran de un vistazo si el negocio gana o pierde.',
      },
      {
        title: 'Consulta tu punto de equilibrio',
        body:  'El sistema proyecta si llegarás al punto de equilibrio antes de fin de mes según tu ritmo de ventas actual.',
      },
      {
        title: 'Registra gastos fijos y variables',
        body:  'Clasifica luz, agua, empleados, alquiler u otros gastos en categorías propias que tú defines.',
      },
      {
        title: 'Registra las compras',
        body:  'Mercancía que entra con su costo real. Esto actualiza el inventario y el costo de ventas.',
      },
      {
        title: 'Revisa CxC y CxP en un solo lugar',
        body:  'Cuentas por cobrar (lo que te deben) y cuentas por pagar (lo que debes) juntas, sin tener que ir a dos módulos distintos.',
      },
      {
        title: 'Exporta para tu contador',
        body:  'Excel con todo el detalle de ingresos, costos y gastos del período seleccionado.',
      },
    ],
    faqs: [
      {
        q: '¿Cuál es la diferencia entre gasto y compra?',
        a: 'Compra aumenta el inventario (mercancía). Gasto es operativo: luz, agua, empleados.',
      },
      {
        q: '¿En qué moneda se registra todo?',
        a: 'En USD. Los Bs se calculan automáticamente con la tasa del momento.',
      },
      {
        q: '¿Qué es el punto de equilibrio?',
        a: 'El monto de ventas necesario para cubrir tus costos y gastos del período. Finanzas te proyecta si lo alcanzarás antes de fin de mes.',
      },
      {
        q: '¿Por qué mi utilidad es diferente al efectivo en caja?',
        a: 'La utilidad incluye ventas a crédito aún no cobradas y excluye salidas de efectivo no operativas.',
      },
    ],
    tip: 'Cobra las deudas desde el perfil del cliente o desde Finanzas directamente.',
  },

  /* ── REPORTES ─────────────────────────────────────────── */
  reportes: {
    title: 'Reportes',
    steps: [
      {
        title: 'Selecciona el período',
        body:  'Hoy, esta semana, este mes o define un rango de fechas personalizado.',
      },
      {
        title: 'Analiza las ventas',
        body:  'Total de ventas, desglose por método de pago y ranking de productos más vendidos.',
      },
      {
        title: 'Revisa reportes de inventario y caja',
        body:  'Además del reporte de ventas, consulta el estado del inventario y el historial de caja del período elegido.',
      },
      {
        title: 'Recibe el reporte mensual automático',
        body:  'Al cierre de cada mes, el sistema genera un reporte mensual automático y te avisa en el dashboard cuando está listo.',
      },
      {
        title: 'Exporta',
        body:  'Excel o PDF con todo el detalle para tu archivo o contador.',
      },
    ],
    faqs: [
      {
        q: '¿Puedo ver reportes de días anteriores?',
        a: 'Sí. Usa el selector de fechas para cualquier período pasado.',
      },
      {
        q: '¿El reporte mensual se genera solo?',
        a: 'Sí, automáticamente al cierre de cada mes, con un aviso en el dashboard cuando está disponible.',
      },
      {
        q: '¿Por qué la utilidad es diferente al efectivo en caja?',
        a: 'La utilidad incluye ventas a crédito. El efectivo solo cuenta lo cobrado en físico.',
      },
    ],
    tip: 'Filtra por cajero para ver el rendimiento de cada empleado.',
  },

  /* ── ANALYTICS — PULSO DEL NEGOCIO ────────────────────── */
  analytics: {
    title: 'Analytics — Pulso del Negocio',
    steps: [
      {
        title: 'Elige el período',
        body:  'Semana, Mes o Trimestre. Cada período recalcula todas las métricas y comparativas.',
      },
      {
        title: 'Compara contra el período anterior',
        body:  'Ve si vendiste más o menos que la semana, mes o trimestre pasado, con la variación en porcentaje.',
      },
      {
        title: 'Revisa tus productos con tendencia',
        body:  'Los productos más vendidos del período, con una indicación de si su venta está subiendo o bajando respecto al anterior.',
      },
      {
        title: 'Analiza el desglose por método de pago',
        body:  'Cuánto de tus ventas entró por Pago Móvil, Zelle, efectivo, etc. — útil para saber qué método priorizar.',
      },
      {
        title: 'Descubre tu mejor día de la semana',
        body:  'El sistema identifica qué día de la semana vendes más, como insight para planificar personal o promociones.',
      },
    ],
    faqs: [
      {
        q: '¿Qué diferencia hay entre Analytics y Reportes?',
        a: 'Reportes te da el detalle transaccional exportable. Analytics te da comparativas, tendencias e insights del comportamiento de tu negocio.',
      },
      {
        q: '¿Qué períodos puedo comparar?',
        a: 'Semana, Mes o Trimestre, siempre contra el período inmediatamente anterior equivalente.',
      },
      {
        q: '¿Cómo sé qué producto está creciendo?',
        a: 'La sección de productos con tendencia marca si la venta de cada producto sube o baja respecto al período anterior.',
      },
    ],
    tip: 'Usa el insight del mejor día de la semana para planificar tus promociones o refuerzos de personal.',
  },

  /* ── DEVOLUCIONES ──────────────────────────────────────── */
  devoluciones: {
    title: 'Devoluciones',
    steps: [
      {
        title: 'Busca el ticket a revertir',
        body:  'Busca la venta por número de ticket, fecha o cliente.',
      },
      {
        title: 'Selecciona los ítems a devolver',
        body:  'Marca qué productos del ticket se devuelven — no tiene que ser la venta completa.',
      },
      {
        title: 'Confirma la devolución',
        body:  'Ingresa el motivo y confirma. Puedes elegir si el stock devuelto se restaura al inventario o no (por ejemplo, si el producto llegó dañado).',
      },
      {
        title: 'Revisa el historial',
        body:  'Cada devolución queda registrada con su estado: Aprobada, Rechazada o Pendiente.',
      },
    ],
    faqs: [
      {
        q: '¿Puedo devolver solo parte de una venta?',
        a: 'Sí. El flujo de 3 pasos te permite elegir exactamente qué ítems del ticket se devuelven, no la venta completa obligatoriamente.',
      },
      {
        q: '¿El stock siempre se restaura?',
        a: 'No es automático — puedes elegir si restaurar el stock o no, según si el producto devuelto sigue siendo vendible.',
      },
      {
        q: '¿El cliente pierde el pago al devolver?',
        a: 'El reembolso no queda registrado automáticamente en el sistema. Si ya cobraste, coordina el reembolso por fuera.',
      },
      {
        q: '¿Qué significan los estados de una devolución?',
        a: 'Aprobada (procesada), Rechazada (no se aceptó) o Pendiente (en revisión).',
      },
    ],
    tip: 'El flujo de devolución es de 3 pasos: buscar el ticket, elegir los ítems, y confirmar.',
  },

  /* ── TU DÍA ────────────────────────────────────────────── */
  ['tu-dia']: {
    title: 'Tu Día',
    steps: [
      {
        title: 'Lee el resumen narrativo diario',
        body:  'Un resumen generado con IA de cómo va tu negocio hoy, redactado en lenguaje natural en vez de solo números.',
      },
      {
        title: 'Compara ventas contra ayer',
        body:  'El resumen menciona si hoy vas mejor o peor que el mismo momento de ayer.',
      },
      {
        title: 'Revisa tu producto estrella del mes',
        body:  'El resumen destaca cuál producto está liderando las ventas del mes.',
      },
      {
        title: 'Recibe alertas de cobros pendientes',
        body:  'Si tienes cuentas por cobrar próximas a vencer, el resumen te lo recuerda.',
      },
    ],
    faqs: [
      {
        q: '¿Con qué frecuencia se actualiza Tu Día?',
        a: 'Cada 2 horas, con datos reales de tu negocio hasta ese momento.',
      },
      {
        q: '¿Tu Día reemplaza a Reportes?',
        a: 'No. Tu Día es un resumen narrativo rápido para el día a día; Reportes te da el detalle exportable completo.',
      },
    ],
    tip: 'Tu Día se actualiza cada 2 horas — revísalo en la mañana y de nuevo en la tarde.',
  },

  /* ── CONFIGURACIÓN ────────────────────────────────────── */
  configuracion: {
    title: 'Configuración',
    steps: [
      {
        title: 'Datos del negocio',
        body:  'Nombre, logo, dirección, ciudad, teléfono y redes sociales. El logo aparece en el catálogo, tickets y reportes.',
      },
      {
        title: 'Configura tus métodos de cobro',
        body:  'Pago Móvil (banco, teléfono, cédula y titular), Zelle (email y titular), Binance/USDT (wallet o ID) y Efectivo USD/Bs. Estos datos se usan automáticamente en Pedidos, Cotizaciones y Clientes al compartir cómo pagarte.',
      },
      {
        title: 'Configura la impresora térmica',
        body:  'Elige el ancho de tu impresora: 58mm u 80mm, para que el ticket se ajuste correctamente.',
      },
      {
        title: 'Personaliza el ticket',
        body:  'Define el encabezado, el pie de página y qué campos se muestran en el ticket impreso.',
      },
      {
        title: 'Catálogo Digital',
        body:  'Activa el catálogo, define tu slug, sube la foto de portada y elige el tema visual de tu marca.',
      },
      {
        title: 'Usuarios y roles',
        body:  'Agrega cajeros con acceso limitado al POS y administradores con acceso completo, con permisos granulares por sección. Según tu plan: Gratis 1 usuario, Negocio Activo hasta 10.',
      },
    ],
    faqs: [
      {
        q: '¿Cómo cambio el logo?',
        a: 'Configuración → Datos del negocio → toca el logo actual y sube la imagen nueva.',
      },
      {
        q: '¿Dónde configuro Pago Móvil, Zelle o Binance?',
        a: 'Configuración → Métodos de pago. Esos mismos datos se reutilizan automáticamente en Pedidos, Cotizaciones y Clientes cuando compartes cómo cobrar.',
      },
      {
        q: '¿Qué impresoras térmicas soporta?',
        a: 'Impresoras de 58mm y 80mm — lo eliges en Configuración.',
      },
      {
        q: '¿Puedo tener varios usuarios?',
        a: 'Sí. Gratis: 1 usuario. Negocio Activo: hasta 10, con permisos según su rol.',
      },
      {
        q: '¿Cómo cambio el color del catálogo?',
        a: 'Configuración → Catálogo Digital → Color principal. El catálogo adopta ese color en botones, chips y acentos.',
      },
    ],
    tip: 'El tema oscuro/claro se cambia desde Apariencia y aplica al instante.',
  },

  /* ── USUARIOS ──────────────────────────────────────────── */
  usuarios: {
    title: 'Usuarios',
    steps: [
      {
        title: 'Crea el usuario',
        body:  'Ve a Configuración → Usuarios → Nuevo Usuario.',
      },
      {
        title: 'Asigna rol',
        body:  'Asigna nombre, cédula, contraseña y rol: Cajero o Administrador.',
      },
      {
        title: 'Configura el PIN',
        body:  'El PIN se usa para autorizar operaciones sensibles como descuentos grandes u override de precio en el POS.',
      },
      {
        title: 'Diferencia de acceso',
        body:  'El cajero solo ve el POS, Caja y Clientes, sin acceso a costos ni configuración; el administrador tiene acceso completo al sistema.',
      },
      {
        title: 'Activa o desactiva usuarios',
        body:  'Desactiva un usuario para quitarle el acceso sin borrar su historial de ventas ni perder la trazabilidad.',
      },
    ],
    faqs: [
      {
        q: '¿Cuántos usuarios puedo tener?',
        a: 'Según tu plan: Gratis 1 usuario, Negocio Activo hasta 10.',
      },
      {
        q: '¿Puedo desactivar un usuario sin borrarlo?',
        a: 'Sí. Desactívalo desde su ficha para quitarle el acceso sin perder su historial de ventas.',
      },
      {
        q: '¿Para qué sirve el PIN de un usuario?',
        a: 'Autoriza operaciones sensibles: descuentos por encima del límite y override de precio en el POS.',
      },
      {
        q: '¿Qué diferencia hay entre Cajero y Administrador?',
        a: 'El cajero opera POS, Caja y Clientes sin ver costos ni configuración. El administrador tiene acceso completo, incluida Configuración y Finanzas.',
      },
    ],
    tip: 'Cambia la contraseña de un cajero desde su perfil si se la olvida.',
  },

} satisfies Record<string, HelpContent>

export type HelpModule = keyof typeof helpContent
