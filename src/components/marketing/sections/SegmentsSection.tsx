import Link from 'next/link'
import { ArrowRight, Receipt } from 'lucide-react'
import type { CSSProperties } from 'react'
import SegmentIcon from '@/components/marketing/shared/SegmentIcon'
import RevealSection from '@/components/marketing/shared/RevealSection'
import styles from './SegmentsSection.module.css'

interface ApiSegment {
  slug:      string
  name:      string
  tag_line:  string
  theme_key: string
}

// Acento visual por theme_key — mismo set de 10 colores ya sellado en
// tokens.css (#dashboard-root[data-color="..."] → --color-brand), reusado
// aquí vía CSS var inline (mismo patrón que --biz-color en el catálogo
// público) porque esos bloques están scoped a #dashboard-root, no a marketing.
const THEME_ACCENT: Record<string, string> = {
  'azul-sereno':   '#60A5FA',
  amanecer:        '#FB923C',
  aguamarina:      '#34D399',
  medianoche:      '#818CF8',
  'tierra-dorada': '#FCD34D',
  'brasa-viva':    '#FB7185',
  'cielo-abierto': '#7DD3FC',
  'menta-fresca':  '#6EE7B7',
  champan:         '#E9D5A1',
  jardin:          '#86EFAC',
}

// Server Component — fetch al propio endpoint público en vez de Prisma directo
// (pedido explícito del sprint: reusar el mismo contrato que /segmentos y el
// nav dropdown consumen, no duplicar la query).
async function getSegments(): Promise<ApiSegment[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/marketing/segments`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    return await res.json() as ApiSegment[]
  } catch {
    return []
  }
}

export default async function SegmentsSection() {
  const segments = (await getSegments()).slice(0, 10)

  return (
    <section className={styles.section} id="segmentos">
      <RevealSection>
        <h2 className={styles.headline}>
          Si produces, vendes o prestas un servicio<br />en Venezuela, esto es para ti.
        </h2>
        {segments.length > 0 && (
          <>
            <div className={styles.grid}>
              {segments.map(seg => {
                const accent = THEME_ACCENT[seg.theme_key]
                const cardStyle = accent ? ({ '--seg-accent': accent } as CSSProperties) : undefined
                return (
                  <Link
                    key={seg.slug}
                    href={`/para-${seg.slug}`}
                    className={styles.card}
                    style={cardStyle}
                  >
                    <span className={styles.cardIcon}>
                      <SegmentIcon slug={seg.slug} size={22} />
                    </span>
                    <span className={styles.cardName}>{seg.name}</span>
                    <span className={styles.cardTag}>{seg.tag_line}</span>
                  </Link>
                )
              })}

              <div className={styles.featured}>
                <span className={styles.featuredIcon}>
                  <Receipt size={22} aria-hidden="true" />
                </span>
                <span className={styles.featuredTitle}>¿Prestas un servicio profesional?</span>
                <p className={styles.featuredDesc}>
                  Ticket para el mostrador. Carta para tu cotización. Tú eliges el formato — nosotros
                  no generamos tu factura fiscal, te ayudamos a controlar antes de que llegue a tu contador.
                </p>
              </div>
            </div>

            <div className={styles.moreWrap}>
              <Link href="/segmentos" className={styles.moreLink}>
                Ver todos los segmentos
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </>
        )}
      </RevealSection>
    </section>
  )
}
