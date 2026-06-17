'use client'

import { useState, useEffect, useCallback } from 'react'
import { Palette } from 'lucide-react'
import { Button }   from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import styles from '../configuracion.module.css'

interface Props { businessId: number }

const ACCENT_COLORS = [
  { hex: '#2563EB', label: 'Azul'    },
  { hex: '#7C3AED', label: 'Violeta' },
  { hex: '#0891B2', label: 'Cian'    },
  { hex: '#D97706', label: 'Ámbar'   },
  { hex: '#059669', label: 'Verde'   },
  { hex: '#DC2626', label: 'Rojo'    },
] as const

type AccentHex = typeof ACCENT_COLORS[number]['hex']

interface PaletteOption {
  key:      string
  label:    string
  accentHex: AccentHex
}

const PALETTES: PaletteOption[] = [
  { key: 'retail',      label: 'Retail & Comercio', accentHex: '#2563EB' },
  { key: 'restaurante', label: 'Gastronomía',        accentHex: '#D97706' },
  { key: 'servicios',   label: 'Servicios Pro',      accentHex: '#0891B2' },
  { key: 'salud',       label: 'Clínica & Salud',    accentHex: '#059669' },
  { key: 'ferreteria',  label: 'Ferretería',          accentHex: '#D97706' },
  { key: 'carniceria',  label: 'Carnicería',          accentHex: '#DC2626' },
  { key: 'tecnologia',  label: 'Tech & Digital',      accentHex: '#7C3AED' },
]

export function TabTema({ businessId: _businessId }: Props) {
  const { toast } = useToast()

  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [theme, setTheme]           = useState<'dark' | 'light'>('dark')
  const [themeColor, setThemeColor] = useState<AccentHex>('#2563EB')
  const [selectedPalette, setSelectedPalette] = useState<string>('')

  useEffect(() => {
    const saved = localStorage.getItem('activopos_segment')
    if (saved) {
      setSelectedPalette(saved)
      document.documentElement.setAttribute('data-segment', saved)
    }
  }, [])

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/config/business')
      if (!res.ok) throw new Error()
      const body = await res.json() as {
        ok: boolean
        business: { theme: string; theme_color: string; segment?: string }
      }
      const t = body.business.theme === 'light' ? 'light' : 'dark'
      const c = (ACCENT_COLORS.find(a => a.hex === body.business.theme_color)?.hex ?? '#2563EB') as AccentHex
      setTheme(t)
      setThemeColor(c)
      if (body.business.segment) {
        setSelectedPalette(body.business.segment)
        document.documentElement.setAttribute('data-segment', body.business.segment)
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
    html.style.removeProperty('--color-brand')
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

  const handleColorSelect = (color: AccentHex) => {
    setThemeColor(color)
  }

  const handlePaletteSelect = (key: string) => {
    const palette = PALETTES.find(p => p.key === key)
    if (!palette) return
    setSelectedPalette(key)
    setThemeColor(palette.accentHex)
    document.documentElement.setAttribute('data-segment', key)
    document.documentElement.style.removeProperty('--color-brand')
    localStorage.setItem('activopos_segment', key)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body: Record<string, string> = { theme, theme_color: themeColor }
      if (selectedPalette) body.segment = selectedPalette
      const res = await fetch('/api/config/theme', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
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
        <p className={styles.pageSubtitle}>Modo oscuro/claro y color de acento del sistema</p>
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
          Preajusta el color de acento según el rubro del negocio.
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
      </div>

      {/* ── Color de acento ── */}
      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>Color de acento</h3>
        <p className={styles.formCardHint}>
          Color principal para botones, enlaces y elementos activos.
        </p>

        <div className={styles.colorPicker} role="radiogroup" aria-label="Color de acento">
          {ACCENT_COLORS.map(({ hex, label }) => (
            <button
              key={hex}
              type="button"
              className={`${styles.colorDot} ${themeColor === hex ? styles.colorDotActive : ''}`}
              style={{ backgroundColor: hex }}
              onClick={() => handleColorSelect(hex)}
              aria-label={label}
              aria-pressed={themeColor === hex}
            />
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
