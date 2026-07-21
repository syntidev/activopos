/**
 * Armado del mensaje de cobro por WhatsApp — fuente única.
 *
 * Los datos viven en businesses.cobro_data (Json) y conviven DOS formatos:
 *   - nested (actual, lo escribe TabCobros): { pago_movil: { banco, telefono, … } }
 *   - flat (legacy):                          { pago_movil_banco, pago_movil_telefono, … }
 * normalizeCobroData lee cualquiera de los dos, así el mensaje nunca sale vacío
 * por leer la forma equivocada.
 *
 * payment_methods dice qué está activo. Su enum (cash/transfer/zelle/binance/
 * card/other) NO cubre pago_movil/usdt/zinli/paypal, así que esos se muestran
 * siempre que tengan datos en cobro_data; los que sí mapean se filtran por
 * activo. 'cash'/'transfer' encienden la línea de efectivo.
 */

// Código de banco venezolano → nombre legible. cobro_data guarda el código.
const BANK_NAMES: Record<string, string> = {
  '0102': 'Banco de Venezuela',
  '0104': 'Venezolano de Crédito',
  '0105': 'Mercantil',
  '0108': 'Banco Provincial',
  '0114': 'Bancaribe',
  '0115': 'Exterior',
  '0128': 'Caroní',
  '0134': 'Banesco',
  '0137': 'Sofitasa',
  '0138': 'Coche',
  '0146': 'Bangente',
  '0151': 'BFC',
  '0156': '100% Banco',
  '0157': 'DelSur',
  '0163': 'Banco del Tesoro',
  '0166': 'Agrícola de Venezuela',
  '0168': 'Bancrecer',
  '0169': 'Mi Banco',
  '0171': 'Activo',
  '0172': 'Bancamiga',
  '0174': 'Banplus',
  '0175': 'Bicentenario',
  '0176': 'Nuevo Mundo',
  '0177': 'IFSB',
  '0191': 'Nacional de Crédito',
  '0601': 'Instituto Municipal',
}

export function bankName(code: string | undefined): string {
  if (!code) return ''
  return BANK_NAMES[code.trim()] ?? code.trim()
}

/** Estructura canónica interna, ya normalizada desde nested o flat. */
interface NormalizedCobro {
  pagoMovil?: { banco: string; telefono: string; cedula: string; titular: string }
  zelle?:     { email: string; titular: string }
  binance?:   { id: string; titular: string }
  usdt?:      { wallet: string; red: string; titular: string }
  zinli?:     { correo: string; titular: string }
  paypal?:    { correo: string; titular: string }
}

type RawCobro = Record<string, unknown> | null | undefined

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {}

/** Lee cobro_data en formato nested o flat y devuelve la forma canónica.
 *  Solo incluye un método si tiene al menos un dato con contenido. */
export function normalizeCobroData(raw: RawCobro): NormalizedCobro {
  const d = obj(raw)
  const out: NormalizedCobro = {}

  // ── Pago Móvil ──
  const pm = obj(d.pago_movil)
  const pmBanco = str(pm.banco) || str(d.pago_movil_banco)
  const pmTel   = str(pm.telefono) || str(d.pago_movil_telefono)
  // nested guarda cédula como tipo_doc + documento (V + 3640991); flat como
  // pago_movil_cedula ya armada.
  const pmCed   = str(pm.documento)
    ? `${str(pm.tipo_doc) || 'V'}-${str(pm.documento)}`
    : str(d.pago_movil_cedula)
  const pmTit   = str(pm.titular) || str(d.pago_movil_titular)
  if (pmBanco || pmTel) {
    out.pagoMovil = { banco: pmBanco, telefono: pmTel, cedula: pmCed, titular: pmTit }
  }

  // ── Zelle ──
  const ze = obj(d.zelle)
  const zeEmail = str(ze.contacto) || str(d.zelle_email) || str(d.zelle_contacto)
  const zeTit   = str(ze.titular) || str(d.zelle_titular)
  if (zeEmail) out.zelle = { email: zeEmail, titular: zeTit }

  // ── Binance ──
  const bi = obj(d.binance)
  const biId  = str(bi.contacto) || str(d.binance_id)
  const biTit = str(bi.titular) || str(d.binance_titular)
  if (biId) out.binance = { id: biId, titular: biTit }

  // ── USDT ──
  const us = obj(d.usdt)
  const usWallet = str(us.wallet) || str(d.usdt_wallet) || str(d.usdt_address)
  const usTit    = str(us.titular) || str(d.usdt_titular)
  if (usWallet) out.usdt = { wallet: usWallet, red: str(us.red) || 'TRC20', titular: usTit }

  // ── Zinli ──
  const zi = obj(d.zinli)
  const ziCorreo = str(zi.contacto) || str(d.zinli_correo)
  const ziTit    = str(zi.titular) || str(d.zinli_titular)
  if (ziCorreo) out.zinli = { correo: ziCorreo, titular: ziTit }

  // ── PayPal ──
  const pp = obj(d.paypal)
  const ppCorreo = str(pp.contacto) || str(d.paypal_correo)
  const ppTit    = str(pp.titular) || str(d.paypal_titular)
  if (ppCorreo) out.paypal = { correo: ppCorreo, titular: ppTit }

  return out
}

/** Bloque de métodos, compartido por los tres modos. '' si no hay ninguno. */
function methodBlock(c: NormalizedCobro, acceptsCash: boolean): string {
  const parts: string[] = []

  if (c.pagoMovil) {
    const l = ['📱 Pago Móvil:', `   Banco: ${bankName(c.pagoMovil.banco)}`, `   Teléfono: ${c.pagoMovil.telefono}`]
    if (c.pagoMovil.cedula)  l.push(`   Cédula: ${c.pagoMovil.cedula}`)
    if (c.pagoMovil.titular) l.push(`   Titular: ${c.pagoMovil.titular}`)
    parts.push(l.join('\n'))
  }
  if (c.zelle) {
    const l = ['💵 Zelle:', `   Email: ${c.zelle.email}`]
    if (c.zelle.titular) l.push(`   Titular: ${c.zelle.titular}`)
    parts.push(l.join('\n'))
  }
  if (c.binance) {
    const l = ['🔶 Binance:', `   ID: ${c.binance.id}`]
    if (c.binance.titular) l.push(`   Titular: ${c.binance.titular}`)
    parts.push(l.join('\n'))
  }
  if (c.usdt) {
    const l = [`🔶 USDT (${c.usdt.red}):`, `   Wallet: ${c.usdt.wallet}`]
    if (c.usdt.titular) l.push(`   Titular: ${c.usdt.titular}`)
    parts.push(l.join('\n'))
  }
  if (c.zinli) {
    const l = ['💠 Zinli:', `   Correo: ${c.zinli.correo}`]
    if (c.zinli.titular) l.push(`   Titular: ${c.zinli.titular}`)
    parts.push(l.join('\n'))
  }
  if (c.paypal) {
    const l = ['💙 PayPal:', `   Correo: ${c.paypal.correo}`]
    if (c.paypal.titular) l.push(`   Titular: ${c.paypal.titular}`)
    parts.push(l.join('\n'))
  }
  if (acceptsCash) parts.push('💴 Efectivo (USD / Bs):\n   Aceptamos pago en efectivo')

  return parts.join('\n\n')
}

export type PaymentMessageMode = 'pedido' | 'datos' | 'deuda'

export interface BuildPaymentMessageOpts {
  mode:         PaymentMessageMode
  clientName?:  string
  orderNumber?: string
  totalUsd?:    number
  totalBs?:     number
  cxcUsd?:      number
  /** Método cash/transfer activo → agrega la línea de efectivo. */
  acceptsCash?: boolean
}

const money = (n: number | undefined): string => (n ?? 0).toLocaleString('es-VE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})

/** Arma el mensaje de WhatsApp según el modo. Devuelve texto plano listo para
 *  encodeURIComponent. Los campos vacíos no se muestran (regla anti-fachada). */
export function buildPaymentMessage(raw: RawCobro, opts: BuildPaymentMessageOpts): string {
  const c     = normalizeCobroData(raw)
  const block = methodBlock(c, opts.acceptsCash ?? false)
  const hola  = opts.clientName ? `Hola ${opts.clientName}, ` : ''
  const cap   = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  if (opts.mode === 'pedido') {
    const head  = `${hola}${cap(`tu pedido ${opts.orderNumber ?? ''} está listo para procesar.`)}`
    const total = [
      `💰 Total: $${money(opts.totalUsd)} USD`,
      `   (Bs. ${money(opts.totalBs)} a la tasa del día)`,
    ].join('\n')
    const tail = 'Envíanos el comprobante por este chat y procesamos tu pedido de inmediato. ¡Gracias!'
    const body = block ? [total, '', block] : [total]
    return [head, '', ...body, '', tail].join('\n')
  }

  if (opts.mode === 'deuda') {
    const head = `${hola}${cap(`te recuerdo que tienes un saldo pendiente de $${money(opts.cxcUsd)} USD.`)}`
    const body = block ? ['Puedes cancelarlo por:', block] : []
    return [head, '', ...body, '', 'Gracias por tu preferencia.'].join('\n')
  }

  // 'datos'
  const head = `${hola}${cap('aquí te comparto mis formas de pago:')}`
  return [head, '', block, '', 'Cualquier consulta estoy a tu orden.'].join('\n')
}
