/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  
  // Ignore les erreurs TypeScript pendant le build
  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;