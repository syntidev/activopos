import nodemailer, { Transporter } from 'nodemailer'
import {
  bienvenidaEmail,
  alertaNuevoNegocioEmail,
  alertaModeloIaEmail,
  recordatorioVencimientoEmail,
  modulosBloqueadosEmail,
  resetPasswordEmail,
} from './email/templates'

// Bloquea inyección de headers SMTP vía CR/LF en campos que llegan a subject
function sanitizeHeader(s: string): string {
  return s.replace(/[\r\n]/g, ' ')
}

let transporter: Transporter | undefined

function getTransporter(): Transporter {
  if (transporter) return transporter

  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const password = process.env.SMTP_PASSWORD

  if (!host || !port || !user || !password) {
    throw new Error('SMTP no configurado — faltan SMTP_HOST/PORT/USER/PASSWORD en .env')
  }

  transporter = nodemailer.createTransport({
    host,
    port: parseInt(port, 10),
    secure: parseInt(port, 10) === 465,
    auth: { user, pass: password },
  })

  return transporter
}

function getFrom(): string {
  const from = process.env.SMTP_FROM
  if (!from) throw new Error('SMTP_FROM no configurado en .env')
  return from
}

export async function sendRegistrationConfirmationEmail(to: string, ownerName: string, businessName: string): Promise<void> {
  const { subject, html, text } = bienvenidaEmail(ownerName, businessName)
  try {
    const info = await getTransporter().sendMail({
      from: getFrom(),
      to,
      subject: sanitizeHeader(subject),
      text,
      html,
    })
    console.log(`[mail] confirmación de registro enviada a ${to} — messageId=${info.messageId} response="${info.response}"`)
  } catch (err) {
    console.error(`[mail] FALLO confirmación de registro a ${to}:`, err instanceof Error ? err.message : err)
    throw err
  }
}

export async function sendNewBusinessAlertEmail(businessName: string, plan: string, createdAt: Date): Promise<void> {
  const to = 'hola@activopos.com'
  const { subject, html, text } = alertaNuevoNegocioEmail(businessName, plan, createdAt)
  try {
    const info = await getTransporter().sendMail({
      from: getFrom(),
      to,
      subject: sanitizeHeader(subject),
      text,
      html,
    })
    console.log(`[mail] alerta de nuevo negocio enviada a ${to} — messageId=${info.messageId} response="${info.response}"`)
  } catch (err) {
    console.error(`[mail] FALLO alerta de nuevo negocio a ${to}:`, err instanceof Error ? err.message : err)
    throw err
  }
}

/**
 * Alerta operativa: NVIDIA rechazo el modelo (404/deprecado). A diferencia del
 * resto, NO relanza el error — quien la dispara ya esta manejando una falla y
 * no puede permitirse una segunda excepcion por SMTP caido.
 */
export async function sendAiModelAlertEmail(model: string, status: number, detail: string): Promise<void> {
  const to = process.env.ALERT_EMAIL ?? 'hola@activopos.com'
  const { subject, html, text } = alertaModeloIaEmail(model, status, detail)
  try {
    const info = await getTransporter().sendMail({ from: getFrom(), to, subject: sanitizeHeader(subject), text, html })
    console.log(`[mail] alerta de modelo IA enviada a ${to} — messageId=${info.messageId} response="${info.response}"`)
  } catch (err) {
    console.error(`[mail] FALLO alerta de modelo IA a ${to}:`, err instanceof Error ? err.message : err)
  }
}

export async function sendExpirationReminderEmail(to: string, businessName: string, daysLeft: number): Promise<void> {
  const { subject, html, text } = recordatorioVencimientoEmail(businessName, daysLeft)
  try {
    const info = await getTransporter().sendMail({ from: getFrom(), to, subject: sanitizeHeader(subject), text, html })
    console.log(`[mail] recordatorio de vencimiento enviado a ${to} — messageId=${info.messageId} response="${info.response}"`)
  } catch (err) {
    console.error(`[mail] FALLO recordatorio de vencimiento a ${to}:`, err instanceof Error ? err.message : err)
    throw err
  }
}

export async function sendModulesBlockedEmail(to: string, businessName: string): Promise<void> {
  const { subject, html, text } = modulosBloqueadosEmail(businessName)
  try {
    const info = await getTransporter().sendMail({ from: getFrom(), to, subject: sanitizeHeader(subject), text, html })
    console.log(`[mail] alerta de módulos bloqueados enviada a ${to} — messageId=${info.messageId} response="${info.response}"`)
  } catch (err) {
    console.error(`[mail] FALLO alerta de módulos bloqueados a ${to}:`, err instanceof Error ? err.message : err)
    throw err
  }
}

// Plantilla lista para cuando exista el flujo real de reset de password
// (hoy no hay token de reset en el schema ni endpoint -- ver auditoria 2026-07-19).
export async function sendResetPasswordEmail(to: string, ownerName: string, resetUrl: string): Promise<void> {
  const { subject, html, text } = resetPasswordEmail(ownerName, resetUrl)
  try {
    const info = await getTransporter().sendMail({ from: getFrom(), to, subject: sanitizeHeader(subject), text, html })
    console.log(`[mail] reset de password enviado a ${to} — messageId=${info.messageId} response="${info.response}"`)
  } catch (err) {
    console.error(`[mail] FALLO reset de password a ${to}:`, err instanceof Error ? err.message : err)
    throw err
  }
}
