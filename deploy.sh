#!/bin/bash
# ============================================================
# ACTIVOPOS — Deploy / Update
# Ejecutar cuando hay cambios nuevos en el repo
# bash deploy.sh
# ============================================================

set -e
APP_DIR="/var/www/activopos"
echo "🚀 ActivoPOS — Deploy iniciando..."

cd $APP_DIR

# 1. Pull cambios
echo "📥 Descargando cambios..."
git pull origin main

# 2. Instalar nuevas dependencias si las hay
echo "📦 Verificando dependencias..."
npm install --production=false

# 3. Migraciones nuevas si las hay
echo "🗄️  Aplicando migraciones..."
npx prisma migrate deploy
npx prisma generate

# 4. Build
echo "🔨 Compilando..."
npm run build

# 5. Restart PM2
echo "♻️  Reiniciando servicio..."
pm2 restart activopos

# 6. Verificar
sleep 2
pm2 status activopos
curl -s http://localhost:3001/api/rates/bcv | grep -q "rate" && \
  echo "🟢 Deploy exitoso — ActivoPOS corriendo" || \
  echo "🔴 Error — revisar: pm2 logs activopos"
