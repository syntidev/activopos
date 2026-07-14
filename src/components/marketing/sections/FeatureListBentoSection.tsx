import {
  ScanBarcode, Boxes, ChartColumn, Store, Users, Wallet, FileText, RotateCcw,
  ShoppingBag, PiggyBank, Activity, TrendingUp, Receipt, FileSpreadsheet,
  ChefHat, Bell, Columns3, Ruler, Palette, Warehouse,
  type LucideIcon,
} from 'lucide-react'
import styles from './FeatureListBentoSection.module.css'

/* Muro-Anchos-Exactos: vuelve al modelo de columnas de Fixes-Pendientes-1
   (grid-auto-flow:column + scroll infinito) -- Bento-Real-Final lo había
   descartado por un grid de spans fijo sin scroll, pero ESTE prompt
   corrige justo el defecto del modelo de columnas (anchos "150-220px
   variable" cíclicos) que Bento-Real-Final ya no tenía. Confirmado con
   el usuario antes de reconstruir (dos modelos distintos, se eligió
   este). Solo 2 anchos posibles ahora: 170px o 220px, sin ciclo, según
   la tabla exacta pedida -- no una variación "decidida" por card. */

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
  colWidth: 170 | 220
  rowSpan:  1 | 2
  giroFaces?: [string, string]
  flujo?:   { pos: string; neg: string }
}

/* Orden EXACTO pedido -- las columnas tipo B (rowSpan:1) deben aparecer
   en pares consecutivos en el DOM para que grid-auto-flow:column las
   agrupe en la MISMA columna (2 filas de 130px cada una); las tipo A
   (rowSpan:2) ocupan su propia columna completa. 6 columnas A + 7
   columnas B = 13 columnas, 20 funciones -- verificado antes de
   escribir, coincide con el cálculo del propio prompt. */
const FEATURES: FeatureCard[] = [
  // -- 4 columnas tipo A, 220px --
  {
    key: 'pos', Icon: ScanBarcode, pattern: 'lineas', colWidth: 220, rowSpan: 2,
    title: 'Punto de Venta',
    desc: 'Cobra en segundos, en cualquier moneda.',
    descExtra: 'Efectivo, Pago Móvil, Zelle o Binance — como ya te paguen.',
  },
  {
    key: 'finanzas', Icon: PiggyBank, pattern: 'flujo', color: 'green', colWidth: 220, rowSpan: 2,
    title: 'Finanzas', desc: 'Lo que entra y lo que sale, siempre claro.',
    flujo: { pos: '+$340.00', neg: '-$128.50' },
  },
  { key: 'pulso',    Icon: Activity,  pattern: 'barras', colWidth: 220, rowSpan: 2, title: 'Pulso del Negocio', desc: 'Cómo va tu negocio, de un vistazo.' },
  {
    key: 'mayorista', Icon: Warehouse, pattern: 'giro', color: 'amber', colWidth: 220, rowSpan: 2,
    title: 'Precio Mayorista', desc: 'Un precio para el cliente, otro para el mayorista.',
    giroFaces: ['$10.00', '$8.00'],
  },
  // -- 2 columnas tipo A, 170px --
  {
    key: 'catalogo', Icon: Store, pattern: 'acumulador', color: 'purple', colWidth: 170, rowSpan: 2,
    title: 'Catálogo Digital',
    desc: 'Tu vitrina, abierta las 24 horas.',
  },
  {
    key: 'multitema', Icon: Palette, pattern: 'giro', colWidth: 170, rowSpan: 2,
    title: 'Multi-tema', desc: 'Tu negocio, con la cara que tú quieras.',
    giroFaces: ['Tema Azul', 'Tema Verde'],
  },
  // -- 5 columnas tipo B, 170px (pares consecutivos) --
  { key: 'inventario',   Icon: Boxes,    pattern: 'acumulador', colWidth: 170, rowSpan: 1, title: 'Inventario', desc: 'Sabes qué tienes, sin contar a mano.' },
  { key: 'clientes',     Icon: Users,    pattern: 'acumulador', colWidth: 170, rowSpan: 1, title: 'Clientes',   desc: 'Quién te debe y cuánto, siempre a la vista.' },
  {
    key: 'caja', Icon: Wallet, pattern: 'flujo', color: 'green', colWidth: 170, rowSpan: 1,
    title: 'Caja', desc: 'Abre y cierra caja sin cuadrar a ojo.',
    flujo: { pos: '+$92.00', neg: '-$15.00' },
  },
  {
    key: 'devoluciones', Icon: RotateCcw, pattern: 'flujo', colWidth: 170, rowSpan: 1,
    title: 'Devoluciones', desc: 'Sin dolores de cabeza cuando algo se devuelve.',
    flujo: { pos: '+1 stock', neg: '-1 venta' },
  },
  { key: 'reportes', Icon: ChartColumn, pattern: 'barras', color: 'blue', colWidth: 170, rowSpan: 1, title: 'Reportes',         desc: 'Tu negocio en números, cuando quieras verlo.' },
  { key: 'margen',   Icon: TrendingUp,  pattern: 'barras',                colWidth: 170, rowSpan: 1, title: 'Margen y Utilidad', desc: 'Cuánto ganaste de verdad, en cada venta.' },
  { key: 'ticket',       Icon: Receipt,        pattern: 'lineas', colWidth: 170, rowSpan: 1, title: 'Emisión de Ticket', desc: 'Tu ticket térmico, listo al instante.' },
  { key: 'cotizaciones', Icon: FileText,       pattern: 'lineas', colWidth: 170, rowSpan: 1, title: 'Cotizaciones',      desc: 'Manda un presupuesto en un clic.' },
  { key: 'facturas',       Icon: FileSpreadsheet, pattern: 'lineas', colWidth: 170, rowSpan: 1, title: 'Facturas',       desc: 'Tu factura, sin pelear con el Excel.' },
  { key: 'notificaciones', Icon: Bell,            pattern: 'pulso',  colWidth: 170, rowSpan: 1, title: 'Notificaciones', desc: 'Te avisa antes de que se te olvide.' },
  // -- 2 columnas tipo B, 170px (pares consecutivos) --
  { key: 'kds',    Icon: ChefHat,  pattern: 'pulso', colWidth: 170, rowSpan: 1, title: 'KDS Cocina',     desc: 'Tu cocina ve el pedido, sin gritar de un lado a otro.' },
  { key: 'kanban', Icon: Columns3, pattern: 'pulso', colWidth: 170, rowSpan: 1, title: 'Pedidos Kanban', desc: 'Cada pedido, en su columna, sin perderlo de vista.' },
  { key: 'pedidos', Icon: ShoppingBag, pattern: 'acumulador', colWidth: 170, rowSpan: 1, title: 'Pedidos', desc: 'Tu cliente arma el pedido, a ti te llega listo.' },
  {
    key: 'variantes', Icon: Ruler, pattern: 'giro', colWidth: 170, rowSpan: 1,
    title: 'Variantes', desc: 'Talla, color o medida — como realmente vendes.',
    giroFaces: ['Talla M', 'Talla L'],
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
      className={`${styles.card} ${card.color ? styles[`card_${card.color}`] : ''}`}
      style={{ width: `${card.colWidth}px`, gridRow: `span ${card.rowSpan}` }}
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
              FEATURES.map(card => (
                <FeatureCardEl key={`${copyKey}-${card.key}`} card={card} />
              ))
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
