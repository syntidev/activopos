'use client'

import { motion } from 'framer-motion'
import { Zap, Scan, Globe, type LucideIcon } from 'lucide-react'
import styles from './DifferentiatorsSection.module.css'

interface Diff {
  Icon:  LucideIcon
  title: string
  sub:   string
  badge?: string
}

const DIFFS: Diff[] = [
  { Icon: Zap,    title: 'BCV en cada cobro',        sub: 'La tasa oficial actualizada sola. Sin calcular.' },
  { Icon: Scan,   title: 'Escáner desde tu cámara',  sub: 'Sin pistola, sin hardware. El único POS en Venezuela que lo tiene.', badge: 'Exclusivo ActivoPOS' },
  { Icon: Globe,  title: 'Corre en el navegador',    sub: 'Sin descargas, sin actualizaciones manuales.' },
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
          Por qué ActivoPOS es diferente
        </motion.h2>

        <div className={styles.grid}>
          {DIFFS.map(({ Icon, title, sub, badge }, i) => (
            <motion.div
              key={title}
              className={styles.card}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.08 }}
              whileHover={{
                x: -2, y: -2, boxShadow: '6px 6px 0 #0038BD',
                transition: { duration: 0.15 },
              }}
            >
              {badge && <span className={styles.badge}>{badge}</span>}
              <motion.span className={styles.iconWrap} whileHover={{ rotate: 12, scale: 1.2 }}>
                <Icon size={24} aria-hidden="true" />
              </motion.span>
              <h3 className={styles.cardTitle}>{title}</h3>
              <p className={styles.cardSub}>{sub}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
