import { RateLimiterMemory } from 'rate-limiter-flexible'

// RateLimiterMemory no es cluster-safe — pendiente Redis en producción
export const loginLimiter = new RateLimiterMemory({
  points:   5,    // 5 intentos por IP
  duration: 900,  // en 15 minutos (900 s)
})

// Segunda capa: por email — sobrevive rotación de IPs / spoofing de XFF
export const loginEmailLimiter = new RateLimiterMemory({
  points:   10,   // 10 intentos por email
  duration: 900,  // en 15 minutos (900 s)
})

export const catalogLimiter = new RateLimiterMemory({
  points:   60,   // 60 requests
  duration: 60,   // por minuto
})

// Preferir cf-connecting-ip (Cloudflare lo fija, no es spoofable por el cliente)
// antes de x-forwarded-for (el cliente puede inyectar entradas adicionales)
export const getClientIp = (req: Request): string =>
  req.headers.get('cf-connecting-ip')?.trim()
  ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  ?? req.headers.get('x-real-ip')?.trim()
  ?? '127.0.0.1'
