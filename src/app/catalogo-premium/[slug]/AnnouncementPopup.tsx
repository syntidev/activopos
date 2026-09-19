'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import type { AnnouncementPopupConfig } from '@/lib/landing-sections'
import { ImgWithFallback } from './ImgWithFallback'
import styles from './catalogo.module.css'

interface Props {
  config:     AnnouncementPopupConfig
  businessId: number
  sectionId:  number
}

// Una sola vez por navegador -- localStorage por tenant+sección, nunca marca
// visto antes de que el visitante realmente lo cierre (X/backdrop/CTA).
export function AnnouncementPopup({ config, businessId, sectionId }: Props) {
  const [open, setOpen]   = useState(false)
  const reducedMotion     = useReducedMotion()
  const storageKey        = `popup_seen_${businessId}_${sectionId}`

  useEffect(() => {
    let alreadySeen = false
    try { alreadySeen = localStorage.getItem(storageKey) === '1' } catch { /* private mode / storage bloqueado */ }
    if (alreadySeen) return
    const timer = setTimeout(() => setOpen(true), config.delay_ms)
    return () => clearTimeout(timer)
  }, [storageKey, config.delay_ms])

  const dismiss = () => {
    setOpen(false)
    try { localStorage.setItem(storageKey, '1') } catch { /* ignore */ }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.popupBackdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.25, ease: 'easeOut' }}
          onClick={dismiss}
        >
          <motion.div
            className={styles.popupModal}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
            transition={{ duration: reducedMotion ? 0 : 0.25, ease: 'easeOut' }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={config.heading}
          >
            <button
              type="button"
              className={styles.popupClose}
              onClick={dismiss}
              aria-label="Cerrar"
            >
              <X size={18} aria-hidden="true" />
            </button>

            <ImgWithFallback
              src={config.image_url}
              className={styles.popupImg}
              fallback={<div className={styles.popupImgPlaceholder} aria-hidden="true" />}
            />

            <div className={styles.popupBody}>
              <h2 className={styles.popupHeading}>{config.heading}</h2>
              {config.cta_text && (
                <a
                  href={config.cta_link ?? '#'}
                  className={styles.popupCta}
                  onClick={dismiss}
                >
                  {config.cta_text}
                </a>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
