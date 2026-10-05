import { z } from 'zod'

// Fuente única de tipos para business.cobro_data (Json? en Prisma).
// Vive en src/lib/ -- Next.js tipa route.ts con una lista cerrada de exports
// reconocidos (GET/POST/...), así que un route.ts no puede exportar un schema
// extra sin romper la verificación de tipos de rutas.
//
// Coincide exactamente con CobrosFormData en TabCobros.tsx (la UI que lo
// escribe) y con PATCH /api/config/cobros/data (que lo valida al guardar).
// Antes de este archivo, api/orders/[id]/whatsapp/route.ts declaraba su propia
// interfaz PLANA (pago_movil_telefono, zelle_contacto, binance_id,
// zinli_correo) que nunca existió en lo realmente guardado -- el bloque de
// pago del mensaje de WhatsApp nunca se ejecutaba, y PayPal/USDT ni siquiera
// estaban declarados (bug real 2026-10-05).
const PagoMovilSchema = z.object({
  banco:                z.string().max(10).default(''),
  telefono:             z.string().max(16).default(''),
  usa_whatsapp_negocio: z.boolean().default(false),
  titular:              z.string().max(80).default(''),
  tipo_doc:             z.string().max(2).default('V'),
  documento:            z.string().max(12).default(''),
})

const SimplePaySchema = z.object({
  contacto: z.string().max(120).default(''),
  titular:  z.string().max(80).default(''),
})

const UsdtSchema = z.object({
  wallet:  z.string().max(100).default(''),
  red:     z.string().max(10).default('TRC20'),
  titular: z.string().max(80).default(''),
})

export const CobroDataSchema = z.object({
  pago_movil: PagoMovilSchema.optional(),
  zelle:      SimplePaySchema.optional(),
  zinli:      SimplePaySchema.optional(),
  paypal:     SimplePaySchema.optional(),
  binance:    SimplePaySchema.optional(),
  usdt:       UsdtSchema.optional(),
})
export type CobroData = z.infer<typeof CobroDataSchema>
