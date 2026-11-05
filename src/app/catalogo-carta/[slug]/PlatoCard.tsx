'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PrecioDual } from '@/app/catalogo-premium/[slug]/PrecioDual'
import { CartaFoto } from './CartaFoto'
import { useAddDish } from './useAddDish'
import { cx, dishHref, initialOf, TAG_CLASS, TAG_LABEL } from './util'
import styles from './carta.module.css'
import type { CartaDish } from '@/types/carta'

interface PlatoCardProps {
  dish: CartaDish
  slug: string
  /** Las primeras tarjetas de la pantalla cargan la foto sin lazy. */
  priority?: boolean
}

/** Tarjeta de plato: foto 4:5, o tarjeta tipográfica si no hay foto. Con tamaños es UNA tarjeta ("Desde $X · N tamaños"). */
export function PlatoCard({ dish, slug, priority = false }: PlatoCardProps) {
  const { quickAdd } = useAddDish(slug)
  const [ok, setOk] = useState(false)
  const href = dishHref(slug, dish.id)
  const conTamanos = dish.sizes.length > 0

  const onAdd = (): void => {
    if (quickAdd(dish)) {
      setOk(true)
      setTimeout(() => setOk(false), 1100)
    }
  }

  return (
    <article className={cx(styles.dish, !dish.image && styles.typo, dish.outOfStock && styles.sold)} data-testid="plato" data-dish-id={dish.id}>
      {dish.image ? (
        <Link href={href} className={styles.photo} aria-label={'Ver ' + dish.name} data-testid="plato-foto">
          <CartaFoto src={dish.image} alt={dish.name} sizes="(min-width: 1024px) 132px, 96px" priority={priority} />
          {dish.outOfStock && <span className={styles.agot}>Agotado</span>}
        </Link>
      ) : (
        <span className={styles.wm} aria-hidden="true">{initialOf(dish.name)}</span>
      )}
      <div className={styles.info}>
        <h3 className={styles.nombre}><Link href={href}>{dish.name}</Link></h3>
        {dish.description && <p className={styles.desc}>{dish.description}</p>}
        {dish.tags.length > 0 && (
          <div className={styles.tags}>
            {dish.tags.map(t => <span key={t} className={cx(styles.tag, styles[TAG_CLASS[t]])}>{TAG_LABEL[t]}</span>)}
          </div>
        )}
        <div className={styles.pricerow}>
          <div>
            <PrecioDual variant="carta" priceUsd={dish.priceUsd} priceBs={dish.priceBs} divisaUsd={dish.divisaUsd} desde={conTamanos} />
            {conTamanos && <span className={styles.nTam}>{dish.sizes.length} tamaños</span>}
          </div>
          {dish.outOfStock ? (
            <span className={styles.nTam}>Agotado hoy</span>
          ) : dish.onRequest ? null : (
            <button type="button" className={cx(styles.add, ok && styles.addOk)} onClick={onAdd} data-testid="plato-agregar"
              aria-label={(conTamanos ? 'Elegir tamaño de ' : 'Agregar ') + dish.name}>
              {ok ? 'Agregado' : conTamanos ? 'Elegir' : 'Agregar'}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
