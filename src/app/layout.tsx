import type { Metadata, Viewport } from "next";

import { brandFontClassName } from "@/styles/fonts";
import { site, SITE_ROOT_ID } from "@/lib/site";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: site.legalName,
    template: `%s — ${site.legalName}`,
  },
  description: site.description,
  openGraph: {
    type: "website",
    siteName: site.legalName,
    title: site.legalName,
    description: site.description,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "FLANK FILMS wordmark",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: site.legalName,
    description: site.description,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "FLANK FILMS wordmark",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
  colorScheme: "light",
  /**
   * Required for `env(safe-area-inset-*)` to report anything at all — without
   * it a notched device keeps the insets at zero and the browser letterboxes
   * the page instead.
   *
   * Safe because every surface that reaches an edge resolves its own padding
   * as `max(design value, inset)`: on a device with no insets every one of
   * those is unchanged to the pixel, and on a notched one nothing lands under
   * the notch or the home indicator.
   */
  viewportFit: "cover",
};

/**
 * `modal` is the parallel slot that holds an intercepted project film.
 *
 * It renders as a SIBLING of the page, not inside it, which is what makes the
 * whole behaviour work: on a client-side navigation to /work/[slug] the page
 * in `children` is left exactly as it was — scrolled where it was, previews
 * where they were — and the film opens above it. On a hard load the slot falls
 * back to its `default`, which is nothing, and `children` takes the URL — for
 * /work/[slug] that currently means a redirect to the homepage, since
 * standalone project pages are not part of this launch.
 *
 * The wrapper carries an id so the viewer can make everything behind it inert
 * with a single attribute. It has no styles of its own and changes nothing
 * about either page inside it.
 */
export default function RootLayout({
  children,
  modal,
}: Readonly<{ children: React.ReactNode; modal: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={brandFontClassName}>
        <div id={SITE_ROOT_ID}>{children}</div>
        {modal}
      </body>
    </html>
  );
}
