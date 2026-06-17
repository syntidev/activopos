'use client'

import { X } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import styles from './Modal.module.css'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  size?: ModalSize
  children: ReactNode
  footer?: ReactNode
}

const OVERLAY_VARIANTS = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

const MODAL_VARIANTS = {
  hidden: { opacity: 0, scale: 0.97, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0 },
}

const MODAL_VARIANTS_REDUCED = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

export function Modal({ open, onClose, title, size = 'md', children, footer }: ModalProps) {
  const prefersReduced = useReducedMotion()

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/*
              Overlay is the full-screen flex container.
              Content is nested inside so the overlay centers it.
              This avoids the position:fixed + translate(-50%,-50%) pattern
              that breaks in certain stacking contexts.
            */}
            <Dialog.Overlay asChild>
              <motion.div
                className={styles.overlay}
                variants={OVERLAY_VARIANTS}
                initial="hidden"
                animate="visible"
                exit="hidden"
                transition={{ duration: prefersReduced ? 0 : 0.15 }}
              >
                <Dialog.Content asChild>
                  <motion.div
                    className={`${styles.modal} ${styles[`size-${size}`]}`}
                    variants={prefersReduced ? MODAL_VARIANTS_REDUCED : MODAL_VARIANTS}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    transition={{ duration: prefersReduced ? 0 : 0.2, ease: [0.4, 0, 0.2, 1] }}
                    aria-modal="true"
                  >
                    {/* Header */}
                    <div className={styles.header}>
                      <Dialog.Title className={styles.title}>{title}</Dialog.Title>
                      <Dialog.Close asChild>
                        <button
                          className={styles.closeBtn}
                          aria-label="Cerrar"
                          onClick={onClose}
                        >
                          <X size={18} strokeWidth={2} aria-hidden="true" />
                        </button>
                      </Dialog.Close>
                    </div>

                    {/* Body */}
                    <div className={styles.body}>{children}</div>

                    {/* Footer */}
                    {footer && <div className={styles.footer}>{footer}</div>}
                  </motion.div>
                </Dialog.Content>
              </motion.div>
            </Dialog.Overlay>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
