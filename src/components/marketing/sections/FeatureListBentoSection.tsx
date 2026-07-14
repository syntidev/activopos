import type { CSSProperties } from 'react'
import {
  ScanBarcode, Boxes, ChartColumn, Store, Users, Wallet, FileText, RotateCcw,
  ShoppingBag, PiggyBank, Activity, TrendingUp, Receipt, FileSpreadsheet,
  ChefHat, Bell, Columns3, Ruler, Palette, Warehouse,
  type LucideIcon,
} from 'lucide-react'
import SegmentIcon from '@/components/marketing/shared/SegmentIcon'
import styles from './FeatureListBentoSection.module.css'

/* Bento-Infinito-1 (reconstruido -- ver commit: el brief original con
   TAREA 1-4 nunca llegó a esta sesión, solo TAREA 5 + un adenda de
   corrección. Reconstruido con la info real disponible, sin inventar
   lo que faltaba: estructura "2 filas" para 20+ items no es viable con
   spans normales, se usa flujo natural de CSS Grid en su lugar). */

type Pattern = 'acumulador' | 'flujo' | 'barras' | 'lineas' | 'pulso' | 'giro'
type CardColor = 'blue' | 'green' | 'purple' | 'amber'

interface FeatureCard {
  key:      string
  Icon:     LucideIcon
  title:    string
  desc:     string
  descExtra?: string
  pattern:  Pattern
  color?:   CardColor
  colSpan?: 1 | 2
  rowSpan?: 1 | 2
  giroFaces?: [string, string]
  flujo?:   { pos: string; neg: string }
}

/* Los 18 nombres y su patrón vienen literal de TAREA 5. Punto de Venta y
   Catálogo Digital no estaban en esa lista (son las 2 cards que ya
   existían en el sprint anterior) -- se les asignó el patrón más afín
   ("no literal 1 a 1", tal como pide el propio brief). */
const FEATURES: FeatureCard[] = [
  {
    key: 'pos', Icon: ScanBarcode, pattern: 'lineas', colSpan: 2, rowSpan: 2,
    title: 'Punto de Venta',
    desc: 'Cobra en segundos, en cualquier moneda.',
    descExtra: 'Efectivo, Pago Móvil, Zelle o Binance — como ya te paguen.',
  },
  {
    key: 'catalogo', Icon: Store, pattern: 'acumulador', color: 'purple', colSpan: 2,
    title: 'Catálogo Digital',
    desc: 'Tu vitrina, abierta las 24 horas.',
  },
  { key: 'clientes',     Icon: Users,          pattern: 'acumulador', title: 'Clientes',           desc: 'Quién te debe y cuánto, siempre a la vista.' },
  { key: 'inventario',   Icon: Boxes,          pattern: 'acumulador', title: 'Inventario',          desc: 'Sabes qué tienes, sin contar a mano.' },
  { key: 'pedidos',      Icon: ShoppingBag,    pattern: 'acumulador', title: 'Pedidos',             desc: 'Tu cliente arma el pedido, a ti te llega listo.' },
  {
    key: 'finanzas', Icon: PiggyBank, pattern: 'flujo', color: 'green', colSpan: 2,
    title: 'Finanzas', desc: 'Lo que entra y lo que sale, siempre claro.',
    flujo: { pos: '+$340.00', neg: '-$128.50' },
  },
  {
    key: 'caja', Icon: Wallet, pattern: 'flujo', color: 'green', colSpan: 2,
    title: 'Caja', desc: 'Abre y cierra caja sin cuadrar a ojo.',
    flujo: { pos: '+$92.00', neg: '-$15.00' },
  },
  {
    key: 'devoluciones', Icon: RotateCcw, pattern: 'flujo', rowSpan: 2,
    title: 'Devoluciones', desc: 'Sin dolores de cabeza cuando algo se devuelve.',
    flujo: { pos: '+1 stock', neg: '-1 venta' },
  },
  { key: 'reportes',     Icon: ChartColumn,    pattern: 'barras', color: 'blue', rowSpan: 2, title: 'Reportes',         desc: 'Tu negocio en números, cuando quieras verlo.' },
  { key: 'pulso',        Icon: Activity,       pattern: 'barras', rowSpan: 2,                title: 'Pulso del Negocio', desc: 'Cómo va tu negocio, de un vistazo.' },
  { key: 'margen',       Icon: TrendingUp,     pattern: 'barras',                            title: 'Margen y Utilidad', desc: 'Cuánto ganaste de verdad, en cada venta.' },
  { key: 'ticket',       Icon: Receipt,        pattern: 'lineas', rowSpan: 2,                title: 'Emisión de Ticket', desc: 'Tu ticket térmico, listo al instante.' },
  { key: 'cotizaciones', Icon: FileText,       pattern: 'lineas', colSpan: 2,                title: 'Cotizaciones',      desc: 'Manda un presupuesto en un clic.' },
  { key: 'facturas',     Icon: FileSpreadsheet,pattern: 'lineas',                            title: 'Facturas',         desc: 'Tu factura, sin pelear con el Excel.' },
  { key: 'kds',          Icon: ChefHat,        pattern: 'pulso',                             title: 'KDS Cocina',       desc: 'Tu cocina ve el pedido, sin gritar de un lado a otro.' },
  { key: 'notificaciones', Icon: Bell,         pattern: 'pulso',                             title: 'Notificaciones',   desc: 'Te avisa antes de que se te olvide.' },
  { key: 'kanban',       Icon: Columns3,       pattern: 'pulso', colSpan: 2,                 title: 'Pedidos Kanban',   desc: 'Cada pedido, en su columna, sin perderlo de vista.' },
  {
    key: 'variantes', Icon: Ruler, pattern: 'giro',
    title: 'Variantes', desc: 'Talla, color o medida — como realmente vendes.',
    giroFaces: ['Talla M', 'Talla L'],
  },
  {
    key: 'multitema', Icon: Palette, pattern: 'giro',
    title: 'Multi-tema', desc: 'Tu negocio, con la cara que tú quieras.',
    giroFaces: ['Tema Azul', 'Tema Verde'],
  },
  {
    key: 'mayorista', Icon: Warehouse, pattern: 'giro', color: 'amber',
    title: 'Precio Mayorista', desc: 'Un precio para el cliente, otro para el mayorista.',
    giroFaces: ['$10.00', '$8.00'],
  },
]

/* Segmentos: MISMO fetch que SegmentsSection.tsx (no se duplica la
   query, mismo contrato de /api/marketing/segments). Solo ícono
   fantasma girado + nombre -- sin micro-animación, para diferenciarlos
   de las cards de función que sí "actúan" (pedido explícito). */
interface ApiSegment { slug: string; name: string; tag_line: string }

const SEGMENT_ROTATE = [-1.2, 1, -0.8, 1.4, -1, 0.7, -1.4, 1.1]

async function getSegments(): Promise<ApiSegment[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/marketing/segments`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    return await res.json() as ApiSegment[]
  } catch {
    return []
  }
}

function Stage({ card }: { card: FeatureCard }) {
  switch (card.pattern) {
    case 'acumulador':
      return (
        <div className={styles.stageAcumulador} aria-hidden="true">
          <span className={styles.accDot} style={{ animationDelay: '0s', left: '8%' }}>+</span>
          <span className={styles.accDot} style={{ animationDelay: '.5s', left: '42%' }}>+</span>
          <span className={styles.accDot} style={{ animationDelay: '1s', left: '74%' }}>+</span>
        </div>
      )
    case 'flujo':
      return (
        <div className={styles.stageFlujo} aria-hidden="true">
          <span className={`${styles.flowRow} ${styles.flowPos}`}>{card.flujo?.pos}</span>
          <span className={`${styles.flowRow} ${styles.flowNeg}`}>{card.flujo?.neg}</span>
        </div>
      )
    case 'barras':
      return (
        <div className={styles.stageBarras} aria-hidden="true">
          {[0, 1, 2, 3].map(i => (
            <span key={i} className={styles.bar} style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      )
    case 'lineas':
      return (
        <div className={styles.stageLineas} aria-hidden="true">
          {[0, 1, 2].map(i => (
            <span key={i} className={styles.lineTrack}>
              <span className={styles.lineFill} style={{ animationDelay: `${i * 0.35}s` }} />
            </span>
          ))}
        </div>
      )
    case 'pulso':
      return (
        <div className={styles.stagePulso} aria-hidden="true">
          <span className={styles.pulsoDot} />
          <span className={styles.pulsoLabel}>En vivo</span>
        </div>
      )
    case 'giro':
      return (
        <div className={styles.stageGiro} aria-hidden="true">
          <span className={`${styles.giroFace} ${styles.giroFaceA}`}>{card.giroFaces?.[0]}</span>
          <span className={`${styles.giroFace} ${styles.giroFaceB}`}>{card.giroFaces?.[1]}</span>
        </div>
      )
  }
}

export default async function FeatureListBentoSection() {
  const segments = (await getSegments()).slice(0, 8)

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <h2 className={styles.title}>Todo lo que ya no tienes que anotar a mano.</h2>
        <p className={styles.subtitle}>Veinte funciones, un solo sistema.</p>

        <div className={styles.grid}>
          {FEATURES.map((card) => {
            const cardStyle: CSSProperties = {
              gridColumn: `span ${card.colSpan ?? 1}`,
              gridRow: `span ${card.rowSpan ?? 1}`,
            }
            return (
              <div
                key={card.key}
                className={`${styles.card} ${card.color ? styles[`card_${card.color}`] : ''}`}
                style={cardStyle}
              >
                <span className={styles.iconBox}>
                  <card.Icon size={20} aria-hidden="true" />
                </span>
                <h3 className={styles.cardTitle}>{card.title}</h3>
                <p className={styles.cardDesc}>{card.desc}</p>
                {card.descExtra && <p className={styles.cardDescExtra}>{card.descExtra}</p>}
                <Stage card={card} />
              </div>
            )
          })}

          {/* Segmentos -- solo ghost icon girado + nombre, sin animación */}
          {segments.map((seg, i) => (
            <div
              key={seg.slug}
              className={styles.segmentCard}
              style={{ rotate: `${SEGMENT_ROTATE[i % SEGMENT_ROTATE.length]}deg` }}
            >
              <span className={styles.segmentGhost} aria-hidden="true">
                <SegmentIcon slug={seg.slug} size={56} />
              </span>
              <span className={styles.segmentName}>{seg.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
