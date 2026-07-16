# HANDOFF — Sesión 12-13 Julio 2026 (maratón, ~30+ horas)
# Generado por Claude Web al cierre — estado real, verificado, sin adornos

---

## LO QUE QUEDÓ CERRADO Y VERIFICADO HOY (con evidencia real, no reportado)

- Catálogo demo boutique-demo (56 productos, 4 categorías, slider 3 banners)
- Catálogo demo multi-demo (14 categorías, 56 productos, tenant nuevo tipo abasto)
- 26 imágenes hero reales insertadas por segmento, OG images diferenciadas
- Precio único en 3 fuentes reconciliadas: plan-limits.ts / tabla Plan / UI
- Bug de límites de features (usuarios/productos) reconciliado
- Bot de ayuda: bug de 'pro' capturando 'producto' corregido de raíz
- Módulo de Ayuda conectado a 13/13 módulos del dashboard
- SMTP real configurado (Hostinger), correo de registro + alerta funcionando
- Pipeline completo de reporte mensual: mark-pending (generación eager) →
  pending → mark-notified, los 3 endpoints verificados con curl real,
  bug de middleware (redirect a /login) corregido
- Workflow de n8n armado, probado E2E, pendiente activar cron cuando quieras
- CTAs del landing apuntan al catálogo real
- Nav reducido en páginas de segmento (menos fuga de conversión)
- Auditoría de accesibilidad (contraste, WCAG) corregida

## LO QUE QUEDÓ A MEDIAS — ESTO ES LO IMPORTANTE

### Footer — INCOMPLETO, esta es la causa de la frustración de esta noche
**Decisión tomada y confirmada:** el footer pasa de navy a fondo claro
(#F4F6FB), con el wordmark "ActivoPOS" gigante en contorno oscuro y el
isotipo de la marca superpuesto con efecto de "hundirse" al hover.

**Estado real:** esta decisión se comunicó como prompt completo DOS veces
en esta sesión y no hay confirmación de que se haya ejecutado — lo último
verificado en vivo (captura de las 01:XXam) todavía muestra el footer en
navy oscuro (`#1A2D47`, resultado de Footer-4, NO de Footer-5).

**El prompt de Footer-5 completo, listo para pegar sin cambios:**

```
Ejecuta cambio de dirección del footer — de navy a fondo claro, con
wordmark gigante e ícono de marca con efecto de presión al hover.
Footer-4 (variación tonal navy) queda descartado para el footer
específicamente — Testimonios y CTA final SÍ se quedan con sus tonos
navy ya corregidos, no los toques.

/instinct-status
/frontend-design:frontend-design

## TAREA
1. Footer.tsx: fondo cambia a --mkt-bg claro (#F4F6FB), NO navy —
   revertir el navy3 (#1A2D47) que Footer-4 le puso específicamente
   al footer
2. Bloque superior: nombre de marca, descripción corta, íconos sociales
   (Instagram, WhatsApp existentes), links de navegación existentes
3. Bloque inferior: wordmark "ActivoPOS" gigante, contorno oscuro ahora
   (rgba(13,27,46,0.08) en vez del blanco actual)
4. Isotipo de marca superpuesto sobre el wordmark: contenedor cuadrado,
   fondo Persian Blue, esquinas redondeadas. Hover: scale(0.94) +
   box-shadow inset, transición 150-200ms. Clic: scroll to top
5. Mantener intacto: disclaimer legal, copyright, todos los links

Verificar tsc 0 errores, build limpio.

git commit -m "feat(footer): footer a fondo claro definitivo — revierte navy3, agrega isotipo con press effect

🤖 Agente: CLI-B | Sprint: Footer-5 | Fecha: 2026-07-13"
```

Ese prompt no necesita más contexto, no necesita más discusión — está listo.

---

## PENDIENTES SIN EMPEZAR, EN ORDEN DE PRIORIDAD REAL

1. **Usuarios y Roles** — tu ítem crítico, requiere sesión dedicada con
   Opus + matriz de permisos revisada contigo antes de escribir código.
   No se toca en una sesión de madrugada cansado.
2. **Mayoristas / Lista de precios** — conversación de alcance pendiente,
   nunca se definió qué modelo de precio (volumen, tipo de cliente, ambos)
3. **Activar el cron del workflow de n8n** — ya está probado, solo falta
   el toggle de "Publish"/activo cuando decidas que quieres que corra solo
4. **Aviso visible en dashboard para reporte notificado** — el backend
   está listo (notified_at, wa_url en DB), pero nunca se construyó el
   componente de UI que lo muestre (Sprint Reportes-7, quedó pendiente)

---

## LECCIÓN DE PROCESO PARA LA PRÓXIMA SESIÓN

Cada deploy necesita, en este orden exacto, sin saltar ninguno:
```
git fetch origin && git reset --hard origin/main
npm install --legacy-peer-deps
npx prisma generate && npx prisma db push
rm -rf .next
npm run build     ← ESPERAR a que termine limpio antes de seguir
pm2 restart activopos
sleep 5 && curl -I https://activopos.com   ← debe dar 200
```
Casi todos los sustos de "el sitio no refleja el cambio" o "está caído"
de esta sesión vinieron de saltarse un paso de esta secuencia.

---

*Cierre de sesión — Claude Web — 2026-07-13*
