'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, UserPlus } from 'lucide-react'
import { Modal, Button, useToast } from '@/components/ui'
import type { ClientForPOS } from '@/lib/pos'
import styles from './ClienteModal.module.css'

interface ClienteModalProps {
  open: boolean
  onClose: () => void
  onSelect: (client: ClientForPOS | null) => void
  selectedId: number | null
}

interface ClientResult extends ClientForPOS {
  pending_balance_usd: number
}

interface NewClientForm {
  name: string
  cedula: string
  phone: string
}

const EMPTY_FORM: NewClientForm = { name: '', cedula: '', phone: '' }

export function ClienteModal({ open, onClose, onSelect, selectedId }: ClienteModalProps) {
  const { toast } = useToast()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ClientResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState<NewClientForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const timer = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery(''); setResults([]); setShowNew(false); setForm(EMPTY_FORM)
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [open])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!query.trim()) { setResults([]); return }
    setSearching(true)
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clients?search=${encodeURIComponent(query.trim())}&limit=8`)
        const data = await res.json()
        setResults(data.clients ?? [])
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 300)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [query])

  const handleSelect = (client: ClientResult) => {
    if (client.pending_balance_usd > 0) {
      toast(`${client.name} tiene deuda pendiente de $${client.pending_balance_usd.toFixed(2)}`, 'warning')
    }
    onSelect(client)
  }

  const handleSaveNew = async () => {
    if (!form.name.trim()) { toast('El nombre es obligatorio', 'error'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al crear cliente')
      onSelect(data.client)
      toast(`Cliente ${form.name} creado`, 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Seleccionar Cliente"
      size="sm"
    >
      <div className={styles.body}>
        {!showNew ? (
          <>
            <div className={styles.searchRow}>
              <Search size={16} className={styles.searchIcon} aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                className={styles.searchInput}
                placeholder="Nombre o cédula..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar cliente"
              />
              {searching && <span className={styles.spinner} aria-hidden="true" />}
            </div>

            {selectedId && (
              <button className={styles.clearBtn} onClick={() => onSelect(null)} type="button">
                Quitar cliente — usar cliente general
              </button>
            )}

            <div className={styles.resultsList}>
              {results.map((c) => (
                <button
                  key={c.id}
                  className={`${styles.resultRow} ${c.id === selectedId ? styles.resultActive : ''}`}
                  onClick={() => handleSelect(c)}
                  type="button"
                >
                  <div className={styles.clientInfo}>
                    <span className={styles.clientName}>{c.name}</span>
                    {c.cedula && <span className={styles.clientMeta}>CI: {c.cedula}</span>}
                    {c.phone && <span className={styles.clientMeta}>{c.phone}</span>}
                  </div>
                  {c.pending_balance_usd > 0 && (
                    <span className={styles.debtBadge}>
                      -${c.pending_balance_usd.toFixed(2)}
                    </span>
                  )}
                </button>
              ))}
              {!searching && query && results.length === 0 && (
                <p className={styles.noResults}>Sin resultados para &ldquo;{query}&rdquo;</p>
              )}
            </div>

            <button
              className={styles.newClientBtn}
              onClick={() => setShowNew(true)}
              type="button"
            >
              <UserPlus size={15} aria-hidden="true" />
              Nuevo Cliente
            </button>
          </>
        ) : (
          <div className={styles.newForm}>
            <h3 className={styles.newTitle}>Nuevo Cliente</h3>
            {(['name', 'cedula', 'phone'] as const).map((field) => (
              <div key={field} className={styles.field}>
                <label className={styles.label} htmlFor={`nc-${field}`}>
                  {field === 'name' ? 'Nombre *' : field === 'cedula' ? 'Cédula' : 'Teléfono'}
                </label>
                <input
                  id={`nc-${field}`}
                  type="text"
                  className={styles.input}
                  value={form[field]}
                  onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
                />
              </div>
            ))}
            <div className={styles.newActions}>
              <Button variant="ghost" onClick={() => setShowNew(false)}>Volver</Button>
              <Button variant="primary" onClick={handleSaveNew} loading={saving}>
                Guardar y seleccionar
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
