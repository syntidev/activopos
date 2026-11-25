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
