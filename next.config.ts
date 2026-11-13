import type { NextConfig } from "next";
import { FIRST_SHOP_SLUG, SHOP_PAGES } from "./lib/paths";

const nextConfig: NextConfig = {
  // Before shops, the comptoir's pages were at the root (/inventaire…):
  // bookmarks and old links still lead there.
  async redirects() {
    return SHOP_PAGES.map((page) => ({
      source: `/${page}/:path*`,
      destination: `/${FIRST_SHOP_SLUG}/${page}/:path*`,
      permanent: false,
    }));
  },
};

export default nextConfig;
