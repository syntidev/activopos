# Workflow n8n — Reporte Mensual WhatsApp
# Instalar en: n8n.syntiweb.com
# Sprint 11 | 2026-06-19

---

## Propósito

Notificar a cada negocio activo que su reporte mensual está disponible.
El flujo **no** envía WhatsApp directamente (requiere API oficial de Meta).
Lo que hace: marca reportes, prepara links `wa.me/` y los registra en DB.
El dueño ve un banner en la app con el link listo para compartir.

**Sprint 13+** → integrar API oficial de Meta para envío automático.

---

## Trigger

```
Tipo:       Cron
Expresión:  55 23 L * *
Descripción: Último día de cada mes a las 23:55
```

---

## Nodo 1 — Marcar reportes pending

```
Tipo:    HTTP Request
Método:  POST
URL:     https://activopos.com/api/reports/monthly/mark-pending
Headers:
  x-api-key: {{ $env.ACTIVOPOS_N8N_KEY }}
  Content-Type: application/json
Body:
  {
    "period": "{{ $now.minus(1, 'month').format('YYYY-MM') }}"
  }
```

Este endpoint no genera el PDF — solo crea un registro `MonthlyReport`
con `status = 'pending'` para todos los negocios activos del período.

---

## Nodo 2 — Esperar 5 minutos

```
Tipo:  Wait
Valor: 5 minutos
```

Da tiempo a que los negocios con el dashboard abierto generen su reporte
en background (generación lazy del PDF al entrar a /reportes).

---

## Nodo 3 — Obtener reportes listos para notificar

```
Tipo:    HTTP Request
Método:  GET
URL:     https://activopos.com/api/reports/monthly/pending
Headers:
  x-api-key: {{ $env.ACTIVOPOS_N8N_KEY }}
```

Respuesta esperada:
```json
{
  "reports": [
    {
      "id": 1,
      "business_id": 1,
      "business_name": "Tienda Demo",
      "whatsapp_phone": "584141234567",
      "period": "2026-05",
      "period_label": "Mayo 2026",
      "token": "abc123...",
      "pdf_url": "https://activopos.com/api/r/abc123"
    }
  ]
}
```

---

## Nodo 4 — Loop por cada negocio

```
Tipo:       Split in Batches
Batch Size: 1
```

---

## Nodo 5 — Construir mensaje WhatsApp

```
Tipo: Set
Campos:

  mensaje = "ActivoPOS | Tu reporte de {{ $json.period_label }} ya está listo.\n\n" +
            "📊 Ventas del mes, top productos y comparativo.\n\n" +
            "Descarga tu PDF aquí:\n{{ $json.pdf_url }}\n\n" +
            "(Disponible por 30 días)"

  url_wa  = "https://wa.me/{{ $json.whatsapp_phone }}?text={{ encodeURIComponent($json.mensaje) }}"
```

---

## Nodo 6 — Registrar notificación en DB

```
Tipo:    HTTP Request
Método:  POST
URL:     https://activopos.com/api/reports/monthly/mark-notified
Headers:
  x-api-key: {{ $env.ACTIVOPOS_N8N_KEY }}
  Content-Type: application/json
Body:
  {
    "report_id": {{ $json.id }},
    "wa_url":    "{{ $json.url_wa }}",
    "notified_at": "{{ $now.toISO() }}"
  }
```

El banner en la app lee este campo y muestra el link al usuario.

---

## Variables de entorno requeridas (.env en VPS)

```env
ACTIVOPOS_N8N_KEY=<token_secreto_aleatorio_32chars>
```

El mismo token debe configurarse en n8n como variable de entorno
`ACTIVOPOS_N8N_KEY` para que las llamadas sean autenticadas.

---

## Endpoints backend requeridos (Sprint 13)

| Endpoint                                  | Método | Descripción                          |
|-------------------------------------------|--------|--------------------------------------|
| `/api/reports/monthly/mark-pending`       | POST   | Crea MonthlyReport pending p/ período|
| `/api/reports/monthly/pending`            | GET    | Lista reportes pending sin notificar |
| `/api/reports/monthly/mark-notified`      | POST   | Marca report notificado + guarda URL |

El endpoint `/api/r/[token]` (descarga PDF público sin auth) **ya existe** —
implementado en Sprint 11 (DT-013 pattern).

⚠️ Los 3 endpoints de arriba comprueban `x-api-key` contra `process.env.N8N_API_KEY`
(nombre real en el código). Este documento dice `ACTIVOPOS_N8N_KEY` en la
sección de variables de entorno más abajo — **son nombres distintos**. El
código es la fuente de verdad (ya deployado); si n8n manda el header con
el nombre `ACTIVOPOS_N8N_KEY` como variable de n8n eso no importa (es solo
el nombre de la variable EN n8n), pero el `.env` del VPS debe tener
`N8N_API_KEY=<mismo_valor>`, no `ACTIVOPOS_N8N_KEY`. Verificar antes de
activar el cron.

## Verificación pendiente (requiere a Carlos — acceso externo)

1. **¿Existe `N8N_API_KEY` en el `.env` del VPS?** No verificable desde acá
   (sin acceso SSH en esta sesión). Correr en el VPS:
   ```bash
   grep N8N_API_KEY /var/www/activopos/.env
   ```
   Si no existe, generar un valor random de 32+ chars y agregarlo, luego
   `pm2 restart activopos` para que tome el nuevo env var.

2. **¿Está el workflow instalado en n8n.syntiweb.com?** Requiere login en
   n8n (acceso externo, no accesible desde este entorno). Verificar:
   - Que exista un workflow activo con el Cron `55 23 L * *`
   - Que la variable de entorno de n8n `ACTIVOPOS_N8N_KEY` (o el nombre que
     se use en los nodos HTTP Request) tenga el MISMO valor que
     `N8N_API_KEY` en el `.env` del VPS — si no coinciden, los 3 endpoints
     van a devolver 401 en cada llamada del workflow.
   - Que los 3 nodos HTTP Request apunten a `https://activopos.com/api/reports/monthly/...`
     (no localhost, no IP directa).

---

## Manejo de errores n8n

- Si `mark-pending` falla → Stop and Error (notificar a Carlos via Slack/email)
- Si un negocio no tiene `whatsapp_phone` → Skip (no iterar)
- Si `mark-notified` falla → Continue (log en n8n, no bloquea otros negocios)

---

## Estado actual

| Componente                    | Estado          |
|-------------------------------|-----------------|
| `/api/r/[token]`              | ✅ Existe Sprint 11 |
| MonthlyReportBanner en UI     | ✅ Existe Sprint 11 |
| mark-pending endpoint         | ✅ Existe |
| pending endpoint              | ✅ Existe |
| mark-notified endpoint        | ✅ Existe — Sprint Reportes-1 (2026-07-12) |
| `N8N_API_KEY` en .env VPS     | ❓ Sin verificar — requiere Carlos (SSH) |
| Workflow n8n importado        | ❓ Sin verificar — requiere Carlos (n8n.syntiweb.com) |
| Envío automático Meta API     | ❌ DT-019 Sprint 13+ |

---

*Documentado: 2026-06-19 | CLI-D Sprint 11*
