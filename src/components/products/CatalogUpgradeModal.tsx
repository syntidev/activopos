'use client'

import { Globe, Check, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useScrollLock } from '@/hooks/useScrollLock'
import { WHATSAPP_NUMBER } from '@/lib/marketing-contact'
import styles from './CatalogUpgradeModal.module.css'

interface CatalogUpgradeModalProps {
  open: boolean
  onClose: () => void
}

const BENEFITS = [
  'Enlace público compartible por WhatsApp',
  'Clientes ven precios y disponibilidad en tiempo real',
  'Compatible con WhatsApp Business y redes sociales',
  'Fotos, descripción y variantes visibles',
]

export function CatalogUpgradeModal({ open, onClose }: CatalogUpgradeModalProps) {
  useScrollLock(open)

  const handleCTA = () => {
    const text = encodeURIComponent(
      'Hola, quiero activar el Catálogo Digital de ActivoPOS.'
    )
    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
              <X size={16} aria-hidden="true" />
            </button>

            <div className={styles.iconWrap}>
              <Globe size={28} aria-hidden="true" />
            </div>

            <h2 className={styles.title}>Activa tu Catálogo Digital</h2>
            <p className={styles.subtitle}>
              Comparte tu catálogo de productos en línea con un enlace único para tu negocio.
            </p>

            <ul className={styles.benefits}>
              {BENEFITS.map((b) => (
                <li key={b} className={styles.benefit}>
                  <Check size={14} className={styles.checkIcon} aria-hidden="true" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <button className={styles.ctaBtn} onClick={handleCTA} type="button">
              Contactar a Soporte
            </button>
            <button className={styles.cancelBtn} onClick={onClose} type="button">
              Quizás después
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
