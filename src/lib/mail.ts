import nodemailer, { Transporter } from 'nodemailer'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

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
  const subjectName = sanitizeHeader(businessName)
  try {
    const info = await getTransporter().sendMail({
      from: getFrom(),
      to,
      subject: `Bienvenido a ActivoPOS, ${subjectName}`,
      text: `Hola ${ownerName},\n\nTu cuenta de ActivoPOS para "${businessName}" fue creada exitosamente.\n\nYa puedes iniciar sesión y comenzar a vender.\n\n— El equipo de ActivoPOS`,
      html: `<p>Hola ${escapeHtml(ownerName)},</p><p>Tu cuenta de ActivoPOS para <strong>${escapeHtml(businessName)}</strong> fue creada exitosamente.</p><p>Ya puedes iniciar sesión y comenzar a vender.</p><p>— El equipo de ActivoPOS</p>`,
    })
    console.log(`[mail] confirmación de registro enviada a ${to} — messageId=${info.messageId} response="${info.response}"`)
  } catch (err) {
    console.error(`[mail] FALLO confirmación de registro a ${to}:`, err instanceof Error ? err.message : err)
    throw err
  }
}

export async function sendNewBusinessAlertEmail(businessName: string, plan: string, createdAt: Date): Promise<void> {
  const fecha = createdAt.toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' })
  const subjectName = sanitizeHeader(businessName)
  const to = 'hola@activopos.com'
  try {
    const info = await getTransporter().sendMail({
      from: getFrom(),
      to,
      subject: `Nuevo negocio registrado: ${subjectName}`,
      text: `Nuevo negocio registrado.\n\nNombre: ${businessName}\nPlan: ${plan}\nFecha: ${fecha}`,
      html: `<p>Nuevo negocio registrado.</p><ul><li><strong>Nombre:</strong> ${escapeHtml(businessName)}</li><li><strong>Plan:</strong> ${escapeHtml(plan)}</li><li><strong>Fecha:</strong> ${fecha}</li></ul>`,
    })
    console.log(`[mail] alerta de nuevo negocio enviada a ${to} — messageId=${info.messageId} response="${info.response}"`)
  } catch (err) {
    console.error(`[mail] FALLO alerta de nuevo negocio a ${to}:`, err instanceof Error ? err.message : err)
    throw err
  }
}
