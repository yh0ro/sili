import type { NextConfig } from "next";
import path from 'node:path';

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  webpack(config, { webpack }) {
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^cloudflare:workers$/,
      path.resolve('lib/silicon/cloudflare-unavailable.ts')));
    return config;
  },
};

export default nextConfig;
