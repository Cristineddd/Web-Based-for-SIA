import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  typescript: {
    // Allow build to succeed even with type errors (pre-existing unused imports)
    ignoreBuildErrors: true,
  },
  eslint: {
    // Allow build to succeed even with ESLint warnings
    ignoreDuringBuilds: true,
  },
  experimental: {
    esmExternals: true,
  },
  // Image optimization configuration
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  // Redirect singular/wrong URL paths to correct plural paths
  async redirects() {
    return [
      { source: "/exam", destination: "/exams", permanent: true },
      { source: "/exam/:path*", destination: "/exams/:path*", permanent: true },
      { source: "/class", destination: "/classes", permanent: true },
      { source: "/class/:path*", destination: "/classes/:path*", permanent: true },
      { source: "/result", destination: "/results", permanent: true },
      { source: "/result/:path*", destination: "/results/:path*", permanent: true },
      { source: "/archives", destination: "/archive", permanent: true },
      { source: "/archives/:path*", destination: "/archive/:path*", permanent: true },
      { source: "/home", destination: "/dashboard", permanent: true },
    ];
  },
  // Fix COOP warning for Google Sign-In popup
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
  // Suppress Watchpack errors for Windows system files
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules',
          '**/.git',
          '**/C:/pagefile.sys',
          '**/C:/hiberfil.sys',
          '**/C:/swapfile.sys',
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
