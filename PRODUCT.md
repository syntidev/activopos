# Product

## Register

product

## Users

**Cajeros (cashiers):** Venezuelan SMB staff operating physical POS terminals. Speed is everything — they're mid-transaction, often in loud retail environments, touching a tablet or laptop. They know the workflow cold; the interface should disappear into the task.

**Administradores (business owners):** PYME owners reviewing end-of-day numbers, checking caja history, managing products. Analytical mode — they want accurate totals, clear differences, and no cognitive load between them and the number.

## Product Purpose

ActivoPOS is a SaaS POS system for Venezuelan SMBs. It handles sales (Bolívares + USD dual-currency), cash register management (open/close turns, movements), inventory, credit sales, and reporting. The defining complexity: every price is USD but every transaction settles in Bs at the live BCV rate. The system must make that conversion invisible to the operator.

Success looks like: a cashier can complete a sale in under 10 seconds. An admin can close the caja and know immediately if it cuadra.

## Brand Personality

**Confiable. Veloz. Claro.** A tool that earns trust through precision — not through decoration. Venezuelan context means operators may be working on mid-range hardware, in variable lighting, under pressure. The interface must perform.

Anti-flash, anti-chrome. Every pixel earns its place by serving a task.

## Anti-references

- Consumer-facing SaaS dashboards with hero metrics and gradient cards (Stripe Dashboard aesthetic — too decorative for a cashier's workflow)
- Busy marketplace UIs with competing CTAs everywhere
- Overly minimal "aesthetic" dashboards that bury numbers in whitespace
- Light mode POS systems that cause eye strain under store lighting

## Design Principles

1. **The number is the hero.** Sales totals, efectivo esperado, diferencia — these are load-bearing. Size, weight, and placement serve readability, not decoration.
2. **Danger is never ambiguous.** Faltante (negative difference), anulaciones, and destructive actions use the danger color with no exceptions. A cashier must never mistake a red number for green.
3. **One action per moment.** The primary action on any screen (cobrar, cerrar caja, guardar movimiento) is always reachable without scroll and visually dominant.
4. **Trust through density.** Venezuelan operators are trained on dense tools. Comfortable data density beats spacious emptiness.
5. **Speed over delight.** No orchestrated load sequences, no celebration animations on routine transactions. Motion only for state feedback.

## Accessibility & Inclusion

- WCAG 2.1 AA minimum
- Touch targets ≥ 44px (tablet POS use)
- High contrast dark theme — readable under store lighting
- `prefers-reduced-motion` respected on all transitions
- Bilingual: Spanish only (no i18n needed for MVP)
