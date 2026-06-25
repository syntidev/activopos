'use client'

import { useState, useEffect } from 'react'
import { Modal, Button, Input, useToast } from '@/components/ui'
import styles from './GastoModal.module.css'

interface ExpenseCat {
  id:        number
  name:      string
  is_system: boolean
}

export type GastoMode = 'gasto' | 'cxp'

interface GastoModalProps {
  open:      boolean
  onClose:   () => void
  mode:      GastoMode
  month:     string
  onSuccess: () => void
}

export function GastoModal({ open, onClose, mode, month, onSuccess }: GastoModalProps) {
  const { toast } = useToast()

  const [concepto,   setConcepto]   = useState('')
  const [monto,      setMonto]      = useState('')
  const [catId,      setCatId]      = useState<number | null>(null)
  const [fecha,      setFecha]      = useState(`${month}-01`)
  const [notas,      setNotas]      = useState('')
  const [tipo,       setTipo]       = useState<'fijo' | 'variable'>('variable')
  const [recurrente, setRecurrente] = useState(false)
  const [dueDate,    setDueDate]    = useState('')
  const [loading,    setLoading]    = useState(false)
  const [cats,       setCats]       = useState<ExpenseCat[]>([])

  const endpoint = mode === 'gasto' ? '/api/finanzas/gastos' : '/api/finanzas/cxp'
  const title    = mode === 'gasto' ? 'Nuevo Gasto' : 'Nueva Cuenta por Pagar'
  const valid    = concepto.trim().length >= 3 && parseFloat(monto) > 0 && !!fecha

  useEffect(() => {
    fetch('/api/finanzas/categorias')
      .then(r => r.json() as Promise<{ ok: boolean; categories: ExpenseCat[] }>)
      .then(j => {
        if (j.ok && j.categories.length > 0) {
          setCats(j.categories)
          const def = j.categories.find(c => c.is_system) ?? j.categories[0]
          setCatId(def.id)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!open) {
      setConcepto('')
      setMonto('')
      setNotas('')
      setFecha(`${month}-01`)
      setTipo('variable')
      setRecurrente(false)
      setDueDate('')
    }
  }, [open, month])

  const handleSubmit = async () => {
    if (!valid) return
    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        concepto:   concepto.trim(),
        monto_usd:  parseFloat(monto),
        fecha,
        tipo,
        recurrente: tipo === 'fijo' ? recurrente : false,
        due_date:   tipo === 'fijo' && dueDate ? dueDate : undefined,
        notas:      notas.trim() || undefined,
      }
      if (catId != null) body.expense_category_id = catId
      else               body.categoria            = 'otro'

      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (res.ok) {
        toast(mode === 'gasto' ? 'Gasto registrado' : 'CxP creada', 'success')
        onSuccess()
        onClose()
      } else {
        const err = await res.json() as { error?: string }
        toast(err.error ?? 'Error al guardar', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={loading || !valid}>
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        {/* Concepto */}
        <div className={styles.field}>
          <label className={styles.label}>Concepto</label>
          <Input
            value={concepto}
            onChange={e => setConcepto(e.target.value)}
            placeholder="Descripción del gasto"
            maxLength={150}
            autoFocus
          />
        </div>

        {/* Monto + Fecha */}
        <div className={styles.row2}>
          <div className={styles.field}>
            <label className={styles.label}>Monto (USD)</label>
            <Input
              value={monto}
              onChange={e => setMonto(e.target.value)}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              placeholder="0.00"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Fecha</label>
            <Input
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              type="date"
            />
          </div>
        </div>

        {/* Categoría */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="gasto-categoria">Categoría</label>
          <select
            id="gasto-categoria"
            className={styles.select}
            value={catId ?? ''}
            onChange={e => setCatId(Number(e.target.value))}
            disabled={cats.length === 0}
          >
            {cats.length === 0
              ? <option value="">Cargando…</option>
              : cats.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))
            }
          </select>
        </div>

        {/* Tipo */}
        <div className={styles.field}>
          <label className={styles.label}>Tipo</label>
          <div className={styles.pillRow}>
            <button
              type="button"
              className={`${styles.pill} ${tipo === 'variable' ? styles.pillActive : ''}`}
              onClick={() => { setTipo('variable'); setRecurrente(false); setDueDate('') }}
            >
              Variable
            </button>
            <button
              type="button"
              className={`${styles.pill} ${tipo === 'fijo' ? styles.pillActiveFijo : ''}`}
              onClick={() => setTipo('fijo')}
            >
              Fijo
            </button>
          </div>
        </div>

        {/* Recurrente + Vencimiento — solo si Fijo */}
        {tipo === 'fijo' && (
          <>
            <div className={styles.field}>
              <label className={styles.toggleRow}>
                <span className={styles.label}>Recurrente (mensual)</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={recurrente}
                  className={`${styles.toggleBtn} ${recurrente ? styles.toggleBtnOn : ''}`}
                  onClick={() => setRecurrente(v => !v)}
                >
                  <span className={styles.toggleThumb} />
                </button>
              </label>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Fecha de vencimiento</label>
              <Input
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                type="date"
              />
            </div>
          </>
        )}

        {/* Notas */}
        <div className={styles.field}>
          <label className={styles.label}>Notas (opcional)</label>
          <textarea
            className={styles.textarea}
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Notas adicionales..."
            rows={2}
            maxLength={500}
          />
        </div>
      </div>
    </Modal>
  )
}
