'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { MapPin, Phone, AtSign, Clock, MessageCircle } from 'lucide-react'
import { catalogNav } from './catalogUtils'
import styles from './catalogo.module.css'

interface CatalogFooterProps {
  slug:             string
  displayTitle:     string
  logoPath:         string | null
  catalogDesc:      string | null
  rif:              string | null
  address:          string | null
  location:         string
  waPhone:          string
  phone:            string | null
  catalogInstagram: string | null
  catalogHours:     string | null
}

export function CatalogFooter({
  slug, displayTitle, logoPath, catalogDesc, rif, address, location,
  waPhone, phone, catalogInstagram, catalogHours,
}: CatalogFooterProps) {
  const [expanded, setExpanded]   = useState(false)
  const [overflows, setOverflows] = useState(false)
  const descRef = useRef<HTMLParagraphElement>(null)

  // "Leer más" solo aparece si el texto excede el clamp. Medir es la única forma
  // fiable: el largo en caracteres no dice cuántas líneas termina ocupando.
  useEffect(() => {
    const el = descRef.current
    if (!el) return
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [catalogDesc])

  const igHandle = catalogInstagram?.replace('@', '') ?? null

  return (
    <footer className={styles.footer}>
      <div className={styles.footerTop}>

        {/* BLOQUE A — logo, nombre y bio */}
        <div className={styles.footerBrand}>
          {logoPath ? (
            <img src={logoPath} alt={displayTitle} className={styles.footerLogo} />
          ) : (
            <div className={styles.footerLogoFallback}>
              {displayTitle.charAt(0).toUpperCase()}
            </div>
          )}
          <p className={styles.footerBizName}>{displayTitle}</p>
          {catalogDesc && (
            <>
              <p
                ref={descRef}
                className={`${styles.footerBizDesc} ${expanded ? styles.footerBizDescOpen : ''}`}
              >
                {catalogDesc}
              </p>
              {(overflows || expanded) && (
                <button
                  type="button"
                  className={styles.footerDescToggle}
                  onClick={() => setExpanded(v => !v)}
                  aria-expanded={expanded}
                >
                  {expanded ? 'Leer menos' : 'Leer más'}
                </button>
              )}
            </>
          )}
          {rif && <p className={styles.footerBizRif}>RIF: {rif}</p>}
        </div>

        {/* BLOQUE B — tres columnas de datos */}
        <div className={styles.footerCols}>

          <div className={styles.footerCol}>
            <p className={styles.footerColTitle}>Ubicaciones</p>
            {address && (
              <div className={styles.footerContactRow}>
                <MapPin size={14} className={styles.footerIcon} aria-hidden="true" />
                <span>{address}</span>
              </div>
            )}
            {location && (
              <div className={styles.footerContactRow}>
                <MapPin size={14} className={styles.footerIcon} aria-hidden="true" />
                <span>{location}</span>
              </div>
            )}
            {!address && !location && <span className={styles.footerColEmpty}>—</span>}
          </div>

          <div className={styles.footerCol}>
            <p className={styles.footerColTitle}>Contacto</p>
            {waPhone && (
              <div className={styles.footerContactRow}>
                <Phone size={14} className={styles.footerIcon} aria-hidden="true" />
                <a href={`tel:+${waPhone}`} className={styles.footerLink}>{phone}</a>
              </div>
            )}
            {igHandle && (
              <div className={styles.footerContactRow}>
                <AtSign size={14} className={styles.footerIcon} aria-hidden="true" />
                <a
                  href={`https://instagram.com/${igHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.footerLink}
                >
                  @{igHandle}
                </a>
              </div>
            )}
            {catalogHours && (
              <div className={styles.footerContactRow}>
                <Clock size={14} className={styles.footerIcon} aria-hidden="true" />
                <span>{catalogHours}</span>
              </div>
            )}
            {!waPhone && !igHandle && !catalogHours && (
              <span className={styles.footerColEmpty}>—</span>
            )}
          </div>

          {/* Solo WhatsApp e Instagram: son los únicos datos de red que existen
              en Business (phone y catalog_instagram). No hay campo de Facebook. */}
          <div className={styles.footerCol}>
            <p className={styles.footerColTitle}>Síguenos</p>
            {(waPhone || igHandle) ? (
              <div className={styles.footerSocials}>
                {waPhone && (
                  <a
                    href={`https://wa.me/${waPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.footerSocialBtn}
                    aria-label={`WhatsApp de ${displayTitle}`}
                  >
                    <MessageCircle size={16} aria-hidden="true" />
                  </a>
                )}
                {igHandle && (
                  <a
                    href={`https://instagram.com/${igHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.footerSocialBtn}
                    aria-label={`Instagram de ${displayTitle}`}
                  >
                    <AtSign size={16} aria-hidden="true" />
                  </a>
                )}
              </div>
            ) : (
              <span className={styles.footerColEmpty}>—</span>
            )}
          </div>

        </div>
      </div>

      {/* Barra de cierre */}
      <div className={styles.footerBottom}>
        <span>© {displayTitle} · {new Date().getFullYear()}</span>
        <nav className={styles.footerNav} aria-label="Navegación del catálogo">
          {catalogNav(slug).map(l => (
            <Link key={l.href} href={l.href} className={styles.footerNavLink}>
              {l.label}
            </Link>
          ))}
        </nav>
        <span>
          Impulsado por{' '}
          <a
            href="https://activopos.com"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.footerActivoLink}
          >
            ActivoPOS
          </a>
        </span>
      </div>
    </footer>
  )
}
