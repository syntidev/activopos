'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import styles from '../configuracion.module.css'

type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported'

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i)
  return output
}

interface Props { businessId: number }

export function TabNotificaciones({ businessId: _businessId }: Props) {
  const { toast } = useToast()
  const [permission, setPermission] = useState<PermissionState>('default')
  const [subscribing, setSubscribing] = useState(false)
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    if (!('Notification' in window)) { setPermission('unsupported'); return }
    setPermission(Notification.permission as PermissionState)
    if (Notification.permission === 'granted') {
      navigator.serviceWorker?.ready.then(reg =>
        reg.pushManager.getSubscription().then(sub => setSubscribed(!!sub))
      )
    }
  }, [])

  const requestPushPermission = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      toast('Tu navegador no soporta notificaciones push', 'error')
      return
    }

    setSubscribing(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result as PermissionState)

      if (result !== 'granted') {
        toast('Permiso denegado. Actívalo desde la configuración del navegador.', 'warning')
        return
      }

      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

      if (!vapidKey) {
        toast('Notificaciones activadas localmente. Configura VAPID en el servidor.', 'info')
        setSubscribed(true)
        return
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })

      setSubscribed(true)
      toast('Notificaciones push activadas', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al activar notificaciones', 'error')
    } finally {
      setSubscribing(false)
    }
  }

  const renderStatus = () => {
    if (permission === 'unsupported') {
      return (
        <div className={styles.pushStatus}>
          <BellOff size={16} aria-hidden="true" />
          <span>Tu navegador no soporta notificaciones push.</span>
        </div>
      )
    }
    if (permission === 'denied') {
      return (
        <div className={`${styles.pushStatus} ${styles.pushStatusDenied}`}>
          <AlertCircle size={16} aria-hidden="true" />
          <span>
            Permiso denegado. Para activarlas, ve a la configuración de tu navegador
            y permite notificaciones para este sitio.
          </span>
        </div>
      )
    }
    if (permission === 'granted' && subscribed) {
      return (
        <div className={`${styles.pushStatus} ${styles.pushStatusGranted}`}>
          <CheckCircle size={16} aria-hidden="true" />
          <span>Notificaciones push activas en este dispositivo.</span>
        </div>
      )
    }
    return null
  }

  const canSubscribe = permission !== 'unsupported' && permission !== 'denied' && !(permission === 'granted' && subscribed)

  return (
    <div className={styles.formCard}>
      <h3 className={styles.formCardTitle}>
        <Bell size={16} aria-hidden="true" />
        Notificaciones push
      </h3>
      <p className={styles.formCardHint}>
        Recibe alertas en este dispositivo cuando haya créditos vencidos,
        stock crítico u otros eventos importantes — aunque el navegador esté cerrado.
      </p>

      {renderStatus()}

      {canSubscribe && (
        <div className={styles.saveRow}>
          <Button
            variant="primary"
            onClick={requestPushPermission}
            loading={subscribing}
          >
            <Bell size={15} aria-hidden="true" />
            Activar notificaciones push
          </Button>
        </div>
      )}
    </div>
  )
}
