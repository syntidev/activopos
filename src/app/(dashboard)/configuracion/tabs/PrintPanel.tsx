'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CircleDashed, AlertTriangle, XCircle, PlugZap, Copy, RefreshCw } from 'lucide-react'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { connectQz, listPrinters, QZ_DOWNLOAD_URL, QZ_IDLE, type QzInfo } from '@/lib/printing/qz-client'
import { colsForPaper, layoutSaleTicket, renderPreview } from '@/lib/printing/escpos'
import { printTestTicketThermal } from '@/lib/thermal-print'
import { DEFAULT_THERMAL_SETTINGS, loadThermalSettings, saveThermalSettings } from '@/lib/thermal-settings'
import type { TicketConfig } from '@/types'
import { DEFAULT_PRINT_SETTINGS, type PrintSettings, type ThermalPaper, type ThermalSettings, type ThermalTicketData } from '@/types/thermal'
import styles from '../configuracion.module.css'
import p from './PrintPanel.module.css'

interface Props {
  businessId:   number
  businessName: string
  /** Ajustes del ticket que el usuario está editando arriba (la vista previa los refleja sin guardar). */
  config:       TicketConfig
}

type Level = 'ok' | 'warn' | 'bad' | 'idle'

interface Check {
  key:    string
  title:  string
  level:  Level
  detail: string
}

const LEVEL_LABEL: Record<Level, string> = { ok: 'Listo', warn: 'Atención', bad: 'Falla', idle: 'Pendiente' }

function LevelIcon({ level }: { level: Level }) {
  const props = { size: 18, 'aria-hidden': true as const }
  if (level === 'ok')   return <CheckCircle2 {...props} className={p.iconOk} />
  if (level === 'warn') return <AlertTriangle {...props} className={p.iconWarn} />
  if (level === 'bad')  return <XCircle {...props} className={p.iconBad} />
  return <CircleDashed {...props} className={p.iconIdle} />
}

interface SwitchProps { label: string; hint: string; checked: boolean; onToggle: () => void }

function Switch({ label, hint, checked, onToggle }: SwitchProps) {
  return (
    <div className={styles.toggleRow}>
      <div>
        <p className={styles.toggleLabel}>{label}</p>
        <p className={styles.toggleHint}>{hint}</p>
      </div>
      <button
        type="button"
        className={`${styles.toggleBtn} ${checked ? styles.toggleBtnOn : ''}`}
        onClick={onToggle}
        aria-pressed={checked}
        aria-label={`${checked ? 'Desactivar' : 'Activar'} ${label.toLowerCase()}`}
      >
        <span className={`${styles.toggleKnob} ${checked ? styles.toggleKnobOn : ''}`} />
      </button>
    </div>
  )
}

export function PrintPanel({ businessId, businessName, config }: Props) {
  const { toast } = useToast()

  const [info, setInfo]         = useState<QzInfo>(QZ_IDLE)
  const [printers, setPrinters] = useState<string[]>([])
  const [checking, setChecking] = useState(false)
  const [thermal, setThermal]   = useState<ThermalSettings>(DEFAULT_THERMAL_SETTINGS)
  const [print, setPrint]       = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS)
  const [header, setHeader]     = useState('')
  const [lastTicket, setLastTicket] = useState<ThermalTicketData | null>(null)
  const [testing, setTesting]   = useState(false)

  const paper: ThermalPaper =
    config.ticket_format === '58mm' || config.ticket_format === '80mm' ? config.ticket_format : thermal.paper
  const cols = colsForPaper(paper)

  /* ── Carga inicial: ajustes del equipo, del negocio y la última venta (para la vista previa) ── */
  useEffect(() => {
    setThermal(loadThermalSettings(businessId))
    let alive = true
    fetch('/api/config/print')
      .then(r => (r.ok ? r.json() : null))
      .then((j: { print?: PrintSettings } | null) => {
        if (!alive || !j?.print) return
        setPrint(j.print)
        setHeader(j.print.header)
      })
      .catch(() => {})
    fetch('/api/sales?limit=1&status=paid')
      .then(r => (r.ok ? r.json() : null))
      .then(async (j: { sales?: { id: number }[] } | null) => {
        const id = j?.sales?.[0]?.id
        if (!id) return
        const t = await fetch(`/api/sales/${id}/ticket-data`).then(r => (r.ok ? r.json() : null)) as { ticket?: ThermalTicketData } | null
        if (alive && t?.ticket) setLastTicket(t.ticket)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [businessId])

  /* ── Conexión: bajo demanda (al abrir el panel y con el botón), nunca al arrancar la app ── */
  const check = useCallback(async () => {
    setChecking(true)
    const next = await connectQz()
    setInfo(next)
    if (next.state === 'conectado') {
      const found = await listPrinters()
      setPrinters(found.ok ? found.value : [])
      if (!found.ok) toast(found.message, 'error')
    } else {
      setPrinters([])
    }
    setChecking(false)
  }, [toast])

  useEffect(() => { void check() }, [check])

  const updateThermal = (patch: Partial<ThermalSettings>) => {
    const next = { ...thermal, ...patch }
    setThermal(next)
    if (!saveThermalSettings(businessId, next)) {
      toast('El navegador bloquea el almacenamiento: no se pudo guardar la impresora en este equipo.', 'error')
    }
  }

  const savePrint = async (patch: Partial<PrintSettings>) => {
    const prev = print
    setPrint({ ...print, ...patch })
    try {
      const res = await fetch('/api/config/print', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error()
    } catch {
      setPrint(prev)
      toast('No se pudo guardar el ajuste de impresión.', 'error')
    }
  }

  /* ── Semáforo ── */
  const checks: Check[] = useMemo(() => {
    const running = info.state === 'conectado'
    const selected = thermal.printer
    return [
      {
        key: 'qz', title: 'QZ Tray instalado y corriendo',
        level: running ? 'ok' : info.state === 'disponible' ? 'idle' : 'bad',
        detail: running
          ? `Versión ${info.version ?? '?'}.`
          : info.state === 'disponible'
            ? 'Pulsa «Comprobar de nuevo» para buscarlo en este equipo.'
            : 'Instala QZ Tray y ábrelo (sigue la guía de abajo), luego pulsa «Comprobar de nuevo».',
      },
      {
        key: 'conn', title: 'Conexión establecida',
        level: running ? (info.secure ? 'ok' : 'warn') : 'bad',
        detail: running
          ? `Puerto ${info.port ?? '?'}, conexión ${info.secure ? 'segura' : 'no segura'}.`
          : info.state === 'error'
            ? info.message
            : 'Sin conexión: QZ Tray no responde en este equipo.',
      },
      {
        key: 'sign', title: 'Modo de firma',
        level: info.signed === true ? 'ok' : info.signed === false ? 'warn' : 'idle',
        detail: info.signed === true
          ? 'Firmado por el servidor: imprime sin avisos.'
          : info.signed === false
            ? 'Sin certificado: autoriza una vez y marca «Recordar esta decisión» en el aviso de QZ Tray.'
            : 'Se sabe al conectar con QZ Tray.',
      },
      {
        key: 'printers', title: 'Impresoras detectadas',
        level: !running ? 'idle' : printers.length > 0 ? 'ok' : 'bad',
        detail: !running
          ? 'Se detectan al conectar con QZ Tray.'
          : printers.length > 0
            ? `${printers.length} impresora(s) en este equipo.`
            : 'QZ Tray no ve impresoras. Revisa que la impresora esté instalada y encendida en Windows.',
      },
      {
        key: 'selected', title: 'Impresora seleccionada en este equipo',
        level: !selected ? 'bad' : running && !printers.includes(selected) ? 'warn' : 'ok',
        detail: !selected
          ? 'Elige una impresora en la lista de abajo.'
          : running && !printers.includes(selected)
            ? `«${selected}» no aparece ahora en la lista: ¿está apagada o es de otro equipo?`
            : `«${selected}».`,
      },
    ]
  }, [info, printers, thermal.printer])

  /* ── Vista previa: la última venta real con los ajustes que se están editando ── */
  const preview = useMemo(() => {
    if (!lastTicket) return null
    const flags = {
      show_description: config.show_description, show_bs: config.show_bs, show_foreign: config.show_foreign,
      foreign_format: config.foreign_format, show_address: config.show_address, show_phone: config.show_phone,
      show_customer_data: config.show_customer_data, show_rif: config.show_rif,
      show_cashier_name: config.show_cashier_name, show_bcv_rate: config.show_bcv_rate,
      show_payment_method: config.show_payment_method,
    }
    const ticket: ThermalTicketData = {
      ...lastTicket,
      business: { ...lastTicket.business, footer: config.ticket_footer?.trim() || null },
      print: { ...print, header },
      flags,
    }
    const catalogUrl = ticket.business.catalog_slug && typeof window !== 'undefined'
      ? `${window.location.origin}/catalogo/${ticket.business.catalog_slug}`
      : null
    return renderPreview(layoutSaleTicket(ticket, paper, { catalogUrl }), paper)
  }, [lastTicket, config, print, header, paper])

  const handleTest = async () => {
    if (!thermal.printer) return
    setTesting(true)
    const result = await printTestTicketThermal({
      printer: thermal.printer, businessName, qzVersion: info.version ?? '?', paper, print: { ...print, header },
    })
    if (result.state === 'printed') toast(`Enviado a «${result.printer}». Revisa la impresora: ¿salió el papel?`, 'success')
    else toast(result.state === 'error' ? result.message : 'No se envió nada a la impresora.', 'error')
    setTesting(false)
  }

  const handleCopy = async () => {
    const text = [
      'Diagnóstico de impresión — ActivoPOS',
      ...checks.map(c => `[${LEVEL_LABEL[c.level]}] ${c.title}: ${c.detail}`),
      `Versión de QZ Tray: ${info.version ?? 'no disponible'}`,
      `Navegador: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'desconocido'}`,
      `Impresora elegida: ${thermal.printer ?? 'ninguna'}`,
      `Ancho: ${paper} (${cols} columnas) | Código: ${print.codepage.toUpperCase()}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      toast('Diagnóstico copiado. Pégalo en el mensaje a soporte.', 'success')
    } catch {
      toast('No se pudo copiar. Tu navegador bloqueó el portapapeles.', 'error')
    }
  }

  // Una impresora guardada que QZ no lista ahora se conserva visible en el selector.
  const printerOptions = thermal.printer && !printers.includes(thermal.printer)
    ? [thermal.printer, ...printers]
    : printers

  return (
    <>
      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>
          <PlugZap size={16} aria-hidden="true" />
          Estado de la impresión térmica
        </h3>

        <ul className={p.checks}>
          {checks.map(c => (
            <li key={c.key} className={p.check}>
              <LevelIcon level={c.level} />
              <div className={p.checkBody}>
                <p className={p.checkTitle}>{c.title} <span className={`${p.badge} ${p[`badge_${c.level}`]}`}>{LEVEL_LABEL[c.level]}</span></p>
                <p className={p.checkDetail}>{c.detail}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className={p.actions}>
          <Button variant="secondary" onClick={check} loading={checking}>
            <RefreshCw size={14} aria-hidden="true" /> Comprobar de nuevo
          </Button>
          <Button variant="secondary" onClick={handleCopy}>
            <Copy size={14} aria-hidden="true" /> Copiar diagnóstico
          </Button>
        </div>
      </div>

      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>Impresora de este equipo</h3>
        <p className={styles.toggleHint}>Esta selección se guarda solo en este equipo.</p>

        <Switch
          label="Imprimir ticket térmico en este equipo"
          hint="Imprime al cobrar, sin el diálogo de Windows."
          checked={thermal.enabled}
          onToggle={() => updateThermal({ enabled: !thermal.enabled })}
        />

        <div className={`${styles.fieldGroup} ${styles.mt4}`}>
          <label className={styles.label} htmlFor="thermal-printer">Impresora</label>
          <select
            id="thermal-printer"
            className={styles.select}
            value={thermal.printer ?? ''}
            onChange={(e) => updateThermal({ printer: e.target.value || null })}
          >
            <option value="">{printerOptions.length > 0 ? 'Elige una impresora' : 'Aún no hay impresoras detectadas'}</option>
            {printerOptions.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>

        {config.ticket_format === 'carta' && (
          <div className={`${styles.fieldGroup} ${styles.mt4}`}>
            <label className={styles.label} htmlFor="thermal-paper">Ancho del rollo en este equipo</label>
            <select
              id="thermal-paper"
              className={styles.select}
              value={thermal.paper}
              onChange={(e) => updateThermal({ paper: e.target.value as ThermalPaper })}
            >
              <option value="58mm">58 mm (32 caracteres por línea)</option>
              <option value="80mm">80 mm (48 caracteres por línea)</option>
            </select>
          </div>
        )}

        <div className={styles.saveRow}>
          <Button variant="primary" onClick={handleTest} loading={testing} disabled={!thermal.printer || info.state !== 'conectado'}>
            Imprimir prueba
          </Button>
        </div>
      </div>

      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>Qué imprime el ticket</h3>
        <p className={styles.toggleHint}>
          Estos ajustes son del negocio y se guardan al instante. El ancho ({paper}) sale de «Tamaño del papel», arriba.
        </p>

        <Switch label="Imprimir al cobrar" hint="Cada venta cobrada sale sola por la impresora." checked={print.auto_print} onToggle={() => void savePrint({ auto_print: !print.auto_print })} />
        <Switch label="Abrir el cajón" hint="Manda el pulso al cajón de dinero conectado a la impresora." checked={print.open_drawer} onToggle={() => void savePrint({ open_drawer: !print.open_drawer })} />
        <Switch label="Logo del negocio" hint="Imprime tu logo arriba del nombre." checked={print.show_logo} onToggle={() => void savePrint({ show_logo: !print.show_logo })} />
        <Switch label="QR al catálogo" hint="Imprime un código QR que lleva a tu catálogo." checked={print.show_catalog_qr} onToggle={() => void savePrint({ show_catalog_qr: !print.show_catalog_qr })} />

        <div className={`${styles.fieldGroup} ${styles.mt4}`}>
          <Input
            label="Encabezado del ticket"
            value={header}
            onChange={(e) => setHeader(e.target.value)}
            onBlur={() => { if (header !== print.header) void savePrint({ header }) }}
            placeholder="Ej: Sucursal Porlamar"
            maxLength={120}
            hint="Una línea extra bajo el nombre del negocio. Se guarda al salir del campo."
          />
        </div>

        <div className={`${styles.fieldGroup} ${styles.mt4}`}>
          <label className={styles.label} htmlFor="print-codepage">Tabla de caracteres</label>
          <select
            id="print-codepage"
            className={styles.select}
            value={print.codepage}
            onChange={(e) => void savePrint({ codepage: e.target.value === 'cp850' ? 'cp850' : 'cp858' })}
          >
            <option value="cp858">CP858 (recomendada: ñ, acentos y €)</option>
            <option value="cp850">CP850 (si tu impresora imprime símbolos raros)</option>
          </select>
        </div>
        <p className={styles.toggleHint}>
          RIF, dirección, teléfono, cajero, cliente, tasa BCV, métodos de pago y mensaje de pie se activan en «Datos del negocio en ticket», arriba.
        </p>
      </div>

      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>Vista previa ({cols} caracteres por línea)</h3>
        {preview
          ? <pre className={p.preview}>{preview}</pre>
          : <p className={styles.toggleHint}>La vista previa usa tu última venta cobrada. Cuando hagas la primera aparecerá aquí.</p>}
      </div>

      <div className={styles.formCard}>
        <h3 className={styles.formCardTitle}>Cómo instalar QZ Tray</h3>
        <ol className={p.steps}>
          <li>Descarga QZ Tray desde <a href={QZ_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className={styles.statusLink}>qz.io/download</a> e instálalo en la computadora que tiene la impresora.</li>
          <li>Ábrelo: vas a ver un icono junto al reloj de Windows. Debe quedar abierto mientras vendes.</li>
          <li>Vuelve aquí y pulsa «Comprobar de nuevo». Si el navegador pregunta por el acceso a tu red local, dile que sí.</li>
          <li>Cuando QZ Tray te muestre un aviso de sitio no confiable, marca «Recordar esta decisión» y pulsa «Permitir». Solo se pide una vez.</li>
          <li>Elige tu impresora en la lista y pulsa «Imprimir prueba». Si el ticket sale con la regla completa y las letras con acento bien, ya está listo.</li>
        </ol>
      </div>
    </>
  )
}
