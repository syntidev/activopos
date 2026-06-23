import { Clock, TrendingDown, MessageCircle, Globe2 } from 'lucide-react'
import styles from './ProblemSection.module.css'

const PAINS = [
  {
    num: '01',
    title: 'No sabes cuánto vendiste hasta cerrar el día',
    desc: 'El cuaderno registra pero no suma. Para saber el total alguien tiene que calcularlo todo a mano — y ese alguien casi siempre eres tú.',
    badge: 'Costo: tiempo y control',
    icon: Clock,
    variant: 'red',
  },
  {
    num: '02',
    title: 'El BCV cambia y tú actualizas precios a mano',
    desc: 'Cada vez que sube el dólar alguien recalcula los precios en bolívares. Si nadie lo hace, vendes barato sin darte cuenta.',
    badge: 'Costo: margen invisible',
    icon: TrendingDown,
    variant: 'amber',
  },
  {
    num: '03',
    title: 'Respondes WhatsApps con precios todo el día',
    desc: 'Uno a uno, con fotos, con precios escritos a mano. Todo eso es trabajo que no cobras y tiempo que no tienes.',
    badge: 'Costo: ventas que no cierran',
    icon: MessageCircle,
    variant: 'brand',
  },
  {
    num: '04',
    title: 'Tu sistema no fue hecho para Venezuela',
    desc: 'Sin BCV nativo. Sin Pago Móvil. Una sola moneda. Te cobran desde otro país y el soporte contesta en tres días.',
    badge: 'Costo: plata y paciencia',
    icon: Globe2,
    variant: 'purple',
  },
] as const

export default function ProblemSection() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <h2 className={styles.title} data-reveal>
          Tu negocio factura.<br />Pero lo controlas con papel.
        </h2>
        <p className={styles.subtitle} data-reveal>
          No es culpa tuya. Los sistemas que existen o son caros, o no entienden Venezuela,
          o son tan complicados que el cajero no los usa.
        </p>

        <div className={styles.list} data-reveal>
          {PAINS.map(({ num, title, desc, badge, icon: Icon, variant }, i) => (
            <div key={num} className={styles.row}>
              <div className={styles.num}>{num}</div>
              <div className={styles.body}>
                <div className={styles.rowTitle}>{title}</div>
                <p className={styles.rowDesc}>{desc}</p>
              </div>
              <span className={`${styles.badge} ${styles[`badge_${variant}`]}`}>
                <Icon size={11} aria-hidden />
                {badge}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
