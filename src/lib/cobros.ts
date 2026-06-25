import { formatUsd, formatBs } from '@/lib/bcv'

export interface CobroData {
  pago_movil_banco?:    string
  pago_movil_telefono?: string
  pago_movil_titular?:  string
  pago_movil_cedula?:   string
  zelle_contacto?:      string
  zelle_titular?:       string
  binance_id?:          string
  zinli_correo?:        string
  paypal_correo?:       string
  usdt_address?:        string
}

export function generateCobroMessage({
  cobro_data,
  total_usd,
  rate,
  ticket_number,
  business_name,
}: {
  cobro_data:    CobroData | null | Record<string, unknown>
  total_usd:     number
  rate:          number
  ticket_number: string
  business_name: string
}): string {
  const total_bs = total_usd * rate
  const cd = (cobro_data ?? {}) as CobroData

  const lines: string[] = [
    `*${business_name}*`,
    `Ticket: ${ticket_number}`,
    ``,
    `*Total a pagar*`,
    `$${formatUsd(total_usd)}`,
    `Bs. ${formatBs(total_usd, rate)} (Bs. ${total_bs.toFixed(2)})`,
    ``,
    `*Métodos de cobro:*`,
  ]

  const hasPagoMovil = cd.pago_movil_banco && cd.pago_movil_telefono
  if (hasPagoMovil) {
    lines.push(``, `*Pago Móvil*`)
    lines.push(`Banco: ${cd.pago_movil_banco}`)
    lines.push(`Teléfono: ${cd.pago_movil_telefono}`)
    if (cd.pago_movil_titular) lines.push(`Titular: ${cd.pago_movil_titular}`)
    if (cd.pago_movil_cedula)  lines.push(`Cédula: ${cd.pago_movil_cedula}`)
  }

  if (cd.zelle_contacto) {
    lines.push(``, `*Zelle*`)
    lines.push(`Contacto: ${cd.zelle_contacto}`)
    if (cd.zelle_titular) lines.push(`Titular: ${cd.zelle_titular}`)
  }

  if (cd.binance_id) {
    lines.push(``, `*Binance Pay*`)
    lines.push(`ID: ${cd.binance_id}`)
  }

  if (cd.zinli_correo) {
    lines.push(``, `*Zinli*`)
    lines.push(`Correo: ${cd.zinli_correo}`)
  }

  if (cd.paypal_correo) {
    lines.push(``, `*PayPal*`)
    lines.push(`Correo: ${cd.paypal_correo}`)
  }

  if (cd.usdt_address) {
    lines.push(``, `*USDT (TRC20)*`)
    lines.push(`Dirección: ${cd.usdt_address}`)
  }

  return lines.join('\n')
}
