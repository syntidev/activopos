// Check del ticket ESC/POS (src/lib/printing/escpos.ts).
// Correr: node scripts/check-thermal-ticket.mjs   (Node >= 22.18: importa el .ts directo)
// Falla si una línea excede el ancho del papel, si la code page no codifica ñ/acentos,
// si cambia la regla de doble moneda o si faltan init / code page / corte.
import assert from 'node:assert/strict'
import { colsForPaper, encodeText, encodeTicket, layoutSaleTicket, layoutTestTicket, renderPreview, row, wrap } from '../src/lib/printing/escpos.ts'

const flags = {
  show_description: false, show_bs: true, show_foreign: true, foreign_format: 'usd',
  show_address: true, show_phone: true, show_customer_data: true, show_rif: true,
  show_cashier_name: true, show_bcv_rate: true, show_payment_method: true,
}
const print = { header: 'Sucursal Porlamar', auto_print: true, open_drawer: true, codepage: 'cp858', show_logo: false, show_catalog_qr: true }
const base = {
  business: { name: 'OnBike Margarita', rif: 'J-12345678-9', address: 'Av. 4 de Mayo, C.C. Jumbo, Local 12, Porlamar', phone: '0295-1234567', footer: 'Gracias por preferirnos. Cambios en 48 horas.', logo_url: null, catalog_slug: 'onbike', paper: '58mm' },
  print,
  flags,
  sale: {
    ticket_number: 'ACT-00042', sold_at: '2026-09-24T14:35:00-04:00', cashier_name: 'María Pérez', client_name: 'José Núñez', client_phone: '0414-5551234',
    total_usd: 1234.5, total_bs: 1234567.89, rate: 1000.0055,
    items: [
      { name: 'Franela 200K 2027 Niños', variant_label: '8', description: 'Algodón peinado', quantity: 2, price_per_unit_usd: 4, subtotal_usd: 8, subtotal_bs: 8000.04, discount_usd: 0 },
      { name: 'Antipinchazos', variant_label: null, description: null, quantity: 0.75, price_per_unit_usd: 34, subtotal_usd: 26.5, subtotal_bs: 26500.15, discount_usd: 0 },
    ],
    payments: [{ method: 'Efectivo USD', amount_usd: 1000 }, { method: 'Pago Móvil', amount_usd: 234.5 }],
  },
}
const withFlags = over => ({ ...base, flags: { ...flags, ...over } })
const textOf = lines => lines.filter(l => l.kind === 'text').map(l => l.text)

for (const paper of ['58mm', '80mm']) {
  const cols = colsForPaper(paper)
  for (const [name, data] of [['completo', base], ['solo Bs', withFlags({ show_foreign: false })], ['ambos apagados', withFlags({ show_bs: false, show_foreign: false })]]) {
    const lines = layoutSaleTicket(data, paper, { catalogUrl: 'https://activopos.com/catalogo/onbike' })
    for (const t of textOf(lines)) assert.ok(t.length <= cols, `[${paper}/${name}] línea de ${t.length} > ${cols}: "${t}"`)
    const bytes = encodeTicket(lines, { codepage: 'cp858', openDrawer: true })
    assert.deepEqual([...bytes.slice(0, 5)], [0x1B, 0x40, 0x1B, 0x74, 19], 'ESC @ + ESC t 19 (CP858)')
    assert.deepEqual([...bytes.slice(-4)], [0x1D, 0x56, 0x42, 0x00], 'termina con corte parcial')
    assert.ok(bytes.join(',').includes('27,112,0,25,250'), 'pulso de cajón ESC p')
  }
}

const full = textOf(layoutSaleTicket(base, '58mm')).join('\n')
assert.match(full, /TOTAL USD:\s+\$1234\.50/)            // doble moneda: dólares...
assert.match(full, /TOTAL Bs:\s+Bs\. 1,234,567\.89/)      // ...y bolívares, formato sellado
assert.match(full, /Tasa BCV:\s+1000\.0055/)
assert.ok(full.includes('Cajero: María Pérez') && full.includes('Niños'))   // acentos se conservan (CP858)
assert.ok(full.includes('Sucursal Porlamar'))             // encabezado del negocio

const soloBs = textOf(layoutSaleTicket(withFlags({ show_foreign: false }), '58mm')).join('\n')
assert.ok(!soloBs.includes('TOTAL USD') && soloBs.includes('TOTAL Bs:') && !soloBs.includes('$'))
const ambosOff = textOf(layoutSaleTicket(withFlags({ show_bs: false, show_foreign: false }), '58mm')).join('\n')
assert.ok(ambosOff.includes('TOTAL USD:'), 'nunca un ticket sin ningún monto')

// Code page: ñ Ñ á é í ó ú ü ¿ ¡ en CP858 = A4 A5 A0 82 A1 A2 A3 81 A8 AD ; € = D5 solo en 858
assert.deepEqual(encodeText('ñ Ñ á é í ó ú ü ¿ ¡', 'cp858').filter(c => c > 0x7F), [0xA4, 0xA5, 0xA0, 0x82, 0xA1, 0xA2, 0xA3, 0x81, 0xA8, 0xAD])
assert.deepEqual(encodeText('€', 'cp858'), [0xD5])
assert.deepEqual(encodeText('€', 'cp850'), [0x3F])
assert.deepEqual(encodeText('日', 'cp858'), [0x3F])

// QR y logo: respetan los interruptores
assert.ok(layoutSaleTicket(base, '58mm', { catalogUrl: 'https://x.y' }).some(l => l.kind === 'qr'))
assert.ok(!layoutSaleTicket({ ...base, print: { ...print, show_catalog_qr: false } }, '58mm', { catalogUrl: 'https://x.y' }).some(l => l.kind === 'qr'))
assert.ok(!layoutSaleTicket(base, '58mm').some(l => l.kind === 'logo'))
assert.ok(layoutSaleTicket({ ...base, business: { ...base.business, logo_url: '/uploads/l.png' }, print: { ...print, show_logo: true } }, '58mm').some(l => l.kind === 'logo'))

// Utilidades
assert.deepEqual(wrap('aaaaaaaaaaaa bb', 5), ['aaaaa', 'aaaaa', 'aa bb'])
assert.equal(row('ab', 'cd', 8), 'ab    cd')
assert.equal(row('abcdefgh', '12345', 8), 'ab 12345')

// Ticket de diagnóstico: regla exacta del ancho y línea de acentos
for (const paper of ['58mm', '80mm']) {
  const cols = colsForPaper(paper)
  const t = textOf(layoutTestTicket({ businessName: 'OnBike Margarita', printer: 'POS-58', qzVersion: '2.2.5', paper, codepage: 'cp858', now: new Date('2026-09-24T14:35:00-04:00') }))
  assert.ok(t.some(l => l.length === cols && /^\d+$/.test(l)), 'regla del ancho del papel')
  assert.ok(t.includes('ñ Ñ á é í ó ú ü ¿ ¡') && t.some(l => l.includes('POS-58')) && t.some(l => l.includes('2.2.5')))
  t.forEach(l => assert.ok(l.length <= cols, `diagnóstico ${paper}: "${l}"`))
}

console.log('OK — ticket ESC/POS intacto\n')
console.log('=== VISTA PREVIA 58mm (32 columnas) ===')
console.log('1234567890'.repeat(4).slice(0, 32))
console.log(renderPreview(layoutSaleTicket(base, '58mm', { catalogUrl: 'https://activopos.com/catalogo/onbike' }), '58mm'))
