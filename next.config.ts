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
  allowedDevOrigins: ['http://127.0.2.2', 'http://localhost:3000'],
}

module.exports = nextConfig