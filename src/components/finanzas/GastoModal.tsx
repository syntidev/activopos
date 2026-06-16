'use client'

import { useState } from 'react'
import { Modal, Button, Input, useToast } from '@/components/ui'
import styles from './GastoModal.module.css'

const CATEGORIAS = [
  { key: 'alquiler',  label: 'Alquiler'  },
  { key: 'nomina',    label: 'Nómina'    },
  { key: 'servicios', label: 'Servicios' },
  { key: 'proveedor', label: 'Proveedor' },
  { key: 'otro',      label: 'Otro'      },
] as const

type Categoria = typeof CATEGORIAS[number]['key']
export type GastoMode = 'gasto' | 'cxp'

interface GastoModalProps {
  open:      boolean
  onClose:   () => void
  mode:      GastoMode
  month:     string
  onSuccess: () => void
}

export function GastoModal({ open, onClose, mode, month, onSuccess }: GastoModalProps) {
  const { toast }   = useToast()
  const [concepto, setConcepto]   = useState('')
  const [monto, setMonto]         = useState('')
  const [categoria, setCategoria] = useState<Categoria>('otro')
  const [fecha, setFecha]         = useState(`${month}-01`)
  const [notas, setNotas]         = useState('')
  const [loading, setLoading]     = useState(false)

  const endpoint = mode === 'gasto' ? '/api/finanzas/gastos' : '/api/finanzas/cxp'
  const title    = mode === 'gasto' ? 'Nuevo Gasto' : 'Nueva Cuenta por Pagar'
  const valid    = concepto.trim().length >= 3 && parseFloat(monto) > 0 && !!fecha

  const handleSubmit = async () => {
    if (!valid) return
    setLoading(true)
    try {
      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concepto:  concepto.trim(),
          monto_usd: parseFloat(monto),
          categoria,
          fecha,
          notas: notas.trim() || undefined,
        }),
      })
      if (res.ok) {
        toast(mode === 'gasto' ? 'Gasto registrado' : 'CxP creada', 'success')
        onSuccess()
        onClose()
        setConcepto(''); setMonto(''); setCategoria('otro'); setNotas('')
      } else {
        const err = await res.json()
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

        <div className={styles.row2}>
          <div className={styles.field}>
            <label className={styles.label}>Monto (USD)</label>
            <Input
              value={monto}
              onChange={e => setMonto(e.target.value)}
              type="number"
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

        <div className={styles.field}>
          <label className={styles.label}>Categoría</label>
          <div className={styles.catGrid}>
            {CATEGORIAS.map(c => (
              <button
                key={c.key}
                type="button"
                className={`${styles.catBtn} ${categoria === c.key ? styles.catBtnActive : ''}`}
                onClick={() => setCategoria(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

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
