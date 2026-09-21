'use client'

import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Camera } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { ReservaDTO } from '@/types/reservas'
import { formatBs, formatUsd } from './format'
import styles from './reservas.module.css'

const MAX_PHOTO_BYTES = 5 * 1024 * 1024 // mismo tope que /api/upload/image
const DEFAULT_METODO = 'efectivo'

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

/* ── Foto de entrega: OPCIONAL e independiente. Se agrega antes, durante o después
   de marcar Entregado (o nunca); jamás bloquea el marcado. ── */

interface FotoModalProps {
  reserva: ReservaDTO | null
  onClose: () => void
  /** Recibe la URL de la foto ya subida; debe lanzar Error si el PATCH falla. */
  onConfirm: (fotoUrl: string) => Promise<void>
}

export function FotoModal({ reserva, onClose, onConfirm }: FotoModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reservaId = reserva?.id ?? null
  useEffect(() => {
    setFile(null)
    setError(null)
    setBusy(false)
  }, [reservaId])

  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null
    if (picked && picked.size > MAX_PHOTO_BYTES) {
      setFile(null)
      setError('La foto no puede superar 5 MB')
      return
    }
    setError(null)
    setFile(picked)
  }

  const confirm = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('type', 'reservas')
      const res = await fetch('/api/upload/image', { method: 'POST', body: form })
      const data: { url?: string; error?: string } = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) throw new Error(data.error ?? 'No se pudo subir la foto')
      await onConfirm(data.url)
    } catch (err) {
      setError(messageOf(err, 'No se pudo guardar la foto'))
      setBusy(false)
    }
  }

  return (
    <Modal
      open={reserva !== null}
      onClose={busy ? () => undefined : onClose}
      title={reserva ? `Foto · ${reserva.ticket_number}` : 'Foto'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="success" onClick={confirm} disabled={!file} loading={busy}>
            Guardar foto
          </Button>
        </>
      }
    >
      <div className={styles.modalBody}>
        <p className={styles.modalText}>
          Foto de entrega de {reserva?.cliente_nombre}. Es opcional: no hace falta para marcar Entregado.
        </p>
        {preview ? (
          <img src={preview} alt="Vista previa de la foto de entrega" className={styles.previewImg} />
        ) : null}
        <label className={styles.fileLabel}>
          <Camera size={24} aria-hidden="true" />
          <span>{file ? 'Cambiar foto' : 'Tomar o elegir foto'}</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className={styles.fileInput}
            onChange={handleFile}
            aria-label="Foto de entrega"
          />
        </label>
        {error ? <p className={styles.errorText} role="alert">{error}</p> : null}
      </div>
    </Modal>
  )
}

/* ── Pago: monto en USD (+ Bs en vivo) y método ── */

interface PagoModalProps {
  reserva: ReservaDTO | null
  rate: number | null
  onClose: () => void
  onConfirm: (monto: number, metodo: string) => Promise<void>
}

export function PagoModal({ reserva, rate, onClose, onConfirm }: PagoModalProps) {
  const [monto, setMonto] = useState('')
  const [metodo, setMetodo] = useState(DEFAULT_METODO)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reservaId = reserva?.id ?? null
  useEffect(() => {
    setMonto('')
    setMetodo(DEFAULT_METODO)
    setError(null)
    setBusy(false)
  }, [reservaId])

  const montoNum = Number(monto)
  const validMonto = monto !== '' && Number.isFinite(montoNum) && montoNum > 0
  const bs = validMonto ? formatBs(montoNum, rate) : null

  const confirm = async () => {
    if (!validMonto) return
    setBusy(true)
    setError(null)
    try {
      await onConfirm(montoNum, metodo.trim() || DEFAULT_METODO)
    } catch (err) {
      setError(messageOf(err, 'No se pudo registrar el pago'))
      setBusy(false)
    }
  }

  return (
    <Modal
      open={reserva !== null}
      onClose={busy ? () => undefined : onClose}
      title={reserva ? `Pago · ${reserva.ticket_number}` : 'Pago'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="success" onClick={confirm} disabled={!validMonto} loading={busy}>
            Registrar pago
          </Button>
        </>
      }
    >
      <div className={styles.modalBody}>
        <p className={styles.modalText}>Pago recibido de {reserva?.cliente_nombre} (en persona).</p>
        <Input
          label="Monto (USD)"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="0.00"
        />
        {validMonto ? (
          <p className={styles.bsPreview}>
            {formatUsd(montoNum)} · {bs ?? 'Bs. — (tasa BCV no disponible)'}
          </p>
        ) : null}
        <Input
          label="Método"
          type="text"
          list="reserva-metodos"
          maxLength={30}
          value={metodo}
          onChange={(e) => setMetodo(e.target.value)}
          hint="efectivo, pago_movil, zelle…"
        />
        <datalist id="reserva-metodos">
          <option value="efectivo" />
          <option value="pago_movil" />
          <option value="zelle" />
          <option value="transferencia" />
        </datalist>
        {error ? <p className={styles.errorText} role="alert">{error}</p> : null}
      </div>
    </Modal>
  )
}

/* ── Confirmación al desmarcar Pagado (borra monto y método) ── */

interface UndoModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  onClose: () => void
  onConfirm: () => Promise<void>
}

export function UndoModal({ open, title, message, confirmLabel, onClose, onConfirm }: UndoModalProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setBusy(false)
    setError(null)
  }, [open])

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(messageOf(err, 'No se pudo desmarcar'))
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="danger" onClick={confirm} loading={busy}>{confirmLabel}</Button>
        </>
      }
    >
      <div className={styles.modalBody}>
        <p className={styles.modalText}>{message}</p>
        {error ? <p className={styles.errorText} role="alert">{error}</p> : null}
      </div>
    </Modal>
  )
}
