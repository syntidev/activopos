'use client'

import { useCallback, useEffect, useState } from 'react'
import { ImageUp, Plus, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { ImageField } from '@/components/ui/ImageField'
import { CARTA_ACCENTS, CARTA_PRESETS, CARTA_STYLES, DAY_KEYS, type CartaAccent, type CartaPreset, type CartaStyle } from '@/lib/carta/settings'
import styles from '../configuracion.module.css'
import own from './TabCarta.module.css'

type Dia = (typeof DAY_KEYS)[number]
type Tramo = [string, string]
type Horario = Record<Dia, Tramo[]>

interface CartaConfigResponse {
  ok: boolean
  config: { preset: CartaPreset; accent: CartaAccent | null; style: CartaStyle; hours: Partial<Record<Dia, Tramo[]>> | null; paused: boolean }
}
interface ImagenesNegocio {
  logo_path: string | null
  catalog_cover_path: string | null
  catalog_cover_path_2: string | null
  catalog_cover_path_3: string | null
}
type CampoImagen = keyof ImagenesNegocio

const PRESET_LABEL: Record<CartaPreset, string> = { brasa: 'Brasa', noche: 'Noche', cafe: 'Café', mar: 'Mar', verde: 'Verde' }
const ACCENT_LABEL: Record<CartaAccent, string> = { rojo: 'Rojo', vino: 'Vino', verde: 'Verde', azul: 'Azul', oro: 'Oro' }
const STYLE_LABEL: Record<CartaStyle, { name: string; hint: string }> = {
  casual: { name: 'Casual', hint: 'Cálido y cercano: tarjetas con sombra y botones redondeados.' },
  fine:   { name: 'Fine dining', hint: 'Sobrio y editorial: líneas finas, serif elegante.' },
}
const DAY_LONG: Record<Dia, string> = { lun: 'Lunes', mar: 'Martes', mie: 'Miércoles', jue: 'Jueves', vie: 'Viernes', sab: 'Sábado', dom: 'Domingo' }
const MAX_TRAMOS = 4
const TRAMO_NUEVO: Tramo = ['09:00', '18:00']

const horarioVacio = (): Horario => ({ lun: [], mar: [], mie: [], jue: [], vie: [], sab: [], dom: [] })
const desdeApi = (h: Partial<Record<Dia, Tramo[]>> | null): Horario => ({ ...horarioVacio(), ...(h ?? {}) })

/** Pestaña "Carta": diseño (preset, acento, estilo), horario por día, pausa de pedidos, logo y portadas. */
export function TabCarta() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [preset, setPreset] = useState<CartaPreset>('brasa')
  const [accent, setAccent] = useState<CartaAccent | null>(null)
  const [style, setStyle] = useState<CartaStyle>('casual')
  const [paused, setPaused] = useState(false)
  const [horario, setHorario] = useState<Horario>(horarioVacio())
  const [errorDia, setErrorDia] = useState<Dia | null>(null)
  const [guardandoHorario, setGuardandoHorario] = useState(false)
  const [imagenes, setImagenes] = useState<ImagenesNegocio>({ logo_path: null, catalog_cover_path: null, catalog_cover_path_2: null, catalog_cover_path_3: null })

  const cargar = useCallback(async () => {
    try {
      const [c, b] = await Promise.all([fetch('/api/config/carta'), fetch('/api/config/business')])
      if (!c.ok || !b.ok) throw new Error()
      const carta = await c.json() as CartaConfigResponse
      const negocio = await b.json() as { business: ImagenesNegocio }
      setPreset(carta.config.preset); setAccent(carta.config.accent); setStyle(carta.config.style); setPaused(carta.config.paused)
      setHorario(desdeApi(carta.config.hours))
      setImagenes({
        logo_path: negocio.business.logo_path, catalog_cover_path: negocio.business.catalog_cover_path,
        catalog_cover_path_2: negocio.business.catalog_cover_path_2, catalog_cover_path_3: negocio.business.catalog_cover_path_3,
      })
    } catch {
      toast('No se pudo cargar la configuración de la Carta.', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])
  useEffect(() => { void cargar() }, [cargar])

  const patchCarta = async (cuerpo: Record<string, unknown>, ok: string): Promise<boolean> => {
    const res = await fetch('/api/config/carta', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
    if (!res.ok) { toast('No se pudo guardar. Intenta de nuevo.', 'error'); return false }
    toast(ok, 'success')
    return true
  }

  // Diseño y pausa se guardan al instante (con reversión si falla).
  const elegirPreset = async (p: CartaPreset): Promise<void> => { const prev = preset; setPreset(p); if (!(await patchCarta({ carta_preset: p }, 'Diseño guardado.'))) setPreset(prev) }
  const elegirAcento = async (a: CartaAccent | null): Promise<void> => { const prev = accent; setAccent(a); if (!(await patchCarta({ carta_accent: a }, 'Acento guardado.'))) setAccent(prev) }
  const elegirEstilo = async (s: CartaStyle): Promise<void> => { const prev = style; setStyle(s); if (!(await patchCarta({ carta_style: s }, 'Estilo guardado.'))) setStyle(prev) }
  const alternarPausa = async (): Promise<void> => {
    const next = !paused
    setPaused(next)
    if (!(await patchCarta({ carta_paused: next }, next ? 'Pedidos en pausa.' : 'Pedidos activos.'))) setPaused(!next)
  }

  const cambiarTramo = (dia: Dia, i: number, pos: 0 | 1, valor: string): void => {
    setErrorDia(null)
    setHorario(h => ({ ...h, [dia]: h[dia].map((t, j) => (j === i ? (pos === 0 ? [valor, t[1]] : [t[0], valor]) : t) as Tramo) }))
  }
  const agregarTramo = (dia: Dia): void => setHorario(h => ({ ...h, [dia]: h[dia].length < MAX_TRAMOS ? [...h[dia], TRAMO_NUEVO] : h[dia] }))
  const quitarTramo = (dia: Dia, i: number): void => { setErrorDia(null); setHorario(h => ({ ...h, [dia]: h[dia].filter((_, j) => j !== i) })) }

  const guardarHorario = async (): Promise<void> => {
    const malo = DAY_KEYS.find(d => horario[d].some(([a, b]) => !a || !b || a >= b))
    if (malo) { setErrorDia(malo); return }
    setGuardandoHorario(true)
    await patchCarta({ carta_hours: horario }, 'Horario guardado.')
    setGuardandoHorario(false)
  }

  const guardarImagen = async (campo: CampoImagen, url: string | null): Promise<void> => {
    const res = await fetch('/api/config/business', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [campo]: url }) })
    if (!res.ok) throw new Error(url ? 'No se pudo guardar la imagen.' : 'No se pudo quitar la imagen.')
    setImagenes(prev => ({ ...prev, [campo]: url }))
    toast(url ? 'Imagen guardada.' : 'Imagen quitada.', 'success')
  }

  if (loading) return <p className={own.cargando}>Cargando…</p>

  return (
    <div>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>Carta</h2>
        <p className={styles.pageSubtitle}>Cómo se ve tu carta digital y cuándo recibe pedidos. Los cambios se aplican en tu enlace público.</p>
      </div>

      <section className={styles.formCard} aria-labelledby="carta-pedidos">
        <h3 className={styles.formCardTitle} id="carta-pedidos">Pedidos</h3>
        <div className={own.fila}>
          <div>
            <b>{paused ? 'Pedidos en pausa' : 'Recibiendo pedidos'}</b>
            <p className={own.ayuda}>Con la pausa activa la carta se ve, pero nadie puede enviar pedidos.</p>
          </div>
          <button type="button" role="switch" aria-checked={paused} aria-label="Pausar pedidos" className={own.interruptor} data-on={paused ? 'true' : 'false'} onClick={() => { void alternarPausa() }} data-testid="carta-cfg-pausa"><i /></button>
        </div>
      </section>

      <section className={styles.formCard} aria-labelledby="carta-diseno">
        <h3 className={styles.formCardTitle} id="carta-diseno">Diseño</h3>
        <p className={own.etiqueta}>Paleta</p>
        <div className={own.presets} role="radiogroup" aria-label="Paleta de la carta">
          {CARTA_PRESETS.map(p => (
            <button key={p} type="button" role="radio" aria-checked={preset === p} className={own.preset} onClick={() => { void elegirPreset(p) }} data-testid={'carta-cfg-preset-' + p}>
              <span className={own.vista} data-carta-preset={p} data-carta-accent={accent ?? undefined}>
                <b>Aa</b><i /><small>$12.00</small>
              </span>
              <span>{PRESET_LABEL[p]}</span>
            </button>
          ))}
        </div>

        <p className={own.etiqueta}>Color de acento</p>
        <div className={own.acentos} role="radiogroup" aria-label="Color de acento">
          <button type="button" role="radio" aria-checked={accent === null} className={own.acento} onClick={() => { void elegirAcento(null) }}><span className={own.muestraAuto}>A</span>Automático</button>
          {CARTA_ACCENTS.map(a => (
            <button key={a} type="button" role="radio" aria-checked={accent === a} className={own.acento} onClick={() => { void elegirAcento(a) }} data-testid={'carta-cfg-acento-' + a}>
              <span className={own.muestra} data-carta-preset={preset} data-carta-accent={a} />{ACCENT_LABEL[a]}
            </button>
          ))}
        </div>

        <p className={own.etiqueta}>Estilo</p>
        <div className={own.estilos} role="radiogroup" aria-label="Estilo de la carta">
          {CARTA_STYLES.map(s => (
            <button key={s} type="button" role="radio" aria-checked={style === s} className={own.estilo} onClick={() => { void elegirEstilo(s) }} data-testid={'carta-cfg-estilo-' + s}>
              <b>{STYLE_LABEL[s].name}</b><span>{STYLE_LABEL[s].hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.formCard} aria-labelledby="carta-horario">
        <h3 className={styles.formCardTitle} id="carta-horario">Horario</h3>
        <p className={own.ayuda}>Hora de Caracas. Un día sin tramos aparece como cerrado; puedes poner varios tramos (ej. almuerzo y cena).</p>
        <div className={own.dias}>
          {DAY_KEYS.map(d => (
            <div key={d} className={own.dia} data-testid={'carta-cfg-dia-' + d}>
              <div className={own.diaCab}>
                <b>{DAY_LONG[d]}</b>
                {horario[d].length === 0 && <span className={own.cerrado}>Cerrado</span>}
              </div>
              {horario[d].map((t, i) => (
                <div key={i} className={own.tramo}>
                  <input type="time" className={own.hora} value={t[0]} onChange={e => cambiarTramo(d, i, 0, e.target.value)} aria-label={DAY_LONG[d] + ' abre, tramo ' + (i + 1)} />
                  <span aria-hidden="true">a</span>
                  <input type="time" className={own.hora} value={t[1]} onChange={e => cambiarTramo(d, i, 1, e.target.value)} aria-label={DAY_LONG[d] + ' cierra, tramo ' + (i + 1)} />
                  <button type="button" className={own.icono} onClick={() => quitarTramo(d, i)} aria-label={'Quitar tramo ' + (i + 1) + ' del ' + DAY_LONG[d]}><Trash2 size={18} aria-hidden="true" /></button>
                </div>
              ))}
              {horario[d].length < MAX_TRAMOS && (
                <button type="button" className={own.agregar} onClick={() => agregarTramo(d)} data-testid={'carta-cfg-agregar-' + d}><Plus size={16} aria-hidden="true" />Agregar tramo</button>
              )}
              {errorDia === d && <p className={own.error} role="alert">En el {DAY_LONG[d].toLowerCase()} la hora de cierre debe ser posterior a la de apertura.</p>}
            </div>
          ))}
        </div>
        <button type="button" className={own.guardar} onClick={() => { void guardarHorario() }} disabled={guardandoHorario} data-testid="carta-cfg-guardar-horario">
          {guardandoHorario ? 'Guardando…' : 'Guardar horario'}
        </button>
      </section>

      <section className={styles.formCard} aria-labelledby="carta-imagenes">
        <h3 className={styles.formCardTitle} id="carta-imagenes"><ImageUp size={16} aria-hidden="true" />Logo y portadas</h3>
        <p className={own.etiqueta}>Logo (se muestra en círculo)</p>
        <ImageField label="Logo del negocio" hideLabel value={imagenes.logo_path} onChange={u => guardarImagen('logo_path', u)} uploadType="logo" removable layout="inline"
          boxClassName={own.logoCaja} alt="Logo del negocio" emptyContent={<span className={own.vacio}>Logo</span>} />
        <p className={own.etiqueta}>Portada (si subes varias, se muestran como carrusel)</p>
        {(['catalog_cover_path', 'catalog_cover_path_2', 'catalog_cover_path_3'] as const).map((campo, i) => (
          <div key={campo} className={own.portada}>
            <ImageField label={'Portada ' + (i + 1)} value={imagenes[campo]} onChange={u => guardarImagen(campo, u)} uploadType="catalog_cover" removable
              boxClassName={own.portadaCaja} alt={'Portada ' + (i + 1)} emptyContent={<span className={own.vacio}>Subir portada {i + 1}</span>} />
          </div>
        ))}
        <p className={own.ayuda}>Recomendado: horizontal, ~1200 × 480 px, hasta 5 MB (JPG, PNG o WebP).</p>
      </section>
    </div>
  )
}
