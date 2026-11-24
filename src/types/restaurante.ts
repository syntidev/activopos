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
