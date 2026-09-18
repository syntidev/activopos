'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, PackageSearch } from 'lucide-react'
import type {
  RenderableLandingSection, HeroConfig, EventSliderConfig, CommunityConfig, StoryConfig,
  CollectionGridRenderConfig,
} from '@/lib/landing-sections'
import { ImgWithFallback } from './ImgWithFallback'
import styles from './catalogo.module.css'

interface Props {
  sections: RenderableLandingSection[]
  slug:     string
}

const SLIDER_INTERVAL_MS = 6000

export function LandingSections({ sections, slug }: Props) {
  if (sections.length === 0) return null
  return (
    <>
      {sections.map(s => {
        switch (s.type) {
          case 'hero':            return <HeroSection          key={s.id} config={s.config} />
          case 'event_slider':    return <EventSlider          key={s.id} config={s.config} />
          case 'community':       return <CommunitySection     key={s.id} config={s.config} />
          case 'story':           return <StorySection         key={s.id} config={s.config} />
          case 'collection_grid': return <CollectionGridSection key={s.id} config={s.config} slug={slug} />
          default:                 return null
        }
      })}
    </>
  )
}

/* ── HERO ────────────────────────────────────────────────────────────── */

function HeroSection({ config }: { config: HeroConfig }) {
  return (
    <section className={styles.lsHero}>
      {config.video_url ? (
        <video className={styles.lsHeroMedia} src={config.video_url} autoPlay muted loop playsInline />
      ) : (
        <ImgWithFallback
          src={config.image_url}
          className={styles.lsHeroMedia}
          fallback={
            <div className={styles.lsHeroMediaPlaceholder} aria-hidden="true">
              <span>{(config.title || 'H').charAt(0).toUpperCase()}</span>
            </div>
          }
        />
      )}
      <div className={styles.lsHeroScrim} aria-hidden="true" />
      <div className={styles.lsHeroContent}>
        <h1 className={styles.lsHeroTitle}>{config.title}</h1>
        <p className={styles.lsHeroSubtitle}>{config.subtitle}</p>
        <a href={config.cta_link} className={styles.lsHeroCta}>{config.cta_text}</a>
      </div>
    </section>
  )
}

/* ── EVENT SLIDER — carrusel real, autoplay 6s, pausa en hover ────────── */

function EventSlider({ config }: { config: EventSliderConfig }) {
  const [idx, setIdx]       = useState(0)
  const [paused, setPaused] = useState(false)
  const total                = config.slides.length
  const reducedMotion        = useReducedMotion()
  const fadeDuration          = reducedMotion ? 0 : 0.7

  useEffect(() => {
    if (paused || total <= 1) return
    const t = setInterval(() => setIdx(i => (i + 1) % total), SLIDER_INTERVAL_MS)
    return () => clearInterval(t)
  }, [paused, total])

  const slide = config.slides[idx]

  return (
    <section
      className={styles.lsSlider}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carrusel"
    >
      {/* mode="sync" -> entrada y salida corren a la vez (crossfade real, no
          secuencial). Imagen y contenido viven en la misma capa: se
          desvanecen juntos con un solo transition. */}
      <AnimatePresence mode="sync">
        <motion.div
          key={idx}
          className={styles.lsSlideLayer}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: fadeDuration, ease: 'easeInOut' }}
        >
          <ImgWithFallback
            src={slide.image_url}
            className={styles.lsSliderImg}
            fallback={
              <div className={styles.lsSliderImgPlaceholder} aria-hidden="true">
                <span>{(slide.title || 'E').charAt(0).toUpperCase()}</span>
              </div>
            }
          />
          <div className={styles.lsSliderScrim} aria-hidden="true" />
          <div className={styles.lsSliderContent}>
            <h2 className={styles.lsSliderTitle}>{slide.title}</h2>
            <p className={styles.lsSliderSubtitle}>{slide.subtitle}</p>
            <a href={slide.cta_link} className={styles.lsSliderCta}>{slide.cta_text}</a>
          </div>
        </motion.div>
      </AnimatePresence>

      {total > 1 && (
        <>
          <button
            type="button"
            className={`${styles.lsSliderArrow} ${styles.lsSliderArrowPrev}`}
            onClick={() => setIdx(i => (i - 1 + total) % total)}
            aria-label="Slide anterior"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`${styles.lsSliderArrow} ${styles.lsSliderArrowNext}`}
            onClick={() => setIdx(i => (i + 1) % total)}
            aria-label="Slide siguiente"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <div className={styles.lsSliderDots} aria-hidden="true">
            {config.slides.map((_, i) => (
              <span key={i} className={`${styles.lsSliderDot} ${i === idx ? styles.lsSliderDotActive : ''}`} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

/* ── COMMUNITY ───────────────────────────────────────────────────────── */

function CommunitySection({ config }: { config: CommunityConfig }) {
  return (
    <section className={styles.lsCommunity}>
      <h2 className={styles.lsCommunityHeading}>{config.heading}</h2>
      <p className={styles.lsCommunitySubheading}>{config.subheading}</p>
      <div className={styles.lsCommunityGrid}>
        {config.items.map((item, i) => (
          <div key={i} className={styles.lsCommunityItem}>
            <ImgWithFallback
              src={item.image_url}
              className={styles.lsCommunityImg}
              loading="lazy"
              fallback={
                <div className={styles.lsCommunityImgPlaceholder} aria-hidden="true">
                  <span>{(item.product_tag || 'C').charAt(0).toUpperCase()}</span>
                </div>
              }
            />
            <span className={styles.lsCommunityTag}>{item.product_tag}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── COLLECTION GRID — carrusel horizontal, productos de la colección ──── */

function CollectionGridSection({ config, slug }: { config: CollectionGridRenderConfig; slug: string }) {
  if (config.products.length === 0) {
    return (
      <section className={styles.lsCollection}>
        <h2 className={styles.lsCollectionHeading}>{config.collection_name}</h2>
        <div className={styles.lsCollectionEmpty}>
          <PackageSearch size={28} strokeWidth={1.5} aria-hidden="true" />
          <p>Muy pronto los productos de esta colección.</p>
        </div>
      </section>
    )
  }

  return (
    <section className={styles.lsCollection}>
      <h2 className={styles.lsCollectionHeading}>{config.collection_name}</h2>
      <div className={styles.lsCollectionScroll}>
        {config.products.map(p => (
          <a key={p.id} href={`/catalogo-premium/${slug}/p/${p.id}`} className={styles.lsCollectionCard}>
            {p.image ? (
              <img src={p.image} alt="" className={styles.lsCollectionImg} loading="lazy" aria-hidden="true" />
            ) : (
              <div className={styles.lsCollectionImgPlaceholder} aria-hidden="true">
                <span>{p.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <span className={styles.lsCollectionName}>{p.name}</span>
            {p.priceUsd > 0 && (
              <span className={styles.lsCollectionPrice}>
                <span>${p.priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                {p.priceBs && (
                  <span className={styles.lsCollectionPriceBs}>
                    Bs.&nbsp;{p.priceBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </span>
            )}
          </a>
        ))}
      </div>
    </section>
  )
}

/* ── STORY ───────────────────────────────────────────────────────────── */

function StorySection({ config }: { config: StoryConfig }) {
  return (
    <section className={styles.lsStory}>
      <div className={styles.lsStoryText}>
        <span className={styles.lsStoryEyebrow}>{config.eyebrow}</span>
        <h2 className={styles.lsStoryTitle}>{config.title}</h2>
        <p className={styles.lsStoryBody}>{config.body}</p>
      </div>
      <div className={styles.lsStoryMedia}>
        <ImgWithFallback
          src={config.image_url}
          className={styles.lsStoryImg}
          loading="lazy"
          fallback={
            <div className={styles.lsStoryImgPlaceholder} aria-hidden="true">
              <span>{(config.title || 'S').charAt(0).toUpperCase()}</span>
            </div>
          }
        />
      </div>
    </section>
  )
}
