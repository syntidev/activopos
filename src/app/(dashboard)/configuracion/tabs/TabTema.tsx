'use client'

import { useState, useEffect, type CSSProperties } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun, Check, ImageUp } from 'lucide-react'
import { Button }   from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { ImageField } from '@/components/ui/ImageField'
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

  const [coverPath, setCoverPath]   = useState<string | null>(null)
  const [coverPath2, setCoverPath2] = useState<string | null>(null)
  const [coverPath3, setCoverPath3] = useState<string | null>(null)

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

  useEffect(() => {
    let active = true
    fetch('/api/config/business')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: {
        business?: {
          catalog_cover_path?: string | null
          catalog_cover_path_2?: string | null
          catalog_cover_path_3?: string | null
        }
      } | null) => {
        if (!active || !data?.business) return
        if (data.business.catalog_cover_path)   setCoverPath(data.business.catalog_cover_path)
        if (data.business.catalog_cover_path_2) setCoverPath2(data.business.catalog_cover_path_2)
        if (data.business.catalog_cover_path_3) setCoverPath3(data.business.catalog_cover_path_3)
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  /* Guarda una portada de banner (1/2/3) al instante, al subir y al quitar
     (null): mismo comportamiento "Se guarda al instante" de esta pestaña.
     ImageField sube el archivo y muestra el error si esto rechaza. */
  const saveCover = async (
    field: 'catalog_cover_path' | 'catalog_cover_path_2' | 'catalog_cover_path_3',
    url: string | null,
    setPath: (v: string | null) => void,
  ) => {
    const res = await fetch('/api/config/business', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ [field]: url }),
    })
    if (!res.ok) throw new Error(url ? 'No se pudo guardar la portada.' : 'No se pudo quitar la imagen.')
    setPath(url)
    toast(url ? 'Portada del catálogo guardada.' : 'Imagen del banner quitada.', 'success')
  }

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
      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string } | null
        toast(data?.error || 'Error al guardar.', 'error')
        return
      }
      toast('Tema guardado.', 'success')
    } catch {
      toast('Error de conexión al guardar.', 'error')
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

      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>
          <ImageUp size={16} aria-hidden="true" />
          Portada del catálogo
        </h3>
        <p className={styles.colorDesc}>
          Imagen del banner superior de tu catálogo. Se guarda al instante.
        </p>

        <ImageField
          label="Portada del catálogo"
          hideLabel
          value={coverPath}
          onChange={v => saveCover('catalog_cover_path', v, setCoverPath)}
          uploadType="catalog_cover"
          removable
          boxClassName={styles.coverDropZone}
          imgClassName={styles.coverPreview}
          alt="Portada del catálogo"
          emptyContent={
            <div className={styles.coverEmpty}>
              <ImageUp size={22} aria-hidden="true" />
              <p className={styles.logoDropText}>Arrastra o haz clic para subir</p>
            </div>
          }
        />

        <p className={styles.logoDropHint}>
          Recomendado: horizontal (paisaje), ~1200 × 480 px. Máx 1200 px de ancho, 5 MB. JPG, PNG o WebP.
          Se muestra a 200–280 px de alto y se recorta a lo ancho (object-fit: cover), así que centra lo importante.
        </p>

        {/* Banner 2 (opcional) */}
        <h3 className={styles.formCardTitle} style={{ marginTop: 'var(--space-4)' }}>Banner 2</h3>
        <ImageField
          label="Banner 2 del catálogo"
          hideLabel
          value={coverPath2}
          onChange={v => saveCover('catalog_cover_path_2', v, setCoverPath2)}
          uploadType="catalog_cover"
          removable
          boxClassName={styles.coverDropZone}
          imgClassName={styles.coverPreview}
          alt="Banner 2 del catálogo"
          emptyContent={
            <div className={styles.coverEmpty}>
              <ImageUp size={22} aria-hidden="true" />
              <p className={styles.logoDropText}>Arrastra o haz clic para subir</p>
            </div>
          }
        />

        {/* Banner 3 (opcional) */}
        <h3 className={styles.formCardTitle} style={{ marginTop: 'var(--space-4)' }}>Banner 3</h3>
        <ImageField
          label="Banner 3 del catálogo"
          hideLabel
          value={coverPath3}
          onChange={v => saveCover('catalog_cover_path_3', v, setCoverPath3)}
          uploadType="catalog_cover"
          removable
          boxClassName={styles.coverDropZone}
          imgClassName={styles.coverPreview}
          alt="Banner 3 del catálogo"
          emptyContent={
            <div className={styles.coverEmpty}>
              <ImageUp size={22} aria-hidden="true" />
              <p className={styles.logoDropText}>Arrastra o haz clic para subir</p>
            </div>
          }
        />

        <p className={styles.logoDropHint} style={{ marginTop: 'var(--space-3)' }}>
          Sube hasta 3 imágenes para el slider del catálogo; con 2 o más, rotan cada 5 segundos. Todas son opcionales y
          puedes quitarlas: sin ninguna, se muestra un banner con el nombre y la descripción de tu negocio. Si configuraste
          un Hero en Landing, el Hero ocupa este lugar.
        </p>
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
