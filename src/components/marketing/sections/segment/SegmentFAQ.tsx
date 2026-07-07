import type { SegmentFaq } from '@/types/marketing'
import styles from './SegmentFAQ.module.css'

interface Props {
  faqs: SegmentFaq[]
  segmentName: string
}

export default function SegmentFAQ({ faqs, segmentName }: Props) {
  if (faqs.length === 0) return null

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Preguntas frecuentes</h2>
      <p className={styles.subtitle}>
        Todo lo que necesitás saber sobre ActivoPOS para tu {segmentName}
      </p>
      <div className={styles.grid}>
        {faqs.map(faq => (
          <div key={faq.id} className={styles.item}>
            <p className={styles.question}>{faq.question}</p>
            <p className={styles.answer}>{faq.answer}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
