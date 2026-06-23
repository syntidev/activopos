'use client'

import { useState } from 'react'
import { ShoppingBasket, Shirt, Beef, Zap, Ruler, Plus, FileText, Star } from 'lucide-react'
import styles from './SpecsSection.module.css'

interface Props {
  bcvRate: number
}

function fmtBs(usd: number, rate: number): string {
  if (!rate) return '...'
  return (usd * rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const TABS = [
  { id: 'unidad',   label: 'Unidad' },
  { id: 'ropa',     label: 'Ropa' },
  { id: 'carne',    label: 'Carnicería' },
  { id: 'servicio', label: 'Servicio' },
  { id: 'material', label: 'Ferretería' },
] as const

type TabId = typeof TABS[number]['id']

interface Panel {
  icon: React.ElementType
  iconVariant: string
  name: string
  type: string
  priceUsd: number
  priceLabel: string
  specs: { label: string; opts: { val: string; active?: boolean; out?: boolean; color?: string }[] }[]
  ctaLabel: string
  ctaIcon: React.ElementType
}

function buildPanels(rate: number): Record<TabId, Panel> {
  return {
    unidad: {
      icon: ShoppingBasket, iconVariant: 'brand',
      name: 'Harina P.A.N. 1kg', type: 'Producto físico · Bodega / Abasto',
      priceUsd: 0.85, priceLabel: '$0.85',
      specs: [
        { label: 'Cantidad', opts: [{ val: '1' }, { val: '2', active: true }, { val: '3' }, { val: '5' }, { val: '10' }] },
        { label: 'Stock disponible', opts: [{ val: '24 und en bodega' }] },
      ],
      ctaLabel: 'Agregar · 2 × Harina P.A.N. · $1.70',
      ctaIcon: Plus,
    },
    ropa: {
      icon: Shirt, iconVariant: 'brand',
      name: 'Camisa Polo', type: 'Producto físico · Tienda de ropa',
      priceUsd: 15, priceLabel: '$15.00',
      specs: [
        { label: 'Talla', opts: [{ val: 'XS', out: true }, { val: 'S' }, { val: 'M', active: true }, { val: 'L' }, { val: 'XL' }, { val: 'XXL', out: true }] },
        { label: 'Color', opts: [{ val: '', color: '#1D4ED8', active: true }, { val: '', color: '#DC2626' }, { val: '', color: '#1F2937' }, { val: '', color: '#F9FAFB' }] },
      ],
      ctaLabel: 'Agregar · Camisa M · Azul · $15.00',
      ctaIcon: Plus,
    },
    carne: {
      icon: Beef, iconVariant: 'danger',
      name: 'Lomo de Res', type: 'Vendido por peso · Carnicería',
      priceUsd: 8.5, priceLabel: '$8.50/kg',
      specs: [
        { label: 'Cantidad (kg)', opts: [{ val: '0.25' }, { val: '0.5' }, { val: '1.0', active: true }, { val: '1.5' }, { val: '2.0' }] },
        { label: 'Corte', opts: [{ val: 'Entero', active: true }, { val: 'Molido' }, { val: 'Bistec' }] },
      ],
      ctaLabel: 'Agregar · Lomo 1.0kg Entero · $8.50',
      ctaIcon: Plus,
    },
    servicio: {
      icon: Zap, iconVariant: 'warning',
      name: 'Instalación Eléctrica', type: 'Servicio · Cotización con mano de obra',
      priceUsd: 25, priceLabel: 'Desde $25.00/hora',
      specs: [
        { label: 'Tipo de servicio', opts: [{ val: 'Residencial', active: true }, { val: 'Comercial' }, { val: 'Industrial' }] },
        { label: 'Horas estimadas', opts: [{ val: '1h' }, { val: '2h', active: true }, { val: '4h' }, { val: 'Día completo' }] },
      ],
      ctaLabel: 'Generar cotización · 2h Residencial · $50.00',
      ctaIcon: FileText,
    },
    material: {
      icon: Ruler, iconVariant: 'success',
      name: 'Tubo PVC', type: 'Vendido por metro · Ferretería',
      priceUsd: 1.2, priceLabel: '$1.20/m',
      specs: [
        { label: 'Diámetro', opts: [{ val: '½"' }, { val: '¾"', active: true }, { val: '1"' }, { val: '2"' }] },
        { label: 'Metros', opts: [{ val: '1m' }, { val: '2m' }, { val: '3m', active: true }, { val: '6m' }] },
      ],
      ctaLabel: 'Agregar · Tubo ¾" × 3m · $3.60',
      ctaIcon: Plus,
    },
  }
}

export default function SpecsSection({ bcvRate }: Props) {
  const [active, setActive] = useState<TabId>('unidad')
  const panels = buildPanels(bcvRate)
  const panel = panels[active]
  const Icon = panel.icon
  const CtaIcon = panel.ctaIcon

  return (
    <section className={styles.section} id="especificaciones">
      <div className={styles.container}>
        <div className={styles.grid}>
          {/* Copy */}
          <div className={styles.copy}>
            <div className={styles.badge} data-reveal>
              <Star size={11} aria-hidden />
              Exclusivo en Venezuela
            </div>
            <h2 className={styles.title} data-reveal>
              Cada producto como<br />realmente es.
            </h2>
            <p className={styles.subtitle} data-reveal>
              Ningún negocio vende igual. ActivoPOS se adapta a cómo tú trabajas — no al revés.
              Define las especificaciones que tienen sentido para tu producto: peso, talla, color,
              medida, tiempo, modelo.
            </p>
            <div className={styles.tabs} data-reveal>
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  className={`${styles.tab} ${active === id ? styles.tabOn : ''}`}
                  onClick={() => setActive(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className={styles.note} data-reveal>
              El sistema calcula el precio final, descuenta el inventario y lo imprime en el ticket.
              Siempre en USD con equivalente en Bs al momento del cobro.
            </p>
          </div>

          {/* Demo card */}
          <div className={styles.demoWrap} data-reveal data-reveal-from="right">
            <div className={styles.demo}>
              {/* Header */}
              <div className={styles.demoHead}>
                <div className={`${styles.demoIcon} ${styles[`demoIcon_${panel.iconVariant}`]}`}>
                  <Icon size={24} aria-hidden />
                </div>
                <div>
                  <div className={styles.demoName}>{panel.name}</div>
                  <div className={styles.demoType}>{panel.type}</div>
                  <div className={styles.demoPrice}>
                    {panel.priceLabel} ·{' '}
                    <strong>Bs. {fmtBs(panel.priceUsd, bcvRate)}</strong>
                  </div>
                </div>
              </div>

              {/* Specs */}
              <div className={styles.specs}>
                {panel.specs.map(({ label, opts }) => (
                  <div key={label} className={styles.specRow}>
                    <div className={styles.specLabel}>{label}</div>
                    <div className={styles.specOpts}>
                      {opts.map((opt, i) => (
                        opt.color ? (
                          <div
                            key={i}
                            className={`${styles.colorDot} ${opt.active ? styles.colorDotOn : ''}`}
                            style={{ background: opt.color }}
                            aria-label={opt.color}
                          />
                        ) : (
                          <div
                            key={opt.val}
                            className={`${styles.opt} ${opt.active ? styles.optOn : ''} ${opt.out ? styles.optOut : ''}`}
                          >
                            {opt.val}
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA button */}
              <button className={styles.addBtn}>
                <CtaIcon size={14} aria-hidden />
                {panel.ctaLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
