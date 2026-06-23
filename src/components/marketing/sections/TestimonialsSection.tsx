import { Star } from 'lucide-react'
import styles from './TestimonialsSection.module.css'

const TESTIMONIALS = [
  {
    quote:
      '"Antes respondía 40 mensajes al día con precios. Ahora les mando el QR y ellos mismos ven lo que hay. Los pedidos llegan solos al WhatsApp."',
    name: 'Daniel A.',
    biz: 'Café · Margarita · Plan Catálogo',
    initial: 'D',
  },
  {
    quote:
      '"El BCV se actualiza solo. Ya no llamo a nadie para cambiar los precios en bolívares. Eso solo ya valió la pena desde el primer día."',
    name: 'María R.',
    biz: 'Bodega · Caracas · Plan Mostrador',
    initial: 'M',
  },
  {
    quote:
      '"Vendo ropa y con las variantes de talla y color el cajero sabe exactamente qué salió. El inventario cuadra solo, sin contar a mano."',
    name: 'Luisana V.',
    biz: 'Boutique · Valencia · Plan Catálogo',
    initial: 'L',
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
