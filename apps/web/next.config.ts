import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // The contracts package ships TypeScript source and is consumed directly by
  // the app, so Next must compile it rather than expect a built artifact.
  transpilePackages: ['@repo/contracts'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default config;
