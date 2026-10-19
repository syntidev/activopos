'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Truck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { SHIPPING_KINDS } from '@/types/shipping'
import type { ShippingKind, ShippingMethodDTO } from '@/types/shipping'
import styles from '../configuracion.module.css'

interface Props { businessId: number }

interface MethodRow {
  id:              number
  code:            string
  label:           string
  kind:            ShippingKind
  requires_branch: boolean
  instructions:    string
  active:          boolean
  sort_order:      number
  isNew:           boolean
}

const KIND_LABEL: Record<ShippingKind, string> = {
  pickup:         'Retiro en tienda',
  delivery:       'Delivery',
  carrier:        'Encomienda a domicilio',
  carrier_branch: 'Encomienda a oficina',
}

interface ApiError { error?: string }

const toRow = (m: ShippingMethodDTO): MethodRow => ({
  id: m.id, code: m.code, label: m.label, kind: m.kind, requires_branch: m.requires_branch,
  instructions: m.instructions ?? '', active: m.active, sort_order: m.sort_order, isNew: false,
})

const newRow = (sortOrder: number): MethodRow => ({
  id: -Date.now(), code: '', label: '', kind: 'carrier_branch', requires_branch: true,
  instructions: '', active: true, sort_order: sortOrder, isNew: true,
})

// Configuración > Envíos: CRUD de /api/shipping-methods (la escritura es solo admin: el
// servidor responde 403 al cajero, y la página de Configuración ya redirige al cajero).
export function TabEnvios({ businessId: _b }: Props) {
  const { toast } = useToast()
  const [rows, setRows]       = useState<MethodRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId]   = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/shipping-methods', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('http')))
      .then((j: { methods: ShippingMethodDTO[] }) => setRows(j.methods.map(toRow)))
      .catch(() => toast('No se pudieron cargar los métodos de envío.', 'error'))
      .finally(() => setLoading(false))
  }, [toast])

  const update = (id: number, patch: Partial<MethodRow>) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))

  async function save(r: MethodRow) {
    setBusyId(r.id)
    try {
      const body = {
        label: r.label.trim(), kind: r.kind, requires_branch: r.requires_branch,
        active: r.active, sort_order: r.sort_order, instructions: r.instructions.trim() || null,
      }
      const res = await fetch(r.isNew ? '/api/shipping-methods' : `/api/shipping-methods/${r.id}`, {
        method:  r.isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(r.isNew ? { code: r.code.trim(), ...body } : body),
      })
      const data = await res.json().catch(() => null) as ({ method?: ShippingMethodDTO } & ApiError) | null
      if (!res.ok || !data?.method) {
        toast(data?.error ?? (res.status === 403 ? 'Solo un administrador puede editar los envíos.' : 'No se pudo guardar el método.'), 'error')
        return
      }
      setRows(prev => prev.map(x => x.id === r.id ? toRow(data.method as ShippingMethodDTO) : x))
      toast(r.isNew ? 'Método creado.' : 'Método guardado.', 'success')
    } catch {
      toast('Error de conexión al guardar.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(r: MethodRow) {
    if (r.isNew) { setRows(prev => prev.filter(x => x.id !== r.id)); return }
    if (!confirm(`¿Eliminar el método "${r.label}"?`)) return
    setBusyId(r.id)
    try {
      const res = await fetch(`/api/shipping-methods/${r.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => null) as ApiError | null
        // 409 = tiene pedidos: el servidor pide desactivarlo en vez de borrarlo.
        toast(data?.error ?? 'No se pudo eliminar el método.', 'error')
        return
      }
      setRows(prev => prev.filter(x => x.id !== r.id))
      toast('Método eliminado.', 'success')
    } catch {
      toast('Error de conexión al eliminar.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className={styles.configSection} data-testid="envios-tab">
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Envíos</h2>
        <p className={styles.pageSubtitle}>
          Métodos de envío que el cliente elige en el carrito público. Sin métodos activos, el envío funciona como antes.
        </p>
      </div>

      {loading && <p className={styles.pageSubtitle}>Cargando…</p>}

      {rows.map(r => (
        <div key={r.id} className={styles.formCard} data-testid={`envios-method-${r.code || 'nuevo'}`}>
          <h3 className={styles.formCardTitle}>
            <Truck size={16} aria-hidden="true" />
            {r.label || 'Nuevo método'}
            {!r.active && <span className={styles.landingHiddenBadge}>Inactivo</span>}
          </h3>

          <div className={styles.formFields}>
            {r.isNew && (
              <Input
                label="Código (a-z, 0-9, _ y -; no se puede cambiar)"
                data-testid="envios-code"
                value={r.code}
                onChange={e => update(r.id, { code: e.target.value.toLowerCase() })}
                maxLength={40}
              />
            )}
            <Input label="Nombre visible" data-testid="envios-label" value={r.label} onChange={e => update(r.id, { label: e.target.value })} maxLength={60} />
            <label className={styles.label} htmlFor={`kind-${r.id}`}>Tipo</label>
            <select
              id={`kind-${r.id}`}
              data-testid="envios-kind"
              className={styles.select}
              value={r.kind}
              onChange={e => update(r.id, { kind: e.target.value as ShippingKind })}
            >
              {SHIPPING_KINDS.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
            <Input
              label="Instrucciones para el cliente (opcional)"
              data-testid="envios-instructions"
              value={r.instructions}
              onChange={e => update(r.id, { instructions: e.target.value })}
              maxLength={300}
            />
            <Input
              label="Orden"
              type="number"
              data-testid="envios-order"
              value={r.sort_order}
              onChange={e => update(r.id, { sort_order: Number(e.target.value) || 0 })}
            />
          </div>

          <div className={styles.toggleRow}>
            <div>
              <p className={styles.toggleLabel}>Pide la oficina de destino</p>
              <p className={styles.toggleHint}>El cliente indica la sucursal dentro de la dirección.</p>
            </div>
            <button
              type="button"
              data-testid="envios-branch-toggle"
              className={`${styles.toggleBtn} ${r.requires_branch ? styles.toggleBtnOn : ''}`}
              onClick={() => update(r.id, { requires_branch: !r.requires_branch })}
              aria-pressed={r.requires_branch}
              aria-label="Pide la oficina de destino"
            >
              <span className={`${styles.toggleKnob} ${r.requires_branch ? styles.toggleKnobOn : ''}`} />
            </button>
          </div>

          <div className={styles.toggleRow}>
            <div>
              <p className={styles.toggleLabel}>Activo</p>
              <p className={styles.toggleHint}>Solo los activos aparecen en el carrito.</p>
            </div>
            <button
              type="button"
              data-testid="envios-active-toggle"
              className={`${styles.toggleBtn} ${r.active ? styles.toggleBtnOn : ''}`}
              onClick={() => update(r.id, { active: !r.active })}
              aria-pressed={r.active}
              aria-label="Método activo"
            >
              <span className={`${styles.toggleKnob} ${r.active ? styles.toggleKnobOn : ''}`} />
            </button>
          </div>

          <div className={styles.saveRow}>
            <Button variant="ghost" onClick={() => remove(r)} disabled={busyId === r.id} data-testid="envios-delete">
              <Trash2 size={14} aria-hidden="true" /> Eliminar
            </Button>
            <Button
              variant="primary"
              onClick={() => save(r)}
              loading={busyId === r.id}
              disabled={!r.label.trim() || (r.isNew && r.code.trim().length < 2)}
              data-testid="envios-save"
            >
              Guardar
            </Button>
          </div>
        </div>
      ))}

      <Button variant="secondary" onClick={() => setRows(prev => [...prev, newRow(prev.length)])} data-testid="envios-add">
        <Plus size={14} aria-hidden="true" /> Agregar método
      </Button>
    </div>
  )
}
