import { LegalPage, legalMetadata } from '@/components/catalog/LegalPage'

interface PageProps { params: { slug: string; doc: string } }

export const generateMetadata = ({ params }: PageProps) => legalMetadata('generic', params.doc, params.slug)

/** /catalogo/<slug>/privacidad y /terminos (cualquier otro segmento → 404). */
export default function GenericLegalPage({ params }: PageProps) {
  return <LegalPage template="generic" doc={params.doc} slug={params.slug} />
}
