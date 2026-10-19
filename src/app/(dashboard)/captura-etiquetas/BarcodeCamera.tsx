'use client'

import { useEffect, useRef } from 'react'
import styles from './alta.module.css'

const SCAN_INTERVAL_MS = 300
const WANTED_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']

interface DetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>
}
interface DetectorCtor {
  new (options: { formats: string[] }): DetectorLike
  getSupportedFormats?: () => Promise<string[]>
}

interface BarcodeCameraProps {
  /** Mientras es true no se leen códigos (hay uno en pantalla esperando guardarse). */
  paused: boolean
  onCode: (code: string) => void
  onError: (message: string) => void
}

/** Cámara trasera en vivo + BarcodeDetector del navegador. Al desmontarse apaga la cámara. */
export function BarcodeCamera({ paused, onCode, onError }: BarcodeCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pausedRef = useRef(paused)
  const onCodeRef = useRef(onCode)
  const onErrorRef = useRef(onError)
  pausedRef.current = paused
  onCodeRef.current = onCode
  onErrorRef.current = onError

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: number | undefined
    let cancelled = false

    async function start(): Promise<void> {
      const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector
      if (!Ctor) {
        onErrorRef.current('Este navegador no lee códigos en vivo. Usa la foto o escribe el código.')
        return
      }
      try {
        const supported = (await Ctor.getSupportedFormats?.()) ?? WANTED_FORMATS
        const formats = WANTED_FORMATS.filter(f => supported.includes(f))
        const detector = new Ctor({ formats: formats.length ? formats : WANTED_FORMATS })
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        const video = videoRef.current
        if (cancelled || !video) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        video.srcObject = stream
        await video.play()
        if (cancelled) return
        let reading = false
        timer = window.setInterval(() => {
          if (reading || pausedRef.current) return
          reading = true
          detector
            .detect(video)
            .then(found => {
              const value = found[0]?.rawValue
              if (value) onCodeRef.current(value)
            })
            .catch(() => undefined)
            .finally(() => { reading = false })
        }, SCAN_INTERVAL_MS)
      } catch {
        onErrorRef.current('No se pudo abrir la cámara. Revisa el permiso o usa la foto.')
      }
    }

    void start()
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearInterval(timer)
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [])

  return <video ref={videoRef} className={styles.video} muted playsInline aria-label="Cámara para leer el código de barras" />
}
