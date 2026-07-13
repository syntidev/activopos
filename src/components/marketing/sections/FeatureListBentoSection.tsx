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
  big?:  boolean
}

/* Las 2 primeras (big:true) van span 2 -- mismo orden en que se listan
   en el prompt, produce el layout pedido sin necesitar grid-auto-flow:
   dense (fila 1 = las 2 grandes llenando las 4 columnas, filas 2-3 =
   las 6 compactas). */
const FEATURES: FeatureCard[] = [
  {
    key: 'pos', Icon: ScanBarcode, big: true,
    title: 'Punto de Venta',
    desc: 'Cobra en segundos, en cualquier moneda.',
    descExtra: 'Efectivo, Pago Móvil, Zelle o Binance — como ya te paguen.',
  },
  {
    key: 'inventario', Icon: Boxes, big: true,
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
          {FEATURES.map(({ key, Icon, title, desc, descExtra, big }) => (
            <div key={key} className={`${styles.card} ${big ? styles.cardBig : ''}`}>
              <span className={styles.iconBox}>
                <Icon size={20} color="#0038BD" aria-hidden="true" />
              </span>
              <h3 className={styles.cardTitle}>{title}</h3>
              <p className={styles.cardDesc}>{desc}</p>
              {big && descExtra && <p className={styles.cardDescExtra}>{descExtra}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
