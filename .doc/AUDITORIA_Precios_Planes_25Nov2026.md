# Auditoría de precios y planes — web pública y documentos (25 nov 2026)

Agente CLI-B · rama `feat/planes-publica` · `PRICES_PUBLISHED` sigue en **false** (no se publicó nada).

## Fuente única y valores vigentes

`src/lib/plan-limits.ts` con `PRICES_PUBLISHED = false`:

| Plan | Mensual | Trimestral | Semestral | Anual |
|---|---|---|---|---|
| Gratis | $0 (permanente) | — | — | — |
| Negocio Activo (`BILLING_CYCLES.negocio_activo`) | $19 | $50 ($16.67/mes, 10%) | $90 ($15/mes, 20%) | $156 ($13/mes, **30%**) |
| Operación (`operacion`) | no publicado | — | — | — |

Límites (`PLAN_LIMITS`): Gratis = 40 productos y 1 usuario; Negocio Activo = productos ilimitados y 10 usuarios.
Precios de trabajo v2 (NO publicados): Entrada $29 · Operación $39 · add-on KDS $8 · instalación "desde $150".

## Resultado

- **1 contradicción real, corregida:** la oferta anual del JSON-LD de la portada decía "32% de ahorro" y la fuente dice 30%.
- **Ningún precio viejo** (`$15/$25/$40`, `$9/$19/$29` de eras anteriores) sobrevive en la web pública, `llms*.txt`, JSON-LD, metadatos, registro, onboarding, correos ni plantillas de WhatsApp. Solo quedan en el historial de git (`bde896e` "corregir precio oficial a $15/$25/$40") y en documentos internos de `.doc/` (sección C).
- **Varios valores están escritos a mano** y hoy coinciden con la fuente, pero se desalinearían al activar `PRICES_PUBLISHED` (sección B). No se tocaron: la instrucción era corregir solo lo que contradiga hoy.

## A. Precios y planes mostrados al público — estado de cada lugar

Leyenda: **LEE** = lee `plan-limits.ts` (no puede desincronizarse) · **COINCIDE** = valor escrito a mano igual a la fuente hoy · **CORREGIDO** = contradecía y se arregló · **N/A** = no es un precio de plan.

| # | Archivo:línea | Valor actual | Estado |
|---|---|---|---|
| 1 | `src/app/(marketing)/page.tsx` ~L99 · JSON-LD SoftwareApplication, oferta anual | "Equivale a $13.00 por mes. ~~32%~~ **30%** de ahorro" | **CORREGIDO** (ahora lee `BILLING_CYCLES`) |
| 2 | `src/app/(marketing)/page.tsx` ~L87-96 · JSON-LD ofertas Gratis / Mensual / Anual | $0.00 · $19.00 · $156.00 (USD) | COINCIDE (a mano) |
| 3 | `src/app/(marketing)/page.tsx` ~L83 · oferta Gratis | "Hasta 40 productos, 1 usuario" | COINCIDE |
| 4 | `src/app/(marketing)/page.tsx` ~L132 · JSON-LD FAQPage "¿Cuánto cuesta?" | $0 · $19/mes · $13/mes anual · $156/año | COINCIDE (a mano) |
| 5 | `src/app/(marketing)/faq/page.tsx` L91 · FAQ "¿Cuánto cuesta ActivoPOS?" | Negocio Activo **$19/mes**; Gratis 40 productos y 1 usuario; Negocio Activo 10 usuarios | COINCIDE (a mano) |
| 6 | `src/app/(marketing)/faq/page.tsx` L95, L99 | "plan Gratis permanente", "mes a mes, sin contratos anuales obligatorios" | N/A (sin cifras) |
| 7 | `src/lib/llms-config.ts` L216 · `PLANS` | Gratis `priceUsd: 0`; Negocio Activo `priceUsd: 19` | COINCIDE (a mano) |
| 8 | `src/lib/llms-config.ts` L229-238 · `billingCyclesText()` | Mensual $19 · Trimestral $50 · Semestral $90 · Anual $156, con su ahorro | LEE |
| 9 | `src/app/llms.txt/route.ts` L87 y `src/app/llms-full.txt/route.ts` L96 | "0 USD/mes" y "19 USD/mes" (de `PLANS`) + ciclos de `billingCyclesText()` | LEE los ciclos; el mensual viene de #7 |
| 10 | `src/components/marketing/sections/PricingSection.tsx` L52 | `MONTHLY_FULL = 19` (precio tachado "sería $19/mes") | COINCIDE (a mano) |
| 11 | `PricingSection.tsx` L129-148 | precio, "Ahorra N%", "Total … facturado …" | LEE (`BILLING_CYCLES`, `savingsPct`) |
| 12 | `src/app/(marketing)/recursos/page.tsx` L31, L68 | `$` + `BILLING_CYCLES[tier].mensual.monthlyEquivalent` → "$19/mes" | LEE |
| 13 | `src/app/(marketing)/[segmento]/page.tsx` L101 · páginas `/para-*` | precio del plan = `BILLING_CYCLES[t].mensual.monthlyEquivalent` | LEE |
| 14 | `src/components/marketing/sections/segment/SegmentHero.tsx` L7, L49 | "Desde $19/mes" (`Math.round(mensual.monthlyEquivalent)`) | LEE |
| 15 | `…/segment/SegmentPricing.tsx` L30, L43 | monto y Bs por mes de `BILLING_CYCLES` | LEE |
| 16 | `src/app/(marketing)/planes/page.tsx` | ofertas JSON-LD por ciclo, `BILLING_CYCLES.negocio_activo` ($19/$50/$90/$156) y metadatos "2 planes" | LEE / N/A |
| 17 | `src/app/(marketing)/terminos/page.tsx` L96-100 | "precios en USD", ciclos mensual/trimestral/semestral/anual con descuento, aviso de cambio de precios con 30 días | N/A (sin cifras de plan) |
| 18 | `src/lib/help-content.ts` L272, L810, L828, L866 | "Gratis 1 usuario, Negocio Activo hasta 10"; catálogo incluido en Negocio Activo | COINCIDE con `PLAN_LIMITS` |
| 19 | `src/lib/social/carrusel.ts` L182, L308 | `plan = BILLING_CYCLES.negocio_activo.mensual` → precio del carrusel | LEE |
| 20 | `src/lib/social/html-generator.ts` L118 | CTA "Prueba gratis en activopos.com" | N/A (no hay prueba: es plan Gratis permanente; solo redacción) |
| 21 | `src/components/ui/UpgradeModal.tsx` L22, `src/lib/plan-guard.ts` | "Función del plan Negocio Activo"; límites con `PLAN_LIMITS` y `PLAN_DISPLAY` | LEE / N/A |
| 22 | `src/lib/email/templates.ts` L86-93 | "Tu Negocio Activo vence en N días" (sin importes) | N/A |
| 23 | `src/lib/marketing-contact.ts` · `PricingSection` L123 · `PlanesEscalera` · `TabPlan` L163 | mensajes de WhatsApp: "me interesa el plan {nombre}" (sin importes) | N/A |
| 24 | `src/app/(dashboard)/configuracion/tabs/TabPlan.tsx` L93 | selector de plan del dashboard | LEE (`BILLING_CYCLES`) |
| 25 | `src/app/(admin)/invoices/InvoiceReviewModal.tsx` L95-98 (panel admin) | "Mensual ($19 · 1 mes) · Trimestral ($50 · 3) · Semestral ($90 · 6) · Anual ($156 · 12)" | COINCIDE (a mano) |
| 26 | `src/app/(marketing)/blog/[slug]/page.tsx` L209, `soporte/page.tsx` L20 | "Gratis para siempre", "Sin tarjeta, empieza gratis" | N/A |
| 27 | `src/components/marketing/sections/FinalCTASection.tsx` L7, `segment/SegmentCTA.tsx` L14, `PricingSection.tsx` L66 | "Sin contrato anual" | N/A |
| 28 | `src/app/(marketing)/como-funciona`, `contacto`, `nosotros`, `segmentos`, `privacidad` · `src/app/registro/**` · `(dashboard)/onboarding` · `(auth)/login` | sin precios ni planes | N/A (verificado: sin coincidencias) |

### Cifras de demostración que NO son precios de plan (N/A)

Maquetas del producto: `src/app/not-found.tsx` L13-16 ("$0.00"), `components/marketing/sections/LivePulseSection.tsx` (cobrado hoy $431.40, cuenta por pagar $120.00, etc.), `FeatureTabsSection.tsx` ($15.00 camisa, $8.50, $3.60, ticket $51.70), `FeatureListBentoSection.tsx` ($340.00, $128.50…), `lib/og/image.tsx` L29 (comentario con "$15.00") y `lib/social/brand.ts` L110 (ejemplo "$12.50 / Bs. 456.00"). Todo es dato ilustrativo.

## B. Riesgo al publicar los precios nuevos (NO corregido; coincide hoy)

Cuando `PRICES_PUBLISHED` pase a `true`, `BILLING_CYCLES.negocio_activo` pasa a $29 y estos lugares seguirían diciendo $19 / $13 / $156. Conviene derivarlos de `plan-limits.ts` en el mismo cambio que active el flag:

1. `src/app/(marketing)/page.tsx` — JSON-LD ofertas Mensual/Anual (#2) y FAQPage (#4).
2. `src/app/(marketing)/faq/page.tsx` L91 (#5).
3. `src/lib/llms-config.ts` L216 `priceUsd: 19` (#7) → alimenta `llms.txt` y `llms-full.txt`.
4. `PricingSection.tsx` L52 `MONTHLY_FULL = 19` (#10).
5. `src/app/(admin)/invoices/InvoiceReviewModal.tsx` L95-98 (#25).
6. Textos con límites a mano (`help-content.ts`, `faq/page.tsx`): "40 productos / 1 usuario / 10 usuarios" — hoy iguales a `PLAN_LIMITS`.

## C. Documentos internos (`.doc/`) con precios de eras anteriores

No son públicos y no se modificaron; son historial. Los vigentes viven en `plan-limits.ts`.

| Documento | Valor que menciona |
|---|---|
| `ACTIVOPOS_MASTER.md` | $15.00 (ejemplo de formato) |
| `ACTIVOPOS_MASTER_V2.md` | competidor SOFI $15/mes |
| `MASTER_DOC_ACTIVOPOS.md` | Base Mostrador $15/mes |
| `PLAN_MAESTRO_ESTADO_v2.md`, `SESSION_HANDOFF_16JUN2026.md` | Plan "Catálogo Activo" $25/mes |
| `GRAND_HANDOFF_ActivoPOS_v2_14Jul2026.md` | Mostrador $15 / Negocio $25 / Pro $40 |
| `HANDOFF_Auditoria_Diseño_Global_2026-07-12.md` | "Precios $15/$25/$40 en /planes — NO es un error" (era anterior al rediseño) |
| `HANDOFF_Rediseno_Planes_Precios_17Jul2026.md` | rediseño de 3 planes ($15/$25/$40) a 2 planes ($0/$19) |
| `HANDOFF_Auditoria_Marketing_2026-07-11.md` | decía que `/recursos` no leía `plan-limits.ts`; **hoy ya lo lee** (#12) |
| `HANDOFF_Cierre_Carrusel_27Jul2026.md` | "Precio $19/$25 inconsistente" (resuelto: `precioUsd` lee `BILLING_CYCLES`) |
| `HANDOFF_Sprint30_ProximoAgente.md`, `HANDOFF_Sprint44-49_Sesion_1Jul2026.md` | precios de competidores (Fina $20-$40, Cuadrelatam $10/$25/$80) |
| `BUILD_SPEC_Landing_BentoCalido.md` | referencia a que los precios se verifican en `plan-limits.ts` |

## Qué se cambió en esta auditoría

- `src/app/(marketing)/page.tsx`: import de `BILLING_CYCLES` y la descripción de la oferta anual del JSON-LD (L99) ahora lee la fuente (`$13.00 por mes. 30% de ahorro vs mensual.`).
- Nada más. No se publicaron precios nuevos, no se tocó `PRICES_PUBLISHED`.
