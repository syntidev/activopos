# SESSION HANDOFF — ActivoPOS
# Fecha: [FECHA] | Sprint: [N] | Módulo: [MÓDULO]
# Copiar y completar al cerrar cada sesión

---

## COMMITS DE ESTA SESIÓN

| Commit  | Descripción                          |
|---------|--------------------------------------|
| xxxxxxx | ✅ [descripción del commit]          |
| xxxxxxx | ✅ [descripción del commit]          |

---

## ESTADO DEL SISTEMA

### Infraestructura
- Next.js 14 + TypeScript + CSS Modules + Prisma + MySQL + PM2
- Cloudflare + SSL | Puerto 3001
- Deploy: `cd /var/www/activopos && git pull && npx prisma migrate deploy && npm run build && pm2 restart activopos`

### .env VPS (recrear si se pierde)
```
DATABASE_URL="mysql://syntiweb_user:ReloadForMoney26#@localhost:3306/activopos"
JWT_SECRET="activopos_secret_2026_[CAMBIAR_EN_PRODUCCION]"
NEXT_PUBLIC_SUPABASE_URL=[URL_SUPABASE]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[KEY_SUPABASE]
BCV_API_URL=https://ve.dolarapi.com/v1/dolares/oficial
BCV_FALLBACK_RATE=36.50
PORT=3001
```

---

## LO QUE FUNCIONA HOY

✅ [Módulo 1 — descripción breve]
✅ [Módulo 2 — descripción breve]
⚠️ [Módulo con advertencia — descripción]

---

## PENDIENTE INMEDIATO (próxima sesión)

1. [Tarea concreta con archivo y método objetivo]
2. [Tarea concreta]
3. [Tarea concreta]

---

## BUGS CONOCIDOS

| # | Severidad | Descripción | Archivo | Estado |
|---|-----------|-------------|---------|--------|
| 1 | 🔴 P0     | [descripción] | [archivo] | Pendiente |
| 2 | 🟠 P1     | [descripción] | [archivo] | Pendiente |

---

## DEUDA TÉCNICA DOCUMENTADA

- [Deuda 1 — descripción corta]
- [Deuda 2 — descripción corta]

---

## PRÓXIMO SPRINT

**Sprint [N+1]: [Nombre del sprint]**

Objetivos:
1. [Objetivo 1]
2. [Objetivo 2]
3. [Objetivo 3]

Agentes sugeridos:
- CLI-A: [tareas de backend/API]
- CLI-B: [tareas de UI/componentes]
- CLI-D: [certificación]

---

## COMANDOS CLAVE

```bash
# SSH VPS
ssh -i C:\Users\carbo\.ssh\id_ed25519 root@187.124.241.213

# Deploy completo
cd /var/www/activopos && git pull && npx prisma migrate deploy && npm run build && pm2 restart activopos

# Ver logs
pm2 logs activopos --lines 50

# Prisma Studio
npx prisma studio

# Verificar estado
pm2 status
curl -I http://localhost:3001
```

---

## CONTEXTO PARA PRÓXIMA SESIÓN

[Párrafo de 3-5 líneas explicando el estado mental del proyecto,
decisiones tomadas y lo más importante para retomar sin perder contexto]

---

*ActivoPOS | syntidev | activopos.com*
