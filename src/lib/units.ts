export type SaleModeKey = 'unit' | 'weight' | 'service' | 'length' | 'volume' | 'package'

export interface UnitOption {
  value: string
  label: string
}

export const UNIT_CATALOG: Record<SaleModeKey, UnitOption[]> = {
  unit: [
    { value: 'und',    label: 'Unidad' },
    { value: 'par',    label: 'Par' },
    { value: 'set',    label: 'Set' },
    { value: 'caja',   label: 'Caja' },
    { value: 'bolsa',  label: 'Bolsa' },
    { value: 'rollo',  label: 'Rollo' },
    { value: 'pieza',  label: 'Pieza' },
    { value: 'docena', label: 'Docena' },
    { value: 'combo',  label: 'Combo' },
    { value: 'kit',    label: 'Kit' },
  ],
  weight: [
    { value: 'kg', label: 'Kilogramo (kg)' },
    { value: 'g',  label: 'Gramo (g)' },
    { value: 'lb', label: 'Libra (lb)' },
    { value: 'oz', label: 'Onza (oz)' },
  ],
  length: [
    { value: 'm',     label: 'Metro (m)' },
    { value: 'cm',    label: 'Centímetro (cm)' },
    { value: 'vara',  label: 'Vara' },
    { value: 'yarda', label: 'Yarda' },
  ],
  volume: [
    { value: 'L',       label: 'Litro (L)' },
    { value: 'ml',      label: 'Mililitro (ml)' },
    { value: 'botella', label: 'Botella' },
    { value: 'galon',   label: 'Galón' },
  ],
  service: [
    { value: 'hora',     label: 'Hora' },
    { value: 'sesion',   label: 'Sesión' },
    { value: 'servicio', label: 'Servicio' },
    { value: 'consulta', label: 'Consulta' },
    { value: 'dia',      label: 'Día' },
    { value: 'mes',      label: 'Mes' },
  ],
  package: [
    { value: 'paquete', label: 'Paquete' },
    { value: 'caja',    label: 'Caja' },
    { value: 'combo',   label: 'Combo' },
    { value: 'kit',     label: 'Kit' },
  ],
}

export const SALE_MODE_LABELS: Record<SaleModeKey, string> = {
  unit:    'Por unidad',
  weight:  'Por peso',
  service: 'Servicio',
  length:  'Por medida',
  volume:  'Por volumen',
  package: 'Por paquete',
}

/** Input must be decimal for these modes */
export function isDecimalUnit(saleMode: string): boolean {
  return ['weight', 'length', 'volume'].includes(saleMode)
}

/** Get default unit label for a sale mode */
export function defaultUnit(saleMode: SaleModeKey): string {
  return UNIT_CATALOG[saleMode]?.[0]?.value ?? 'und'
}

/** Format quantity for display: "2 kg", "1 und", "1.500 kg" */
export function formatQuantity(qty: number, unitLabel: string, saleMode: string): string {
  const formatted = isDecimalUnit(saleMode)
    ? qty.toFixed(3).replace(/\.?0+$/, '')
    : String(Math.round(qty))
  return `${formatted} ${unitLabel}`
}
