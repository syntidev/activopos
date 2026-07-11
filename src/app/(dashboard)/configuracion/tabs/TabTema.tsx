'use client'

import { useState, useEffect, useRef, type CSSProperties } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun, Check, ImageUp } from 'lucide-react'
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

  const coverRef = useRef<HTMLInputElement>(null)
  const [coverPath, setCoverPath]         = useState<string | null>(null)
  const [coverPreview, setCoverPreview]   = useState<string | null>(null)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [coverDragging, setCoverDragging] = useState(false)

  const coverRef2 = useRef<HTMLInputElement>(null)
  const [coverPath2, setCoverPath2]         = useState<string | null>(null)
  const [coverPreview2, setCoverPreview2]   = useState<string | null>(null)
  const [uploadingCover2, setUploadingCover2] = useState(false)
  const [coverDragging2, setCoverDragging2] = useState(false)

  const coverRef3 = useRef<HTMLInputElement>(null)
  const [coverPath3, setCoverPath3]         = useState<string | null>(null)
  const [coverPreview3, setCoverPreview3]   = useState<string | null>(null)
  const [uploadingCover3, setUploadingCover3] = useState(false)
  const [coverDragging3, setCoverDragging3] = useState(false)

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

  /* Sube y guarda una portada de banner (1/2/3) — misma lógica exacta para
     los 3 slots, parametrizada por campo y setters en vez de triplicada. */
  const uploadCover = async (
    file: File,
    field: 'catalog_cover_path' | 'catalog_cover_path_2' | 'catalog_cover_path_3',
    currentPreview: string | null,
    setPath: (v: string | null) => void,
    setPreview: (v: string | null) => void,
    setUploading: (v: boolean) => void,
  ) => {
    if (!file.type.startsWith('image/')) { toast('Solo se aceptan imágenes PNG, JPG o WebP.', 'error'); return }
    if (file.size > 5 * 1024 * 1024)    { toast('La portada no puede superar 5 MB.', 'error');          return }

    const prev = currentPreview
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', 'catalog_cover')
      const uploadRes = await fetch('/api/upload/image', { method: 'POST', body: fd })
      if (!uploadRes.ok) { toast('Error al subir la portada.', 'error'); setPreview(prev); return }
      const { url } = await uploadRes.json() as { url: string }

      const patchRes = await fetch('/api/config/business', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ [field]: url }),
      })
      if (!patchRes.ok) { toast('Error al guardar la portada.', 'error'); setPreview(prev); return }
      setPath(url)
      toast('Portada del catálogo guardada.', 'success')
    } catch {
      toast('Error de conexión al subir la portada.', 'error')
      setPreview(prev)
    } finally {
      setUploading(false)
    }
  }

  const handleCoverSelect  = (file: File) => uploadCover(file, 'catalog_cover_path',   coverPreview,  setCoverPath,  setCoverPreview,  setUploadingCover)
  const handleCoverSelect2 = (file: File) => uploadCover(file, 'catalog_cover_path_2', coverPreview2, setCoverPath2, setCoverPreview2, setUploadingCover2)
  const handleCoverSelect3 = (file: File) => uploadCover(file, 'catalog_cover_path_3', coverPreview3, setCoverPath3, setCoverPreview3, setUploadingCover3)

  const handleCoverDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setCoverDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleCoverSelect(file)
  }
  const handleCoverDrop2 = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setCoverDragging2(false)
    const file = e.dataTransfer.files[0]
    if (file) handleCoverSelect2(file)
  }
  const handleCoverDrop3 = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setCoverDragging3(false)
    const file = e.dataTransfer.files[0]
    if (file) handleCoverSelect3(file)
  }

  const displayCover  = coverPreview  ?? coverPath
  const displayCover2 = coverPreview2 ?? coverPath2
  const displayCover3 = coverPreview3 ?? coverPath3

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

      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>
          <ImageUp size={16} aria-hidden="true" />
          Portada del catálogo
        </h3>
        <p className={styles.colorDesc}>
          Imagen del banner superior de tu catálogo. Se guarda al instante.
        </p>

        <div
          className={`${styles.coverDropZone} ${coverDragging ? styles.logoDropZoneActive : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Subir portada del catálogo"
          onClick={() => !uploadingCover && coverRef.current?.click()}
          onKeyDown={(e) => { if (!uploadingCover && (e.key === 'Enter' || e.key === ' ')) coverRef.current?.click() }}
          onDragOver={(e) => { e.preventDefault(); setCoverDragging(true) }}
          onDragLeave={() => setCoverDragging(false)}
          onDrop={handleCoverDrop}
        >
          {displayCover ? (
            <img src={displayCover} alt="Portada del catálogo" className={styles.coverPreview} />
          ) : (
            <div className={styles.coverEmpty}>
              <ImageUp size={22} aria-hidden="true" />
              <p className={styles.logoDropText}>Arrastra o haz clic para subir</p>
            </div>
          )}
          {uploadingCover && <div className={styles.coverUploading}>Subiendo…</div>}
        </div>
        {displayCover && (
          <p className={styles.logoDropText} style={{ marginTop: 8 }}>
            {uploadingCover ? 'Subiendo…' : 'Haz clic sobre la imagen para cambiarla'}
          </p>
        )}

        <p className={styles.logoDropHint}>
          Recomendado: horizontal (paisaje), ~1200 × 480 px. Máx 1200 px de ancho, 5 MB. JPG, PNG o WebP.
          Se muestra a 200–280 px de alto y se recorta a lo ancho (object-fit: cover), así que centra lo importante.
        </p>

        <input
          ref={coverRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className={styles.logoFileInput}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverSelect(f) }}
          aria-hidden="true"
          tabIndex={-1}
        />

        {/* Banner 2 (opcional) */}
        <h3 className={styles.formCardTitle} style={{ marginTop: 'var(--space-4)' }}>Banner 2</h3>
        <div
          className={`${styles.coverDropZone} ${coverDragging2 ? styles.logoDropZoneActive : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Subir banner 2 del catálogo"
          onClick={() => !uploadingCover2 && coverRef2.current?.click()}
          onKeyDown={(e) => { if (!uploadingCover2 && (e.key === 'Enter' || e.key === ' ')) coverRef2.current?.click() }}
          onDragOver={(e) => { e.preventDefault(); setCoverDragging2(true) }}
          onDragLeave={() => setCoverDragging2(false)}
          onDrop={handleCoverDrop2}
        >
          {displayCover2 ? (
            <img src={displayCover2} alt="Banner 2 del catálogo" className={styles.coverPreview} />
          ) : (
            <div className={styles.coverEmpty}>
              <ImageUp size={22} aria-hidden="true" />
              <p className={styles.logoDropText}>Arrastra o haz clic para subir</p>
            </div>
          )}
          {uploadingCover2 && <div className={styles.coverUploading}>Subiendo…</div>}
        </div>
        {displayCover2 && (
          <p className={styles.logoDropText} style={{ marginTop: 8 }}>
            {uploadingCover2 ? 'Subiendo…' : 'Haz clic sobre la imagen para cambiarla'}
          </p>
        )}
        <input
          ref={coverRef2}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className={styles.logoFileInput}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverSelect2(f) }}
          aria-hidden="true"
          tabIndex={-1}
        />

        {/* Banner 3 (opcional) */}
        <h3 className={styles.formCardTitle} style={{ marginTop: 'var(--space-4)' }}>Banner 3</h3>
        <div
          className={`${styles.coverDropZone} ${coverDragging3 ? styles.logoDropZoneActive : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Subir banner 3 del catálogo"
          onClick={() => !uploadingCover3 && coverRef3.current?.click()}
          onKeyDown={(e) => { if (!uploadingCover3 && (e.key === 'Enter' || e.key === ' ')) coverRef3.current?.click() }}
          onDragOver={(e) => { e.preventDefault(); setCoverDragging3(true) }}
          onDragLeave={() => setCoverDragging3(false)}
          onDrop={handleCoverDrop3}
        >
          {displayCover3 ? (
            <img src={displayCover3} alt="Banner 3 del catálogo" className={styles.coverPreview} />
          ) : (
            <div className={styles.coverEmpty}>
              <ImageUp size={22} aria-hidden="true" />
              <p className={styles.logoDropText}>Arrastra o haz clic para subir</p>
            </div>
          )}
          {uploadingCover3 && <div className={styles.coverUploading}>Subiendo…</div>}
        </div>
        {displayCover3 && (
          <p className={styles.logoDropText} style={{ marginTop: 8 }}>
            {uploadingCover3 ? 'Subiendo…' : 'Haz clic sobre la imagen para cambiarla'}
          </p>
        )}
        <input
          ref={coverRef3}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className={styles.logoFileInput}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverSelect3(f) }}
          aria-hidden="true"
          tabIndex={-1}
        />

        <p className={styles.logoDropHint} style={{ marginTop: 'var(--space-3)' }}>
          Sube hasta 3 imágenes para el slider del catálogo. La primera es obligatoria, las otras son opcionales.
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
