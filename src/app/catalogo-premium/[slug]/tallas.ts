import { valueHasToken } from '@/lib/product-search'
import { euDe, numeroTalla, usDe } from '@/lib/talla-canonica'

/**
 * Filtro de TALLA del catálogo premium. Un chip es "EU 42.5" (calzado) o "XL" (ropa).
 * La comparación contra el valor de la variante es la de product-search.ts (token exacto: 45 no es 45.5, L no es XL).
 */

export const ROPA_ORDEN = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'] as const

interface VarianteTalla { tipo: string; valor: string; soldOut: boolean }
interface ProductoTalla { variants: VarianteTalla[] }

export interface ChipTalla {
  /** Valor del filtro y de la URL: "EU 42.5" o "XL". */
  key:   string
  /** Equivalente US en calzado ("US 9"), si algún valor lo trae. */
  us:    string | null
  count: number
}

const esTalla = (v: VarianteTalla): boolean => v.tipo.toLowerCase().startsWith('talla')

const ropaDe = (valor: string): string | null => ROPA_ORDEN.find(l => valueHasToken(valor, l)) ?? null

/** Clave del filtro que cubre una variante, o null si no es una talla reconocible. */
const claveDe = (v: VarianteTalla): string | null => {
  const eu = euDe(v.valor)
  return eu ? `EU ${eu}` : ropaDe(v.valor)
}

/** ¿La variante cumple la talla pedida? Mismo token exacto que el buscador. */
export function varianteEsTalla(v: VarianteTalla, talla: string): boolean {
  return esTalla(v) && valueHasToken(v.valor, talla.replace(/^EU\s*/i, ''))
}

/** OR entre las tallas elegidas; solo cuentan variantes con existencias. */
export const productoTieneTalla = (p: ProductoTalla, tallas: string[]): boolean =>
  p.variants.some(v => !v.soldOut && tallas.some(t => varianteEsTalla(v, t)))

type Acum = { productos: Set<number>; us: string | null }

/** Chips disponibles: calzado EU ordenado numéricamente, y ropa XS→3XL; solo tallas con stock y su conteo de productos. */
export function chipsDeTallas(products: ProductoTalla[]): { calzado: ChipTalla[]; ropa: ChipTalla[] } {
  const por = new Map<string, Acum>()
  products.forEach((p, i) => {
    for (const v of p.variants) {
      if (v.soldOut || !esTalla(v)) continue
      const key = claveDe(v)
      if (!key) continue
      const a = por.get(key) ?? { productos: new Set<number>(), us: null }
      a.productos.add(i)
      a.us = a.us ?? usDe(v.valor)
      por.set(key, a)
    }
  })
  const chip = ([key, a]: [string, Acum]): ChipTalla => ({ key, us: a.us, count: a.productos.size })
  const entradas = Array.from(por.entries())
  const orden = (k: string): number => ROPA_ORDEN.indexOf(k as typeof ROPA_ORDEN[number])
  return {
    calzado: entradas.filter(([k]) => k.startsWith('EU ')).map(chip).sort((a, b) => numeroTalla(a.key.slice(3)) - numeroTalla(b.key.slice(3))),
    ropa:    entradas.filter(([k]) => !k.startsWith('EU ')).map(chip).sort((a, b) => orden(a.key) - orden(b.key)),
  }
}
