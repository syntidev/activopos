'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Menu, Search, X } from 'lucide-react'
import { PrecioDual } from '@/app/catalogo-premium/[slug]/PrecioDual'
import { PlatformCredit } from '@/components/catalog/PlatformCredit'
import { CartaBarraCompacta } from './CartaBarraCompacta'
import { CartaEncabezado } from './CartaEncabezado'
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
/** Alto de respaldo de la barra fija mientras no se mide. */
const BAR_FALLBACK = 64

function haystack(d: CartaDish): string {
  return plano([d.name, d.description ?? '', d.categoryName ?? '', d.sizes.map(s => s.label).join(' '), d.tags.join(' '), d.groups.map(g => g.name + ' ' + g.options.map(o => o.name).join(' ')).join(' ')].join(' '))
}

/** Tarjeta grande de "De la casa" (solo desde 1024 px: en móvil lo cubre el hero). */
function CasaCard({ dish, slug, big }: { dish: CartaDish; slug: string; big: boolean }) {
  const { quickAdd } = useAddDish(slug)
  return (
    <article className={cx(styles.hcard, big && styles.hcardBig)} data-testid="carta-de-la-casa-card" data-dish-id={dish.id}>
      {dish.image && <CartaFoto src={dish.image} alt={dish.name} sizes="(min-width: 1024px) 60vw, 100vw" />}
      <div className={styles.shade} />
      <div className={styles.hcardTxt}>
        <span className={styles.rank}>De la casa</span>
        <h3 className={styles.nombre} data-testid="carta-de-la-casa-nombre">{dish.name}</h3>
        {dish.description && <p>{dish.description}</p>}
        <div className={styles.hcardRow}>
          <PrecioDual variant="carta" priceUsd={dish.priceUsd} priceBs={dish.priceBs} divisaUsd={dish.divisaUsd} desde={dish.sizes.length > 0}
            testids={{ usd: 'carta-casa-precio-usd', bs: 'carta-casa-precio-bs' }} />
          <button type="button" className={styles.add} onClick={() => quickAdd(dish)}>Agregar</button>
        </div>
      </div>
    </article>
  )
}

export function CartaHome({ slug, businessName, hoursText, city, data }: CartaHomeProps) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [buscando, setBuscando] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const compactaRef = useRef<HTMLDivElement>(null)
  const barH = useRef(BAR_FALLBACK)
  const [compacto, setCompacto] = useState(false)
  // La barra compacta es fixed (su contenedor mide 0): se mide el hijo.
  const compactaAlto = (): number => (compactaRef.current?.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0

  const words = useMemo(() => plano(query).split(/\s+/).filter(Boolean).slice(0, MAX_WORDS), [query])
  const categories = useMemo(() => {
    if (words.length === 0) return data.categories
    return data.categories
      .map(c => ({ ...c, dishes: c.dishes.filter(d => words.every(w => haystack(d).includes(w))) }))
      .filter(c => c.dishes.length > 0)
  }, [data.categories, words])

  const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Alto real de la barra fija: separa el scroll-spy, el scroll al tocar un chip y el margen de las secciones.
  // Las DOS barras fijas cuentan: compacta (nombre/estado) + categorías; el salto a una sección queda bajo ambas.
  const measureBar = useCallback((): void => {
    const compactaH = compactaAlto()
    const h = (barRef.current?.offsetHeight ?? BAR_FALLBACK) + compactaH
    barH.current = h
    rootRef.current?.style.setProperty('--carta-bar-h', h + 'px')
    rootRef.current?.style.setProperty('--carta-compacta-alto', compactaH + 'px')
  }, [])
  useEffect(() => {
    measureBar()
    window.addEventListener('resize', measureBar)
    return () => window.removeEventListener('resize', measureBar)
  }, [measureBar, buscando])

  // Encabezado compacto: aparece cuando el encabezado grande sale por arriba y desaparece al volver.
  useEffect(() => {
    const enc = document.querySelector('[data-testid="carta-encabezado"]')
    if (!enc) return
    const io = new IntersectionObserver(([e]) => setCompacto(!e.isIntersecting && e.boundingClientRect.bottom <= 0))
    io.observe(enc)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    rootRef.current?.style.setProperty('--carta-top', compacto ? compactaAlto() + 'px' : '0px')
  }, [compacto])

  // Scroll-spy: activa = la última sección cuyo borde superior ya pasó la barra fija (o la última, al llegar al fondo).
  useEffect(() => {
    const onScroll = (): void => {
      const secs = Array.from(document.querySelectorAll<HTMLElement>('[data-cat-index]'))
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      let idx = 0
      secs.forEach((el, i) => { if (el.getBoundingClientRect().top <= barH.current + 16) idx = i })
      setActive(atBottom && secs.length > 0 ? secs.length - 1 : idx)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [categories])

  // La barra de chips se desplaza sola para CENTRAR el chip activo (suave; sin animación con reduced-motion).
  useEffect(() => {
    tabRefs.current[active]?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', inline: 'center', block: 'nearest' })
  }, [active])

  // Menú de categorías: se cierra con Escape o al tocar fuera.
  useEffect(() => {
    if (!menuAbierto) return
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') setMenuAbierto(false) }
    const onDown = (e: PointerEvent): void => { if (!barRef.current?.contains(e.target as Node)) setMenuAbierto(false) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown) }
  }, [menuAbierto])

  const goTo = (i: number): void => {
    const el = document.getElementById('cat-' + i)
    if (!el) return
    setActive(i)
    const top = el.getBoundingClientRect().top + window.scrollY - barH.current - 8
    window.scrollTo({ top, behavior: reducedMotion() ? 'auto' : 'smooth' })
  }

  const toggleBuscar = (): void => {
    setBuscando(v => { if (v) setQuery(''); return !v })
    setMenuAbierto(false)
  }

  return (
    <div ref={rootRef}>
      <div ref={compactaRef}><CartaBarraCompacta businessName={businessName} logo={data.brand.logo} open={data.open} visible={compacto} /></div>
      <CartaEncabezado businessName={businessName} covers={data.brand.covers} logo={data.brand.logo} address={data.brand.address} open={data.open} horario={data.horario} />
      <CartaPortada hero={data.hero} slug={slug} />
      <CartaPagos pagos={data.pagos} rate={data.rate} />

      <div className={styles.sticky} ref={barRef} data-testid="carta-barra-categorias">
        <div className={cx(styles.wrap, styles.barRow)}>
          <button type="button" className={cx(styles.barBtn, buscando && styles.barBtnOn)} onClick={toggleBuscar} aria-label={buscando ? 'Cerrar búsqueda' : 'Buscar un plato'} aria-expanded={buscando} data-testid="carta-buscar-btn">
            {buscando ? <X size={20} aria-hidden="true" /> : <Search size={20} aria-hidden="true" />}
          </button>
          <button type="button" className={cx(styles.barBtn, menuAbierto && styles.barBtnOn)} onClick={() => { setMenuAbierto(v => !v); setBuscando(false) }} aria-label="Menú de categorías" aria-expanded={menuAbierto} data-testid="carta-menu-btn">
            <Menu size={20} aria-hidden="true" />
          </button>
          <nav className={styles.tabs} aria-label="Categorías" role="tablist" data-testid="carta-tabs">
            {categories.map((c, i) => (
              <a key={c.name} href={'#cat-' + i} role="tab" ref={el => { tabRefs.current[i] = el }} className={cx(styles.tab, active === i && styles.tabOn)} data-testid={'carta-tab-' + c.slug} aria-selected={active === i}
                onClick={e => { e.preventDefault(); goTo(i) }}>
                {c.name}<small>{c.dishes.length}</small>
              </a>
            ))}
          </nav>
        </div>
        {buscando && (
          <div className={cx(styles.wrap, styles.searchPanel)}>
            <div className={styles.search} role="search">
              <Search size={18} aria-hidden="true" />
              <input type="search" className={styles.searchInput} value={query} onChange={e => setQuery(e.target.value)} autoFocus
                placeholder="Busca un plato o ingrediente" aria-label="Buscar un plato o ingrediente" data-testid="carta-buscador" />
            </div>
          </div>
        )}
        {menuAbierto && (
          <ul className={styles.catMenu} role="menu" aria-label="Categorías" data-testid="carta-menu-categorias">
            {categories.map((c, i) => (
              <li key={c.name} role="none">
                <button type="button" role="menuitem" className={cx(styles.catMenuItem, active === i && styles.catMenuItemOn)} onClick={() => { setMenuAbierto(false); goTo(i) }}>
                  <span>{c.name}</span><small>{c.dishes.length}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <main className={cx(styles.main, styles.wrap)}>
        {words.length === 0 && data.featured.length > 0 && (
          <section className={styles.house} aria-label="De la casa" data-testid="carta-de-la-casa">
            <h2 className={styles.cat}>De la casa<small>lo que no se pierde nadie</small></h2>
            <div className={styles.houseGrid}>
              {data.featured.map((d, i) => <CasaCard key={d.id} dish={d} slug={slug} big={i === 0 && data.featured.length >= 3} />)}
            </div>
          </section>
        )}

        {categories.map((c, i) => (
          <Fragment key={c.name}>
            {words.length === 0 && i > 0 && i % 3 === 0 && data.bandas[Math.floor(i / 3) - 1] && (
              <div className={styles.banda} data-testid="carta-banda"><CartaFoto src={data.bandas[Math.floor(i / 3) - 1]} alt="Ambiente del restaurante" sizes="100vw" /></div>
            )}
            <section id={'cat-' + i} data-cat-index={i} data-testid={'carta-seccion-' + c.slug}>
              <h2 className={styles.cat}>{c.name}<small>{c.dishes.length === 1 ? '1 plato' : c.dishes.length + ' platos'}</small></h2>
              <div className={styles.items}>
                {c.dishes.map((d, j) => <PlatoCard key={d.id} dish={d} slug={slug} priority={i === 0 && j < 2} />)}
              </div>
            </section>
          </Fragment>
        ))}
        {categories.length === 0 && <p className={styles.vacio} data-testid="carta-sin-resultados">Sin resultados para &ldquo;{query}&rdquo;. Prueba con otro plato o ingrediente.</p>}
      </main>

      <footer className={styles.footer}>
        <strong>{businessName}</strong>{city ? ' · ' + city : ''}
        {hoursText && <div>{hoursText}</div>}
        <PlatformCredit slug={slug} />
      </footer>
    </div>
  )
}
