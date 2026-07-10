'use client'

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { HelpCircle } from 'lucide-react'
import { HelpModal } from './HelpModal'
import { type HelpModule } from '@/lib/help-content'
import styles from './HelpButton.module.css'

interface HelpButtonProps {
  module: HelpModule
}

export function HelpButton({ module }: HelpButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        className={styles.helpBtn}
        onClick={() => setOpen(true)}
        type="button"
        aria-label="Abrir ayuda"
        title="Ayuda"
      >
        <HelpCircle size={22} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <HelpModal
            module={module}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
