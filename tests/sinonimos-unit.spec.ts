import { test, expect } from '@playwright/test'
import { expandWord, matchesWords, readSynonyms, synonymsInputSchema } from '../src/lib/search-synonyms'
import { parseSearch, productSearchWhere } from '../src/lib/product-search'

/** Unit de la expansión de sinónimos (sin navegador ni servidor). */
const G = [['maillot', 'jersey', 'camisa', 'franela de ciclismo'], ['medias', 'calcetines']]

test('expandWord: incluye el grupo, ignora tildes/mayúsculas y no inventa', () => {
  expect(expandWord('MAILLOT', G).sort()).toEqual(['camisa', 'franela de ciclismo', 'jersey', 'maillot'])
  expect(expandWord('Calcetines', G).sort()).toEqual(['calcetines', 'medias'])
  expect(expandWord('casco', G)).toEqual(['casco'])
  expect(expandWord('casco', [])).toEqual(['casco'])
})

test('matchesWords: O dentro del grupo, Y entre palabras, frases incluidas', () => {
  const t = 'zz camisa de ciclismo talla m'
  expect(matchesWords(t, 'maillot', G)).toBe(true)
  expect(matchesWords(t, 'maillot talla', G)).toBe(true)
  expect(matchesWords(t, 'maillot rojo', G)).toBe(false)                  // Y entre palabras
  expect(matchesWords('zz franela de ciclismo', 'jersey', G)).toBe(true)  // frase del grupo
  expect(matchesWords(t, 'jersey', [])).toBe(false)                       // sin grupos = comportamiento de siempre
  expect(matchesWords(t, 'camisa talla', [])).toBe(true)
  expect(matchesWords('zz smartwatch', 'reloj inteligente', [['reloj', 'smartwatch', 'reloj inteligente']])).toBe(true) // consulta = frase del grupo
})

test('schema: normaliza, deduplica y valida límites', () => {
  expect(synonymsInputSchema.parse([['  MAILLÓT ', 'maillot', 'Jersey']])).toEqual([['maillot', 'jersey']])
  expect(synonymsInputSchema.safeParse([['solo']]).success).toBe(false)
  expect(synonymsInputSchema.safeParse([['a', '']]).success).toBe(false)
  expect(synonymsInputSchema.safeParse([['a', 'x'.repeat(41)]]).success).toBe(false)
  expect(synonymsInputSchema.safeParse([Array.from({ length: 13 }, (_, i) => `t${i}`)]).success).toBe(false)
  expect(synonymsInputSchema.safeParse(Array.from({ length: 61 }, () => ['a', 'b'])).success).toBe(false)
  expect(synonymsInputSchema.safeParse(Array.from({ length: 60 }, () => ['a', 'b'])).success).toBe(true)
})

test('readSynonyms: tolerante (descarta lo inválido, nunca lanza)', () => {
  expect(readSynonyms(null)).toEqual([])
  expect(readSynonyms({ search_synonyms: 'x' })).toEqual([])
  expect(readSynonyms({ search_synonyms: [['Medias', 'calcetines'], ['solo'], 5] })).toEqual([['medias', 'calcetines']])
})

test('productSearchWhere: sin grupos idéntico; con grupos añade términos del grupo', () => {
  const p = parseSearch('maillot')
  expect(JSON.stringify(productSearchWhere(p, []))).toBe(JSON.stringify(productSearchWhere(p)))
  const con = JSON.stringify(productSearchWhere(p, G))
  expect(con).toContain('"contains":"jersey"')
  expect(con).toContain('"contains":"franela de ciclismo"')
})
