import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Defaults to `.next`, so nothing changes for anyone. It exists so a
  // production build can be run while `next dev` is up: they share `.next`
  // otherwise, and a build underneath a running dev server corrupts it and
  // takes the browser down with it.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Dev only, and it sat in the bottom left corner, on top of the sidebar's
  // own footer: the account row and Sign out were behind it and hard to press
  // while testing. Nothing about the built app changes.
  devIndicators: { position: "bottom-right" },
  // The import parsers are Node libraries, not bundle candidates. pdf-parse in
  // particular carries pdfjs, which resolves its worker at runtime and breaks
  // when webpack rewrites those paths.
  serverExternalPackages: ["pdf-parse", "exceljs", "mammoth", "@react-pdf/renderer"],
  experimental: {
    // Partner / admin document uploads allow up to 25MB. Prefer browser →
    // Supabase for large signed copies; this limit covers remaining FormData
    // server actions so Next does not return a opaque body-size failure.
    serverActions: { bodySizeLimit: "25mb" },
  },
  async redirects() {
    return [
      { source: "/modules/whitbyos", destination: "/whitbyos", permanent: false },
      { source: "/modules/whitbyos/:path*", destination: "/whitbyos/:path*", permanent: false },
      { source: "/modules/client-portal", destination: "/client-portal", permanent: false },
      { source: "/modules/client-portal/:path*", destination: "/client-portal/:path*", permanent: false },
      // `/modules/academy` is the Brent marketing module page — do not redirect it.
      { source: "/modules/partner-center", destination: "/partner-center", permanent: false },
      { source: "/modules/partner-center/:path*", destination: "/partner-center/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
