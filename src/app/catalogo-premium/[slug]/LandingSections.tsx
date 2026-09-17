'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type {
  RenderableLandingSection, HeroConfig, EventSliderConfig, CommunityConfig, StoryConfig,
} from '@/lib/landing-sections'
import styles from './catalogo.module.css'

interface Props {
  sections: RenderableLandingSection[]
}

const SLIDER_INTERVAL_MS = 6000

export function LandingSections({ sections }: Props) {
  if (sections.length === 0) return null
  return (
    <>
      {sections.map(s => {
        switch (s.type) {
          case 'hero':         return <HeroSection      key={s.id} config={s.config} />
          case 'event_slider': return <EventSlider      key={s.id} config={s.config} />
          case 'community':    return <CommunitySection key={s.id} config={s.config} />
          case 'story':        return <StorySection     key={s.id} config={s.config} />
          default:              return null
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
        <img src={config.image_url} alt="" className={styles.lsHeroMedia} aria-hidden="true" />
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
      <img src={slide.image_url} alt="" className={styles.lsSliderImg} aria-hidden="true" />
      <div className={styles.lsSliderScrim} aria-hidden="true" />
      <div className={styles.lsSliderContent}>
        <h2 className={styles.lsSliderTitle}>{slide.title}</h2>
        <p className={styles.lsSliderSubtitle}>{slide.subtitle}</p>
        <a href={slide.cta_link} className={styles.lsSliderCta}>{slide.cta_text}</a>
      </div>

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
            <img src={item.image_url} alt="" className={styles.lsCommunityImg} loading="lazy" aria-hidden="true" />
            <span className={styles.lsCommunityTag}>{item.product_tag}</span>
          </div>
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
        <img src={config.image_url} alt="" className={styles.lsStoryImg} loading="lazy" aria-hidden="true" />
      </div>
    </section>
  )
}
