// Único punto de contacto con QZ Tray (puente entre el navegador y la impresora del equipo).
//
// Solo corre en el navegador y SOLO bajo demanda (al imprimir o al abrir el
// panel): nunca se conecta al arrancar la app. La librería se carga con
// import() dinámico porque toca `window`/`WebSocket` al inicializarse y no debe
// evaluarse en el servidor.
//
// Firma: si el servidor tiene QZ_CERTIFICATE + QZ_PRIVATE_KEY, cada mensaje se
// firma en /api/qz/sign (la clave privada nunca llega al navegador) y QZ Tray
// imprime sin diálogo. Sin ellas QZ funciona en modo sin firma y muestra su
// aviso "Untrusted website" una vez en el equipo del cajero.
//
// Nada acá lanza: si QZ no está, el resultado dice "no disponible" y quien
// llama decide el respaldo.

import type * as QzApi from 'qz-tray'

type Qz = typeof QzApi

export const QZ_DOWNLOAD_URL = 'https://qz.io/download/'

export type QzState = 'no_instalado' | 'disponible' | 'conectado' | 'error'

export interface QzInfo {
  state:   QzState
  version: string | null
  /** true = el servidor firma los mensajes; null = aún no se consultó. */
  signed:  boolean | null
  secure:  boolean | null
  port:    number | null
  message: string
}

export type QzResult<T> = { ok: true; value: T } | { ok: false; message: string }

/** Estado inicial, antes de intentar conectar: no se toca la red hasta que haga falta. */
export const QZ_IDLE: QzInfo = {
  state: 'disponible', version: null, signed: null, secure: null, port: null,
  message: 'Aún no se ha comprobado la conexión con QZ Tray en este equipo.',
}

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
          qzLog('sin certificado en el servidor: modo sin firma')
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

/** Detecta QZ Tray en este equipo y abre la conexión. Nunca lanza. */
export async function connectQz(): Promise<QzInfo> {
  try {
    const qz = await loadQz()
    const signed = await configureSigning(qz)

    if (!qz.websocket.isActive()) {
      qzLog('buscando QZ Tray en este equipo (WebSocket local)...')
      await qz.websocket.connect({ usingSecure: true, retries: 2, delay: 1 })
    }

    const version = await qz.api.getVersion()
    const conn    = await qz.websocket.getConnectionInfo()
    qzLog(`conectado. QZ Tray v${version} (${signed ? 'con firma' : 'sin firma'})`)
    return {
      state: 'conectado', version, signed,
      secure: conn.socket === 'wss', port: conn.port,
      message: 'QZ Tray conectado.',
    }
  } catch (e) {
    // qz-tray.js marca `denied` cuando el usuario rechaza el permiso de red
    // local del navegador (Local Network Access de Chrome).
    const denied = typeof e === 'object' && e !== null && 'denied' in e && Boolean((e as { denied?: unknown }).denied)
    qzLog(denied ? 'el navegador bloqueó el acceso a la red local' : 'QZ Tray no respondió', e)
    return denied
      ? {
          state: 'error', version: null, signed: null, secure: null, port: null,
          message: 'El navegador bloqueó el acceso a este equipo. Permite el acceso a dispositivos de la red local para este sitio y vuelve a intentar.',
        }
      : {
          state: 'no_instalado', version: null, signed: null, secure: null, port: null,
          message: 'No se detectó QZ Tray en este equipo. Instálalo y ábrelo: su icono aparece junto al reloj de Windows.',
        }
  }
}

/** Impresoras que QZ Tray ve en este equipo (las mismas que Windows). */
export async function listPrinters(): Promise<QzResult<string[]>> {
  const info = await connectQz()
  if (info.state !== 'conectado') return { ok: false, message: info.message }
  try {
    const found = await (await loadQz()).printers.find()
    const printers = (Array.isArray(found) ? found : [found]).filter((p): p is string => typeof p === 'string' && p !== '')
    qzLog(`${printers.length} impresora(s) detectada(s)`)
    return { ok: true, value: printers }
  } catch (e) {
    qzLog('falló la lista de impresoras', e)
    return { ok: false, message: `No se pudo leer la lista de impresoras: ${errorMessage(e)}` }
  }
}

/** Envía bytes ESC/POS crudos (base64) a la impresora, sin diálogo de Windows. */
export async function printBytes(printer: string, base64: string): Promise<QzResult<null>> {
  const info = await connectQz()
  if (info.state !== 'conectado') return { ok: false, message: info.message }
  try {
    const qz = await loadQz()
    await qz.print(qz.configs.create(printer), [{ type: 'raw', format: 'command', flavor: 'base64', data: base64 }])
    qzLog(`QZ Tray aceptó el trabajo para "${printer}"`)
    return { ok: true, value: null }
  } catch (e) {
    qzLog('falló el envío a la impresora', e)
    return { ok: false, message: `No se pudo imprimir: ${errorMessage(e)}` }
  }
}
