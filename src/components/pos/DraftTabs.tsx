'use client'

import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import type { DraftTab } from '@/hooks/useDraftTabs'
import styles from './DraftTabs.module.css'

interface DraftTabsProps {
  tabs:     DraftTab[]
  activeId: string
  loading?: boolean
  onSwitch: (id: string) => void
  onNew:    () => void
  onClose:  (id: string) => void
  onRename: (id: string, label: string) => void
}

export function DraftTabs({ tabs, activeId, loading, onSwitch, onNew, onClose, onRename }: DraftTabsProps) {
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [draftLabel, setDraftLabel] = useState('')

  const startEdit = (tab: DraftTab) => {
    setEditingId(tab.id)
    setDraftLabel(tab.label)
  }

  const commitEdit = () => {
    if (editingId) onRename(editingId, draftLabel)
    setEditingId(null)
  }
  if (loading) {
    return (
      <div className={styles.bar} aria-busy="true" aria-label="Cargando tickets">
        <div className={`${styles.tab} ${styles.tabSkeleton}`} aria-hidden="true" />
        <div className={`${styles.tab} ${styles.tabSkeleton} ${styles.tabSkeletonSm}`} aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className={styles.bar} role="tablist" aria-label="Tickets abiertos">
      {tabs.map(tab => {
        const isActive = tab.id === activeId
        return (
          <div
            key={tab.id}
            className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => { if (!isActive) onSwitch(tab.id) }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!isActive) onSwitch(tab.id) } }}
          >
            {editingId === tab.id ? (
              <input
                type="text"
                className={styles.tabLabelInput}
                value={draftLabel}
                maxLength={20}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setDraftLabel(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
                  if (e.key === 'Escape') { e.preventDefault(); setEditingId(null) }
                }}
                aria-label={`Editar nombre de ${tab.label}`}
              />
            ) : (
              <span
                className={styles.tabLabel}
                onDoubleClick={(e) => { e.stopPropagation(); startEdit(tab) }}
              >
                {tab.label}
              </span>
            )}
            {tabs.length > 1 && (
              <button
                type="button"
                className={styles.closeBtn}
                aria-label={`Cerrar ${tab.label}`}
                onClick={(e) => { e.stopPropagation(); onClose(tab.id) }}
              >
                <X size={12} strokeWidth={2.5} aria-hidden="true" />
              </button>
            )}
          </div>
        )
      })}

      {tabs.length < 5 && (
        <button
          type="button"
          className={styles.newTab}
          aria-label="Nuevo ticket"
          onClick={onNew}
        >
          <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
          <span>Nuevo</span>
        </button>
      )}
    </div>
  )
}
