/** Formas de pago del carrito del catálogo (tipos y valor por defecto, sin Prisma: lo importan servidor y cliente). */

/** Un método que el carrito puede ofrecer: solo el NOMBRE (nunca datos de cuenta). `label` = texto distinto del valor que viaja. */
export interface CartPayMethod { id: number; name: string; label?: string }

/** Formas de pago ya filtradas por lo que el negocio decidió (la misma regla que los chips de la ficha y la Carta). */
export interface CartPayOptions {
  /** Métodos Divisa; vacío si Divisa está apagada o se cobra solo en Bs. */
  divisa: CartPayMethod[]
  /** Métodos reales en Bs (sin la financiadora); vacío si se cobra solo en $. */
  bs: CartPayMethod[]
  /** Se cobra en Bs pero no hay método real: el carrito ofrece la opción genérica "Bs · tasa BCV" (método 'Bs'). */
  bsGenerico: boolean
}

/** Sin datos del negocio (o slug inválido): sin métodos propios y Bs genérico, así el carrito siempre puede pedir. */
export const PAY_DEFAULT: CartPayOptions = { divisa: [], bs: [], bsGenerico: true }

/** Opción genérica en Bs cuando el negocio no tiene un método Bs real (igual que la Carta): viaja como método 'Bs'. */
export const BS_GENERICO: CartPayMethod = { id: 0, name: 'Bs', label: 'Bs · tasa BCV' }
