// Check de la plantilla térmica (src/lib/thermal-ticket.ts).
// Correr: node scripts/check-thermal-ticket.mjs   (Node >= 22.18: importa el .ts directo)
// Falla si una línea excede el ancho del papel, si se cuela un carácter no ASCII
// (acento => basura según la code page de la impresora), o si cambia la regla de
// doble moneda. Además IMPRIME el ticket renderizado para revisarlo a ojo.
import assert from 'node:assert/strict'
import { buildThermalTicket, buildTestTicket, colsForPaper, toPrinterText, wrap, row } from '../src/lib/thermal-ticket.ts'

// Quita las secuencias ESC/POS que emite la plantilla para ver lo que se imprime.
const strip = s => s.replace(/\x1B@|\x1BE[\x00\x01]|\x1Bd[\x00-\x09]|\x1DV\x42\x00/g, '')
const lines = s => strip(s).split('\n')

const flags = {
  show_description: false, show_bs: true, show_foreign: true, foreign_format: 'usd',
  show_address: true, show_phone: true, show_customer_data: true, show_rif: true,
  show_cashier_name: true, show_bcv_rate: true, show_payment_method: true,
}
const base = {
  business: { name: 'OnBike Margarita', rif: 'J-12345678-9', address: 'Av. 4 de Mayo, C.C. Jumbo, Local 12, Porlamar', phone: '0295-1234567', footer: 'Gracias por preferirnos. Cambios en 48 horas.' },
  flags,
  sale: {
    ticket_number: 'ACT-00042', sold_at: '2026-09-24T14:35:00-04:00', cashier_name: 'María Pérez', client_name: 'José Núñez', client_phone: '0414-5551234',
    total_usd: 1234.5, total_bs: 1234567.89, rate: 1000.0055,
    items: [
      { name: 'Franela 200K 2027 Niños', variant_label: '8', description: 'Algodón peinado', quantity: 2, price_per_unit_usd: 4, subtotal_usd: 8, subtotal_bs: 8000.04, discount_usd: 0 },
      { name: 'Bicicleta Giant Talon 3 Aro 29 Edición Especial', variant_label: null, description: null, quantity: 1, price_per_unit_usd: 1200, subtotal_usd: 1200, subtotal_bs: 1200006.6, discount_usd: 50 },
      { name: 'Antipinchazos', variant_label: null, description: null, quantity: 0.75, price_per_unit_usd: 34, subtotal_usd: 26.5, subtotal_bs: 26500.15, discount_usd: 0 },
    ],
    payments: [{ method: 'Efectivo USD', amount_usd: 1000 }, { method: 'Pago Móvil', amount_usd: 234.5 }],
  },
}
const withFlags = over => ({ ...base, flags: { ...flags, ...over } })

for (const paper of ['58mm', '80mm']) {
  const cols = colsForPaper(paper)
  for (const [name, data] of [['completo', base], ['solo Bs', withFlags({ show_foreign: false })], ['solo divisas REF', withFlags({ show_bs: false, foreign_format: 'ref', show_description: true })], ['ambos apagados', withFlags({ show_bs: false, show_foreign: false })]]) {
    const out = buildThermalTicket(data, paper)
    assert.ok(out.startsWith('\x1B@'), 'debe iniciar la impresora (ESC @)')
    assert.ok(out.endsWith('\x1DV\x42\x00'), 'debe terminar con corte')
    for (const l of lines(out)) {
      assert.ok(l.length <= cols, `[${paper}/${name}] línea de ${l.length} > ${cols}: "${l}"`)
      assert.ok(/^[\x20-\x7E]*$/.test(l), `[${paper}/${name}] carácter no ASCII: "${l}"`)
    }
  }
}

const full = lines(buildThermalTicket(base, '58mm')).join('\n')
assert.match(full, /TOTAL USD:\s+\$1234\.50/)              // doble moneda: dólares...
assert.match(full, /TOTAL Bs:\s+Bs\. 1,234,567\.89/)        // ...y bolívares, formato sellado
assert.match(full, /Tasa BCV:\s+1000\.0055/)
assert.ok(full.includes('Franela 200K 2027 Ninos (8)'))     // sin ñ, con la talla
assert.ok(full.includes('Cajero: Maria Perez'))
assert.ok(!/[ñáéíóúÑ]/.test(full))
assert.ok(full.includes('0.75 x $34.00'))                    // cantidad decimal (peso)
assert.ok(full.includes('Desc.:') && full.includes('-$50.00'))

const soloBs = lines(buildThermalTicket(withFlags({ show_foreign: false }), '58mm')).join('\n')
assert.ok(!soloBs.includes('TOTAL USD') && soloBs.includes('TOTAL Bs:') && !soloBs.includes('$'))   // sin divisas: todo en Bs

const ambosOff = lines(buildThermalTicket(withFlags({ show_bs: false, show_foreign: false }), '58mm')).join('\n')
assert.ok(ambosOff.includes('TOTAL USD:'), 'nunca un ticket sin ningún monto')

const ref = lines(buildThermalTicket(withFlags({ show_bs: false, foreign_format: 'ref' }), '58mm')).join('\n')
assert.ok(ref.includes('TOTAL REF:') && ref.includes('REF 1234.50') && !ref.includes('TOTAL USD'))

// Utilidades
assert.equal(toPrinterText('Niño ¿Qué? — “ok” ×2'), 'Nino Que? - "ok" x2')
assert.deepEqual(wrap('aaaaaaaaaaaa bb', 5), ['aaaaa', 'aaaaa', 'aa bb'])
assert.equal(row('ab', 'cd', 8), 'ab    cd')
assert.equal(row('abcdefgh', '12345', 8), 'ab 12345')   // recorta la izquierda y cabe justo en 8

// Ticket de prueba: contiene lo pedido y una regla de exactamente `cols`.
for (const paper of ['58mm', '80mm']) {
  const t = lines(buildTestTicket('OnBike Margarita', paper, new Date('2026-09-24T14:35:00-04:00')))
  const cols = colsForPaper(paper)
  assert.ok(t.some(l => l.includes('PRUEBA DE IMPRESION')) && t.some(l => l.includes('OnBike'.toUpperCase())))
  assert.ok(t.some(l => l.length === cols && /^\d+$/.test(l)), 'regla del ancho del papel')
  t.forEach(l => assert.ok(l.length <= cols && /^[\x20-\x7E]*$/.test(l)))
}

const ruler = n => '1234567890'.repeat(Math.ceil(n / 10)).slice(0, n)
console.log('OK — plantilla térmica intacta\n')
console.log('=== TICKET DE VENTA, 58mm (32 columnas) — así sale, línea por línea ===')
console.log(ruler(32)); lines(buildThermalTicket(base, '58mm')).forEach(l => console.log(l))
console.log('\n=== TICKET DE PRUEBA, 58mm ===')
console.log(ruler(32)); lines(buildTestTicket('OnBike Margarita', '58mm', new Date('2026-09-24T14:35:00-04:00'))).forEach(l => console.log(l))
