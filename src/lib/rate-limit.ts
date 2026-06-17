import { RateLimiterMemory } from 'rate-limiter-flexible'

export const loginLimiter = new RateLimiterMemory({
  points:   5,    // 5 intentos
  duration: 900,  // en 15 minutos (900 s)
})

export const catalogLimiter = new RateLimiterMemory({
  points:   60,   // 60 requests
  duration: 60,   // por minuto
})

export const getClientIp = (req: Request): string =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  ?? req.headers.get('x-real-ip')
  ?? '127.0.0.1'
