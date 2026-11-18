import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { isCatalogLive } from '@/lib/catalog'
import { normalizeTemplate, SLUG_RE, type PlantillaKey } from '@/lib/plantillas'
import { serverCatalogHref } from '@/lib/catalog-links-server'
import { shareMetadata } from '@/lib/og/metadata'
import { isLegalDoc, legalContent, type LegalDoc } from '@/lib/catalog-legal'
import { PlatformCredit } from './PlatformCredit'
import styles from './LegalPage.module.css'

interface LegalPageProps {
  template: PlantillaKey
  doc:      string
  slug:     string
}

/** Enlace del catálogo `slug` en su plantilla: limpio en el dominio propio, /catalogo[-premium|-carta]/<slug>/… en activopos.com. */
function catalogPath(template: PlantillaKey, slug: string, ruta = ''): string {
  return template === 'generic' ? `/catalogo/${slug}${ruta}` : serverCatalogHref(template, slug, ruta)
}

/** Negocio con catálogo vivo y de ESTA plantilla (si no, null → 404). El slug sale de la ruta; ningún dato viene del cliente. */
async function loadLegalBusiness(template: PlantillaKey, slug: string) {
  if (!SLUG_RE.test(slug)) return null
  const business = await prisma.business.findFirst({
    where:  { catalog_slug: slug, catalog_active: true, active: true },
    select: {
      name: true, legal_name: true, rif: true, address: true, city: true, state: true, phone: true, email: true,
      theme_color: true, updated_at: true, catalog_plan: true, catalog_template: true, subscription_active: true, subscription_expires_at: true,
    },
  })
  if (!business || !isCatalogLive(business) || normalizeTemplate(business.catalog_template) !== template) return null
  return business
}

export async function legalMetadata(template: PlantillaKey, doc: string, slug: string): Promise<Metadata> {
  const business = isLegalDoc(doc) ? await loadLegalBusiness(template, slug) : null
  if (!business || !isLegalDoc(doc)) return { title: 'Página no encontrada' }
  const { title, intro } = legalContent(doc, business)
  return shareMetadata({
    title:       `${title} — ${business.name}`,
    description: intro,
    path:        `/c/${slug}/${doc}`,
    imagePath:   `/api/og/portada/${slug}?v=${business.updated_at.getTime()}`,
    imageAlt:    business.name,
    kind:        'website',
  })
}

export async function LegalPage({ template, doc, slug }: LegalPageProps) {
  const business = isLegalDoc(doc) ? await loadLegalBusiness(template, slug) : null
  if (!business || !isLegalDoc(doc)) notFound()
  const content = legalContent(doc, business)
  const other: LegalDoc = doc === 'privacidad' ? 'terminos' : 'privacidad'
  return (
    <div data-theme="light" className={styles.page} data-testid="legal-page" style={business.theme_color ? ({ '--biz-color': business.theme_color } as React.CSSProperties) : undefined}>
      <main className={styles.main}>
        <a href={catalogPath(template, slug)} className={styles.back}>Volver a {business.name}</a>
        <h1 className={styles.title}>{content.title}</h1>
        <p className={styles.intro}>{content.intro}</p>
        {content.sections.map(s => (
          <section key={s.heading} className={styles.section}>
            <h2 className={styles.heading}>{s.heading}</h2>
            {s.paragraphs.map(p => <p key={p} className={styles.text}>{p}</p>)}
          </section>
        ))}
        <a href={catalogPath(template, slug, `/${other}`)} className={styles.other}>
          {other === 'privacidad' ? 'Política de privacidad' : 'Términos y condiciones'}
        </a>
      </main>
      <PlatformCredit slug={slug} />
    </div>
  )
}
