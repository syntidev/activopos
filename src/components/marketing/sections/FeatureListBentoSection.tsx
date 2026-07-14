import {
  ScanBarcode, Boxes, ChartColumn, Store, Users, Wallet, FileText, RotateCcw,
  ShoppingBag, PiggyBank, Activity, TrendingUp, Receipt, FileSpreadsheet,
  ChefHat, Bell, Columns3, Ruler, Palette, Warehouse,
  type LucideIcon,
} from 'lucide-react'
import styles from './FeatureListBentoSection.module.css'

/* Solo-Horizontal-Final: CERO verticalidad -- se quita por completo el
   grid-row:span 2 (columnas "tipo A" de Muro-Anchos-Exactos). Cada card
   ocupa EXACTAMENTE 1 fila. La asimetría ahora viene solo del ANCHO
   (3 valores: 150/190/240px), no del alto.

   Estructura: 2 FILAS independientes (flex, no CSS Grid) -- cada fila es
   su propia cinta horizontal con su propio scroll infinito (mismo
   técnica que FeatureMarquee.tsx: contenido duplicado x2, translateX
   (-50%) mueve exactamente una copia). Al ser 2 flex-rows independientes
   -- no un grid compartido -- las cards de arriba y abajo NUNCA
   necesitan alinear columna, tal como pide el prompt ("Forbes abajo más
   ancha que las 2 de arriba"). Esto también evita el problema de tener
   que igualar el ancho total de ambas filas para que el loop cierre
   parejo: cada fila calcula su propio translateX(-50%) sobre SU PROPIO
   ancho doblado, sin depender de la otra. */

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

const FEATURES: FeatureCard[] = [
  {
    key: 'pos', Icon: ScanBarcode, pattern: 'lineas',
    title: 'Punto de Venta',
    desc: 'Cobra en segundos, en cualquier moneda.',
    descExtra: 'Efectivo, Pago Móvil, Zelle o Binance — como ya te paguen.',
  },
  {
    key: 'finanzas', Icon: PiggyBank, pattern: 'flujo', color: 'green',
    title: 'Finanzas', desc: 'Lo que entra y lo que sale, siempre claro.',
    flujo: { pos: '+$340.00', neg: '-$128.50' },
  },
  { key: 'pulso', Icon: Activity, pattern: 'barras', title: 'Pulso del Negocio', desc: 'Cómo va tu negocio, de un vistazo.' },
  {
    key: 'mayorista', Icon: Warehouse, pattern: 'giro', color: 'amber',
    title: 'Precio Mayorista', desc: 'Un precio para el cliente, otro para el mayorista.',
    giroFaces: ['$10.00', '$8.00'],
  },
  { key: 'catalogo', Icon: Store, pattern: 'acumulador', color: 'purple', title: 'Catálogo Digital', desc: 'Tu vitrina, abierta las 24 horas.' },
  {
    key: 'multitema', Icon: Palette, pattern: 'giro',
    title: 'Multi-tema', desc: 'Tu negocio, con la cara que tú quieras.',
    giroFaces: ['Tema Azul', 'Tema Verde'],
  },
  { key: 'inventario', Icon: Boxes, pattern: 'acumulador', title: 'Inventario', desc: 'Sabes qué tienes, sin contar a mano.' },
  { key: 'clientes',   Icon: Users, pattern: 'acumulador', title: 'Clientes',   desc: 'Quién te debe y cuánto, siempre a la vista.' },
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
  { key: 'reportes', Icon: ChartColumn, pattern: 'barras', color: 'blue', title: 'Reportes',         desc: 'Tu negocio en números, cuando quieras verlo.' },
  { key: 'margen',   Icon: TrendingUp,  pattern: 'barras',                title: 'Margen y Utilidad', desc: 'Cuánto ganaste de verdad, en cada venta.' },
  { key: 'ticket',       Icon: Receipt,        pattern: 'lineas', title: 'Emisión de Ticket', desc: 'Tu ticket térmico, listo al instante.' },
  { key: 'cotizaciones', Icon: FileText,       pattern: 'lineas', title: 'Cotizaciones',      desc: 'Manda un presupuesto en un clic.' },
  { key: 'facturas',       Icon: FileSpreadsheet, pattern: 'lineas', title: 'Facturas',       desc: 'Tu factura, sin pelear con el Excel.' },
  { key: 'notificaciones', Icon: Bell,            pattern: 'pulso',  title: 'Notificaciones', desc: 'Te avisa antes de que se te olvide.' },
  { key: 'kds',    Icon: ChefHat,  pattern: 'pulso', title: 'KDS Cocina',     desc: 'Tu cocina ve el pedido, sin gritar de un lado a otro.' },
  { key: 'kanban', Icon: Columns3, pattern: 'pulso', title: 'Pedidos Kanban', desc: 'Cada pedido, en su columna, sin perderlo de vista.' },
  { key: 'pedidos', Icon: ShoppingBag, pattern: 'acumulador', title: 'Pedidos', desc: 'Tu cliente arma el pedido, a ti te llega listo.' },
  {
    key: 'variantes', Icon: Ruler, pattern: 'giro',
    title: 'Variantes', desc: 'Talla, color o medida — como realmente vendes.',
    giroFaces: ['Talla M', 'Talla L'],
  },
]

/* 2 filas de 10 -- primera mitad del array arriba, segunda mitad abajo */
const ROW1 = FEATURES.slice(0, 10)
const ROW2 = FEATURES.slice(10, 20)

/* 3 anchos únicos (150/190/240), cíclicos con offset distinto por fila
   para que ni las vecinas de una misma fila, ni las cards en la misma
   posición horizontal entre fila 1 y 2, coincidan casi nunca. */
const WIDTHS = [150, 190, 240]
function widthFor(indexInRow: number, rowOffset: number): number {
  return WIDTHS[(indexInRow + rowOffset) % WIDTHS.length]
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

/* Icono-Flotante-Final: el ícono sale del flujo vertical (position:
   absolute, esquina superior derecha, ver .module.css .iconBox) --
   ya no consume su propia fila, libera espacio real para texto+Stage
   en las cards de 130px. overflow:hidden real por card, título 1
   línea (nowrap+ellipsis), descripción 2 líneas (line-clamp) siguen
   sin cambios -- ningún texto puede desbordar su propia card. */
function FeatureCardEl({ card, width }: { card: FeatureCard; width: number }) {
  return (
    <div
      className={`${styles.card} ${card.color ? styles[`card_${card.color}`] : ''}`}
      style={{ width: `${width}px` }}
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

function FeatureRow({ cards, rowOffset }: { cards: FeatureCard[]; rowOffset: number }) {
  return (
    <div className={styles.scrollWrap}>
      <div className={styles.scrollRow}>
        {(['a', 'b'] as const).map(copyKey => (
          cards.map((card, i) => (
            <FeatureCardEl
              key={`${copyKey}-${card.key}`}
              card={card}
              width={widthFor(i, rowOffset)}
            />
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
          <FeatureRow cards={ROW1} rowOffset={0} />
          <FeatureRow cards={ROW2} rowOffset={1} />
        </div>
      </div>
    </section>
  )
}
