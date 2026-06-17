# CIERRE DE SESIÓN — ActivoPOS
# Fecha: 16 Junio 2026 — Sesión nocturna
# Complementa SESSION_HANDOFF_16JUN2026.md

---

## DECISIONES NUEVAS TOMADAS EN ESTA SESIÓN

### Landing Page
- landing.html en /public/landing.html — servida en activopos.com/
- src/app/page.tsx redirige a /landing.html
- middleware.ts excluye '/' y '/landing.html' de auth
- BCV llama primero a /api/rates/bcv propio, fallback a ve.dolarapi.com
- Font switcher eliminado — Fraunces fija en producción
- Testimonios: Daniel A. (real), María R., Luisana V. (composites)
- Plan 3 "Pulso del Negocio" — QR analytics independiente de LLEVA.app
- Sin precios en planes — consultar por WhatsApp (estrategia de calificación)

### Catálogo Digital — Decisión arquitectural
- Sin multitenancy en v1 — confirmado
- Opción B primero: activopos.com/catalogo/[slug]
- Opción A (subdominio wildcard *.activopos.com) — Fase 2
- El registro *.activopos.com → 187.124.241.213 ya existe en Cloudflare
- Nginx leerá el Host header para servir el catálogo correcto cuando se implemente

### Especificaciones de producto — Nomenclatura sellada
- Se llaman "especificaciones" — NO "variantes" en el copy de cara al cliente
- Aplica a CUALQUIER producto o servicio:
  - Físico por unidad: Harina P.A.N., pan, productos de bodega
  - Físico por peso: kg, g, lb (carnicería, pescadería)
  - Físico por medida: m, cm (ferretería, telas)
  - Físico por volumen: L, ml (líquidos, pintura)
  - Con opciones: talla + color (ropa, calzado)
  - Servicio/intangible: hora, sesión, consulta (técnicos, peluquería)
  - Cotización mixta: insumos + mano de obra (técnico eléctrico)
- "Unidad" es la especificación más básica — el default de cualquier producto

### QR Analytics — Código existente en SportBar
- El componente QR ya está construido en React en SportBar
- Adaptar para ActivoPOS en Sprint 7
- El QR de cada negocio rastrea: escaneos por día, fuente, conversión
- Dashboard del dueño muestra: escaneos, pedidos, % conversión
- Esta funcionalidad es independiente de LLEVA.app
- Es el corazón del Plan 3 "Pulso del Negocio"

### Cloudinary — Definitivamente descartado
- Storage local en /public/uploads/products/
- scripts/setup-uploads.sh crea carpetas y permisos en VPS
- Patrón idéntico a SportBar

---

## PENDIENTES TÉCNICOS PARA PRÓXIMA SESIÓN

### VPS — Crítico
```bash
# 1. Aplicar migraciones Sprint 5
cd /var/www/activopos
git pull https://TOKEN@github.com/syntidev/activopos.git main
npx prisma migrate deploy
npm run build
pm2 restart activopos

# 2. Setup uploads (una sola vez)
bash scripts/setup-uploads.sh
```

### Landing (FileZilla)
- Fix `.eco-desc` — quitar `flex:1`, cambiar `margin-bottom:18px` → `10px`
- Archivo: /var/www/activopos/public/landing.html

### Código — Sprint 6
| CLI | Tarea |
|-----|-------|
| CLI-A | Catálogo digital /catalogo/[slug] — Opción B |
| CLI-A | Adaptar QR analytics de SportBar |
| CLI-B | Conectar POS al API real (actualmente mock en algunos flujos) |
| CLI-B | Probar flujo completo: abrir caja → buscar → cobrar → ticket |
| CLI-C | /code-review ultra codebase completo |
| CLI-C | /security-review OWASP endpoints auth y pagos |
| CLI-D | /webapp-testing Playwright flujo POS E2E |

---

## ESTADO FINAL DEL DÍA

| Item | Estado |
|------|--------|
| https://activopos.com | ✅ Live con SSL |
| PM2 puerto 3003 | ✅ Online |
| GitHub commit adf748e | ✅ Sincronizado |
| Build local | ✅ Limpio |
| landing.html | ✅ En producción |
| Migraciones VPS Sprint 5 | ⏳ Pendiente |
| Fix eco-desc landing | ⏳ Pendiente FileZilla |

---

## PARA EL PRÓXIMO AGENTE

Leer en este orden:
1. SESSION_HANDOFF_16JUN2026.md
2. Este documento (CIERRE_SESION_16JUN2026.md)
3. PLAN_MAESTRO_ESTADO_v2.md
4. .doc/CLAUDE.md en el repo

El proyecto está en buen estado. No improvisar.
Siempre build limpio antes de cualquier commit.
Siempre local → GitHub → VPS. Nunca al revés.

---

*ActivoPOS — syntidev — 16 Junio 2026*
