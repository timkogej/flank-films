import { aboutSeo, contact, site, social } from "@/lib/site";

type StructuredDataPage = "home" | "about";

const homeUrl = `${site.url}/`;

const ids = {
  organization: `${homeUrl}#organization`,
  website: `${homeUrl}#website`,
  homePage: `${homeUrl}#webpage`,
  aboutPage: `${site.url}/about#webpage`,
} as const;

function absoluteUrl(path: string): string {
  return new URL(path, homeUrl).href;
}

function createGraph(page: StructuredDataPage) {
  const organization = {
    "@type": "Organization",
    "@id": ids.organization,
    name: site.legalName,
    url: homeUrl,
    description: site.entityDescription,
    logo: absoluteUrl(site.logo),
    image: absoluteUrl(site.socialImage.url),
    email: `mailto:${contact.email}`,
    telephone: contact.telephone,
    address: {
      "@type": "PostalAddress",
      addressCountry: contact.countryCode,
    },
    sameAs: [social.instagram, social.linkedin],
  };

  const website = {
    "@type": "WebSite",
    "@id": ids.website,
    url: homeUrl,
    name: site.legalName,
    publisher: { "@id": ids.organization },
    inLanguage: "en",
  };

  const webPage =
    page === "home"
      ? {
          "@type": "WebPage",
          "@id": ids.homePage,
          url: homeUrl,
          name: site.title,
          description: site.description,
          isPartOf: { "@id": ids.website },
          about: { "@id": ids.organization },
          inLanguage: "en",
        }
      : {
          "@type": "AboutPage",
          "@id": ids.aboutPage,
          url: `${site.url}/about`,
          name: `${aboutSeo.title} — ${site.legalName}`,
          description: aboutSeo.description,
          isPartOf: { "@id": ids.website },
          about: { "@id": ids.organization },
          mainEntity: { "@id": ids.organization },
          inLanguage: "en",
        };

  return {
    "@context": "https://schema.org",
    "@graph": [organization, website, webPage],
  };
}

function serializeStructuredData(page: StructuredDataPage): string {
  return JSON.stringify(createGraph(page)).replace(/</g, "\\u003c");
}

export function StructuredData({ page }: { page: StructuredDataPage }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeStructuredData(page) }}
    />
  );
}
