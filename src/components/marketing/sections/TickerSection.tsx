import {
  CheckCircle, Smartphone, Layers, Globe, Briefcase,
  ShoppingBag, Truck, QrCode, BarChart2, Package, Zap,
} from 'lucide-react'
import styles from './TickerSection.module.css'

const ITEMS = [
  { icon: CheckCircle, text: 'BCV automático en cada cobro' },
  { icon: Smartphone, text: 'Pago Móvil nativo' },
  { icon: Layers, text: 'Tallas · kg · litros · horas · metros' },
  { icon: Globe, text: 'Catálogo digital 24/7' },
  { icon: Briefcase, text: 'Cotización de servicios integrada' },
  { icon: ShoppingBag, text: 'Pedidos por WhatsApp' },
  { icon: Truck, text: 'Delivery con zonas configurables' },
  { icon: QrCode, text: 'QR propio de tu catálogo' },
  { icon: BarChart2, text: 'Reportes en tiempo real' },
  { icon: Package, text: 'Módulo Fábrica: combos y recetas' },
  { icon: Zap, text: 'Sin instalación · corre en el navegador' },
]

export default function TickerSection() {
  const doubled = [...ITEMS, ...ITEMS]

  return (
    <div className={styles.wrap}>
      <div className={styles.track} aria-hidden>
        {doubled.map(({ icon: Icon, text }, i) => (
          <span key={i} className={styles.item}>
            <Icon size={12} aria-hidden="true" />
            {text}
            <span className={styles.sep} aria-hidden="true">·</span>
          </span>
        ))}
      </div>
    </div>
  )
}
