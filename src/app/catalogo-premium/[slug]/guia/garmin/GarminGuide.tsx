'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CatalogHeader } from '../../CatalogHeader'
import { ImgWithFallback } from '../../ImgWithFallback'
import { GUIDE_FAMILIES, GUIDE_MODELS, KIND_LABEL, guideSteps } from '@/lib/garmin-guide'
import type { GuideKeyId, GuideKind, GuideStep } from '@/types/garmin-guide'
import styles from './garminGuide.module.css'

interface Props {
  slug:          string
  businessName:  string
  businessLogo:  string | null
  businessCity:  string | null
  /** WhatsApp del negocio, solo dígitos con código de país; vacío = sin botón. */
  whatsapp:      string
  showKitLink:   boolean
  /** Foto por nombre de modelo (primer producto Garmin activo que lo contiene). */
  modelImages:   Record<string, string>
  initialFamily: string
  /** Índice en GUIDE_MODELS preseleccionado por ?modelo=; null = ninguno. */
  initialModel:  number | null
  /** Pie del catálogo (componente de servidor): queda dentro del contenedor, por encima de la barra fija. */
  children?:     ReactNode
}

type Os = 'iphone' | 'android'

/* ── Texto con marcas: **negrita**, {luz}, {start|ETIQUETA}, {g|verde}, {r|rojo}, {PW} ───────────── */

function PowerIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <path d="M12 3v8M6.3 6.8a8 8 0 1 0 11.4 0" />
    </svg>
  )
}

const KEYS: Record<GuideKeyId, { icon: ReactNode; label: string; green?: boolean }> = {
  luz:   { icon: '☀︎', label: 'LIGHT' },
  up:    { icon: '▲', label: 'UP' },
  down:  { icon: '▼', label: 'DOWN' },
  start: { icon: '▶︎', label: 'START/STOP', green: true },
  back:  { icon: '↩︎', label: 'BACK' },
  pow:   { icon: <PowerIcon />, label: 'ENCENDIDO' },
  act:   { icon: '●', label: 'ACCIÓN', green: true },
}

function KeyChip({ id, label }: { id: GuideKeyId; label?: string }): JSX.Element {
  const k = KEYS[id]
  return <span className={`${styles.key} ${k.green ? styles.keyGreen : ''}`}>{k.icon} {label ?? k.label}</span>
}

function Rich({ text }: { text: string }): JSX.Element {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|\{[^}]+\})/g).map((part, i) => {
        if (part.startsWith('**')) return <b key={i}>{part.slice(2, -2)}</b>
        if (!part.startsWith('{')) return part
        const [id, label] = part.slice(1, -1).split('|')
        if (id === 'PW') return <span key={i} className={styles.pw}><PowerIcon /></span>
        if (id === 'g' || id === 'r') return <span key={i} className={`${styles.key} ${id === 'g' ? styles.keyGreen : styles.keyRed}`}>{label}</span>
        return id in KEYS ? <KeyChip key={i} id={id as GuideKeyId} label={label} /> : part
      })}
    </>
  )
}

/* ── Dibujos ─────────────────────────────────────────────────────────── */

const ICON_PATHS: Record<GuideKind, string> = {
  t: 'M19 14h26v36H19z M24 14l2-9h12l2 9M24 50l2 9h12l2-9',
  b: 'M19 14h26v36H19z M24 14l2-9h12l2 9M24 50l2 9h12l2-9',
  s: 'M8 26h48v12H8z M26 22h12v20H26z',
  c: 'M16 10h32v44H16z M21 16h22v26H21z',
  r: 'M24 8h16v48H24z M20 30c-4 4-4 10 0 14M44 30c4 4 4 10 0 14',
  h: 'M6 32h12M46 32h12 M18 22h28v20H18z',
}

function ModelIcon({ kind, name }: { kind: GuideKind; name: string }): JSX.Element {
  return (
    <div className={styles.iconBox}>
      <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={ICON_PATHS[kind]} />
      </svg>
      <b>{name}</b>
    </div>
  )
}

function Diagram({ buttons }: { buttons: 2 | 5 }): JSX.Element {
  const pts: Array<['l' | 'r', number]> = buttons === 2 ? [['r', 104], ['r', 156]] : [['l', 92], ['l', 130], ['l', 168], ['r', 92], ['r', 168]]
  const green = pts[buttons === 2 ? 0 : 3]
  return (
    <svg viewBox="0 0 320 260" role="img" aria-label="Dibujo del reloj con sus botones numerados" className={styles.diagSvg}>
      <circle cx="160" cy="130" r="74" className={styles.dCase} />
      <circle cx="160" cy="130" r="56" className={styles.dFace} />
      <text x="160" y="140" textAnchor="middle" className={styles.dTime}>10:09</text>
      {pts.map(([side, y], i) => {
        const left = side === 'l'
        const mx = left ? 34 : 286
        return (
          <g key={i}>
            <line x1={left ? 80 : 240} y1={y} x2={left ? mx + 14 : mx - 14} y2={y} className={styles.dLine} />
            <rect x={left ? 80 : 232} y={y - 12} width="8" height="24" rx="3" className={styles.dBtn} />
            <circle cx={mx} cy={y} r="15" className={styles.dBtn} />
            <text x={mx} y={y + 6} textAnchor="middle" className={styles.dNum}>{i + 1}</text>
          </g>
        )
      })}
      <circle cx="198" cy={green[1] + (green[1] < 130 ? 8 : -8)} r="6" className={styles.dDot} />
    </svg>
  )
}

/* ── Pasos ───────────────────────────────────────────────────────────── */

function StepBody({ step, os, onOs }: { step: GuideStep; os: Os; onOs: (o: Os) => void }): JSX.Element {
  return (
    <>
      {step.byOs && (
        <>
          <div className={styles.tabs} role="group" aria-label="Tu teléfono">
            {(['iphone', 'android'] as const).map(o => (
              <button key={o} type="button" className={styles.chip} aria-pressed={os === o} onClick={() => onOs(o)}>
                {o === 'iphone' ? 'iPhone' : 'Android'}
              </button>
            ))}
          </div>
          <ol>{step.byOs[os].map((x, i) => <li key={i}><Rich text={x} /></li>)}</ol>
        </>
      )}
      {step.list && <ol>{step.list.map((x, i) => <li key={i}><Rich text={x} /></li>)}</ol>}
      {step.paragraphs?.map((x, i) => <p key={i}><Rich text={x} /></p>)}
      {step.legend && (
        <ul className={styles.legend}>
          {step.legend.map((r, i) => (
            <li key={i}>
              <span className={styles.num}>{i + 1}</span>
              <span><KeyChip id={r.key} label={r.label} /> <small>{r.place}</small><br />{r.text}</span>
            </li>
          ))}
        </ul>
      )}
      {step.faq?.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
      {step.tip && <div className={styles.tip}><p><Rich text={step.tip} /></p></div>}
    </>
  )
}

export function GarminGuide({ slug, businessName, businessLogo, businessCity, whatsapp, showKitLink, modelImages, initialFamily, initialModel, children }: Props): JSX.Element {
  const [fam, setFam] = useState(initialFamily)
  const [m, setM] = useState<number | null>(initialModel)
  const [started, setStarted] = useState(false)
  const [i, setI] = useState(0)
  const [os, setOs] = useState<Os>('iphone')
  const [copied, setCopied] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)

  const model = m === null ? null : GUIDE_MODELS[m]
  const steps = started && model ? guideSteps(model, businessName) : []
  const step = steps[Math.min(i, steps.length - 1)]
  const last = steps.length - 1

  // El catálogo scrollea dentro de .root (dos niveles sobre el header), igual que la ficha de producto.
  useEffect(() => {
    const scroller = headerRef.current?.parentElement?.parentElement
    if (!scroller) return
    const onScroll = (): void => setIsScrolled(scroller.scrollTop > 8)
    scroller.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { shellRef.current?.parentElement?.scrollTo({ top: 0 }) }, [started, i, fam])

  useEffect(() => {
    if (!started) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowRight') setI(v => Math.min(v + 1, last))
      else if (e.key === 'ArrowLeft') setI(v => Math.max(v - 1, 0))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [started, last])

  async function share(): Promise<void> {
    const data = { title: 'Tu Garmin, paso a paso', url: window.location.href }
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

  const showPhoto = i === 0 && model !== null
  const media = step && (showPhoto || step.diagram) ? (
    <div className={styles.media}>
      {showPhoto && model && (
        <>
          <div className={styles.img}>
            <ImgWithFallback src={modelImages[model.name] ?? ''} alt={model.name} className={styles.imgTag} fallback={<ModelIcon kind={model.kind} name={model.name} />} />
          </div>
          <p className={styles.cap}>
            Compara con la caja: el color puede cambiar, la forma no.
            {model.family !== 'Otro' && (
              <> <a href={`https://www.garmin.com/es-MX/search/?query=${encodeURIComponent(model.name)}`} target="_blank" rel="noopener noreferrer">Ver la foto oficial en garmin.com</a></>
            )}
          </p>
        </>
      )}
      {step.diagram && (
        <>
          <div className={styles.diag}><Diagram buttons={step.diagram} /></div>
          <p className={styles.cap}>El punto verde del dibujo muestra cómo la pantalla suele señalar el botón de iniciar.</p>
        </>
      )}
    </div>
  ) : null

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
        {!started || !step ? (
          <>
            <h1 className={styles.h1}>Tu Garmin, paso a paso</h1>
            <p className={styles.sub}>Elige tu reloj y armamos una guía hecha para él.</p>
            <div className={styles.fams} role="group" aria-label="Familia">
              {GUIDE_FAMILIES.map(f => (
                <button key={f} type="button" className={styles.chip} aria-pressed={f === fam} onClick={() => { setFam(f); setM(null) }}>{f}</button>
              ))}
            </div>
            <div className={styles.list}>
              {GUIDE_MODELS.map((x, idx) => x.family !== fam ? null : (
                <button key={x.name} type="button" className={styles.row} aria-pressed={m === idx} onClick={() => setM(idx)}>
                  <span className={styles.dot} />
                  <span><b>{x.name}</b><small>{KIND_LABEL[x.kind]}</small></span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className={styles.prog} role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={i + 1}>
              {steps.map((s, k) => <i key={s.id} className={k <= i ? styles.progOn : undefined} />)}
            </div>
            <p className={styles.cnt}>Paso {i + 1} de {steps.length}</p>
            <h2 className={styles.h2}>{step.title}</h2>
            <div className={media ? styles.two : undefined}>
              {media}
              <div>
                <StepBody step={step} os={os} onOs={setOs} />
                {step.final && (
                  <div className={styles.acts}>
                    {whatsapp && <a className={styles.btn} href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">Escribirnos por WhatsApp</a>}
                    <button type="button" className={styles.btnGhost} onClick={() => void share()}>{copied ? 'Enlace copiado' : 'Compartir esta guía'}</button>
                    <button type="button" className={styles.btnGhost} onClick={() => { setStarted(false); setM(null); setI(0) }}>Elegir otro reloj</button>
                    <p className={styles.sub}>{businessName}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {children}

      <div className={styles.bar}>
        <div className={styles.barInner}>
          {!started || !step ? (
            <button type="button" className={styles.btn} disabled={m === null} onClick={() => { setI(0); setStarted(true) }}>Crear mi guía</button>
          ) : (
            <>
              <button type="button" className={styles.btnGhost} disabled={i === 0} onClick={() => setI(v => v - 1)}>Anterior</button>
              {!step.final && <button type="button" className={styles.btn} onClick={() => setI(v => v + 1)}>Siguiente</button>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
