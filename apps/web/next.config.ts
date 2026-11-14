import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@henseng/core", "@henseng/db", "@henseng/wallet"],
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  turbopack: {
    resolveAlias: Object.fromEntries(
      [
        "@x402/core/client",
        "@x402/core/schemas",
        "@x402/core/server",
        "@x402/evm",
        "@x402/evm/auth-capture/client",
        "@x402/evm/batch-settlement/client",
        "@x402/evm/exact/client",
        "@x402/evm/exact/server",
        "@x402/evm/exact/v1/client",
        "@x402/evm/upto/client",
        "@x402/evm/upto/server",
        "@x402/express",
        "@x402/extensions/bazaar",
        "@x402/extensions/builder-code",
        "@x402/fetch",
        "@x402/svm/exact/client",
        "@x402/svm/exact/server",
        "@x402/svm/exact/v1/client",
        "@x402/svm/upto/client",
        "@x402/svm/upto/server",
      ].map((m) => [
        m,
        "./stubs/empty-module.js",
      ]),
    ),
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default config;
