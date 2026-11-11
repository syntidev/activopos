'use client'

import { useCatalogHref } from '@/components/catalog/CatalogLinks'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Info } from 'lucide-react'
import { PrecioDual } from '@/app/catalogo-premium/[slug]/PrecioDual'
import { useCart } from '@/app/catalogo-premium/[slug]/CartContext'
import { CARTA_TAG_LABEL } from '@/lib/carta/vocab'
import { CartaFoto } from './CartaFoto'
import { CartaOpciones, gruposFaltantes, opcionesDeCarrito, type Elegidas } from './CartaOpciones'
import { PlatoCard } from './PlatoCard'
import { useAddDish } from './useAddDish'
import { allergenText, cx, fmtUsd, TAG_CLASS } from './util'
import styles from './carta.module.css'
import type { CartaDish, CartaSize } from '@/types/carta'

const NOTE_MAX = 140

interface CartaFichaProps {
  dish:    CartaDish
  slug:    string
  rate:    number
  /** "También te puede gustar": ya resueltos en el servidor (más pedidos juntos o la misma categoría). */
  related: CartaDish[]
}

/** Ficha del plato: tamaños y opciones como botones grandes (las obligatorias bloquean "Agregar"), cantidad, nota para la cocina. */
export function CartaFicha({ dish, slug, rate, related }: CartaFichaProps) {
  const href = useCatalogHref(slug, 'carta')
  const { add } = useAddDish(slug)
  const { setCartOpen } = useCart()
  const sizes = [...dish.sizes].sort((a, b) => a.priceUsd - b.priceUsd)
  const [size, setSize] = useState<CartaSize | null>(sizes.find(s => !s.soldOut) ?? null)
  const [elegidas, setElegidas] = useState<Elegidas>({})
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [ok, setOk] = useState(false)
  const paginaRef = useRef<HTMLDivElement>(null)
  const barraRef = useRef<HTMLDivElement>(null)

  // Alto REAL de la barra fija "Agregar" → margen inferior de la página (--carta-barra-h), para que ninguna tarjeta quede detrás.
  useEffect(() => {
    const barra = barraRef.current
    const pagina = paginaRef.current
    if (!barra || !pagina) return
    const medir = (): void => { pagina.style.setProperty('--carta-barra-h', (getComputedStyle(barra).position === 'fixed' ? barra.offsetHeight : 0) + 'px') }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(barra)
    window.addEventListener('resize', medir)
    return () => { ro.disconnect(); window.removeEventListener('resize', medir) }
  }, [])

  const opciones = opcionesDeCarrito(dish.groups, elegidas)
  const extra = opciones.reduce((s, o) => s + o.price_usd, 0)
  const unit = Math.round(((size ? size.priceUsd : dish.priceUsd) + extra) * 100) / 100
  const faltan = gruposFaltantes(dish.groups, elegidas)
  const agotado = dish.outOfStock || dish.soldOutToday
  const bloqueado = agotado || dish.onRequest || (sizes.length > 0 && !size) || faltan.length > 0

  const agregar = (): void => {
    add(dish, { size, qty, note, options: opciones })
    setOk(true)
    setQty(1)
    setNote('')
    setElegidas({})
  }

  return (
    <div ref={paginaRef} className={styles.fichaPagina}>
      <article className={styles.ficha} data-testid="carta-ficha">
        {dish.image ? (
          <div className={styles.fichaFoto}>
            <Link href={href()} className={styles.volver} aria-label="Volver a la carta">‹</Link>
            <CartaFoto src={dish.image} alt={dish.name} sizes="(min-width: 1024px) 560px, 100vw" priority />
            {dish.soldOutToday && <span className={styles.agot} data-testid="carta-agotado-hoy">Agotado hoy</span>}
          </div>
        ) : (
          // Sin foto: una franja del color del preset con el nombre (sin letra gigante).
          <div className={styles.fichaFranja} data-testid="carta-ficha-franja">
            <Link href={href()} className={styles.volverFranja} aria-label="Volver a la carta">‹</Link>
            <h1>{dish.name}</h1>
            {dish.soldOutToday && <span className={styles.agot} data-testid="carta-agotado-hoy">Agotado hoy</span>}
          </div>
        )}
        <div className={styles.fichaBody}>
          {dish.tags.length > 0 && (
            <div className={styles.tags}>{dish.tags.map(t => <span key={t} className={cx(styles.tag, styles[TAG_CLASS[t]])} data-testid="carta-etiqueta" data-etiqueta={t}>{CARTA_TAG_LABEL[t]}</span>)}</div>
          )}
          {dish.image && <h1>{dish.name}</h1>}
          <div className={styles.campo}>
            <PrecioDual variant="carta" size="modal" priceUsd={unit} priceBs={unit * rate} divisaUsd={size || opciones.length > 0 ? null : dish.divisaUsd}
              testids={{ usd: 'carta-ficha-precio', bs: 'carta-ficha-precio-bs' }} />
          </div>
          {dish.description && <p className={styles.fichaDesc}>{dish.description}</p>}
          {dish.allergens.length > 0 && (
            <div className={styles.alergBloque} data-testid="carta-alergenos" role="note">
              <Info size={16} aria-hidden="true" />
              <span><b>Alérgenos:</b> contiene {allergenText(dish.allergens)}. Si tienes alguna alergia, avísanos en la nota.</span>
            </div>
          )}

          {sizes.length > 0 && (
            <section className={styles.grupo}>
              <div className={styles.grupoH}><h2 id="lbl-tamano">Elige el tamaño</h2><span className={styles.req}>Obligatorio</span></div>
              <div className={styles.tamanos} role="radiogroup" aria-labelledby="lbl-tamano">
                {sizes.map(s => (
                  <button key={s.id} type="button" role="radio" aria-checked={size?.id === s.id} disabled={s.soldOut} data-testid="carta-tamano" data-tamano={s.label}
                    className={cx(styles.tam, size?.id === s.id && styles.tamOn)} onClick={() => setSize(s)}>
                    <b>{s.label}</b><span>{s.soldOut ? 'Agotado' : fmtUsd(s.priceUsd)}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <CartaOpciones groups={dish.groups} elegidas={elegidas} onChange={setElegidas} />

          <div className={styles.campo}>
            <label htmlFor="nota-cocina">Nota para la cocina (opcional)</label>
            <textarea id="nota-cocina" className={styles.input} maxLength={NOTE_MAX} value={note} onChange={e => setNote(e.target.value)} placeholder="Ej.: sin cebolla, bien cocido…" data-testid="carta-nota" />
            <small className={styles.nTam}>{note.length}/{NOTE_MAX}</small>
          </div>

          {ok && (
            <div className={styles.listo} role="status" data-testid="carta-agregado">
              <span>Agregado a tu pedido.</span>
              <Link href={href()}>Seguir viendo la carta</Link>
              <button type="button" onClick={() => setCartOpen(true)}>Ver mi pedido</button>
            </div>
          )}
          {faltan.length > 0 && !agotado && <p className={styles.aviso} data-testid="carta-faltan" role="status">Elige {faltan.map(g => g.name).join(' y ')} para poder agregar.</p>}

          <div className={styles.barra} ref={barraRef}>
            <div className={styles.pasos}>
              <button type="button" className={styles.paso} onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Una menos" data-testid="carta-cantidad-menos">−</button>
              <span className={styles.cant} data-testid="carta-cantidad-valor">{qty}</span>
              <button type="button" className={cx(styles.paso, styles.pasoMas)} onClick={() => setQty(q => Math.min(20, q + 1))} aria-label="Una más" data-testid="carta-cantidad-mas">+</button>
            </div>
            <button type="button" className={styles.btn} onClick={agregar} disabled={bloqueado} data-testid="carta-ficha-agregar">
              {agotado ? (dish.soldOutToday ? 'Agotado hoy' : 'Agotado') : dish.onRequest ? 'Consultar precio' : 'Agregar · ' + fmtUsd(unit * qty)}
            </button>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className={styles.relacionados} aria-label="También te puede gustar" data-testid="carta-relacionados">
          <h2 className={styles.cat}>También te puede gustar</h2>
          <div className={styles.items}>{related.map(d => <PlatoCard key={d.id} dish={d} slug={slug} />)}</div>
        </section>
      )}
    </div>
  )
}
