'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ShoppingCart, Package, Calculator, ShoppingBag,
  Store, TrendingUp, BarChart2, Activity, Monitor, Truck,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import type { PlanTier } from '@/lib/plan-limits'
import styles from '../configuracion.module.css'

interface Module {
  key: string
  label: string
  desc: string
  Icon: React.ElementType
  alwaysOn: boolean
  /** Si está definido, el switch requiere que el plan actual sea exactamente
   *  este tier — con el modelo de 2 planes de PLAN_LIMITS, en la práctica
   *  significa "requiere negocio_activo". */
  requiresPlan?: PlanTier
}

const MODULES: Module[] = [
  { key: 'pos',       label: 'POS',               desc: 'Punto de venta principal',            Icon: ShoppingCart, alwaysOn: true  },
  { key: 'inventory', label: 'Inventario',         desc: 'Gestión de productos y stock',         Icon: Package,      alwaysOn: true  },
  { key: 'caja',      label: 'Caja',               desc: 'Gestión de apertura y cierre de caja', Icon: Calculator,   alwaysOn: false },
  { key: 'pedidos',   label: 'Pedidos',            desc: 'Tablero kanban de pedidos',            Icon: ShoppingBag,  alwaysOn: false },
  { key: 'catalog',   label: 'Catálogo WhatsApp',  desc: 'Catálogo digital para clientes',       Icon: Store,        alwaysOn: false, requiresPlan: 'negocio_activo' },
  { key: 'finanzas',  label: 'Finanzas',           desc: 'CxC, CxP y control financiero',        Icon: TrendingUp,   alwaysOn: false, requiresPlan: 'negocio_activo' },
  { key: 'reportes',  label: 'Reportes',           desc: 'Informes y exportación de datos',      Icon: BarChart2,    alwaysOn: false },
  { key: 'analytics', label: 'Pulso del Negocio',  desc: 'Métricas y tendencias avanzadas',      Icon: Activity,     alwaysOn: false, requiresPlan: 'negocio_activo' },
  { key: 'suppliers', label: 'Proveedores',        desc: 'Gestión de proveedores y compras',     Icon: Truck,        alwaysOn: false, requiresPlan: 'negocio_activo' },
]

const DEFAULT_ENABLED = new Set(['pos', 'inventory', 'caja', 'pedidos', 'catalog', 'finanzas', 'reportes', 'analytics', 'suppliers'])

// Sidebar (DashboardShell) vive en un árbol de componentes separado y solo
// hace fetch de enabledModules una vez al montar. Sin este evento, un toggle
// aquí queda invisible en el sidebar hasta un reload completo.
const MODULES_UPDATED_EVENT = 'activopos:modules-updated'

interface OptionalModule {
  key: string
  label: string
  desc: string
  segments: string[]
  Icon: React.ElementType
}

const OPTIONAL_MODULES: OptionalModule[] = [
  {
    key: 'kds',
    label: 'KDS — Pantalla de cocina',
    desc: 'Muestra los pedidos en tiempo real para tu cocina o despacho.',
    segments: ['Restaurantes', 'Cafeterías', 'Dark kitchens'],
    Icon: Monitor,
  },
  {
    key: 'delivery',
    label: 'Delivery',
    desc: 'Gestiona zonas de entrega y costos de delivery para tu catálogo.',
    segments: ['Restaurantes', 'E-commerce', 'Tiendas'],
    Icon: Truck,
  },
]

interface Props { businessId: number }

export function TabModulos({ businessId: _businessId }: Props) {
  const { toast } = useToast()
  const [enabled, setEnabled] = useState<Set<string>>(new Set(DEFAULT_ENABLED))
  const [saving, setSaving] = useState(false)
  const [optSaving, setOptSaving] = useState<Record<string, boolean>>({})
  // Plan real del negocio — decide qué switches quedan bloqueados. modules_enabled
  // (arriba) solo controla visibilidad de sidebar y no sabe nada de plan; este
  // fetch es la única fuente de verdad de "qué puede usar este negocio hoy".
  const [currentPlan, setCurrentPlan] = useState<PlanTier>('gratis')

  useEffect(() => {
    fetch('/api/plan')
      .then(res => (res.ok ? res.json() : null))
      .then((data: { plan?: PlanTier } | null) => { if (data?.plan) setCurrentPlan(data.plan) })
      .catch(() => {
        // Sin red: se asume 'gratis' (el default del estado) — más seguro
        // mostrar el switch bloqueado de más que dejarlo pasar por error de red.
      })
  }, [])

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

  const toggleOptional = async (key: string) => {
    setOptSaving(prev => ({ ...prev, [key]: true }))
    const isOn = enabled.has(key)
    const next = new Set(enabled)
    if (isOn) next.delete(key)
    else next.add(key)
    setEnabled(next)
    try {
      const res = await fetch('/api/config/business/modules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules: Array.from(next) }),
      })
      if (!res.ok) throw new Error()
      const j = await res.json() as { modules_enabled?: string[] }
      window.dispatchEvent(new CustomEvent(MODULES_UPDATED_EVENT, { detail: j.modules_enabled ?? Array.from(next) }))
    } catch {
      setEnabled(prev => {
        const reverted = new Set(prev)
        if (isOn) reverted.add(key)
        else reverted.delete(key)
        return reverted
      })
      toast('Error al guardar el módulo', 'error')
    } finally {
      setOptSaving(prev => ({ ...prev, [key]: false }))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/config/business/modules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules: Array.from(enabled) }),
      })
      const j = await res.json().catch(() => ({})) as { modules_enabled?: string[] }
      window.dispatchEvent(new CustomEvent(MODULES_UPDATED_EVENT, { detail: j.modules_enabled ?? Array.from(enabled) }))

      if (res.ok) {
        // Sincronizar caja_mode según si 'caja' está en los módulos
        await fetch('/api/config/caja-mode', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caja_mode: enabled.has('caja') ? 'cash' : 'nocash',
          }),
        })
      }

      toast('Módulos actualizados', 'success')
    } catch {
      toast('Error al guardar módulos', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.sectionsGrid}>
    <div className={styles.formCard}>
      <h3 className={styles.formCardTitle}>Módulos activos</h3>
      <p className={styles.formCardHint}>
        Activa o desactiva módulos según las necesidades de tu negocio.
        Los módulos base no se pueden desactivar.
      </p>

      <div className={styles.moduleList}>
        {MODULES.map(({ key, label, desc, Icon, alwaysOn, requiresPlan }) => {
          const isOn = enabled.has(key)
          // Con el modelo de 2 planes, "requiere negocio_activo" bloquea solo
          // cuando el negocio está en gratis — no hay tiers intermedios que
          // satisfacer con una comparación más laxa.
          const isLocked = requiresPlan != null && currentPlan !== requiresPlan
          return (
            <div key={key} className={styles.moduleRow}>
              <div className={styles.moduleInfo}>
                <span className={styles.moduleIconWrap} aria-hidden="true">
                  <Icon size={15} strokeWidth={1.75} />
                </span>
                <div>
                  <span className={styles.moduleLabel}>
                    {label}
                    {isLocked && <span className={styles.proBadge}>Pro</span>}
                  </span>
                  {desc && <span className={styles.moduleDesc}>{desc}</span>}
                  {isLocked && (
                    <span className={styles.moduleLockedHint}>Disponible en Negocio Activo</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className={`${styles.toggleBtn} ${isOn ? styles.toggleBtnOn : ''} ${(alwaysOn || isLocked) ? styles.toggleBtnDisabled : ''}`}
                aria-label={isLocked ? `${label} requiere el plan Negocio Activo` : `${isOn ? 'Desactivar' : 'Activar'} ${label}`}
                aria-pressed={isOn}
                disabled={alwaysOn || isLocked}
                onClick={() => { if (!alwaysOn && !isLocked) toggle(key) }}
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

    {/* ── Módulos opcionales ── */}
    <div className={styles.formCard}>
      <h3 className={styles.formCardTitle}>Módulos opcionales</h3>
      <p className={styles.formCardHint}>
        Activa funcionalidades especiales según el tipo de negocio. Cada cambio aplica al instante.
      </p>

      <div className={styles.optModulesGrid}>
        {OPTIONAL_MODULES.map(({ key, label, desc, segments, Icon }) => {
          const isOn = enabled.has(key)
          const isSaving = optSaving[key] ?? false
          return (
            <div
              key={key}
              className={`${styles.optModuleCard} ${isOn ? styles.optModuleCardActive : ''}`}
            >
              <div className={styles.optModuleCardHeader}>
                <div className={styles.optModuleCardLeft}>
                  <span className={styles.optModuleIconCircle} aria-hidden="true">
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                  <span className={styles.optModuleLabel}>{label}</span>
                  <span className={styles.optModuleBadge}>Opcional</span>
                </div>
                <div className={styles.optModuleCardRight}>
                  {isOn && <span className={styles.optModuleActiveBadge}>Activo</span>}
                  <button
                    type="button"
                    className={`${styles.toggleBtn} ${isOn ? styles.toggleBtnOn : ''} ${isSaving ? styles.toggleBtnDisabled : ''}`}
                    aria-label={`${isOn ? 'Desactivar' : 'Activar'} ${label}`}
                    aria-pressed={isOn}
                    disabled={isSaving}
                    onClick={() => { void toggleOptional(key) }}
                  >
                    <span className={`${styles.toggleKnob} ${isOn ? styles.toggleKnobOn : ''}`} />
                  </button>
                </div>
              </div>
              <p className={styles.optModuleDesc}>{desc}</p>
              <div className={styles.optModuleSegments}>
                {segments.map(seg => (
                  <span key={seg} className={styles.optModulePill}>{seg}</span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
    </div>
  )
}
