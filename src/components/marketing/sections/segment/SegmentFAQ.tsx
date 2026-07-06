'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { SegmentFaq } from '@/types/marketing'
import styles from './SegmentFAQ.module.css'

export default function SegmentFAQ(
  { faqs, segmentName }: { faqs: SegmentFaq[]; segmentName: string },
) {
  const [openId, setOpenId] = useState<string | null>(null)
  if (faqs.length === 0) return null

  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <h2 className={styles.title}>Preguntas sobre ActivoPOS para {segmentName}</h2>
        <div className={styles.list}>
          {faqs.map(faq => {
            const open = openId === faq.id
            return (
              <div key={faq.id} className={`${styles.item} ${open ? styles.itemOpen : ''}`}>
                <button
                  type="button"
                  className={styles.question}
                  onClick={() => setOpenId(open ? null : faq.id)}
                  aria-expanded={open}
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    size={18}
                    className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
                    aria-hidden="true"
                  />
                </button>
                <div className={styles.answerWrap} data-open={open}>
                  <p className={styles.answer}>{faq.answer}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
