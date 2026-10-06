/**
 * Cuánto queda por devolver de cada LÍNEA de una venta.
 *
 * Fuente única de ese cálculo: lo usan el listado de ventas (para que la
 * pantalla de devoluciones sepa qué ofrecer) y POST /api/returns (para validar).
 * Si estos dos difirieran, la UI ofrecería devoluciones que el POST rechaza.
 *
 * La unidad es la LÍNEA, no el producto: `sale_items` no tiene
 * @@unique(sale_id, product_id) y el mismo producto puede estar en 2 líneas
 * (variantes, override de precio) con costos distintos.
 */

/** Estados de venta sobre los que se puede devolver. */
export const RETURNABLE_SALE_STATUSES = ['paid', 'partial_return'] as const
export type ReturnableSaleStatus = typeof RETURNABLE_SALE_STATUSES[number]

export interface SaleLineInput {
  id:         number
  product_id: number
  quantity:   number
}

export interface ReturnedRowInput {
  /** null en devoluciones creadas antes del estándar contable (2026-10-06). */
  sale_item_id: number | null
  product_id:   number
  qty:          number
}

export interface ReturnableLine {
  sale_item_id:   number
  product_id:     number
  qty_sold:       number
  qty_returned:   number
  qty_returnable: number
  /**
   * true cuando hay devoluciones viejas SIN `sale_item_id` de un producto que
   * está en más de una línea: no se puede saber de cuál salieron. No se estima:
   * la línea queda con `qty_returnable: 0` y POST /api/returns responde 422.
   */
  ambiguous_legacy_return: boolean
}

const r3 = (x: number): number => Math.round(x * 1000) / 1000

export function computeReturnableLines(
  lines: SaleLineInput[],
  returned: ReturnedRowInput[],
): ReturnableLine[] {
  const linesByProduct = new Map<number, SaleLineInput[]>()
  for (const l of lines) {
    const list = linesByProduct.get(l.product_id) ?? []
    list.push(l)
    linesByProduct.set(l.product_id, list)
  }

  const byLine = new Map<number, number>()
  const legacy = new Map<number, number>() // product_id -> qty devuelta sin línea
  for (const row of returned) {
    if (row.sale_item_id !== null) {
      byLine.set(row.sale_item_id, (byLine.get(row.sale_item_id) ?? 0) + row.qty)
    } else {
      legacy.set(row.product_id, (legacy.get(row.product_id) ?? 0) + row.qty)
    }
  }

  // Lo devuelto sin línea se imputa SOLO si el producto tiene una única línea.
  const ambiguousProducts = new Set<number>()
  for (const [productId, qty] of Array.from(legacy.entries())) {
    const candidates = linesByProduct.get(productId) ?? []
    if (candidates.length === 1) {
      const only = candidates[0]
      byLine.set(only.id, (byLine.get(only.id) ?? 0) + qty)
    } else {
      ambiguousProducts.add(productId)
    }
  }

  return lines.map(l => {
    const ambiguous   = ambiguousProducts.has(l.product_id)
    const qtyReturned = r3(byLine.get(l.id) ?? 0)
    return {
      sale_item_id:            l.id,
      product_id:              l.product_id,
      qty_sold:                r3(l.quantity),
      qty_returned:            qtyReturned,
      qty_returnable:          ambiguous ? 0 : Math.max(0, r3(l.quantity - qtyReturned)),
      ambiguous_legacy_return: ambiguous,
    }
  })
}

/** true si ya no queda nada devolvible: la venta pasa a `returned`. */
export function isFullyReturned(lines: ReturnableLine[]): boolean {
  return lines.every(l => l.qty_returnable <= 0.001)
}
