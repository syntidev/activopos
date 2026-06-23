import {
  Beef, Coffee, Shirt, ShoppingBasket, Utensils, Zap,
  Wrench, Building2, Monitor, Scissors, Fish, Flower2,
  Pill, IceCream,
} from 'lucide-react'
import styles from './SegmentsSection.module.css'

const SEGMENTS = [
  { icon: Beef,           name: 'Carnicería',       sub: 'Res · Cerdo · Aves' },
  { icon: Coffee,         name: 'Café',              sub: 'Cafetería · Panadería' },
  { icon: Shirt,          name: 'Ropa',              sub: 'Boutique · Calzado' },
  { icon: ShoppingBasket, name: 'Bodega',            sub: 'Abastos · Licores' },
  { icon: Utensils,       name: 'Restaurante',       sub: 'Comida · Food truck' },
  { icon: Zap,            name: 'Técnico Eléctrico', sub: 'Servicios · Cotización' },
  { icon: Wrench,         name: 'Taller',            sub: 'Mecánica · Repuestos' },
  { icon: Building2,      name: 'Ferretería',        sub: 'Materiales · Metro lineal' },
  { icon: Monitor,        name: 'Sportbar',          sub: 'Estadio · Venue' },
  { icon: Scissors,       name: 'Peluquería',        sub: 'Servicios · Por hora' },
  { icon: Fish,           name: 'Pescadería',        sub: 'Mariscos · Por kg' },
  { icon: Flower2,        name: 'Floristería',       sub: 'Flores · Decoración' },
  { icon: Pill,           name: 'Farmacia',          sub: 'Medicamentos · Salud' },
  { icon: IceCream,       name: 'Heladería',         sub: 'Helados · Por litro' },
]

export default function SegmentsSection() {
  const doubled = [...SEGMENTS, ...SEGMENTS]

  return (
    <section className={styles.section} id="segmentos">
      <div className={styles.inner}>
        <h2 className={styles.title} data-reveal>
          Si produces, vendes o prestas un servicio<br />
          en Venezuela, esto es para ti.
        </h2>

        <div className={styles.trackWrap}>
          <div className={styles.track} aria-label="Tipos de negocio compatibles">
            {doubled.map(({ icon: Icon, name, sub }, i) => (
              <div key={i} className={styles.item}>
                <Icon size={28} aria-hidden />
                <span className={styles.itemName}>{name}</span>
                <span className={styles.itemSub}>{sub}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
