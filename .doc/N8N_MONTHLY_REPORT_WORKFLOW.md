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

Los siguientes endpoints aún no existen — deben ser creados por CLI-A
antes de activar este workflow:

| Endpoint                                  | Método | Descripción                          |
|-------------------------------------------|--------|--------------------------------------|
| `/api/reports/monthly/mark-pending`       | POST   | Crea MonthlyReport pending p/ período|
| `/api/reports/monthly/pending`            | GET    | Lista reportes pending sin notificar |
| `/api/reports/monthly/mark-notified`      | POST   | Marca report notificado + guarda URL |

El endpoint `/api/r/[token]` (descarga PDF público sin auth) **ya existe** —
implementado en Sprint 11 (DT-013 pattern).

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
| mark-pending endpoint         | ❌ Pendiente Sprint 13 |
| pending endpoint              | ❌ Pendiente Sprint 13 |
| mark-notified endpoint        | ❌ Pendiente Sprint 13 |
| Workflow n8n importado        | ❌ Pendiente Sprint 13 |
| Envío automático Meta API     | ❌ DT-019 Sprint 13+ |

---

*Documentado: 2026-06-19 | CLI-D Sprint 11*
