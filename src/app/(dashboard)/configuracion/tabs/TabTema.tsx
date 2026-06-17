'use client'

import { useState, useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button }   from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import styles from '../configuracion.module.css'

interface Props { businessId: number }

export function TabTema({ businessId: _b }: Props) {
  const { toast } = useToast()
  const [theme, setTheme]   = useState<'dark' | 'light'>('light')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const saved   = localStorage.getItem('activopos_theme')
    const current = document.documentElement.getAttribute('data-theme')
    const active: 'dark' | 'light' = (saved === 'dark' || saved === 'light')
      ? saved
      : (current === 'dark' || current === 'light')
        ? current
        : 'light'
    setTheme(active)
    document.documentElement.setAttribute('data-theme', active)
  }, [])

  const selectTheme = (t: 'dark' | 'light') => {
    setTheme(t)
    document.documentElement.setAttribute('data-theme', t)
    localStorage.setItem('activopos_theme', t)
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
        <p className={styles.pageSubtitle}>El cambio aplica inmediatamente.</p>
      </div>

      <div className={styles.formCard}>
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

        <div className={styles.saveRow}>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            Guardar tema
          </Button>
        </div>
      </div>
    </div>
  )
}
