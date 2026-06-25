'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, X, Check, Lock } from 'lucide-react'
import { Modal, useToast } from '@/components/ui'
import styles from './CategoriasGastos.module.css'

interface Category {
  id:        number
  name:      string
  color:     string | null
  is_system: boolean
  active:    boolean
}

const DEFAULT_NEW_COLOR = '#0038BD'

interface Props {
  open:    boolean
  onClose: () => void
}

export function CategoriasGastos({ open, onClose }: Props) {
  const { toast } = useToast()

  const [cats,     setCats]     = useState<Category[]>([])
  const [loading,  setLoading]  = useState(false)
  const [saving,   setSaving]   = useState(false)

  const [editId,    setEditId]    = useState<number | null>(null)
  const [editName,  setEditName]  = useState('')
  const [editColor, setEditColor] = useState(DEFAULT_NEW_COLOR)

  const [adding,    setAdding]    = useState(false)
  const [newName,   setNewName]   = useState('')
  const [newColor,  setNewColor]  = useState(DEFAULT_NEW_COLOR)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/finanzas/categorias')
      const j   = await res.json() as { ok: boolean; categories: Category[] }
      if (j.ok) setCats(j.categories)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const startEdit = (cat: Category) => {
    setAdding(false)
    setEditId(cat.id)
    setEditName(cat.name)
    setEditColor(cat.color ?? DEFAULT_NEW_COLOR)
  }

  const cancelEdit = () => setEditId(null)

  const saveEdit = async () => {
    if (!editId || editName.trim().length < 2) return
    setSaving(true)
    try {
      const res = await fetch(`/api/finanzas/categorias/${editId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: editName.trim(), color: editColor }),
      })
      if (res.ok) {
        toast('Categoría actualizada', 'success')
        setEditId(null)
        void load()
      } else if (res.status === 409) {
        toast('Ya existe una categoría con ese nombre', 'error')
      } else {
        toast('Error al guardar', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (cat: Category) => {
    if (cat.is_system) return
    if (!confirm(`¿Desactivar "${cat.name}"? No aparecerá en nuevos gastos.`)) return
    const res = await fetch(`/api/finanzas/categorias/${cat.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ active: false }),
    })
    if (res.ok) {
      toast('Categoría desactivada', 'success')
      void load()
    } else {
      toast('Error al desactivar', 'error')
    }
  }

  const handleAdd = async () => {
    if (newName.trim().length < 2) {
      toast('El nombre debe tener al menos 2 caracteres', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/finanzas/categorias', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: newName.trim(), color: newColor }),
      })
      if (res.ok) {
        toast('Categoría creada', 'success')
        setAdding(false)
        setNewName('')
        setNewColor(DEFAULT_NEW_COLOR)
        void load()
      } else if (res.status === 409) {
        toast('Ya existe una categoría con ese nombre', 'error')
      } else {
        toast('Error al crear', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const openAddRow = () => {
    setEditId(null)
    setAdding(true)
    setNewName('')
    setNewColor(DEFAULT_NEW_COLOR)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Categorías de gastos"
      size="sm"
      footer={
        <button
          type="button"
          className={styles.addBtn}
          onClick={onClose}
        >
          Cerrar
        </button>
      }
    >
      <div className={styles.body}>
        {loading ? (
          <p className={styles.emptyMsg}>Cargando…</p>
        ) : (
          <div className={styles.catList}>
            {cats.length === 0 && (
              <p className={styles.emptyMsg}>Sin categorías todavía.</p>
            )}

            {cats.map(cat => (
              <div key={cat.id} className={styles.catRow}>
                {editId === cat.id ? (
                  /* ── Inline edit ── */
                  <>
                    <div className={styles.editRow}>
                      <input
                        type="color"
                        value={editColor}
                        onChange={e => setEditColor(e.target.value)}
                        className={styles.colorInput}
                        aria-label="Color de categoría"
                      />
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className={styles.editInput}
                        maxLength={80}
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter')  void saveEdit()
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        aria-label="Nombre de categoría"
                      />
                    </div>
                    <div className={styles.catActions}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => void saveEdit()}
                        disabled={saving || editName.trim().length < 2}
                        aria-label="Guardar cambios"
                        title="Guardar"
                      >
                        <Check size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={cancelEdit}
                        aria-label="Cancelar edición"
                        title="Cancelar"
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </>
                ) : (
                  /* ── Display mode ── */
                  <>
                    <span
                      className={styles.dot}
                      style={{ background: cat.color ?? '#94A3B8' }}
                      aria-hidden="true"
                    />
                    <span className={cat.active ? styles.catLabel : styles.catLabelMuted}>
                      {cat.name}
                      {!cat.active && ' (inactiva)'}
                    </span>
                    <div className={styles.catActions}>
                      {cat.is_system ? (
                        <span className={styles.lockIcon} title="Categoría del sistema">
                          <Lock size={13} aria-hidden="true" />
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => startEdit(cat)}
                            aria-label={`Editar ${cat.name}`}
                            title="Editar"
                          >
                            <Pencil size={13} aria-hidden="true" />
                          </button>
                          {cat.active && (
                            <button
                              type="button"
                              className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                              onClick={() => void handleDeactivate(cat)}
                              aria-label={`Desactivar ${cat.name}`}
                              title="Desactivar"
                            >
                              <X size={13} aria-hidden="true" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}

            {/* ── Add new category ── */}
            {adding ? (
              <div className={styles.addRow}>
                <input
                  type="color"
                  value={newColor}
                  onChange={e => setNewColor(e.target.value)}
                  className={styles.colorInput}
                  aria-label="Color de nueva categoría"
                />
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className={styles.addInput}
                  placeholder="Nombre de categoría"
                  maxLength={80}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter')  void handleAdd()
                    if (e.key === 'Escape') setAdding(false)
                  }}
                  aria-label="Nombre de nueva categoría"
                />
                <button
                  type="button"
                  className={styles.addBtnPrimary}
                  onClick={() => void handleAdd()}
                  disabled={saving || newName.trim().length < 2}
                >
                  <Check size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={styles.addBtn}
                  onClick={() => setAdding(false)}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className={styles.addRow}>
                <button
                  type="button"
                  className={styles.addBtn}
                  onClick={openAddRow}
                >
                  <Plus size={14} aria-hidden="true" />
                  Nueva categoría
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
