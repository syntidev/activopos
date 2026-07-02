'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Truck } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import type { Supplier } from './types'
import styles from './proveedores.module.css'

// CLI-A: sin /api/suppliers todavía. La lista arranca vacía y el modal
// actualiza este estado local — reemplazar por fetch/POST reales cuando exista.
const INITIAL_SUPPLIERS: Supplier[] = []

interface SupplierFormState {
  name:    string
  rif:     string
  phone:   string
  email:   string
  address: string
  notes:   string
}

const EMPTY_FORM: SupplierFormState = { name: '', rif: '', phone: '', email: '', address: '', notes: '' }

function fmtUsd(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ProveedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS)
  const [search, setSearch]       = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm]           = useState<SupplierFormState>(EMPTY_FORM)

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.rif ?? '').toLowerCase().includes(search.toLowerCase())
  )

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

  function handleSave() {
    if (form.name.trim().length < 2) return

    if (editingId !== null) {
      setSuppliers(prev => prev.map(s => s.id === editingId
        ? { ...s, name: form.name.trim(), rif: form.rif || undefined, phone: form.phone || undefined, email: form.email || undefined, address: form.address || undefined, notes: form.notes || undefined }
        : s
      ))
    } else {
      const newSupplier: Supplier = {
        id:        Date.now(),
        name:      form.name.trim(),
        rif:       form.rif || undefined,
        phone:     form.phone || undefined,
        email:     form.email || undefined,
        address:   form.address || undefined,
        notes:     form.notes || undefined,
        is_active: true,
        created_at: new Date().toISOString(),
        total_purchases_usd: 0,
      }
      setSuppliers(prev => [newSupplier, ...prev])
    }
    setModalOpen(false)
  }

  function handleDelete(id: number) {
    if (!confirm('¿Eliminar este proveedor? Esta acción no se puede deshacer.')) return
    setSuppliers(prev => prev.filter(s => s.id !== id))
  }

  const isValid = form.name.trim().length >= 2

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

      {filtered.length === 0 ? (
        <div className={styles.tableWrap}>
          <div className={styles.emptyState}>
            <Truck size={32} className={styles.emptyIcon} aria-hidden="true" />
            <p className={styles.emptyTitle}>
              {suppliers.length === 0 ? 'Sin proveedores registrados' : 'Sin resultados'}
            </p>
            <p className={styles.emptyDesc}>
              {suppliers.length === 0
                ? 'Agrega tu primer proveedor para empezar a registrar compras.'
                : 'Prueba con otro nombre o RIF.'}
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
                  <th>Compras</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td className={styles.tdName}>{s.name}</td>
                    <td>{s.rif ?? '—'}</td>
                    <td>{s.phone ?? '—'}</td>
                    <td>{fmtUsd(s.total_purchases_usd ?? 0)}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <Link href={`/proveedores/compras?supplier=${s.id}`} className={styles.actionLink}>Ver compras</Link>
                        <button type="button" className={styles.actionLink} onClick={() => openEdit(s)}>Editar</button>
                        <button type="button" className={`${styles.actionLink} ${styles.actionDanger}`} onClick={() => handleDelete(s.id)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.cardList}>
            {filtered.map(s => (
              <div key={s.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardName}>{s.name}</span>
                  <span>{fmtUsd(s.total_purchases_usd ?? 0)}</span>
                </div>
                <div className={styles.cardMeta}>
                  <span>RIF: {s.rif ?? '—'}</span>
                  <span>Tel: {s.phone ?? '—'}</span>
                </div>
                <div className={styles.cardActions}>
                  <Link href={`/proveedores/compras?supplier=${s.id}`} className={styles.actionLink}>Ver compras</Link>
                  <button type="button" className={styles.actionLink} onClick={() => openEdit(s)}>Editar</button>
                  <button type="button" className={`${styles.actionLink} ${styles.actionDanger}`} onClick={() => handleDelete(s.id)}>Eliminar</button>
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
            <Button disabled={!isValid} onClick={handleSave}>Guardar Proveedor</Button>
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
