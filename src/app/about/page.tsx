import type { Metadata } from "next";

import { AboutPanel } from "@/components/About/AboutPanel";
import { FlankLightPanel } from "@/components/About/FlankLightPanel";
import { VisualPanel } from "@/components/About/VisualPanel";
import { Header } from "@/components/Header/Header";
import { DarkLightIntro } from "@/components/IntroDarkLight/DarkLightIntro";
import { aboutSeo, site } from "@/lib/site";
import { StructuredData } from "@/lib/structuredData";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: aboutSeo.title,
  description: aboutSeo.description,
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    type: "website",
    siteName: site.legalName,
    title: `${aboutSeo.title} — ${site.legalName}`,
    description: aboutSeo.description,
    url: "/about",
    images: [site.socialImage],
  },
  twitter: {
    card: "summary_large_image",
    title: `${aboutSeo.title} — ${site.legalName}`,
    description: aboutSeo.description,
    images: [site.socialImage],
  },
};

/**
 * About + Contact.
 *
 * One page, three zones: the existing header, one editorial surface carrying
 * both the About copy and the contact details, and a paired visual section.
 *
 * The lower pair is a single DOM order reordered by CSS: on desktop the FLANK
 * light panel sits left of the visual, on mobile the visual comes first and the
 * FLANK panel becomes the closing brand moment.
 *
 * Wrapped in the SAME intro as the homepage — one component, one
 * configuration. It plays only when this page is the document the browser
 * loaded (a direct visit or a refresh), and the real About page is what rises
 * over it. Arriving here by navigating inside the site renders the page
 * directly, with no curtain at all. See DarkLightIntro's `entrance`.
 */
export default function AboutPage() {
  return (
    <>
      <StructuredData page="about" />
      <DarkLightIntro>
        <div className={styles.shell}>
          <Header current="about" />
          <main className={styles.main}>
            <AboutPanel />
            <section className={styles.visuals} aria-label="FLANK">
              <FlankLightPanel />
              <VisualPanel />
            </section>
          </main>
        </div>
      </DarkLightIntro>
    </>
  );
}
