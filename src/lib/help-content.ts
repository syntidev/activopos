/* ============================================================
   ActivoPOS — Contenido de ayuda contextual por módulo
   Venezolano. Específico. Sin paja.
   Actualizado: Sprint 111 — Catálogo Digital completo
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
        body:  'Escribe el nombre, código de barras o escanea con la cámara. La búsqueda empieza desde 3 caracteres.',
      },
      {
        title: 'Selecciona variante',
        body:  'Si el producto tiene tallas o colores, elige la opción antes de agregar al carrito. El stock es independiente por variante.',
      },
      {
        title: 'Ajusta la cantidad',
        body:  'Toca los botones + y − del carrito. El precio total se calcula automáticamente en USD y Bs.',
      },
      {
        title: 'Procesa el pago',
        body:  'Elige el método: Pago Móvil, Zelle, Efectivo Bs, Efectivo USD, USDT, Binance. Puedes combinar métodos.',
      },
      {
        title: 'Cierra la venta',
        body:  'El ticket se genera en pantalla, el stock descuenta automáticamente y la venta queda registrada en Reportes.',
      },
    ],
    faqs: [
      {
        q: '¿Puedo cobrar en Bs y dólares a la vez?',
        a: 'Sí. El sistema muestra ambos precios con la tasa BCV del día. Puedes recibir pago mixto.',
      },
      {
        q: '¿Cómo aplico un descuento?',
        a: 'Toca el precio del producto en el carrito para editarlo manualmente antes de procesar.',
      },
      {
        q: '¿Qué pasa si me equivoco en la venta?',
        a: 'Puedes anular la venta desde Historial. El stock se restaura automáticamente.',
      },
      {
        q: '¿Por qué no aparece el producto en el POS?',
        a: 'Verifica que el producto esté activo y con la opción "Disponible en POS" marcada.',
      },
      {
        q: '¿Cómo vendo a crédito?',
        a: 'Selecciona el método de pago "Crédito" y elige el cliente registrado. El saldo queda en su ficha.',
      },
    ],
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
        title: 'Agrega la descripción',
        body:  'La descripción aparece en la página de detalle del catálogo digital. Ayuda al cliente a entender qué compra.',
      },
      {
        title: 'Sube hasta 3 fotos',
        body:  'La primera foto es la principal. Las adicionales se muestran como miniaturas en el catálogo. Usa imágenes claras con fondo neutro.',
      },
      {
        title: 'Agrega variantes si aplica',
        body:  'Para ropa activa el toggle Variantes, elige el preset (talla, color o combinado) y asigna stock individual a cada opción.',
      },
      {
        title: 'Configura visibilidad en catálogo',
        body:  'Marca "Visible en catálogo" para que aparezca en tu tienda online. Puedes tener productos solo en el POS sin mostrarlos al público.',
      },
      {
        title: 'Marca como Destacado',
        body:  'Los productos destacados aparecen primero en la sección Destacados del catálogo. Úsalo para tus mejores productos o promociones.',
      },
    ],
    faqs: [
      {
        q: '¿Cuántas fotos puedo subir por producto?',
        a: 'Hasta 3 imágenes por producto. Se muestran como galería en el catálogo con miniaturas navegables.',
      },
      {
        q: '¿Para qué sirve la descripción?',
        a: 'Aparece en la página de detalle del catálogo. Describe materiales, medidas, uso o cualquier dato relevante para el cliente.',
      },
      {
        q: '¿Cómo agrego tallas y colores?',
        a: 'Activa el toggle Variantes, elige el preset y añade cada opción con su stock. El stock es independiente por variante.',
      },
      {
        q: '¿Puedo importar desde Excel?',
        a: 'Sí. Usa el botón Migración en la esquina superior derecha de Productos.',
      },
      {
        q: '¿Qué es "Visible en catálogo"?',
        a: 'Controla si el producto aparece en tu tienda pública. Puedes tenerlo activo en el POS pero oculto al público.',
      },
      {
        q: '¿Por qué no veo el producto en el catálogo?',
        a: 'Verifica que tenga: precio mayor a 0, opción "Visible en catálogo" marcada, y que el catálogo esté activo en Configuración.',
      },
    ],
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
        title: 'Registra entradas manuales',
        body:  'Cuando recibes mercancía sin pasar por el módulo Compras. Útil para ajustes de inventario.',
      },
      {
        title: 'Controla el stock crítico',
        body:  'Configura el stock mínimo en cada producto. Cuando baje de ese número recibirás la alerta.',
      },
      {
        title: 'Revisa el historial',
        body:  'Cada entrada y salida queda registrada con fecha, usuario y motivo.',
      },
    ],
    faqs: [
      {
        q: '¿Por qué el stock no bajó después de una venta?',
        a: 'El stock descuenta solo cuando la venta está en estado Pagado, no cuando se crea.',
      },
      {
        q: '¿Cómo corrijo un stock mal ingresado?',
        a: 'Usa Entrada Manual con cantidad negativa para restar unidades incorrectas.',
      },
      {
        q: '¿El stock de variantes es independiente?',
        a: 'Sí. Cada variante (talla, color) tiene su propio stock que descuenta por separado.',
      },
    ],
  },

  /* ── CAJA ─────────────────────────────────────────────── */
  caja: {
    title: 'Caja',
    steps: [
      {
        title: 'Abre la caja',
        body:  'Declara el monto inicial en efectivo. La tasa BCV se registra en ese momento y no cambia durante la sesión.',
      },
      {
        title: 'Registra las ventas',
        body:  'El POS alimenta la caja automáticamente. No necesitas hacer nada manual.',
      },
      {
        title: 'Declara el cierre',
        body:  'Cuenta el efectivo físico e ingresa el monto real. El sistema calcula la diferencia con lo esperado.',
      },
      {
        title: 'Exporta el reporte',
        body:  'PDF con el resumen del día: ventas por método de pago, utilidad y diferencia de caja en USD y Bs.',
      },
    ],
    faqs: [
      {
        q: '¿Puedo tener la caja abierta varios días?',
        a: 'Sí, pero se recomienda cerrar diario para tener control preciso de cada jornada.',
      },
      {
        q: '¿Qué pasa si hay diferencia en el efectivo?',
        a: 'El sistema registra el sobrante o faltante. Queda documentado en el reporte de cierre.',
      },
      {
        q: '¿La tasa BCV cambia durante el día?',
        a: 'No. La tasa se congela al abrir la caja y se mantiene hasta el cierre.',
      },
    ],
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
        title: 'Vende a crédito',
        body:  'En el POS selecciona Crédito y elige el cliente. El saldo queda registrado en su ficha.',
      },
      {
        title: 'Registra los pagos',
        body:  'Cuando el cliente abona, entra a su ficha y registra el pago con el método y monto.',
      },
      {
        title: 'Revisa el historial',
        body:  'Ve todas sus compras, pagos y saldo pendiente desde la ficha del cliente.',
      },
    ],
    faqs: [
      {
        q: '¿Puedo darle crédito sin registrar el cliente?',
        a: 'No. El crédito requiere cliente registrado para hacer seguimiento de la deuda.',
      },
      {
        q: '¿Cómo veo quién me debe?',
        a: 'En Clientes filtra por Estado: Con deuda. Se ordena por monto pendiente.',
      },
    ],
  },

  /* ── FINANZAS ─────────────────────────────────────────── */
  finanzas: {
    title: 'Finanzas',
    steps: [
      {
        title: 'Registra los gastos',
        body:  'Luz, agua, empleados, alquiler: cualquier salida de dinero que no sea compra de mercancía.',
      },
      {
        title: 'Registra las compras',
        body:  'Mercancía que entra con su costo real. Esto actualiza el inventario y el costo de ventas.',
      },
      {
        title: 'Analiza la utilidad',
        body:  'Ventas menos costos y gastos del período. El P&L te muestra si el negocio está ganando o perdiendo.',
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
        q: '¿Por qué mi utilidad es diferente al efectivo en caja?',
        a: 'La utilidad incluye ventas a crédito aún no cobradas y excluye salidas de efectivo no operativas.',
      },
    ],
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
        title: 'Revisa la utilidad real',
        body:  'Margen después de descontar el costo de los productos vendidos.',
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
        q: '¿Por qué la utilidad es diferente al efectivo en caja?',
        a: 'La utilidad incluye ventas a crédito. El efectivo solo cuenta lo cobrado en físico.',
      },
    ],
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
        title: 'Personaliza tu tienda',
        body:  'Sube tu logo, foto de portada, descripción del negocio y color principal. La foto de portada aparece en el banner de inicio. Puedes subir hasta 3 banners.',
      },
      {
        title: 'Crea y organiza las categorías',
        body:  'Ve a Productos → Categorías. Crea las categorías con nombre y color. Sube una imagen representativa a cada categoría — aparece como ícono circular en la vitrina del catálogo.',
      },
      {
        title: 'Importancia de categorizar bien',
        body:  'Las categorías organizan tu catálogo en secciones y activan los "Productos relacionados" en la página de cada producto. Sin categoría, el producto queda suelto y sin relacionados.',
      },
      {
        title: 'Da de alta los productos para el catálogo',
        body:  'En cada producto activa "Visible en catálogo". Agrega precio, descripción y al menos una foto. Sin foto el producto muestra solo la inicial del nombre.',
      },
      {
        title: 'Agrega imágenes al producto',
        body:  'Puedes subir hasta 3 fotos por producto. La primera es la principal. Las otras aparecen como miniaturas navegables en la página de detalle del producto.',
      },
      {
        title: 'Agrega descripción al producto',
        body:  'La descripción aparece en la página de detalle. Describe materiales, medidas, usos o beneficios. Ayuda al cliente a decidir la compra sin necesidad de preguntar.',
      },
      {
        title: 'Marca tus mejores productos como Destacados',
        body:  'El toggle Destacado hace que el producto aparezca en la sección "Productos Destacados" del inicio del catálogo. Úsalo para promociones y productos estrella.',
      },
      {
        title: 'Configura los métodos de pago',
        body:  'En Configuración → Métodos de pago activa los que aceptas: Pago Móvil, Zelle, USDT, Binance, Efectivo. Estos aparecen en el checkout del cliente.',
      },
      {
        title: 'El cliente hace el pedido',
        body:  'El cliente entra a tu URL, explora el catálogo, agrega productos al carrito y hace el pedido en 3 pasos: datos de contacto → método de entrega → método de pago. El pedido llega por WhatsApp.',
      },
      {
        title: 'Flujo del carrito del cliente',
        body:  'Paso 1: nombre y WhatsApp. Paso 2: elige retirar en tienda o envío a domicilio (con dirección). Paso 3: elige cómo pagar. Al confirmar, el pedido llega a tu WhatsApp con todos los detalles.',
      },
      {
        title: 'Comparte tu catálogo',
        body:  'Comparte la URL activopos.com/catalogo/tu-negocio por WhatsApp, Instagram, o donde quieras. También puedes compartir la URL directa de cualquier producto.',
      },
    ],
    faqs: [
      {
        q: '¿El catálogo tiene costo extra?',
        a: 'No. Está incluido en el plan Negocio y Pro sin costo adicional.',
      },
      {
        q: '¿Por qué no aparece mi producto en el catálogo?',
        a: 'Verifica: precio mayor a 0, "Visible en catálogo" activado, producto activo, y catálogo habilitado en Configuración.',
      },
      {
        q: '¿Para qué sirve la imagen de la categoría?',
        a: 'Aparece como ícono circular en la sección "Explorar Categorías" del inicio del catálogo. Sin imagen muestra la inicial del nombre.',
      },
      {
        q: '¿Qué son los Productos Relacionados?',
        a: 'Son productos de la misma categoría que aparecen al pie de la página de un producto. Se activan automáticamente cuando el producto tiene categoría asignada.',
      },
      {
        q: '¿Cómo funcionan las variantes en el catálogo?',
        a: 'El cliente ve el botón "Ver opciones". Al tocarlo, ve las variantes disponibles (talla, color), el precio actualizado y puede elegir cantidad. Las variantes agotadas aparecen tachadas.',
      },
      {
        q: '¿Los pedidos me llegan por WhatsApp?',
        a: 'Sí. Al confirmar el pedido se abre WhatsApp con un mensaje estructurado que incluye productos, cantidades, precios, método de pago y datos de entrega.',
      },
      {
        q: '¿Puedo personalizar el catálogo con mi marca?',
        a: 'Sí. Sube tu logo, elige el color principal de tu marca y agrega foto de portada. El catálogo adopta los colores de tu negocio.',
      },
      {
        q: '¿Qué es el slug del catálogo?',
        a: 'Es la parte final de tu URL. Por ejemplo: activopos.com/catalogo/mi-boutique. Lo defines en Configuración → Catálogo Digital.',
      },
      {
        q: '¿El cliente puede ver el precio en bolívares?',
        a: 'Sí. Todos los precios se muestran en USD y Bs simultáneamente con la tasa BCV del día. El cliente siempre ve ambos.',
      },
      {
        q: '¿Cómo configuro el envío a domicilio?',
        a: 'El sistema ofrece al cliente elegir entre retirar en tienda o envío a domicilio. Si elige domicilio, ingresa su dirección y GPS opcional. El costo de envío se coordina por WhatsApp.',
      },
    ],
  },

  /* ── CONFIGURACIÓN ────────────────────────────────────── */
  configuracion: {
    title: 'Configuración',
    steps: [
      {
        title: 'Datos del negocio',
        body:  'Nombre, logo, dirección, ciudad y teléfono. El logo aparece en el catálogo, tickets y reportes.',
      },
      {
        title: 'Métodos de pago',
        body:  'Activa Pago Móvil, Zelle, USDT, Binance, Efectivo USD, Efectivo Bs. Solo los activos aparecen en el POS y en el catálogo.',
      },
      {
        title: 'Catálogo Digital',
        body:  'Activa el catálogo, define tu slug, sube la foto de portada y personaliza el color de tu marca.',
      },
      {
        title: 'Usuarios y roles',
        body:  'Agrega cajeros con acceso limitado al POS. Los administradores tienen acceso completo. Según tu plan: Mostrador 2, Negocio 5, Pro ilimitado.',
      },
    ],
    faqs: [
      {
        q: '¿Cómo cambio el logo?',
        a: 'Configuración → Datos del negocio → toca el logo actual y sube la imagen nueva.',
      },
      {
        q: '¿Puedo tener varios usuarios?',
        a: 'Sí. Mostrador: 2 usuarios, Negocio: 5, Pro: ilimitado.',
      },
      {
        q: '¿Cómo cambio el color del catálogo?',
        a: 'Configuración → Catálogo Digital → Color principal. El catálogo adopta ese color en botones, chips y acentos.',
      },
    ],
  },

} satisfies Record<string, HelpContent>

export type HelpModule = keyof typeof helpContent
