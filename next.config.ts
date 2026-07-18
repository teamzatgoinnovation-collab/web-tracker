import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@zatgo/ui",
    "@zatgo/sdk",
    "@zatgo/auth",
    "@zatgo/erpnext",
    "@zatgo/icons",
    "@zatgo/utils",
    "@zatgo/types",
  ],
};

export default nextConfig;
