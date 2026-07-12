'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CreditCard, Ruler, ChefHat, RefreshCw, Wallet, Beef, Shirt, Ruler as RulerIcon } from 'lucide-react'
import styles from './FeatureTabsSection.module.css'

type TabKey = 'cobros' | 'variantes' | 'cocina'

interface TabDef {
  key:   TabKey
  label: string
  Icon:  typeof CreditCard
}

const TABS: TabDef[] = [
  { key: 'cobros',    label: 'Cobros',    Icon: CreditCard },
  { key: 'variantes', label: 'Variantes', Icon: Ruler },
  { key: 'cocina',    label: 'Cocina',    Icon: ChefHat },
]

// Rotación leve por panel, sin repetir ángulo entre vecinos (§14, -1.5deg a +1.5deg)
const ROTATE: Record<TabKey, number> = { cobros: -1, variantes: 1.3, cocina: -1.4 }

const VARIANT_DEMOS = [
  { Icon: Shirt,     name: 'Camisa Polo',   spec: 'Talla M · Azul',  price: '$15.00' },
  { Icon: Beef,      name: 'Lomo de Res',   spec: '1.0 kg · Entero', price: '$8.50'  },
  { Icon: RulerIcon, name: 'Tubo PVC',      spec: '¾" · 3 metros',   price: '$3.60'  },
]

const KITCHEN_DEMOS = [
  { id: '#047', status: 'En preparación', items: '2 Pechuga a la plancha · 1 Jugo natural' },
  { id: '#052', status: 'Recibido',        items: '1 Parrilla mixta · 2 Refresco'           },
  { id: '#039', status: 'Listo',           items: '3 Empanadas · 1 Café'                    },
]

function kitchenStatusClass(status: string): string {
  if (status === 'Recibido') return styles.status_recibido
  if (status === 'Listo') return styles.status_listo
  return styles.status_preparacion
}

export default function FeatureTabsSection() {
  const [active, setActive] = useState<TabKey>('cobros')

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <motion.h2
          className={styles.title}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          Un sistema, tres formas de trabajar.
        </motion.h2>

        <div className={styles.tabs} role="tablist">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active === key}
              className={`${styles.tab} ${active === key ? styles.tabOn : ''}`}
              onClick={() => setActive(key)}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {active === 'cobros' && (
            <motion.div
              key="cobros"
              className={styles.panel}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <div className={styles.copy}>
                <h3 className={styles.panelTitle}>Cobra en segundos, en cualquier moneda</h3>
                <p className={styles.panelDesc}>
                  La tasa BCV se actualiza sola y se congela en cada venta. Pago Móvil, Zelle, efectivo
                  o USDT — tu cliente paga como ya te paga, tú ves el ticket en USD y Bs al mismo tiempo.
                </p>
              </div>
              <div className={styles.demo} style={{ rotate: `${ROTATE.cobros}deg` }}>
                <CreditCard size={90} aria-hidden="true" className={styles.ghostIcon} />
                <div className={styles.demoHead}>
                  <RefreshCw size={13} aria-hidden="true" />
                  BCV congelado en la venta
                </div>
                <div className={styles.ticketRow}><span>2 × Harina P.A.N.</span><span>$1.70</span></div>
                <div className={styles.ticketRow}><span>Instalación 2h</span><span>$50.00</span></div>
                <div className={styles.ticketDiv} />
                <div className={styles.ticketTotal}><span>Total</span><span>$51.70</span></div>
                <div className={styles.methods}>
                  <Wallet size={13} aria-hidden="true" />
                  Pago Móvil · Zelle · Efectivo · USDT
                </div>
              </div>
            </motion.div>
          )}

          {active === 'variantes' && (
            <motion.div
              key="variantes"
              className={styles.panel}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <div className={styles.copy}>
                <h3 className={styles.panelTitle}>Cada producto como realmente es</h3>
                <p className={styles.panelDesc}>
                  Ningún negocio vende igual. Define talla, color, peso, medida o tiempo — lo que tenga
                  sentido para tu producto. El sistema calcula el precio y descuenta el inventario solo.
                </p>
              </div>
              <div className={styles.demo} style={{ rotate: `${ROTATE.variantes}deg` }}>
                <Ruler size={90} aria-hidden="true" className={styles.ghostIcon} />
                {VARIANT_DEMOS.map(v => (
                  <div key={v.name} className={styles.variantRow}>
                    <span className={styles.variantIcon}><v.Icon size={16} aria-hidden="true" /></span>
                    <div className={styles.variantBody}>
                      <span className={styles.variantName}>{v.name}</span>
                      <span className={styles.variantSpec}>{v.spec}</span>
                    </div>
                    <span className={styles.variantPrice}>{v.price}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {active === 'cocina' && (
            <motion.div
              key="cocina"
              className={styles.panel}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <div className={styles.copy}>
                <h3 className={styles.panelTitle}>Un panel en la cocina, no una libreta de pedidos</h3>
                <p className={styles.panelDesc}>
                  Cada pedido aparece con su número y estado. Recibido, en preparación, listo — tu cocina
                  ve exactamente lo que falta, sin gritar de un lado a otro.
                </p>
              </div>
              <div className={styles.demo} style={{ rotate: `${ROTATE.cocina}deg` }}>
                <ChefHat size={90} aria-hidden="true" className={styles.ghostIcon} />
                {KITCHEN_DEMOS.map(k => (
                  <div key={k.id} className={styles.kitchenRow}>
                    <div className={styles.kitchenHead}>
                      <span className={styles.kitchenId}>Pedido {k.id}</span>
                      <span className={`${styles.kitchenStatus} ${kitchenStatusClass(k.status)}`}>
                        {k.status}
                      </span>
                    </div>
                    <p className={styles.kitchenItems}>{k.items}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
