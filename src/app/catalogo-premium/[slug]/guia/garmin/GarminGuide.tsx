'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CatalogHeader } from '../../CatalogHeader'
import { ImgWithFallback } from '../../ImgWithFallback'
import { GUIDE_MINUTES, GUIDE_MODELS } from '@/lib/garmin-guide'
import { guideSteps } from '@/lib/garmin-guide-steps'
import type { GuideProduct } from '@/types/garmin-guide'
import { GuideExtras, GuideFaq, GuideFinal, GuideSelector, GuideStepCard, SatNotice } from './GuideScreens'
import { Icono, ModelIllustration } from './GuideParts'
import styles from './garminGuide.module.css'

interface Props {
  slug:             string
  businessName:     string
  businessLogo:     string | null
  businessCity:     string | null
  /** WhatsApp del negocio, solo dígitos con código de país; vacío = sin botones de WhatsApp. */
  whatsapp:         string
  showKitLink:      boolean
  /** Equipos Garmin del negocio que tienen guía (con foto y precio). */
  watches:          GuideProduct[]
  /** Productos Garmin sin guía (correas, cargadores, bandas…): fila de accesorios del cierre. */
  accessories:      GuideProduct[]
  /** ?producto=<id> reconocido: la guía arranca directo con ese producto. */
  initialProductId: number | null
  /** Pie del catálogo (componente de servidor): queda dentro del contenedor, por encima de la barra fija. */
  children?:        ReactNode
}

interface Selection { product: GuideProduct | null; modelIndex: number }
type Tab = 'pasos' | 'extras' | 'faq'
type Os = 'iphone' | 'android'

const TABS: ReadonlyArray<[Tab, string]> = [['pasos', 'Pasos'], ['extras', 'Saca el máximo provecho'], ['faq', 'Preguntas frecuentes']]

export function GarminGuide({ slug, businessName, businessLogo, businessCity, whatsapp, showKitLink, watches, accessories, initialProductId, children }: Props): JSX.Element {
  const initial = watches.find(p => p.id === initialProductId)
  const [sel, setSel] = useState<Selection | null>(initial ? { product: initial, modelIndex: initial.modelIndex ?? 0 } : null)
  const [tab, setTab] = useState<Tab>('pasos')
  const [i, setI] = useState(0)
  const [done, setDone] = useState<ReadonlySet<string>>(new Set())
  const [os, setOs] = useState<Os>('iphone')
  const [copied, setCopied] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)

  const model = sel ? GUIDE_MODELS[sel.modelIndex] : null
  const steps = useMemo(() => (model ? guideSteps(model) : []), [model])
  const storageKey = sel ? `activopos_garmin_${slug}_${sel.product?.id ?? `m${sel.modelIndex}`}` : null
  const step = steps[i]
  const photo = sel?.product?.image ?? null

  // Progreso por producto: se lee al elegir el equipo y retoma en el primer paso sin completar.
  useEffect(() => {
    if (!storageKey) return
    let saved: string[] = []
    try { saved = (JSON.parse(localStorage.getItem(storageKey) ?? '{}') as { done?: string[] }).done ?? [] } catch { saved = [] }
    const set = new Set(saved)
    setDone(set)
    const next = steps.findIndex(s => !set.has(s.id))
    setI(next === -1 ? steps.length : next)
  }, [storageKey, steps])

  // Se guarda en el manejador (no en un efecto): un efecto corre justo tras leer el progreso y lo pisaría con un set vacío.
  function saveDone(next: ReadonlySet<string>): void {
    setDone(next)
    if (!storageKey) return
    try { localStorage.setItem(storageKey, JSON.stringify({ done: Array.from(next) })) } catch { /* sin almacenamiento: el avance dura solo la sesión */ }
  }

  // El catálogo scrollea dentro de .root (dos niveles sobre el header), igual que la ficha de producto.
  useEffect(() => {
    const scroller = headerRef.current?.parentElement?.parentElement
    if (!scroller) return
    const onScroll = (): void => setIsScrolled(scroller.scrollTop > 8)
    scroller.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { shellRef.current?.parentElement?.scrollTo({ top: 0 }) }, [sel, tab, i])

  const waHref = (n: number, title: string): string | null => !whatsapp || !model ? null
    : `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola ${businessName}, estoy configurando mi ${model.name} y voy en el paso ${n}: ${title}`)}`

  async function share(): Promise<void> {
    const data = { title: `Configura tu ${model?.name ?? 'Garmin'} paso a paso`, url: window.location.href }
    if (navigator.share) {
      // Cancelar el menú de compartir lanza AbortError: es una acción del usuario, no un fallo.
      await navigator.share(data).catch(() => undefined)
      return
    }
    try {
      await navigator.clipboard.writeText(data.url)
      setCopied(true)
    } catch {
      window.prompt('Copia este enlace para compartir la guía:', data.url)
    }
  }

  function toggleDone(): void {
    if (!step) return
    if (done.has(step.id)) {
      saveDone(new Set(Array.from(done).filter(x => x !== step.id)))
      return
    }
    saveDone(new Set(done).add(step.id))
    setI(v => v + 1)
  }

  const reset = (): void => { setSel(null); setTab('pasos'); setI(0) }
  const satelite = model?.kind === 'i' || model?.kind === 'g'
  const atFinal = steps.length > 0 && i >= steps.length

  return (
    <div ref={shellRef} className={styles.shell}>
      <CatalogHeader
        ref={headerRef}
        slug={slug}
        businessName={businessName}
        businessLogo={businessLogo}
        businessCity={businessCity}
        isScrolled={isScrolled}
        showIconCluster={false}
        showKitLink={showKitLink}
      />

      <main className={styles.main}>
        {!sel || !model ? (
          <GuideSelector products={watches} onPick={p => setSel({ product: p, modelIndex: p.modelIndex ?? 0 })} onOther={idx => setSel({ product: null, modelIndex: idx })} />
        ) : (
          <>
            <section className={styles.hero}>
              <div className={styles.heroFoto}>
                <ImgWithFallback src={photo ?? ''} alt={sel.product?.name ?? model.name} className={styles.fotoImg} fallback={<ModelIllustration kind={model.kind} name={model.name} />} />
              </div>
              <div className={styles.heroTexto}>
                <h1 className={styles.h1}>{sel.product?.name ?? model.name}</h1>
                <p className={styles.meta}>Guía de configuración · {steps.length} pasos · ~{GUIDE_MINUTES} min</p>
                <button type="button" className={styles.linkBtn} onClick={reset}><Icono nombre="izq" tamano="boton" /> Elegir otro equipo</button>
              </div>
            </section>
            {satelite && <SatNotice />}
            <div className={styles.tabs} role="tablist" aria-label="Secciones de la guía">
              {TABS.map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={styles.tab} aria-pressed={tab === k} onClick={() => setTab(k)}>{label}</button>)}
            </div>
            {tab === 'pasos' && (atFinal ? (
              <GuideFinal
                model={model.name}
                steps={steps}
                done={done}
                copied={copied}
                onShare={() => void share()}
                onGoStep={setI}
                waHref={waHref(steps.length, steps[steps.length - 1].title)}
                accessories={accessories}
              />
            ) : step && (
              <GuideStepCard
                key={step.id}
                step={step}
                index={i}
                total={steps.length}
                kind={model.kind}
                model={model.name}
                photo={photo}
                done={done.has(step.id)}
                os={os}
                onOs={setOs}
                onDone={toggleDone}
                waHref={waHref(i + 1, step.title)}
              />
            ))}
            {tab === 'extras' && <GuideExtras kind={model.kind} tienda={businessName} />}
            {tab === 'faq' && <GuideFaq kind={model.kind} />}
          </>
        )}
      </main>

      {children}

      {sel && tab === 'pasos' && !atFinal && (
        <div className={styles.bar}>
          <div className={styles.barInner}>
            <button type="button" className={styles.btnGhost} disabled={i === 0} onClick={() => setI(v => v - 1)}><Icono nombre="izq" tamano="boton" /> Anterior</button>
            <button type="button" className={styles.btn} onClick={() => setI(v => v + 1)}>Siguiente <Icono nombre="der" tamano="boton" /></button>
          </div>
        </div>
      )}
    </div>
  )
}
