/**
 * Log de errores de servidor SIN volcar el objeto: solo `name` y `message`. El objeto de un error de
 * Prisma arrastra los argumentos de la consulta (cédula, teléfono, dirección del cliente) a los logs.
 * En errores de Prisma el mensaje empieza con el código de la invocación y sus datos; la causa real es
 * la ÚLTIMA línea, y es la única que se conserva.
 */
const MAX_LOG_CHARS = 300

export function errorSummary(err: unknown): string {
  if (!(err instanceof Error)) return 'UnknownError'
  const lines = err.message.split('\n').map(l => l.trim()).filter(Boolean)
  const reason = err.name.startsWith('PrismaClient') ? (lines[lines.length - 1] ?? '') : err.message
  return `${err.name}: ${reason}`.slice(0, MAX_LOG_CHARS)
}

export function logError(tag: string, err: unknown): void {
  console.error(`${tag}: ${errorSummary(err)}`)
}
