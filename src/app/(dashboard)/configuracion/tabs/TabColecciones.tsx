'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Layers, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { ImageField } from './TabLanding'
import styles from '../configuracion.module.css'

interface Props { businessId: number }

interface CollectionRow {
  id:          number
  slug:        string
  name:        string
  year:        number | null
  cover_path:  string | null
  active:      boolean
  _count?:     { products: number }
}

const EMPTY_DRAFT = { slug: '', name: '', year: '', cover_path: '' }

function slugify(s: string): string {
  return s.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // sin acentos
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function TabColecciones({ businessId: _b }: Props) {
  const { toast } = useToast()
  const [collections, setCollections] = useState<CollectionRow[]>([])
  const [loading, setLoading]         = useState(true)
  const [busy, setBusy]               = useState(false)
  const [showForm, setShowForm]       = useState(false)
  const [editingId, setEditingId]     = useState<number | null>(null)
  const [draft, setDraft]             = useState(EMPTY_DRAFT)
  const [slugTouched, setSlugTouched] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/collections')
      if (res.ok) {
        const data = await res.json() as { collections: CollectionRow[] }
        setCollections(data.collections)
      }
    } catch {
      toast('Error de conexión al cargar colecciones.', 'error')
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
    setSlugTouched(false)
    setShowForm(true)
  }

  function openEdit(c: CollectionRow) {
    setEditingId(c.id)
    setDraft({ slug: c.slug, name: c.name, year: c.year != null ? String(c.year) : '', cover_path: c.cover_path ?? '' })
    setSlugTouched(true)
    setShowForm(true)
  }

  function setName(name: string) {
    setDraft(d => ({ ...d, name, slug: slugTouched ? d.slug : slugify(name) }))
  }

  async function save() {
    if (!draft.name.trim()) { toast('El nombre es requerido.', 'error'); return }
    if (!editingId && !draft.slug.trim()) { toast('El slug es requerido.', 'error'); return }

    setBusy(true)
    try {
      const yearNum = draft.year.trim() ? parseInt(draft.year, 10) : null
      if (editingId) {
        const res = await fetch(`/api/collections/${draft.slug}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ name: draft.name.trim(), year: yearNum, cover_path: draft.cover_path || null }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null) as { error?: string } | null
          toast(data?.error ?? 'Error al guardar.', 'error')
          return
        }
        toast('Colección actualizada.', 'success')
      } else {
        const res = await fetch('/api/collections', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ slug: draft.slug.trim(), name: draft.name.trim(), year: yearNum, cover_path: draft.cover_path || null }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null) as { error?: string } | null
          toast(data?.error ?? 'Error al crear la colección.', 'error')
          return
        }
        toast('Colección creada.', 'success')
      }
      setShowForm(false)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function remove(c: CollectionRow) {
    if (!confirm(`¿Eliminar la colección "${c.name}"? Los productos no se borran, solo dejan de estar agrupados acá.`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/collections/${c.slug}`, { method: 'DELETE' })
      if (!res.ok) { toast('Error al eliminar.', 'error'); return }
      setCollections(prev => prev.filter(x => x.id !== c.id))
      toast('Colección eliminada.', 'success')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.configSection}>
        <div className={styles.pageHeader}>
          <h2 className={styles.pageTitle}>Colecciones</h2>
        </div>
        <p className={styles.pageSubtitle}>Cargando…</p>
      </div>
    )
  }

  return (
    <div className={styles.configSection}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Colecciones</h2>
        <p className={styles.pageSubtitle}>
          Agrupa productos por edición/temporada (ej. "200k 2027") para mostrarlos en un
          carrusel propio en el catálogo — independiente de las categorías normales.
        </p>
      </div>

      {collections.map(c => (
        <div key={c.id} className={styles.formCard}>
          <div className={styles.landingCardHeader}>
            <h3 className={styles.formCardTitle}>
              <Layers size={16} aria-hidden="true" />
              {c.name}
              {c.year && <span className={styles.landingHiddenBadge}>{c.year}</span>}
            </h3>
            <div className={styles.landingCardControls}>
              <span className={styles.pageSubtitle} style={{ margin: 0 }}>
                {c._count?.products ?? 0} producto{c._count?.products === 1 ? '' : 's'}
              </span>
              <button type="button" className={styles.landingIconBtn} onClick={() => openEdit(c)} disabled={busy} aria-label="Editar colección">
                <Pencil size={15} aria-hidden="true" />
              </button>
              <button type="button" className={`${styles.landingIconBtn} ${styles.landingIconBtnDanger}`} onClick={() => remove(c)} disabled={busy} aria-label="Eliminar colección">
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          </div>
          <p className={styles.pageSubtitle}>/{c.slug}</p>
        </div>
      ))}

      {showForm ? (
        <div className={styles.formCard}>
          <h3 className={styles.formCardTitle}>
            <Layers size={16} aria-hidden="true" />
            {editingId ? 'Editar colección' : 'Nueva colección'}
          </h3>
          <div className={styles.formFields}>
            <Input label="Nombre" value={draft.name} onChange={e => setName(e.target.value)} maxLength={120} />
            <Input
              label="Slug"
              value={draft.slug}
              onChange={e => { setSlugTouched(true); setDraft(d => ({ ...d, slug: slugify(e.target.value) })) }}
              disabled={!!editingId}
              placeholder="200k-2027"
              maxLength={60}
            />
            <Input
              label="Edición / año (opcional)"
              type="number"
              value={draft.year}
              onChange={e => setDraft(d => ({ ...d, year: e.target.value }))}
              placeholder="2027"
            />
            <ImageField label="Imagen de portada" value={draft.cover_path} onChange={v => setDraft(d => ({ ...d, cover_path: v }))} />
          </div>
          <div className={styles.saveRow}>
            <Button variant="secondary" onClick={() => setShowForm(false)} disabled={busy}>Cancelar</Button>
            <Button variant="primary" onClick={save} loading={busy}>Guardar</Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={openCreate}>
          <Plus size={14} aria-hidden="true" /> Nueva colección
        </Button>
      )}
    </div>
  )
}
