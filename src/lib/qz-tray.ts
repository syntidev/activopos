// Conexión con QZ Tray (puente entre el navegador y la impresora del equipo).
//
// Solo corre en el navegador. La librería se carga con import() dinámico: el
// paquete toca `window`/`WebSocket` al inicializarse y no debe evaluarse en el
// render del servidor.
//
// Puertos y protocolo NO se fijan: qz-tray.js prueba solo (verificado en su
// código, v2.3.0) WSS 8181/8282/8383/8484 en una página https y WS
// 8182/8283/8384/8485 en http.
//
// Firma: si el servidor tiene QZ_CERTIFICATE + QZ_PRIVATE_KEY, cada mensaje se
// firma en /api/qz/sign (la clave privada nunca llega al navegador) y QZ Tray
// imprime sin diálogo. Si no, QZ funciona en modo sin firma y muestra su aviso
// "Untrusted website" en el equipo del cajero.

import type * as QzApi from 'qz-tray'

type Qz = typeof QzApi

export const QZ_DOWNLOAD_URL = 'https://qz.io/download/'

export type QzStatus =
  | { state: 'connected'; version: string; signed: boolean }
  | { state: 'unavailable'; reason: 'not-running' | 'denied'; message: string }

export type QzResult<T> = { ok: true; value: T } | { ok: false; message: string }

// Trazas explícitas de cada paso (pedido del sprint: logs claros de qué pasa).
const qzLog = (step: string, detail?: unknown): void => {
  if (detail === undefined) console.info(`[QZ] ${step}`)
  else console.info(`[QZ] ${step}`, detail)
}

let qzPromise: Promise<Qz> | null = null

function loadQz(): Promise<Qz> {
  if (!qzPromise) {
    qzPromise = import('qz-tray').then(mod => ((mod as unknown as { default?: Qz }).default ?? mod) as Qz)
  }
  return qzPromise
}

let signingPromise: Promise<boolean> | null = null

/** Cablea la firma si el servidor la tiene configurada. Devuelve si quedó activa. */
function configureSigning(qz: Qz): Promise<boolean> {
  if (!signingPromise) {
    signingPromise = (async () => {
      try {
        const res = await fetch('/api/qz/certificate', { cache: 'no-store', credentials: 'same-origin' })
        // Con la sesión vencida el middleware redirige a /login y fetch lo sigue:
        // llega HTML con 200. Solo un PEM de certificado cuenta como "firma configurada".
        const certificate = res.ok && !res.redirected ? await res.text() : ''
        if (!certificate.startsWith('-----BEGIN CERTIFICATE-----')) {
          qzLog('firma digital no disponible (no configurada en el servidor o sesión vencida): QZ Tray pedirá confirmación en este equipo (modo sin firma)')
          return false
        }
        qz.security.setCertificatePromise((resolve: (cert: string) => void) => resolve(certificate))
        qz.security.setSignatureAlgorithm('SHA512')
        qz.security.setSignaturePromise(async (message: string): Promise<string> => {
          const r = await fetch('/api/qz/sign', {
            method:      'POST',
            headers:     { 'Content-Type': 'application/json' },
            body:        JSON.stringify({ message }),
            credentials: 'same-origin',
          })
          if (!r.ok) throw new Error(`No se pudo firmar el mensaje (HTTP ${r.status})`)
          return r.text()
        })
        qzLog('firma digital activa (SHA512, firmada en el servidor)')
        return true
      } catch (e) {
        qzLog('no se pudo consultar la firma digital; se sigue sin firma', e)
        return false
      }
    })()
  }
  return signingPromise
}

const errorMessage = (e: unknown): string =>
  e instanceof Error && e.message ? e.message : typeof e === 'string' && e ? e : 'Error desconocido'

/** Detecta QZ Tray en este equipo y abre la conexión. Nunca falla en silencio. */
export async function connectQz(): Promise<QzStatus> {
  qzLog('cargando la librería qz-tray...')
  const qz = await loadQz()
  const signed = await configureSigning(qz)

  if (qz.websocket.isActive()) {
    const version = await qz.api.getVersion()
    qzLog(`ya conectado. QZ Tray v${version}`)
    return { state: 'connected', version, signed }
  }

  qzLog('buscando QZ Tray en este equipo (WebSocket local)...')
  try {
    await qz.websocket.connect({ retries: 1, delay: 1 })
    const version = await qz.api.getVersion()
    qzLog(`conectado. QZ Tray v${version} (${signed ? 'con firma' : 'sin firma'})`)
    return { state: 'connected', version, signed }
  } catch (e) {
    // qz-tray.js marca `denied` cuando el usuario rechaza el permiso de red
    // local del navegador (Local Network Access de Chrome).
    const denied = typeof e === 'object' && e !== null && 'denied' in e && Boolean((e as { denied?: unknown }).denied)
    qzLog(denied ? 'el navegador bloqueó el acceso a la red local' : 'QZ Tray no respondió', e)
    return denied
      ? {
          state: 'unavailable', reason: 'denied',
          message: 'El navegador bloqueó el acceso a este equipo. Permite el acceso a dispositivos de la red local para este sitio y vuelve a intentar.',
        }
      : {
          state: 'unavailable', reason: 'not-running',
          message: 'No se detectó QZ Tray en este equipo. Instálalo y ábrelo: su icono aparece junto al reloj de Windows.',
        }
  }
}

/** Impresoras que QZ Tray ve en este equipo (las mismas que Windows). */
export async function listPrinters(): Promise<QzResult<string[]>> {
  const status = await connectQz()
  if (status.state !== 'connected') return { ok: false, message: status.message }
  try {
    qzLog('pidiendo la lista de impresoras...')
    const found = await (await loadQz()).printers.find()
    const printers = (Array.isArray(found) ? found : [found]).filter((p): p is string => typeof p === 'string' && p !== '')
    qzLog(`${printers.length} impresora(s) detectada(s)`, printers)
    return { ok: true, value: printers }
  } catch (e) {
    qzLog('falló la lista de impresoras', e)
    return { ok: false, message: `No se pudo leer la lista de impresoras: ${errorMessage(e)}` }
  }
}

/** Envía un comando crudo (ESC/POS) a la impresora, sin diálogo de Windows. */
export async function printRaw(printer: string, data: string): Promise<QzResult<null>> {
  const status = await connectQz()
  if (status.state !== 'connected') return { ok: false, message: status.message }
  try {
    const qz = await loadQz()
    qzLog(`enviando ${data.length} caracteres a "${printer}"...`)
    // Un string dentro de `data` lo interpreta QZ como {type:'raw', format:'command', flavor:'plain'}.
    await qz.print(qz.configs.create(printer), [data])
    qzLog('QZ Tray aceptó el trabajo de impresión')
    return { ok: true, value: null }
  } catch (e) {
    qzLog('falló el envío a la impresora', e)
    return { ok: false, message: `No se pudo imprimir: ${errorMessage(e)}` }
  }
}
