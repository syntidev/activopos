'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CreditCard, Banknote, ArrowLeftRight, Smartphone,
  Coins, Package, Plus, GripVertical,
} from 'lucide-react'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { Modal }    from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import type { PaymentMethodRecord } from '@/types'
import styles from '../configuracion.module.css'

interface Props { businessId: number }

const TYPE_ICONS: Record<string, React.ElementType> = {
  cash:     Banknote,
  transfer: ArrowLeftRight,
  zelle:    Smartphone,
  binance:  Coins,
  card:     CreditCard,
  other:    Package,
}

const TYPE_LABELS: Record<string, string> = {
  cash:     'Efectivo',
  transfer: 'Transferencia',
  zelle:    'Zelle',
  binance:  'Binance USDT',
  card:     'Tarjeta',
  other:    'Otro',
}

interface NewMethod { name: string; type: string }

const EMPTY_METHOD: NewMethod = { name: '', type: 'other' }

export function TabPagos({ businessId: _businessId }: Props) {
  const { toast } = useToast()

  const [methods, setMethods]         = useState<PaymentMethodRecord[]>([])
  const [loading, setLoading]         = useState(true)
  const [addOpen, setAddOpen]         = useState(false)
  const [newMethod, setNewMethod]     = useState<NewMethod>(EMPTY_METHOD)
  const [addSaving, setAddSaving]     = useState(false)
  const [addError, setAddError]       = useState('')
  const [draggingId, setDraggingId]   = useState<number | null>(null)
  const [dragOverId, setDragOverId]   = useState<number | null>(null)

  const fetchMethods = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/config/payment-methods')
      if (!res.ok) throw new Error()
      const body = await res.json() as { ok: boolean; methods: PaymentMethodRecord[] }
      setMethods(body.methods)
    } catch {
      toast('Error al cargar los métodos de pago.', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { void fetchMethods() }, [fetchMethods])

  const handleToggle = async (method: PaymentMethodRecord) => {
    const next = !method.is_active
    setMethods(prev => prev.map(m => m.id === method.id ? { ...m, is_active: next } : m))
    try {
      const res = await fetch(`/api/config/payment-methods/${method.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ is_active: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setMethods(prev => prev.map(m => m.id === method.id ? { ...m, is_active: method.is_active } : m))
      toast('Error al actualizar el método.', 'error')
    }
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: number) => {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, id: number) => {
    e.preventDefault()
    if (id !== draggingId) setDragOverId(id)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetId: number) => {
    e.preventDefault()
    if (draggingId === null || draggingId === targetId) { setDraggingId(null); setDragOverId(null); return }
    const ordered = [...methods]
    const fromIdx = ordered.findIndex(m => m.id === draggingId)
    const toIdx   = ordered.findIndex(m => m.id === targetId)
    const [moved] = ordered.splice(fromIdx, 1)
    ordered.splice(toIdx, 0, moved)
    const reordered = ordered.map((m, i) => ({ ...m, sort_order: i }))
    setMethods(reordered)
    setDraggingId(null)
    setDragOverId(null)
    void persistOrder(reordered)
  }

  const persistOrder = async (ordered: PaymentMethodRecord[]) => {
    try {
      await Promise.all(
        ordered.map((m) =>
          fetch(`/api/config/payment-methods/${m.id}`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ sort_order: m.sort_order }),
          })
        )
      )
    } catch {
      toast('Error al guardar el orden.', 'error')
      await fetchMethods()
    }
  }

  const handleAddMethod = async () => {
    if (!newMethod.name.trim()) { setAddError('El nombre es obligatorio.'); return }
    setAddSaving(true)
    setAddError('')
    try {
      const res  = await fetch('/api/config/payment-methods', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: newMethod.name.trim(), type: newMethod.type }),
      })
      const body = await res.json() as { error?: string; method?: PaymentMethodRecord }
      if (!res.ok) { setAddError(body.error ?? 'Error al crear el método.'); return }
      setMethods(prev => [...prev, body.method!])
      setNewMethod(EMPTY_METHOD)
      setAddOpen(false)
      toast('Método de pago agregado.', 'success')
    } catch {
      setAddError('Error de conexión. Intenta de nuevo.')
    } finally {
      setAddSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <CreditCard size={24} className={styles.spinner} aria-hidden="true" />
        <span>Cargando...</span>
      </div>
    )
  }

  return (
    <div className={styles.configSection}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Métodos de Pago</h2>
        <p className={styles.pageSubtitle}>Activa los métodos disponibles y ordénalos arrastrando</p>
      </div>

      <div className={styles.formCard}>
        <div className={styles.methodsList}>
          {methods.map((method) => {
            const Icon = TYPE_ICONS[method.type] ?? Package
            return (
              <div
                key={method.id}
                className={`${styles.methodItem} ${draggingId === method.id ? styles.methodDragging : ''} ${dragOverId === method.id ? styles.methodDragOver : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, method.id)}
                onDragOver={(e)  => handleDragOver(e, method.id)}
                onDrop={(e)      => handleDrop(e, method.id)}
                onDragEnd={() => { setDraggingId(null); setDragOverId(null) }}
              >
                <div className={styles.methodDragHandle} aria-hidden="true">
                  <GripVertical size={16} />
                </div>
                <div className={styles.methodIcon}>
                  <Icon size={18} aria-hidden="true" />
                </div>
                <div className={styles.methodInfo}>
                  <p className={styles.methodName}>{method.name}</p>
                  <p className={styles.methodType}>{TYPE_LABELS[method.type] ?? method.type}</p>
                </div>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${method.is_active ? styles.toggleBtnOn : ''}`}
                  onClick={() => void handleToggle(method)}
                  aria-pressed={method.is_active}
                  aria-label={`${method.is_active ? 'Desactivar' : 'Activar'} ${method.name}`}
                >
                  <span className={`${styles.toggleKnob} ${method.is_active ? styles.toggleKnobOn : ''}`} />
                </button>
              </div>
            )
          })}
        </div>

        <div className={styles.saveRow}>
          <Button variant="secondary" leftIcon={<Plus size={16} />} onClick={() => setAddOpen(true)}>
            Agregar método
          </Button>
        </div>
      </div>

      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setNewMethod(EMPTY_METHOD); setAddError('') }}
        title="Nuevo Método de Pago"
        size="sm"
        footer={
          <>
            <Button variant="ghost"   onClick={() => { setAddOpen(false); setNewMethod(EMPTY_METHOD); setAddError('') }} disabled={addSaving}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleAddMethod} loading={addSaving}>
              Agregar
            </Button>
          </>
        }
      >
        <div className={styles.modalForm}>
          <Input
            label="Nombre"
            placeholder="Ej: Pago Móvil"
            value={newMethod.name}
            onChange={(e) => setNewMethod(p => ({ ...p, name: e.target.value }))}
            maxLength={60}
          />

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="new-method-type">
              Tipo
            </label>
            <select
              id="new-method-type"
              className={styles.select}
              value={newMethod.type}
              onChange={(e) => setNewMethod(p => ({ ...p, type: e.target.value }))}
            >
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
              <option value="zelle">Zelle</option>
              <option value="binance">Binance USDT</option>
              <option value="card">Tarjeta</option>
              <option value="other">Otro</option>
            </select>
          </div>

          {addError && <p className={styles.errorMsg} role="alert">{addError}</p>}
        </div>
      </Modal>
    </div>
  )
}
