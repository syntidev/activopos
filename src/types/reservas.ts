/** Ítem suelto agregado a una reserva (ej. franelas extra). */
export interface ReservaExtra {
  nombre:   string
  cantidad: number
  talla:    string | null
}

/**
 * Reserva serializada para el cliente. Las 3 banderas son independientes:
 * armado / entregado / pagado nunca se combinan en un solo estado.
 */
export interface ReservaDTO {
  id:               number
  ticket_number:    string
  cliente_nombre:   string
  cliente_telefono: string | null
  /** null en reservas creadas antes de este campo (2026-09) */
  cliente_cedula:   string | null
  cliente_correo:   string | null
  kit_id:             number
  kit_nombre:         string
  /** @deprecated usar componentes_tallas -- se mantiene por compatibilidad con reservas viejas */
  talla:              string | null
  /** { "maillot": "L", "franela": "S" } -- null en reservas creadas antes de este campo */
  componentes_tallas: Record<string, string> | null
  cantidad:           number
  extras:           ReservaExtra[] | null
  /** Solo estado -- "cobranza" es fase futura, sin lógica de cobro todavía. */
  fase:             'preventa_apartado' | 'cobranza'
  armado:           boolean
  entregado:        boolean
  entregado_foto:   string | null
  pagado:           boolean
  /** USD. El Bs se calcula al mostrar con la tasa vigente. */
  pagado_monto:     number | null
  pagado_metodo:    string | null
  created_at:       string
  updated_at:       string
}

/**
 * Una combinación kit (+ componente) + talla del contador de demanda (orden
 * de fabricación). `componente` es null para reservas legacy (talla única,
 * sin desglose) -- no confundir con "sin componente definido".
 */
export interface DemandaItem {
  kit_id:     number
  kit_nombre: string
  componente: string | null
  talla:      string | null
  /** Suma de `cantidad` de todas las reservas de esta combinación. */
  unidades:   number
  reservas:   number
}

/** Ítems extra agregados por nombre + talla (también entran a la fabricación). */
export interface DemandaExtra {
  nombre:   string
  talla:    string | null
  unidades: number
}

export interface DemandaResponse {
  ok:             true
  collection:     string | null
  total_unidades: number
  items:          DemandaItem[]
  extras:         DemandaExtra[]
}

/** Columnas del Kanban: se derivan de armado/entregado, NUNCA del pago. */
export type ReservaColumn = 'pendiente' | 'armado' | 'entregado'
