'use client'

import { useState, useEffect, useCallback } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button }   from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import styles from '../configuracion.module.css'

interface Props { businessId: number }

interface PaletteOption { key: string; label: string; color: string }

const PALETTES: PaletteOption[] = [
  { key: 'retail',      label: 'Retail & Comercio', color: '#2563EB' },
  { key: 'restaurante', label: 'Gastronomía',        color: '#16A34A' },
  { key: 'servicios',   label: 'Servicios Pro',      color: '#7C3AED' },
  { key: 'salud',       label: 'Clínica & Salud',    color: '#0891B2' },
  { key: 'ferreteria',  label: 'Ferretería',         color: '#D97706' },
  { key: 'carniceria',  label: 'Carnicería',         color: '#DC2626' },
  { key: 'tecnologia',  label: 'Tech & Digital',     color: '#0F172A' },
]

export function TabTema({ businessId: _b }: Props) {
  const { toast } = useToast()

  const [theme, setTheme]                     = useState<'dark' | 'light'>('light')
  const [selectedPalette, setSelectedPalette] = useState<string>('')
  const [saving, setSaving]                   = useState(false)

  // Aplicar tema + segmento desde localStorage al montar (sin esperar red)
  useEffect(() => {
    const savedTheme = localStorage.getItem('activopos_theme')
    const current    = document.documentElement.getAttribute('data-theme')
    const active: 'dark' | 'light' = (savedTheme === 'dark' || savedTheme === 'light')
      ? savedTheme
      : (current === 'dark' || current === 'light')
        ? current
        : 'light'
    setTheme(active)
    document.documentElement.setAttribute('data-theme', active)

    const savedSegment = localStorage.getItem('activopos_segment')
    if (savedSegment) setSelectedPalette(savedSegment)
  }, [])

  // Sincronizar con la DB (fuente de verdad canónica)
  const fetchConfig = useCallback(async () => {
    try {
      const res  = await fetch('/api/config/business')
      if (!res.ok) return
      const body = await res.json() as {
        ok: boolean
        business: { theme: string; segment?: string }
      }
      const t: 'dark' | 'light' = body.business.theme === 'light' ? 'light' : 'dark'
      setTheme(t)
      document.documentElement.setAttribute('data-theme', t)
      localStorage.setItem('activopos_theme', t)
      if (body.business.segment) {
        setSelectedPalette(body.business.segment)
        localStorage.setItem('activopos_segment', body.business.segment)
      }
    } catch {
      // localStorage actúa como fallback — sin toast para no interrumpir
    }
  }, [])

  useEffect(() => { void fetchConfig() }, [fetchConfig])

  const selectTheme = (t: 'dark' | 'light') => {
    setTheme(t)
    document.documentElement.setAttribute('data-theme', t)
    localStorage.setItem('activopos_theme', t)
  }

  const selectPalette = (key: string) => {
    setSelectedPalette(key)
    localStorage.setItem('activopos_segment', key)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/config/theme', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ theme, segment: selectedPalette }),
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
        <p className={styles.pageSubtitle}>Los cambios aplican inmediatamente.</p>
      </div>

      {/* ── Sección 1: Modo oscuro / claro ── */}
      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>Modo</h3>
        <div className={styles.themeIconCards}>
          <button
            type="button"
            className={`${styles.themeIconCard} ${theme === 'dark' ? styles.themeIconCardActive : ''}`}
            onClick={() => selectTheme('dark')}
            aria-pressed={theme === 'dark'}
          >
            <Moon size={24} aria-hidden="true" />
            <span className={styles.themeIconCardLabel}>Oscuro</span>
          </button>

          <button
            type="button"
            className={`${styles.themeIconCard} ${theme === 'light' ? styles.themeIconCardActive : ''}`}
            onClick={() => selectTheme('light')}
            aria-pressed={theme === 'light'}
          >
            <Sun size={24} aria-hidden="true" />
            <span className={styles.themeIconCardLabel}>Claro</span>
          </button>
        </div>
      </div>

      {/* ── Sección 2: Tipo de negocio ── */}
      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>Tipo de negocio</h3>
        <p className={styles.formCardHint}>
          Identifica el rubro para ajustes de presentación futuros.
        </p>

        <div className={styles.segmentGrid}>
          {PALETTES.map(p => (
            <button
              key={p.key}
              type="button"
              className={`${styles.segmentCard} ${selectedPalette === p.key ? styles.segmentCardActive : ''}`}
              onClick={() => selectPalette(p.key)}
              aria-pressed={selectedPalette === p.key}
            >
              <span
                className={styles.segmentCircle}
                style={{ '--seg-color': p.color } as React.CSSProperties}
                aria-hidden="true"
              />
              <span className={`${styles.segmentCardLabel} ${selectedPalette === p.key ? styles.segmentCardLabelActive : ''}`}>
                {p.label}
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
