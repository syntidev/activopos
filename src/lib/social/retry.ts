/**
 * Reintento con backoff compartido por los dos proveedores del módulo social
 * (Gemini para copy, NVIDIA NIM para imagen). Ambos fallan igual: 429 por cuota,
 * 503 por saturación.
 */

export class ProviderError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ProviderError'
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxRetries?: number; rateLimitWaitMs?: number } = {},
): Promise<T> {
  const maxRetries      = opts.maxRetries ?? 3
  const rateLimitWaitMs = opts.rateLimitWaitMs ?? 65000

  let lastError: unknown
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const status  = err instanceof ProviderError ? err.status : 0
      const message = err instanceof Error ? err.message : ''

      const isRateLimit = status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(message)
      const isTransient = status === 503 || status === 502 || /UNAVAILABLE|high demand/i.test(message)
      if (!(isRateLimit || isTransient) || attempt === maxRetries - 1) throw err

      const wait = isRateLimit ? rateLimitWaitMs : 2000 * 2 ** attempt
      await new Promise(r => setTimeout(r, wait))
    }
  }
  throw lastError
}
