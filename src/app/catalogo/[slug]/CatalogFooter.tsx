import { MapPin, Phone, AtSign, Clock } from 'lucide-react'
import styles from './catalogo.module.css'

interface CatalogFooterProps {
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
  displayTitle, logoPath, catalogDesc, rif, address, location,
  waPhone, phone, catalogInstagram, catalogHours,
}: CatalogFooterProps) {
  return (
    <footer className={styles.footer}>
      {/* Zona superior — datos del negocio */}
      <div className={styles.footerTop}>

        {/* Logo + nombre + descripción + RIF */}
        <div className={styles.footerBrand}>
          {logoPath ? (
            <img
              src={logoPath}
              alt={displayTitle}
              className={styles.footerLogo}
            />
          ) : (
            <div className={styles.footerLogoFallback}>
              {displayTitle.charAt(0).toUpperCase()}
            </div>
          )}
          <p className={styles.footerBizName}>{displayTitle}</p>
          {catalogDesc && (
            <p className={styles.footerBizDesc}>{catalogDesc}</p>
          )}
          {rif && (
            <p className={styles.footerBizRif}>RIF: {rif}</p>
          )}
        </div>

        {/* Datos de contacto */}
        <div className={styles.footerContact}>
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
          {waPhone && (
            <div className={styles.footerContactRow}>
              <Phone size={14} className={styles.footerIcon} aria-hidden="true" />
              <a href={`tel:+${waPhone}`} className={styles.footerLink}>
                {phone}
              </a>
            </div>
          )}
          {catalogInstagram && (
            <div className={styles.footerContactRow}>
              <AtSign size={14} className={styles.footerIcon} aria-hidden="true" />
              <a
                href={`https://instagram.com/${catalogInstagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.footerLink}
              >
                @{catalogInstagram.replace('@', '')}
              </a>
            </div>
          )}
          {catalogHours && (
            <div className={styles.footerContactRow}>
              <Clock size={14} className={styles.footerIcon} aria-hidden="true" />
              <span>{catalogHours}</span>
            </div>
          )}
        </div>

      </div>

      {/* Zona inferior — copyright */}
      <div className={styles.footerBottom}>
        <span>© {new Date().getFullYear()} {displayTitle}</span>
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
