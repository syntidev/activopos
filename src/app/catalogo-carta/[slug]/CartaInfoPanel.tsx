'use client'

import { useEffect, useRef, useState } from 'react'
import { AtSign, MapPin, MessageCircle, Phone, Share2, X } from 'lucide-react'
import { CartaFoto } from './CartaFoto'
import { cx } from './util'
import styles from './carta.module.css'
import type { CartaHorarioDia, CartaInfo } from '@/types/carta'

interface CartaInfoPanelProps {
  businessName: string
  logo:         string | null
  info:         CartaInfo
  horario:      CartaHorarioDia[]
  /** WhatsApp en formato internacional (solo dígitos); null si no hay uno válido. */
  whatsapp:     string | null
  /** URL canónica del host (dominio propio o activopos.com), calculada en el servidor. */
  shareUrl:     string
  onClose:      () => void
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Panel ⓘ de la Carta: hoja inferior en móvil, tarjeta centrada en escritorio. Solo muestra lo que existe (sin secciones vacías). */
export function CartaInfoPanel({ businessName, logo, info, horario, whatsapp, shareUrl, onClose }: CartaInfoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  // Foco: entra al panel, queda atrapado (Tab cicla), Esc cierra y al cerrar vuelve al botón que lo abrió.
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!panelRef.current?.contains(active)) { e.preventDefault(); first.focus() }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previo?.focus() }
  }, [onClose])

  // Compartir: Web Share con la URL canónica; sin Web Share (escritorio) copia el enlace y avisa.
  const compartir = async (): Promise<void> => {
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: businessName, url: shareUrl }) } catch { /* el usuario canceló */ }
      return
    }
    try { await navigator.clipboard.writeText(shareUrl); setAviso('Enlace copiado') }
    catch { setAviso('Copia este enlace: ' + shareUrl) }
  }

  const tabla = horario.length > 0
  const hayContacto = !!whatsapp || !!info.instagram
  const mapsUrl = info.address ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(info.address) : null

  return (
    <>
      <div className={styles.velo} onClick={onClose} aria-hidden="true" />
      <div ref={panelRef} className={cx(styles.hoja, styles.infoHoja)} role="dialog" aria-modal="true" aria-labelledby="carta-info-titulo" data-testid="carta-info-panel">
        <div className={styles.hojaH}>
          <span className={styles.infoCab}>
            <span className={styles.infoLogo}>
              {logo ? <CartaFoto src={logo} alt="" sizes="56px" /> : <b aria-hidden="true">{businessName.trim().charAt(0).toUpperCase()}</b>}
            </span>
            <span className={styles.infoCabTxt}>
              <h2 id="carta-info-titulo">{businessName}</h2>
              {info.city && <span className={styles.infoCiudad}>{info.city}</span>}
              {info.estado && <span className={cx(styles.infoEstado, !info.estado.open && styles.encEstadoCerrado)} data-testid="carta-info-estado"><i aria-hidden="true" />{info.estado.label}</span>}
            </span>
          </span>
          <button type="button" className={styles.cerrar} onClick={onClose} aria-label="Cerrar información"><X size={20} aria-hidden="true" /></button>
        </div>

        {info.pagos.length > 0 && (
          <section className={styles.infoSec} data-testid="carta-info-pagos">
            <h3 className={styles.infoLabel}>Métodos de pago</h3>
            <ul className={styles.infoPills}>{info.pagos.map(p => <li key={p} className={styles.infoPill}>{p}</li>)}</ul>
          </section>
        )}

        {hayContacto && (
          <section className={styles.infoSec} data-testid="carta-info-contacto">
            <h3 className={styles.infoLabel}>Contáctanos</h3>
            <div className={styles.infoContactos}>
              {whatsapp && <a className={styles.infoBtn} href={'https://wa.me/' + whatsapp} target="_blank" rel="noopener noreferrer" data-testid="carta-info-whatsapp"><MessageCircle size={18} aria-hidden="true" />WhatsApp</a>}
              {info.instagram && <a className={styles.infoBtn} href={'https://instagram.com/' + info.instagram} target="_blank" rel="noopener noreferrer" data-testid="carta-info-instagram"><AtSign size={18} aria-hidden="true" />Instagram</a>}
              {whatsapp && <a className={styles.infoBtn} href={'tel:+' + whatsapp} data-testid="carta-info-llamar"><Phone size={18} aria-hidden="true" />Llamar</a>}
            </div>
          </section>
        )}

        {(tabla || info.hoursText) && (
          <section className={styles.infoSec} data-testid="carta-info-horario">
            <h3 className={styles.infoLabel}>Horarios</h3>
            {tabla
              ? <ul className={styles.horarioLista}>{horario.map(h => <li key={h.day} className={styles.horarioDia}><b>{h.day}</b><span>{h.text}</span></li>)}</ul>
              : <p className={styles.infoTexto}>{info.hoursText}</p>}
          </section>
        )}

        {info.address && mapsUrl && (
          <section className={styles.infoSec} data-testid="carta-info-direccion">
            <h3 className={styles.infoLabel}>Dirección</h3>
            <a className={styles.infoDir} href={mapsUrl} target="_blank" rel="noopener noreferrer"><MapPin size={18} aria-hidden="true" /><span>{info.address}</span></a>
          </section>
        )}

        <button type="button" className={cx(styles.infoBtn, styles.infoCompartir)} onClick={compartir} data-testid="carta-info-compartir"><Share2 size={18} aria-hidden="true" />Compartir</button>
        {aviso && <p className={styles.infoAviso} role="status" data-testid="carta-info-aviso">{aviso}</p>}
      </div>
    </>
  )
}
