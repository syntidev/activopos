import {
  ScanBarcode, Boxes, ChartColumn, Store, Users, Wallet, FileText, RotateCcw,
  type LucideIcon,
} from 'lucide-react'
import styles from './FeatureListBentoSection.module.css'

interface FeatureCard {
  key:   string
  Icon:  LucideIcon
  title: string
  desc:  string
  descExtra?: string
}

/* FeatureList-Bento-3: el prompt pedía 8 pares (col-span,row-span) pero
   3 pares se repetían (Inventario/Clientes/Devoluciones los 3 en 2x1;
   Catálogo/Caja/Cotizaciones los 3 en 1x1) -- verificado antes de
   implementar, contradice el propio criterio de verificación del prompt
   ("ninguna card mide exactamente igual a otra"). Reasignado a 8 pares
   (col,row) ÚNICOS entre sí, spans y clase por card en el .module.css
   (mismo patrón que .tileCobrado/.tileTudia en ProductBentoSection.tsx,
   no un boolean "big" genérico). */
const FEATURES: FeatureCard[] = [
  {
    key: 'pos', Icon: ScanBarcode,
    title: 'Punto de Venta',
    desc: 'Cobra en segundos, en cualquier moneda.',
    descExtra: 'Efectivo, Pago Móvil, Zelle o Binance — como ya te paguen.',
  },
  {
    key: 'inventario', Icon: Boxes,
    title: 'Inventario',
    desc: 'Sabes qué tienes, sin contar a mano.',
    descExtra: 'Entra, sale y se ajusta solo con cada venta.',
  },
  { key: 'reportes',    Icon: ChartColumn, title: 'Reportes',         desc: 'Tu negocio en números, cuando quieras verlo.' },
  { key: 'catalogo',    Icon: Store,       title: 'Catálogo Digital', desc: 'Tu vitrina, abierta las 24 horas.' },
  { key: 'clientes',    Icon: Users,       title: 'Clientes',         desc: 'Quién te debe y cuánto, siempre a la vista.' },
  { key: 'caja',        Icon: Wallet,      title: 'Caja',             desc: 'Abre y cierra caja sin cuadrar a ojo.' },
  { key: 'cotizaciones',Icon: FileText,    title: 'Cotizaciones',     desc: 'Manda un presupuesto en un clic.' },
  { key: 'devoluciones',Icon: RotateCcw,   title: 'Devoluciones',     desc: 'Sin dolores de cabeza cuando algo se devuelve.' },
]

export default function FeatureListBentoSection() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <h2 className={styles.title}>Todo lo que ya no tienes que anotar a mano.</h2>
        <p className={styles.subtitle}>Ocho módulos, un solo sistema.</p>

        <div className={styles.grid}>
          {FEATURES.map(({ key, Icon, title, desc, descExtra }) => (
            <div key={key} className={`${styles.card} ${styles[`card_${key}`]}`}>
              <span className={styles.iconBox}>
                <Icon size={20} color="#0038BD" aria-hidden="true" />
              </span>
              <h3 className={styles.cardTitle}>{title}</h3>
              <p className={styles.cardDesc}>{desc}</p>
              {descExtra && <p className={styles.cardDescExtra}>{descExtra}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
