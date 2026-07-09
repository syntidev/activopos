'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown, Beef, Utensils, Wrench, Pill, Shirt, ShoppingBasket, Monitor,
  Car, Briefcase, Coffee, Apple, PawPrint, BookOpen, Sparkles, Sofa, Wind,
  Dumbbell, Package, Wine, Glasses, Gamepad2, Cpu, Store, type LucideIcon,
} from 'lucide-react'
import styles from './SegmentsMenu.module.css'

interface Segment {
  slug: string
  name: string
  tag_line: string
}

const SEGMENT_ICON: Record<string, LucideIcon> = {
  carniceria:   Beef,
  restaurante:  Utensils,
  ferreterias:  Wrench,
  farmacias:    Pill,
  'tiendas-ropa': Shirt,
  abastos:      ShoppingBasket,
  tecnologia:   Monitor,
  repuestos:    Car,
  servicios:    Briefcase,
  panaderia:    Coffee,
  fruteria:     Apple,
  mascotas:     PawPrint,
  papeleria:    BookOpen,
  belleza:      Sparkles,
  muebleria:    Sofa,
  lavanderia:   Wind,
  deportes:     Dumbbell,
  mayorista:    Package,
  licoreria:    Wine,
  optica:       Glasses,
  jugueteria:   Gamepad2,
  electronica:  Cpu,
}

const iconBoxVariants = {
  rest:  { backgroundColor: '#DCE6FF' },
  hover: { backgroundColor: '#0038BD' },
}
const iconVariants = {
  rest:  { rotate: 0, scale: 1, color: '#0038BD' },
  hover: { rotate: 12, scale: 1.2, color: '#FFFFFF' },
}
const textVariants = {
  rest:  { x: 0 },
  hover: { x: 4 },
}
const HOVER_TRANSITION = { duration: 0.2, ease: 'easeOut' } as const

function SegmentItem({ seg }: { seg: Segment }) {
  const Icon = SEGMENT_ICON[seg.slug] ?? Store
  return (
    <Link href={`/para-${seg.slug}`} className={styles.itemLink}>
      <motion.div className={styles.item} initial="rest" whileHover="hover" animate="rest">
        <motion.span className={styles.iconBox} variants={iconBoxVariants} transition={HOVER_TRANSITION}>
          <motion.span className={styles.iconGlyph} variants={iconVariants} transition={HOVER_TRANSITION}>
            <Icon size={16} aria-hidden="true" />
          </motion.span>
        </motion.span>
        <motion.span className={styles.itemText} variants={textVariants} transition={HOVER_TRANSITION}>
          <span className={styles.itemName}>{seg.name}</span>
          <span className={styles.itemTag}>{seg.tag_line}</span>
        </motion.span>
      </motion.div>
    </Link>
  )
}

const MAX_VISIBLE = 8

export default function SegmentsMenu({ segments }: { segments: Segment[] }) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const visible = segments.slice(0, MAX_VISIBLE)
  const half = Math.ceil(visible.length / 2)
  const col1 = visible.slice(0, half)
  const col2 = visible.slice(half)

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  // El gap visual entre el trigger y el dropdown saca el cursor del área
  // "hovereable" por una fracción de segundo — un delay cancelable evita
  // que el dropdown se cierre solo al cruzarlo.
  const handleEnter = useCallback(() => {
    cancelClose()
    setOpen(true)
  }, [cancelClose])

  const handleLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 200)
  }, [])

  const handleTriggerClick = useCallback(() => {
    cancelClose()
    setOpen(o => !o)
  }, [cancelClose])

  // Touch (tablets en el breakpoint desktop del nav) no dispara mouseenter/leave —
  // cerrar al tocar fuera del menu.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div ref={wrapRef} className={styles.wrap} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button className={styles.trigger} aria-expanded={open} type="button" onClick={handleTriggerClick}>
        Segmentos
        <ChevronDown size={14} className={open ? styles.chevronOpen : styles.chevron} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.dropdown}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <div className={styles.grid}>
              <div className={styles.col}>
                {col1.map(seg => <SegmentItem key={seg.slug} seg={seg} />)}
              </div>
              <div className={styles.col}>
                {col2.map(seg => <SegmentItem key={seg.slug} seg={seg} />)}
              </div>
            </div>
            <div className={styles.footer}>
              <Link href="/segmentos" className={styles.verTodos}>
                Ver todos los segmentos →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
