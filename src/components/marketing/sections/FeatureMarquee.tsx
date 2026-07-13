'use client'

import { motion, useReducedMotion } from 'framer-motion'
import styles from './FeatureMarquee.module.css'

const FEATURES = [
  'BCV automático en cada cobro',
  'Escanea con tu celular',
  'Catálogo digital 24/7',
  'Pago Móvil',
  'Zelle',
  'Binance',
  'Tu día, en criollo',
  'Sin contratos',
]

const MARQUEE_TEXT = FEATURES.join(' ✦ ') + ' ✦ '

export default function FeatureMarquee() {
  const reduceMotion = useReducedMotion()

  return (
    <div className={styles.wrap} aria-hidden="true">
      <div className={styles.rotated}>
        <motion.div
          className={styles.track}
          animate={reduceMotion ? undefined : { x: ['0%', '-50%'] }}
          transition={reduceMotion ? undefined : { duration: 28, repeat: Infinity, ease: 'linear' }}
        >
          <span className={styles.item}>{MARQUEE_TEXT}</span>
          <span className={styles.item}>{MARQUEE_TEXT}</span>
        </motion.div>
      </div>
    </div>
  )
}
