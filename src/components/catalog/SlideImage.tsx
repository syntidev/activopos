'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ImgWithFallback } from '@/app/catalogo-premium/[slug]/ImgWithFallback'
import { MOBILE_QUERY, objectPositionOf, type SlideMedia } from '@/lib/slide-media'
import styles from './SlideImage.module.css'

/** true en móvil (≤ 640 px), false en escritorio; null hasta montar (SSR). Se actualiza si cambia el viewport. */
export function useMobileViewport(): boolean | null {
  const [mobile, setMobile] = useState<boolean | null>(null)
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const update = (): void => setMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return mobile
}

interface SlideImageProps {
  media:      SlideMedia
  alt?:       string
  /** Primera imagen de la pantalla: sin lazy y con fetchpriority="high". Las demás, lazy. */
  priority?:  boolean
  className:  string
  fallback?:  ReactNode
}

/**
 * Imagen de slide/portada: NUNCA se deforma (object-fit: cover lo pone la clase del contenedor) y se recorta alrededor del
 * punto de enfoque. Con imagen móvil usa <picture> (≤ 640 px); si no, la de escritorio con su mismo enfoque.
 * Mismo camino de imagen que el resto del catálogo (ImgWithFallback, <img> directo: /storage lo sirve Nginx, no Next).
 */
export function SlideImage({ media, alt = '', priority = false, className, fallback = null }: SlideImageProps) {
  return (
    <picture className={styles.picture}>
      {media.mobile && <source media={MOBILE_QUERY} srcSet={media.mobile} />}
      <ImgWithFallback
        src={media.src}
        alt={alt}
        className={className}
        style={{ objectPosition: objectPositionOf(media) }}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        fallback={fallback}
      />
    </picture>
  )
}
