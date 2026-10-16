// Check de src/lib/whatsapp-message.ts. Correr: node scripts/check-whatsapp-message.mjs
import assert from 'node:assert/strict'
import { buildWhatsAppMessage, whatsappUrl, isValidWaPhone, waBs } from '../src/lib/whatsapp-message.ts'

const base = {
  kind: 'pedido', audience: 'client', businessName: 'OnBike', orderNumber: 'ACT-00002',
  clientName: 'Manuel Torres', lines: [{ name: 'Casco', qty: 4, subtotalUsd: 60 }],
  totalUsd: 60, rate: 596.78, paymentMethod: 'Pago móvil',
}
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u

const delivery = buildWhatsAppMessage({ ...base, fulfillment: { type: 'delivery', recipient: 'Ana', address: 'Porlamar' }, sector: 'Los Robles' })
assert.ok(delivery.includes('Dirección: Porlamar'))
assert.ok(delivery.includes('envío a domicilio'))
assert.ok(delivery.includes('$60.00') && delivery.includes('Bs. 35,806.80'))
assert.ok(delivery.includes('ACT-00002') && delivery.includes('Método de pago: Pago móvil'))

const pickup = buildWhatsAppMessage({ ...base, fulfillment: { type: 'pickup' }, sector: 'Los Robles' })
assert.ok(pickup.includes('retiro en tienda'))
assert.ok(!pickup.includes('Dirección:'))   // el sector NO es dirección

for (const m of [delivery, pickup]) {
  assert.ok(!EMOJI.test(m), 'sin emojis')
  assert.ok(!m.includes('Sin especificar'))
}
assert.ok(!buildWhatsAppMessage({ ...base, paymentMethod: null }).includes('Método de pago'))

assert.equal(waBs(15, 596.78), 'Bs. 8,951.70')
assert.equal(isValidWaPhone('0414-1234567'), true)
assert.equal(isValidWaPhone(''), false)
assert.equal(isValidWaPhone('123'), false)
const url = whatsappUrl('0414-1234567', 'Hola & chao\nlínea')
assert.equal(url, 'https://wa.me/584141234567?text=' + encodeURIComponent('Hola & chao\nlínea'))
assert.equal(whatsappUrl(null, 'x'), null)

console.log('check-whatsapp-message: OK')
