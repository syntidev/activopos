'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PrecioDual } from '@/app/catalogo-premium/[slug]/PrecioDual'
import { useCart } from '@/app/catalogo-premium/[slug]/CartContext'
import { fmtUsd } from '@/app/catalogo-premium/[slug]/catalogUtils'
import { CartaFoto } from './CartaFoto'
import { useAddDish } from './useAddDish'
import { cx, initialOf, TAG_CLASS, TAG_LABEL } from './util'
import styles from './carta.module.css'
import type { CartaDish, CartaSize } from '@/types/carta'

const NOTE_MAX = 140

interface CartaFichaProps {
  dish: CartaDish
  slug: string
  rate: number
}

/** Ficha del plato: tamaños como botones grandes (por defecto el menor), cantidad, nota para la cocina y "Agregar". */
export function CartaFicha({ dish, slug, rate }: CartaFichaProps) {
  const { add } = useAddDish(slug)
  const { setCartOpen } = useCart()
  const sizes = [...dish.sizes].sort((a, b) => a.priceUsd - b.priceUsd)
  const [size, setSize] = useState<CartaSize | null>(sizes.find(s => !s.soldOut) ?? null)
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [ok, setOk] = useState(false)

  const unit = size ? size.priceUsd : dish.priceUsd
  const agotado = dish.outOfStock || dish.onRequest || (sizes.length > 0 && !size)

  const agregar = (): void => {
    add(dish, { size, qty, note })
    setOk(true)
    setQty(1)
    setNote('')
  }

  return (
    <article className={styles.ficha} data-testid="ficha">
      <div className={cx(styles.fichaFoto, !dish.image && styles.fichaTipo)}>
        <Link href={'/catalogo-carta/' + slug} className={styles.volver} aria-label="Volver a la carta">‹</Link>
        {dish.image ? <CartaFoto src={dish.image} alt={dish.name} sizes="(min-width: 1024px) 560px, 100vw" priority /> : <span className={styles.wm} aria-hidden="true">{initialOf(dish.name)}</span>}
      </div>
      <div className={styles.fichaBody}>
        {dish.tags.length > 0 && (
          <div className={styles.tags}>{dish.tags.map(t => <span key={t} className={cx(styles.tag, styles[TAG_CLASS[t]])}>{TAG_LABEL[t]}</span>)}</div>
        )}
        <h1>{dish.name}</h1>
        <div className={styles.campo}>
          <PrecioDual variant="carta" size="modal" priceUsd={unit} priceBs={unit * rate} divisaUsd={size ? null : dish.divisaUsd} />
        </div>
        {dish.description && <p className={styles.fichaDesc}>{dish.description}</p>}

        {sizes.length > 0 && (
          <section className={styles.grupo}>
            <div className={styles.grupoH}><h2 id="lbl-tamano">Elige el tamaño</h2><span className={styles.req}>Obligatorio</span></div>
            <div className={styles.tamanos} role="radiogroup" aria-labelledby="lbl-tamano">
              {sizes.map(s => (
                <button key={s.id} type="button" role="radio" aria-checked={size?.id === s.id} disabled={s.soldOut} data-testid="tamano"
                  className={cx(styles.tam, size?.id === s.id && styles.tamOn)} onClick={() => setSize(s)}>
                  <b>{s.label}</b><span>{s.soldOut ? 'Agotado' : fmtUsd(s.priceUsd)}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className={styles.campo}>
          <label htmlFor="nota-cocina">Nota para la cocina (opcional)</label>
          <textarea id="nota-cocina" className={styles.input} maxLength={NOTE_MAX} value={note} onChange={e => setNote(e.target.value)} placeholder="Ej.: sin cebolla, bien cocido…" data-testid="nota" />
          <small className={styles.nTam}>{note.length}/{NOTE_MAX}</small>
        </div>

        {ok && (
          <div className={styles.listo} role="status" data-testid="agregado">
            <span>Agregado a tu pedido.</span>
            <Link href={'/catalogo-carta/' + slug}>Seguir viendo la carta</Link>
            <button type="button" onClick={() => setCartOpen(true)}>Ver mi pedido</button>
          </div>
        )}

        <div className={styles.barra}>
          <div className={styles.pasos}>
            <button type="button" className={styles.paso} onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Una menos">−</button>
            <span className={styles.cant} data-testid="ficha-cant">{qty}</span>
            <button type="button" className={cx(styles.paso, styles.pasoMas)} onClick={() => setQty(q => Math.min(20, q + 1))} aria-label="Una más">+</button>
          </div>
          <button type="button" className={styles.btn} onClick={agregar} disabled={agotado} data-testid="ficha-agregar">
            {agotado ? (dish.onRequest ? 'Consultar precio' : 'Agotado hoy') : 'Agregar · ' + fmtUsd(unit * qty)}
          </button>
        </div>
      </div>
    </article>
  )
}
