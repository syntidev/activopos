import type { KeyboardEvent, PointerEvent, Ref } from 'react'
import { chairBoxes, renderedSize, statusLabel } from '@/lib/restaurante'
import type { DiningTableDTO, FloorElementDTO, FloorKind, TableStatus } from '@/types/restaurante'
import styles from './plano.module.css'

/**
 * Plano de arquitecto en SVG. Unidades = celdas de la cuadrícula; el viewBox escala
 * el dibujo a cualquier ancho sin estilos inline. Sillas derivadas de la capacidad.
 * "El color es atención": libre = sin color · ocupada = navy · por cobrar = ámbar + pulso
 * · reservada / por limpiar = rayado.
 */

export const STATUS_TEXT: Record<TableStatus, string> = {
  libre: 'libre', ocupada: 'ocupada', por_cobrar: 'por cobrar', reservada: 'reservada', por_limpiar: 'por limpiar',
}

const KIND_LABEL: Record<FloorKind, string> = { wall: '', door: 'ENTRADA', bar: 'BARRA', pass: 'PASE DE COCINA' }
const MIN_COLS = 16
const MIN_ROWS = 12

export type PickKind = 'table' | 'element'

export interface PlanoSalonProps {
  tables:   readonly DiningTableDTO[]
  elements: readonly FloorElementDTO[]
  selected?: { kind: PickKind; id: number } | null
  /** Mesas que no coinciden con la búsqueda: se atenúan. */
  dimmed?: ReadonlySet<number>
  /** En el editor: arrastre con puntero (y flechas con el teclado). */
  editable?: boolean
  onPick?: (kind: PickKind, id: number) => void
  onItemPointerDown?: (e: PointerEvent<SVGGElement>, kind: PickKind, id: number) => void
  onItemKeyDown?: (e: KeyboardEvent<SVGGElement>, kind: PickKind, id: number) => void
  svgRef?: Ref<SVGSVGElement>
  /** Etiqueta accesible del plano completo. */
  label: string
}

export function planoExtent(tables: readonly DiningTableDTO[], elements: readonly FloorElementDTO[]): { cols: number; rows: number } {
  let cols = MIN_COLS
  let rows = MIN_ROWS
  for (const r of [...tables, ...elements]) {
    const s = renderedSize(r.width, r.height, r.rotation)
    cols = Math.max(cols, r.pos_x + s.w + 1)
    rows = Math.max(rows, r.pos_y + s.h + 1)
  }
  return { cols, rows }
}

export function PlanoSalon({
  tables, elements, selected = null, dimmed, editable = false, onPick, onItemPointerDown, onItemKeyDown, svgRef, label,
}: PlanoSalonProps) {
  const { cols, rows } = planoExtent(tables, elements)
  const isSel = (kind: PickKind, id: number): boolean => selected?.kind === kind && selected.id === id

  return (
    <svg
      ref={svgRef}
      className={`${styles.svg} ${editable ? styles.editable : ''}`}
      viewBox={`0 0 ${cols} ${rows}`}
      role="group"
      aria-label={label}
    >
      <defs>
        <pattern id="rs-dots" width="1" height="1" patternUnits="userSpaceOnUse">
          <circle cx="0.5" cy="0.5" r="0.04" className={styles.dot} />
        </pattern>
        <pattern id="rs-res" width="0.34" height="0.34" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="0.34" height="0.34" className={styles.resA} />
          <rect width="0.17" height="0.34" className={styles.resB} />
        </pattern>
        <pattern id="rs-dirty" width="0.34" height="0.34" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="0.34" height="0.34" className={styles.dirtyA} />
          <rect width="0.17" height="0.34" className={styles.dirtyB} />
        </pattern>
      </defs>
      <rect width={cols} height={rows} fill="url(#rs-dots)" />

      {elements.map(el => {
        const s = renderedSize(el.width, el.height, el.rotation)
        const text = el.label ?? KIND_LABEL[el.kind]
        const cx = el.pos_x + s.w / 2
        const cy = el.pos_y + s.h / 2
        return (
          <g
            key={`e${el.id}`}
            className={`${styles.element} ${styles[el.kind]} ${isSel('element', el.id) ? styles.selected : ''}`}
            tabIndex={editable ? 0 : undefined}
            role={editable ? 'button' : undefined}
            aria-label={editable ? `${text || 'Muro'}, mobiliario del plano` : undefined}
            onClick={editable ? () => onPick?.('element', el.id) : undefined}
            onPointerDown={editable ? e => onItemPointerDown?.(e, 'element', el.id) : undefined}
            onKeyDown={editable ? e => onItemKeyDown?.(e, 'element', el.id) : undefined}
          >
            <rect className={styles.hit} x={el.pos_x - 0.3} y={el.pos_y - 0.3} width={s.w + 0.6} height={s.h + 0.6} />
            <rect className={styles.shape} x={el.pos_x} y={el.pos_y} width={s.w} height={s.h} rx={el.kind === 'bar' ? 0.3 : 0.05} />
            {text && el.kind === 'bar' && (
              <text className={styles.elLabel} x={cx} y={cy} transform={s.h > s.w ? `rotate(-90 ${cx} ${cy})` : undefined} textAnchor="middle" dominantBaseline="middle">{text}</text>
            )}
            {text && (el.kind === 'door' || el.kind === 'pass') && (
              <text className={styles.elLabel} x={el.pos_x + s.w / 2} y={el.pos_y + s.h + 0.45} textAnchor="middle" dominantBaseline="middle">{text}</text>
            )}
          </g>
        )
      })}

      {tables.map(t => {
        const s = renderedSize(t.width, t.height, t.rotation)
        const stool = t.shape === 'stool'
        const sub = stool ? '' : statusLabel(t.status, t)
        const pulse = t.status === 'por_cobrar'
        return (
          <g
            key={`t${t.id}`}
            className={`${styles.table} ${styles[t.status]} ${dimmed?.has(t.id) ? styles.dim : ''} ${isSel('table', t.id) ? styles.selected : ''}`}
            transform={`translate(${t.pos_x} ${t.pos_y})`}
            role="button"
            tabIndex={0}
            aria-label={`Mesa ${t.label}, ${t.area_name}, ${t.capacity} ${t.capacity === 1 ? 'persona' : 'personas'}, ${STATUS_TEXT[t.status]}`}
            aria-pressed={isSel('table', t.id)}
            onClick={() => onPick?.('table', t.id)}
            onPointerDown={editable ? e => onItemPointerDown?.(e, 'table', t.id) : undefined}
            onKeyDown={e => {
              if (editable) onItemKeyDown?.(e, 'table', t.id)
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick?.('table', t.id) }
            }}
          >
            {chairBoxes(s.w, s.h, t.capacity, t.shape).map((c, i) => (
              <rect key={i} className={styles.chair} x={c.x} y={c.y} width={c.w} height={c.h} rx={0.1} />
            ))}
            {pulse && (t.shape === 'round'
              ? <ellipse className={styles.pulse} cx={s.w / 2} cy={s.h / 2} rx={s.w / 2 + 0.2} ry={s.h / 2 + 0.2} />
              : <rect className={styles.pulse} x={-0.2} y={-0.2} width={s.w + 0.4} height={s.h + 0.4} rx={0.42} />)}
            <g className={styles.face}>
              {t.shape === 'rect'
                ? <rect className={styles.body} width={s.w} height={s.h} rx={0.34} />
                : <ellipse className={styles.body} cx={s.w / 2} cy={s.h / 2} rx={s.w / 2} ry={s.h / 2} />}
              <text className={stool ? styles.numSm : styles.num} x={s.w / 2} y={sub ? s.h / 2 - 0.12 : s.h / 2} textAnchor="middle" dominantBaseline="middle">{t.label}</text>
              {sub && <text className={styles.sub} x={s.w / 2} y={s.h / 2 + 0.42} textAnchor="middle" dominantBaseline="middle">{sub}</text>}
            </g>
          </g>
        )
      })}
    </svg>
  )
}
