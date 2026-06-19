'use client'

import { useState, useEffect, useCallback } from 'react'
import { Tag, Lock, Pencil, X } from 'lucide-react'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { Modal }    from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import styles from '../configuracion.module.css'

interface ExpenseCat {
  id:        number
  name:      string
  color:     string | null
  is_system: boolean
  active:    boolean
}

interface Props { businessId: number }

export function TabCategorias({ businessId: _businessId }: Props) {
  const { toast } = useToast()

  const [cats,       setCats]       = useState<ExpenseCat[]>([])
  const [loading,    setLoading]    = useState(true)

  const [addOpen,    setAddOpen]    = useState(false)
  const [newName,    setNewName]    = useState('')
  const [addSaving,  setAddSaving]  = useState(false)
  const [addError,   setAddError]   = useState('')

  const [editTarget, setEditTarget] = useState<ExpenseCat | null>(null)
  const [editName,   setEditName]   = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError,  setEditError]  = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/finanzas/categorias')
      if (res.ok) {
        const j = await res.json() as { ok: boolean; categories: ExpenseCat[] }
        setCats(j.categories)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  /* ── Create ── */

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAddSaving(true)
    setAddError('')
    try {
      const res = await fetch('/api/finanzas/categorias', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: newName.trim() }),
      })
      const j = await res.json() as { ok?: boolean; error?: string }
      if (res.ok && j.ok) {
        toast('Categoría creada', 'success')
        setAddOpen(false)
        setNewName('')
        await load()
      } else {
        setAddError(j.error ?? 'Error al crear')
      }
    } finally {
      setAddSaving(false)
    }
  }

  /* ── Rename ── */

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget || !editName.trim()) return
    setEditSaving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/finanzas/categorias/${editTarget.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: editName.trim() }),
      })
      const j = await res.json() as { ok?: boolean; error?: string }
      if (res.ok && j.ok) {
        toast('Categoría actualizada', 'success')
        setEditTarget(null)
        await load()
      } else {
        setEditError(j.error ?? 'Error al actualizar')
      }
    } finally {
      setEditSaving(false)
    }
  }

  /* ── Deactivate ── */

  async function handleDeactivate(cat: ExpenseCat) {
    if (cat.is_system) return
    if (!window.confirm(`¿Desactivar "${cat.name}"? Ya no aparecerá al registrar gastos.`)) return
    const res = await fetch(`/api/finanzas/categorias/${cat.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ active: false }),
    })
    const j = await res.json() as { ok?: boolean; error?: string }
    if (res.ok && j.ok) {
      toast('Categoría desactivada', 'success')
      await load()
    } else {
      toast(j.error ?? 'Error al desactivar', 'error')
    }
  }

  /* ── Render ── */

  return (
    <div className={styles.configSection}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Categorías de Gastos</h2>
        <p className={styles.pageSubtitle}>
          Organiza tus gastos. Las categorías del sistema no pueden desactivarse.
        </p>
      </div>

      <div className={styles.formCard}>
        <div className={styles.tableTopBar}>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Tag size={14} aria-hidden="true" />}
            onClick={() => { setNewName(''); setAddError(''); setAddOpen(true) }}
          >
            Nueva categoría
          </Button>
        </div>

        {loading ? (
          <div className={styles.loadingState}>
            <span>Cargando…</span>
          </div>
        ) : cats.length === 0 ? (
          <p className={styles.pageSubtitle} style={{ padding: 'var(--space-6) 0', textAlign: 'center' }}>
            No hay categorías aún.
          </p>
        ) : (
          <div className={styles.methodsList}>
            {cats.map(cat => (
              <div key={cat.id} className={styles.methodItem}>
                <div className={styles.methodInfo}>
                  <span className={styles.methodName}>{cat.name}</span>
                  {cat.is_system && (
                    <span className={styles.methodType}> · Sistema</span>
                  )}
                </div>

                <div className={styles.userActions}>
                  {cat.is_system ? (
                    <Lock
                      size={14}
                      aria-label="Categoría del sistema — no editable"
                      color="var(--color-text-muted)"
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => { setEditTarget(cat); setEditName(cat.name); setEditError('') }}
                        aria-label={`Renombrar ${cat.name}`}
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                        onClick={() => handleDeactivate(cat)}
                        aria-label={`Desactivar ${cat.name}`}
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add modal ── */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Nueva categoría"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={addSaving}>
              Cancelar
            </Button>
            <Button variant="primary" form="add-cat-form" type="submit" loading={addSaving}>
              Crear
            </Button>
          </>
        }
      >
        <form id="add-cat-form" onSubmit={handleAdd} className={styles.modalForm}>
          <Input
            label="Nombre de la categoría"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="ej. Publicidad"
            maxLength={80}
            autoFocus
            required
          />
          {addError && <p className={styles.errorMsg}>{addError}</p>}
        </form>
      </Modal>

      {/* ── Rename modal ── */}
      <Modal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title="Renombrar categoría"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditTarget(null)} disabled={editSaving}>
              Cancelar
            </Button>
            <Button variant="primary" form="edit-cat-form" type="submit" loading={editSaving}>
              Guardar
            </Button>
          </>
        }
      >
        <form id="edit-cat-form" onSubmit={handleEdit} className={styles.modalForm}>
          <Input
            label="Nuevo nombre"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            maxLength={80}
            autoFocus
            required
          />
          {editError && <p className={styles.errorMsg}>{editError}</p>}
        </form>
      </Modal>
    </div>
  )
}
