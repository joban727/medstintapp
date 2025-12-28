import type { NextConfig } from "next"
// Force rebuild 3again 2

const nextConfig: NextConfig = {
  // Keep parity with prior JS config for build resilience
  typescript: {
    // ignoreBuildErrors: false, // Default
  },
  // Note: eslint config removed - no longer supported in Next.js 16
  // Use eslint.config.js or .eslintrc for ESLint configuration
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  generateEtags: true,

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
    formats: ["image/webp", "image/avif"],
    minimumCacheTTL: 60,
  },

  // Experimental features for better performance
  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
  },

  // Turbopack configuration (moved from experimental)
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },

  // Transpile packages that need client-side processing
  transpilePackages: ["framer-motion"],

  // Headers for security and performance
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
        ],
      },
    ]
  },

  // Webpack optimizations
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      }
    }

    // Handle client-side only libraries
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push({
        "framer-motion": "framer-motion",
      })
    }

    return config
  },
}

export default nextConfig
