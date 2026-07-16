# HANDOFF — Cierre de Sesión 14 Jul 2026

## Resumen de la sesión

Sesión enfocada en accesibilidad de `activopos.com` para agentes de IA
(ChatGPT-User, ClaudeBot, etc.) y diagnóstico de un problema de indexación
en Google Search Console. Se encontraron y corrigieron dos causas raíz
distintas en Cloudflare, y se migró `llms.txt`/`llms-full.txt` de archivos
estáticos a generación dinámica.

## Estado del proyecto al cierre

**Producción (`activopos.com`) verificada en vivo, no solo en teoría:**
- `llms.txt` → HTTP 200, servido por `app/llms.txt/route.ts`, dinámico
  desde `src/lib/llms-config.ts`.
- `llms-full.txt` → HTTP 200, mismo mecanismo.
- Verificado con User-Agent real de `ClaudeBot`, `ChatGPT-User`,
  `OAI-SearchBot` — 9/9 eventos en Cloudflare Security Events en `Skip`,
  0 en `Block`, en una ventana de 25 minutos de tráfico real (no solo
  curls sintéticos).
- Commit `8cd2acf` en `main`, ya deployado (build + pm2 restart corridos
  por CLI-A como parte del flujo).

**Cloudflare — configuración actual:**
- Custom Rule `Agent_Pass` activa (1/5 rules del plan free en uso):
  Skip sobre "All managed rules" para 17 User-Agents de IA conocidos
  (lista completa en la regla misma, incluye ChatGPT-User, GPTBot,
  ClaudeBot, OAI-SearchBot, Google-Extended, Google-Agent, Manus-User,
  PerplexityBot, Perplexity-User, meta-externalagent, Amazonbot,
  Applebot-Extended, DuckAssistBot, MistralAI-User, Kimi-User, GrokBot,
  xAI-Grok — los últimos 2 sin garantía real, xAI no publica UA estable).
- "Configure AI bot policies" → Search: Allow, Agent: Allow,
  Training: **Allow** (cambiado de Block durante esta sesión — trade-off
  aceptado: el contenido de marketing ahora puede usarse para entrenar
  modelos de OpenAI/Anthropic, a cambio de que Agent-bots en vivo
  funcionen, porque el motor gratuito de Cloudflare no separa Agent de
  Training de forma confiable pese a lo que sugiere la UI).
- "Block AI bots" (legacy, deprecating 15 sept) → revertido a "mixed
  purpose crawlers will continue to be allowed" (estaba mal configurado
  hacia la opción estricta, bloqueando Googlebot/Bingbot real de forma
  intermitente durante el día).
- Bot Fight Mode → activo, confirmado que NO es la causa de ningún
  bloqueo (era rojo herring, descartado con evidencia).

## Hallazgo clave — bug de Cloudflare, no de configuración

`ruleId: 7bd01eeccb6b420fa0be30264603a5cb` ("Manage AI bots", ruleset
"Cloudflare Bot Management rules for all plans") bloqueaba `ChatGPT-User`
pese a tener `Agent: Allow` configurado, mientras `Training: Block`
estuviera activo — el motor gratuito no separa ambas categorías de forma
independiente pese a que la UI las presenta como controles distintos.
Confirmado por captura de log real (mismo Ray ID, Skip en Custom Rules +
Block en Managed rules simultáneo) y coincide con reportes de otros
usuarios en Cloudflare Community sobre el mismo síntoma con ClaudeBot.

**Pendiente: abrir ticket de soporte a Cloudflare** citando ese ruleId,
para no depender permanentemente de la Custom Rule como parche.

## Deuda técnica identificada

1. `llms.txt` (9,008 bytes) y `llms-full.txt` (10,381 bytes) — solo 15%
   de diferencia entre ambos. La distinción "índice liviano vs. volcado
   completo" que da sentido a tener los dos archivos se perdió. No
   urgente (impacto real de estos archivos en 2026 es bajo, confirmado
   con datos de adopción externos), pero anotado.
2. Prerender estático de `app/llms.txt/route.ts` y `app/llms-full.txt/route.ts`
   en build (`.next/server/app/llms.txt.body`) — cualquier cambio en
   `lib/llms-config.ts` requiere rebuild + restart completo, no hot-reload.
   Esto aplica aunque `next.config.mjs` no use `output: 'standalone'`.
3. Redirect `/llm.txt` (singular) → `/llms.txt` — sugerido por fuente
   externa (Wlnmw), cosmético, no crítico.
4. `mail.activopos.com` recibe tráfico de `OAI-SearchBot` — no es
   problema hoy (pasa por la misma Custom Rule), pero vigilar si aparece
   ruido ahí más adelante.

## Pendientes por prioridad para próxima sesión

**P1:**
- CVE-2025-55182 (React RCE) — se detectaron 3+ intentos reales de
  explotación en logs de Cloudflare contra `activopos.com/` (POST a raíz,
  User-Agents de navegador falsificados). Cloudflare lo está bloqueando
  bien por ahora (managed ruleset ajeno al de AI bots), pero falta
  confirmar si la versión de React en producción está parcheada. Para CLI-C.
- Confirmar en GSC (Search Console, no simulable desde aquí) si la
  cobertura de indexación mejora en los próximos días tras revertir el
  bloqueo intermitente de Googlebot.

**P2:**
- `schema.org` JSON-LD (`SoftwareApplication` + `Organization`) en el
  layout raíz — mayor ROI real confirmado que `llms.txt`/`llms-full.txt`,
  no iniciado. Para CLI-B.
- Reportar bug a soporte Cloudflare (ruleId arriba).

**P3 (no urgente):**
- Diferenciar mejor `llms.txt` vs `llms-full.txt` en contenido.
- Redirect `/llm.txt` → `/llms.txt`.

## Notas operativas

- Local (`C:\laragon\www\activopos`) desincronizado del último commit —
  requiere `git pull origin main` antes de retomar trabajo ahí.
- Sin migraciones de DB en este sprint — no hay riesgo de divergencia
  local/VPS de base de datos esta vez.
