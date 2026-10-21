import { CASHEA_PRESET } from '@/lib/financing'
import type { PublicFinancing } from '@/lib/financing'
import styles from './FinancingNote.module.css'

interface FinancingNoteProps {
  /** Vista pública de business.financing ya filtrada: null = desactivado o producto excluido (no se pinta nada). */
  financing: PublicFinancing | null
}

/**
 * Financiamiento en la ficha pública del producto, según el modo del negocio:
 *  - preset Cashea: el sello oficial de siempre (la frase solo se escribe si el negocio la editó);
 *  - otra empresa: su logo subido (si hay) + la frase;
 *  - propio: solo la frase.
 * Cashea no está cableado: llega como preset en `financing`.
 */
export function FinancingNote({ financing }: FinancingNoteProps) {
  if (!financing) return null

  const isCasheaDefault = financing.mode === 'cashea' && financing.phrase === CASHEA_PRESET.phrase
  const showPhrase = !isCasheaDefault

  return (
    <span className={styles.note}>
      {financing.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element -- logo propio del negocio, alto fijo
        <img
          className={styles.logo}
          src={financing.logo_url}
          alt={financing.name ?? financing.phrase}
          loading="lazy"
        />
      )}
      {showPhrase && <span className={styles.phrase}>{financing.phrase}</span>}
    </span>
  )
}
