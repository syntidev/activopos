'use client'

import { useState } from 'react'
import { ArrowRight, Plus, X, Lightbulb } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { SEGMENT_SEEDS } from '../data'
import type { OnboardingState } from '../types'
import styles from '../registro.module.css'

interface StepProps {
  data:   OnboardingState
  update: (patch: Partial<OnboardingState>) => void
  onNext: () => void
}

export default function Step6Categorias({ data, update, onNext }: StepProps) {
  const [newCategory, setNewCategory] = useState('')

  const suggestions = (SEGMENT_SEEDS[data.subSegment] ?? [])
    .filter(name => !data.categories.includes(name))

  function addCategory(name: string) {
    const trimmed = name.trim()
    if (!trimmed || data.categories.includes(trimmed)) return
    update({ categories: [...data.categories, trimmed] })
  }

  function removeCategory(name: string) {
    update({ categories: data.categories.filter(c => c !== name) })
  }

  const isValid = data.categories.length > 0

  return (
    <>
      <h1 className={styles.stepTitle}>Primera Categoría</h1>
      <p className={styles.stepSubtitle}>Organiza tus productos</p>

      {suggestions.length > 0 && (
        <>
          <label className={styles.fieldLabel}>Categorías sugeridas — Toca para agregar</label>
          <div className={styles.suggestChips}>
            {suggestions.map(name => (
              <button key={name} type="button" className={styles.suggestChip} onClick={() => addCategory(name)}>
                <Plus size={12} aria-hidden="true" style={{ marginRight: 4 }} />
                {name}
              </button>
            ))}
          </div>
        </>
      )}

      <label className={styles.fieldLabel}>O crea tu propia categoría</label>
      <div className={styles.createRow}>
        <div className={styles.createInput}>
          <Input
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); addCategory(newCategory); setNewCategory('') }
            }}
            placeholder="Nombre de la categoría"
          />
        </div>
        <Button variant="secondary" onClick={() => { addCategory(newCategory); setNewCategory('') }}>
          <Plus size={16} aria-hidden="true" /> Crear
        </Button>
      </div>

      {data.categories.length > 0 && (
        <div className={styles.chosenList}>
          {data.categories.map(name => (
            <span key={name} className={styles.chosenChip}>
              {name}
              <button
                type="button"
                className={styles.chosenChipRemove}
                onClick={() => removeCategory(name)}
                aria-label={`Quitar ${name}`}
              >
                <X size={13} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      <p className={styles.tip}>
        <Lightbulb size={14} aria-hidden="true" />
        Crea al menos una categoría para organizar tus productos.
      </p>

      <Button fullWidth size="lg" rightIcon={<ArrowRight size={16} />} disabled={!isValid} onClick={onNext}>
        Finalizar
      </Button>
    </>
  )
}
