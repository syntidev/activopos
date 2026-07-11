'use client'

import { motion } from 'framer-motion'
import { ShoppingCart, PackageCheck, TrendingUp, type LucideIcon } from 'lucide-react'
import styles from './DifferentiatorsSection.module.css'

interface Pilar {
  Icon:    LucideIcon
  title:   string
  sub:     string
  variant: 'vende' | 'controla' | 'entiende'
}

const PILARES: Pilar[] = [
  { Icon: ShoppingCart, title: 'Vende',    sub: 'Cobra en segundos. BCV automático en cada venta, Pago Móvil, Zelle o efectivo.', variant: 'vende'    },
  { Icon: PackageCheck, title: 'Controla', sub: 'Sabes qué tienes, qué falta y qué se vendió — sin libreta, sin adivinar.',       variant: 'controla' },
  { Icon: TrendingUp,   title: 'Entiende', sub: 'De cada venta, sabes qué de verdad ganaste. Sin calculadora, sin Excel.',        variant: 'entiende' },
]

export default function DifferentiatorsSection() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <motion.h2
          className={styles.title}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          Tres cosas. Eso es todo lo que necesitas.
        </motion.h2>

        <div className={styles.grid}>
          {PILARES.map(({ Icon, title, sub, variant }, i) => (
            <motion.div
              key={title}
              className={`${styles.card} ${styles[`card_${variant}`]}`}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.08 }}
              whileHover={{ y: -2, transition: { duration: 0.15 } }}
            >
              <span className={styles.iconWrap}>
                <Icon size={22} aria-hidden="true" className={styles[`icon_${variant}`]} />
              </span>
              <h3 className={styles.cardTitle}>{title}</h3>
              <p className={styles.cardSub}>{sub}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
