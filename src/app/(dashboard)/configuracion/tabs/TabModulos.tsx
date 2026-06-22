'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ShoppingCart, Package, Calculator, ShoppingBag,
  Store, TrendingUp, BarChart2, Activity, ChefHat, Truck,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import styles from '../configuracion.module.css'

interface Module {
  key: string
  label: string
  desc: string
  Icon: React.ElementType
  alwaysOn: boolean
}

const MODULES: Module[] = [
  { key: 'pos',       label: 'POS',                     desc: 'Punto de venta principal',             Icon: ShoppingCart, alwaysOn: true  },
  { key: 'inventory', label: 'Inventario',               desc: 'Gestión de productos y stock',          Icon: Package,      alwaysOn: true  },
  { key: 'caja',      label: 'Caja',                    desc: 'Gestión de apertura y cierre de caja',  Icon: Calculator,   alwaysOn: false },
  { key: 'pedidos',   label: 'Pedidos',                 desc: 'Tablero kanban de pedidos',             Icon: ShoppingBag,  alwaysOn: false },
  { key: 'catalog',   label: 'Catálogo WhatsApp',       desc: 'Catálogo digital para clientes',        Icon: Store,        alwaysOn: false },
  { key: 'finanzas',  label: 'Finanzas',                desc: 'CxC, CxP y control financiero',         Icon: TrendingUp,   alwaysOn: false },
  { key: 'reportes',  label: 'Reportes',                desc: 'Informes y exportación de datos',       Icon: BarChart2,    alwaysOn: false },
  { key: 'analytics', label: 'Pulso del Negocio',       desc: 'Métricas y tendencias avanzadas',       Icon: Activity,     alwaysOn: false },
  { key: 'kds',       label: 'Pantalla de Cocina (KDS)', desc: 'Para restaurantes y cocinas',           Icon: ChefHat,      alwaysOn: false },
  { key: 'delivery',  label: 'Delivery',                desc: 'Para negocios con envíos',              Icon: Truck,        alwaysOn: false },
]

const DEFAULT_ENABLED = new Set(['pos', 'inventory', 'caja', 'pedidos', 'catalog', 'finanzas', 'reportes', 'analytics'])

interface Props { businessId: number }

export function TabModulos({ businessId: _businessId }: Props) {
  const { toast } = useToast()
  const [enabled, setEnabled] = useState<Set<string>>(new Set(DEFAULT_ENABLED))
  const [saving, setSaving] = useState(false)

  const fetchModules = useCallback(async () => {
    try {
      const res = await fetch('/api/config/business/modules')
      if (!res.ok) return
      const j = await res.json() as { modules_enabled?: string[] }
      if (Array.isArray(j.modules_enabled)) setEnabled(new Set(j.modules_enabled))
    } catch {
      // API not yet available — defaults remain
    }
  }, [])

  useEffect(() => { void fetchModules() }, [fetchModules])

  const toggle = (key: string) => {
    setEnabled(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/config/business/modules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules: Array.from(enabled) }),
      })
      toast('Módulos actualizados', 'success')
    } catch {
      toast('Error al guardar módulos', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.formCard}>
      <h3 className={styles.formCardTitle}>Módulos activos</h3>
      <p className={styles.formCardHint}>
        Activa o desactiva módulos según las necesidades de tu negocio.
        Los módulos base no se pueden desactivar.
      </p>

      <div className={styles.moduleList}>
        {MODULES.map(({ key, label, desc, Icon, alwaysOn }) => {
          const isOn = enabled.has(key)
          return (
            <div key={key} className={styles.moduleRow}>
              <div className={styles.moduleInfo}>
                <span className={styles.moduleIconWrap} aria-hidden="true">
                  <Icon size={15} strokeWidth={1.75} />
                </span>
                <div>
                  <span className={styles.moduleLabel}>{label}</span>
                  {desc && <span className={styles.moduleDesc}>{desc}</span>}
                </div>
              </div>
              <button
                type="button"
                className={`${styles.toggleBtn} ${isOn ? styles.toggleBtnOn : ''} ${alwaysOn ? styles.toggleBtnDisabled : ''}`}
                aria-label={`${isOn ? 'Desactivar' : 'Activar'} ${label}`}
                aria-pressed={isOn}
                disabled={alwaysOn}
                onClick={() => { if (!alwaysOn) toggle(key) }}
              >
                <span className={`${styles.toggleKnob} ${isOn ? styles.toggleKnobOn : ''}`} />
              </button>
            </div>
          )
        })}
      </div>

      <div className={styles.saveRow}>
        <Button variant="primary" onClick={handleSave} loading={saving}>
          Guardar módulos
        </Button>
      </div>
    </div>
  )
}
