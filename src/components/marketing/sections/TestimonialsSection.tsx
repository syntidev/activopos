import { Star } from 'lucide-react'
import styles from './TestimonialsSection.module.css'

const TESTIMONIALS = [
  {
    quote: '"Ahora sí sabemos qué salió y qué quedó. Antes cuadrábamos a ojo."',
    name: 'María G.',
    biz: 'Bodega · Caracas',
    initial: 'M',
  },
  {
    quote: '"Dejamos de resolver por WhatsApp y libreta. El cliente pide por el catálogo y ya."',
    name: 'Carlos R.',
    biz: 'Restaurante · Maracaibo',
    initial: 'C',
  },
  {
    quote: '"El BCV se actualiza solo. No pierdo plata en la diferencia de tasa."',
    name: 'Ana M.',
    biz: 'Boutique · Valencia',
    initial: 'A',
  },
]

export default function TestimonialsSection() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <h2 className={styles.title} data-reveal>
          Lo que dicen quienes<br />ya lo tienen activo.
        </h2>
        <div className={styles.grid}>
          {TESTIMONIALS.map(({ quote, name, biz, initial }, i) => (
            <div
              key={name}
              className={styles.card}
              data-reveal
              data-reveal-delay={String(i + 1) as '1' | '2' | '3'}
            >
              <div className={styles.stars}>
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} size={14} aria-hidden fill="currentColor" />
                ))}
              </div>
              <p className={styles.quote}>{quote}</p>
              <div className={styles.author}>
                <div className={styles.avatar}>{initial}</div>
                <div>
                  <div className={styles.authorName}>{name}</div>
                  <div className={styles.authorBiz}>{biz}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
