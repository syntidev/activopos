import Image from 'next/image'
import styles from './carta.module.css'

interface CartaFotoProps {
  src:       string
  alt:       string
  /** Ancho real que ocupa la foto según el breakpoint (next/image elige el tamaño con esto). */
  sizes:     string
  priority?: boolean
}

/** Foto de la Carta con next/image: el contenedor define la proporción (4:5 en lista, 16:9 en hero). Las URL remotas no se optimizan. */
export function CartaFoto({ src, alt, sizes, priority = false }: CartaFotoProps) {
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} unoptimized={/^https?:\/\//.test(src)} className={styles.foto} />
}
