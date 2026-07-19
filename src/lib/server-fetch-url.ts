/**
 * Base URL para fetch() SERVER-SIDE a los propios endpoints internos (Server
 * Components pidiendo su propia API -- no pueden usar rutas relativas).
 *
 * Server: puerto local directo. process.env.PORT es el mismo que
 * ecosystem.config.js inyecta vía PM2 en prod (3003) y el default de
 * `next dev` en local (3000, sin PORT seteado) -- se adapta solo, no hardcodea
 * un puerto que rompería el otro entorno.
 *
 * Bug real corregido (2026-07-19, confirmado con curl directo en VPS): antes
 * se usaba NEXT_PUBLIC_APP_URL también del lado servidor, así que este fetch
 * salía por Cloudflare y volvía a pegarle al propio proceso -- loop
 * innecesario que Cloudflare bloqueaba/limitaba (tráfico sin headers de
 * navegador real, parece originarse del propio servidor), devolviendo array
 * vacío en producción pese a que curl directo a localhost:3003 respondía 200
 * con datos completos.
 *
 * Client: NEXT_PUBLIC_APP_URL (URL pública real) -- nunca se deriva del
 * header Host de la request, que es spoofeable por el cliente y permitiría
 * SSRF si se usara esa vía en cambio.
 */
export function internalBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.INTERNAL_API_URL ?? `http://localhost:${process.env.PORT ?? '3000'}`
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}
