'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button }   from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import styles from '../configuracion.module.css'

interface Props { businessId: number }

type ThemeKey =
  | 'default' | 'premium'  | 'calle'    | 'tropical'
  | 'salud'   | 'construye' | 'oficina'  | 'sabor'
  | 'estilo'  | 'verde'

interface ThemeOption {
  key:   ThemeKey
  label: string
  color: string
}

const THEMES: ThemeOption[] = [
  { key: 'default',   label: 'Azul Sereno',   color: '#2563EB' },
  { key: 'premium',   label: 'Medianoche',     color: '#2563EB' },
  { key: 'calle',     label: 'Amanecer',       color: '#EA580C' },
  { key: 'tropical',  label: 'Aguamarina',     color: '#14B8A6' },
  { key: 'salud',     label: 'Menta Fresca',   color: '#10B981' },
  { key: 'construye', label: 'Tierra Dorada',  color: '#D97706' },
  { key: 'oficina',   label: 'Cielo Abierto',  color: '#6366F1' },
  { key: 'sabor',     label: 'Brasa Viva',     color: '#DC2626' },
  { key: 'estilo',    label: 'Champán',        color: '#B45309' },
  { key: 'verde',     label: 'Jardín',         color: '#059669' },
]

const VALID_KEYS = new Set<string>(THEMES.map(t => t.key))

function isValidTheme(t: string | null): t is ThemeKey {
  return t !== null && VALID_KEYS.has(t)
}

export function TabTema({ businessId: _b }: Props) {
  const { toast } = useToast()

  const [selected, setSelected] = useState<ThemeKey>('default')
  const [saving,   setSaving]   = useState(false)

  // Apply from localStorage on mount (instant, no flash)
  useEffect(() => {
    const saved   = localStorage.getItem('activopos_theme')
    const current = document.documentElement.getAttribute('data-theme')
    const active  = isValidTheme(saved)    ? saved
                  : isValidTheme(current)  ? current
                  : 'default'
    setSelected(active)
    document.documentElement.setAttribute('data-theme', active)
  }, [])

  // Sync canonical value from DB
  const fetchConfig = useCallback(async () => {
    try {
      const res  = await fetch('/api/config/business')
      if (!res.ok) return
      const body = await res.json() as { ok: boolean; business: { theme: string } }
      const t    = body.business.theme
      if (isValidTheme(t)) {
        setSelected(t)
        document.documentElement.setAttribute('data-theme', t)
        localStorage.setItem('activopos_theme', t)
      }
    } catch {
      // localStorage already applied — silent fallback
    }
  }, [])

  useEffect(() => { void fetchConfig() }, [fetchConfig])

  const selectTheme = (key: ThemeKey) => {
    setSelected(key)
    document.documentElement.setAttribute('data-theme', key)
    localStorage.setItem('activopos_theme', key)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/config/theme', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ theme: selected }),
      })
      if (!res.ok) throw new Error()
      toast('Tema guardado.', 'success')
    } catch {
      toast('Error al guardar.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.configSection}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Tema Visual</h2>
        <p className={styles.pageSubtitle}>Los cambios aplican inmediatamente en todos los dispositivos.</p>
      </div>

      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>Selecciona un tema</h3>

        <div className={styles.segmentGrid}>
          {THEMES.map(theme => (
            <button
              key={theme.key}
              type="button"
              className={`${styles.segmentCard} ${selected === theme.key ? styles.segmentCardActive : ''}`}
              onClick={() => selectTheme(theme.key)}
              aria-pressed={selected === theme.key}
            >
              <span
                className={styles.segmentCircle}
                style={{ '--seg-color': theme.color } as React.CSSProperties}
                aria-hidden="true"
              />
              <span className={`${styles.segmentCardLabel} ${selected === theme.key ? styles.segmentCardLabelActive : ''}`}>
                {theme.label}
              </span>
            </button>
          ))}
        </div>

        <div className={styles.saveRow}>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            Guardar tema
          </Button>
        </div>
      </div>
    </div>
  )
}
