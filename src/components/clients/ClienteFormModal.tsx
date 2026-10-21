'use client'

import { useState, useEffect } from 'react'
import { checkCedula, normalizeCedula } from '@/lib/cedula'
import { Modal }  from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input }  from '@/components/ui/Input'
import type { ClientRecord } from '@/types'
import styles from './ClienteFormModal.module.css'

interface ClienteFormModalProps {
  open:       boolean
  client:     ClientRecord | null
  /** Solo admin ve y cambia "verificado" (el PATCH responde 403 al cajero). */
  isAdmin:    boolean
  onClose:    () => void
  onCreated:  (c: ClientRecord) => void
  onUpdated:  (c: ClientRecord) => void
}

interface FormState {
  name:       string
  cedula:     string
  phone:      string
  email:      string
  notes:      string
  price_tier: 'detal' | 'mayorista'
  address:    string
  verified:   boolean
}

const EMPTY: FormState = { name: '', cedula: '', phone: '', email: '', notes: '', price_tier: 'detal', address: '', verified: false }

interface FieldErrors {
  name?:    string
  email?:   string
  cedula?:  string
  address?: string
}

interface ClientApiResponse {
  error?:  string
  field?:  string
  client?: ClientRecord
}

export function ClienteFormModal({
  open,
  client,
  isAdmin,
  onClose,
  onCreated,
  onUpdated,
}: ClienteFormModalProps) {
  const [form, setForm]       = useState<FormState>(EMPTY)
  const [errors, setErrors]   = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')

  const isEdit = !!client

  /* ── Sync form when editing ── */
  useEffect(() => {
    if (client) {
      setForm({
        name:       client.name,
        cedula:     client.cedula ?? '',
        phone:      client.phone  ?? '',
        email:      client.email  ?? '',
        notes:      client.notes  ?? '',
        price_tier: client.price_tier ?? 'detal',
        address:    client.address  ?? '',
        verified:   client.verified ?? false,
      })
    } else {
      setForm(EMPTY)
    }
    setErrors({})
    setServerError('')
  }, [client, open])

  const set = (field: 'name' | 'cedula' | 'phone' | 'email' | 'notes' | 'address') => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const addressChanged = form.address.trim() !== (client?.address ?? '').trim()
  const verifiedChanged = form.verified !== (client?.verified ?? false)

  const cedulaChanged = form.cedula.trim() !== (client?.cedula ?? '').trim()

  const validate = (): boolean => {
    const next: FieldErrors = {}
    if (form.name.trim().length < 2) next.name = 'El nombre debe tener al menos 2 caracteres.'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = 'Correo electrónico no válido.'
    }
    // Misma regla y mismo mensaje que el checkout (src/lib/cedula.ts); opcional.
    // Solo se exige formato si la cédula cambió: clientes antiguos con texto libre siguen editables.
    const cedulaCheck = checkCedula(form.cedula, null)
    if (cedulaChanged && !cedulaCheck.ok) next.cedula = cedulaCheck.message
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    setServerError('')

    const payload = {
      name:   form.name.trim(),
      // Sin cambio: se reenvía tal cual (el servidor no la revalida). Cambiada: normalizada; vaciada en edición: null.
      cedula: !cedulaChanged
        ? (client?.cedula ?? undefined)
        : (normalizeCedula(form.cedula) ?? (isEdit ? null : undefined)),
      phone:  form.phone.trim()   || undefined,
      email:  form.email.trim()   || undefined,
      notes:  form.notes.trim()   || undefined,
      // POST /api/clients (crear) no acepta price_tier todavía — solo PATCH.
      // Enviarlo en creación no rompe nada (Zod lo ignora), pero mostrarlo como
      // si funcionara sería fachada — por eso el selector solo se ve en edición.
      ...(isEdit ? { price_tier: form.price_tier } : {}),
      // Dirección: en edición solo si cambió (vaciada = null la borra); en alta solo si hay texto.
      ...(isEdit
        ? (addressChanged ? { address: form.address.trim() || null } : {})
        : (form.address.trim() ? { address: form.address.trim() } : {})),
      // "Verificado": solo admin y solo si cambió (el cajero recibiría 403).
      ...(isEdit && isAdmin && verifiedChanged ? { verified: form.verified } : {}),
    }

    try {
      const url    = isEdit ? `/api/clients/${client!.id}` : '/api/clients'
      const method = isEdit ? 'PATCH' : 'POST'

      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({})) as ClientApiResponse

      if (!res.ok) {
        const message = body.error ?? 'Error al guardar.'
        // 409 = cédula ya registrada en el negocio: se marca en el campo, no como error genérico.
        if (res.status === 409) setErrors((prev) => ({ ...prev, cedula: message }))
        else if (body.field === 'address') setErrors((prev) => ({ ...prev, address: message }))
        else setServerError(message)
        return
      }

      const saved: ClientRecord = {
        ...(client ?? { id: 0, pending_balance_usd: 0, created_at: new Date() }),
        ...body.client!,
      }

      if (isEdit) onUpdated(saved)
      else onCreated(saved)
    } catch {
      setServerError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar Cliente' : 'Nuevo Cliente'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" loading={loading} onClick={handleSubmit}>
            {isEdit ? 'Guardar cambios' : 'Crear cliente'}
          </Button>
        </>
      }
    >
      <div className={styles.fields}>
        <Input
          label="Nombre completo"
          placeholder="Ej. María González"
          value={form.name}
          onChange={set('name')}
          error={errors.name}
          required
          autoFocus
        />

        <Input
          label="Cédula / RIF"
          placeholder="V-12345678 o J-123456789"
          value={form.cedula}
          onChange={set('cedula')}
          error={errors.cedula}
          inputMode="numeric"
          hint="Opcional"
        />

        <Input
          label="Teléfono"
          placeholder="+58 412 000 0000"
          value={form.phone}
          onChange={set('phone')}
          type="tel"
          hint="Opcional"
        />

        <Input
          label="Correo electrónico"
          placeholder="cliente@ejemplo.com"
          value={form.email}
          onChange={set('email')}
          type="email"
          error={errors.email}
          hint="Opcional"
        />

        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="client-notes">
            Notas internas
            <span className={styles.hint}>Opcional</span>
          </label>
          <textarea
            id="client-notes"
            className={styles.textarea}
            placeholder="Información adicional del cliente..."
            value={form.notes}
            onChange={set('notes')}
            rows={3}
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="client-address">
            Dirección de envío
            <span className={styles.hint}>Opcional</span>
          </label>
          <textarea
            id="client-address"
            data-testid="client-address"
            className={styles.textarea}
            placeholder="Estado, ciudad y dirección completa u oficina de destino"
            value={form.address}
            onChange={set('address')}
            rows={2}
            aria-invalid={!!errors.address}
          />
          {errors.address && <p className={styles.serverError} role="alert">{errors.address}</p>}
        </div>

        {isEdit && isAdmin && (
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              data-testid="client-verified"
              checked={form.verified}
              onChange={(e) => setForm((prev) => ({ ...prev, verified: e.target.checked }))}
            />
            Cliente verificado
          </label>
        )}

        {isEdit && (
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="client-price-tier">
              Tipo de precio
            </label>
            <select
              id="client-price-tier"
              className={styles.select}
              value={form.price_tier}
              onChange={(e) => setForm((prev) => ({ ...prev, price_tier: e.target.value as 'detal' | 'mayorista' }))}
            >
              <option value="detal">Detal</option>
              <option value="mayorista">Divisa</option>
            </select>
          </div>
        )}

        {serverError && (
          <p className={styles.serverError} role="alert">{serverError}</p>
        )}
      </div>
    </Modal>
  )
}
