/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: '/uploads/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000' }],
      },
      {
        // Headers de seguridad en todas las rutas.
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          // camera=(self), NO camera=() — el escaner de codigo de barras del POS
          // usa getUserMedia desde el mismo origen; allowlist vacia lo bloquea.
          { key: 'Permissions-Policy',        value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.activopos.com' }],
        destination: 'https://activopos.com/:path*',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
