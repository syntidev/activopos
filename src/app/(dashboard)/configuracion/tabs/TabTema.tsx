'use client'

import { useState, useEffect, useCallback } from 'react'
import { Palette } from 'lucide-react'
import { Button }   from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import styles from '../configuracion.module.css'

interface Props { businessId: number }

interface PaletteOption {
  key:   string
  label: string
}

const PALETTES: PaletteOption[] = [
  { key: 'retail',      label: 'Retail & Comercio' },
  { key: 'restaurante', label: 'Gastronomía'        },
  { key: 'servicios',   label: 'Servicios Pro'      },
  { key: 'salud',       label: 'Clínica & Salud'    },
  { key: 'ferreteria',  label: 'Ferretería'          },
  { key: 'carniceria',  label: 'Carnicería'          },
  { key: 'tecnologia',  label: 'Tech & Digital'      },
]

export function TabTema({ businessId: _businessId }: Props) {
  const { toast } = useToast()

  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [theme, setTheme]         = useState<'dark' | 'light'>('dark')
  const [selectedPalette, setSelectedPalette] = useState<string>('')

  useEffect(() => {
    document.documentElement.style.removeProperty('--color-brand')
    const saved = localStorage.getItem('activopos_segment')
    if (saved) setSelectedPalette(saved)
  }, [])

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/config/business')
      if (!res.ok) throw new Error()
      const body = await res.json() as {
        ok: boolean
        business: { theme: string; segment?: string }
      }
      setTheme(body.business.theme === 'light' ? 'light' : 'dark')
      if (body.business.segment) {
        setSelectedPalette(body.business.segment)
        localStorage.setItem('activopos_segment', body.business.segment)
      }
    } catch {
      toast('Error al cargar el tema.', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { void fetchConfig() }, [fetchConfig])

  const applyThemePreview = (t: 'dark' | 'light') => {
    const html = document.documentElement
    if (t === 'dark') {
      html.classList.add('dark')
      html.classList.remove('light')
      html.removeAttribute('data-theme')
    } else {
      html.classList.add('light')
      html.classList.remove('dark')
      html.setAttribute('data-theme', 'light')
    }
  }

  const handleThemeSelect = (t: 'dark' | 'light') => {
    setTheme(t)
    applyThemePreview(t)
  }

  const handlePaletteSelect = (key: string) => {
    setSelectedPalette(key)
    localStorage.setItem('activopos_segment', key)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/config/theme', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ theme }),
      })
      if (!res.ok) throw new Error()
      toast('Tema guardado correctamente.', 'success')
    } catch {
      toast('Error al guardar el tema.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Palette size={24} className={styles.spinner} aria-hidden="true" />
        <span>Cargando...</span>
      </div>
    )
  }

  return (
    <div className={styles.configSection}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Tema Visual</h2>
        <p className={styles.pageSubtitle}>Modo oscuro/claro del sistema</p>
      </div>

      {/* ── Modo ── */}
      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>
          <Palette size={16} aria-hidden="true" />
          Modo
        </h3>
        <p className={styles.formCardHint}>
          El cambio se aplica inmediatamente como vista previa. Guarda para persistirlo.
        </p>

        <div className={styles.themeCards}>
          {(['dark', 'light'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`${styles.themeCard} ${theme === t ? styles.themeCardActive : ''}`}
              onClick={() => handleThemeSelect(t)}
              aria-pressed={theme === t}
            >
              <div className={styles.themeCardPreview}>
                <div className={styles.themeCardSidebar} />
                <div className={`${styles.themeCardMain} ${t === 'dark' ? styles.themeCardMainDark : styles.themeCardMainLight}`} />
              </div>
              <p className={styles.themeCardLabel}>{t === 'dark' ? 'Oscuro' : 'Claro'}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Tipo de negocio ── */}
      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>
          <Palette size={16} aria-hidden="true" />
          Tipo de negocio
        </h3>
        <p className={styles.formCardHint}>
          Identifica el rubro del negocio para personalización futura.
        </p>

        <select
          className={styles.segmentSelect}
          value={selectedPalette}
          onChange={(e) => handlePaletteSelect(e.target.value)}
          aria-label="Tipo de negocio"
        >
          <option value="" disabled>Selecciona el tipo de negocio…</option>
          {PALETTES.map(p => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>

        <div className={styles.saveRow}>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            Guardar tema
          </Button>
        </div>
      </div>
    </div>
  )
}
