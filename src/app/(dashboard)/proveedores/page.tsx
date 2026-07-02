'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Truck } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import type { Supplier } from './types'
import styles from './proveedores.module.css'

interface SupplierFormState {
  name:    string
  rif:     string
  phone:   string
  email:   string
  address: string
  notes:   string
}

const EMPTY_FORM: SupplierFormState = { name: '', rif: '', phone: '', email: '', address: '', notes: '' }

interface SuppliersResponse { ok: boolean; suppliers?: Supplier[]; error?: string }
interface SupplierResponse  { ok: boolean; supplier?: Supplier;   error?: string }

export default function ProveedoresPage() {
  const { toast } = useToast()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [search, setSearch]       = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm]           = useState<SupplierFormState>(EMPTY_FORM)

  const loadSuppliers = useCallback(async (q: string) => {
    setLoading(true)
    setError(null)
    try {
      const url = q.trim() ? `/api/suppliers?q=${encodeURIComponent(q.trim())}` : '/api/suppliers'
      const res = await fetch(url)
      const json = await res.json() as SuppliersResponse
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'No se pudo cargar la lista de proveedores')
        return
      }
      setSuppliers(json.suppliers ?? [])
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Carga inicial + debounce de búsqueda contra la API (query real, no filtro local)
  useEffect(() => {
    const timer = setTimeout(() => { void loadSuppliers(search) }, 350)
    return () => clearTimeout(timer)
  }, [search, loadSuppliers])

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(s: Supplier) {
    setEditingId(s.id)
    setForm({ name: s.name, rif: s.rif ?? '', phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '', notes: s.notes ?? '' })
    setModalOpen(true)
  }

  async function handleSave() {
    if (form.name.trim().length < 1) return
    setSaving(true)

    const body = {
      name:    form.name.trim(),
      rif:     form.rif || undefined,
      phone:   form.phone || undefined,
      email:   form.email || undefined,
      address: form.address || undefined,
      notes:   form.notes || undefined,
    }

    try {
      const res = editingId !== null
        ? await fetch(`/api/suppliers/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

      const json = await res.json() as SupplierResponse
      if (!res.ok || !json.ok) {
        toast(json.error ?? 'No se pudo guardar el proveedor', 'error')
        return
      }

      toast(editingId !== null ? 'Proveedor actualizado' : 'Proveedor creado', 'success')
      setModalOpen(false)
      void loadSuppliers(search)
    } catch {
      toast('Error de conexión. Intenta de nuevo.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este proveedor? Esta acción no se puede deshacer.')) return

    try {
      const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
      const json = await res.json() as SupplierResponse
      if (!res.ok || !json.ok) {
        toast(json.error ?? 'No se pudo eliminar el proveedor', 'error')
        return
      }
      toast('Proveedor eliminado', 'success')
      void loadSuppliers(search)
    } catch {
      toast('Error de conexión. Intenta de nuevo.', 'error')
    }
  }

  const isValid = form.name.trim().length >= 1

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Proveedores</h1>
        <Button leftIcon={<Plus size={16} />} onClick={openCreate}>Nuevo</Button>
      </div>

      <div className={styles.searchRow}>
        <Input
          placeholder="Buscar por nombre o RIF..."
          leftIcon={<Search size={16} />}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {error ? (
        <div className={styles.tableWrap}>
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No se pudo cargar</p>
            <p className={styles.emptyDesc}>{error}</p>
          </div>
        </div>
      ) : loading ? (
        <div className={styles.tableWrap}>
          <div className={styles.emptyState}>
            <p className={styles.emptyDesc}>Cargando proveedores…</p>
          </div>
        </div>
      ) : suppliers.length === 0 ? (
        <div className={styles.tableWrap}>
          <div className={styles.emptyState}>
            <Truck size={32} className={styles.emptyIcon} aria-hidden="true" />
            <p className={styles.emptyTitle}>
              {search.trim() ? 'Sin resultados' : 'Sin proveedores registrados'}
            </p>
            <p className={styles.emptyDesc}>
              {search.trim()
                ? 'Prueba con otro nombre o RIF.'
                : 'Agrega tu primer proveedor para empezar a registrar compras.'}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>RIF</th>
                  <th>Teléfono</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id}>
                    <td className={styles.tdName}>{s.name}</td>
                    <td>{s.rif ?? '—'}</td>
                    <td>{s.phone ?? '—'}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <Link href={`/proveedores/compras?supplier=${s.id}`} className={styles.actionLink}>Ver compras</Link>
                        <button type="button" className={styles.actionLink} onClick={() => openEdit(s)}>Editar</button>
                        <button type="button" className={`${styles.actionLink} ${styles.actionDanger}`} onClick={() => void handleDelete(s.id)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.cardList}>
            {suppliers.map(s => (
              <div key={s.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardName}>{s.name}</span>
                </div>
                <div className={styles.cardMeta}>
                  <span>RIF: {s.rif ?? '—'}</span>
                  <span>Tel: {s.phone ?? '—'}</span>
                </div>
                <div className={styles.cardActions}>
                  <Link href={`/proveedores/compras?supplier=${s.id}`} className={styles.actionLink}>Ver compras</Link>
                  <button type="button" className={styles.actionLink} onClick={() => openEdit(s)}>Editar</button>
                  <button type="button" className={`${styles.actionLink} ${styles.actionDanger}`} onClick={() => void handleDelete(s.id)}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId !== null ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button disabled={!isValid} loading={saving} onClick={() => void handleSave()}>Guardar Proveedor</Button>
          </>
        }
      >
        <Input
          label="Nombre"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          required
          autoFocus
        />
        <div className={styles.formRow2}>
          <Input
            label="RIF"
            placeholder="J-12345678-9"
            value={form.rif}
            onChange={e => setForm(f => ({ ...f, rif: e.target.value }))}
          />
          <Input
            label="Teléfono"
            placeholder="0414-1234567"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          />
        </div>
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
        />
        <Input
          label="Dirección"
          value={form.address}
          onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
        />
        <div className={styles.formField}>
          <label className={styles.fieldLabel}>Notas</label>
          <textarea
            className={styles.textarea}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  )
}
