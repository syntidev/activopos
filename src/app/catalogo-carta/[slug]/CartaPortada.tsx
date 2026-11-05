'use client'

import { useEffect, useRef, useState } from 'react'
import { PrecioDual } from '@/app/catalogo-premium/[slug]/PrecioDual'
import { CartaFoto } from './CartaFoto'
import { useAddDish } from './useAddDish'
import { cx } from './util'
import styles from './carta.module.css'
import type { CartaHero, CartaOpenState } from '@/types/carta'

const AUTOPLAY_MS = 5000
const RESUME_MS = 6000

interface CartaPortadaProps {
  hero:         CartaHero
  slug:         string
  businessName: string
  open:         CartaOpenState | null
}

/** Portada: slider a sangre completa (event_slider del negocio, o favoritos/recomendados), estado abierto/cerrado y marca. */
export function CartaPortada({ hero, slug, businessName, open }: CartaPortadaProps) {
  const track = useRef<HTMLDivElement>(null)
  const paused = useRef(false)
  const [index, setIndex] = useState(0)
  const [reduced, setReduced] = useState(false)
  const [okKey, setOkKey] = useState<string | null>(null)
  const { quickAdd } = useAddDish(slug)
  const n = hero.slides.length

  useEffect(() => { setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches) }, [])

  const go = (i: number): void => {
    const el = track.current
    if (!el || n === 0) return
    el.scrollTo({ left: ((i + n) % n) * el.clientWidth, behavior: reduced ? 'auto' : 'smooth' })
  }

  // Autoplay suave: se reinicia con cada cambio de slide; pausa al tocar, pasar el mouse o enfocar; nada con reduced-motion.
  useEffect(() => {
    if (reduced || n < 2) return
    const id = setInterval(() => { if (!paused.current) go(index + 1) }, AUTOPLAY_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, n, index])

  const initials = businessName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const top = (
    <div className={styles.herotop}>
      <div className={styles.brand}><span className={styles.logo}>{initials}</span><span className={styles.bn}>{businessName}</span></div>
      {open && (
        <span className={cx(styles.estado, !open.open && styles.estadoCerrado)} data-testid="estado">
          <i /><span className={styles.sm}>{open.label.split(' · ')[0]}</span><span className={styles.lg}>{open.label}</span>
        </span>
      )}
    </div>
  )

  if (n === 0) return <section className={cx(styles.hero, styles.heroSolo)} data-testid="hero">{top}</section>

  return (
    <section
      className={styles.hero}
      aria-roledescription="carrusel"
      aria-label={hero.kicker}
      data-testid="hero"
      data-kind={hero.kind}
      data-autoplay={reduced || n < 2 ? 'off' : 'on'}
      data-slide={index}
      onPointerDown={() => { paused.current = true }}
      onTouchStart={() => { paused.current = true }}
      onMouseEnter={() => { paused.current = true }}
      onMouseLeave={() => { paused.current = false }}
      onFocus={() => { paused.current = true }}
      onBlur={() => { paused.current = false }}
      onPointerUp={() => { setTimeout(() => { paused.current = false }, RESUME_MS) }}
    >
      <div className={styles.slides} ref={track} onScroll={e => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {hero.slides.map((s, i) => (
          <div key={s.key} className={cx(styles.slide, !s.image && styles.slideTipo, s.dark && styles.oscuro)} data-testid="hero-slide">
            {s.image && <CartaFoto src={s.image} alt={s.title} sizes="100vw" priority={i === 0} />}
            <div className={styles.shade} />
            <div className={styles.cap}>
              {hero.kind === 'dishes' && <span className={styles.rank}>{hero.kicker === 'Recomendados' ? 'Recomendado' : 'N.º ' + (i + 1) + ' de la casa'}</span>}
              <h2 className={styles.capTitulo}>{s.title}</h2>
              {s.subtitle && <p className={styles.capDesc}>{s.subtitle}</p>}
              <div className={styles.herorow}>
                {s.dish ? (
                  <>
                    <PrecioDual variant="carta" priceUsd={s.dish.priceUsd} priceBs={s.dish.priceBs} divisaUsd={s.dish.divisaUsd} desde={s.dish.sizes.length > 0} />
                    <button
                      type="button" className={styles.btnHero} data-testid="hero-agregar"
                      onClick={() => { if (s.dish && quickAdd(s.dish)) { setOkKey(s.key); setTimeout(() => setOkKey(null), 1100) } }}
                    >
                      {okKey === s.key ? 'Agregado' : s.dish.sizes.length > 0 ? 'Elegir tamaño' : 'Agregar'}
                    </button>
                  </>
                ) : s.cta ? (
                  <a className={styles.btnHero} href={s.cta.href}>{s.cta.text}</a>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
      {top}
      <div className={styles.kicker}>{hero.kicker}</div>
      {n > 1 && <div className={styles.dots} aria-hidden="true">{hero.slides.map((s, i) => <i key={s.key} className={cx(styles.dot, i === index && styles.dotOn)} />)}</div>}
    </section>
  )
}
