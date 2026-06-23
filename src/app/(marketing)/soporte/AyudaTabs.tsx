'use client'

import { useState } from 'react'
import { ShoppingCart, Package, Users, BarChart3 } from 'lucide-react'
import styles from './ayuda.module.css'

interface TabContent {
  icon: React.ElementType
  title: string
  desc: string
}

const TABS: Record<string, { label: string; items: TabContent[] }> = {
  bodegon: {
    label: 'Bodegón',
    items: [
      { icon: ShoppingCart, title: 'Venta por unidad', desc: 'Registra ventas de bebidas, alimentos y artículos de consumo en segundos.' },
      { icon: Package,       title: 'Control de stock',  desc: 'Recibe alertas cuando un producto baja del mínimo de inventario.' },
      { icon: Users,         title: 'Clientes frecuentes', desc: 'Identifica tus mejores clientes y lleva seguimiento de lo que compran.' },
      { icon: BarChart3,     title: 'Cierre de caja',   desc: 'Reconcilia efectivo, transferencias y pagos móvil al final del día.' },
    ],
  },
  panaderia: {
    label: 'Panadería',
    items: [
      { icon: ShoppingCart, title: 'Venta por peso', desc: 'Soporte para venta por kilogramo de pan, queso y productos al corte.' },
      { icon: Package,       title: 'Ingredientes',   desc: 'Lleva el inventario de materia prima y controla el consumo por producción.' },
      { icon: BarChart3,     title: 'Turno diario',   desc: 'Registra la producción diaria y compara con lo vendido.' },
      { icon: Users,         title: 'Pedidos fijos',  desc: 'Clientes con pedido regular pueden tenerlo reservado cada mañana.' },
    ],
  },
  servicio: {
    label: 'Servicio / Taller',
    items: [
      { icon: ShoppingCart, title: 'Presupuestos',    desc: 'Crea cotizaciones con servicios y repuestos antes de cobrar.' },
      { icon: Package,       title: 'Repuestos',       desc: 'Controla el inventario de piezas y descuenta al usar en una orden.' },
      { icon: Users,         title: 'Historial cliente', desc: 'Consulta todas las reparaciones anteriores de un cliente o equipo.' },
      { icon: BarChart3,     title: 'Factura de servicio', desc: 'Imprime o envía el detalle del trabajo realizado con precio en USD y Bs.' },
    ],
  },
}

export default function AyudaTabs() {
  const [active, setActive] = useState<string>('bodegon')
  const tab = TABS[active]

  return (
    <div>
      <div className={styles.tabBar} role="tablist" aria-label="Tipo de negocio">
        {Object.entries(TABS).map(([key, { label }]) => (
          <button
            key={key}
            className={`${styles.tab} ${active === key ? styles.tabActive : ''}`}
            onClick={() => setActive(key)}
            role="tab"
            aria-selected={active === key}
            aria-controls={`tabpanel-${key}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        id={`tabpanel-${active}`}
        role="tabpanel"
        aria-label={tab.label}
        className={styles.tabContent}
      >
        {tab.items.map(({ icon: Icon, title, desc }) => (
          <div key={title} className={styles.tabCard}>
            <div className={styles.tabCardIcon}>
              <Icon size={17} aria-hidden="true" />
            </div>
            <p className={styles.tabCardTitle}>{title}</p>
            <p className={styles.tabCardDesc}>{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
