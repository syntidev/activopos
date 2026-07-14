import {
  ScanBarcode, Boxes, ChartColumn, Store, Users, Wallet, FileText, RotateCcw,
  ShoppingBag, PiggyBank, Activity, TrendingUp, Receipt, FileSpreadsheet,
  ChefHat, Bell, Columns3, Ruler, Palette, Warehouse,
  type LucideIcon,
} from 'lucide-react'
import styles from './FeatureListBentoSection.module.css'

/* Correccion-Final-2: sacados los segmentos que se habían colado acá
   (fetch/render de SegmentsSection duplicado -- reportado, confirmado
   y eliminado). Esta sección queda EXCLUSIVAMENTE con las 20 cards de
   función. SegmentsSection.tsx sigue existiendo aparte, sin tocar.
   Layout: scroll horizontal infinito (antes grid estático) -- ver
   .module.css .scrollTrack. colSpan/rowSpan por-card ya no aplican.
   Ajustes-Puntuales-1: se quitó también el patrón "1 tall + 2
   apiladas" (forma de "edificio") -- todas las cards a la misma
   altura ahora, solo varía el ancho (widthFor). */

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
  giroFaces?: [string, string]
  flujo?:   { pos: string; neg: string }
}

/* Los 18 nombres y su patrón vienen literal de TAREA 5. Punto de Venta y
   Catálogo Digital no estaban en esa lista (son las 2 cards que ya
   existían en el sprint anterior) -- se les asignó el patrón más afín
   ("no literal 1 a 1", tal como pide el propio brief). */
const FEATURES: FeatureCard[] = [
  {
    key: 'pos', Icon: ScanBarcode, pattern: 'lineas',
    title: 'Punto de Venta',
    desc: 'Cobra en segundos, en cualquier moneda.',
    descExtra: 'Efectivo, Pago Móvil, Zelle o Binance — como ya te paguen.',
  },
  {
    key: 'catalogo', Icon: Store, pattern: 'acumulador', color: 'purple',
    title: 'Catálogo Digital',
    desc: 'Tu vitrina, abierta las 24 horas.',
  },
  { key: 'clientes',     Icon: Users,          pattern: 'acumulador', title: 'Clientes',           desc: 'Quién te debe y cuánto, siempre a la vista.' },
  { key: 'inventario',   Icon: Boxes,          pattern: 'acumulador', title: 'Inventario',          desc: 'Sabes qué tienes, sin contar a mano.' },
  { key: 'pedidos',      Icon: ShoppingBag,    pattern: 'acumulador', title: 'Pedidos',             desc: 'Tu cliente arma el pedido, a ti te llega listo.' },
  {
    key: 'finanzas', Icon: PiggyBank, pattern: 'flujo', color: 'green',
    title: 'Finanzas', desc: 'Lo que entra y lo que sale, siempre claro.',
    flujo: { pos: '+$340.00', neg: '-$128.50' },
  },
  {
    key: 'caja', Icon: Wallet, pattern: 'flujo', color: 'green',
    title: 'Caja', desc: 'Abre y cierra caja sin cuadrar a ojo.',
    flujo: { pos: '+$92.00', neg: '-$15.00' },
  },
  {
    key: 'devoluciones', Icon: RotateCcw, pattern: 'flujo',
    title: 'Devoluciones', desc: 'Sin dolores de cabeza cuando algo se devuelve.',
    flujo: { pos: '+1 stock', neg: '-1 venta' },
  },
  { key: 'reportes',     Icon: ChartColumn,    pattern: 'barras', color: 'blue', title: 'Reportes',         desc: 'Tu negocio en números, cuando quieras verlo.' },
  { key: 'pulso',        Icon: Activity,       pattern: 'barras',                title: 'Pulso del Negocio', desc: 'Cómo va tu negocio, de un vistazo.' },
  { key: 'margen',       Icon: TrendingUp,     pattern: 'barras',                title: 'Margen y Utilidad', desc: 'Cuánto ganaste de verdad, en cada venta.' },
  { key: 'ticket',       Icon: Receipt,        pattern: 'lineas',                title: 'Emisión de Ticket', desc: 'Tu ticket térmico, listo al instante.' },
  { key: 'cotizaciones', Icon: FileText,       pattern: 'lineas',                title: 'Cotizaciones',      desc: 'Manda un presupuesto en un clic.' },
  { key: 'facturas',     Icon: FileSpreadsheet,pattern: 'lineas',                title: 'Facturas',         desc: 'Tu factura, sin pelear con el Excel.' },
  { key: 'kds',          Icon: ChefHat,        pattern: 'pulso',                 title: 'KDS Cocina',       desc: 'Tu cocina ve el pedido, sin gritar de un lado a otro.' },
  { key: 'notificaciones', Icon: Bell,         pattern: 'pulso',                 title: 'Notificaciones',   desc: 'Te avisa antes de que se te olvide.' },
  { key: 'kanban',       Icon: Columns3,       pattern: 'pulso',                 title: 'Pedidos Kanban',   desc: 'Cada pedido, en su columna, sin perderlo de vista.' },
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

/* Ajustes-Puntuales-1: se quitó el patrón "1 tall + 2 apiladas" (forma
   de "edificio") -- todas las cards a la MISMA altura ahora, solo varía
   el ANCHO. Ver .module.css .scrollTrack (align-items:stretch iguala
   la altura al elemento más alto de la fila, sin fijar un valor a mano). */

/* Ancho variable 150-220px por card, cíclico sobre el índice global
   (no aleatorio -- reproducible, sin layout shift entre renders) */
const WIDTHS = [160, 190, 220, 175, 205]
function widthFor(globalIndex: number): number {
  return WIDTHS[globalIndex % WIDTHS.length]
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

function FeatureCardEl({ card, globalIndex }: { card: FeatureCard; globalIndex: number }) {
  return (
    <div
      className={`${styles.card} ${card.color ? styles[`card_${card.color}`] : ''}`}
      style={{ width: `${widthFor(globalIndex)}px` }}
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
}

export default function FeatureListBentoSection() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <h2 className={styles.title}>Todo lo que ya no tienes que anotar a mano.</h2>
        <p className={styles.subtitle}>Veinte funciones, un solo sistema.</p>

        <div className={styles.scrollWrap}>
          <div className={styles.scrollTrack}>
            {(['a', 'b'] as const).map(copyKey => (
              FEATURES.map((card, i) => (
                <FeatureCardEl key={`${copyKey}-${card.key}`} card={card} globalIndex={i} />
              ))
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
