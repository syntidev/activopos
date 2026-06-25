'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Banknote, ArrowLeftRight, Smartphone, Package,
  Plus, GripVertical, Terminal, X, Pencil,
  CreditCard, Coins, MessageSquare, Save, Loader2,
} from 'lucide-react'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { Modal }    from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import type { PaymentMethodRecord } from '@/types'
import styles from './TabCobros.module.css'

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */

const BANCOS_VE = [
  { code: '0102', name: 'Banco de Venezuela (BDV)' },
  { code: '0104', name: 'Venezolano de Crédito' },
  { code: '0105', name: 'Banco Mercantil' },
  { code: '0108', name: 'BBVA Provincial' },
  { code: '0114', name: 'Bancaribe' },
  { code: '0115', name: 'Banco Exterior' },
  { code: '0116', name: 'Banco Occidental de Descuento (BOD)' },
  { code: '0128', name: 'Banco Caroní' },
  { code: '0134', name: 'Banesco' },
  { code: '0137', name: 'Banco Sofitasa' },
  { code: '0138', name: 'Banco Plaza' },
  { code: '0146', name: 'Bangente' },
  { code: '0149', name: 'Banco del Pueblo Soberano' },
  { code: '0151', name: 'BFC Banco Fondo Común' },
  { code: '0156', name: '100% Banco' },
  { code: '0157', name: 'DelSur' },
  { code: '0163', name: 'Banco del Tesoro' },
  { code: '0166', name: 'Banco Agrícola de Venezuela' },
  { code: '0168', name: 'Bancrecer' },
  { code: '0169', name: 'R4 Banco Microfinanciero' },
  { code: '0172', name: 'Bancamiga' },
  { code: '0174', name: 'Banplus' },
  { code: '0175', name: 'Banco Bicentenario' },
  { code: '0177', name: 'BANFANB' },
  { code: '0190', name: 'Citibank N.A.' },
  { code: '0191', name: 'Banco Nacional de Crédito (BNC)' },
  { code: '0601', name: 'Instituto Municipal de Crédito Popular' },
] as const

const TYPE_CONFIG: Record<string, { label: string; badgeClass: string; Icon: React.ElementType }> = {
  cash:     { label: 'Efectivo',      badgeClass: styles.badgeCash,     Icon: Banknote       },
  movil:    { label: 'Pago Móvil',    badgeClass: styles.badgeMovil,    Icon: Smartphone     },
  biopago:  { label: 'BioPago',       badgeClass: styles.badgeBiopago,  Icon: CreditCard     },
  transfer: { label: 'Transferencia', badgeClass: styles.badgeTransfer, Icon: ArrowLeftRight },
  zelle:    { label: 'Zelle',         badgeClass: styles.badgeZelle,    Icon: Smartphone     },
  binance:  { label: 'Binance',       badgeClass: styles.badgeBinance,  Icon: Coins          },
  card:     { label: 'Tarjeta',       badgeClass: styles.badgeCard,     Icon: CreditCard     },
  other:    { label: 'Otro',          badgeClass: styles.badgeOther,    Icon: Package        },
}

const DEVICE_TYPE_LABELS: Record<string, string> = {
  debit:   'Débito',
  credit:  'Crédito',
  biopago: 'BioPago',
}

/* ═══════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════ */

interface Props { businessId: number }

interface DeviceRecord {
  id:           number
  business_id:  number
  tipo:         'debit' | 'credit' | 'biopago'
  banco:        string
  serial:       string | null
  nro_comercio: string | null
  is_active:    boolean
}

interface DeviceForm {
  tipo:         'debit' | 'credit' | 'biopago'
  banco:        string
  serial:       string
  nro_comercio: string
  is_active:    boolean
}

interface PagoMovilData {
  banco:                 string
  telefono:              string
  usa_whatsapp_negocio:  boolean
  titular:               string
  tipo_doc:              string
  documento:             string
}

interface SimplePayData {
  contacto: string
  titular:  string
}

interface UsdtData {
  wallet:  string
  red:     string
  titular: string
}

interface CobrosFormData {
  pago_movil: PagoMovilData
  zelle:      SimplePayData
  zinli:      SimplePayData
  paypal:     SimplePayData
  binance:    SimplePayData
  usdt:       UsdtData
}

/* ═══════════════════════════════════════════════════════════
   EMPTY STATE DEFAULTS
═══════════════════════════════════════════════════════════ */

const EMPTY_DEVICE_FORM: DeviceForm = {
  tipo: 'debit', banco: '', serial: '', nro_comercio: '', is_active: true,
}

const EMPTY_COBROS: CobrosFormData = {
  pago_movil: { banco: '', telefono: '', usa_whatsapp_negocio: false, titular: '', tipo_doc: 'V', documento: '' },
  zelle:      { contacto: '', titular: '' },
  zinli:      { contacto: '', titular: '' },
  paypal:     { contacto: '', titular: '' },
  binance:    { contacto: '', titular: '' },
  usdt:       { wallet: '', red: 'TRC20', titular: '' },
}

/* ═══════════════════════════════════════════════════════════
   WA PREVIEW BUILDER
═══════════════════════════════════════════════════════════ */

function buildWaPreview(data: CobrosFormData): string {
  const parts: string[] = []

  const pm = data.pago_movil
  if (pm.banco || pm.telefono || pm.titular) {
    const banco = BANCOS_VE.find(b => b.code === pm.banco)
    const lines = ['*Pago Movil:*']
    if (banco)        lines.push(`Banco: ${banco.name} (${banco.code})`)
    if (pm.telefono)  lines.push(`Telefono: ${pm.telefono}`)
    if (pm.titular)   lines.push(`Titular: ${pm.titular}`)
    if (pm.documento) lines.push(`${pm.tipo_doc}-${pm.documento}`)
    parts.push(lines.join('\n'))
  }

  if (data.zelle.contacto || data.zelle.titular) {
    const lines = ['*Zelle:*']
    if (data.zelle.contacto) lines.push(data.zelle.contacto)
    if (data.zelle.titular)  lines.push(`Titular: ${data.zelle.titular}`)
    parts.push(lines.join('\n'))
  }

  if (data.zinli.contacto || data.zinli.titular) {
    const lines = ['*Zinli:*']
    if (data.zinli.contacto) lines.push(data.zinli.contacto)
    if (data.zinli.titular)  lines.push(`Titular: ${data.zinli.titular}`)
    parts.push(lines.join('\n'))
  }

  if (data.paypal.contacto || data.paypal.titular) {
    const lines = ['*PayPal:*']
    if (data.paypal.contacto) lines.push(data.paypal.contacto)
    if (data.paypal.titular)  lines.push(`Titular: ${data.paypal.titular}`)
    parts.push(lines.join('\n'))
  }

  if (data.binance.contacto || data.binance.titular) {
    const lines = ['*Binance Pay:*']
    if (data.binance.contacto) lines.push(data.binance.contacto)
    if (data.binance.titular)  lines.push(`Titular: ${data.binance.titular}`)
    parts.push(lines.join('\n'))
  }

  if (data.usdt.wallet || data.usdt.titular) {
    const lines = [`*USDT (${data.usdt.red || 'TRC20'}):*`]
    if (data.usdt.wallet)   lines.push(`Wallet: ${data.usdt.wallet}`)
    if (data.usdt.titular)  lines.push(`Titular: ${data.usdt.titular}`)
    parts.push(lines.join('\n'))
  }

  if (parts.length === 0) return ''

  return '*Datos de Pago:*\n\n' + parts.join('\n\n')
}

/* ═══════════════════════════════════════════════════════════
   BANCO SELECT (reusable within this file)
═══════════════════════════════════════════════════════════ */

function BancoSelect({
  id, value, onChange, className,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <select
      id={id}
      className={`${styles.select} ${className ?? ''}`}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">Seleccionar banco...</option>
      {BANCOS_VE.map(b => (
        <option key={b.code} value={b.code}>{b.code} — {b.name}</option>
      ))}
    </select>
  )
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */

export function TabCobros({ businessId: _businessId }: Props) {
  const { toast } = useToast()

  /* ── Sección 1: Medios de pago ── */
  const [methods, setMethods]         = useState<PaymentMethodRecord[]>([])
  const [loadingMethods, setLoadingMethods] = useState(true)
  const [draggingId, setDraggingId]   = useState<number | null>(null)
  const [dragOverId, setDragOverId]   = useState<number | null>(null)
  const [addMethodOpen, setAddMethodOpen] = useState(false)
  const [editMethodData, setEditMethodData] = useState<PaymentMethodRecord | null>(null)
  const [newMethod, setNewMethod]     = useState({ name: '', type: 'cash' })
  const [methodSaving, setMethodSaving] = useState(false)
  const [methodError, setMethodError] = useState('')

  /* ── Sección 2: Dispositivos ── */
  const [devices, setDevices]         = useState<DeviceRecord[]>([])
  const [loadingDevices, setLoadingDevices] = useState(true)
  const [deviceModalOpen, setDeviceModalOpen] = useState(false)
  const [editDeviceData, setEditDeviceData] = useState<DeviceRecord | null>(null)
  const [deviceForm, setDeviceForm]   = useState<DeviceForm>(EMPTY_DEVICE_FORM)
  const [deviceSaving, setDeviceSaving] = useState(false)
  const [deviceError, setDeviceError] = useState('')

  /* ── Sección 3: Datos para cobrar ── */
  const [cobrosData, setCobrosData]   = useState<CobrosFormData>(EMPTY_COBROS)
  const [loadingCobros, setLoadingCobros] = useState(true)
  const [savingCobros, setSavingCobros] = useState(false)

  /* ─────────────────────────────────────────────
     DATA LOADING
  ───────────────────────────────────────────── */

  const fetchMethods = useCallback(async () => {
    setLoadingMethods(true)
    try {
      const res  = await fetch('/api/config/payment-methods')
      if (!res.ok) throw new Error()
      const body = await res.json() as { ok: boolean; methods: PaymentMethodRecord[] }
      setMethods(body.methods ?? [])
    } catch {
      toast('Error al cargar los métodos de pago.', 'error')
    } finally {
      setLoadingMethods(false)
    }
  }, [toast])

  const fetchDevices = useCallback(async () => {
    setLoadingDevices(true)
    try {
      const res  = await fetch('/api/config/devices')
      if (!res.ok) { setDevices([]); return }
      const body = await res.json() as { devices?: DeviceRecord[] }
      setDevices(body.devices ?? [])
    } catch {
      setDevices([])
    } finally {
      setLoadingDevices(false)
    }
  }, [])

  const fetchCobros = useCallback(async () => {
    setLoadingCobros(true)
    try {
      const res  = await fetch('/api/config/cobros/data')
      if (!res.ok) { setCobrosData(EMPTY_COBROS); return }
      const body = await res.json() as { data?: CobrosFormData }
      setCobrosData(body.data ?? EMPTY_COBROS)
    } catch {
      setCobrosData(EMPTY_COBROS)
    } finally {
      setLoadingCobros(false)
    }
  }, [])

  useEffect(() => {
    void fetchMethods()
    void fetchDevices()
    void fetchCobros()
  }, [fetchMethods, fetchDevices, fetchCobros])

  /* ─────────────────────────────────────────────
     SECTION 1 HANDLERS
  ───────────────────────────────────────────── */

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
    if (draggingId === null || draggingId === targetId) {
      setDraggingId(null); setDragOverId(null); return
    }
    const ordered = [...methods]
    const fromIdx = ordered.findIndex(m => m.id === draggingId)
    const toIdx   = ordered.findIndex(m => m.id === targetId)
    const [moved] = ordered.splice(fromIdx, 1)
    ordered.splice(toIdx, 0, moved)
    const reordered = ordered.map((m, i) => ({ ...m, sort_order: i }))
    setMethods(reordered)
    setDraggingId(null); setDragOverId(null)
    void persistMethodOrder(reordered)
  }

  const persistMethodOrder = async (ordered: PaymentMethodRecord[]) => {
    try {
      await Promise.all(ordered.map(m =>
        fetch(`/api/config/payment-methods/${m.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ sort_order: m.sort_order }),
        })
      ))
    } catch {
      toast('Error al guardar el orden.', 'error')
      await fetchMethods()
    }
  }

  const handleAddMethod = async () => {
    if (!newMethod.name.trim()) { setMethodError('El nombre es obligatorio.'); return }
    setMethodSaving(true); setMethodError('')
    try {
      const res  = await fetch('/api/config/payment-methods', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: newMethod.name.trim(), type: newMethod.type }),
      })
      const body = await res.json() as { error?: string; method?: PaymentMethodRecord }
      if (!res.ok) { setMethodError(body.error ?? 'Error al crear el método.'); return }
      setMethods(prev => [...prev, body.method!])
      setNewMethod({ name: '', type: 'cash' })
      setAddMethodOpen(false)
      toast('Método de pago agregado.', 'success')
    } catch {
      setMethodError('Error de conexión. Intenta de nuevo.')
    } finally {
      setMethodSaving(false)
    }
  }

  const handleUpdateMethod = async () => {
    if (!editMethodData) return
    if (!editMethodData.name.trim()) { setMethodError('El nombre es obligatorio.'); return }
    setMethodSaving(true); setMethodError('')
    try {
      const res = await fetch(`/api/config/payment-methods/${editMethodData.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: editMethodData.name.trim(), type: editMethodData.type }),
      })
      if (!res.ok) { setMethodError('Error al actualizar.'); return }
      setMethods(prev => prev.map(m => m.id === editMethodData.id ? { ...m, ...editMethodData } : m))
      setEditMethodData(null)
      toast('Método actualizado.', 'success')
    } catch {
      setMethodError('Error de conexión.')
    } finally {
      setMethodSaving(false)
    }
  }

  const handleDeleteMethod = async (method: PaymentMethodRecord) => {
    try {
      const res = await fetch(`/api/config/payment-methods/${method.id}`, { method: 'DELETE' })
      if (!res.ok) { toast('Error al eliminar el método.', 'error'); return }
      setMethods(prev => prev.filter(m => m.id !== method.id))
      toast('Método eliminado.', 'success')
    } catch {
      toast('Error de conexión.', 'error')
    }
  }

  /* ─────────────────────────────────────────────
     SECTION 2 HANDLERS
  ───────────────────────────────────────────── */

  const openAddDevice = () => {
    setEditDeviceData(null)
    setDeviceForm(EMPTY_DEVICE_FORM)
    setDeviceError('')
    setDeviceModalOpen(true)
  }

  const openEditDevice = (device: DeviceRecord) => {
    setEditDeviceData(device)
    setDeviceForm({
      tipo:         device.tipo,
      banco:        device.banco,
      serial:       device.serial       ?? '',
      nro_comercio: device.nro_comercio ?? '',
      is_active:    device.is_active,
    })
    setDeviceError('')
    setDeviceModalOpen(true)
  }

  const handleSaveDevice = async () => {
    if (!deviceForm.banco) { setDeviceError('Selecciona un banco.'); return }
    setDeviceSaving(true); setDeviceError('')
    const payload = {
      tipo:         deviceForm.tipo,
      banco:        deviceForm.banco,
      serial:       deviceForm.serial       || null,
      nro_comercio: deviceForm.nro_comercio || null,
      is_active:    deviceForm.is_active,
    }
    try {
      if (editDeviceData) {
        const res = await fetch(`/api/config/devices/${editDeviceData.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        })
        if (!res.ok) { setDeviceError('Error al actualizar.'); return }
        setDevices(prev => prev.map(d => d.id === editDeviceData.id ? { ...d, ...payload } : d))
        toast('Dispositivo actualizado.', 'success')
      } else {
        const res = await fetch('/api/config/devices', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        })
        const body = await res.json() as { error?: string; device?: DeviceRecord }
        if (!res.ok) { setDeviceError(body.error ?? 'Error al crear.'); return }
        setDevices(prev => [...prev, body.device!])
        toast('Dispositivo registrado.', 'success')
      }
      setDeviceModalOpen(false)
    } catch {
      setDeviceError('Error de conexión.')
    } finally {
      setDeviceSaving(false)
    }
  }

  const handleToggleDevice = async (device: DeviceRecord) => {
    const next = !device.is_active
    setDevices(prev => prev.map(d => d.id === device.id ? { ...d, is_active: next } : d))
    try {
      const res = await fetch(`/api/config/devices/${device.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ is_active: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setDevices(prev => prev.map(d => d.id === device.id ? { ...d, is_active: device.is_active } : d))
      toast('Error al actualizar el dispositivo.', 'error')
    }
  }

  const handleDeleteDevice = async (device: DeviceRecord) => {
    try {
      const res = await fetch(`/api/config/devices/${device.id}`, { method: 'DELETE' })
      if (!res.ok) { toast('Error al eliminar.', 'error'); return }
      setDevices(prev => prev.filter(d => d.id !== device.id))
      toast('Dispositivo eliminado.', 'success')
    } catch {
      toast('Error de conexión.', 'error')
    }
  }

  /* ─────────────────────────────────────────────
     SECTION 3 HANDLERS
  ───────────────────────────────────────────── */

  const patchCobros = <K extends keyof CobrosFormData>(
    section: K,
    field: keyof CobrosFormData[K],
    value: string | boolean
  ) => {
    setCobrosData(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }))
  }

  const handleSaveCobros = async () => {
    setSavingCobros(true)
    try {
      const res = await fetch('/api/config/cobros/data', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(cobrosData),
      })
      if (!res.ok) { toast('Error al guardar los datos de cobro.', 'error'); return }
      toast('Datos de cobro guardados.', 'success')
    } catch {
      toast('Error de conexión.', 'error')
    } finally {
      setSavingCobros(false)
    }
  }

  /* ─────────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────────── */

  const bancoName = (code: string) =>
    BANCOS_VE.find(b => b.code === code)?.name ?? code

  const waPreview = buildWaPreview(cobrosData)

  /* ─────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────── */

  return (
    <div className={styles.cobrosSection}>
      {/* ── Page header ── */}
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Cobros</h2>
        <p className={styles.pageSubtitle}>
          Configura los medios de pago, dispositivos y datos de cobro de tu negocio
        </p>
      </div>

      {/* ════════════════════════════════════════
          SECCIÓN 1 — MEDIOS DE PAGO
      ════════════════════════════════════════ */}
      <div className={styles.formCard}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>Medios de Pago</h3>
            <p className={styles.sectionSubtitle}>Actívalos y ordénalos arrastrando</p>
          </div>
        </div>

        {loadingMethods ? (
          <div className={styles.loadingState}>
            <Loader2 size={20} className={styles.spinner} aria-hidden="true" />
            <span>Cargando...</span>
          </div>
        ) : (
          <div className={styles.methodsList}>
            {methods.map(method => {
              const config = TYPE_CONFIG[method.type] ?? TYPE_CONFIG.other
              const Icon   = config.Icon
              return (
                <div
                  key={method.id}
                  className={[
                    styles.methodItem,
                    draggingId === method.id ? styles.methodDragging : '',
                    dragOverId === method.id ? styles.methodDragOver  : '',
                  ].filter(Boolean).join(' ')}
                  draggable
                  onDragStart={e => handleDragStart(e, method.id)}
                  onDragOver={e  => handleDragOver(e, method.id)}
                  onDrop={e      => handleDrop(e, method.id)}
                  onDragEnd={() => { setDraggingId(null); setDragOverId(null) }}
                >
                  <div className={styles.methodDragHandle} aria-hidden="true">
                    <GripVertical size={16} />
                  </div>
                  <div className={styles.methodIconWrap}>
                    <Icon size={16} aria-hidden="true" />
                  </div>
                  <div className={styles.methodInfo}>
                    <p className={styles.methodName}>{method.name}</p>
                    <span className={`${styles.methodBadge} ${config.badgeClass}`}>
                      {config.label}
                    </span>
                  </div>
                  <div className={styles.methodActions}>
                    <button
                      type="button"
                      className={`${styles.toggleBtn} ${method.is_active ? styles.toggleBtnOn : ''}`}
                      onClick={() => void handleToggle(method)}
                      aria-pressed={method.is_active}
                      aria-label={`${method.is_active ? 'Desactivar' : 'Activar'} ${method.name}`}
                    >
                      <span className={`${styles.toggleKnob} ${method.is_active ? styles.toggleKnobOn : ''}`} />
                    </button>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => { setEditMethodData(method); setMethodError('') }}
                      aria-label={`Editar ${method.name}`}
                    >
                      <Pencil size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                      onClick={() => void handleDeleteMethod(method)}
                      aria-label={`Eliminar ${method.name}`}
                    >
                      <X size={14} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )
            })}

            {methods.length === 0 && (
              <p className={styles.emptyHint}>
                No hay métodos configurados. Agrega uno abajo.
              </p>
            )}
          </div>
        )}

        <div className={styles.addRow}>
          <Button variant="secondary" leftIcon={<Plus size={15} />} onClick={() => { setAddMethodOpen(true); setMethodError('') }}>
            Nuevo medio
          </Button>
        </div>
      </div>

      {/* ════════════════════════════════════════
          SECCIÓN 2 — DISPOSITIVOS FÍSICOS
      ════════════════════════════════════════ */}
      <div className={styles.formCard}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>Dispositivos Físicos</h3>
            <p className={styles.sectionSubtitle}>Terminales bancarios registrados</p>
          </div>
        </div>

        {loadingDevices ? (
          <div className={styles.loadingState}>
            <Loader2 size={20} className={styles.spinner} aria-hidden="true" />
            <span>Cargando...</span>
          </div>
        ) : (
          <div className={styles.methodsList}>
            {devices.map(device => (
              <div key={device.id} className={styles.methodItem}>
                <div className={styles.deviceIcon}>
                  <Terminal size={16} aria-hidden="true" />
                </div>
                <div className={styles.methodInfo}>
                  <p className={styles.methodName}>{bancoName(device.banco)}</p>
                  <span className={`${styles.methodBadge} ${styles.badgeDevice}`}>
                    {DEVICE_TYPE_LABELS[device.tipo] ?? device.tipo}
                  </span>
                </div>
                <div className={styles.methodActions}>
                  <button
                    type="button"
                    className={`${styles.toggleBtn} ${device.is_active ? styles.toggleBtnOn : ''}`}
                    onClick={() => void handleToggleDevice(device)}
                    aria-pressed={device.is_active}
                    aria-label={`${device.is_active ? 'Desactivar' : 'Activar'} dispositivo`}
                  >
                    <span className={`${styles.toggleKnob} ${device.is_active ? styles.toggleKnobOn : ''}`} />
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => openEditDevice(device)}
                    aria-label="Editar dispositivo"
                  >
                    <Pencil size={14} strokeWidth={2} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                    onClick={() => void handleDeleteDevice(device)}
                    aria-label="Eliminar dispositivo"
                  >
                    <X size={14} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}

            {devices.length === 0 && (
              <p className={styles.emptyHint}>
                No hay dispositivos registrados.
              </p>
            )}
          </div>
        )}

        <div className={styles.addRow}>
          <Button variant="secondary" leftIcon={<Plus size={15} />} onClick={openAddDevice}>
            Nuevo dispositivo
          </Button>
        </div>
      </div>

      {/* ════════════════════════════════════════
          SECCIÓN 3 — DATOS PARA COBRAR
      ════════════════════════════════════════ */}
      <div className={styles.sectionHeader}>
        <div>
          <h3 className={styles.sectionTitle}>Datos para Cobrar</h3>
          <p className={styles.sectionSubtitle}>
            Estos datos se usan para armar el mensaje que se envía desde Pedidos por WhatsApp.
          </p>
        </div>
      </div>

      {loadingCobros ? (
        <div className={styles.loadingState}>
          <Loader2 size={20} className={styles.spinner} aria-hidden="true" />
          <span>Cargando...</span>
        </div>
      ) : (
        <>
          <div className={styles.cobrosGrid}>

            {/* PAGO MÓVIL */}
            <div className={styles.cobrosCard}>
              <div className={styles.cobrosCardHeader}>
                <div className={styles.cobrosCardIcon}>
                  <Smartphone size={14} aria-hidden="true" />
                </div>
                <h4 className={styles.cobrosCardTitle}>Pago Móvil</h4>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="pm-banco">Banco</label>
                <BancoSelect
                  id="pm-banco"
                  value={cobrosData.pago_movil.banco}
                  onChange={v => patchCobros('pago_movil', 'banco', v)}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="pm-tel">Teléfono</label>
                <input
                  id="pm-tel"
                  type="tel"
                  inputMode="tel"
                  className={styles.input}
                  placeholder="0414-1234567"
                  value={cobrosData.pago_movil.telefono}
                  onChange={e => patchCobros('pago_movil', 'telefono', e.target.value)}
                  maxLength={16}
                />
              </div>
              <div className={styles.toggleRow}>
                <span className={styles.toggleRowLabel}>WhatsApp del negocio</span>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${cobrosData.pago_movil.usa_whatsapp_negocio ? styles.toggleBtnOn : ''}`}
                  onClick={() => patchCobros('pago_movil', 'usa_whatsapp_negocio', !cobrosData.pago_movil.usa_whatsapp_negocio)}
                  aria-pressed={cobrosData.pago_movil.usa_whatsapp_negocio}
                  aria-label="Usar WhatsApp principal del negocio"
                >
                  <span className={`${styles.toggleKnob} ${cobrosData.pago_movil.usa_whatsapp_negocio ? styles.toggleKnobOn : ''}`} />
                </button>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="pm-titular">Titular</label>
                <input
                  id="pm-titular"
                  type="text"
                  inputMode="text"
                  className={styles.input}
                  placeholder="Nombre del titular"
                  value={cobrosData.pago_movil.titular}
                  onChange={e => patchCobros('pago_movil', 'titular', e.target.value)}
                  maxLength={80}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="pm-doc">Documento</label>
                <div className={styles.docRow}>
                  <select
                    id="pm-tipo-doc"
                    className={styles.select}
                    value={cobrosData.pago_movil.tipo_doc}
                    onChange={e => patchCobros('pago_movil', 'tipo_doc', e.target.value)}
                    aria-label="Tipo de documento"
                  >
                    <option value="V">V</option>
                    <option value="E">E</option>
                    <option value="J">J</option>
                    <option value="G">G</option>
                    <option value="P">P</option>
                  </select>
                  <input
                    id="pm-doc"
                    type="text"
                    inputMode="numeric"
                    className={styles.input}
                    placeholder="12345678"
                    value={cobrosData.pago_movil.documento}
                    onChange={e => patchCobros('pago_movil', 'documento', e.target.value)}
                    maxLength={12}
                  />
                </div>
              </div>
            </div>

            {/* ZELLE */}
            <div className={styles.cobrosCard}>
              <div className={styles.cobrosCardHeader}>
                <div className={styles.cobrosCardIcon}>
                  <Smartphone size={14} aria-hidden="true" />
                </div>
                <h4 className={styles.cobrosCardTitle}>Zelle</h4>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="zelle-contacto">Correo o teléfono USA</label>
                <input
                  id="zelle-contacto"
                  type="text"
                  inputMode="email"
                  className={styles.input}
                  placeholder="correo@gmail.com"
                  value={cobrosData.zelle.contacto}
                  onChange={e => patchCobros('zelle', 'contacto', e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="zelle-titular">Titular / Referencia</label>
                <input
                  id="zelle-titular"
                  type="text"
                  inputMode="text"
                  className={styles.input}
                  placeholder="Nombre del titular"
                  value={cobrosData.zelle.titular}
                  onChange={e => patchCobros('zelle', 'titular', e.target.value)}
                  maxLength={80}
                />
              </div>
            </div>

            {/* ZINLI */}
            <div className={styles.cobrosCard}>
              <div className={styles.cobrosCardHeader}>
                <div className={styles.cobrosCardIcon}>
                  <Smartphone size={14} aria-hidden="true" />
                </div>
                <h4 className={styles.cobrosCardTitle}>Zinli</h4>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="zinli-contacto">Correo Zinli</label>
                <input
                  id="zinli-contacto"
                  type="email"
                  inputMode="email"
                  className={styles.input}
                  placeholder="correo@zinli.com"
                  value={cobrosData.zinli.contacto}
                  onChange={e => patchCobros('zinli', 'contacto', e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="zinli-titular">Titular / Referencia</label>
                <input
                  id="zinli-titular"
                  type="text"
                  inputMode="text"
                  className={styles.input}
                  placeholder="Nombre del titular"
                  value={cobrosData.zinli.titular}
                  onChange={e => patchCobros('zinli', 'titular', e.target.value)}
                  maxLength={80}
                />
              </div>
            </div>

            {/* PAYPAL */}
            <div className={styles.cobrosCard}>
              <div className={styles.cobrosCardHeader}>
                <div className={styles.cobrosCardIcon}>
                  <CreditCard size={14} aria-hidden="true" />
                </div>
                <h4 className={styles.cobrosCardTitle}>PayPal</h4>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="paypal-contacto">Correo PayPal</label>
                <input
                  id="paypal-contacto"
                  type="email"
                  inputMode="email"
                  className={styles.input}
                  placeholder="correo@paypal.com"
                  value={cobrosData.paypal.contacto}
                  onChange={e => patchCobros('paypal', 'contacto', e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="paypal-titular">Titular / Referencia</label>
                <input
                  id="paypal-titular"
                  type="text"
                  inputMode="text"
                  className={styles.input}
                  placeholder="Nombre del titular"
                  value={cobrosData.paypal.titular}
                  onChange={e => patchCobros('paypal', 'titular', e.target.value)}
                  maxLength={80}
                />
              </div>
            </div>

            {/* BINANCE PAY */}
            <div className={styles.cobrosCard}>
              <div className={styles.cobrosCardHeader}>
                <div className={styles.cobrosCardIcon}>
                  <Coins size={14} aria-hidden="true" />
                </div>
                <h4 className={styles.cobrosCardTitle}>Binance Pay</h4>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="binance-contacto">Binance ID o correo</label>
                <input
                  id="binance-contacto"
                  type="text"
                  inputMode="text"
                  className={styles.input}
                  placeholder="ID o correo"
                  value={cobrosData.binance.contacto}
                  onChange={e => patchCobros('binance', 'contacto', e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="binance-titular">Titular / Referencia</label>
                <input
                  id="binance-titular"
                  type="text"
                  inputMode="text"
                  className={styles.input}
                  placeholder="Nombre del titular"
                  value={cobrosData.binance.titular}
                  onChange={e => patchCobros('binance', 'titular', e.target.value)}
                  maxLength={80}
                />
              </div>
            </div>

            {/* USDT */}
            <div className={styles.cobrosCard}>
              <div className={styles.cobrosCardHeader}>
                <div className={styles.cobrosCardIcon}>
                  <Coins size={14} aria-hidden="true" />
                </div>
                <h4 className={styles.cobrosCardTitle}>USDT</h4>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="usdt-wallet">Dirección wallet</label>
                <input
                  id="usdt-wallet"
                  type="text"
                  inputMode="text"
                  className={styles.input}
                  placeholder="T... / 0x..."
                  value={cobrosData.usdt.wallet}
                  onChange={e => patchCobros('usdt', 'wallet', e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="usdt-red">Red</label>
                <select
                  id="usdt-red"
                  className={styles.select}
                  value={cobrosData.usdt.red}
                  onChange={e => patchCobros('usdt', 'red', e.target.value)}
                >
                  <option value="TRC20">TRC20 (Tron)</option>
                  <option value="ERC20">ERC20 (Ethereum)</option>
                  <option value="BEP20">BEP20 (BSC)</option>
                </select>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="usdt-titular">Titular / Referencia</label>
                <input
                  id="usdt-titular"
                  type="text"
                  inputMode="text"
                  className={styles.input}
                  placeholder="Nombre del titular"
                  value={cobrosData.usdt.titular}
                  onChange={e => patchCobros('usdt', 'titular', e.target.value)}
                  maxLength={80}
                />
              </div>
            </div>

          </div>

          {/* Save button */}
          <div className={styles.saveRow}>
            <Button
              variant="primary"
              leftIcon={savingCobros ? <Loader2 size={15} className={styles.spinner} /> : <Save size={15} />}
              onClick={() => void handleSaveCobros()}
              loading={savingCobros}
            >
              Guardar Datos de Cobro
            </Button>
          </div>

          {/* WhatsApp Preview */}
          {waPreview && (
            <div className={styles.waPreviewSection}>
              <div className={styles.waPreviewHeader}>
                <MessageSquare size={16} aria-hidden="true" />
                <span className={styles.waPreviewHeaderText}>Preview del mensaje WhatsApp</span>
              </div>
              <div className={styles.waPreviewPhone}>
                <div className={styles.waPreviewBubble}>
                  <p className={styles.waPreviewText}>{waPreview}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════
          MODAL — Agregar / Editar Método de Pago
      ════════════════════════════════════════ */}
      <Modal
        open={addMethodOpen}
        onClose={() => { setAddMethodOpen(false); setNewMethod({ name: '', type: 'cash' }); setMethodError('') }}
        title="Nuevo Medio de Pago"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setAddMethodOpen(false); setMethodError('') }} disabled={methodSaving}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => void handleAddMethod()} loading={methodSaving}>
              Agregar
            </Button>
          </>
        }
      >
        <div className={styles.modalForm}>
          <Input
            label="Nombre"
            placeholder="Ej: Pago Móvil BDV"
            value={newMethod.name}
            onChange={e => setNewMethod(p => ({ ...p, name: e.target.value }))}
            maxLength={60}
          />
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="new-method-type">Tipo</label>
            <select
              id="new-method-type"
              className={styles.select}
              value={newMethod.type}
              onChange={e => setNewMethod(p => ({ ...p, type: e.target.value }))}
            >
              <option value="cash">Efectivo</option>
              <option value="movil">Pago Móvil</option>
              <option value="biopago">BioPago</option>
              <option value="transfer">Transferencia</option>
              <option value="zelle">Zelle</option>
              <option value="binance">Binance</option>
              <option value="card">Tarjeta</option>
              <option value="other">Otro</option>
            </select>
          </div>
          {methodError && <p className={styles.errorMsg} role="alert">{methodError}</p>}
        </div>
      </Modal>

      {/* MODAL — Editar Método */}
      <Modal
        open={editMethodData !== null}
        onClose={() => { setEditMethodData(null); setMethodError('') }}
        title="Editar Medio de Pago"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setEditMethodData(null); setMethodError('') }} disabled={methodSaving}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => void handleUpdateMethod()} loading={methodSaving}>
              Guardar
            </Button>
          </>
        }
      >
        {editMethodData && (
          <div className={styles.modalForm}>
            <Input
              label="Nombre"
              value={editMethodData.name}
              onChange={e => setEditMethodData(p => p ? { ...p, name: e.target.value } : p)}
              maxLength={60}
            />
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="edit-method-type">Tipo</label>
              <select
                id="edit-method-type"
                className={styles.select}
                value={editMethodData.type}
                onChange={e => setEditMethodData(p => p ? { ...p, type: e.target.value } : p)}
              >
                <option value="cash">Efectivo</option>
                <option value="movil">Pago Móvil</option>
                <option value="biopago">BioPago</option>
                <option value="transfer">Transferencia</option>
                <option value="zelle">Zelle</option>
                <option value="binance">Binance</option>
                <option value="card">Tarjeta</option>
                <option value="other">Otro</option>
              </select>
            </div>
            {methodError && <p className={styles.errorMsg} role="alert">{methodError}</p>}
          </div>
        )}
      </Modal>

      {/* ════════════════════════════════════════
          MODAL — Agregar / Editar Dispositivo
      ════════════════════════════════════════ */}
      <Modal
        open={deviceModalOpen}
        onClose={() => { setDeviceModalOpen(false); setDeviceError('') }}
        title={editDeviceData ? 'Editar Dispositivo' : 'Nuevo Dispositivo'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setDeviceModalOpen(false); setDeviceError('') }} disabled={deviceSaving}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => void handleSaveDevice()} loading={deviceSaving}>
              {editDeviceData ? 'Guardar' : 'Registrar'}
            </Button>
          </>
        }
      >
        <div className={styles.modalForm}>
          {/* Tipo — pills */}
          <div className={styles.fieldGroup}>
            <span className={styles.label}>Tipo</span>
            <div className={styles.pillGroup}>
              {(['debit', 'credit', 'biopago'] as const).map(tipo => (
                <button
                  key={tipo}
                  type="button"
                  className={`${styles.pill} ${deviceForm.tipo === tipo ? styles.pillActive : ''}`}
                  onClick={() => setDeviceForm(p => ({ ...p, tipo }))}
                  aria-pressed={deviceForm.tipo === tipo}
                >
                  {DEVICE_TYPE_LABELS[tipo]}
                </button>
              ))}
            </div>
          </div>

          {/* Banco */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="device-banco">Banco</label>
            <BancoSelect
              id="device-banco"
              value={deviceForm.banco}
              onChange={v => setDeviceForm(p => ({ ...p, banco: v }))}
            />
          </div>

          {/* Serial */}
          <Input
            label="Serial (opcional)"
            type="text"
            inputMode="numeric"
            placeholder="Ej: 123456789"
            value={deviceForm.serial}
            onChange={e => setDeviceForm(p => ({ ...p, serial: e.target.value }))}
            maxLength={30}
          />

          {/* Nro. comercio */}
          <Input
            label="Nro. comercio (opcional)"
            type="text"
            inputMode="numeric"
            placeholder="Ej: 987654321"
            value={deviceForm.nro_comercio}
            onChange={e => setDeviceForm(p => ({ ...p, nro_comercio: e.target.value }))}
            maxLength={30}
          />

          {/* Toggle activo */}
          <div className={styles.toggleRow}>
            <span className={styles.toggleRowLabel}>Dispositivo activo</span>
            <button
              type="button"
              className={`${styles.toggleBtn} ${deviceForm.is_active ? styles.toggleBtnOn : ''}`}
              onClick={() => setDeviceForm(p => ({ ...p, is_active: !p.is_active }))}
              aria-pressed={deviceForm.is_active}
              aria-label="Dispositivo activo"
            >
              <span className={`${styles.toggleKnob} ${deviceForm.is_active ? styles.toggleKnobOn : ''}`} />
            </button>
          </div>

          {deviceError && <p className={styles.errorMsg} role="alert">{deviceError}</p>}
        </div>
      </Modal>
    </div>
  )
}
