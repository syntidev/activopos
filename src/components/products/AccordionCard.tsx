'use client'

import { useState, useEffect, useRef, useId } from 'react'
import { ChevronDown } from 'lucide-react'
import s from '@/app/(dashboard)/productos/nuevo/NuevoProducto.module.css'
import styles from './AccordionCard.module.css'

interface AccordionCardProps {
  title: string
  defaultOpen: boolean
  hasError?: boolean
  children: React.ReactNode
}

/**
 * Card colapsable del formulario de producto. Header (título + chevron)
 * siempre visible; el body se monta/desmonta según el estado. Si hasError
 * pasa a true (un campo con error dentro de una card colapsada), se
 * auto-expande y hace scroll hacia ella — el usuario nunca debe quedarse
 * sin saber por qué el formulario no guarda.
 */
export function AccordionCard({ title, defaultOpen, hasError = false, children }: AccordionCardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const sectionRef = useRef<HTMLElement>(null)
  const bodyId = useId()

  useEffect(() => {
    if (hasError) {
      setOpen(true)
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [hasError])

  return (
    <section className={s.card} ref={sectionRef}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        <h2 className={s.cardTitle}>{title}</h2>
        <ChevronDown
          size={18}
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div id={bodyId} className={styles.body}>
          {children}
        </div>
      )}
    </section>
  )
}
