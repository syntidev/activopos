'use client'

import { useState, useEffect, type CSSProperties } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun, Check } from 'lucide-react'
import { Button }   from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import styles from '../configuracion.module.css'

interface Props { businessId: number }

type ThemeMode = 'dark' | 'light'

const MODES: Array<{ key: ThemeMode; label: string; Icon: typeof Moon; mainClass: string }> = [
  { key: 'dark',  label: 'Oscuro', Icon: Moon, mainClass: styles.themeCardMainDark  },
  { key: 'light', label: 'Claro',  Icon: Sun,  mainClass: styles.themeCardMainLight },
]

const DEFAULT_COLOR = '#2563EB'

const SEGMENT_COLORS: Array<{ name: string; value: string; segment: string }> = [
  { name: 'Azul Clásico',     value: '#2563EB', segment: 'Tienda'      },
  { name: 'Rojo Bodega',      value: '#DC2626', segment: 'Bodega'      },
  { name: 'Verde Mercado',    value: '#16A34A', segment: 'Mercado'     },
  { name: 'Ámbar Panadería',  value: '#D97706', segment: 'Panadería'   },
  { name: 'Púrpura Boutique', value: '#9333EA', segment: 'Boutique'    },
  { name: 'Rosa Belleza',     value: '#DB2777', segment: 'Belleza'     },
  { name: 'Teal Farmacia',    value: '#0D9488', segment: 'Farmacia'    },
  { name: 'Índigo Tech',      value: '#4F46E5', segment: 'Tecnología'  },
  { name: 'Naranja Comida',   value: '#EA580C', segment: 'Restaurante' },
  { name: 'Slate Servicios',  value: '#475569', segment: 'Servicios'   },
]

export function TabTema({ businessId: _b }: Props) {
  const { toast } = useToast()
  const { resolvedTheme, setTheme } = useTheme()
  const selected: ThemeMode = resolvedTheme === 'light' ? 'light' : 'dark'

  const [saving, setSaving] = useState(false)
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_COLOR)

  useEffect(() => {
    let active = true
    fetch('/api/config/theme')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { theme_color?: string } | null) => {
        if (active && data?.theme_color) setSelectedColor(data.theme_color)
      })
      .catch(() => {
        // Sin red: se conserva el color por defecto; el usuario puede reseleccionar y guardar.
      })
    return () => { active = false }
  }, [])

  const selectTheme = (mode: ThemeMode) => {
    setTheme(mode)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/config/theme', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ theme: selected, theme_color: selectedColor }),
      })
      if (!res.ok) throw new Error()
      toast('Tema guardado.', 'success')
    } catch {
      toast('Error al guardar.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const activeColor = SEGMENT_COLORS.find((c) => c.value === selectedColor)

  return (
    <div className={styles.configSection}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Tema Visual</h2>
        <p className={styles.pageSubtitle}>Los cambios aplican inmediatamente en todos los dispositivos.</p>
      </div>

      <div className={styles.sectionsGrid}>
      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>Selecciona un modo</h3>

        <div className={styles.themeCards}>
          {MODES.map(({ key, label, Icon, mainClass }) => (
            <button
              key={key}
              type="button"
              className={`${styles.themeCard} ${selected === key ? styles.themeCardActive : ''}`}
              onClick={() => selectTheme(key)}
              aria-pressed={selected === key}
            >
              <div className={styles.themeCardPreview}>
                <div className={styles.themeCardSidebar} />
                <div className={`${styles.themeCardMain} ${mainClass}`} />
              </div>
              <div className={styles.themeCardLabel}>
                <Icon size={14} aria-hidden="true" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                {label}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>Color de tu negocio</h3>
        <p className={styles.colorDesc}>
          Este color se aplica al banner de tu catálogo digital y a los elementos destacados.
        </p>

        <div className={styles.colorGrid} role="radiogroup" aria-label="Color del negocio">
          {SEGMENT_COLORS.map((c) => {
            const isActive = selectedColor === c.value
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                className={`${styles.colorSwatch} ${isActive ? styles.colorSwatchActive : ''}`}
                style={{ '--swatch-color': c.value } as CSSProperties}
                onClick={() => setSelectedColor(c.value)}
                aria-label={`${c.name} — ${c.segment}`}
                title={`${c.name} — ${c.segment}`}
              >
                <span className={styles.colorSwatchInner} />
                {isActive && <Check size={14} className={styles.colorSwatchCheck} aria-hidden="true" />}
              </button>
            )
          })}
        </div>

        {activeColor && (
          <p className={styles.colorSelectedLabel}>
            {activeColor.name} —{' '}
            <span className={styles.colorSelectedSegment}>{activeColor.segment}</span>
          </p>
        )}
      </div>
      </div>

      <div className={styles.saveRow}>
        <Button variant="primary" onClick={handleSave} loading={saving}>
          Guardar tema
        </Button>
      </div>
    </div>
  )
}
