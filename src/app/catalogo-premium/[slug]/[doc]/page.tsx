import { LegalPage, legalMetadata } from '@/components/catalog/LegalPage'

interface PageProps { params: { slug: string; doc: string } }

export const generateMetadata = ({ params }: PageProps) => legalMetadata('premium', params.doc, params.slug)

/** /catalogo-premium/<slug>/privacidad y /terminos (cualquier otro segmento → 404). */
export default function PremiumLegalPage({ params }: PageProps) {
  return <LegalPage template="premium" doc={params.doc} slug={params.slug} />
}
