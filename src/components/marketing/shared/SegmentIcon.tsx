import {
  Beef, Utensils, Hammer, Pill, Shirt, ShoppingBasket,
  Smartphone, Wrench, Briefcase, Package, type LucideIcon,
  Sparkles, Gem, Sandwich, Dumbbell, Cpu, Apple, FileText,
  Gamepad2, Wind, Wine, PawPrint, Package2, Sofa, Glasses,
  Coffee, BookOpen,
} from 'lucide-react'
import styles from './SegmentIcon.module.css'

// Ícono por segmento real (slug de Segment) — no por theme_key, porque
// theme_key se comparte entre negocios distintos (ferreterias/repuestos
// ambos "ferreteria") y necesitan verse visualmente diferentes.
const ICONS: Record<string, LucideIcon> = {
  carniceria:          Beef,
  restaurante:         Utensils,
  ferreterias:         Hammer,
  farmacias:           Pill,
  'tiendas-ropa':      Shirt,
  abastos:             ShoppingBasket,
  tecnologia:          Smartphone,
  repuestos:           Wrench,
  servicios:           Briefcase,
  belleza:             Sparkles,
  bisuteria:           Gem,
  'comida-rapida':     Sandwich,
  deportes:            Dumbbell,
  electronica:         Cpu,
  fruteria:            Apple,
  'gestoria-tramites': FileText,
  jugueteria:          Gamepad2,
  lavanderia:          Wind,
  licoreria:           Wine,
  mascotas:            PawPrint,
  mayorista:           Package2,
  muebleria:           Sofa,
  optica:              Glasses,
  panaderia:           Coffee,
  papeleria:           BookOpen,
}

interface Props {
  slug: string
  size?: number
}

export default function SegmentIcon({ slug, size = 28 }: Props) {
  const Icon = ICONS[slug] ?? Package
  return <Icon size={size} className={styles.icon} aria-hidden="true" />
}
