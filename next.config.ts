/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '84race.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Fix CORS issue in development
  allowedDevOrigins: ['http://127.0.2.2'],
}

module.exports = nextConfig