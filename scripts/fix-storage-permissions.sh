#!/bin/bash
# ActivoPOS — Fix permisos directorio storage (tenant-scoped uploads)
# Ejecutar en el VPS después de cada deploy si hay problemas de upload.
#
# Path real: storage/tenants/<businessId>/<type> en la RAIZ del proyecto
# (src/app/api/upload/image/route.ts -> join(process.cwd(), 'storage', 'tenants', ...))
# NO es public/storage ni public/uploads (esa es la carpeta legacy de
# scripts/setup-uploads.sh, path distinto, no tocar).
# Servido por Nginx via alias /storage/ -> este directorio (fuera del repo, config en el VPS).

NODE_USER=$(pm2 jlist | python3 -c "import sys,json; procs=json.load(sys.stdin); print(procs[0]['pm2_env']['username'])" 2>/dev/null || echo "www-data")

STORAGE_PATH="/var/www/activopos/storage"

mkdir -p "$STORAGE_PATH/tenants"

echo "Aplicando permisos en $STORAGE_PATH para usuario $NODE_USER"
chown -R "$NODE_USER:$NODE_USER" "$STORAGE_PATH"
chmod -R 755 "$STORAGE_PATH"
find "$STORAGE_PATH" -type d -exec chmod 775 {} \;

echo "✅ Permisos aplicados"
