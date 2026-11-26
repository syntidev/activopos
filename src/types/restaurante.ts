/** Módulo Restaurante — R1: áreas, mesas y plano. */

export type TableShape = 'rect' | 'round' | 'stool'
export type FloorKind = 'wall' | 'door' | 'bar' | 'pass'
export type TableRotation = 0 | 90 | 180 | 270

/**
 * Estado de mesa. NUNCA se guarda: ocupada y por_cobrar salen de la cuenta
 * abierta; reservada y por_limpiar son marcas manuales de la mesa.
 */
export type TableStatus = 'libre' | 'ocupada' | 'por_cobrar' | 'reservada' | 'por_limpiar'

/** Cuenta abierta de una mesa (R2 la llena; en R1 ninguna mesa tiene cuenta). */
export interface OpenAccountRef {
  account_status: 'open' | 'bill_requested'
}

export interface ServiceAreaDTO {
  id:         number
  name:       string
  sort_order: number
  active:     boolean
  /** Mesas activas del área (taburetes incluidos). */
  table_count: number
}

export interface DiningTableDTO {
  id:       number
  area_id:  number
  area_name: string
  label:    string
  capacity: number
  shape:    TableShape
  pos_x:    number
  pos_y:    number
  width:    number
  height:   number
  rotation: TableRotation
  active:   boolean
  cleaning_pending: boolean
  reserved_for:     string | null
  reserved_phone:   string | null
  /** ISO 8601 */
  reserved_at:      string | null
  status:   TableStatus
  /** Cuenta abierta de la mesa (open o bill_requested); null si no hay. De aquí se deriva ocupada / por cobrar. */
  account_id:        number | null
  account_total_usd: number | null
  account_total_bs:  number | null
  /** ISO 8601 */
  account_opened_at: string | null
  /** Ítems de la cuenta que cocina marcó listos y nadie sirvió todavía (R3). */
  ready_items:       number
}

export interface FloorElementDTO {
  id:       number
  area_id:  number
  kind:     FloorKind
  label:    string | null
  pos_x:    number
  pos_y:    number
  width:    number
  height:   number
  rotation: TableRotation
}

/** Lo que carga la página del plano (servidor) y recibe el cliente. */
export interface SalonSnapshot {
  areas:    ServiceAreaDTO[]
  tables:   DiningTableDTO[]
  elements: FloorElementDTO[]
}

/* ── Cuenta de mesa (R2) ── */

export type AccountStatus = 'open' | 'bill_requested' | 'closed' | 'void'
export type ItemKdsStatus = 'draft' | 'sent' | 'preparing' | 'ready' | 'served' | 'void'

/** Instantánea de una opción elegida; mismo formato que OrderItem.modifiers de la Carta. */
export interface ItemModifierDTO {
  group:     string
  option:    string
  price_usd: number
}

export interface AccountItemDTO {
  id:                 number
  product_id:         number
  product_name:       string
  quantity:           number
  /** Precio por unidad con modificadores incluidos. Siempre calculado en el servidor. */
  price_per_unit_usd: number
  subtotal_usd:       number
  note:               string | null
  modifiers:          ItemModifierDTO[]
  course:             number
  kds_status:         ItemKdsStatus
  void_reason:        string | null
  /** Cantidad ya cubierta por ventas de la cuenta (no canceladas). Lo que falta cobrar = quantity - billed_quantity. */
  billed_quantity:    number
}

/** Venta hija de una cuenta de mesa (R4). Los montos salen del servidor. */
export interface AccountSaleDTO {
  id:            number
  ticket_number: string
  status:        'pending' | 'paid' | 'partial_return' | 'returned' | 'cancelled' | 'credit' | 'quote' | 'draft'
  total_usd:     number
  total_bs:      number
  rate_used:     number
  /** Propina cargada a esta venta (fuera del total). */
  tip_usd:       number
}

export interface AccountSummaryDTO {
  id:           number
  order_number: string
  table_id:     number | null
  table_label:  string | null
  area_name:    string | null
  status:       AccountStatus
  guests:       number | null
  waiter_name:  string | null
  client_name:  string | null
  total_usd:    number
  total_bs:     number
  /** ISO 8601 */
  opened_at:    string | null
}

export interface AccountDTO extends AccountSummaryDTO {
  waiter_id:         number | null
  bill_requested_at: string | null
  /** Tasa con la que se abrió la cuenta: total_bs = total_usd × rate_used. */
  rate_used:         number
  items:             AccountItemDTO[]
  /** Ventas hijas (cobros) de la cuenta, de la más vieja a la más nueva; sin las canceladas. */
  sales:             AccountSaleDTO[]
  /** Mesas que se unieron a esta cuenta ("juntar"), además de la principal. */
  joined_tables:     string[]
}

export interface ModifierDTO {
  id:          number
  product_id:  number | null
  category_id: number | null
  group_name:  string | null
  name:        string
  price_usd:   number
  required:    boolean
  active:      boolean
  sort_order:  number
  /** Solo en el listado de configuración: "Todo el negocio", el nombre de la categoría o del producto. */
  scope_label?: string
}

/** Producto tal como lo ve el mesonero: precio de venta y modificadores. Nunca costos. */
export interface CatalogProductDTO {
  id:            number
  name:          string
  price_usd:     number
  sale_mode:     string
  category_id:   number | null
  category_name: string | null
  modifiers:     ModifierDTO[]
}

export interface CatalogDTO {
  rate:       number
  categories: Array<{ id: number; name: string }>
  products:   CatalogProductDTO[]
}

/* ── Estaciones, ruteo y KDS (R3) ── */

export interface StationDTO {
  id:           number
  name:         string
  color:        string | null
  warn_min:     number
  critical_min: number
  is_default:   boolean
  sort_order:   number
  active:       boolean
  /** Cocineros asignados (solo en el listado de configuración). */
  users?:       Array<{ id: number; name: string }>
  /** Comandas activas en la estación (solo en las pestañas del KDS). */
  open_tickets?: number
}

export interface KdsItemDTO {
  id:          number
  quantity:    number
  product_name: string
  modifiers:   ItemModifierDTO[]
  note:        string | null
  course:      number
  status:      ItemKdsStatus
  /** Curso 2+ que espera a que termine el anterior (o a que lo disparen). */
  held:        boolean
  void_reason: string | null
}

/** Una comanda = los ítems de UNA estación de UNA cuenta. Sin precios. */
export interface KdsTicketDTO {
  order_id:     number
  station_id:   number
  order_number: string
  table_label:  string | null
  area_name:    string | null
  waiter_name:  string | null
  /** ISO 8601: el envío más antiguo de los ítems que siguen en preparación. */
  sent_at:      string
  /** ISO 8601: cuándo quedó lista la comanda (el último ítem listo); null si aún no o si no se registró. */
  ready_at:     string | null
  items:        KdsItemDTO[]
}

export interface KdsBoardDTO {
  stations:    StationDTO[]
  /** Estación consultada o "todas". */
  station:     number | 'todas'
  tickets:     KdsTicketDTO[]
  /** Cursor para el siguiente sondeo (?since=). Lleva 2 s de margen: reenviar de más es inocuo, perder un cambio no. */
  server_time: string
  /** Con ?since: ids de las cuentas cuyas comandas vienen completas en esta respuesta (reemplazan a las del cliente). null = tablero completo. */
  changed:     number[] | null
  /** true = hubo más cambios de los que caben en un sondeo con cursor: el cliente debe pedir el tablero completo (sin ?since). */
  refresh_full: boolean
}

export interface RoutingDTO {
  categories: Array<{ id: number; name: string; station_id: number | null; requires_preparation: boolean }>
  /** Productos con estación propia (override del ruteo de su categoría). */
  overrides:  Array<{ id: number; name: string; station_id: number; category_name: string | null }>
  default_station_id: number | null
}
