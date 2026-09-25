'use client'

import { useState, useEffect, useCallback } from 'react'
import { Printer, Eye, Building2, PlugZap } from 'lucide-react'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { connectQz, listPrinters, QZ_DOWNLOAD_URL } from '@/lib/qz-tray'
import type { QzStatus } from '@/lib/qz-tray'
import { printTestTicketThermal } from '@/lib/thermal-print'
import { DEFAULT_THERMAL_SETTINGS, loadThermalSettings, saveThermalSettings } from '@/lib/thermal-settings'
import type { TicketConfig } from '@/types'
import type { ThermalPaper, ThermalSettings } from '@/types/thermal'
import styles from '../configuracion.module.css'

interface Props { businessId: number }

/* Las 10 filas de toggle son idénticas salvo texto y campo. Extraerlo evita
   repetir el mismo bloque de markup diez veces y mantiene el aria-pressed
   consistente en todas. */
type ToggleField = {
  [K in keyof TicketConfig]: TicketConfig[K] extends boolean ? K : never
}[keyof TicketConfig]

interface ToggleRowProps {
  label:      string
  hint:       string
  checked:    boolean
  onToggle:   () => void
  // Por defecto el aria-label es "Mostrar/Ocultar <label>" (filas de visibilidad).
  // Un interruptor que activa una función necesita otro verbo.
  ariaLabel?: string
}

function ToggleRow({ label, hint, checked, onToggle, ariaLabel }: ToggleRowProps) {
  return (
    <div className={styles.toggleRow}>
      <div>
        <p className={styles.toggleLabel}>{label}</p>
        <p className={styles.toggleHint}>{hint}</p>
      </div>
      <button
        type="button"
        className={`${styles.toggleBtn} ${checked ? styles.toggleBtnOn : ''}`}
        onClick={onToggle}
        aria-pressed={checked}
        aria-label={ariaLabel ?? `${checked ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`}
      >
        <span className={`${styles.toggleKnob} ${checked ? styles.toggleKnobOn : ''}`} />
      </button>
    </div>
  )
}

const DEFAULTS: TicketConfig = {
  ticket_prefix:       'ACT',
  ticket_footer:       '',
  ticket_format:       '58mm',
  show_description:    false,
  show_bs:             true,
  show_foreign:        true,
  foreign_format:      'usd',
  show_address:        true,
  show_phone:          true,
  show_customer_data:  false,
  show_rif:            false,
  show_cashier_name:   true,
  show_bcv_rate:       true,
  show_payment_method: true,
}

export function TabImpresion({ businessId: _businessId }: Props) {
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [config, setConfig]   = useState<TicketConfig>(DEFAULTS)

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/config/ticket')
      if (!res.ok) throw new Error()
      const body = await res.json() as { ok: boolean; ticket: TicketConfig }
      setConfig({ ...DEFAULTS, ...body.ticket, ticket_footer: body.ticket.ticket_footer ?? '' })
    } catch {
      toast('Error al cargar la configuración de impresión.', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { void fetchConfig() }, [fetchConfig])

  /* ── Impresión térmica (QZ Tray) ── config POR EQUIPO en localStorage: la
     impresora está conectada a esta máquina, no al negocio. Se guarda al
     instante (no depende del botón "Guardar cambios" de más abajo). */
  const [thermal, setThermal]       = useState<ThermalSettings>(DEFAULT_THERMAL_SETTINGS)
  const [qzStatus, setQzStatus]     = useState<QzStatus | null>(null)
  const [printers, setPrinters]     = useState<string[]>([])
  const [scanning, setScanning]     = useState(false)
  const [testing, setTesting]       = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [businessName, setBusinessName] = useState('')

  useEffect(() => {
    setThermal(loadThermalSettings())
    fetch('/api/config/business')
      .then(r => r.json())
      .then((j: { business?: { name?: string } }) => { if (j.business?.name) setBusinessName(j.business.name) })
      .catch(() => {})
  }, [])

  const updateThermal = (patch: Partial<ThermalSettings>) => {
    const next = { ...thermal, ...patch }
    setThermal(next)
    if (!saveThermalSettings(next)) {
      toast('El navegador bloquea el almacenamiento: la configuración de impresión no se pudo guardar en este equipo.', 'error')
    }
  }

  const scanPrinters = async () => {
    setScanning(true)
    setTestResult(null)
    const status = await connectQz()
    setQzStatus(status)
    if (status.state === 'connected') {
      const found = await listPrinters()
      if (found.ok) {
        setPrinters(found.value)
        if (found.value.length === 0) toast('QZ Tray no encontró impresoras instaladas en Windows.', 'warning')
      } else {
        toast(found.message, 'error')
      }
    }
    setScanning(false)
  }

  const handleToggleThermal = () => {
    const enabled = !thermal.enabled
    updateThermal({ enabled })
    if (enabled && !qzStatus) void scanPrinters()
  }

  const handleTestPrint = async () => {
    setTesting(true)
    setTestResult(null)
    const result = await printTestTicketThermal(thermal, businessName)
    setTestResult(
      result.state === 'printed'
        ? { ok: true, text: `Enviado a «${result.printer}». Revisa la impresora: ¿salió el papel?` }
        : { ok: false, text: result.state === 'error' ? result.message : 'No se envió nada a la impresora.' },
    )
    setTesting(false)
  }

  // Una impresora guardada que QZ no lista ahora (apagada, otro equipo) se
  // conserva visible en el selector en vez de desaparecer en silencio.
  const printerOptions = thermal.printer && !printers.includes(thermal.printer)
    ? [thermal.printer, ...printers]
    : printers

  const toggle = (field: ToggleField) =>
    setConfig(p => ({ ...p, [field]: !p[field] }))

  const handleSave = async () => {
    if (!config.ticket_prefix.trim()) {
      toast('El prefijo del ticket no puede estar vacío.', 'error')
      return
    }
    // Mismo criterio que valida el endpoint: un ticket sin ningún monto no
    // sirve. Se corta acá para no gastar el viaje y dar el mensaje al toque.
    if (!config.show_bs && !config.show_foreign) {
      toast('El ticket debe mostrar al menos un monto: Bolívares o divisas.', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/config/ticket', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ...config,
          ticket_prefix: config.ticket_prefix.trim().toUpperCase(),
          ticket_footer: config.ticket_footer?.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error)
      }
      toast('Configuración de impresión guardada.', 'success')
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : 'Error al guardar.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <Printer size={24} className={styles.spinner} aria-hidden="true" />
        <span>Cargando...</span>
      </div>
    )
  }

  return (
    <div className={styles.configSection}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Impresión</h2>
        <p className={styles.pageSubtitle}>Qué se imprime en el ticket de venta y con qué formato</p>
      </div>

      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>
          <Printer size={16} aria-hidden="true" />
          Formato del Ticket
        </h3>

        <Input
          label="Prefijo del ticket"
          value={config.ticket_prefix}
          onChange={(e) => setConfig(p => ({ ...p, ticket_prefix: e.target.value.toUpperCase() }))}
          placeholder="ACT"
          hint="Ej: ACT genera tickets como ACT-0001"
          maxLength={10}
        />

        <div className={`${styles.fieldGroup} ${styles.mt4}`}>
          <label className={styles.label} htmlFor="ticket-format">
            Tamaño del papel
          </label>
          <select
            id="ticket-format"
            className={styles.select}
            value={config.ticket_format}
            onChange={(e) => setConfig(p => ({
              ...p,
              ticket_format: e.target.value as TicketConfig['ticket_format'],
            }))}
          >
            <option value="80mm">80 mm (térmico estándar)</option>
            <option value="58mm">58 mm (térmico pequeño)</option>
            <option value="carta">Carta / A4</option>
          </select>
        </div>

        <div className={styles.formDivider} />

        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="ticket-footer">
            Pie del ticket
          </label>
          <textarea
            id="ticket-footer"
            className={styles.textarea}
            value={config.ticket_footer ?? ''}
            onChange={(e) => setConfig(p => ({ ...p, ticket_footer: e.target.value }))}
            placeholder="Gracias por su compra. ¡Vuelva pronto!"
            maxLength={500}
            rows={3}
          />
        </div>
      </div>

      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>
          <Eye size={16} aria-hidden="true" />
          Columnas Visibles
        </h3>

        <ToggleRow
          label="Descripción del producto"
          hint="Imprime la descripción debajo del nombre de cada ítem"
          checked={config.show_description}
          onToggle={() => toggle('show_description')}
        />
        <ToggleRow
          label="Monto en Bolívares"
          hint="Imprime el total en Bs"
          checked={config.show_bs}
          onToggle={() => toggle('show_bs')}
        />
        <ToggleRow
          label="Monto en divisas"
          hint="Imprime el subtotal y total en divisas"
          checked={config.show_foreign}
          onToggle={() => toggle('show_foreign')}
        />

        {config.show_foreign && (
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="foreign-format">
              Cómo se muestran las divisas
            </label>
            <select
              id="foreign-format"
              className={styles.select}
              value={config.foreign_format}
              onChange={(e) => setConfig(p => ({
                ...p,
                foreign_format: e.target.value as TicketConfig['foreign_format'],
              }))}
            >
              <option value="usd">$ — símbolo de dólar</option>
              <option value="ref">REF — referencia</option>
            </select>
          </div>
        )}
      </div>

      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>
          <Building2 size={16} aria-hidden="true" />
          Datos del negocio en ticket
        </h3>

        <ToggleRow
          label="Dirección"
          hint="Dirección del negocio bajo el nombre"
          checked={config.show_address}
          onToggle={() => toggle('show_address')}
        />
        <ToggleRow
          label="Teléfono"
          hint="Teléfono de contacto del negocio"
          checked={config.show_phone}
          onToggle={() => toggle('show_phone')}
        />
        <ToggleRow
          label="Datos del cliente"
          hint="Nombre y teléfono del cliente, si se ingresaron en la venta"
          checked={config.show_customer_data}
          onToggle={() => toggle('show_customer_data')}
        />
        <ToggleRow
          label="RIF"
          hint="RIF del negocio"
          checked={config.show_rif}
          onToggle={() => toggle('show_rif')}
        />
        <ToggleRow
          label="Nombre del cajero"
          hint="Quién atendió la venta"
          checked={config.show_cashier_name}
          onToggle={() => toggle('show_cashier_name')}
        />
        <ToggleRow
          label="Tasa BCV"
          hint="Tasa de cambio usada en la venta"
          checked={config.show_bcv_rate}
          onToggle={() => toggle('show_bcv_rate')}
        />
        <ToggleRow
          label="Método de pago"
          hint="Con qué se pagó y cuánto por método"
          checked={config.show_payment_method}
          onToggle={() => toggle('show_payment_method')}
        />

        <div className={styles.saveRow}>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            Guardar cambios
          </Button>
        </div>
      </div>

      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>
          <PlugZap size={16} aria-hidden="true" />
          Impresión térmica (QZ Tray)
        </h3>
        <p className={styles.toggleHint}>
          Se configura en cada equipo que tenga impresora y se guarda al instante, sin el botón de arriba.
        </p>

        <ToggleRow
          label="Impresión térmica automática (QZ Tray)"
          hint="Imprime el ticket al cobrar, sin el diálogo de Windows. Solo en este equipo."
          checked={thermal.enabled}
          onToggle={handleToggleThermal}
          ariaLabel={`${thermal.enabled ? 'Desactivar' : 'Activar'} la impresión térmica automática en este equipo`}
        />

        {qzStatus === null && (
          <p className={styles.toggleHint}>
            Pulsa «Buscar impresoras» para conectar con QZ Tray en este equipo.
          </p>
        )}
        {qzStatus?.state === 'connected' && (
          <p className={qzStatus.signed ? styles.statusOk : styles.statusWarn} role="status">
            QZ Tray conectado (versión {qzStatus.version}).{' '}
            {qzStatus.signed
              ? 'Firma digital activa: imprime sin avisos.'
              : 'Sin firma digital: QZ Tray pedirá confirmación al imprimir.'}
          </p>
        )}
        {qzStatus?.state === 'unavailable' && (
          <p className={styles.errorMsg} role="alert">
            {qzStatus.message}{' '}
            <a href={QZ_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className={styles.statusLink}>
              Descargar QZ Tray
            </a>
          </p>
        )}

        <div className={`${styles.fieldGroup} ${styles.mt4}`}>
          <label className={styles.label} htmlFor="thermal-printer">Impresora</label>
          <div className={styles.printerRow}>
            <select
              id="thermal-printer"
              className={styles.select}
              value={thermal.printer ?? ''}
              onChange={(e) => updateThermal({ printer: e.target.value || null })}
            >
              <option value="">
                {printerOptions.length > 0 ? 'Elige una impresora' : 'Pulsa «Buscar impresoras»'}
              </option>
              {printerOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <Button variant="secondary" onClick={scanPrinters} loading={scanning}>
              Buscar impresoras
            </Button>
          </div>
        </div>

        <div className={`${styles.fieldGroup} ${styles.mt4}`}>
          <label className={styles.label} htmlFor="thermal-paper">Ancho del papel</label>
          <select
            id="thermal-paper"
            className={styles.select}
            value={thermal.paper}
            onChange={(e) => updateThermal({ paper: e.target.value as ThermalPaper })}
          >
            <option value="58mm">58 mm (32 caracteres por línea)</option>
            <option value="80mm">80 mm (48 caracteres por línea)</option>
          </select>
        </div>

        <div className={styles.saveRow}>
          <Button variant="primary" onClick={handleTestPrint} loading={testing} disabled={!thermal.printer}>
            Imprimir ticket de prueba
          </Button>
        </div>

        {testResult && (
          <p className={testResult.ok ? styles.statusOk : styles.errorMsg} role="status">
            {testResult.text}
          </p>
        )}
      </div>
    </div>
  )
}
