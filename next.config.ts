import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keeps the dev overlay out of visual QA screenshots.
  devIndicators: false,

  /**
   * There is one Bohinj project, and it is the portrait one.
   *
   * The 16:9 cut of the same spec used to be a second project at /work/bohinj.
   * It is no longer active work, but the URL it minted should not simply die:
   * a visitor who kept that link is looking for Bohinj, and Bohinj still
   * exists. So the old slug resolves to the canonical one rather than 404ing,
   * and the portrait project keeps its own slug, its own media directory and
   * its own identity untouched.
   */
  redirects() {
    return Promise.resolve([
      {
        source: "/work/bohinj",
        destination: "/work/bohinj-vertical",
        permanent: true,
      },
    ]);
  },
};

export default nextConfig;
