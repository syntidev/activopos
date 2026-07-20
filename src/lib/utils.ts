// wa.me exige código de país. Los teléfonos se guardan como los escribe el
// negocio: 0414-1234567, +58 412 1234567, 4141234567. Sin 58 al frente el
// enlace abre un chat con un número inexistente.
export function normalizePhone(phone: string): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''            // sin teléfono: wa.me/ abre sin destinatario
  if (digits.startsWith('0'))  return '58' + digits.slice(1)
  if (digits.startsWith('58')) return digits
  return '58' + digits
}
