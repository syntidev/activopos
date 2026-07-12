import nodemailer, { Transporter } from 'nodemailer'

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
  await getTransporter().sendMail({
    from: getFrom(),
    to,
    subject: `Bienvenido a ActivoPOS, ${businessName}`,
    text: `Hola ${ownerName},\n\nTu cuenta de ActivoPOS para "${businessName}" fue creada exitosamente.\n\nYa puedes iniciar sesión y comenzar a vender.\n\n— El equipo de ActivoPOS`,
    html: `<p>Hola ${ownerName},</p><p>Tu cuenta de ActivoPOS para <strong>${businessName}</strong> fue creada exitosamente.</p><p>Ya puedes iniciar sesión y comenzar a vender.</p><p>— El equipo de ActivoPOS</p>`,
  })
}

export async function sendNewBusinessAlertEmail(businessName: string, plan: string, createdAt: Date): Promise<void> {
  const fecha = createdAt.toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' })
  await getTransporter().sendMail({
    from: getFrom(),
    to: 'hola@activopos.com',
    subject: `Nuevo negocio registrado: ${businessName}`,
    text: `Nuevo negocio registrado.\n\nNombre: ${businessName}\nPlan: ${plan}\nFecha: ${fecha}`,
    html: `<p>Nuevo negocio registrado.</p><ul><li><strong>Nombre:</strong> ${businessName}</li><li><strong>Plan:</strong> ${plan}</li><li><strong>Fecha:</strong> ${fecha}</li></ul>`,
  })
}
