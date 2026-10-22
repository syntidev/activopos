import { FinancingNote } from './FinancingNote'
import type { PublicFinancing } from '@/lib/financing'
import type { PaymentKind } from '@/types/financing'
import styles from './CheckoutPaymentKind.module.css'

interface CheckoutPaymentKindProps {
  kind: PaymentKind
  onChange: (kind: PaymentKind) => void
  /** null = el negocio no tiene financiamiento activo: Cashea no aparece. */
  financing: PublicFinancing | null
  /** Nombres de los productos del carrito que no aplican a Cashea (deshabilita la opción). */
  blockedNames: string[]
  disabled?: boolean
}

const OPTIONS: { kind: PaymentKind; label: string }[] = [
  { kind: 'cashea', label: 'Cashea' },
  { kind: 'bs', label: 'Bolívares' },
  { kind: 'divisa', label: 'Divisa' },
]

/** Cómo va a pagar el cliente. Cashea: todo o nada, siempre al precio BCV completo. */
export function CheckoutPaymentKind({ kind, onChange, financing, blockedNames, disabled = false }: CheckoutPaymentKindProps) {
  const blocked = blockedNames.length > 0
  const options = OPTIONS.filter(o => o.kind !== 'cashea' || financing !== null)

  return (
    <div className={styles.wrap}>
      <div className={styles.group} role="radiogroup" aria-label="Forma de pago">
        {options.map(o => {
          const off = disabled || (o.kind === 'cashea' && blocked)
          return (
            <button
              key={o.kind}
              type="button"
              role="radio"
              aria-checked={kind === o.kind}
              aria-disabled={off}
              disabled={off}
              data-testid={`pay-kind-${o.kind}`}
              className={`${styles.option} ${kind === o.kind ? styles.optionActive : ''}`}
              onClick={() => onChange(o.kind)}
            >
              {o.kind === 'cashea' && financing?.name ? financing.name : o.label}
            </button>
          )
        })}
      </div>

      {financing && blocked && (
        <p className={styles.notice} role="alert" data-testid="cashea-blocked">
          Este producto no aplica a Cashea; quítalo para pagar con Cashea: <strong>{blockedNames.join(', ')}</strong>
        </p>
      )}

      {kind === 'cashea' && financing && !blocked && (
        <div className={styles.cashea} data-testid="cashea-info">
          <FinancingNote financing={financing} />
          <p className={styles.hint}>Cashea se paga al precio BCV completo. No aplica Divisa.</p>
        </div>
      )}
    </div>
  )
}
