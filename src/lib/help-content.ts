/* ============================================================
   ActivoPOS — Contenido de ayuda contextual por módulo
   Venezolano. Específico. Sin paja.
   ============================================================ */

export interface HelpStep {
  title: string
  body: string
}

export interface HelpFaq {
  q: string
  a: string
}

export interface HelpContent {
  title: string
  steps: HelpStep[]
  faqs: HelpFaq[]
}

export const helpContent = {
  pos: {
    title: 'Punto de Venta',
    steps: [
      {
        title: 'Busca el producto',
        body: 'Escribe el nombre, código o escanea el código de barras con la cámara',
      },
      {
        title: 'Selecciona variante',
        body: 'Si el producto tiene tallas o colores, elige antes de agregar',
      },
      {
        title: 'Procesa el pago',
        body: 'Elige el método: Pago Móvil, Zelle, Efectivo, USDT',
      },
      {
        title: 'Cierra la venta',
        body: 'El ticket se genera automáticamente y el stock descuenta',
      },
    ],
    faqs: [
      {
        q: '¿Puedo cobrar en Bs y dólares?',
        a: 'Sí, el sistema muestra ambos con tasa BCV automática',
      },
      {
        q: '¿Cómo aplico un descuento?',
        a: 'Toca el precio del producto antes de procesar',
      },
      {
        q: '¿Qué pasa si me equivoco?',
        a: 'Puedes anular la venta desde el Historial',
      },
    ],
  },

  productos: {
    title: 'Productos',
    steps: [
      {
        title: 'Crea el producto',
        body: 'Nombre, precio, costo y categoría son obligatorios',
      },
      {
        title: 'Agrega variantes',
        body: 'Para ropa: activa el toggle y elige tallas o colores con su stock individual',
      },
      {
        title: 'Sube una foto',
        body: 'La imagen aparece en el catálogo digital y en el POS',
      },
      {
        title: 'Actívalo en el catálogo',
        body: 'Marca "Visible en catálogo" para que aparezca en tu tienda online',
      },
    ],
    faqs: [
      {
        q: '¿Cuántos productos puedo tener?',
        a: 'Depende de tu plan. Pro tiene productos ilimitados',
      },
      {
        q: '¿Puedo importar desde Excel?',
        a: 'Sí, usa el botón Migración en la esquina superior derecha',
      },
      {
        q: '¿Cómo agrego tallas y colores?',
        a: 'Activa el toggle Variantes y selecciona el preset',
      },
    ],
  },

  inventario: {
    title: 'Inventario',
    steps: [
      {
        title: 'Ver el stock disponible',
        body: 'Stock actual por producto con alerta de mínimo configurado',
      },
      {
        title: 'Registrar entrada manual',
        body: 'Cuando recibes mercancía sin pasar por Compras',
      },
      {
        title: 'Stock crítico',
        body: 'El badge rojo indica productos bajo el mínimo configurado',
      },
      {
        title: 'Historial de movimientos',
        body: 'Cada entrada y salida con fecha, usuario y cantidad',
      },
    ],
    faqs: [
      {
        q: '¿Por qué el stock no bajó?',
        a: 'El stock descuenta solo cuando la venta está en estado Pagado',
      },
      {
        q: '¿Cómo corrijo un stock mal ingresado?',
        a: 'Usa Entrada Manual con cantidad negativa',
      },
      {
        q: '¿Qué es stock crítico?',
        a: 'El mínimo lo configuras en cada producto',
      },
    ],
  },

  caja: {
    title: 'Caja',
    steps: [
      {
        title: 'Abre la caja',
        body: 'Declara el monto inicial en efectivo',
      },
      {
        title: 'Registra las ventas',
        body: 'El POS alimenta la caja automáticamente',
      },
      {
        title: 'Declara el cierre',
        body: 'Cuenta el efectivo físico y compara con el sistema',
      },
      {
        title: 'Exporta el reporte',
        body: 'PDF con el resumen del día en USD y Bs',
      },
    ],
    faqs: [
      {
        q: '¿Puedo tener caja abierta varios días?',
        a: 'Sí, pero se recomienda cerrar diario',
      },
      {
        q: '¿Qué pasa si hay diferencia en el efectivo?',
        a: 'El sistema registra el sobrante o faltante',
      },
      {
        q: '¿La tasa BCV cambia durante el día?',
        a: 'La tasa se congela al abrir la caja',
      },
    ],
  },

  clientes: {
    title: 'Clientes',
    steps: [
      {
        title: 'Registra el cliente',
        body: 'Nombre, teléfono y cédula son suficientes',
      },
      {
        title: 'Vende a crédito',
        body: 'En el POS selecciona Crédito y elige el cliente',
      },
      {
        title: 'Registra el pago',
        body: 'Cuando el cliente abona, registra el pago en su ficha',
      },
      {
        title: 'Historial de compras',
        body: 'Ve todo lo que ha comprado y lo que debe',
      },
    ],
    faqs: [
      {
        q: '¿Puedo darle crédito sin registrar el cliente?',
        a: 'No, el crédito requiere cliente registrado',
      },
      {
        q: '¿Cómo veo lo que me deben?',
        a: 'En Clientes filtra por Estado: Con deuda',
      },
    ],
  },

  finanzas: {
    title: 'Finanzas',
    steps: [
      {
        title: 'Registra gastos',
        body: 'Luz, agua, empleados, cualquier salida de dinero',
      },
      {
        title: 'Registra compras',
        body: 'Mercancía que entra con su costo real',
      },
      {
        title: 'Ve la utilidad',
        body: 'Ventas menos costos y gastos del período',
      },
      {
        title: 'Exporta el reporte',
        body: 'Excel con todo el detalle para tu contador',
      },
    ],
    faqs: [
      {
        q: '¿Cuál es la diferencia entre gasto y compra?',
        a: 'Compra aumenta inventario, gasto no',
      },
      {
        q: '¿En qué moneda se registra?',
        a: 'Todo en USD, Bs se calcula automáticamente',
      },
    ],
  },

  reportes: {
    title: 'Reportes',
    steps: [
      {
        title: 'Selecciona el período',
        body: 'Hoy, esta semana, este mes o rango personalizado',
      },
      {
        title: 'Ve las ventas',
        body: 'Total, por método de pago y por producto',
      },
      {
        title: 'Analiza la utilidad',
        body: 'Margen real después de costos',
      },
      {
        title: 'Exporta',
        body: 'Excel o PDF para tu registro o contador',
      },
    ],
    faqs: [
      {
        q: '¿Puedo ver reportes de días anteriores?',
        a: 'Sí, usa el selector de fechas',
      },
      {
        q: '¿Por qué la utilidad es diferente al efectivo?',
        a: 'La utilidad incluye ventas a crédito',
      },
    ],
  },

  catalogo: {
    title: 'Catálogo Digital',
    steps: [
      {
        title: 'Activa el catálogo',
        body: 'En Configuración activa el módulo Catálogo Digital',
      },
      {
        title: 'Comparte el link',
        body: 'Tu URL es activopos.com/catalogo/tu-negocio',
      },
      {
        title: 'El cliente hace el pedido',
        body: 'Llega a tus Pedidos automáticamente',
      },
      {
        title: 'Confirmas y entregas',
        body: 'Aprueba el pedido y coordina la entrega',
      },
    ],
    faqs: [
      {
        q: '¿El catálogo tiene costo extra?',
        a: 'Está incluido en el plan Negocio y Pro',
      },
      {
        q: '¿Puedo personalizar el catálogo?',
        a: 'Sí, agrega logo, colores y descripción en Configuración',
      },
      {
        q: '¿Los pedidos me llegan por WhatsApp?',
        a: 'Sí, también recibes notificación por WhatsApp',
      },
    ],
  },

  configuracion: {
    title: 'Configuración',
    steps: [
      {
        title: 'Datos del negocio',
        body: 'Nombre, logo, dirección y datos de contacto',
      },
      {
        title: 'Métodos de pago',
        body: 'Activa Pago Móvil, Zelle, USDT, Efectivo',
      },
      {
        title: 'Módulos',
        body: 'Activa o desactiva secciones según tu plan',
      },
      {
        title: 'Usuarios',
        body: 'Agrega cajeros y define sus permisos',
      },
    ],
    faqs: [
      {
        q: '¿Cómo cambio el logo?',
        a: 'En Configuración → Datos del negocio → sube tu imagen',
      },
      {
        q: '¿Puedo tener varios usuarios?',
        a: 'Sí, según tu plan (Mostrador: 2, Negocio: 5, Pro: ilimitado)',
      },
    ],
  },
} satisfies Record<string, HelpContent>

export type HelpModule = keyof typeof helpContent
