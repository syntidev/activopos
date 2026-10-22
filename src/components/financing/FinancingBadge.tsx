import type { TicketFinancing } from '@/types/financing'
import styles from './FinancingBadge.module.css'

interface FinancingBadgeProps {
  financing: TicketFinancing
}

const TONE: Record<TicketFinancing['status'], string> = {
  requested: styles.requested,
  approved: styles.approved,
  rejected: styles.rejected,
}

/** Insignia "Cashea · Estado" (proveedor del snapshot del ticket). */
export function FinancingBadge({ financing }: FinancingBadgeProps) {
  const provider = financing.provider ?? 'Cashea'
  return (
    <span className={`${styles.badge} ${TONE[financing.status]}`} data-testid="financing-badge" data-status={financing.status}>
      <span className={styles.provider}>{provider}</span>
      <span className={styles.status}>{financing.status_label}</span>
    </span>
  )
}
