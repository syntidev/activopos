// Ajustes de impresión del NEGOCIO: business.settings.print (JSON). El ancho del
// papel NO está acá: sale de businesses.ticket_format (ya existente).

import { DEFAULT_PRINT_SETTINGS, type PrintSettings, type ThermalCodepage } from '@/types/thermal'

const isCodepage = (v: unknown): v is ThermalCodepage => v === 'cp858' || v === 'cp850'

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)

/** Lee settings.print con defaults; tolera JSON viejo o malformado. */
export function parsePrintSettings(settings: unknown): PrintSettings {
  const raw = (settings as Record<string, unknown> | null)?.print
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const d = DEFAULT_PRINT_SETTINGS
  return {
    header:          typeof p.header === 'string' ? p.header.slice(0, 120) : d.header,
    auto_print:      bool(p.auto_print, d.auto_print),
    open_drawer:     bool(p.open_drawer, d.open_drawer),
    codepage:        isCodepage(p.codepage) ? p.codepage : d.codepage,
    show_logo:       bool(p.show_logo, d.show_logo),
    show_catalog_qr: bool(p.show_catalog_qr, d.show_catalog_qr),
  }
}
