// Config de impresión térmica POR EQUIPO, en localStorage del navegador.
//
// La impresora está físicamente conectada a UNA máquina. Guardarla en la DB del
// negocio haría que un segundo terminal (o el celular del dueño) intentara
// imprimir en la impresora de otro equipo. La clave lleva el id del negocio:
// un mismo navegador puede administrar varios negocios (super_admin) sin que
// la impresora de uno se use en el otro.

import type { ThermalPaper, ThermalSettings } from '@/types/thermal'

const PREFIX = 'activopos.thermal.'

export const DEFAULT_THERMAL_SETTINGS: ThermalSettings = { enabled: false, printer: null, paper: '58mm' }

const isPaper = (v: unknown): v is ThermalPaper => v === '58mm' || v === '80mm'

const keyOf = (businessId: number): string => `${PREFIX}${businessId}`

export function loadThermalSettings(businessId: number): ThermalSettings {
  if (typeof window === 'undefined') return DEFAULT_THERMAL_SETTINGS
  try {
    const raw = window.localStorage.getItem(keyOf(businessId))
    if (!raw) return DEFAULT_THERMAL_SETTINGS
    const p = JSON.parse(raw) as Partial<ThermalSettings>
    return {
      enabled: p.enabled === true,
      printer: typeof p.printer === 'string' && p.printer ? p.printer : null,
      paper:   isPaper(p.paper) ? p.paper : DEFAULT_THERMAL_SETTINGS.paper,
    }
  } catch {
    // localStorage bloqueado o JSON corrupto: se trabaja con los valores por defecto.
    return DEFAULT_THERMAL_SETTINGS
  }
}

export function saveThermalSettings(businessId: number, settings: ThermalSettings): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(keyOf(businessId), JSON.stringify(settings))
    return true
  } catch {
    return false
  }
}

/** ¿Algún negocio tiene la impresión térmica activa en este equipo? Evita pedir datos al servidor si no. */
export function hasAnyThermalEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k?.startsWith(PREFIX) && (JSON.parse(window.localStorage.getItem(k) ?? '{}') as Partial<ThermalSettings>).enabled === true) {
        return true
      }
    }
  } catch {
    return false
  }
  return false
}
