'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, MessageCircle } from 'lucide-react'
import type { BillingCycleAmounts, BillingCycleKey, PlanTier } from '@/lib/plan-limits'
import s from './PlanesEscalera.module.css'

export interface TarjetaPlan {
  tier:       PlanTier
  nombre:     string
  destacado:  boolean
  /** Líneas de la card. */
  features:   string[]
  /** null = plan sin cobro (Gratis). */
  ciclos:     Record<BillingCycleKey, BillingCycleAmounts> | null
}

interface PlanesEscaleraProps {
  tarjetas: TarjetaPlan[]
  /** Tasa paralela: el precio de suscripción en Bs usa la tasa paralela, nunca la BCV. 0 = se oculta el Bs. */
  bcvRate:  number
  /** Base de WhatsApp para el CTA de los planes de pago. */
  waBase:   string
}

const ETIQUETA: Record<BillingCycleKey, string> = { mensual: 'Mensual', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' }
const UNIDAD: Record<BillingCycleKey, string>   = { mensual: 'al mes', trimestral: 'cada 3 meses', semestral: 'cada 6 meses', anual: 'al año' }
const PRINCIPALES: BillingCycleKey[] = ['mensual', 'anual']
const OTROS: BillingCycleKey[]       = ['trimestral', 'semestral']

const usd = (n: number): string => '$' + (Number.isInteger(n) ? String(n) : n.toFixed(2))
const bs  = (n: number, rate: number): string => 'Bs. ' + (n * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Escalera de planes v2: selector Mensual/Anual (con "Otros períodos") y una tarjeta por nivel. Precio fijo por el período elegido. */
export default function PlanesEscalera({ tarjetas, bcvRate, waBase }: PlanesEscaleraProps) {
  const [periodo, setPeriodo] = useState<BillingCycleKey>('mensual')
  const [otros, setOtros] = useState(false)
  // Si el período elegido es uno de "otros", la bandeja queda abierta para que se vea cuál está activo.
  const bandejaAbierta = otros || OTROS.includes(periodo)

  const boton = (k: BillingCycleKey) => (
    <button key={k} type="button" role="radio" aria-checked={periodo === k} data-testid={`periodo-${k}`}
      className={`${s.periodo} ${periodo === k ? s.periodoOn : ''}`} onClick={() => setPeriodo(k)}>
      {ETIQUETA[k]}
    </button>
  )

  return (
    <div>
      <div className={s.selector}>
        <div className={s.grupo} role="radiogroup" aria-label="Período de pago">
          {PRINCIPALES.map(boton)}
          <button type="button" className={s.otros} aria-expanded={bandejaAbierta} aria-controls="otros-periodos" data-testid="otros-periodos-btn"
            onClick={() => setOtros(v => !v)}>
            Otros períodos
          </button>
        </div>
        {bandejaAbierta && (
          <div id="otros-periodos" className={s.grupo} role="radiogroup" aria-label="Otros períodos" data-testid="otros-periodos">
            {OTROS.map(boton)}
          </div>
        )}
      </div>

      <div className={s.grid}>
        {tarjetas.map(t => {
          const c = t.ciclos?.[periodo] ?? null
          return (
            <article key={t.tier} className={`${s.card} ${t.destacado ? s.cardDestacada : ''}`} data-testid={`plan-${t.tier}`}>
              {t.destacado && <span className={s.cinta}>Más completo</span>}
              <h3 className={s.nombre}>{t.nombre}</h3>

              {c ? (
                <div className={s.precioBloque}>
                  <p className={s.precio} data-testid={`precio-${t.tier}`}>
                    <span className={s.monto}>{usd(c.totalAmount)}</span>
                    <span className={s.unidad}>{UNIDAD[periodo]}</span>
                  </p>
                  <span className={s.fijo} data-testid="precio-fijo">Precio fijo por el período</span>
                  {periodo !== 'mensual' && (
                    <p className={s.equivale}>≈ {usd(c.monthlyEquivalent)} al mes{c.savingsPct > 0 ? ` · Ahorras ${c.savingsPct}%` : ''}</p>
                  )}
                  {bcvRate > 0 && <p className={s.bs}>≈ {bs(c.totalAmount, bcvRate)}</p>}
                </div>
              ) : (
                <div className={s.precioBloque}>
                  <p className={s.precio}><span className={s.monto}>Gratis</span><span className={s.unidad}>para siempre</span></p>
                  <p className={s.equivale}>No vence ni pide tarjeta.</p>
                </div>
              )}

              <ul className={s.lista}>
                {t.features.map(f => (
                  <li key={f}><Check size={15} aria-hidden="true" /><span>{f}</span></li>
                ))}
              </ul>

              {c ? (
                <a className={`${s.cta} ${t.destacado ? s.ctaDestacada : ''}`} target="_blank" rel="noopener noreferrer"
                  href={`${waBase}?text=${encodeURIComponent(`Hola, quiero el plan ${t.nombre} de ActivoPOS (${ETIQUETA[periodo].toLowerCase()})`)}`}>
                  <MessageCircle size={16} aria-hidden="true" />Empezar con {t.nombre}
                </a>
              ) : (
                <Link href="/registro" className={s.cta}>Empezar gratis</Link>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
