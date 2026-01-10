/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  webpack: (config) => {
    // WebContainer can fail when webpack tries to write filesystem cache into .next/cache
    config.cache = false;

    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ];

    return config;
  },
};

module.exports = nextConfig;
