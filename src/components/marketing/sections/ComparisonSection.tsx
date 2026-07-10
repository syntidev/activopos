'use client'

import { motion } from 'framer-motion'
import { X, Check } from 'lucide-react'
import styles from './ComparisonSection.module.css'

const PAIRS = [
  { sin: 'Vendes, pero no sabes qué te quedó', con: 'Cada venta registrada al instante en USD y Bs' },
  { sin: 'Cobras y cuadras a ojo al final del día', con: 'BCV actualizado automáticamente, siempre' },
  { sin: 'Repones cuando ya se acabó', con: 'Alerta de stock crítico configurable' },
  { sin: 'WhatsApps con precios uno a uno', con: 'Catálogo digital activo 24/7 con pedidos' },
]

const fadeSide = (dir: 'left' | 'right', delay: number) => ({
  initial: { opacity: 0, x: dir === 'left' ? -24 : 24 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, ease: 'easeOut' as const, delay },
})

export default function ComparisonSection() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.copy}>
          <h2 className={styles.title} data-reveal>
            Un sistema que trabaja<br />como trabaja tu negocio.
          </h2>
        </div>

        <div className={styles.grid}>
          <div className={styles.col}>
            <div className={`${styles.head} ${styles.headBad}`}>Sin ActivoPOS</div>
            {PAIRS.map((p, i) => (
              <motion.div key={p.sin} className={`${styles.card} ${styles.cardBad}`} {...fadeSide('left', i * 0.08)}>
                <X size={14} aria-hidden className={styles.cardIconBad} />
                <span>{p.sin}</span>
              </motion.div>
            ))}
          </div>

          <div className={styles.col}>
            <div className={`${styles.head} ${styles.headGood}`}>Con ActivoPOS</div>
            {PAIRS.map((p, i) => (
              <motion.div key={p.con} className={`${styles.card} ${styles.cardGood}`} {...fadeSide('right', i * 0.08)}>
                <Check size={14} aria-hidden className={styles.cardIconGood} />
                <span>{p.con}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
