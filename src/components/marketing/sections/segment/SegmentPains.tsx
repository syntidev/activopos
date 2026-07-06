import { X } from 'lucide-react'
import type { SegmentData } from '@/types/marketing'
import styles from './SegmentPains.module.css'

export default function SegmentPains({ segment }: { segment: SegmentData }) {
  const pains = [segment.pain_1, segment.pain_2, segment.pain_3]
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>¿Te suena familiar?</p>
        <h2 className={styles.title}>Esto pasa cuando no tienes control</h2>
        <div className={styles.grid}>
          {pains.map((pain, i) => (
            <article key={i} className={styles.card}>
              <span className={styles.iconWrap} aria-hidden="true">
                <X size={18} strokeWidth={2.5} />
              </span>
              <p className={styles.text}>{pain}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
