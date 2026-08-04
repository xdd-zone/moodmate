import path from "node:path";
import { fileURLToPath } from "node:url";

const adminDirectory = path.dirname(fileURLToPath(import.meta.url));
const apiWranglerDirectory = path.resolve(adminDirectory, "../api/.wrangler");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  webpack(config, { dev }) {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [apiWranglerDirectory],
      };
    }

    return config;
  },
};

export default nextConfig;
