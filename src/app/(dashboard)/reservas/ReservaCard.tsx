'use client'

import { AlertTriangle, Camera, Check, Phone } from 'lucide-react'
import type { ReservaDTO } from '@/types/reservas'
import { formatBs, formatShortDate, formatUsd } from './format'
import styles from './reservas.module.css'

/**
 * Bandera independiente: ✓ (hecha) o ⚠ (pendiente). Cada una hace su propio
 * PATCH; ninguna depende de las otras dos.
 */
function FlagButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string
  active: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`${styles.flag} ${active ? styles.flagOn : styles.flagOff}`}
      aria-pressed={active}
      aria-label={`${label}: ${active ? 'sí' : 'pendiente'}. Cambiar`}
      disabled={disabled}
      onClick={onClick}
    >
      {active ? <Check size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}
      <span>{label}</span>
    </button>
  )
}

interface ReservaCardProps {
  reserva: ReservaDTO
  rate: number | null
  busy: boolean
  onToggleArmado: (r: ReservaDTO) => void
  onToggleEntregado: (r: ReservaDTO) => void
  onTogglePagado: (r: ReservaDTO) => void
  onAddFoto: (r: ReservaDTO) => void
}

export function ReservaCard({
  reserva: r,
  rate,
  busy,
  onToggleArmado,
  onToggleEntregado,
  onTogglePagado,
  onAddFoto,
}: ReservaCardProps) {
  const bs = r.pagado_monto !== null ? formatBs(r.pagado_monto, rate) : null

  return (
    <article className={`${styles.card} ${busy ? styles.cardBusy : ''}`} aria-busy={busy}>
      <div className={styles.cardHeader}>
        <span className={styles.ticket}>{r.ticket_number}</span>
        <span className={styles.cardDate}>{formatShortDate(r.created_at)}</span>
      </div>

      <p className={styles.cardClient}>{r.cliente_nombre}</p>
      {r.cliente_telefono ? (
        <p className={styles.cardPhone}>
          <Phone size={12} aria-hidden="true" />
          {r.cliente_telefono}
        </p>
      ) : null}

      <p className={styles.cardKit}>
        <strong>{r.kit_nombre}</strong>
        {/* componentes_tallas manda si existe -- kit con desglose por pieza
            (Maillot L, Franela S) no cabe en un solo "Talla X". Legacy
            (reservas de antes de este campo) sigue mostrando la talla única. */}
        {!r.componentes_tallas && r.talla ? ` · Talla ${r.talla}` : ''} × {r.cantidad}
      </p>

      {r.componentes_tallas && Object.keys(r.componentes_tallas).length > 0 ? (
        <div className={styles.extras}>
          {Object.entries(r.componentes_tallas).map(([componente, talla]) => (
            <span key={componente} className={styles.extraChip}>
              {componente}: {talla}
            </span>
          ))}
        </div>
      ) : null}

      {r.extras && r.extras.length > 0 ? (
        <div className={styles.extras}>
          {r.extras.map((e, i) => (
            <span key={`${e.nombre}-${e.talla ?? ''}-${i}`} className={styles.extraChip}>
              +{e.cantidad} {e.nombre}{e.talla ? ` (${e.talla})` : ''}
            </span>
          ))}
        </div>
      ) : null}

      <div className={styles.flags} role="group" aria-label={`Estado de ${r.ticket_number}`}>
        <FlagButton label="Armado" active={r.armado} disabled={busy} onClick={() => onToggleArmado(r)} />
        <FlagButton label="Entregado" active={r.entregado} disabled={busy} onClick={() => onToggleEntregado(r)} />
        <FlagButton label="Pagado" active={r.pagado} disabled={busy} onClick={() => onTogglePagado(r)} />
      </div>

      {r.pagado && r.pagado_monto !== null ? (
        <div className={styles.pago}>
          <span className={styles.pagoUsd}>{formatUsd(r.pagado_monto)}</span>
          <span>{bs ?? 'Bs. — (sin tasa BCV)'}</span>
          {r.pagado_metodo ? <span className={styles.pagoMetodo}>{r.pagado_metodo.replace('_', ' ')}</span> : null}
        </div>
      ) : null}

      {/* Foto OPCIONAL e independiente: se puede agregar antes, durante o después de
          marcar Entregado, o nunca. No condiciona ninguna bandera. */}
      <div className={styles.fotoRow}>
        <button type="button" className={styles.fotoBtn} disabled={busy} onClick={() => onAddFoto(r)}>
          <Camera size={14} aria-hidden="true" />
          {r.entregado_foto ? 'Cambiar foto' : 'Agregar foto'}
        </button>
        {r.entregado_foto ? (
          <a className={styles.photoLink} href={r.entregado_foto} target="_blank" rel="noopener noreferrer">
            Ver foto
          </a>
        ) : null}
      </div>
    </article>
  )
}
