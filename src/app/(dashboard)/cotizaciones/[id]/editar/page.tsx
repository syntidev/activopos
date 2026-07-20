'use client'

import { useParams } from 'next/navigation'
import { QuotationEditor } from '../../QuotationEditor'

export default function EditarCotizacionPage() {
  const params = useParams<{ id: string }>()

  // Un id basura no se filtra acá: GET /api/quotations/[id] responde 400 y el
  // editor muestra el error y devuelve al listado. Una sola ruta de fallo.
  return <QuotationEditor quotationId={parseInt(params.id, 10)} />
}
