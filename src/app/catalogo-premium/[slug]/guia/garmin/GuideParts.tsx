'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, Circle, CornerUpLeft, Lightbulb, MessageCircle, Play, Power, Share2, Sun, Watch, type LucideIcon } from 'lucide-react'
import { ImgWithFallback } from '../../ImgWithFallback'
import type { GuideKeyId, GuideKind, GuideProduct } from '@/types/garmin-guide'
import styles from './garminGuide.module.css'

/* ── UN solo componente de íconos: tamaños fijos, nunca un SVG crudo sin tamaño ───────────────────────────────
   texto = 1.1em alineado al texto · boton = 16px (etiquetas de botón) · tarjeta = 22px (tarjetas y bloques). */

export type IconoNombre = 'power' | 'play' | 'back' | 'luz' | 'up' | 'down' | 'act' | 'check' | 'izq' | 'der' | 'consejo' | 'alerta' | 'whatsapp' | 'compartir' | 'reloj'
export type IconoTamano = 'texto' | 'boton' | 'tarjeta'

const ICONOS: Record<IconoNombre, LucideIcon> = {
  power: Power, play: Play, back: CornerUpLeft, luz: Sun, up: ChevronUp, down: ChevronDown, act: Circle, check: Check,
  izq: ArrowLeft, der: ArrowRight, consejo: Lightbulb, alerta: AlertTriangle, whatsapp: MessageCircle, compartir: Share2, reloj: Watch,
}
const TAMANO: Record<IconoTamano, string | number> = { texto: '1.1em', boton: 16, tarjeta: 22 }

export function Icono({ nombre, tamano = 'texto' }: { nombre: IconoNombre; tamano?: IconoTamano }): JSX.Element {
  const I = ICONOS[nombre]
  return <I size={TAMANO[tamano]} strokeWidth={2.25} className={tamano === 'texto' ? styles.icoTexto : styles.ico} aria-hidden="true" />
}

/* ── Texto con marcas: **negrita**, {luz}, {start|ETIQUETA}, {g|verde}, {r|rojo}, {PW} ─────────────────────── */

const KEYS: Record<GuideKeyId, { icono: IconoNombre; label: string; green?: boolean }> = {
  luz:   { icono: 'luz', label: 'LIGHT' },
  up:    { icono: 'up', label: 'UP' },
  down:  { icono: 'down', label: 'DOWN' },
  start: { icono: 'play', label: 'START/STOP', green: true },
  back:  { icono: 'back', label: 'BACK' },
  pow:   { icono: 'power', label: 'ENCENDIDO' },
  act:   { icono: 'act', label: 'ACCIÓN', green: true },
}

export function KeyChip({ id, label }: { id: GuideKeyId; label?: string }): JSX.Element {
  const k = KEYS[id]
  return <span className={`${styles.key} ${k.green ? styles.keyGreen : ''}`}><Icono nombre={k.icono} /> {label ?? k.label}</span>
}

export function Rich({ text }: { text: string }): JSX.Element {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|\{[^}]+\})/g).map((part, i) => {
        if (part.startsWith('**')) return <b key={i}>{part.slice(2, -2)}</b>
        if (!part.startsWith('{')) return part
        const [id, label] = part.slice(1, -1).split('|')
        if (id === 'PW') return <Icono key={i} nombre="power" />
        if (id === 'g' || id === 'r') return <span key={i} className={`${styles.key} ${id === 'g' ? styles.keyGreen : styles.keyRed}`}>{label}</span>
        return id in KEYS ? <KeyChip key={i} id={id as GuideKeyId} label={label} /> : part
      })}
    </>
  )
}

/* ── Ilustraciones (únicos SVG grandes junto con el diagrama del reloj) ─────────────────────────────────── */

const ICON_PATHS: Record<GuideKind, string> = {
  t: 'M19 14h26v36H19z M24 14l2-9h12l2 9M24 50l2 9h12l2-9',
  b: 'M19 14h26v36H19z M24 14l2-9h12l2 9M24 50l2 9h12l2-9',
  s: 'M8 26h48v12H8z M26 22h12v20H26z',
  c: 'M16 10h32v44H16z M21 16h22v26H21z',
  r: 'M24 8h16v48H24z M20 30c-4 4-4 10 0 14M44 30c4 4 4 10 0 14',
  h: 'M6 32h12M46 32h12 M18 22h28v20H18z',
  i: 'M22 18h20v34H22z M32 18V8M27 8h10 M27 26h10v8H27z',
  g: 'M20 10h24v44H20z M25 16h14v18H25z M32 44h0',
}

export function ModelIllustration({ kind, name }: { kind: GuideKind; name: string }): JSX.Element {
  return (
    <div className={styles.ilustracionBox}>
      <svg data-ilustracion="" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={ICON_PATHS[kind]} />
      </svg>
      <b>{name}</b>
    </div>
  )
}

export function Diagram({ buttons }: { buttons: 2 | 5 }): JSX.Element {
  const pts: Array<['l' | 'r', number]> = buttons === 2 ? [['r', 104], ['r', 156]] : [['l', 92], ['l', 130], ['l', 168], ['r', 92], ['r', 168]]
  const green = pts[buttons === 2 ? 0 : 3]
  return (
    <svg data-diagrama="" viewBox="0 0 320 260" role="img" aria-label="Dibujo del reloj con sus botones numerados" className={styles.diagSvg}>
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

/* ── Tarjeta de producto de la guía (selector y accesorios): foto, nombre y precio en USD y Bs ──────────── */

interface TileProps {
  product:   GuideProduct
  /** Selector: toca para arrancar su guía. Sin esto, enlaza a la ficha del catálogo. */
  onSelect?: () => void
  cta:       string
}

export function ProductTile({ product, onSelect, cta }: TileProps): JSX.Element {
  const body = (
    <>
      <span className={styles.tileFoto}>
        <ImgWithFallback src={product.image ?? ''} alt={product.name} className={styles.tileImg} fallback={<Icono nombre="reloj" tamano="tarjeta" />} loading="lazy" />
      </span>
      <span className={styles.tileNombre}>{product.name}</span>
      <span className={styles.tilePrecio}>
        {product.consult || !product.priceUsd ? <span>Consultar precio</span> : (<><b>{product.priceUsd}</b><span>{product.priceBs}</span></>)}
      </span>
      <span className={styles.tileCta}>{cta} <Icono nombre="der" tamano="boton" /></span>
    </>
  )
  return onSelect
    ? <button type="button" className={styles.tile} onClick={onSelect}>{body}</button>
    : <Link href={product.href} className={styles.tile}>{body}</Link>
}
