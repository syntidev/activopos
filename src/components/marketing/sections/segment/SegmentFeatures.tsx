import {
  ShoppingCart, Package, DollarSign, Share2, FileText, Users, BarChart2, Receipt,
  type LucideIcon,
} from 'lucide-react'
import type { SegmentMode } from '@/types/marketing'
import styles from './SegmentFeatures.module.css'

interface Feature { Icon: LucideIcon; title: string; desc: string }

const FEATURES: Record<SegmentMode, Feature[]> = {
  product: [
    { Icon: ShoppingCart, title: 'POS táctil',                 desc: 'Vende en segundos desde cualquier dispositivo' },
    { Icon: Package,      title: 'Inventario en tiempo real',  desc: 'Sabes exactamente qué tienes sin contar' },
    { Icon: DollarSign,   title: 'USD y Bs automáticos',       desc: 'Tasa BCV actualizada — nunca más calcular a mano' },
    { Icon: Share2,       title: 'Catálogo digital',           desc: 'Tus productos en tutienda.activopos.com para pedir por WhatsApp' },
  ],
  service: [
    { Icon: FileText,     title: 'Cotizaciones profesionales', desc: 'PDF con tu logo, precios en USD y Bs' },
    { Icon: Users,        title: 'Gestión de clientes',        desc: 'Historial, deuda pendiente y abonos por cliente' },
    { Icon: DollarSign,   title: 'Cobros en divisas',          desc: 'Pago Móvil, Zelle, efectivo USD y Bs en el mismo cobro' },
    { Icon: BarChart2,    title: 'Reportes financieros',       desc: 'Lo que facturaste, cobrado y por cobrar en un vistazo' },
  ],
  hybrid: [
    { Icon: ShoppingCart, title: 'POS táctil',                 desc: 'Productos y servicios en el mismo ticket' },
    { Icon: Package,      title: 'Inventario en tiempo real',  desc: 'Sabes exactamente qué tienes sin contar' },
    { Icon: FileText,     title: 'Cotizaciones',               desc: 'Para trabajos, servicios o presupuestos formales' },
    { Icon: DollarSign,   title: 'USD y Bs automáticos',       desc: 'Tasa BCV actualizada en cada cobro' },
  ],
}

const MODE_NOUN: Record<SegmentMode, string> = {
  product: 'negocio',
  service: 'servicio',
  hybrid:  'negocio',
}

const TICKET_CARTA_MESSAGE =
  'Ticket para el mostrador. Carta para tu cotización. Tú eliges el formato — ' +
  'nosotros no generamos tu factura fiscal, te ayudamos a controlar antes de ' +
  'que llegue a tu contador.'

// Heurística simple para "cuál pesa más en pain_1" (§5) — presencia de
// vocabulario de servicio vs. producto en el texto real del segmento.
const SERVICE_KEYWORDS = ['servicio', 'cotiz', 'client', 'consulta', 'cita', 'cobra']

function isServiceWeighted(pain1: string): boolean {
  const lower = pain1.toLowerCase()
  return SERVICE_KEYWORDS.some(kw => lower.includes(kw))
}

interface Props {
  mode:  SegmentMode
  pain1: string
}

export default function SegmentFeatures({ mode, pain1 }: Props) {
  const features = FEATURES[mode]
  const showTicketCarta = mode === 'service' || mode === 'hybrid'
  const ticketCartaFirst = mode === 'hybrid' && isServiceWeighted(pain1)

  const ticketCartaBlock = showTicketCarta && (
    <div className={styles.ticketCarta}>
      <span className={styles.ticketCartaIcon} aria-hidden="true">
        <Receipt size={20} strokeWidth={2} />
      </span>
      <p className={styles.ticketCartaText}>{TICKET_CARTA_MESSAGE}</p>
    </div>
  )

  const featureGrid = (
    <div className={styles.grid}>
      {features.map(({ Icon, title, desc }) => (
        <article key={title} className={styles.card}>
          <span className={styles.iconWrap} aria-hidden="true">
            <Icon size={20} strokeWidth={2} />
          </span>
          <h3 className={styles.cardTitle}>{title}</h3>
          <p className={styles.cardDesc}>{desc}</p>
        </article>
      ))}
    </div>
  )

  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <h2 className={styles.title}>Todo lo que necesita tu {MODE_NOUN[mode]}</h2>
        {mode === 'hybrid' && ticketCartaFirst ? (
          <>{ticketCartaBlock}{featureGrid}</>
        ) : (
          <>{featureGrid}{ticketCartaBlock}</>
        )}
      </div>
    </section>
  )
}
