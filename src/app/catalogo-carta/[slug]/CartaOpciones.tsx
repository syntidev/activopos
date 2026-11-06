'use client'

import type { CartLineOption } from '@/app/catalogo-premium/[slug]/CartContext'
import { cx, fmtUsd } from './util'
import styles from './carta.module.css'
import type { CartaOptionGroup } from '@/types/carta'

/** Elección por grupo: id de grupo → ids de opción elegidos. */
export type Elegidas = Record<number, number[]>

interface CartaOpcionesProps {
  groups:   CartaOptionGroup[]
  elegidas: Elegidas
  onChange: (next: Elegidas) => void
}

/** Grupos que son obligatorios y todavía no tienen elección (la ficha y el editor del carrito bloquean "Agregar"/"Guardar" con esto). */
export const gruposFaltantes = (groups: CartaOptionGroup[], elegidas: Elegidas): CartaOptionGroup[] =>
  groups.filter(g => g.required && (elegidas[g.id] ?? []).length === 0)

/** De la elección a las líneas del carrito (con el precio extra que mostró el servidor; el servidor lo recalcula al pedir). */
export function opcionesDeCarrito(groups: CartaOptionGroup[], elegidas: Elegidas): CartLineOption[] {
  return groups.flatMap(g => g.options.filter(o => (elegidas[g.id] ?? []).includes(o.id)).map(o => ({ id: o.id, group: g.name, name: o.name, price_usd: o.priceExtraUsd })))
}

/** De las opciones de una línea del carrito a la elección por grupo (para editarla). */
export function elegidasDeCarrito(groups: CartaOptionGroup[], options: CartLineOption[] | undefined): Elegidas {
  const ids = new Set((options ?? []).map(o => o.id))
  return Object.fromEntries(groups.map(g => [g.id, g.options.filter(o => ids.has(o.id)).map(o => o.id)]))
}

/** Opciones como botones grandes (≥ 44 px): un grupo de elección única se comporta como radio; con varias, como casillas con tope. */
export function CartaOpciones({ groups, elegidas, onChange }: CartaOpcionesProps) {
  const toggle = (g: CartaOptionGroup, optionId: number): void => {
    const actual = elegidas[g.id] ?? []
    const esta = actual.includes(optionId)
    let next: number[]
    if (!g.multiple) next = esta ? (g.required ? actual : []) : [optionId]
    else if (esta) next = actual.filter(id => id !== optionId)
    else if (g.maxSelect !== null && actual.length >= g.maxSelect) next = actual
    else next = [...actual, optionId]
    onChange({ ...elegidas, [g.id]: next })
  }

  return (
    <>
      {groups.map(g => (
        <section key={g.id} className={styles.grupo} data-testid="carta-grupo" data-grupo={g.name}>
          <div className={styles.grupoH}>
            <h2 id={'g-' + g.id}>{g.name}</h2>
            <span className={cx(styles.req, !g.required && styles.reqOpc)}>
              {g.required ? 'Obligatorio' : 'Opcional'}{g.multiple ? (g.maxSelect ? ' · hasta ' + g.maxSelect : ' · varias') : ''}
            </span>
          </div>
          <div className={styles.tamanos} role={g.multiple ? 'group' : 'radiogroup'} aria-labelledby={'g-' + g.id}>
            {g.options.map(o => {
              const on = (elegidas[g.id] ?? []).includes(o.id)
              return (
                <button key={o.id} type="button" role={g.multiple ? 'checkbox' : 'radio'} aria-checked={on} data-testid="carta-opcion" data-grupo={g.name} data-opcion={o.name}
                  className={cx(styles.tam, on && styles.tamOn)} onClick={() => toggle(g, o.id)}>
                  <b>{o.name}</b>{o.priceExtraUsd > 0 && <span>+{fmtUsd(o.priceExtraUsd)}</span>}
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </>
  )
}
