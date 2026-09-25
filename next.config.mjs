/** @type {import('next').NextConfig} */
const nextConfig = {
  // "/aycapp" in prod, empty locally. Baked in at build time — rebuild after changing.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
};

export default nextConfig;
