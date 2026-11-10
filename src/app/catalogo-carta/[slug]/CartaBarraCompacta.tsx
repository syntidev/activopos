import { CartaFoto } from './CartaFoto'
import { cx } from './util'
import styles from './carta.module.css'
import type { CartaOpenState } from '@/types/carta'

interface CartaBarraCompactaProps {
  businessName: string
  logo:         string | null
  open:         CartaOpenState | null
  /** true = el encabezado grande ya salió de la pantalla. */
  visible:      boolean
}

/** "Abierto"/"Cerrado"/"Pedidos en pausa"; si el estado viene de un texto libre (catalog_hours) se muestra tal cual. */
const etiquetaCorta = (label: string): string => (/^(Abierto|Cerrado|Pedidos en pausa)/.test(label) ? label.split(' · ')[0] : label)

/** Barra fija compacta (logo pequeño, nombre y estado) que aparece al bajar, encima de la barra de categorías. */
export function CartaBarraCompacta({ businessName, logo, open, visible }: CartaBarraCompactaProps) {
  return (
    <div className={cx(styles.compacta, visible && styles.compactaOn)} aria-hidden={!visible} data-testid="carta-barra-compacta" data-visible={visible ? 'true' : 'false'}>
      <span className={styles.compactaLogo}>
        {logo ? <CartaFoto src={logo} alt="" /> : <b aria-hidden="true">{businessName.trim().charAt(0).toUpperCase()}</b>}
      </span>
      <span className={styles.compactaNombre}>{businessName}</span>
      {open && <span className={cx(styles.compactaEstado, !open.open && styles.encEstadoCerrado)}><i aria-hidden="true" />{etiquetaCorta(open.label)}</span>}
    </div>
  )
}
