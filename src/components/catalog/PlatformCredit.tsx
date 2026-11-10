import styles from './PlatformCredit.module.css'

/** Crédito de la plataforma: constante de ActivoPOS, NO configurable por el negocio. */
const PLATFORM_NAME = 'ActivoPOS.com'
const PLATFORM_URL = 'https://activopos.com'
const PLATFORM_ICON = '/activopos-logo-icon.svg'

interface PlatformCreditProps {
  /** Slug del negocio: viaja como utm_source para medir de qué catálogo llega cada visita. */
  slug: string
}

/** "Desarrollado por ActivoPOS.com": una sola pieza para la Carta, el catálogo premium y el genérico. */
export function PlatformCredit({ slug }: PlatformCreditProps) {
  const href = PLATFORM_URL + '/?utm_source=' + encodeURIComponent(slug) + '&utm_medium=catalogo'
  return (
    <p className={styles.credit} data-testid="platform-credit">
      <a href={href} target="_blank" rel="noopener" className={styles.link}>
        <img src={PLATFORM_ICON} alt="" width={14} height={14} className={styles.icon} aria-hidden="true" />
        <span>Desarrollado por <b>{PLATFORM_NAME}</b></span>
      </a>
    </p>
  )
}
