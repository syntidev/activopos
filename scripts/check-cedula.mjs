// Check de src/lib/cedula.ts. Correr: node scripts/check-cedula.mjs
import assert from 'node:assert/strict'
import { normalizeCedula, checkCedula, maskCedula } from '../src/lib/cedula.ts'

assert.equal(normalizeCedula('v-12.345.678'), 'V-12345678')
assert.equal(normalizeCedula('e 1234567'), 'E-1234567')
assert.equal(normalizeCedula('12345678'), null)

// Financiadora: solo V/E de 5 a 9 dígitos
assert.deepEqual(checkCedula('V12345678', 'Cashea'), { ok: true, value: 'V-12345678' })
assert.equal(checkCedula('J-123456789', 'Cashea').ok, false)   // rechaza J-
assert.equal(checkCedula('V-1234', 'Cashea').ok, false)        // muy corta
assert.equal(checkCedula('V-1234567890', 'Cashea').ok, false)  // muy larga
assert.equal(checkCedula('', 'Cashea').ok, false)
const msg = checkCedula('', 'Cashea')
assert.ok(!msg.ok && msg.message.startsWith('Cashea necesita tu cédula para crear el enlace de pago'))

// Sin financiadora: opcional, acepta V/E/J
assert.deepEqual(checkCedula('', null), { ok: true, value: null })
assert.deepEqual(checkCedula('J-123456789', null), { ok: true, value: 'J-123456789' })
assert.equal(checkCedula('abc', null).ok, false)

assert.equal(maskCedula('V-12345678'), 'V-****5678')
console.log('check-cedula: OK')
