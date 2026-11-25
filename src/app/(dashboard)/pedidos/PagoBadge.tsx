import { bs, usd } from './money'
import { PAGO_LABEL, type OrderPago, type PagoEstado } from './pago'
import d from './PedidoPago.module.css'

const TONE: Record<PagoEstado, string> = { por_cobrar: d.porCobrar, cobrado: d.cobrado, a_credito: d.aCredito }

/** Insignia del estado de pago + "Cashea $X" aparte (saldo asignado a la financiadora) + "Debe $X" si el financiamiento se rechazó tras cobrar. */
export function PagoBadge({ estado, pago }: { estado: PagoEstado; pago?: OrderPago }) {
  const cashea = pago?.cashea_asignado_usd ?? 0
  const deuda = pago?.deuda_cliente_usd ?? 0
  return (
    <span className={d.pagoWrap}>
      <span className={`${d.pago} ${TONE[estado]}`} data-testid="pago-badge" data-estado={estado}>{PAGO_LABEL[estado]}</span>
      {cashea > 0 && <span className={`${d.chip} ${d.chipCashea}`} data-testid="pago-cashea">Cashea {usd(cashea)}</span>}
      {deuda > 0 && <span className={`${d.chip} ${d.chipDeuda}`} data-testid="pago-deuda">Debe {usd(deuda)}</span>}
    </span>
  )
}

/** Desglose del pago en el detalle del pedido: USD y Bs juntos (Bs = USD × tasa del pedido). */
export function PagoResumen({ estado, pago, rate }: { estado: PagoEstado; pago: OrderPago; rate: number }) {
  const fila = (etiqueta: string, valor: number, testid: string) => (
    <div className={d.resumenFila} data-testid={testid}>
      <span>{etiqueta}</span>
      <strong>{usd(valor)}{rate > 0 && ` · ${bs(valor * rate)}`}</strong>
    </div>
  )
  return (
    <section className={d.resumen} aria-label="Pago del pedido" data-testid="pago-resumen">
      <div className={d.resumenHead}>
        <h3 className={d.resumenTitulo}>Pago</h3>
        <PagoBadge estado={estado} pago={pago} />
      </div>
      {fila('Total', pago.total_usd, 'pago-total')}
      {pago.recibido_usd > 0 && fila('Recibido', pago.recibido_usd, 'pago-recibido')}
      {pago.cashea_asignado_usd > 0 && fila('A cargo de Cashea', pago.cashea_asignado_usd, 'pago-cashea-fila')}
      {pago.deuda_cliente_usd > 0 && fila('Deuda del cliente', pago.deuda_cliente_usd, 'pago-deuda-fila')}
      {estado !== 'cobrado' && pago.saldo_pendiente_usd > 0 && fila('Saldo pendiente', pago.saldo_pendiente_usd, 'pago-saldo')}
      {pago.deuda_cliente_usd > 0 && (
        <p className={d.resumenAlerta} role="note">Cashea no pagó este saldo: quedó a cargo del cliente.</p>
      )}
    </section>
  )
}
