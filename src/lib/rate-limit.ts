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

// Checkout público (POST /api/catalog/[slug]/order). Todos son RateLimiterMemory: por PROCESO, no
// compartidos entre instancias PM2 (en cluster de N procesos el tope efectivo es hasta N veces mayor).
// La defensa que SÍ es consistente entre procesos es la de DB: máx. 3 pedidos 'received' por cédula/teléfono.
export const catalogOrderIpLimiter = new RateLimiterMemory({
  points:   10,   // 10 pedidos por IP
  duration: 900,  // en 15 minutos
})

export const catalogOrderPhoneLimiter = new RateLimiterMemory({
  points:   6,    // 6 pedidos por teléfono (llave slug:teléfono)
  duration: 3600, // en 1 hora
})

// Consulta "¿hay dirección guardada?" (POST /api/catalog/[slug]/saved-address): anti-enumeración de cédulas.
export const savedAddressIpLimiter = new RateLimiterMemory({
  points:   10,   // 10 consultas por IP
  duration: 900,  // en 15 minutos
})

export const savedAddressCedulaLimiter = new RateLimiterMemory({
  points:   5,    // 5 consultas por slug+cédula
  duration: 3600, // en 1 hora
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

// Landing pública de reservas (ej. /kit-200k) — sin sesión, mismo criterio que catalogLimiter
export const reservaPublicLimiter = new RateLimiterMemory({
  points:   10,   // 10 reservas por IP
  duration: 3600, // en 1 hora
})

// Firma de mensajes de QZ Tray (/api/qz/sign): con sesión, se limita por USUARIO,
// no por IP -- varios cajeros comparten la IP del local. QZ firma una llamada por
// operación (conectar, listar, imprimir), así que 120/min sobra para un POS real
// y frena a quien use el endpoint como oráculo de firmas.
export const qzSignLimiter = new RateLimiterMemory({
  points:   120,  // 120 firmas por usuario
  duration: 60,   // por minuto
})

// Lectura de etiquetas con visión (/api/label-capture/ocr): con sesión, se limita por USUARIO.
// Cada llamada cuesta una inferencia en NVIDIA; 30/min sobra para fotografiar a mano.
export const labelOcrLimiter = new RateLimiterMemory({
  points:   30,   // 30 lecturas por usuario
  duration: 60,   // por minuto
})

// Alta rápida (/api/quick-add/lookup): cada consulta puede salir a bases públicas externas.
export const quickAddLookupLimiter = new RateLimiterMemory({
  points:   60,   // 60 consultas por usuario
  duration: 60,   // por minuto
})

// Preferir cf-connecting-ip (Cloudflare lo fija, no es spoofable por el cliente)
// antes de x-forwarded-for (el cliente puede inyectar entradas adicionales)
export const getClientIp = (req: Request): string =>
  req.headers.get('cf-connecting-ip')?.trim()
  ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  ?? req.headers.get('x-real-ip')?.trim()
  ?? '127.0.0.1'
