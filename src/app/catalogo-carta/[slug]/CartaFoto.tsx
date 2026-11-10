import { ImgWithFallback } from '@/app/catalogo-premium/[slug]/ImgWithFallback'
import styles from './carta.module.css'

interface CartaFotoProps {
  src:       string
  alt:       string
  /** Se conserva por compatibilidad con los usos existentes; un <img> simple no necesita `sizes`. */
  sizes?:    string
  priority?: boolean
}

/**
 * Foto de la Carta: MISMO camino que el catálogo premium (ImgWithFallback, <img> directo). Nada de next/image con optimización:
 * /storage lo sirve Nginx en producción, no Next, y el optimizador pedía el archivo a Next (404 → fotos rotas).
 * El contenedor define la proporción; la imagen lo llena (ver .foto).
 */
export function CartaFoto({ src, alt, priority = false }: CartaFotoProps) {
  return <ImgWithFallback src={src} alt={alt} loading={priority ? 'eager' : 'lazy'} className={styles.foto} fallback={null} />
}
