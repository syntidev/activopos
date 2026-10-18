import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { getSession } from '@/lib/auth'
import { isLabelCaptureSession } from '@/lib/label-capture'

/**
 * Puerta del lado servidor de /captura-etiquetas: solo role 'admin' de un negocio listado
 * en LABEL_CAPTURE_BUSINESS_IDS. Para cualquier otro la ruta no existe (404).
 */
export default async function CapturaEtiquetasLayout({ children }: { children: ReactNode }) {
  if (!isLabelCaptureSession(await getSession())) notFound()
  return <>{children}</>
}
