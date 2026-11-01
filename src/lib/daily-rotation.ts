/**
 * Rotación diaria determinista (vitrina "Novedades" del catálogo premium).
 * Misma fecha de negocio (America/Caracas) => misma selección para todos los
 * visitantes y en servidor/cliente (sin parpadeo de hidratación); cambia a
 * medianoche de Caracas. Funciones puras, sin dependencias.
 */

/** Hash FNV-1a de 32 bits: convierte la clave del día en semilla numérica. */
function hashSeed(key: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** PRNG mulberry32: misma semilla, misma secuencia. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher-Yates con semilla: no muta el arreglo original. */
export function seededShuffle<T>(items: readonly T[], seedKey: string): T[] {
  const out = [...items]
  const rnd = mulberry32(hashSeed(seedKey))
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export interface RotationItem {
  id:           number
  categoryName: string | null
}

/**
 * Toma `pinned` primero (en su orden) y completa con `pool` barajado del día,
 * con un tope de `maxPerCategory` por categoría. Si el tope deja huecos, los
 * rellena con lo que sobró del pool (la sección nunca queda corta por el tope).
 */
export function pickDaily<T extends RotationItem>(
  pinned: readonly T[], pool: readonly T[], dayKey: string, count: number, maxPerCategory: number,
): T[] {
  const picked: T[] = []
  const used = new Set<number>()
  const perCat = new Map<string, number>()
  const take = (p: T): void => {
    picked.push(p)
    used.add(p.id)
    const c = p.categoryName ?? ''
    perCat.set(c, (perCat.get(c) ?? 0) + 1)
  }
  for (const p of pinned) {
    if (picked.length >= count) break
    if (!used.has(p.id)) take(p)
  }
  const shuffled = seededShuffle(pool.filter(p => !used.has(p.id)), dayKey)
  for (const p of shuffled) {
    if (picked.length >= count) break
    if ((perCat.get(p.categoryName ?? '') ?? 0) < maxPerCategory) take(p)
  }
  for (const p of shuffled) {
    if (picked.length >= count) break
    if (!used.has(p.id)) take(p)
  }
  return picked
}
