'use client'

import Link from 'next/link'
import { Sparkles, Check, ArrowRight } from 'lucide-react'
import { Modal } from './Modal'
import styles from './UpgradeModal.module.css'

interface UpgradeModalProps {
  /** Motivo exacto del 403 del plan gate. null = cerrado. */
  reason: string | null
  onClose: () => void
}

const PERKS = [
  'Productos ilimitados',
  'Hasta 10 usuarios',
  'Catálogo digital, finanzas, reportes y más',
]

export function UpgradeModal({ reason, onClose }: UpgradeModalProps) {
  return (
    <Modal open={reason !== null} onClose={onClose} title="Función del plan Negocio Activo" size="sm">
      <div className={styles.body}>
        <div className={styles.iconWrap}>
          <Sparkles size={22} aria-hidden="true" />
        </div>

        {reason && <p className={styles.reason}>{reason}</p>}

        <ul className={styles.perks}>
          {PERKS.map(p => (
            <li key={p} className={styles.perk}>
              <Check size={15} aria-hidden="true" className={styles.perkIcon} />
              {p}
            </li>
          ))}
        </ul>

        <div className={styles.actions}>
          <Link href="/planes" className={styles.cta} onClick={onClose}>
            Ver planes
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Quizás después
          </button>
        </div>
      </div>
    </Modal>
  )
}
