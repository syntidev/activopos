'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, UtensilsCrossed } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { UpgradeModal } from '@/components/ui/UpgradeModal'
import { usePlanGate } from '@/hooks/usePlanGate'
import { PLAN_DISPLAY, PLAN_LIMITS, type PlanTier } from '@/lib/plan-limits'
import cfg from '../configuracion.module.css'
import styles from './restauranteModulo.module.css'

interface RestauranteModuloCardProps {
  enabled: boolean
  /** "kds" ya está en modules_enabled: entonces no se ofrece activarlo otra vez. */
  kdsEnabled: boolean
  currentPlan: PlanTier
  /** Derecho al módulo según el servidor (GET /api/config/business/modules → entitlements.restaurante). null = aún no se sabe. */
  entitled: boolean | null
  /** Recibe la lista nueva de módulos cuando la activación también encendió el KDS. */
  onModulesChanged: (modules: string[]) => void
}

const ENABLES = [
  'Plano del salón: áreas, mesas y su disposición',
  'Roles de mesonero y cocinero para tu equipo',
  'Estaciones de preparación, cuando estén disponibles',
]

/** Tarjeta de Configuración › Módulos: activa o desactiva el módulo Restaurante con confirmación. Solo admin. */
export function RestauranteModuloCard({ enabled, kdsEnabled, currentPlan, entitled, onModulesChanged }: RestauranteModuloCardProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { guardedFetch, upgradeReason, clearUpgrade } = usePlanGate()
  const [modal, setModal] = useState<'on' | 'off' | null>(null)
  const [withKds, setWithKds] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)

  // El derecho lo decide el servidor (plan Operación, suscripción vigente); sin esa respuesta se usa el flag del plan.
  const locked = !enabled && (entitled === null ? !PLAN_LIMITS[currentPlan].restaurante : !entitled)
  const lockedReason = `El módulo Restaurante requiere plan ${PLAN_DISPLAY.operacion}.`

  function open(kind: 'on' | 'off'): void {
    setError(null)
    setWithKds(false)
    setModal(kind)
  }

  async function confirm(): Promise<void> {
    if (!modal || busy) return
    const turningOn = modal === 'on'
    setBusy(true)
    setError(null)
    const res = await guardedFetch('/api/restaurante/activacion', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ enabled: turningOn, ...(turningOn && withKds && !kdsEnabled ? { enable_kds: true } : {}) }),
    })
    const json = (await res.json().catch(() => ({}))) as { error?: string; code?: string; modules_enabled?: string[] }
    setBusy(false)
    if (!res.ok) {
      // El 403 de plan abre el aviso de mejora (guardedFetch lo dispara); el resto se explica dentro del modal.
      if (res.status === 403 && json.code === 'PLAN_LIMIT') setModal(null)
      else setError(json.error ?? 'No se pudo cambiar el módulo')
      return
    }
    window.dispatchEvent(new CustomEvent('activopos:restaurante-updated', { detail: turningOn }))
    if (json.modules_enabled) {
      window.dispatchEvent(new CustomEvent('activopos:modules-updated', { detail: json.modules_enabled }))
      onModulesChanged(json.modules_enabled)
    }
    toast(turningOn ? 'Restaurante activado' : 'Restaurante desactivado', 'success')
    setModal(null)
    router.refresh() // la pestaña Restaurante de Configuración aparece o desaparece
  }

  return (
    <>
      <div className={`${cfg.optModuleCard} ${enabled ? cfg.optModuleCardActive : ''}`} data-testid="mod-card-restaurante" data-locked={locked ? 'true' : 'false'}>
        <div className={cfg.optModuleCardHeader}>
          <div className={cfg.optModuleCardLeft}>
            <span className={cfg.optModuleIconCircle} aria-hidden="true"><UtensilsCrossed size={18} strokeWidth={1.75} /></span>
            <span className={cfg.optModuleLabel}>Restaurante</span>
            <span className={cfg.optModuleBadge}>Opcional</span>
            {locked && <span className={cfg.proBadge}>Pro</span>}
          </div>
          <div className={cfg.optModuleCardRight}>
            {enabled && <span className={cfg.optModuleActiveBadge}>Activo</span>}
            <button
              type="button"
              className={`${cfg.toggleBtn} ${enabled ? cfg.toggleBtnOn : ''} ${locked ? cfg.toggleBtnDisabled : ''}`}
              data-testid="mod-switch-restaurante"
              aria-label={locked ? `Restaurante requiere el plan ${PLAN_DISPLAY.operacion}` : `${enabled ? 'Desactivar' : 'Activar'} Restaurante`}
              aria-pressed={enabled}
              disabled={locked}
              onClick={() => open(enabled ? 'off' : 'on')}
            >
              <span className={`${cfg.toggleKnob} ${enabled ? cfg.toggleKnobOn : ''}`} />
            </button>
          </div>
        </div>
        <p className={cfg.optModuleDesc}>Plano de mesas, cuentas del mesonero y estaciones de cocina para restaurantes, bares y cafeterías.</p>
        {locked && (
          <p className={styles.upgrade}>
            Disponible en el plan {PLAN_DISPLAY.operacion}.{' '}
            <button type="button" className={styles.upgradeBtn} onClick={() => setShowUpgrade(true)}>Mejorar plan</button>
          </p>
        )}
        <div className={cfg.optModuleSegments}>
          {['Restaurantes', 'Bares', 'Cafeterías'].map(seg => <span key={seg} className={cfg.optModulePill}>{seg}</span>)}
        </div>
      </div>

      <Modal
        open={modal !== null}
        onClose={() => { if (!busy) setModal(null) }}
        title={modal === 'on' ? 'Activar Restaurante' : 'Desactivar Restaurante'}
        size="sm"
        footer={
          <div className={styles.footer}>
            <Button variant="secondary" onClick={() => setModal(null)} disabled={busy}>Cancelar</Button>
            <Button variant={modal === 'on' ? 'primary' : 'danger'} onClick={() => { void confirm() }} loading={busy}>
              {modal === 'on' ? 'Activar Restaurante' : 'Desactivar Restaurante'}
            </Button>
          </div>
        }
      >
        {modal === 'on' && (
          <div className={styles.body}>
            <p className={styles.lead}>Al activarlo se habilita en tu negocio:</p>
            <ul className={styles.list}>
              {ENABLES.map(t => <li key={t}><Check size={16} aria-hidden="true" />{t}</li>)}
            </ul>
            {!kdsEnabled && (
              <label className={styles.check}>
                <input type="checkbox" checked={withKds} onChange={e => setWithKds(e.target.checked)} />
                <span>
                  <b>Activar también Cocina (KDS)</b>
                  <small>La pantalla de cocina que ya existe en ActivoPOS.</small>
                </span>
              </label>
            )}
            <p className={styles.note}>Puedes desactivarlo cuando quieras; tus datos se conservan.</p>
          </div>
        )}
        {modal === 'off' && (
          <div className={styles.body}>
            <p className={styles.lead}>El menú y las pantallas del módulo dejan de estar disponibles.</p>
            <p className={styles.note}>No se borra ningún dato: tus áreas, mesas y plano se conservan y reaparecen si lo vuelves a activar.</p>
          </div>
        )}
        {error && <p className={styles.error} role="alert">{error}</p>}
      </Modal>

      <UpgradeModal reason={upgradeReason ?? (showUpgrade ? lockedReason : null)} onClose={() => { clearUpgrade(); setShowUpgrade(false) }} />
    </>
  )
}
