#!/bin/bash
# ============================================================
# ACTIVOPOS — Setup VPS completo
# Ejecutar: bash setup-vps.sh
# VPS: 187.124.241.213 | Puerto: 3001
# ============================================================

set -e
echo "🚀 ActivoPOS — Setup VPS iniciando..."

# ── 1. Variables ────────────────────────────────────────────
DB_NAME="activopos"
DB_USER="root"
DB_PASS=""
APP_PORT=3001
APP_DIR="/var/www/activopos"
JWT_SECRET="activopos_prod_$(openssl rand -hex 32)"

# ── 2. Crear .env ───────────────────────────────────────────
echo "📝 Creando .env..."
cat > $APP_DIR/.env << EOF
DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@127.0.0.1:3306/${DB_NAME}"
DB_HOST=127.0.0.1
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
DB_NAME=${DB_NAME}
DB_POOL=5
JWT_SECRET="${JWT_SECRET}"
NEXT_PUBLIC_APP_URL="https://activopos.com"
BCV_API_URL="https://ve.dolarapi.com/v1/dolares/oficial"
BCV_FALLBACK_RATE="36.50"
PORT=${APP_PORT}
NODE_ENV=production
EOF
echo "✅ .env creado"

# ── 3. Instalar dependencias ────────────────────────────────
echo "📦 Instalando dependencias..."
cd $APP_DIR
npm install --production=false
echo "✅ Dependencias instaladas"

# ── 4. Prisma ───────────────────────────────────────────────
echo "🗄️  Ejecutando migraciones..."
npx prisma generate
npx prisma migrate deploy
echo "✅ Base de datos migrada"

# ── 5. Seed inicial ─────────────────────────────────────────
echo "🌱 Ejecutando seed..."
node -e "
require('ts-node').register({compilerOptions:{module:'commonjs'}});
require('./prisma/seed.ts');
" && echo "✅ Seed completado" || echo "⚠️  Seed falló (puede que ya existan datos)"

# ── 6. Build Next.js ────────────────────────────────────────
echo "🔨 Compilando Next.js..."
npm run build
echo "✅ Build completado"

# ── 7. PM2 ──────────────────────────────────────────────────
echo "⚙️  Configurando PM2..."
cat > $APP_DIR/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'activopos',
    script: 'node_modules/.bin/next',
    args: 'start',
    cwd: '${APP_DIR}',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: ${APP_PORT}
    }
  }]
}
EOF

# Detener si ya existe
pm2 delete activopos 2>/dev/null || true

# Iniciar
pm2 start ecosystem.config.js
pm2 save
echo "✅ PM2 configurado"

# ── 8. Nginx ────────────────────────────────────────────────
echo "🌐 Configurando Nginx..."
cat > /etc/nginx/sites-available/activopos << EOF
server {
    listen 80;
    server_name activopos.com www.activopos.com;

    location / {
        proxy_pass http://localhost:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    # Archivos estáticos con cache
    location /_next/static {
        proxy_pass http://localhost:${APP_PORT};
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    client_max_body_size 10M;
}
EOF

# Activar sitio
ln -sf /etc/nginx/sites-available/activopos /etc/nginx/sites-enabled/activopos

# Test y reload
nginx -t && systemctl reload nginx
echo "✅ Nginx configurado"

# ── 9. Verificación final ───────────────────────────────────
echo ""
echo "============================================"
echo "✅ ACTIVOPOS SETUP COMPLETO"
echo "============================================"
echo "🌐 URL:    http://activopos.com"
echo "🔌 Puerto: ${APP_PORT}"
echo "🗄️  DB:     ${DB_NAME}"
echo "📧 Admin:  admin@activopos.com"
echo "🔑 Pass:   admin123"
echo ""
echo "Comandos útiles:"
echo "  pm2 logs activopos        → ver logs"
echo "  pm2 restart activopos     → reiniciar"
echo "  pm2 status                → estado"
echo ""
echo "⚠️  IMPORTANTE: Cambia la contraseña del admin después del primer login"
echo "============================================"

# Test rápido
sleep 3
curl -s http://localhost:${APP_PORT}/api/rates/bcv | grep -q "rate" && \
  echo "🟢 BCV API respondiendo correctamente" || \
  echo "🔴 BCV API no responde — revisar logs: pm2 logs activopos"
