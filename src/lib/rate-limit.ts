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

export const onboardingLimiter = new RateLimiterMemory({
  points:   3,    // 3 registros por IP
  duration: 3600, // en 1 hora
})

// Separado de onboardingLimiter — probar slugs no debe agotar el límite de registro
export const slugCheckLimiter = new RateLimiterMemory({
  points:   20,   // 20 verificaciones por IP
  duration: 3600, // en 1 hora
})

export const aiChatLimiter = new RateLimiterMemory({
  points:   20,   // 20 mensajes por minuto por usuario
  duration: 60,
})

export const ratesLimiter = new RateLimiterMemory({
  points:   30,   // 30 requests por IP
  duration: 60,   // por minuto
})

export const uploadLimiter = new RateLimiterMemory({
  points:   20,   // 20 uploads por IP
  duration: 60,   // por minuto
})

// Preferir cf-connecting-ip (Cloudflare lo fija, no es spoofable por el cliente)
// antes de x-forwarded-for (el cliente puede inyectar entradas adicionales)
export const getClientIp = (req: Request): string =>
  req.headers.get('cf-connecting-ip')?.trim()
  ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  ?? req.headers.get('x-real-ip')?.trim()
  ?? '127.0.0.1'
