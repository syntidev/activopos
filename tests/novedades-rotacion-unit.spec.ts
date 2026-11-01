import { test, expect } from '@playwright/test'
import { pickDaily, seededShuffle } from '../src/lib/daily-rotation'

/** Unit de la rotación diaria de Novedades (sin navegador ni servidor). */
const P = (id: number, cat: string) => ({ id, categoryName: cat })
const pool = Array.from({ length: 40 }, (_, i) => P(i + 1, ['CAUCHOS', 'TERMOS', 'GELES', 'LENTES', 'TRIPAS'][i % 5]))

test('misma fecha => misma selección; otra fecha => otra selección', () => {
  const a = pickDaily([], pool, '2026-11-01', 8, 2).map(p => p.id)
  const b = pickDaily([], pool, '2026-11-01', 8, 2).map(p => p.id)
  const c = pickDaily([], pool, '2026-11-02', 8, 2).map(p => p.id)
  expect(a).toEqual(b)
  expect(a).not.toEqual(c)
  expect(new Set(a).size).toBe(8)
})

test('respeta el tope por categoría cuando hay variedad', () => {
  const sel = pickDaily([], pool, '2026-11-01', 8, 2)
  const counts = new Map<string, number>()
  for (const p of sel) counts.set(p.categoryName, (counts.get(p.categoryName) ?? 0) + 1)
  for (const n of counts.values()) expect(n).toBeLessThanOrEqual(2)
})

test('los fijados van primero y no se duplican', () => {
  const pinned = [P(100, 'BOLSOS'), P(101, 'BOLSOS')]
  const sel = pickDaily(pinned, [...pool, P(100, 'BOLSOS')], '2026-11-01', 8, 2)
  expect(sel.slice(0, 2).map(p => p.id)).toEqual([100, 101])
  expect(sel.filter(p => p.id === 100)).toHaveLength(1)
})

test('si el tope deja huecos, rellena igual (una sola categoría)', () => {
  const mono = Array.from({ length: 10 }, (_, i) => P(i + 1, 'CAUCHOS'))
  expect(pickDaily([], mono, '2026-11-01', 8, 2)).toHaveLength(8)
})

test('seededShuffle no muta el original', () => {
  const src = [1, 2, 3, 4, 5]
  seededShuffle(src, 'x')
  expect(src).toEqual([1, 2, 3, 4, 5])
})
