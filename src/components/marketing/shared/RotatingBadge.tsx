'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import styles from './RotatingBadge.module.css'

const PHRASES = [
  'Punto de venta',
  'Sistema de inventario',
  'Catálogo digital',
  'Ticket de venta',
  'Control de stock',
  'Cierre contable diario',
]

const ROTATE_MS = 2200

export default function RotatingBadge() {
  const [index, setIndex] = useState(0)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % PHRASES.length)
    }, ROTATE_MS)
    return () => clearInterval(timer)
  }, [])

  const variants = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { y: '100%', opacity: 0 },
        animate: { y: '0%',   opacity: 1 },
        exit:    { y: '-100%', opacity: 0 },
      }

  return (
    <span className={styles.badge}>
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={variants.initial}
          animate={variants.animate}
          exit={variants.exit}
          transition={{ duration: reduceMotion ? 0.2 : 0.35, ease: [0.25, 0.1, 0.25, 1] }}
          className={styles.phrase}
        >
          {PHRASES[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
