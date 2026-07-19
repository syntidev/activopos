import { emailShell, ctaButton, escapeHtml, APP_URL, BRAND_NAVY, TEXT_MUTED, FONT_STACK } from './layout'

/**
 * Plantillas de contenido para los correos transaccionales de ActivoPOS.
 * Cada función devuelve {subject, html, text} listo para pasar a
 * transporter.sendMail() en mail.ts. El HTML pasa por emailShell() --
 * nunca duplicar el layout completo aquí.
 */

interface EmailContent {
  subject: string
  html: string
  text: string
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 14px; font-family:${FONT_STACK}; font-size:22px; font-weight:700; color:${BRAND_NAVY}; line-height:1.3;">${escapeHtml(text)}</h1>`
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 14px; font-family:${FONT_STACK}; font-size:15px; color:${BRAND_NAVY}; line-height:1.6;">${text}</p>`
}

export function bienvenidaEmail(ownerName: string, businessName: string): EmailContent {
  const dashboardUrl = `${APP_URL}/escritorio`
  const html = emailShell({
    previewText: `Tu cuenta de ActivoPOS para ${businessName} ya está lista.`,
    bodyHtml:
      heading(`¡Bienvenido a ActivoPOS, ${businessName}!`) +
      paragraph(`Hola ${escapeHtml(ownerName)}, tu cuenta ya está creada y lista para usar. Empieza a vender, controlar tu inventario y llevar tu caja al día — sin costo, sin límite de tiempo.`) +
      ctaButton('Ir a mi panel', dashboardUrl),
  })
  const text = `Hola ${ownerName},\n\nTu cuenta de ActivoPOS para "${businessName}" fue creada exitosamente.\n\nYa puedes iniciar sesión y comenzar a vender.\n\nIr a mi panel: ${dashboardUrl}\n\n— El equipo de ActivoPOS`
  return { subject: `Bienvenido a ActivoPOS, ${businessName}`, html, text }
}

export function alertaNuevoNegocioEmail(businessName: string, plan: string, createdAt: Date): EmailContent {
  const fecha = createdAt.toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' })
  const html = emailShell({
    previewText: `Nuevo negocio registrado: ${businessName}`,
    bodyHtml:
      heading('Nuevo negocio registrado') +
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%; margin-top:8px;">
        <tr><td style="padding:6px 0; font-family:${FONT_STACK}; font-size:14px; color:${TEXT_MUTED}; width:90px;">Nombre</td>
            <td style="padding:6px 0; font-family:${FONT_STACK}; font-size:14px; color:${BRAND_NAVY}; font-weight:600;">${escapeHtml(businessName)}</td></tr>
        <tr><td style="padding:6px 0; font-family:${FONT_STACK}; font-size:14px; color:${TEXT_MUTED};">Plan</td>
            <td style="padding:6px 0; font-family:${FONT_STACK}; font-size:14px; color:${BRAND_NAVY}; font-weight:600;">${escapeHtml(plan)}</td></tr>
        <tr><td style="padding:6px 0; font-family:${FONT_STACK}; font-size:14px; color:${TEXT_MUTED};">Fecha</td>
            <td style="padding:6px 0; font-family:${FONT_STACK}; font-size:14px; color:${BRAND_NAVY}; font-weight:600;">${escapeHtml(fecha)}</td></tr>
      </table>`,
  })
  const text = `Nuevo negocio registrado.\n\nNombre: ${businessName}\nPlan: ${plan}\nFecha: ${fecha}`
  return { subject: `Nuevo negocio registrado: ${businessName}`, html, text }
}

export function recordatorioVencimientoEmail(businessName: string, daysLeft: number): EmailContent {
  const planesUrl = `${APP_URL}/planes`
  const dias = daysLeft === 1 ? '1 día' : `${daysLeft} días`
  const html = emailShell({
    previewText: `Tu Negocio Activo vence en ${dias}.`,
    bodyHtml:
      heading(`Tu Negocio Activo vence en ${dias}`) +
      paragraph('Renueva para no perder catálogo digital, finanzas y proveedores. Tu POS sigue funcionando normal.') +
      ctaButton('Renovar mi plan', planesUrl),
  })
  const text = `Hola,\n\nTu plan Negocio Activo de "${businessName}" vence en ${dias}.\n\nRenueva para no perder catálogo digital, finanzas y proveedores. Tu POS sigue funcionando normal.\n\nRenovar mi plan: ${planesUrl}\n\n— El equipo de ActivoPOS`
  return { subject: `Tu Negocio Activo vence en ${dias}`, html, text }
}

// Copy identica a la respuesta R3 de /planes (FAQ) -- no reformular, ya aprobada.
const MODULOS_BLOQUEADOS_COPY =
  'Se bloquearon tus módulos de pago — catálogo digital, finanzas, proveedores, exportables y alta de nuevos productos o usuarios — hasta que te pongas al día. Tu POS sigue funcionando para que no se te pare el día a día, y nunca perdemos tu información.'

export function modulosBloqueadosEmail(businessName: string): EmailContent {
  const planesUrl = `${APP_URL}/planes`
  const html = emailShell({
    previewText: 'Se bloquearon tus módulos de pago.',
    bodyHtml:
      heading('Renovación pendiente') +
      paragraph(MODULOS_BLOQUEADOS_COPY) +
      ctaButton('Renovar ahora', planesUrl),
  })
  const text = `Hola,\n\n${MODULOS_BLOQUEADOS_COPY}\n\nRenovar ahora: ${planesUrl}\n\n— El equipo de ActivoPOS (${businessName})`
  return { subject: 'Se bloquearon tus módulos de pago', html, text }
}

export function resetPasswordEmail(ownerName: string, resetUrl: string): EmailContent {
  const html = emailShell({
    previewText: 'Solicitud para cambiar tu contraseña de ActivoPOS.',
    bodyHtml:
      heading('Cambia tu contraseña') +
      paragraph(`Hola ${escapeHtml(ownerName)}, recibimos una solicitud para cambiar tu contraseña. Si fuiste tú, usa el siguiente botón. Si no reconoces esta solicitud, ignora este correo — tu cuenta sigue segura.`) +
      ctaButton('Cambiar mi contraseña', resetUrl) +
      paragraph(`<span style="font-size:13px; color:${TEXT_MUTED};">Este enlace expira en 1 hora.</span>`),
  })
  const text = `Hola ${ownerName},\n\nRecibimos una solicitud para cambiar tu contraseña de ActivoPOS.\n\nCambiar mi contraseña: ${resetUrl}\n\nSi no reconoces esta solicitud, ignora este correo.\n\nEste enlace expira en 1 hora.\n\n— El equipo de ActivoPOS`
  return { subject: 'Cambia tu contraseña de ActivoPOS', html, text }
}
