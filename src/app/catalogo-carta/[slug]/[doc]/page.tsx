import { LegalPage, legalMetadata } from '@/components/catalog/LegalPage'

interface PageProps { params: { slug: string; doc: string } }

export const generateMetadata = ({ params }: PageProps) => legalMetadata('carta', params.doc, params.slug)

/** /catalogo-carta/<slug>/privacidad y /terminos (cualquier otro segmento → 404). */
export default function CartaLegalPage({ params }: PageProps) {
  return <LegalPage template="carta" doc={params.doc} slug={params.slug} />
}
