import {
  Beef, Utensils, Hammer, Pill, Shirt, ShoppingBasket,
  Smartphone, Wrench, Briefcase, Package, type LucideIcon,
} from 'lucide-react'
import styles from './SegmentIcon.module.css'

// Ícono por segmento real (slug de Segment) — no por theme_key, porque
// theme_key se comparte entre negocios distintos (ferreterias/repuestos
// ambos "ferreteria") y necesitan verse visualmente diferentes.
const ICONS: Record<string, LucideIcon> = {
  carniceria:     Beef,
  restaurante:    Utensils,
  ferreterias:    Hammer,
  farmacias:      Pill,
  'tiendas-ropa': Shirt,
  abastos:        ShoppingBasket,
  tecnologia:     Smartphone,
  repuestos:      Wrench,
  servicios:      Briefcase,
}

interface Props {
  slug: string
  size?: number
}

export default function SegmentIcon({ slug, size = 28 }: Props) {
  const Icon = ICONS[slug] ?? Package
  return <Icon size={size} className={styles.icon} aria-hidden="true" />
}
