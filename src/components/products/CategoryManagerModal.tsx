'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import styles from './CategoryManagerModal.module.css'

interface ManagedCategory {
  id: number
  name: string
  color: string | null
  _count: { products: number }
}

interface CategoryManagerModalProps {
  isOpen: boolean
  onClose: () => void
  /** Avisa a la página para que refresque sus pestañas de categorías. */
  onChanged: () => void
}

interface ApiResult {
  ok: boolean
  error?: string
  moved?: number
}

// La API valida color como '#RRGGBB' (POST) — el input nativo siempre entrega ese formato.
const DEFAULT_COLOR = '#0038BD'
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/
const NAME_MAX = 80

const colorOf = (c: ManagedCategory): string =>
  c.color && HEX_COLOR_RE.test(c.color) ? c.color : DEFAULT_COLOR

const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

async function send(url: string, method: string, body?: unknown): Promise<ApiResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = (await res.json().catch(() => ({}))) as ApiResult
    return res.ok ? { ...data, ok: true } : { ok: false, error: data.error ?? 'Error del servidor' }
  } catch {
    return { ok: false, error: 'Sin conexión con el servidor' }
  }
}

export function CategoryManagerModal({ isOpen, onClose, onChanged }: CategoryManagerModalProps) {
  const { toast } = useToast()
  const [items, setItems]           = useState<ManagedCategory[]>([])
  const [loading, setLoading]       = useState(false)
  const [loadError, setLoadError]   = useState('')
  const [query, setQuery]           = useState('')
  const [newName, setNewName]       = useState('')
  const [busy, setBusy]             = useState(false)
  const [error, setError]           = useState('')
  const [editingId, setEditingId]   = useState<number | null>(null)
  const [editName, setEditName]     = useState('')
  const [editColor, setEditColor]   = useState(DEFAULT_COLOR)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [mergeTo, setMergeTo]       = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/categories')
      const data = (await res.json()) as { categories?: ManagedCategory[] }
      if (!res.ok || !data.categories) throw new Error('load')
      setItems(data.categories)
    } catch {
      setLoadError('No se pudieron cargar las categorías')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setQuery(''); setError(''); setEditingId(null); setDeletingId(null)
    void load()
  }, [isOpen, load])

  const visible = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean).slice(0, 5)
    return items.filter(c => words.every(w => fold(c.name).includes(w)))
  }, [items, query])

  // Ejecuta una mutación: bloquea la UI, muestra el error de la API y refresca ambas listas.
  const run = useCallback(async (action: () => Promise<ApiResult>, okMsg: (r: ApiResult) => string): Promise<boolean> => {
    setBusy(true); setError('')
    const r = await action()
    setBusy(false)
    if (!r.ok) { setError(r.error ?? 'Error'); await load(); return false }
    toast(okMsg(r), 'success')
    await load()
    onChanged()
    return true
  }, [load, onChanged, toast])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    const ok = await run(() => send('/api/categories', 'POST', { name, color: DEFAULT_COLOR }), () => 'Categoría creada')
    if (ok) setNewName('')
  }

  const startEdit = (c: ManagedCategory) => {
    setDeletingId(null); setError('')
    setEditingId(c.id); setEditName(c.name); setEditColor(colorOf(c))
  }

  const handleSaveEdit = async (c: ManagedCategory) => {
    const name = editName.trim()
    if (!name) { setError('El nombre no puede estar vacío'); return }
    const ok = await run(() => send(`/api/categories/${c.id}`, 'PATCH', { name, color: editColor }), () => 'Categoría actualizada')
    if (ok) setEditingId(null)
  }

  const handleMove = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (busy || j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[index], next[j]] = [next[j], next[index]]
    setItems(next) // optimista; run() recarga el orden real
    void run(() => send('/api/categories/reorder', 'PATCH', { ids: next.map(c => c.id) }), () => 'Orden guardado')
  }

  const startDelete = (c: ManagedCategory) => {
    setEditingId(null); setError('')
    setDeletingId(c.id); setMergeTo('')
  }

  const handleDelete = async (c: ManagedCategory) => {
    const count = c._count.products
    const ok = count === 0
      ? await run(() => send(`/api/categories/${c.id}`, 'DELETE'), () => 'Categoría eliminada')
      : await run(
          () => send(`/api/categories/${c.id}/merge`, 'POST', { target_id: Number(mergeTo) }),
          r => `${r.moved ?? 0} producto(s) movidos y categoría eliminada`,
        )
    if (ok) setDeletingId(null)
  }

  return (
    <Modal open={isOpen} onClose={onClose} title="Gestionar categorías" size="md">
      <div className={styles.wrap}>
        <form className={styles.createRow} onSubmit={handleCreate}>
          <input
            className={styles.input}
            value={newName}
            maxLength={NAME_MAX}
            placeholder="Nueva categoría"
            aria-label="Nombre de la nueva categoría"
            onChange={e => setNewName(e.target.value)}
          />
          <button className={styles.primaryBtn} type="submit" disabled={busy || !newName.trim()}>
            <Plus size={16} aria-hidden="true" /> Crear
          </button>
        </form>

        <div className={styles.searchBox}>
          <Search size={16} aria-hidden="true" className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            type="search"
            value={query}
            placeholder="Buscar categoría"
            aria-label="Buscar categoría"
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}

        {loading && items.length === 0 ? (
          <p className={styles.state}><Loader2 size={16} className={styles.spin} aria-hidden="true" /> Cargando categorías…</p>
        ) : loadError ? (
          <p className={styles.state} role="alert">
            {loadError}{' '}
            <button type="button" className={styles.linkBtn} onClick={() => void load()}>Reintentar</button>
          </p>
        ) : visible.length === 0 ? (
          <p className={styles.state}>{items.length === 0 ? 'Aún no tienes categorías.' : 'Ninguna categoría coincide con la búsqueda.'}</p>
        ) : (
          <ul className={styles.list} aria-label="Categorías">
            {visible.map(c => {
              const index = items.indexOf(c)
              const editing = editingId === c.id
              const deleting = deletingId === c.id
              const others = items.filter(o => o.id !== c.id)
              return (
                <li key={c.id} className={styles.row} data-testid="cat-row">
                  <div className={styles.rowMain}>
                    <input
                      type="color"
                      className={styles.swatch}
                      value={editing ? editColor : colorOf(c)}
                      disabled={!editing}
                      aria-label={`Color de ${c.name}`}
                      onChange={e => setEditColor(e.target.value)}
                    />
                    {editing ? (
                      <input
                        className={styles.input}
                        value={editName}
                        maxLength={NAME_MAX}
                        aria-label={`Nuevo nombre de ${c.name}`}
                        autoFocus
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') void handleSaveEdit(c) }}
                      />
                    ) : (
                      <span className={styles.name}>{c.name}</span>
                    )}
                    <span className={styles.count} title="Productos activos">{c._count.products}</span>
                    {!editing && (
                      <div className={styles.actions}>
                        <button type="button" className={styles.iconBtn} aria-label={`Subir ${c.name}`}
                          disabled={busy || !!query || index === 0} onClick={() => handleMove(index, -1)}>
                          <ArrowUp size={16} aria-hidden="true" />
                        </button>
                        <button type="button" className={styles.iconBtn} aria-label={`Bajar ${c.name}`}
                          disabled={busy || !!query || index === items.length - 1} onClick={() => handleMove(index, 1)}>
                          <ArrowDown size={16} aria-hidden="true" />
                        </button>
                        <button type="button" className={styles.iconBtn} aria-label={`Renombrar ${c.name}`}
                          disabled={busy} onClick={() => startEdit(c)}>
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button type="button" className={`${styles.iconBtn} ${styles.iconBtnDanger}`} aria-label={`Eliminar ${c.name}`}
                          disabled={busy} onClick={() => startDelete(c)}>
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>

                  {editing && (
                    <div className={styles.panel}>
                      <p className={styles.notice}>
                        El importador de Excel busca la categoría por nombre: usa el nombre nuevo en tus próximos archivos.
                      </p>
                      <div className={styles.panelActions}>
                        <button type="button" className={styles.ghostBtn} disabled={busy} onClick={() => setEditingId(null)}>Cancelar</button>
                        <button type="button" className={styles.primaryBtn} disabled={busy} onClick={() => void handleSaveEdit(c)}>Guardar</button>
                      </div>
                    </div>
                  )}

                  {deleting && (
                    <div className={styles.panel}>
                      {c._count.products === 0 ? (
                        <p className={styles.notice}>¿Eliminar la categoría «{c.name}»?</p>
                      ) : (
                        <>
                          <label className={styles.notice} htmlFor={`merge-${c.id}`}>
                            Mover sus {c._count.products} productos a…
                          </label>
                          <select id={`merge-${c.id}`} className={styles.input} value={mergeTo} onChange={e => setMergeTo(e.target.value)}>
                            <option value="">Elige la categoría destino</option>
                            {others.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </select>
                        </>
                      )}
                      <div className={styles.panelActions}>
                        <button type="button" className={styles.ghostBtn} disabled={busy} onClick={() => setDeletingId(null)}>Cancelar</button>
                        <button type="button" className={styles.dangerBtn}
                          disabled={busy || (c._count.products > 0 && !mergeTo)} onClick={() => void handleDelete(c)}>
                          {c._count.products === 0 ? 'Eliminar' : 'Mover y eliminar'}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {!!query && items.length > 1 && <p className={styles.hint}>Borra la búsqueda para reordenar.</p>}
      </div>
    </Modal>
  )
}
