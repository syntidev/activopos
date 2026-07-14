import {
  ScanBarcode, Boxes, ChartColumn, Store, Users, Wallet, FileText, RotateCcw,
  ShoppingBag, PiggyBank, Activity, TrendingUp, Receipt, FileSpreadsheet,
  ChefHat, Bell, Columns3, Ruler, Palette, Warehouse,
  type LucideIcon,
} from 'lucide-react'
import styles from './FeatureListBentoSection.module.css'

/* Bento-Real-Final: se descarta el scroll horizontal (Correccion-Final-2
   / Fixes-Pendientes-1) -- bento real es una composición FIJA sin
   scroll ni overflow, 20 cards en un grid estático de 6 columnas.
   colSpan/rowSpan vuelven a existir por-card (tabla exacta pedida),
   ya no hay ancho variable cíclico (widthFor) ni duplicación x2. */

type Pattern = 'acumulador' | 'flujo' | 'barras' | 'lineas' | 'pulso' | 'giro'
type CardColor = 'blue' | 'green' | 'purple' | 'amber'
type Size = '2x2' | '2x1' | '1x2' | '1x1'

interface FeatureCard {
  key:      string
  Icon:     LucideIcon
  title:    string
  desc:     string
  descExtra?: string
  pattern:  Pattern
  color?:   CardColor
  size:     Size
  giroFaces?: [string, string]
  flujo?:   { pos: string; neg: string }
}

/* Tabla exacta pedida -- 1×(2x2) + 4×(2x1) + 3×(1x2) + 12×(1x1) =
   4+8+6+12 = 30 celdas = 6 columnas × 5 filas, verificado antes de
   escribir (coincide con el cálculo del propio prompt). */
const FEATURES: FeatureCard[] = [
  {
    key: 'pos', Icon: ScanBarcode, pattern: 'lineas', size: '2x2',
    title: 'Punto de Venta',
    desc: 'Cobra en segundos, en cualquier moneda.',
    descExtra: 'Efectivo, Pago Móvil, Zelle o Binance — como ya te paguen.',
  },
  {
    key: 'catalogo', Icon: Store, pattern: 'acumulador', color: 'purple', size: '2x1',
    title: 'Catálogo Digital',
    desc: 'Tu vitrina, abierta las 24 horas.',
  },
  { key: 'clientes',     Icon: Users,          pattern: 'acumulador', size: '1x1', title: 'Clientes',           desc: 'Quién te debe y cuánto, siempre a la vista.' },
  { key: 'inventario',   Icon: Boxes,          pattern: 'acumulador', size: '1x1', title: 'Inventario',          desc: 'Sabes qué tienes, sin contar a mano.' },
  { key: 'pedidos',      Icon: ShoppingBag,    pattern: 'acumulador', size: '1x1', title: 'Pedidos',             desc: 'Tu cliente arma el pedido, a ti te llega listo.' },
  {
    key: 'finanzas', Icon: PiggyBank, pattern: 'flujo', color: 'green', size: '2x1',
    title: 'Finanzas', desc: 'Lo que entra y lo que sale, siempre claro.',
    flujo: { pos: '+$340.00', neg: '-$128.50' },
  },
  {
    key: 'caja', Icon: Wallet, pattern: 'flujo', color: 'green', size: '1x1',
    title: 'Caja', desc: 'Abre y cierra caja sin cuadrar a ojo.',
    flujo: { pos: '+$92.00', neg: '-$15.00' },
  },
  {
    key: 'devoluciones', Icon: RotateCcw, pattern: 'flujo', size: '1x1',
    title: 'Devoluciones', desc: 'Sin dolores de cabeza cuando algo se devuelve.',
    flujo: { pos: '+1 stock', neg: '-1 venta' },
  },
  { key: 'reportes',     Icon: ChartColumn,    pattern: 'barras', color: 'blue', size: '2x1', title: 'Reportes',         desc: 'Tu negocio en números, cuando quieras verlo.' },
  { key: 'pulso',        Icon: Activity,       pattern: 'barras',                size: '2x1', title: 'Pulso del Negocio', desc: 'Cómo va tu negocio, de un vistazo.' },
  { key: 'margen',       Icon: TrendingUp,     pattern: 'barras',                size: '1x1', title: 'Margen y Utilidad', desc: 'Cuánto ganaste de verdad, en cada venta.' },
  { key: 'ticket',       Icon: Receipt,        pattern: 'lineas',                size: '1x1', title: 'Emisión de Ticket', desc: 'Tu ticket térmico, listo al instante.' },
  { key: 'cotizaciones', Icon: FileText,       pattern: 'lineas',                size: '1x1', title: 'Cotizaciones',      desc: 'Manda un presupuesto en un clic.' },
  { key: 'facturas',     Icon: FileSpreadsheet,pattern: 'lineas',                size: '1x1', title: 'Facturas',         desc: 'Tu factura, sin pelear con el Excel.' },
  { key: 'kds',          Icon: ChefHat,        pattern: 'pulso',                 size: '1x2', title: 'KDS Cocina',       desc: 'Tu cocina ve el pedido, sin gritar de un lado a otro.' },
  { key: 'notificaciones', Icon: Bell,         pattern: 'pulso',                 size: '1x1', title: 'Notificaciones',   desc: 'Te avisa antes de que se te olvide.' },
  { key: 'kanban',       Icon: Columns3,       pattern: 'pulso',                 size: '1x1', title: 'Pedidos Kanban',   desc: 'Cada pedido, en su columna, sin perderlo de vista.' },
  {
    key: 'variantes', Icon: Ruler, pattern: 'giro', size: '1x1',
    title: 'Variantes', desc: 'Talla, color o medida — como realmente vendes.',
    giroFaces: ['Talla M', 'Talla L'],
  },
  {
    key: 'multitema', Icon: Palette, pattern: 'giro', size: '1x2',
    title: 'Multi-tema', desc: 'Tu negocio, con la cara que tú quieras.',
    giroFaces: ['Tema Azul', 'Tema Verde'],
  },
  {
    key: 'mayorista', Icon: Warehouse, pattern: 'giro', color: 'amber', size: '1x2',
    title: 'Precio Mayorista', desc: 'Un precio para el cliente, otro para el mayorista.',
    giroFaces: ['$10.00', '$8.00'],
  },
]

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

function FeatureCardEl({ card }: { card: FeatureCard }) {
  return (
    <div
      className={[
        styles.card,
        styles[`size${card.size}`],
        card.color ? styles[`card_${card.color}`] : '',
      ].filter(Boolean).join(' ')}
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

        <div className={styles.grid}>
          {FEATURES.map(card => (
            <FeatureCardEl key={card.key} card={card} />
          ))}
        </div>
      </div>
    </section>
  )
}
