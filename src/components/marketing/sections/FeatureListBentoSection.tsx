import {
  ScanBarcode, Boxes, ChartColumn, Store, Users, Wallet, FileText, RotateCcw,
  ShoppingBag, PiggyBank, Activity, TrendingUp, Receipt, FileSpreadsheet,
  ChefHat, Bell, Columns3, Ruler, Palette, Warehouse,
  type LucideIcon,
} from 'lucide-react'
import styles from './FeatureListBentoSection.module.css'

/* Bento por CONTENIDO (no por posición). Regla (criterio de Carlos): "cards
   desiguales, dos tamaños... si el contenido de la card es demasiado, no lo
   pongas en una card cuadrada; y no pongas una rectangular con una línea de
   texto. Rectangular es HORIZONTAL. Las 2 filas son de la MISMA altura."

   size lo decide el CONTENIDO REAL de cada card, no un heurístico ciego:
   - 'rect' (horizontal, ancho): contenido pesado -- descExtra (2 párrafos),
     valores del stage (flujo +/-, líneas de progreso) o desc largo (≥45 ch)
     que en cuadrado se cortaría o quedaría de 3 líneas.
   - 'sq'   (cuadrado): desc corto (≤44 ch) con stage compacto (barras, dot
     "en vivo", giro, acumulador) que respira en un cuadrado sin sobrar.

   Alto FIJO idéntico para las 20 (ver .card en el CSS) -> ambas filas miden
   exactamente lo mismo, cero disparidad de alturas. El array va reordenado
   R,S,R,S por fila para el ritmo del bento (no cambia ninguna función, solo
   el orden visual). */

type Pattern = 'acumulador' | 'flujo' | 'barras' | 'lineas' | 'pulso' | 'giro'
type CardColor = 'blue' | 'green' | 'brandDark' | 'brandSoft'
type CardSize = 'sq' | 'rect'

interface FeatureCard {
  key:      string
  Icon:     LucideIcon
  title:    string
  desc:     string
  descExtra?: string
  pattern:  Pattern
  size:     CardSize
  color?:   CardColor
  giroFaces?: [string, string]
  flujo?:   { pos: string; neg: string }
}

/* ── Fila 1 -- alterna rect/cuadrado ── */
const ROW1: FeatureCard[] = [
  {
    key: 'pos', Icon: ScanBarcode, pattern: 'lineas', size: 'rect',
    title: 'Punto de Venta',
    desc: 'Cobra en segundos, en cualquier moneda.',
    descExtra: 'Efectivo, Pago Móvil, Zelle o Binance — como ya te paguen.',
  },
  { key: 'pulso', Icon: Activity, pattern: 'barras', size: 'sq', title: 'Pulso del Negocio', desc: 'Cómo va tu negocio, de un vistazo.' },
  {
    key: 'finanzas', Icon: PiggyBank, pattern: 'flujo', color: 'green', size: 'rect',
    title: 'Finanzas', desc: 'Lo que entra y lo que sale, siempre claro.',
    flujo: { pos: '+$340.00', neg: '-$128.50' },
  },
  { key: 'catalogo', Icon: Store, pattern: 'acumulador', color: 'brandDark', size: 'sq', title: 'Catálogo Digital', desc: 'Tu vitrina, abierta las 24 horas.' },
  {
    key: 'mayorista', Icon: Warehouse, pattern: 'giro', color: 'brandSoft', size: 'rect',
    title: 'Precio Mayorista', desc: 'Un precio para el cliente, otro para el mayorista.',
    giroFaces: ['$10.00', '$8.00'],
  },
  { key: 'inventario', Icon: Boxes, pattern: 'acumulador', size: 'sq', title: 'Inventario', desc: 'Sabes qué tienes, sin contar a mano.' },
  {
    key: 'caja', Icon: Wallet, pattern: 'flujo', color: 'green', size: 'rect',
    title: 'Caja', desc: 'Abre y cierra caja sin cuadrar a ojo.',
    flujo: { pos: '+$92.00', neg: '-$15.00' },
  },
  { key: 'clientes', Icon: Users, pattern: 'acumulador', size: 'sq', title: 'Clientes', desc: 'Quién te debe y cuánto, siempre a la vista.' },
  {
    key: 'devoluciones', Icon: RotateCcw, pattern: 'flujo', size: 'rect',
    title: 'Devoluciones', desc: 'Sin dolores de cabeza cuando algo se devuelve.',
    flujo: { pos: '+1 stock', neg: '-1 venta' },
  },
  { key: 'margen', Icon: TrendingUp, pattern: 'barras', size: 'sq', title: 'Margen y Utilidad', desc: 'Cuánto ganaste de verdad, en cada venta.' },
]

/* ── Fila 2 -- alterna rect/cuadrado ── */
const ROW2: FeatureCard[] = [
  { key: 'ticket', Icon: Receipt, pattern: 'lineas', size: 'rect', title: 'Emisión de Ticket', desc: 'Tu ticket térmico, listo al instante.' },
  { key: 'notificaciones', Icon: Bell, pattern: 'pulso', size: 'sq', title: 'Notificaciones', desc: 'Te avisa antes de que se te olvide.' },
  { key: 'cotizaciones', Icon: FileText, pattern: 'lineas', size: 'rect', title: 'Cotizaciones', desc: 'Manda un presupuesto en un clic.' },
  { key: 'reportes', Icon: ChartColumn, pattern: 'barras', color: 'blue', size: 'sq', title: 'Reportes', desc: 'Tu negocio en números, cuando quieras verlo.' },
  { key: 'facturas', Icon: FileSpreadsheet, pattern: 'lineas', size: 'rect', title: 'Facturas', desc: 'Tu factura, sin pelear con el Excel.' },
  {
    key: 'variantes', Icon: Ruler, pattern: 'giro', size: 'sq',
    title: 'Variantes', desc: 'Talla, color o medida — como realmente vendes.',
    giroFaces: ['Talla M', 'Talla L'],
  },
  { key: 'kds', Icon: ChefHat, pattern: 'pulso', size: 'rect', title: 'KDS Cocina', desc: 'Tu cocina ve el pedido, sin gritar de un lado a otro.' },
  { key: 'pedidos', Icon: ShoppingBag, pattern: 'acumulador', size: 'sq', title: 'Pedidos', desc: 'Tu cliente arma el pedido, a ti te llega listo.' },
  { key: 'kanban', Icon: Columns3, pattern: 'pulso', size: 'rect', title: 'Pedidos Kanban', desc: 'Cada pedido, en su columna, sin perderlo de vista.' },
  {
    key: 'multitema', Icon: Palette, pattern: 'giro', size: 'sq',
    title: 'Multi-tema', desc: 'Tu negocio, con la cara que tú quieras.',
    giroFaces: ['Tema Azul', 'Tema Verde'],
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

/* Icono-Fondo-Segmentos: el ícono flotante (40x40, esquina superior
   derecha) generaba conflicto recurrente con el título pese a los 2
   intentos previos de ajustarle el despeje -- se reemplaza por el
   MISMO patrón de ícono fantasma ya usado en SegmentsSection.tsx/
   .module.css (.ghostIcon: grande, opacity baja, position:absolute
   en la esquina, pointer-events:none, detrás del texto en vez de
   compitiendo por espacio con él). Título y descripción ya no
   reservan padding-right artificial -- usan el ancho completo de la
   card, overflow:hidden real por card sigue sin cambios. */
function FeatureCardEl({ card }: { card: FeatureCard }) {
  return (
    <div
      className={`${styles.card} ${styles[`size_${card.size}`]} ${card.color ? styles[`card_${card.color}`] : ''}`}
    >
      <span className={styles.ghostIcon} aria-hidden="true">
        <card.Icon size={72} />
      </span>
      {/* .cardHead arriba, Stage abajo (card usa justify-content:space-between)
          -> el contenido llena el alto fijo sin hueco vacío ni texto cortado. */}
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{card.title}</h3>
        <p className={styles.cardDesc}>{card.desc}</p>
        {card.descExtra && <p className={styles.cardDescExtra}>{card.descExtra}</p>}
      </div>
      <Stage card={card} />
    </div>
  )
}

function FeatureRow({ cards }: { cards: FeatureCard[] }) {
  return (
    <div className={styles.scrollWrap}>
      <div className={styles.scrollRow}>
        {(['a', 'b'] as const).map(copyKey => (
          cards.map(card => (
            <FeatureCardEl key={`${copyKey}-${card.key}`} card={card} />
          ))
        ))}
      </div>
    </div>
  )
}

export default function FeatureListBentoSection() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <h2 className={styles.title}>Todo lo que ya no tienes que anotar a mano.</h2>
        <p className={styles.subtitle}>Veinte funciones, un solo sistema.</p>

        <div className={styles.scrollTrack}>
          <FeatureRow cards={ROW1} />
          <FeatureRow cards={ROW2} />
        </div>
      </div>
    </section>
  )
}
