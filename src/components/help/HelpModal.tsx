'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { HelpCircle, Lightbulb, X } from 'lucide-react'
import { helpContent, type HelpModule } from '@/lib/help-content'
import styles from './HelpModal.module.css'

interface HelpModalProps {
  module: HelpModule
  onClose: () => void
}

export function HelpModal({ module, onClose }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<'steps' | 'faqs'>('steps')
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const content = helpContent[module]

  // Reset tabs on open
  useEffect(() => {
    setActiveTab('steps')
    setOpenFaq(null)
  }, [module])

  // Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Focus trap — move focus into panel on mount
  useEffect(() => {
    panelRef.current?.focus()
  }, [])

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      aria-modal="true"
      role="dialog"
      aria-label={`Ayuda: ${content.title}`}
    >
      <motion.div
        ref={panelRef}
        className={styles.panel}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 34, mass: 0.8 }}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <div className={styles.badge} aria-hidden="true">
              <HelpCircle size={15} />
            </div>
            <h2 className={styles.title}>{content.title}</h2>
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Cerrar ayuda"
            type="button"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className={styles.tabs} role="tablist" aria-label="Secciones de ayuda">
          <button
            role="tab"
            aria-selected={activeTab === 'steps'}
            className={`${styles.tab} ${activeTab === 'steps' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('steps')}
            type="button"
          >
            Cómo funciona
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'faqs'}
            className={`${styles.tab} ${activeTab === 'faqs' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('faqs')}
            type="button"
          >
            Preguntas frecuentes
          </button>
        </div>

        {/* ── Body ── */}
        <div className={styles.body}>

          {/* Pasos */}
          {activeTab === 'steps' && (
            <ol className={styles.stepsList} aria-label="Pasos">
              {content.steps.map((step, i) => (
                <li key={i} className={styles.stepItem}>
                  <div className={styles.stepNum} aria-hidden="true">{i + 1}</div>
                  <div className={styles.stepContent}>
                    <span className={styles.stepTitle}>{step.title}</span>
                    <p className={styles.stepBody}>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {/* Tip */}
          {activeTab === 'steps' && content.tip && (
            <div className={styles.tipBox} role="note">
              <Lightbulb size={16} className={styles.tipIcon} aria-hidden="true" />
              <p className={styles.tipText}><strong>Tip:</strong> {content.tip}</p>
            </div>
          )}

          {/* FAQs */}
          {activeTab === 'faqs' && (
            <div className={styles.faqsList}>
              {content.faqs.map((faq, i) => (
                <div key={i} className={styles.faqItem}>
                  <button
                    className={styles.faqQuestion}
                    aria-expanded={openFaq === i}
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    type="button"
                  >
                    <span className={styles.faqText}>{faq.q}</span>
                    <span className={styles.faqCaret} aria-hidden="true">
                      {openFaq === i ? '▲' : '▼'}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {openFaq === i && (
                      <motion.p
                        className={styles.faqAnswer}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        {faq.a}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}

        </div>
      </motion.div>
    </motion.div>
  )
}
