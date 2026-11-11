'use client'

import { useCatalogHref } from '@/components/catalog/CatalogLinks'
import { useState } from 'react'
import Link from 'next/link'
import { Info } from 'lucide-react'
import { PrecioDual } from '@/app/catalogo-premium/[slug]/PrecioDual'
import { CARTA_TAG_LABEL } from '@/lib/carta/vocab'
import { CartaFoto } from './CartaFoto'
import { useAddDish } from './useAddDish'
import { allergenText, cx, TAG_CLASS } from './util'
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
  const href = useCatalogHref(slug, 'carta')(`/p/${dish.id}`)
  const conTamanos = dish.sizes.length > 0
  const agotado = dish.soldOutToday || dish.outOfStock

  const onAdd = (): void => {
    if (quickAdd(dish)) {
      setOk(true)
      setTimeout(() => setOk(false), 1100)
    }
  }

  return (
    <article className={cx(styles.dish, !dish.image && styles.typo, agotado && styles.sold)} data-testid="carta-plato" data-dish-id={dish.id} data-sin-foto={dish.image ? undefined : 'true'}>
      {dish.image ? (
        <Link href={href} className={styles.photo} aria-label={'Ver ' + dish.name} data-testid="carta-plato-foto">
          <CartaFoto src={dish.image} alt={dish.name} sizes="(min-width: 1024px) 132px, 96px" priority={priority} />
          {agotado && <span className={styles.agot} data-testid="carta-agotado-hoy">{dish.soldOutToday ? 'Agotado hoy' : 'Agotado'}</span>}
        </Link>
      ) : null}
      <div className={styles.info}>
        <h3 className={styles.nombre}><Link href={href} data-testid="carta-plato-nombre">{dish.name}</Link></h3>
        {dish.description && <p className={styles.desc}>{dish.description}</p>}
        {dish.tags.length > 0 && (
          <div className={styles.tags}>
            {dish.tags.map(t => <span key={t} className={cx(styles.tag, styles[TAG_CLASS[t]])} data-testid="carta-etiqueta" data-etiqueta={t}>{CARTA_TAG_LABEL[t]}</span>)}
          </div>
        )}
        {dish.allergens.length > 0 && (
          <p className={styles.alerg} data-testid="carta-alergenos"><Info size={13} aria-hidden="true" />Contiene {allergenText(dish.allergens)}</p>
        )}
        <div className={styles.pricerow}>
          <div>
            <PrecioDual variant="carta" priceUsd={dish.priceUsd} priceBs={dish.priceBs} divisaUsd={dish.divisaUsd} desde={conTamanos}
              testids={{ usd: 'carta-plato-precio-usd', bs: 'carta-plato-precio-bs' }} />
            {conTamanos && <span className={styles.nTam}>{dish.sizes.length} tamaños</span>}
          </div>
          {agotado ? (
            dish.image ? null : <span className={styles.nTam} data-testid="carta-agotado-hoy">{dish.soldOutToday ? 'Agotado hoy' : 'Agotado'}</span>
          ) : dish.onRequest ? null : (
            <button type="button" className={cx(styles.add, ok && styles.addOk)} onClick={onAdd} data-testid="carta-plato-agregar" aria-label={'Agregar ' + dish.name}>
              {ok ? 'Agregado' : 'Agregar'}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
