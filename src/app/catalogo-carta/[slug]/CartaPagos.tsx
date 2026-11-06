import { cx, fmtRate } from './util'
import styles from './carta.module.css'
import type { CartaPagos as Pagos } from '@/types/carta'

interface CartaPagosProps {
  pagos: Pagos
  rate:  number
}

/** "Cómo pagas": UNA sola vez, según el panel de cobro del negocio (nunca por plato). Si solo cobra Bs: sin Divisa ni Cashea. */
export function CartaPagos({ pagos, rate }: CartaPagosProps) {
  const tasa = fmtRate(rate)
  const soloBs = pagos.divisa.length === 0 && !pagos.cashea
  return (
    <div className={styles.pagos} data-testid="carta-franja-pago">
      <div className={cx(styles.wrap, styles.pagosIn)}>
        {soloBs ? (
          <span className={styles.pagosC}>Precios en $ · pagas en Bs a tasa BCV {tasa}</span>
        ) : (
          <>
            <span className={styles.pagosK}>Cómo pagas</span>
            {pagos.divisa.length > 0 && <span className={styles.pagosC}><b>$ Divisa</b> {pagos.divisa.join(', ')}</span>}
            {pagos.bs && <span className={styles.pagosC}><b>Bs</b> a tasa BCV {tasa}</span>}
            {pagos.cashea && <span className={styles.pagosC}><span className={styles.chipCashea}>Cashea</span> en cuotas</span>}
          </>
        )}
      </div>
    </div>
  )
}
