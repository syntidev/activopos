'use client'

import { useState, useEffect, useCallback } from 'react'
import { Printer } from 'lucide-react'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import type { TicketConfig } from '@/types'
import styles from '../configuracion.module.css'

interface Props { businessId: number }

export function TabImpresion({ businessId: _businessId }: Props) {
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [config, setConfig]   = useState<TicketConfig>({
    ticket_prefix:   'ACT',
    ticket_footer:   '',
    ticket_format:   '80mm',
    ticket_currency: 'both',
    hide_rate:       false,
  })

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/config/ticket')
      if (!res.ok) throw new Error()
      const body = await res.json() as { ok: boolean; ticket: TicketConfig }
      setConfig({
        ticket_prefix:   body.ticket.ticket_prefix   ?? 'ACT',
        ticket_footer:   body.ticket.ticket_footer   ?? '',
        ticket_format:   body.ticket.ticket_format   ?? '80mm',
        ticket_currency: body.ticket.ticket_currency ?? 'both',
        hide_rate:       body.ticket.hide_rate       ?? false,
      })
    } catch {
      toast('Error al cargar la configuración de impresión.', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { void fetchConfig() }, [fetchConfig])

  const handleSave = async () => {
    if (!config.ticket_prefix.trim()) {
      toast('El prefijo del ticket no puede estar vacío.', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/config/ticket', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ticket_prefix:   config.ticket_prefix.trim().toUpperCase(),
          ticket_footer:   config.ticket_footer?.trim() || null,
          ticket_format:   config.ticket_format,
          ticket_currency: config.ticket_currency,
          hide_rate:       config.hide_rate,
        }),
      })
      if (!res.ok) throw new Error()
      toast('Configuración de impresión guardada.', 'success')
    } catch {
      toast('Error al guardar.', 'error')
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
        <p className={styles.pageSubtitle}>Formato, moneda y pie del ticket de venta</p>
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

        <div className={`${styles.fieldRow} ${styles.mt4}`}>
          <div className={styles.fieldGroup}>
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

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="ticket-currency">
              Moneda a mostrar
            </label>
            <select
              id="ticket-currency"
              className={styles.select}
              value={config.ticket_currency}
              onChange={(e) => setConfig(p => ({
                ...p,
                ticket_currency: e.target.value as TicketConfig['ticket_currency'],
              }))}
            >
              <option value="both">Bs y USD</option>
              <option value="bs">Solo Bs</option>
              <option value="usd">Solo USD</option>
            </select>
          </div>
        </div>

        <div className={styles.formDivider} />

        <div className={styles.toggleRow}>
          <div>
            <p className={styles.toggleLabel}>Ocultar tasa de cambio</p>
            <p className={styles.toggleHint}>No imprime la tasa BCV usada en la venta</p>
          </div>
          <button
            type="button"
            className={`${styles.toggleBtn} ${config.hide_rate ? styles.toggleBtnOn : ''}`}
            onClick={() => setConfig(p => ({ ...p, hide_rate: !p.hide_rate }))}
            aria-pressed={config.hide_rate}
            aria-label={config.hide_rate ? 'Mostrar tasa' : 'Ocultar tasa'}
          >
            <span className={`${styles.toggleKnob} ${config.hide_rate ? styles.toggleKnobOn : ''}`} />
          </button>
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

        <div className={styles.saveRow}>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            Guardar cambios
          </Button>
        </div>
      </div>
    </div>
  )
}
