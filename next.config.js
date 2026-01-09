/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  webpack: (config) => {
    // StackBlitz/WebContainer can fail when webpack tries to write filesystem cache
    // into .next/cache. Turn that off.
    config.cache = false;
    return config;
  },
};

module.exports = nextConfig;
