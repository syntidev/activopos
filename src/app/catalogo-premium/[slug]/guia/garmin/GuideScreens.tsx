'use client'

import { useState, type ReactNode } from 'react'
import { AdaptiveGrid } from '@/components/ui/AdaptiveGrid'
import { ImgWithFallback } from '../../ImgWithFallback'
import { GUIDE_MODELS } from '@/lib/garmin-guide'
import { extrasFor, faqFor } from '@/lib/garmin-guide-extras'
import { SAT_NOTICE } from '@/lib/garmin-guide-satelite'
import type { GuideExtra, GuideKind, GuideProduct, GuideStep } from '@/types/garmin-guide'
import { Diagram, Icono, KeyChip, ModelIllustration, ProductTile, Rich } from './GuideParts'
import styles from './garminGuide.module.css'

/** Pasos en los que se muestra la foto del producto (carga, encendido y botones). */
const PHOTO_STEPS: ReadonlySet<string> = new Set(['carga', 'encendido', 'manejo', 'activar', 'instalar', 'colocar'])
const MAX_CARDS = { mobile: 2, tablet: 3, desktop: 4 }

/* ── Selector: equipos Garmin del negocio con foto, nombre y precio, por familia ──────────────────────── */

interface SelectorProps {
  products: GuideProduct[]
  onPick:   (p: GuideProduct) => void
  /** "Otro modelo": índice en GUIDE_MODELS (táctil o solo botones). */
  onOther:  (modelIndex: number) => void
}

export function GuideSelector({ products, onPick, onOther }: SelectorProps): JSX.Element {
  const familyOf = (p: GuideProduct): string => GUIDE_MODELS[p.modelIndex ?? 0].family
  const families = products.reduce<string[]>((acc, p) => (acc.includes(familyOf(p)) ? acc : [...acc, familyOf(p)]), [])
  const [fam, setFam] = useState(families[0] ?? '')
  const others = GUIDE_MODELS.map((m, i) => ({ m, i })).filter(x => x.m.family === 'Otro')
  return (
    <>
      <h1 className={styles.h1}>Configura tu Garmin paso a paso</h1>
      <p className={styles.sub}>Elige tu equipo y te armamos una guía hecha para él.</p>
      {products.length > 0 ? (
        <>
          <div className={styles.tabs} role="group" aria-label="Familia">
            {families.map(f => <button key={f} type="button" className={styles.tab} aria-pressed={f === fam} onClick={() => setFam(f)}>{f}</button>)}
          </div>
          <AdaptiveGrid max={MAX_CARDS}>
            {products.filter(p => familyOf(p) === fam).map(p => <ProductTile key={p.id} product={p} cta="Ver mi guía" onSelect={() => onPick(p)} />)}
          </AdaptiveGrid>
        </>
      ) : <p className={styles.vacio}>Todavía no hay equipos Garmin publicados en el catálogo. Si ya tienes uno, elige “Otro modelo”.</p>}
      <h2 className={styles.h3}>Otro modelo</h2>
      <p className={styles.sub}>¿Lo compraste en otra parte? Elige cómo se maneja tu reloj.</p>
      <div className={styles.otros}>
        {others.map(({ m, i }) => <button key={m.name} type="button" className={styles.otroBtn} onClick={() => onOther(i)}><Icono nombre="reloj" tamano="tarjeta" /> {m.name}</button>)}
      </div>
    </>
  )
}

/* ── Tarjeta de un paso ───────────────────────────────────────────────── */

interface StepCardProps {
  step:     GuideStep
  index:    number
  total:    number
  kind:     GuideKind
  model:    string
  photo:    string | null
  done:     boolean
  os:       'iphone' | 'android'
  onOs:     (o: 'iphone' | 'android') => void
  onDone:   () => void
  waHref:   string | null
}

function Block({ icono, lead, children, tip = false }: { icono: 'consejo' | 'alerta' | 'check'; lead: string; children: ReactNode; tip?: boolean }): JSX.Element {
  return (
    <div className={`${styles.bloque} ${tip ? styles.bloqueTip : ''}`}>
      <Icono nombre={icono} tamano="tarjeta" />
      <p><b>{lead}</b> {children}</p>
    </div>
  )
}

export function GuideStepCard({ step, index, total, kind, model, photo, done, os, onOs, onDone, waHref }: StepCardProps): JSX.Element {
  const showPhoto = PHOTO_STEPS.has(step.id) || index === 0
  const media = (showPhoto || step.diagram) ? (
    <div className={step.diagram ? `${styles.media} ${styles.mediaDoble}` : styles.media}>
      {showPhoto && (
        <div className={styles.foto}>
          <ImgWithFallback src={photo ?? ''} alt={model} className={styles.fotoImg} fallback={<ModelIllustration kind={kind} name={model} />} />
        </div>
      )}
      {step.diagram && <div className={styles.diag}><Diagram buttons={step.diagram} /></div>}
    </div>
  ) : null
  return (
    <article className={styles.stepCard}>
      <div className={styles.prog} role="progressbar" aria-label="Progreso" aria-valuemin={1} aria-valuemax={total} aria-valuenow={index + 1}>
        {Array.from({ length: total }, (_, k) => <i key={k} className={k <= index ? styles.progOn : undefined} />)}
      </div>
      <header className={styles.stepHead}>
        <span className={styles.stepNum}>{index + 1}</span>
        <div>
          <p className={styles.cnt}>Paso {index + 1} de {total}</p>
          <h2 className={styles.h2}>{step.title}</h2>
        </div>
      </header>
      <p className={styles.goal}><b>Qué vas a hacer.</b> <Rich text={step.goal} /></p>
      {media}
      {step.needs && (
        <div className={styles.needs}>
          <h3 className={styles.h3}>Lo que necesitas antes de empezar</h3>
          <ul>{step.needs.map((x, i) => <li key={i}><Rich text={x} /></li>)}</ul>
          {step.venezuela && (<><h3 className={styles.h3}>Consejos para Venezuela</h3><ul>{step.venezuela.map((x, i) => <li key={i}><Rich text={x} /></li>)}</ul></>)}
        </div>
      )}
      {step.byOs && (
        <>
          <div className={styles.tabs} role="group" aria-label="Tu teléfono">
            {(['iphone', 'android'] as const).map(o => <button key={o} type="button" className={styles.tab} aria-pressed={os === o} onClick={() => onOs(o)}>{o === 'iphone' ? 'iPhone' : 'Android'}</button>)}
          </div>
          <ol className={styles.pasos}>{step.byOs[os].map((x, i) => <li key={i}><Rich text={x} /></li>)}</ol>
        </>
      )}
      {step.actions.length > 0 && <ol className={styles.pasos}>{step.actions.map((x, i) => <li key={i}><Rich text={x} /></li>)}</ol>}
      {step.legend && (
        <ul className={styles.legend}>
          {step.legend.map((r, i) => (
            <li key={i}><span className={styles.num}>{i + 1}</span><span><KeyChip id={r.key} label={r.label} /> <small>{r.place}</small><br />{r.text}</span></li>
          ))}
        </ul>
      )}
      <Block icono="check" lead="Por qué importa."><Rich text={step.why} /></Block>
      <Block icono="alerta" lead="Error común."><Rich text={step.mistake} /></Block>
      <Block icono="consejo" lead="Consejo OnBike." tip><Rich text={step.tip} /></Block>
      <details className={styles.ayuda}>
        <summary>¿Tienes un problema en este paso?</summary>
        {step.trouble.map(([q, a]) => <p key={q}><b>{q}.</b> {a}</p>)}
        {waHref && <a className={styles.btnGhost} href={waHref} target="_blank" rel="noopener noreferrer"><Icono nombre="whatsapp" tamano="boton" /> Escríbenos por WhatsApp</a>}
      </details>
      <button type="button" className={done ? styles.btnDone : styles.btn} aria-pressed={done} onClick={onDone}>
        <Icono nombre="check" tamano="boton" /> {done ? 'Paso completado' : 'Listo, siguiente paso'}
      </button>
    </article>
  )
}

/* ── Saca el máximo provecho y preguntas frecuentes ───────────────────── */

function ExtraBody({ lines }: { lines: string[] }): JSX.Element {
  const out: ReactNode[] = []
  let bullets: string[] = []
  const flush = (): void => { if (bullets.length) { out.push(<ul key={`u${out.length}`}>{bullets.map((b, i) => <li key={i}><Rich text={b} /></li>)}</ul>); bullets = [] } }
  lines.forEach(l => { if (l.startsWith('- ')) bullets.push(l.slice(2)); else { flush(); out.push(<p key={`p${out.length}`}><Rich text={l} /></p>) } })
  flush()
  return <>{out}</>
}

export function GuideExtras({ kind, tienda }: { kind: GuideKind; tienda: string }): JSX.Element {
  const extras: GuideExtra[] = extrasFor(kind)
  return (
    <section>
      <h2 className={styles.h2}>Saca el máximo provecho</h2>
      <p className={styles.sub}>Lo que puedes hacer con tu equipo cuando ya funciona.</p>
      {extras.map(e => (
        <details key={e.id} className={styles.extra}>
          <summary>{e.title.replace('{tienda}', tienda)}</summary>
          <ExtraBody lines={e.body} />
        </details>
      ))}
    </section>
  )
}

export function GuideFaq({ kind }: { kind: GuideKind }): JSX.Element {
  return (
    <section>
      <h2 className={styles.h2}>Preguntas frecuentes</h2>
      {faqFor(kind).map(([q, a]) => <details key={q} className={styles.extra}><summary>{q}</summary><p>{a}</p></details>)}
    </section>
  )
}

/** Aviso fijo de los equipos satelitales. */
export function SatNotice(): JSX.Element {
  return <p className={styles.aviso} role="note"><Icono nombre="alerta" tamano="tarjeta" /> <b>{SAT_NOTICE}</b></p>
}

/* ── Cierre ─────────────────────────────────────────────────────────── */

interface FinalProps {
  model:       string
  steps:       GuideStep[]
  done:        ReadonlySet<string>
  copied:      boolean
  onShare:     () => void
  onGoStep:    (i: number) => void
  waHref:      string | null
  accessories: GuideProduct[]
}

export function GuideFinal({ model, steps, done, copied, onShare, onGoStep, waHref, accessories }: FinalProps): JSX.Element {
  const hechos = steps.filter(s => done.has(s.id)).length
  return (
    <section className={styles.stepCard}>
      <h2 className={styles.h2}>¡Tu {model} está listo!</h2>
      <p className={styles.goal}><b>{hechos} de {steps.length} pasos completados.</b> {hechos === steps.length ? 'Terminaste toda la guía.' : 'Toca un paso pendiente para revisarlo cuando quieras.'}</p>
      <ul className={styles.resumen}>
        {steps.map((s, i) => (
          <li key={s.id}>
            <button type="button" className={done.has(s.id) ? styles.resHecho : styles.resPend} onClick={() => onGoStep(i)}>
              <Icono nombre="check" tamano="boton" /> {s.title}
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.acts}>
        <button type="button" className={styles.btn} onClick={onShare}><Icono nombre="compartir" tamano="boton" /> {copied ? 'Enlace copiado' : 'Compartir esta guía'}</button>
        {waHref && <a className={styles.btnGhost} href={waHref} target="_blank" rel="noopener noreferrer"><Icono nombre="whatsapp" tamano="boton" /> Escríbenos por WhatsApp</a>}
      </div>
      {accessories.length > 0 && (
        <>
          <h3 className={styles.h3}>Accesorios Garmin para tu equipo</h3>
          <AdaptiveGrid max={MAX_CARDS}>
            {accessories.map(a => <ProductTile key={a.id} product={a} cta="Ver en el catálogo" />)}
          </AdaptiveGrid>
        </>
      )}
    </section>
  )
}
