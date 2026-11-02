import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // The standalone /customers and /suppliers pages were replaced by /contacts.
    return [
      { source: "/customers", destination: "/contacts", permanent: true },
      { source: "/customers/new", destination: "/contacts", permanent: true },
      { source: "/suppliers", destination: "/contacts", permanent: true },
      { source: "/suppliers/new", destination: "/contacts", permanent: true },
    ];
  },
};

export default nextConfig;
