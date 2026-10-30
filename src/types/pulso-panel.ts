/** Datos del panel Pulso (dashboard). Todo ya convertido a number/string en el borde. */

export type PulsoDias = 7 | 30

export interface PulsoCount {
  label: string
  count: number
}

export interface PulsoProducto {
  id: number
  name: string
  count: number
}

export interface PulsoDia {
  /** 'YYYY-MM-DD' en calendario de Venezuela */
  fecha: string
  visitantes: number
}

export interface PulsoFunnelStep {
  key: 'visita' | 'ficha' | 'carrito' | 'pedido' | 'pagado'
  label: string
  sessions: number
  /** % sobre las visitas (0-100) */
  pctVisitas: number
  /** % respecto al paso anterior (0-100); null en el primer paso */
  pctPaso: number | null
}

export interface PulsoVentaOrigen {
  label: string
  pedidos: number
  usd: number
  /** Suma de orders.total_bs (snapshot del pedido), nunca la tasa de hoy */
  bs: number
}

export type PulsoMetodoKey = 'cashea' | 'bs' | 'divisa' | 'sin_declarar'

export interface PulsoMetodo extends PulsoVentaOrigen {
  key: PulsoMetodoKey
}

export interface PulsoContactoDia {
  fecha: string
  whatsapp: number
  llamadas: number
}

export interface PulsoPanelData {
  dias: PulsoDias
  /** ISO UTC */
  generadoEn: string
  desdeKey: string
  hoyKey: string
  trafico: {
    visitantesHoy: number
    visitantesRango: number
    /** Segundos; null si ninguna sesión tiene >= 2 eventos */
    tiempoPromedioSeg: number | null
    serieDiaria: PulsoDia[]
    equipos: PulsoCount[]
    paises: PulsoCount[]
    ciudades: PulsoCount[]
  }
  origen: {
    fuentes: PulsoCount[]
    campanas: PulsoCount[]
  }
  interes: {
    productos: PulsoProducto[]
    marcas: PulsoCount[]
    deportes: PulsoCount[]
    busquedasSinResultado: PulsoCount[]
    busquedasTop: PulsoCount[]
  }
  embudo: PulsoFunnelStep[]
  ventas: {
    pedidos: number
    usd: number
    bs: number
    porFuente: PulsoVentaOrigen[]
    porCampana: PulsoVentaOrigen[]
    porMetodo: PulsoMetodo[]
  }
  contacto: {
    whatsapp: number
    llamadas: number
    porDia: PulsoContactoDia[]
  }
}
