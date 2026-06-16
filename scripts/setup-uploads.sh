#!/usr/bin/env bash
# Correr UNA vez en VPS para crear la carpeta de uploads con permisos correctos
mkdir -p /var/www/activopos/public/uploads/products
chown -R www-data:www-data /var/www/activopos/public/uploads
chmod -R 755 /var/www/activopos/public/uploads
echo "✅ Carpeta uploads lista con permisos correctos"
