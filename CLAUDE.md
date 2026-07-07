# CLAUDE.md â€” ActivoPOS
# Instrucciones maestras para Claude Code y todos los agentes
# âš ï¸ LEER COMPLETO ANTES DE CUALQUIER ACCIÃ“N
# VersiÃ³n: 3.1 | Junio 2026 | Carlos BolÃ­var â€” SYNTIdev

---

## ðŸš¦ GOBERNANZA â€” LEER PRIMERO, SIEMPRE

### Modos de operaciÃ³n

| MODO      | Palabra clave | QuÃ© hacer                          | PROHIBIDO                              |
|-----------|---------------|------------------------------------|----------------------------------------|
| CONSULTA  | [CONSULTA]    | Responder en â‰¤5 lÃ­neas, sin cÃ³digo | Abrir archivos, escribir cÃ³digo        |
| DISEÃ‘O    | [DISEÃ‘O]      | Proponer arquitectura              | Implementar, tocar archivos            |
| EJECUCIÃ“N | [EJECUTA]     | Implementar lo acordado            | Inferir cambios fuera del scope        |
| REVISIÃ“N  | [REVISA]      | Auditar cÃ³digo existente           | Proponer refactors no solicitados      |
| DEBUG     | [DEBUG]       | Diagnosticar SOLO el error         | Tocar cÃ³digo fuera del scope           |

**Si el modo no estÃ¡ declarado â†’ preguntar: "Â¿Modo CONSULTA, DISEÃ‘O o EJECUCIÃ“N?" y PARAR.**
**NUNCA asumir modo EJECUCIÃ“N por defecto.**

### Protocolo anti-deriva (irrompible)

Antes de CADA respuesta, verificar internamente:
1. Â¿Me pidieron cÃ³digo? â†’ Solo entonces escribo cÃ³digo
2. Â¿El scope es claro y acotado? â†’ Si no, preguntar en UNA lÃ­nea y parar
3. Â¿Voy a modificar algo fuera de lo pedido? â†’ PARAR
4. Â¿EncontrÃ© un bug fuera del scope? â†’ Reportar en 1 lÃ­nea, NO corregir
5. Â¿Mis criterios de Ã©xito son verificables por Carlos sin saber el cÃ³digo? â†’ Si no, reescribirlos

**LÃ­mites duros:**
- NUNCA abrir archivos adicionales sin permiso explÃ­cito
- NUNCA proponer "ya que estoy aquÃ­, tambiÃ©n arreglÃ©..."
- NUNCA continuar despuÃ©s de completar el pedido
- MÃ¡ximo 1 archivo modificado por request salvo instrucciÃ³n explÃ­cita

---

## ðŸ§  PRINCIPIOS KARPATHY â€” IRROMPIBLES

Estos principios gobiernan el comportamiento de TODOS los agentes.
**Un agente que los viola, se detiene. Carlos decide si continÃºa.**

### Principio 1 â€” Pensar antes de codificar

No asumir. No ocultar confusiÃ³n. Explicitar los tradeoffs.

Antes de implementar cualquier cosa:
- Declarar supuestos explÃ­citamente. Si hay incertidumbre, nombrarla.
- Si hay mÃºltiples interpretaciones vÃ¡lidas del pedido â†’ presentarlas, no elegir en silencio.
- Si existe un enfoque mÃ¡s simple que el pedido implica â†’ decirlo, con razÃ³n.
- Si algo no estÃ¡ claro â†’ DETENER. Nombrar exactamente quÃ© es confuso. Preguntar.

**Test interno:** Â¿PodrÃ­a otro agente leer mis supuestos y llegar al mismo resultado?
Si no â†’ declararlos antes de escribir cÃ³digo.

### Principio 2 â€” Simplicidad primero

CÃ³digo mÃ­nimo que resuelve el problema. Nada especulativo.

- Sin features mÃ¡s allÃ¡ de lo pedido.
- Sin abstracciones para cÃ³digo de un solo uso.
- Sin "flexibilidad" o "configurabilidad" que no fue solicitada explÃ­citamente.
- Sin manejo de errores para escenarios imposibles en producciÃ³n.
- Si el resultado tiene 200 lÃ­neas y podrÃ­a ser 50 â†’ reescribirlo.

**Test interno:** Â¿DirÃ­a un senior engineer que esto estÃ¡ sobrecomplicado?
Si la respuesta es sÃ­ â†’ simplificar antes de entregar.

### Principio 3 â€” Cambios quirÃºrgicos

Tocar solo lo necesario. Limpiar solo el propio desorden.

Al editar cÃ³digo existente:
- No "mejorar" cÃ³digo adyacente, comentarios ni formato.
- No refactorizar cosas que no estÃ¡n rotas.
- Coincidir con el estilo existente aunque se harÃ­a diferente.
- Si se nota cÃ³digo muerto no relacionado â†’ mencionarlo en 1 lÃ­nea, no borrarlo.

Cuando los cambios crean huÃ©rfanos:
- Remover imports/variables/funciones que MIS cambios dejaron sin uso.
- No remover cÃ³digo muerto preexistente a menos que se pida.

**Test interno:** Â¿Cada lÃ­nea modificada traza directamente al pedido?
Si hay lÃ­neas que no trazan â†’ revertirlas.

### Principio 4 â€” EjecuciÃ³n orientada a objetivos

Definir criterios de Ã©xito verificables antes de escribir cÃ³digo. Iterar hasta verificar.

Transformar tareas dÃ©biles en metas verificables:
- "Agregar validaciÃ³n" â†’ "`POST /api/products` con `name=''` devuelve `400` con `{error: 'name requerido'}`"
- "Corregir el bug de stock" â†’ "DespuÃ©s del cobro, `SELECT stock FROM products WHERE id=X` devuelve `stock - qty`"
- "Mejorar el POS" â†’ "La bÃºsqueda por nombre devuelve resultados en < 200ms medidos con DevTools"

Para tareas de mÃºltiples pasos, declarar el plan antes de ejecutar:
```
Plan:
1. [QuÃ© hago] â†’ verifico con: [comando o check especÃ­fico]
2. [QuÃ© hago] â†’ verifico con: [comando o check especÃ­fico]
3. [QuÃ© hago] â†’ verifico con: [comando o check especÃ­fico]
```

**Si Carlos da un criterio dÃ©bil ("que funcione") â†’ pedir uno verificable antes de empezar.**

### Principio 5 â€” Cero fachadas

El error mÃ¡s grave en este proyecto: cÃ³digo que parece funcionar pero no funciona.

- PROHIBIDO: botones sin onClick implementado.
- PROHIBIDO: endpoints que devuelven mock data.
- PROHIBIDO: UI que muestra valores hardcodeados como si fueran del servidor.
- PROHIBIDO: hacer commit de cÃ³digo con console.error silenciados.
- Si algo no estÃ¡ completo â†’ DECIRLO antes de commitear. Documentarlo en el commit.
- Nunca dejar un hilo abierto sin documentar.

**Test interno:** Si Carlos prueba esto manualmente ahora mismo, Â¿encontrarÃ¡ algo que parece funcionar pero no funciona?
Si la respuesta es sÃ­ â†’ corregirlo o declararlo explÃ­citamente.

---

## ðŸ—ï¸ PROYECTO

**ActivoPOS** â€” Sistema POS SaaS para PYMES venezolanas.
**Dominio:** activopos.com
**Local:** `C:\laragon\www\activopos\`
**VPS:** 187.124.241.213 | Puerto: 3001
**Repo:** github.com/syntidev/activopos | Rama: main
**Deploy:** PM2 + Nginx + SSL Certbot

### DocumentaciÃ³n del proyecto (leer en este orden)
```
1. CLAUDE.md (raÃ­z)           â†’ gobernanza, reglas irrompibles
2. .doc/SYSTEM_MAP.md         â†’ estado real del sistema, generado desde cÃ³digo
3. .doc/ACTIVOPOS_MASTER.md   â†’ Ã¡rbitro Ãºnico de verdad, roadmap, decisiones
4. .doc/AGENTS.md             â†’ protocolo multi-agente detallado
5. .doc/DB_SCHEMA.md          â†’ modelo de datos canÃ³nico
6. .doc/DESIGN_SYSTEM.md      â†’ sistema visual, tokens, componentes
```
**Si no leÃ­ste estos 4 primeros archivos â†’ cualquier acciÃ³n que tomes es potencialmente destructiva.**

---

## ðŸ”§ STACK SELLADO â€” NO NEGOCIABLE

```
Next.js 14.x       â†’ Framework principal (App Router)
TypeScript 5.x     â†’ Strict mode, nunca `any`
CSS Modules        â†’ Sin Tailwind, sin styled-components, sin inline styles
Prisma 7.x         â†’ ORM sobre MariaDB
MariaDB            â†’ misma instancia VPS, DB: activopos
jose               â†’ JWT HS256 (fail-closed, sin fallback secrets)
bcryptjs           â†’ Hash de passwords
Framer Motion      â†’ Animaciones y microinteracciones
Lucide React       â†’ Iconos Ãºnicamente â€” NUNCA emojis en UI
Zod 4.x            â†’ Validaciones (.issues NO .errors)
jsPDF              â†’ GeneraciÃ³n de tickets PDF
html5-qrcode       â†’ Scanner de cÃ³digo de barras en POS
sharp              â†’ Procesamiento de imÃ¡genes WebP
```

**Referencia de arquitectura:** `C:\laragon\www\sportbar\` â€” SOLO LECTURA.

---

## ðŸš¨ REGLAS CRÃTICAS â€” NUNCA VIOLAR

### TypeScript
- `strict: true` en tsconfig â€” NUNCA `any`
- Tipos explÃ­citos en todos los props, returns y parÃ¡metros
- Zod v4 para validaciÃ³n en API routes â€” `.issues` NO `.errors`
- Interfaces en `src/types/` â€” nunca tipos inline en componentes

### CSS y diseÃ±o
- SOLO CSS Modules (`*.module.css`) â€” cero Tailwind, cero inline styles
- Design tokens en `src/styles/tokens.css` â€” cero valores hardcodeados
- Variables CSS: `var(--color-brand)`, `var(--space-4)`, `var(--accent-rgb)`, etc.
- Dark/Light: `data-theme` en `<html>` â€” tokens se adaptan automÃ¡ticamente
- NUNCA colores hexadecimales directos en componentes (solo en tokens.css)
- Fraunces como tipografÃ­a display â€” Inter para cuerpo
- Touch targets mÃ­nimo 44px en elementos interactivos
- Dashboard (incluyendo sidebar): hereda dark/light mode completo
- Login: siempre dark navy â€” forzado, nunca hereda tema del cliente
- CatÃ¡logo pÃºblico: siempre light â€” forzado, nunca hereda dark mode del OS

### Next.js App Router
- Server Components por defecto â€” `'use client'` solo cuando sea necesario y justificado
- LÃ³gica de negocio en API routes â€” NUNCA en componentes
- Eager loading en Prisma â€” cero N+1 toleradas
- `include:` siempre definido explÃ­citamente en queries con relaciones

### Seguridad
- JWT fail-closed: sin fallback secrets, `algorithms: ['HS256']`
- `business_id` siempre desde `getSession()` â€” NUNCA del body ni de query params
- Rate limiting en login y todos los endpoints pÃºblicos
- Slugs validados con regex antes de cualquier query a DB
- `logo_path` solo acepta rutas `/uploads/` â€” nunca URLs externas
- Precios en catÃ¡logo vienen del servidor â€” nunca del cliente (anti price-tampering)

### Monetario â€” REGLA SELLADA
- Todo valor monetario muestra USD Y Bs simultÃ¡neamente â€” sin toggle, sin opciÃ³n
- Siempre juntos, este formato:
  ```
  $15.00
  Bs. 8,951.73
  ```
- `Bs = USD Ã— rate_bcv` (dinÃ¡mico, nunca hardcodeado)
- BCV API: `ve.dolarapi.com/v1/dolares/oficial`
- Fallback: Ãºltima tasa en tabla `dollar_rates`
- NUNCA bloquear una operaciÃ³n por falta de tasa BCV

### Paradigma de venta â€” IRROMPIBLE
- Cajero selecciona producto â†’ ingresa CANTIDAD
- Sistema calcula: `qty Ã— price_usd Ã— rate = total_bs`
- NUNCA el cajero ingresa monto en Bs para back-calcular cantidad
- `sale_mode = weight` â†’ input decimal (kg)
- `sale_mode = unit` â†’ input entero (unidades)

### Inventario
- Stock descuenta SOLO cuando `sale.status = 'paid'`
- Tickets abiertos NO afectan el stock

### Arquitectura
- Sin `branch_id` en tablas transaccionales (v1)
- Un negocio = un tenant = una instalaciÃ³n activa
- Multi-sucursal es feature de Fase 2

---

## ðŸ‘¥ ROLES DEL SISTEMA

| Rol         | Acceso                                      | Restricciones                        |
|-------------|---------------------------------------------|--------------------------------------|
| super_admin | Todo el sistema                             | Solo Carlos BolÃ­var                  |
| admin       | Todo excepto super_admin                    | No puede ver otros tenants           |
| cashier     | POS, Caja, Clientes â€” sin costos ni config  | Sin finanzas, sin configuraciÃ³n      |

---

## ðŸ¤– PROTOCOLO MULTI-AGENTE

### Roles de ventanas CLI

```
CLI-A â†’ Backend: API routes, Prisma, lÃ³gica de negocio, migraciones
CLI-B â†’ Frontend: componentes, CSS Modules, animaciones, design system
CLI-C â†’ Calidad: auditorÃ­a, seguridad â€” SOLO reporta, corrige P0 Ãºnicamente
CLI-D â†’ Features/Testing: mÃ³dulos nuevos, Playwright E2E
```

### Skills obligatorios por CLI â€” sin estos el prompt es invÃ¡lido y no se ejecuta

```
CLI-A: /code-review + /security-guidance + /software-architecture + database-migrations + api-design
CLI-B: /impeccable craft + /frontend-design + /ui-ux-pro-max + deployment-patterns
CLI-C: /code-review + /security-guidance â†’ delegar auditorÃ­as en typescript-reviewer y security-reviewer via Task tool
CLI-D: /playwright + /impeccable craft + /frontend-design + e2e-testing
```

### Plugins oficiales instalados
- `code-review` â€” Anthropic oficial
- `frontend-design` â€” Anthropic oficial
- `playwright` â€” Anthropic oficial
- `security-guidance` â€” Anthropic oficial
- `superpowers` â€” Anthropic oficial
- `ui-ux-pro-max` â€” skills-dir del proyecto
- `ecc@ecc` â€” ECC global (ver secciÃ³n ECC INTEGRATION)

### Reglas de scope (irrompibles)
- Cada CLI tiene scope exclusivo â€” no invadir el de otro agente
- CLI-B NO toca APIs ni lÃ³gica de negocio
- CLI-A NO toca CSS ni componentes de UI
- Si se necesita algo del scope de otro agente â†’ reportar, no improvisar
- Scope declarado al inicio de cada prompt: `# CLI-X â€” [SCOPE]`
- Si se detecta un bug fuera del scope â†’ documentar en 1 lÃ­nea al final, NO corregir

---

## ðŸŽ¨ SISTEMA VISUAL â€” REGLAS IRROMPIBLES

### ANTES de tocar cualquier .module.css (obligatorio, sin excepciÃ³n):
1. Abrir .doc/DESIGN_SYSTEM.html en browser â€” referencia visual inapelable
2. Leer .doc/DESIGN_SYSTEM.md completo â€” todas las secciones
3. Leer el JSX del mÃ³dulo â€” entender cÃ³mo estÃ¡n agrupados los elementos
4. Si el CSS existente NO produce el resultado del Design System â†’ REESCRITURA TOTAL
5. PROHIBIDO parchar CSS viejo â€” si no cumple, se borra y se reescribe desde cero
6. Declarar al inicio: clases CSS reales usadas en el .tsx del mÃ³dulo

### Layout obligatorio â€” todos los mÃ³dulos sin excepciÃ³n:
- Desktop â‰¥1024px: grid mÃ­nimo 2 columnas para cards y secciones
- grid-template-columns: minmax(0,1fr) minmax(0,1fr) â€” nunca 1fr solo
- NUNCA max-width fijo en contenedores de contenido
- NUNCA flex-direction: column cuando el espacio permite 2 columnas
- Tablet 640-1023px: 2 columnas
- Mobile <640px: 1 columna

### Cards â€” sistema de elevaciÃ³n (estÃ¡ndar activo):
- background: #FFFFFF
- border-radius: 16px
- box-shadow: 0 2px 8px rgba(47,43,61,0.10), 0 0 1px rgba(47,43,61,0.06)
- border: none â€” sin borde, solo sombra
- padding: 14px 18px desktop / 12px 14px mobile
- hover: translateY(-1px) + sombra mÃ¡s pronunciada
- PROHIBIDO: border en cards bajo cualquier circunstancia

### Fondo de pÃ¡gina dashboard:
- background: #EEEDF4 â€” contraste visible con cards blancas
- NUNCA background: #FFFFFF en el wrapper de pÃ¡gina del dashboard

### KPIs â€” Ã­conos con cÃ­rculo de color semÃ¡ntico:
- cobrado/ingresos â†’ bg #DCFCE7, Ã­cono DollarSign, color #16A34A
- crÃ©dito/pendiente â†’ bg #FEF3C7, Ã­cono Clock, color #D97706
- tickets/Ã³rdenes â†’ bg #DBEAFE, Ã­cono ShoppingCart, color #2563EB
- utilidad positiva â†’ bg #F3E8FF, Ã­cono TrendingUp, color #9333EA
- utilidad negativa â†’ bg #FEE2E2, Ã­cono TrendingDown, color #EF4444
- KPI hero (principal del mÃ³dulo) â†’ background: #0038BD, texto blanco

### Regla CSS de tokens (irrompible):
- PROHIBIDO crear valores hex en .module.css sin verificar tokens.css primero
- Si el token no existe â†’ crearlo en tokens.css PRIMERO, luego consumirlo
- NUNCA duplicar valores entre mÃ³dulos
- NUNCA hardcodear rgba, hex o px que ya existe como token

### Componentes del dashboard:
- escritorio.module.css â€” SOLO para escritorio/page.tsx, certificado, no tocar
- KpiCard.tsx â€” consumido por caja/ y reportes/ Ãºnicamente
- Cambios en otros mÃ³dulos van en su propio .module.css

### CatÃ¡logo pÃºblico (src/app/catalogo/):
- Fondo: #FFFFFF â€” no #EEEDF4
- Color primario: var(--biz-color) â€” nunca #0038BD
- Sin sidebar en ningÃºn breakpoint
- Ver .doc/DESIGN_SYSTEM.md secciÃ³n 16 completa

### Criterio de aprobaciÃ³n visual (no negociable):
Un mÃ³dulo estÃ¡ aprobado SOLO cuando Carlos lo verifica visualmente en:
- Desktop 1280px: 2 columnas, cards elevadas, sin scroll innecesario
- Mobile 375px: 1 columna, sin overflow horizontal
Un commit NO equivale a aprobaciÃ³n visual.

## ðŸ—‚ï¸ ESTRUCTURA DEL PROYECTO

```
src/
â”œâ”€â”€ app/
â”‚   â”œâ”€â”€ (auth)/login/
â”‚   â”œâ”€â”€ (dashboard)/
â”‚   â”‚   â”œâ”€â”€ layout.tsx
â”‚   â”‚   â”œâ”€â”€ escritorio/
â”‚   â”‚   â”œâ”€â”€ pos/
â”‚   â”‚   â”œâ”€â”€ pedidos/
â”‚   â”‚   â”œâ”€â”€ clientes/
â”‚   â”‚   â”œâ”€â”€ productos/
â”‚   â”‚   â”œâ”€â”€ caja/
â”‚   â”‚   â”œâ”€â”€ reportes/
â”‚   â”‚   â”œâ”€â”€ finanzas/
â”‚   â”‚   â”œâ”€â”€ tu-dia/
â”‚   â”‚   â””â”€â”€ configuracion/
â”‚   â”œâ”€â”€ catalogo/[slug]/        â† CatÃ¡logo pÃºblico sin auth
â”‚   â””â”€â”€ api/
â”‚       â”œâ”€â”€ auth/
â”‚       â”œâ”€â”€ cash/
â”‚       â”œâ”€â”€ catalog/[slug]/
â”‚       â”œâ”€â”€ clients/
â”‚       â”œâ”€â”€ config/
â”‚       â”œâ”€â”€ dashboard/
â”‚       â”œâ”€â”€ finanzas/
â”‚       â”œâ”€â”€ orders/
â”‚       â”œâ”€â”€ products/
â”‚       â”œâ”€â”€ rates/
â”‚       â”œâ”€â”€ reports/
â”‚       â”œâ”€â”€ sales/
â”‚       â””â”€â”€ upload/
â”œâ”€â”€ components/
â”‚   â”œâ”€â”€ ui/                     â† Button, Input, Badge, Modal, Toast, KpiCard...
â”‚   â””â”€â”€ layout/                 â† Sidebar, Header, AppLayout, CajaToggle, PwaBanner
â”œâ”€â”€ lib/
â”‚   â”œâ”€â”€ prisma.ts
â”‚   â”œâ”€â”€ auth.ts                 â† JWT fail-closed
â”‚   â”œâ”€â”€ rate-limit.ts           â† IP + email rate limiting
â”‚   â””â”€â”€ pos.ts                  â† Motor de cÃ¡lculo POS
â”œâ”€â”€ styles/
â”‚   â”œâ”€â”€ tokens.css              â† Design tokens â€” fuente Ãºnica de verdad visual
â”‚   â””â”€â”€ globals.css
â””â”€â”€ types/                      â† Interfaces globales â€” nunca tipos inline en componentes
```

---

## ðŸš€ COMANDOS CLAVE

```bash
# Desarrollo local
Remove-Item -Recurse -Force .next   # SIEMPRE antes de npm run dev si hay problemas
npm run dev

# VerificaciÃ³n antes de commit â€” AMBOS deben pasar en verde
npx tsc --noEmit                    # 0 errores TypeScript
npm run build 2>&1 | tail -10       # Compiled successfully

# Deploy VPS
cd /var/www/activopos
git pull origin main
npx prisma generate
npx prisma migrate deploy
rm -rf .next
npm run build
pm2 restart activopos
pm2 save
curl -s http://localhost:3003/api/rates/bcv   # Verificar que BCV responde

# Seed de datos de prueba
npx prisma db seed

# DiagnÃ³stico de DB rÃ¡pido
npx prisma studio
```

---

## â›” LO QUE NUNCA SE TOCA

- `C:\laragon\www\synticorex\` â€” SYNTIweb producciÃ³n activa
- `C:\laragon\www\syntimeat\` â€” SYNTImeat producciÃ³n activa
- Panel `admin.activopos.com` â€” territorio exclusivo de Opus, sesiÃ³n aislada
- El paradigma de venta `qty Ã— price` â€” nunca `bs â†’ qty`
- `git stash` en VPS â€” riesgo de perder trabajo del CLI

---

## âœ… CHECKLIST PRE-COMMIT â€” OBLIGATORIO

Antes de cualquier commit, verificar cada punto. Si uno falla â†’ no commitear.

- [ ] TypeScript strict â€” `npx tsc --noEmit` devuelve 0 errores
- [ ] CSS Modules â€” cero Tailwind, cero inline styles, cero hex hardcodeados en componentes
- [ ] Variables CSS â€” cero valores `rgba(` crudos fuera de `tokens.css`
- [ ] `business_id` de `getSession()` â€” nunca del body ni query params
- [ ] Paradigma de venta correcto (`qty Ã— price`, nunca `bs â†’ qty`)
- [ ] Dual moneda: USD + Bs simultÃ¡neo en todo valor monetario
- [ ] Build limpio: `npm run build` â†’ "Compiled successfully"
- [ ] Cero fachadas: todos los botones tienen acciÃ³n real, todos los endpoints tienen datos reales
- [ ] Commit con bloque estÃ¡ndar completo
- [ ] Hilo abierto documentado en el commit (si aplica)

---

## ðŸ“‹ BLOQUE DE COMMIT ESTÃNDAR (obligatorio)

```bash
git add .
git commit -m "tipo(scope): descripciÃ³n concisa

- Modificado: [archivo] â†’ [quÃ© cambiÃ³ exactamente]
- Creado: [archivo] â†’ [propÃ³sito]
- Verificado: [quÃ© check confirma que funciona]
- Pendiente: [si hay algo relacionado sin resolver]

ðŸ¤– Agente: CLI-X | Sprint: N | Fecha: YYYY-MM-DD"
git push origin main
git log --oneline -3
```

---

## ðŸ”— REFERENCIAS EXTERNAS

- BCV API: `ve.dolarapi.com/v1/dolares/oficial`
- Competidores documentados: Venko, Fina, SOFI, Control Total, Negotiale
- Referencia catÃ¡logo: LLEVA.app (`camilashop.lleva.app`)
- n8n: `n8n.syntiweb.com` â€” pendiente integraciÃ³n WhatsApp bot

---

## âš¡ ECC INTEGRATION (global)

ECC v2.0.0 instalado globalmente en `~/.claude/` â€” 77 agents Â· 93 skills Â· 38 hooks activos.
Plugin registrado: `ecc@ecc` (user scope).

### ActivaciÃ³n obligatoria al inicio de cada sesiÃ³n CLI

```
/instinct-status
```

Carga patrones aprendidos de sesiones anteriores. Sin este comando, el agente opera sin memoria acumulada.

### Memory Persistence (automÃ¡tico â€” sin acciÃ³n manual)

| Hook            | CuÃ¡ndo dispara          | QuÃ© hace                                        |
|-----------------|-------------------------|-------------------------------------------------|
| session-start   | Al abrir Claude Code    | Carga contexto de sesiÃ³n anterior               |
| pre-compact     | Antes de compactar      | Guarda estado crÃ­tico antes de comprimir        |
| session-end     | Al cerrar sesiÃ³n        | Persiste aprendizajes en `~/.claude/session-data/` |

El agente NO necesita hacer nada manual. Los hooks gestionan memoria automÃ¡ticamente.

### Subagentes ECC disponibles via Task tool

Delegar en estos agentes en lugar de hacer inline:

| Agente                | CLI que lo usa | CuÃ¡ndo invocarlo                              |
|-----------------------|----------------|-----------------------------------------------|
| `typescript-reviewer` | CLI-C          | AuditorÃ­as TypeScript strict, tipos, generics |
| `security-reviewer`   | CLI-C          | IDOR, business_id leaks, Zod v4, JWT          |
| `e2e-runner`          | CLI-D          | Playwright, CIMAAD suite, flujos E2E          |
| `code-reviewer`       | CLI-C / CLI-A  | Calidad general, patrones, deuda tÃ©cnica       |

### Skills ECC activos para ActivoPOS

| Skill                  | CLI           | AplicaciÃ³n directa                          |
|------------------------|---------------|---------------------------------------------|
| `database-migrations`  | CLI-A         | Migraciones Prisma 7, alter tables MariaDB  |
| `api-design`           | CLI-A         | Endpoints Next.js 14, REST patterns         |
| `e2e-testing`          | CLI-D         | Playwright patterns, Page Object Model      |
| `deployment-patterns`  | CLI-D         | PM2 cluster, Nginx, health checks           |

### Rules ECC activas (globales)

```
~/.claude/rules/ecc/common/     â†’ principios universales (siempre activos)
~/.claude/rules/ecc/typescript/ â†’ TypeScript/Next.js patterns (siempre activos)
```

Estas rules complementan las reglas de este CLAUDE.md. En caso de conflicto, **este CLAUDE.md tiene prioridad absoluta**.

### Contextos dinÃ¡micos por modo (opcional, avanzado)

```powershell
# Desarrollo activo â€” carga contexto mÃ­nimo
alias claude-dev='claude --system-prompt "$(cat ~/.claude/contexts/dev.md)"'

# AuditorÃ­a de calidad â€” carga contexto de revisiÃ³n
alias claude-review='claude --system-prompt "$(cat ~/.claude/contexts/review.md)"'
```

### Regla de contexto (irrompible)

MÃ¡ximo 10 MCPs activos por sesiÃ³n. Con mÃ¡s de 80 tools activos la ventana de contexto se degrada significativamente. Deshabilitar MCPs no usados antes de cada sesiÃ³n de trabajo intenso.
