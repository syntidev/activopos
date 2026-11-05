'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { PrecioDual } from '@/app/catalogo-premium/[slug]/PrecioDual'
import { CartaFoto } from './CartaFoto'
import { CartaPagos } from './CartaPagos'
import { CartaPortada } from './CartaPortada'
import { PlatoCard } from './PlatoCard'
import { useAddDish } from './useAddDish'
import { cx, plano } from './util'
import styles from './carta.module.css'
import type { CartaPageData } from '@/lib/carta/load'
import type { CartaDish } from '@/types/carta'

interface CartaHomeProps {
  slug:         string
  businessName: string
  hoursText:    string | null
  city:         string | null
  data:         CartaPageData
}

const MAX_WORDS = 5
const HOUSE_MAX = 3

function haystack(d: CartaDish): string {
  return plano([d.name, d.description ?? '', d.categoryName ?? '', d.sizes.map(s => s.label).join(' '), d.tags.join(' ')].join(' '))
}

/** Tarjeta grande de "De la casa" (solo desde 1024 px: en móvil lo cubre el hero). */
function CasaCard({ dish, slug, big }: { dish: CartaDish; slug: string; big: boolean }) {
  const { quickAdd } = useAddDish(slug)
  return (
    <article className={cx(styles.hcard, big && styles.hcardBig)} data-testid="casa-card" data-dish-id={dish.id}>
      {dish.image && <CartaFoto src={dish.image} alt={dish.name} sizes="(min-width: 1024px) 60vw, 100vw" />}
      <div className={styles.shade} />
      <div className={styles.hcardTxt}>
        <span className={styles.rank}>De la casa</span>
        <h3 className={styles.nombre}>{dish.name}</h3>
        {dish.description && <p>{dish.description}</p>}
        <div className={styles.hcardRow}>
          <PrecioDual variant="carta" priceUsd={dish.priceUsd} priceBs={dish.priceBs} divisaUsd={dish.divisaUsd} desde={dish.sizes.length > 0} />
          <button type="button" className={styles.add} onClick={() => quickAdd(dish)}>{dish.sizes.length > 0 ? 'Elegir' : 'Agregar'}</button>
        </div>
      </div>
    </article>
  )
}

export function CartaHome({ slug, businessName, hoursText, city, data }: CartaHomeProps) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const words = useMemo(() => plano(query).split(/\s+/).filter(Boolean).slice(0, MAX_WORDS), [query])
  const categories = useMemo(() => {
    if (words.length === 0) return data.categories
    return data.categories
      .map(c => ({ ...c, dishes: c.dishes.filter(d => words.every(w => haystack(d).includes(w))) }))
      .filter(c => c.dishes.length > 0)
  }, [data.categories, words])

  // Scroll-spy: la pestaña activa sigue la sección visible.
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.catIndex ?? 0))
    }, { rootMargin: '-30% 0px -60% 0px' })
    document.querySelectorAll('[data-cat-index]').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [categories])

  const goTo = (i: number): void => {
    setActive(i)
    document.getElementById('cat-' + i)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <CartaPortada hero={data.hero} slug={slug} businessName={businessName} open={data.open} />
      <CartaPagos pagos={data.pagos} rate={data.rate} />

      <div className={styles.sticky}>
        <div className={styles.wrap}>
          <div className={styles.search} role="search">
            <Search size={18} aria-hidden="true" />
            <input type="search" className={styles.searchInput} value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Busca un plato o ingrediente" aria-label="Buscar un plato o ingrediente" data-testid="buscador" />
          </div>
          <nav className={styles.tabs} aria-label="Categorías">
            {categories.map((c, i) => (
              <a key={c.name} href={'#cat-' + i} className={cx(styles.tab, active === i && styles.tabOn)} data-testid="tab" aria-current={active === i ? 'true' : undefined}
                onClick={e => { e.preventDefault(); goTo(i) }}>
                {c.name}<small>{c.dishes.length}</small>
              </a>
            ))}
          </nav>
        </div>
      </div>

      <main className={cx(styles.main, styles.wrap)}>
        {words.length === 0 && data.featured.length > 0 && (
          <section className={styles.house} aria-label="De la casa" data-testid="de-la-casa">
            <h2 className={styles.cat}>De la casa<small>lo que no se pierde nadie</small></h2>
            <div className={styles.houseGrid}>
              {data.featured.slice(0, HOUSE_MAX).map((d, i) => <CasaCard key={d.id} dish={d} slug={slug} big={i === 0 && data.featured.length >= HOUSE_MAX} />)}
            </div>
          </section>
        )}

        {categories.map((c, i) => (
          <section key={c.name} id={'cat-' + i} data-cat-index={i} data-testid="seccion">
            <h2 className={styles.cat}>{c.name}<small>{c.dishes.length === 1 ? '1 plato' : c.dishes.length + ' platos'}</small></h2>
            <div className={styles.items}>
              {c.dishes.map((d, j) => <PlatoCard key={d.id} dish={d} slug={slug} priority={i === 0 && j < 2} />)}
            </div>
          </section>
        ))}
        {categories.length === 0 && <p className={styles.vacio} data-testid="sin-resultados">Sin resultados para &ldquo;{query}&rdquo;. Prueba con otro plato o ingrediente.</p>}
      </main>

      <footer className={styles.footer}>
        <strong>{businessName}</strong>{city ? ' · ' + city : ''}
        {hoursText && <div>{hoursText}</div>}
      </footer>
    </>
  )
}
