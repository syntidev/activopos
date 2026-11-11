'use client'

import { useState } from 'react'
import { ChevronDown, MapPin } from 'lucide-react'
import { CartaFoto } from './CartaFoto'
import { SlideImage, useMobileViewport } from '@/components/catalog/SlideImage'
import { isVisibleOn, type SlideMedia } from '@/lib/slide-media'
import { cx } from './util'
import styles from './carta.module.css'
import type { CartaHorarioDia, CartaOpenState } from '@/types/carta'

interface CartaEncabezadoProps {
  businessName: string
  /** Portada(s) del negocio (catalog_cover_path…): una sola a lo ancho, o un carrusel si hay varias. */
  covers:       SlideMedia[]
  logo:         string | null
  address:      string | null
  open:         CartaOpenState | null
  horario:      CartaHorarioDia[]
}

/** Encabezado como ordena.menu: portada a sangre, logo en círculo superpuesto con anillo y sombra, nombre, estado y dirección. */
export function CartaEncabezado({ businessName, covers, logo, address, open, horario }: CartaEncabezadoProps) {
  const [index, setIndex] = useState(0)
  const mobile = useMobileViewport()
  const visibles = covers.filter(c => isVisibleOn(c.showOn, mobile))
  const initial = businessName.trim().charAt(0).toUpperCase()

  return (
    <header className={styles.enc} data-testid="carta-encabezado">
      <div className={styles.portadaNegocio} data-testid="carta-portada-negocio">
        {visibles.length > 0 && (
          <div className={styles.portadaSlides} onScroll={e => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
            {visibles.map((c, i) => (
              <div key={c.src} className={styles.portadaSlide} data-show={c.showOn}><SlideImage media={c} alt={i === 0 ? businessName : businessName + ' ' + (i + 1)} priority={i === 0} className={styles.foto} /></div>
            ))}
          </div>
        )}
        {visibles.length > 1 && (
          <div className={styles.portadaDots} aria-hidden="true">{visibles.map((c, i) => <i key={c.src} className={cx(styles.dot, i === index && styles.dotOn)} />)}</div>
        )}
      </div>

      <div className={styles.encInfo}>
        <span className={styles.encLogo} data-testid="carta-logo">
          {logo ? <CartaFoto src={logo} alt={businessName} sizes="96px" priority /> : <b aria-hidden="true">{initial}</b>}
        </span>
        <h1 className={styles.encNombre} data-testid="carta-nombre">{businessName}</h1>
        {open && (
          <p className={cx(styles.encEstado, !open.open && styles.encEstadoCerrado)} data-testid="carta-estado"><i aria-hidden="true" />{open.label}</p>
        )}
        {address && <p className={styles.encDir} data-testid="carta-direccion-negocio"><MapPin size={14} aria-hidden="true" />{address}</p>}
      </div>

      {horario.length > 0 && (
        <details className={styles.horario} data-testid="carta-horario">
          <summary className={styles.horarioResumen}>
            <span className={styles.horarioLinea}>Ver horario</span>
            <ChevronDown size={16} aria-hidden="true" className={styles.horarioFlecha} />
          </summary>
          <ul className={styles.horarioLista}>
            {horario.map(h => <li key={h.day} className={styles.horarioDia}><b>{h.day}</b><span>{h.text}</span></li>)}
          </ul>
        </details>
      )}
    </header>
  )
}
