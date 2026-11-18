import styles from './PlatformCredit.module.css'

/** Crédito de la plataforma: constante de ActivoPOS, NO configurable por el negocio. */
const PLATFORM_NAME = 'ActivoPOS.com'
const PLATFORM_URL = 'https://activopos.com'
const PLATFORM_ICON = '/activopos-logo-icon.svg'

interface PlatformCreditProps {
  /** Slug del negocio: viaja como utm_source para medir de qué catálogo llega cada visita. */
  slug: string
  /** Enlaces a las páginas legales del catálogo (ya resueltos para la plantilla y el dominio). Sin ellos, solo el crédito. */
  legal?: { privacidad: string; terminos: string }
}

/** "Desarrollado por ActivoPOS.com": una sola pieza para la Carta, el catálogo premium y el genérico; con las páginas legales al lado. */
export function PlatformCredit({ slug, legal }: PlatformCreditProps) {
  const href = PLATFORM_URL + '/?utm_source=' + encodeURIComponent(slug) + '&utm_medium=catalogo'
  return (
    <>
    {legal && (
      <nav className={styles.legal} aria-label="Información legal" data-testid="legal-links">
        <a href={legal.privacidad} className={styles.legalLink}>Privacidad</a>
        <a href={legal.terminos} className={styles.legalLink}>Términos</a>
      </nav>
    )}
    <p className={styles.credit} data-testid="platform-credit">
      <a href={href} target="_blank" rel="noopener" className={styles.link}>
        <img src={PLATFORM_ICON} alt="Logo de ActivoPOS" width={14} height={14} className={styles.icon} />
        <span>Desarrollado por <b>{PLATFORM_NAME}</b></span>
      </a>
    </p>
    </>
  )
}
