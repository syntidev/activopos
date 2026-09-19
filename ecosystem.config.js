module.exports = {
  apps: [{
    name: 'activopos',
    script: 'node_modules/.bin/next',
    args: 'start',
    cwd: '/var/www/activopos',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3003,
      // DATABASE_URL / DB_HOST / DB_USER / DB_PASSWORD / DB_NAME / DB_POOL / JWT_SECRET
      // NO van aquí — son secretos, viven solo en /var/www/activopos/.env (gitignored).
      // Next.js los carga de .env en runtime; prisma.ts y auth.ts los leen fail-closed.
      // Ponerlos en este bloque los inyecta vía pm2 (pisando .env) y ADEMÁS los trackea en git.
      NEXT_PUBLIC_APP_URL: 'https://activopos.com',
      BCV_API_URL: 'https://ve.dolarapi.com/v1/dolares/oficial',
      BCV_FALLBACK_RATE: '36.50'
    }
  }]
}
