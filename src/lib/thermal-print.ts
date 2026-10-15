// Orquesta la impresión térmica: config del equipo -> datos del servidor ->
// layout ESC/POS -> QZ Tray. Nunca lanza: devuelve un resultado para que el
// llamador decida qué mostrar. Una falla de impresión JAMÁS debe afectar a una
// venta ya cobrada.

import { printBytes } from '@/lib/printing/qz-client'
import { encodeTicket, layoutSaleTicket, layoutTestTicket, toBase64 } from '@/lib/printing/escpos'
import { loadLogoRaster } from '@/lib/printing/logo-raster'
import { hasAnyThermalEnabled, loadThermalSettings } from '@/lib/thermal-settings'
import type { PrintSettings, ThermalPaper, ThermalPrintResult, ThermalTicketData } from '@/types/thermal'

const fail = (message: string): ThermalPrintResult => ({ state: 'error', message })

// Ancho imprimible típico en puntos (203 dpi).
const LOGO_WIDTH: Record<ThermalPaper, number> = { '58mm': 384, '80mm': 576 }

/**
 * Imprime el ticket de una venta ya cobrada. `skipped` si la impresión térmica
 * está apagada en este equipo (caso normal: no se muestra nada) o si es una
 * impresión automática y el negocio la tiene desactivada.
 */
export async function printSaleThermal(saleId: number, opts: { auto?: boolean } = {}): Promise<ThermalPrintResult> {
  // Sin ningún negocio activo en este equipo no se toca la red.
  if (!hasAnyThermalEnabled()) return { state: 'skipped' }

  try {
    const res = await fetch(`/api/sales/${saleId}/ticket-data`, { cache: 'no-store', credentials: 'same-origin' })
    if (!res.ok) return fail(`No se pudieron leer los datos del ticket (HTTP ${res.status}).`)
    const body = await res.json() as { ok: boolean; business_id: number; ticket: ThermalTicketData }
    const { ticket } = body

    const settings = loadThermalSettings(body.business_id)
    if (!settings.enabled) return { state: 'skipped' }
    if (opts.auto && !ticket.print.auto_print) return { state: 'skipped' }
    if (!settings.printer) return fail('No hay una impresora elegida en Configuración → Impresión.')

    const paper      = ticket.business.paper ?? settings.paper
    const catalogUrl = ticket.business.catalog_slug ? `${window.location.origin}/catalogo/${ticket.business.catalog_slug}` : null
    const logo = ticket.print.show_logo && ticket.business.logo_url
      ? await loadLogoRaster(ticket.business.logo_url, LOGO_WIDTH[paper])
      : null

    const bytes = encodeTicket(layoutSaleTicket(ticket, paper, { catalogUrl }), {
      codepage: ticket.print.codepage, openDrawer: ticket.print.open_drawer, logo,
    })
    const result = await printBytes(settings.printer, toBase64(bytes))
    return result.ok ? { state: 'printed', printer: settings.printer } : fail(result.message)
  } catch (e) {
    return fail(e instanceof Error && e.message ? e.message : 'Error inesperado al preparar el ticket.')
  }
}

export interface TestPrintInfo {
  printer:      string
  businessName: string
  qzVersion:    string
  paper:        ThermalPaper
  print:        PrintSettings
}

/** Ticket de diagnóstico con lo que se está editando en el panel. */
export async function printTestTicketThermal(i: TestPrintInfo): Promise<ThermalPrintResult> {
  const bytes = encodeTicket(
    layoutTestTicket({
      businessName: i.businessName, printer: i.printer, qzVersion: i.qzVersion,
      paper: i.paper, codepage: i.print.codepage, now: new Date(),
    }),
    { codepage: i.print.codepage, openDrawer: false },
  )
  const result = await printBytes(i.printer, toBase64(bytes))
  return result.ok ? { state: 'printed', printer: i.printer } : fail(result.message)
}
