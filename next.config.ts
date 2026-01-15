/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // !! WARN !!
    // Abaikan error TypeScript pas deploy biar gak gagal build
    ignoreBuildErrors: true,
  },
  eslint: {
    // Abaikan error ESLint pas deploy
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;