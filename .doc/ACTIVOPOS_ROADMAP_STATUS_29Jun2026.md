# ACTIVOPOS — ESTADO DEL ROADMAP
# Actualizado: 29 Junio 2026
# Progreso global: 68%

---

## AVANCE POR BLOQUE

| # | Bloque | Período | Estado | % |
|---|--------|---------|--------|---|
| 0 | Cierre SYNTImeat | Mayo 2026 | ✅ COMPLETADO | 100% |
| 1 | Extracción reglas | 1a semana Jun | ✅ COMPLETADO | 100% |
| 2 | Rediseño visual | Junio | ✅ COMPLETADO (sesión 28-29 Jun) | 100% |
| 3 | Tenant Layer | Junio-Julio | ✅ COMPLETADO (sesión 28-29 Jun) — 123 endpoints sellados | 100% |
| 4 | Módulos | Julio-Agosto | ⏳ PRÓXIMO | 35% |
| 5 | Catálogo + SportBar | Agosto-Sept | ⏳ PARCIAL — catálogo rediseñado, SportBar pendiente | 50% |
| 6 | Deploy producción | Octubre | ⏳ PARCIAL — VPS activo, falta wildcard DNS + 2 tenants | 30% |
| 7 | Lanzamiento | Noviembre | ⏳ NO INICIADO | 0% |

---

## MÓDULOS CORE — ESTADO DETALLADO

### ✅ Completados y certificados (18 módulos)

| Módulo | Sprint | Certificación |
|--------|--------|---------------|
| Auth + JWT | 1 | CIMAAD ✅ |
| BCV Live Rate | 1 | CIMAAD ✅ |
| Design System + Tokens | 2-17 | tokens.css 436 líneas |
| Layout (Sidebar+Header) | 2 | CIMAAD ✅ |
| Escritorio / Dashboard | 3-17 | KPIs + gráficos reales |
| POS / Punto de Venta | 3-20 | Multi-ticket + cobro |
| Pedidos (Kanban) | 4-25 | Timer + urgencia |
| Clientes | 4-23 | Historial + CxC |
| Productos + Inventario | 2-39 | Bugs corregidos Sprint 39 |
| Ventas del Día | 4 | Historial + anular |
| Gestión de Caja | 4-11 | Abrir/cerrar + movimientos |
| Reportes (4 tabs) | 11-18 | Excel export + PDF |
| Finanzas | 12-23 | CxC + CxP + gastos |
| Catálogo Digital | 8-38 | Rediseñado patrón LLEVA |
| Cotizaciones | 15 | QUO-YYYY-NNNN |
| Devoluciones | 15 | Restaura stock |
| Usuarios | 15 | Max 5 cajeros |
| Configuración | 4-30 | 13 tabs |

### ✅ Completados esta sesión (4 nuevos)

| Módulo | Sprint | Detalle |
|--------|--------|---------|
| Sistema Multimedia | 40-40.1 | Compresión cliente, dual size, storage tenant |
| Tenant Layer | 41-41.1 | 123 endpoints, Prisma Extension, DMMF-driven |
| Storage Tenant | 40.1 | `storage/tenants/{id}/products/` + `/logo/` |
| Nginx Storage | 40.1 | `location ^~ /storage/` configurado |

### ⏳ Pendientes Bloque 4 (Julio-Agosto)

| Módulo | Prioridad | Dependencia |
|--------|-----------|-------------|
| Sucursales / Branches | Alta | Tenant Layer ✅ (ya listo) |
| Fábrica completa | Alta | Productos ✅ |
| Delivery completo | Alta | Pedidos ✅ |
| Listas de precios (detal/mayor) | Media | Productos ✅ |
| Comisiones a personal | Media | Usuarios ✅ |
| Admin Panel (admin.activopos.com) | Alta | Tenant Layer ✅ — Filament v5 |

### ⏳ Pendientes Bloque 5-6 (Agosto-Octubre)

| Módulo | Prioridad | Notas |
|--------|-----------|-------|
| SportBar (asientos) | Media | Spec en MASTER_DOC_SPORTBAR_v5 |
| Wildcard DNS *.activopos.com | Alta | Nginx resolver por subdominio |
| 2 tenants reales | Alta | Café Daniel + SportBar Daniel |
| Selector color banner (CAT-08) | Media | UI en TabTema.tsx |
| Onboarding multitenant | Alta | Wizard registro negocio |
| Planes y suscripciones | Alta | Dashboard plan activo |

---

## LO QUE SE LOGRÓ EN LA SESIÓN 28-29 JUNIO

### En números
- **16 sprints** ejecutados (35 al 41.1)
- **30+ commits** en main
- **123 endpoints** auditados y migrados al tenant layer
- **3 bugs P0** encontrados y corregidos (stock display, filtros, upload roto)
- **1 vulnerabilidad** de seguridad corregida (CSV formula injection)
- **2 headers sticky** clonados de LLEVA.app
- **16 mejoras visuales** en cards de producto
- **Sistema multimedia** reconstruido desde cero
- **Storage tenant** reestructurado para multitenant

### Decisiones arquitecturales selladas
1. Tenant Layer usa Prisma Client Extensions con DMMF-driven (no lista manual)
2. `$transaction` mantiene prisma base con business_id manual (extension no se propaga al tx)
3. `$queryRaw` mantiene business_id manual (extension no cubre SQL crudo)
4. Storage en `storage/tenants/{id}/` fuera de `public/` — Nginx sirve via alias
5. Upload genera dual: full 1200px + thumb 400px, ambos WebP
6. Compresión del lado del cliente via Canvas API antes de subir
7. Catálogo público: solo 2 headers sticky, sin hero/banner
8. Cards: padding 8px, imagen radius 10px, card radius 14px (patrón LLEVA)
9. Badges: Popular=ámbar, Nuevo=azul, Promo=rojo, Recomendado=verde con micro-iconos Lucide
10. Métodos de pago solo en formulario "Antes de enviar" como `<select>`

---

## DEUDA TÉCNICA ACTIVA

| ID | Sev | Descripción | Sprint pendiente |
|----|-----|-------------|-----------------|
| DT-P1 | P1 | Desnormalizar business_id a tablas hijas (SaleItem, etc.) | Próximo |
| DT-P2 | P2 | Modal producto: imagen ocupa todo viewport mobile | Próximo |
| DT-P3 | P2 | Local dev no sirve /storage/ (solo VPS) | Config |
| DT-P4 | P3 | `@default("#2563EB")` hardcodeado en schema.prisma | Futuro |
| DT-P5 | P3 | 2 `style={{...}}` inline en ProductModal.tsx | Futuro |
| DT-P6 | P2 | Thumb 400px generado pero no consumido por frontend | Próximo |

---

## COMPETENCIA — DÓNDE ESTAMOS vs ELLOS

| Feature | Fina | Negotiale | Venko | ActivoPOS |
|---------|------|-----------|-------|-----------|
| POS completo | ✅ | ✅ | ✅ | ✅ |
| Catálogo público | ❌ | ❌ | ❌ | ✅ Premium |
| WhatsApp pedidos | ❌ | ❌ | ❌ | ✅ |
| Dual currency USD+Bs | Parcial | ✅ | ✅ | ✅ |
| Tenant Layer | ✅ | ✅ | ❌ | ✅ Sellado |
| Dark mode | ❌ | Toggle | ❌ | ✅ Nativo |
| Temas por segmento | ❌ | ❌ | ❌ | ✅ 10 temas |
| Upload con compresión | ? | ? | ? | ✅ Cliente+Server |
| WCAG AA | ? | ? | ? | ✅ Auditado |

---

## PRÓXIMA SESIÓN — PRIORIDADES

```
1. Verificar multimedia en producción (foto real desde teléfono)
2. Desnormalizar business_id a tablas hijas (defensa profundidad)
3. Iniciar Bloque 4: Módulo Sucursales o Fábrica completa
4. Admin Panel si Opus disponible (admin.activopos.com)
5. Actualizar SYSTEM_MAP.md con todos los cambios de esta sesión
```

---

*ActivoPOS — SYNTIdev | Actualizado: 29 Junio 2026*
*Roadmap 68% completado | Meta: Noviembre 2026 con 10+ clientes pagando*
