import { useState } from 'react'

/**
 * Intercepta el 403 de PLAN GATE y expone el motivo para mostrarlo en
 * UpgradeModal. Envolvé los fetch que pueden chocar contra un límite de plan
 * con guardedFetch en vez de fetch.
 *
 * Discriminador obligatorio: solo dispara si el body trae `code: 'PLAN_LIMIT'`
 * (plan-guard → planDenied()). Un 403 de ROL ({ error: 'Sin permiso' }) NO lo
 * trae, así que a un cajero sin permiso NO se le muestra el modal de upgrade
 * (mejorar el plan no le resuelve un bloqueo de rol).
 */
export function usePlanGate() {
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null)

  async function guardedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const res = await fetch(input, init)
    if (res.status === 403) {
      const body = await res.clone().json().catch(() => ({})) as { error?: string; code?: string }
      if (body.code === 'PLAN_LIMIT') {
        setUpgradeReason(body.error ?? 'Función no disponible en tu plan.')
      }
    }
    return res
  }

  return {
    guardedFetch,
    upgradeReason,
    clearUpgrade: () => setUpgradeReason(null),
  }
}
