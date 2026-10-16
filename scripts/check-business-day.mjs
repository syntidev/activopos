// Check de src/lib/business-day.ts (día de negocio America/Caracas, UTC-4).
// Correr: node scripts/check-business-day.mjs   (Node >= 22: carga el .ts directo)
import assert from 'node:assert/strict'
import {
  businessDateKey, businessDayRange, businessRange, businessMonthRange,
  businessMonthKey, businessOffsetHours, shiftDateKey, businessHour, fromBound, toBoundExclusive,
} from '../src/lib/business-day.ts'

const inDay = (iso, key) => {
  const t = new Date(iso).getTime()
  const { start, end } = businessDayRange(key)
  return t >= start.getTime() && t < end.getTime()
}

// Venta 7:58 pm Caracas del día 15 = 23:58Z del 15. Debe caer en "hoy" = 15.
assert.equal(businessDateKey(new Date('2026-10-15T23:58:00Z')), '2026-10-15')
assert.ok(inDay('2026-10-15T23:58:00Z', '2026-10-15'))
assert.ok(!inDay('2026-10-15T23:58:00Z', '2026-10-16'))

// 01:14Z del día 16 = 9:14 pm del 15 en Caracas: sigue siendo día 15.
assert.equal(businessDateKey(new Date('2026-10-16T01:14:00Z')), '2026-10-15')
assert.ok(inDay('2026-10-16T01:14:00Z', '2026-10-15'))

// Frontera: 04:00Z = 00:00 Caracas ya es el día 16; 03:59:59Z aún es el 15.
assert.equal(businessDateKey(new Date('2026-10-16T04:00:00Z')), '2026-10-16')
assert.equal(businessDateKey(new Date('2026-10-16T03:59:59Z')), '2026-10-15')

// El día arranca a las 04:00Z.
assert.equal(businessDayRange('2026-10-15').start.toISOString(), '2026-10-15T04:00:00.000Z')
assert.equal(businessDayRange('2026-10-15').end.toISOString(), '2026-10-16T04:00:00.000Z')

// Rango inclusivo from..to y mes (incluye cambio de año).
assert.equal(businessRange('2026-10-09', '2026-10-15').end.toISOString(), '2026-10-16T04:00:00.000Z')
assert.equal(businessMonthRange('2026-12').end.toISOString(), '2027-01-01T04:00:00.000Z')
assert.equal(businessMonthRange('2026-10').start.toISOString(), '2026-10-01T04:00:00.000Z')
assert.equal(businessMonthKey(new Date('2026-01-01T02:00:00Z')), '2025-12') // 1-ene 02:00Z = 31-dic 22:00 Caracas
assert.equal(businessMonthKey(new Date('2026-01-15T12:00:00Z'), 1), '2025-12')
assert.equal(shiftDateKey('2026-03-01', -1), '2026-02-28')
assert.equal(businessOffsetHours(), -4)

assert.equal(businessHour(new Date('2026-10-15T23:58:00Z')), 19)
assert.equal(businessHour(new Date('2026-10-16T01:14:00Z')), 21)
assert.equal(businessHour(new Date('2026-10-16T04:00:00Z')), 0)
assert.equal(fromBound('2026-10-15').toISOString(), '2026-10-15T04:00:00.000Z')
assert.equal(toBoundExclusive('2026-10-15').toISOString(), '2026-10-16T04:00:00.000Z')

console.log('check-business-day: OK')
