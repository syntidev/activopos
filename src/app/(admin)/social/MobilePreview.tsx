'use client'

import { useState } from 'react'
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from 'lucide-react'
import styles from './MobilePreview.module.css'

interface MobilePreviewProps {
  imageUrl: string
  caption:  string | null
}

/**
 * Mockup de teléfono real -- PIEZA 3. Mismo criterio que SlideRenderer de Open Carrusel
 * (contenedor escalado a proporción real de la pieza), acá aplicado a la imagen ya
 * rasterizada en vez de un iframe HTML en vivo. El aspect-ratio real se lee del propio
 * archivo (onLoad) para que el hueco de imagen nunca desencaje del recorte real que
 * hizo compose.ts/Puppeteer -- ningún prop de aspecto que se pueda desincronizar.
 */
export function MobilePreview({ imageUrl, caption }: MobilePreviewProps) {
  const [ratio, setRatio] = useState(4 / 5)

  return (
    <div className={styles.phoneWrap}>
      <div className={styles.phone}>
        <div className={styles.notch} aria-hidden="true" />
        <div className={styles.screen}>
          <div className={styles.igHeader}>
            <span className={styles.igAvatar} aria-hidden="true" />
            <span className={styles.igUsername}>activopos</span>
            <MoreHorizontal size={16} className={styles.igMore} aria-hidden="true" />
          </div>

          <div className={styles.igImageWrap} style={{ aspectRatio: ratio }}>
            {imageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                className={styles.igImage}
                src={imageUrl}
                alt="Vista previa de la publicación"
                onLoad={e => {
                  const img = e.currentTarget
                  if (img.naturalWidth && img.naturalHeight) {
                    setRatio(img.naturalWidth / img.naturalHeight)
                  }
                }}
              />
            )}
          </div>

          <div className={styles.igActions}>
            <Heart size={22} aria-hidden="true" />
            <MessageCircle size={22} aria-hidden="true" />
            <Send size={22} aria-hidden="true" />
            <Bookmark size={22} className={styles.igBookmark} aria-hidden="true" />
          </div>

          {caption && (
            <p className={styles.igCaption}>
              <strong>activopos</strong> {caption}
            </p>
          )}
        </div>
        <div className={styles.homeIndicator} aria-hidden="true" />
      </div>
    </div>
  )
}
