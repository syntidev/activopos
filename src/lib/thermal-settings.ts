// Config de impresión térmica POR EQUIPO, en localStorage del navegador.
//
// La impresora está físicamente conectada a UNA máquina. Guardarla en la DB del
// negocio haría que un segundo terminal (o el celular del dueño) intentara
// imprimir en la impresora de otro equipo. Tradeoff asumido: hay que
// configurarla una vez en cada equipo con impresora (con un admin logueado, ya
// que la pestaña Impresión es de admin) y persiste mientras no se borren los
// datos del navegador.

import type { ThermalPaper, ThermalSettings } from '@/types/thermal'

const KEY = 'activopos.thermal'

export const DEFAULT_THERMAL_SETTINGS: ThermalSettings = { enabled: false, printer: null, paper: '58mm' }

const isPaper = (v: unknown): v is ThermalPaper => v === '58mm' || v === '80mm'

export function loadThermalSettings(): ThermalSettings {
  if (typeof window === 'undefined') return DEFAULT_THERMAL_SETTINGS
  try {
    const raw = window.localStorage.getItem(KEY)
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

export function saveThermalSettings(settings: ThermalSettings): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings))
    return true
  } catch {
    return false
  }
}
