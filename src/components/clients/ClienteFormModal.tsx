'use client'

import { useState, useEffect } from 'react'
import { Modal }  from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input }  from '@/components/ui/Input'
import type { ClientRecord } from '@/types'
import styles from './ClienteFormModal.module.css'

interface ClienteFormModalProps {
  open:       boolean
  client:     ClientRecord | null
  onClose:    () => void
  onCreated:  (c: ClientRecord) => void
  onUpdated:  (c: ClientRecord) => void
}

interface FormState {
  name:   string
  cedula: string
  phone:  string
  email:  string
  notes:  string
}

const EMPTY: FormState = { name: '', cedula: '', phone: '', email: '', notes: '' }

interface FieldErrors {
  name?:   string
  email?:  string
}

export function ClienteFormModal({
  open,
  client,
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
        name:   client.name,
        cedula: client.cedula ?? '',
        phone:  client.phone  ?? '',
        email:  client.email  ?? '',
        notes:  client.notes  ?? '',
      })
    } else {
      setForm(EMPTY)
    }
    setErrors({})
    setServerError('')
  }, [client, open])

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const validate = (): boolean => {
    const next: FieldErrors = {}
    if (form.name.trim().length < 2) next.name = 'El nombre debe tener al menos 2 caracteres.'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = 'Correo electrónico no válido.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    setServerError('')

    const payload = {
      name:   form.name.trim(),
      cedula: form.cedula.trim()  || undefined,
      phone:  form.phone.trim()   || undefined,
      email:  form.email.trim()   || undefined,
      notes:  form.notes.trim()   || undefined,
    }

    try {
      const url    = isEdit ? `/api/clients/${client!.id}` : '/api/clients'
      const method = isEdit ? 'PATCH' : 'POST'

      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const body = await res.json() as { error?: string; client?: ClientRecord }

      if (!res.ok) {
        setServerError(body.error ?? 'Error al guardar.')
        return
      }

      const saved: ClientRecord = {
        ...(client ?? { id: 0, pending_balance_usd: 0, created_at: new Date() }),
        ...body.client,
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

        {serverError && (
          <p className={styles.serverError} role="alert">{serverError}</p>
        )}
      </div>
    </Modal>
  )
}
