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
      DATABASE_URL: 'mysql://root@127.0.0.1:3306/activopos',
      DB_HOST: '127.0.0.1',
      DB_USER: 'root',
      DB_PASSWORD: '',
      DB_NAME: 'activopos',
      DB_POOL: '5',
      // JWT_SECRET NO va aquí — es secreto, vive solo en /var/www/activopos/.env
      // (gitignored). Next.js lo carga de .env en runtime; auth.ts lo lee fail-closed.
      // Ponerlo en este bloque lo inyecta vía pm2 y ADEMÁS lo trackea en git.
      NEXT_PUBLIC_APP_URL: 'https://activopos.com',
      BCV_API_URL: 'https://ve.dolarapi.com/v1/dolares/oficial',
      BCV_FALLBACK_RATE: '36.50'
    }
  }]
}
