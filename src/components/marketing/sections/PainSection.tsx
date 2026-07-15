'use client'

import { motion } from 'framer-motion'
import { EyeOff, Calculator, CircleHelp, TriangleAlert, type LucideIcon } from 'lucide-react'
import styles from './PainSection.module.css'

interface Pain {
  key:         string
  Icon:        LucideIcon
  title:       string
  desc:        string
  consequence: string
}

/* 3 dolores, los 3 con respaldo de producto ya construido (verificado
   antes de escribir la etiqueta de consecuencia -- ninguno es
   aspiracional):
   1. Reportes automáticos + cierre de caja de un clic (CierreConfirmModal,
      ReportesClient).
   2. DT-18 (commit 8e0fea0) -- tasa activa (manual o BCV automática) se
      aplica en tiempo real a cada venta, ya no hay 29 call-sites sueltos.
   3. Módulo Productos -- cost_per_unit_usd vs price_per_unit_usd por
      producto, columna "utility" ordenable (page.tsx:419-424). */
const PAINS: Pain[] = [
  {
    key: 'ventas-ciegas',
    Icon: EyeOff,
    title: 'No sabes cuánto vendiste hasta cerrar',
    desc: 'El día pasa, cobras, entregas — y solo ves el total cuando cierras caja. Para entonces ya no puedes corregir nada a tiempo.',
    consequence: 'Pérdida silenciosa de visibilidad',
  },
  {
    key: 'bcv-manual',
    Icon: Calculator,
    title: 'El dólar cambia y tú actualizas a mano',
    desc: 'Cada vez que se mueve la tasa, recalculas precios producto por producto. Un olvido y vendes por debajo de lo que deberías cobrar.',
    consequence: 'Pérdida silenciosa de margen',
  },
  {
    key: 'producto-ciego',
    Icon: CircleHelp,
    title: 'No sabes qué producto te da plata de verdad',
    desc: 'Vendes de todo, pero no sabes cuál producto deja utilidad real y cuál solo mueve inventario sin ganar casi nada.',
    consequence: 'Pérdida silenciosa de rentabilidad',
  },
]

export default function PainSection() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <h2 className={styles.title}>¿Cuánto perdiste hoy sin saberlo?</h2>
        <p className={styles.subtitle}>
          No son errores grandes. Son detalles que se te escapan todos los días — y que suman.
        </p>

        <motion.div
          className={styles.grid}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          transition={{ staggerChildren: 0.08 }}
        >
          {PAINS.map(({ key, Icon, title, desc, consequence }) => (
            <motion.div
              key={key}
              className={styles.card}
              variants={{
                hidden:  { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] } },
              }}
            >
              <span className={styles.cardIcon}>
                <Icon size={22} aria-hidden="true" />
              </span>
              <h3 className={styles.cardTitle}>{title}</h3>
              <p className={styles.cardDesc}>{desc}</p>
              <span className={styles.consequence}>
                <TriangleAlert size={12} aria-hidden="true" />
                {consequence}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
