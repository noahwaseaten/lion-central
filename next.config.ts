import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack doesn't infer it from stray lockfiles
  // elsewhere on the machine.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
