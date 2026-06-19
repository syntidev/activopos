'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Button }   from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import styles from '../configuracion.module.css'

interface Props { businessId: number }

type ThemeMode = 'dark' | 'light'

const MODES: Array<{ key: ThemeMode; label: string; Icon: typeof Moon; mainClass: string }> = [
  { key: 'dark',  label: 'Oscuro', Icon: Moon, mainClass: styles.themeCardMainDark  },
  { key: 'light', label: 'Claro',  Icon: Sun,  mainClass: styles.themeCardMainLight },
]

export function TabTema({ businessId: _b }: Props) {
  const { toast } = useToast()
  const { resolvedTheme, setTheme } = useTheme()
  const selected: ThemeMode = resolvedTheme === 'light' ? 'light' : 'dark'

  const [saving, setSaving] = useState(false)

  const selectTheme = (mode: ThemeMode) => {
    setTheme(mode)
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

        <div className={styles.saveRow}>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            Guardar tema
          </Button>
        </div>
      </div>
    </div>
  )
}
