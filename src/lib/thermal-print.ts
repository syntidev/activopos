// Orquesta la impresión térmica: config del equipo -> datos del servidor ->
// plantilla ESC/POS -> QZ Tray. Nunca lanza: devuelve un resultado para que el
// llamador decida qué mostrar. Una falla de impresión JAMÁS debe afectar a una
// venta ya cobrada.

import { printRaw } from '@/lib/qz-tray'
import { loadThermalSettings } from '@/lib/thermal-settings'
import { buildTestTicket, buildThermalTicket } from '@/lib/thermal-ticket'
import type { ThermalPrintResult, ThermalSettings, ThermalTicketData } from '@/types/thermal'

const fail = (message: string): ThermalPrintResult => ({ state: 'error', message })

async function sendToPrinter(settings: ThermalSettings, data: string): Promise<ThermalPrintResult> {
  if (!settings.printer) return fail('No hay una impresora elegida en Configuración → Impresión.')
  const result = await printRaw(settings.printer, data)
  return result.ok ? { state: 'printed', printer: settings.printer } : fail(result.message)
}

/**
 * Imprime el ticket de una venta ya cobrada. `skipped` si la impresión térmica
 * está apagada en este equipo (caso normal: no se muestra nada).
 */
export async function printSaleThermal(saleId: number): Promise<ThermalPrintResult> {
  const settings = loadThermalSettings()
  if (!settings.enabled) return { state: 'skipped' }

  try {
    const res = await fetch(`/api/sales/${saleId}/ticket-data`, { cache: 'no-store', credentials: 'same-origin' })
    if (!res.ok) return fail(`No se pudieron leer los datos del ticket (HTTP ${res.status}).`)
    const body = await res.json() as { ok: boolean; ticket: ThermalTicketData }
    return await sendToPrinter(settings, buildThermalTicket(body.ticket, settings.paper))
  } catch (e) {
    return fail(e instanceof Error && e.message ? e.message : 'Error inesperado al preparar el ticket.')
  }
}

/** Ticket de prueba con la config que se está editando (aún sin guardar). */
export function printTestTicketThermal(settings: ThermalSettings, businessName: string): Promise<ThermalPrintResult> {
  return sendToPrinter(settings, buildTestTicket(businessName, settings.paper, new Date()))
}
