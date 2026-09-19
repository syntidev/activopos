'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Upload, Tag } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import styles from '../configuracion.module.css'

interface Props { businessId: number }

interface BrandRow {
  id:          number
  name:        string
  image_url:   string | null
  search_term: string
  order:       number
  visible:     boolean
  isNew?:      boolean
}

const EMPTY_ROW = (order: number): BrandRow => ({
  id: -Date.now(), name: '', image_url: null, search_term: '', order, visible: true, isNew: true,
})

async function uploadBrandImage(file: File): Promise<string | null> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('type', 'brand')
  const res = await fetch('/api/upload/image', { method: 'POST', body: fd })
  if (!res.ok) return null
  const { thumb } = await res.json() as { thumb: string }
  return thumb
}

export function TabBrands({ businessId: _b }: Props) {
  const { toast } = useToast()
  const [brands, setBrands]   = useState<BrandRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId]   = useState<number | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/brands')
      if (res.ok) {
        const data = await res.json() as { brands: BrandRow[] }
        setBrands(data.brands.slice().sort((a, b) => a.order - b.order))
      }
    } catch {
      toast('Error de conexión al cargar las marcas.', 'error')
    } finally {
      setLoading(false)
    }
  }

  function addBrand() {
    setBrands(prev => [...prev, EMPTY_ROW(prev.length)])
  }

  async function patchBrand(id: number, body: Partial<Pick<BrandRow, 'name' | 'image_url' | 'search_term' | 'visible' | 'order'>>): Promise<boolean> {
    const res = await fetch(`/api/brands/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    if (!res.ok) { toast('Error al guardar.', 'error'); return false }
    return true
  }

  async function deleteBrand(b: BrandRow) {
    if (!confirm(`¿Eliminar la marca "${b.name || 'sin nombre'}"?`)) return
    if (b.isNew) { setBrands(prev => prev.filter(x => x.id !== b.id)); return }
    setBusyId(b.id)
    try {
      const res = await fetch(`/api/brands/${b.id}`, { method: 'DELETE' })
      if (!res.ok) { toast('Error al eliminar.', 'error'); return }
      setBrands(prev => prev.filter(x => x.id !== b.id))
      toast('Marca eliminada.', 'success')
    } finally {
      setBusyId(null)
    }
  }

  async function move(id: number, dir: -1 | 1) {
    const idx = brands.findIndex(b => b.id === id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= brands.length) return
    const a = brands[idx]
    const b = brands[swapIdx]
    const next = brands.slice()
    next[idx]     = { ...b, order: a.order }
    next[swapIdx] = { ...a, order: b.order }
    next.sort((x, y) => x.order - y.order)
    setBrands(next)
    setBusyId(id)
    try {
      await Promise.all([
        a.isNew ? Promise.resolve(true) : patchBrand(a.id, { order: b.order }),
        b.isNew ? Promise.resolve(true) : patchBrand(b.id, { order: a.order }),
      ])
    } finally {
      setBusyId(null)
    }
  }

  async function toggleVisible(b: BrandRow) {
    const nextVisible = !b.visible
    setBrands(prev => prev.map(x => x.id === b.id ? { ...x, visible: nextVisible } : x))
    if (b.isNew) return
    setBusyId(b.id)
    try {
      const ok = await patchBrand(b.id, { visible: nextVisible })
      if (!ok) setBrands(prev => prev.map(x => x.id === b.id ? { ...x, visible: b.visible } : x))
    } finally {
      setBusyId(null)
    }
  }

  function updateField(id: number, field: 'name' | 'search_term' | 'image_url', value: string) {
    setBrands(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b))
  }

  async function save(b: BrandRow) {
    if (!b.name.trim())        { toast('El nombre es requerido.', 'error'); return }
    if (!b.search_term.trim()) { toast('El término de búsqueda es requerido.', 'error'); return }

    setBusyId(b.id)
    try {
      if (b.isNew) {
        const res = await fetch('/api/brands', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            name:        b.name.trim(),
            search_term: b.search_term.trim(),
            ...(b.image_url ? { image_url: b.image_url } : {}),
            visible:     b.visible,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null) as { error?: string } | null
          toast(data?.error ?? 'Revisa los campos requeridos.', 'error')
          return
        }
        const data = await res.json() as { brand: BrandRow }
        setBrands(prev => prev.map(x => x.id === b.id ? { ...data.brand, isNew: false } : x))
        toast('Marca creada.', 'success')
        return
      }
      const ok = await patchBrand(b.id, { name: b.name.trim(), search_term: b.search_term.trim(), image_url: b.image_url })
      if (ok) toast('Marca guardada.', 'success')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className={styles.configSection}>
        <div className={styles.pageHeader}>
          <h2 className={styles.pageTitle}>Marcas</h2>
        </div>
        <p className={styles.pageSubtitle}>Cargando…</p>
      </div>
    )
  }

  return (
    <div className={styles.configSection}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Marcas</h2>
        <p className={styles.pageSubtitle}>
          Marcas mostradas en "Comprá por marca" del catálogo público. El orden acá define el orden real.
        </p>
      </div>

      {brands.map((b, i) => (
        <BrandCard
          key={b.id}
          brand={b}
          isFirst={i === 0}
          isLast={i === brands.length - 1}
          busy={busyId === b.id}
          onMoveUp={() => move(b.id, -1)}
          onMoveDown={() => move(b.id, 1)}
          onToggleVisible={() => toggleVisible(b)}
          onDelete={() => deleteBrand(b)}
          onNameChange={(v) => updateField(b.id, 'name', v)}
          onSearchTermChange={(v) => updateField(b.id, 'search_term', v)}
          onImageChange={(v) => updateField(b.id, 'image_url', v)}
          onSave={() => save(b)}
        />
      ))}

      <Button variant="secondary" onClick={addBrand}>
        <Plus size={14} aria-hidden="true" /> Agregar marca
      </Button>
    </div>
  )
}

interface BrandCardProps {
  brand:              BrandRow
  isFirst:            boolean
  isLast:             boolean
  busy:               boolean
  onMoveUp:           () => void
  onMoveDown:         () => void
  onToggleVisible:    () => void
  onDelete:           () => void
  onNameChange:       (v: string) => void
  onSearchTermChange: (v: string) => void
  onImageChange:      (v: string) => void
  onSave:             () => void
}

function BrandCard({
  brand, isFirst, isLast, busy,
  onMoveUp, onMoveDown, onToggleVisible, onDelete, onNameChange, onSearchTermChange, onImageChange, onSave,
}: BrandCardProps) {
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging]   = useState(false)
  const inputId = `brand-file-${brand.id}`

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    setUploading(true)
    try {
      const url = await uploadBrandImage(file)
      if (url) onImageChange(url)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={styles.formCard}>
      <div className={styles.landingCardHeader}>
        <h3 className={styles.formCardTitle}>
          <Tag size={16} aria-hidden="true" />
          {brand.name || 'Nueva marca'}
          {!brand.visible && <span className={styles.landingHiddenBadge}>Oculta</span>}
        </h3>
        <div className={styles.landingCardControls}>
          <button type="button" className={styles.landingIconBtn} onClick={onMoveUp} disabled={isFirst || busy} aria-label="Subir marca">
            <ChevronUp size={15} aria-hidden="true" />
          </button>
          <button type="button" className={styles.landingIconBtn} onClick={onMoveDown} disabled={isLast || busy} aria-label="Bajar marca">
            <ChevronDown size={15} aria-hidden="true" />
          </button>
          <button type="button" className={styles.landingIconBtn} onClick={onToggleVisible} disabled={busy} aria-label={brand.visible ? 'Ocultar marca' : 'Mostrar marca'}>
            {brand.visible ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
          </button>
          <button type="button" className={`${styles.landingIconBtn} ${styles.landingIconBtnDanger}`} onClick={onDelete} disabled={busy} aria-label="Eliminar marca">
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={styles.formFields}>
        <Input label="Nombre" value={brand.name} onChange={e => onNameChange(e.target.value)} maxLength={60} />
        <Input
          label="Término de búsqueda"
          value={brand.search_term}
          onChange={e => onSearchTermChange(e.target.value)}
          placeholder="Igual al nombre si no hay variantes de escritura"
          maxLength={60}
        />
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Imagen (opcional — sin foto se muestra la inicial)</label>
          <div className={styles.logoArea}>
            <div className={styles.logoPreview}>
              {brand.image_url ? <img src={brand.image_url} alt="" width={80} height={80} /> : (brand.name.charAt(0).toUpperCase() || '?')}
            </div>
            <div
              className={`${styles.logoDropZone} ${dragging ? styles.logoDropZoneActive : ''}`}
              role="button"
              tabIndex={0}
              aria-label="Subir imagen de marca"
              onClick={() => document.getElementById(inputId)?.click()}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') document.getElementById(inputId)?.click() }}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) void handleFile(f) }}
            >
              <Upload size={20} aria-hidden="true" />
              <p className={styles.logoDropText}>{uploading ? 'Subiendo...' : brand.image_url ? 'Cambiar imagen' : 'Arrastra o haz clic para subir'}</p>
              <p className={styles.logoDropHint}>PNG, JPG hasta 5 MB</p>
            </div>
            <input
              id={inputId}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f) }}
            />
          </div>
        </div>
      </div>

      <div className={styles.saveRow}>
        <Button variant="primary" onClick={onSave} loading={busy}>Guardar</Button>
      </div>
    </div>
  )
}
