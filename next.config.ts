/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  
  // Ignore les erreurs TypeScript pendant le build
  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      { protocol: "https", hostname: "pokeapi.co" },
      { protocol: "https", hostname: "pokedaily.unyxdev.cloud" },
    ],
  },
};

export default nextConfig;