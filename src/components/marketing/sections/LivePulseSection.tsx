import Link from 'next/link'
import {
  DollarSign, RefreshCw, ScanBarcode, UserPlus, Receipt, MessageCircle,
  FileText, RotateCcw, TrendingUp, Clock3, type LucideIcon,
} from 'lucide-react'
import { readCachedBcvRate } from '@/lib/bcv'
import styles from './LivePulseSection.module.css'

/* Sección fusionada (LivePulse + ProductBento + 2 tiles únicos de
   FinancialBrain): "prueba" de la landing -- el producto en vivo (feed +
   chart, todo CSS/@keyframes, Server Component puro) a la derecha, y las
   cifras de dinero destiladas a stat-grid a la izquierda. Sin bullets
   (redundantes con PainSection). Los valores son datos de ejemplo curados
   a mano, misma tasa BCV implícita entre sí -- nunca screenshots de la
   cuenta demo. */

const BARS = [45, 68, 32, 80, 55, 90, 40, 62, 75, 35, 88, 50, 70, 42]
const BARS_AVG = BARS.reduce((s, v) => s + v, 0) / BARS.length

/* Stat-grid izquierdo: rescata Cobrado + Margen de ProductBento y
   "Lo que te deben" (CxC) + "Tu mejor hora" (analytics) de
   FinancialBrain -- los 2 únicos mensajes no redundantes de esa sección.
   Dual moneda sellada: todo valor monetario muestra USD y Bs juntos. */
interface Stat {
  Icon:  LucideIcon
  label: string
  value: string
  sub:   string
}
const STATS: Stat[] = [
  { Icon: DollarSign, label: 'Cobrado hoy',     value: '$431.40', sub: 'Bs. 15.847,48' },
  { Icon: TrendingUp, label: 'Margen bruto',    value: '42.6%',   sub: 'de cada venta' },
  { Icon: Receipt,    label: 'Lo que te deben', value: '$340.00', sub: 'Bs. 12.489,90' },
  { Icon: Clock3,     label: 'Tu mejor hora',   value: '6:00 PM', sub: 'viernes' },
]

interface FeedEvent {
  Icon:   LucideIcon
  color:  'green' | 'blue' | 'amber'
  title:  string
  detail: string
  time:   string
}

export default async function LivePulseSection() {
  // El VALOR de la tasa sale de la última BCV cacheada (real, creíble); el resto
  // del feed es contenido de demostración. readCachedBcvRate cae a FALLBACK si no hay tasa.
  const bcvRate = await readCachedBcvRate()
  const bcvStr  = bcvRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  /* Único caso donde el ícono varía de color por evento -- mismo criterio
     ya sellado para métodos de pago (Colorimetria-Final): la CAJA sigue
     blanca siempre, solo el ícono cambia. Venta=verde (positivo), CxP y
     devolución=ámbar (dinero/stock en reversa), el resto Persian Blue. */
  const EVENTS: FeedEvent[] = [
    { Icon: DollarSign,    color: 'green', title: 'Venta cobrada',        detail: 'Pago Móvil · $18.50',          time: 'ahora' },
    { Icon: RefreshCw,     color: 'blue',  title: 'Tasa BCV actualizada', detail: `Bs. ${bcvStr} por $`,          time: 'hace 1 min' },
    { Icon: ScanBarcode,   color: 'blue',  title: 'Producto escaneado',   detail: 'Harina P.A.N. 1kg',            time: 'hace 2 min' },
    { Icon: UserPlus,      color: 'blue',  title: 'Cliente nuevo',        detail: 'María G. · Boutique',          time: 'hace 4 min' },
    { Icon: Receipt,       color: 'amber', title: 'Cuenta por pagar',     detail: 'Distribuidora Polar · $120.00', time: 'hace 6 min' },
    { Icon: MessageCircle, color: 'blue',  title: 'Pedido de catálogo',   detail: 'WhatsApp · 3 productos',       time: 'hace 8 min' },
    { Icon: FileText,      color: 'blue',  title: 'Cotización enviada',   detail: '$430.00',                      time: 'hace 12 min' },
    { Icon: RotateCcw,     color: 'amber', title: 'Devolución procesada', detail: 'Camisa Talla M',               time: 'hace 15 min' },
    { Icon: DollarSign,    color: 'green', title: 'Venta cobrada',        detail: 'Zelle · $42.00',               time: 'hace 18 min' },
  ]

  /* 3 slots, 3 eventos cada uno (round-robin sobre el banco de 9) */
  const SLOTS: FeedEvent[][] = [
    [EVENTS[0], EVENTS[3], EVENTS[6]],
    [EVENTS[1], EVENTS[4], EVENTS[7]],
    [EVENTS[2], EVENTS[5], EVENTS[8]],
  ]

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>En vivo</span>
          <h2 className={styles.title}>Tu negocio,<br />en vivo y en criollo.</h2>
          <p className={styles.subtitle}>
            Cada venta, cada número — al instante. Sin Excel, sin libreta, sin calculadora.
            Tu negocio te habla en criollo, cada noche.
          </p>

          <div className={styles.statGrid}>
            {STATS.map(s => (
              <div key={s.label} className={styles.statCard}>
                <span className={styles.statGhost} aria-hidden="true"><s.Icon size={56} /></span>
                <span className={styles.statIcon}><s.Icon size={16} aria-hidden="true" /></span>
                <span className={styles.statLabel}>{s.label}</span>
                <span className={`${styles.statValue} tabular-nums`}>{s.value}</span>
                <span className={`${styles.statSub} tabular-nums`}>{s.sub}</span>
              </div>
            ))}
          </div>

          <Link href="/como-funciona" className={styles.ctaBtn}>Ver cómo funciona</Link>
        </div>

        <div className={styles.card}>
          <div className={styles.chartHeader}>
            <span className={styles.chartLabel}>Tu negocio, en vivo</span>
            <span className={styles.liveIndicator}>
              <span className={styles.liveDot} aria-hidden="true" />
              activo
            </span>
          </div>

          <div className={styles.chartWrap} aria-hidden="true">
            <div className={styles.chartTrack}>
              {[...BARS, ...BARS].map((h, i) => (
                <span
                  key={i}
                  className={`${styles.chartBar} ${h > BARS_AVG ? styles.barUp : styles.barBrand}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>

          <div className={styles.eventFeed}>
            {SLOTS.map((slotEvents, slotIdx) => (
              <div className={styles.eventSlot} key={slotIdx}>
                {slotEvents.map((ev, i) => (
                  <div
                    key={i}
                    className={styles.eventItem}
                    style={{ animationDelay: `${-(3 * i + slotIdx)}s` }}
                  >
                    <span className={`${styles.eventIcon} ${styles[`eventIcon_${ev.color}`]}`}>
                      <ev.Icon size={15} aria-hidden="true" />
                    </span>
                    <span className={styles.eventText}>
                      <span className={styles.eventTitle}>{ev.title}</span>
                      <span className={styles.eventDetail}>{ev.detail}</span>
                    </span>
                    <span className={styles.eventTime}>{ev.time}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
