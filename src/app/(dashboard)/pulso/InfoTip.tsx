'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { HelpCircle } from 'lucide-react'
import styles from './pulso.module.css'

interface InfoTipProps {
  /** Nombre del indicador, para el aria-label del botón. */
  label: string
  /** Qué mide y cómo se cuenta. */
  text: string
  /** Variante sobre fondo oscuro (KPI hero). */
  onDark?: boolean
  /** Posición propia del botón (esquina del KPI). */
  className?: string
  /** El popover aparece donde está el botón (sin top:100% del host), ancho de la card. */
  flow?: boolean
}

/** Ícono "?" con explicación: toque/clic/Enter abre, Esc o tocar fuera cierra. El popover se ancla al
 *  ancestro con `.tipHost` (ancho completo del bloque), así nunca se sale de la pantalla en 375px. */
export default function InfoTip({ label, text, onDark = false, className, flow = false }: InfoTipProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus() }
    }
    const onDown = (e: PointerEvent): void => {
      const t = e.target
      if (t instanceof Node && !btnRef.current?.parentElement?.contains(t) && !document.getElementById(id)?.contains(t)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open, id])

  const cls = [styles.tipBtn, onDark ? styles.tipBtnDark : '', className ?? ''].join(' ').trim()
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={cls}
        aria-label={`Qué mide: ${label}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(o => !o)}
      >
        <HelpCircle size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <span id={id} role="tooltip" className={flow ? `${styles.tip} ${styles.tipFlow}` : styles.tip} hidden={!open}>{text}</span>
    </>
  )
}
