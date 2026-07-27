'use client'

import { useState, useEffect, useCallback } from 'react'
import { Printer, Eye, Building2 } from 'lucide-react'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import type { TicketConfig } from '@/types'
import styles from '../configuracion.module.css'

interface Props { businessId: number }

/* Las 10 filas de toggle son idénticas salvo texto y campo. Extraerlo evita
   repetir el mismo bloque de markup diez veces y mantiene el aria-pressed
   consistente en todas. */
type ToggleField = {
  [K in keyof TicketConfig]: TicketConfig[K] extends boolean ? K : never
}[keyof TicketConfig]

interface ToggleRowProps {
  label:    string
  hint:     string
  checked:  boolean
  onToggle: () => void
}

function ToggleRow({ label, hint, checked, onToggle }: ToggleRowProps) {
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
        aria-label={`${checked ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`}
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
    </div>
  )
}
