import {
  DollarSign, RefreshCw, ScanBarcode, UserPlus, Receipt, MessageCircle,
  FileText, RotateCcw, type LucideIcon,
} from 'lucide-react'
import styles from './LivePulseSection.module.css'

/* Server Component puro -- todas las animaciones son CSS (@keyframes),
   cero JS/'use client' necesario: ni el scroll de barras, ni el feed
   de eventos (offsets vía animation-delay negativo), ni el pulso del
   punto "activo" requieren estado ni interactividad. */

const BARS = [45, 68, 32, 80, 55, 90, 40, 62, 75, 35, 88, 50, 70, 42]
const BARS_AVG = BARS.reduce((s, v) => s + v, 0) / BARS.length

interface FeedEvent {
  Icon:   LucideIcon
  color:  'green' | 'blue' | 'amber'
  title:  string
  detail: string
}

/* Único caso donde el ícono varía de color por evento -- mismo criterio
   ya sellado para métodos de pago (Colorimetria-Final): la CAJA sigue
   blanca siempre, solo el ícono cambia. Venta=verde (positivo), CxP y
   devolución=ámbar (dinero/stock en reversa), el resto Persian Blue. */
const EVENTS: FeedEvent[] = [
  { Icon: DollarSign,    color: 'green', title: 'Venta cobrada',        detail: 'Pago Móvil · $18.50' },
  { Icon: RefreshCw,     color: 'blue',  title: 'Tasa BCV actualizada', detail: 'Bs. 36.74 por $' },
  { Icon: ScanBarcode,   color: 'blue',  title: 'Producto escaneado',   detail: 'Harina P.A.N. 1kg' },
  { Icon: UserPlus,      color: 'blue',  title: 'Cliente nuevo',        detail: 'María G. · Boutique' },
  { Icon: Receipt,       color: 'amber', title: 'Cuenta por pagar',     detail: 'Distribuidora Polar · $120.00' },
  { Icon: MessageCircle, color: 'blue',  title: 'Pedido de catálogo',   detail: 'WhatsApp · 3 productos' },
  { Icon: FileText,      color: 'blue',  title: 'Cotización enviada',   detail: '$430.00' },
  { Icon: RotateCcw,     color: 'amber', title: 'Devolución procesada', detail: 'Camisa Talla M' },
  { Icon: DollarSign,    color: 'green', title: 'Venta cobrada',        detail: 'Zelle · $42.00' },
]

/* 3 slots, 3 eventos cada uno (round-robin sobre el banco de 9) */
const SLOTS: FeedEvent[][] = [
  [EVENTS[0], EVENTS[3], EVENTS[6]],
  [EVENTS[1], EVENTS[4], EVENTS[7]],
  [EVENTS[2], EVENTS[5], EVENTS[8]],
]

const BULLETS = [
  { title: 'Ves cada venta',        desc: 'en el momento que ocurre.' },
  { title: 'Sabes qué falta',       desc: 'antes de que se te acabe.' },
  { title: 'Nunca cuadras a ciegas', desc: 'todo cuadra solo.' },
]

export default function LivePulseSection() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>Tiempo real</span>
          <h2 className={styles.title}>Tu negocio.<br />En vivo.</h2>
          <p className={styles.subtitle}>
            Cada venta, cada ajuste de inventario, cada movimiento se refleja al instante.
            No tienes que ir a buscarlo — ya está ahí cuando lo necesitas.
          </p>
          <ul className={styles.bullets}>
            {BULLETS.map(b => (
              <li key={b.title} className={styles.bullet}>
                <span className={styles.bulletDot} aria-hidden="true" />
                <span>
                  <strong className={styles.bulletTitle}>{b.title}</strong>
                  {' — '}{b.desc}
                </span>
              </li>
            ))}
          </ul>
          <button type="button" className={styles.ctaBtn}>Ver cómo funciona</button>
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
