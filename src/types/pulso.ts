/** Tipos compartidos de Pulso (analítica del catálogo público). Ver .doc/CONTRATO_PULSO.md. */

/** Tipos que el CLIENTE puede enviar por POST /api/public/events. `order_created` es solo del servidor. */
export const PULSO_CLIENT_EVENT_TYPES = [
  'page_view', 'product_view', 'deporte_select', 'search', 'add_to_cart', 'checkout_start',
  'whatsapp_click', 'call_click', 'cashea_selected', 'currency_switch',
] as const

export type PulsoClientEventType = (typeof PULSO_CLIENT_EVENT_TYPES)[number]
export type PulsoEventType = PulsoClientEventType | 'order_created'

export const PULSO_MAX_BATCH = 20

/** Evento tal como lo arma el tracker (sin session_id/atribución: van una vez por lote). */
export interface PulsoEventInput {
  type:           PulsoClientEventType
  /** Ruta sin query string (ej. /catalogo-premium/onbike/p/12). */
  path:           string
  product_id?:    number
  deporte?:       string
  /** search: texto buscado. currency_switch: destino 'bs' | 'divisa'. */
  query?:         string
  results_count?: number
}

/** UTM + origen de la sesión. Se aplica a todos los eventos del lote. */
export interface PulsoAttribution {
  utm_source?:    string
  utm_medium?:    string
  utm_campaign?:  string
  utm_content?:   string
  utm_term?:      string
  referrer_host?: string
}

/** Cuerpo de POST /api/public/events. */
export interface PulsoBatchBody {
  slug:         string
  session_id:   string
  attribution?: PulsoAttribution
  events:       PulsoEventInput[]
}

/** Bloque `pulso` que el checkout adjunta al pedido (POST /api/catalog/[slug]/order). */
export interface PulsoOrderContext extends PulsoAttribution {
  session_id: string
}
