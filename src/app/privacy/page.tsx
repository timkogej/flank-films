import type { Metadata } from "next";

import { Header } from "@/components/Header/Header";
import { LegalFooter } from "@/components/Legal/LegalFooter";
import { contact, privacySeo, site } from "@/lib/site";
import { StructuredData } from "@/lib/structuredData";

import styles from "./page.module.css";

const title = privacySeo.title + " — " + site.name;
const description = privacySeo.description;

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/privacy" },
  openGraph: {
    type: "website",
    siteName: site.name,
    title,
    description,
    url: "/privacy",
    images: [site.socialImage],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [site.socialImage],
  },
};

export default function PrivacyPage() {
  return (
    <>
      <StructuredData page="privacy" />
      <div className={styles.shell} data-framed-shell="neutral">
        <Header current={null} />
        <main className={styles.panel}>
          <div className={styles.heading}>
            <p className={styles.eyebrow}>FLANK FILMS</p>
            <h1>Privacy &amp; Legal</h1>
            <p className={styles.updated}>Last updated 5 October 2026</p>
          </div>

          <div className={styles.content}>
            <section aria-labelledby="who-we-are">
              <h2 id="who-we-are">Who we are</h2>
              <p>
                FLANK FILMS is the public brand operated by Lan Lamut s.p.,
                Flank Films, a registered business in Slovenia. The business is
                responsible for the personal data described on this page. Its
                registered details appear under Legal information below.
              </p>
            </section>

            <section aria-labelledby="contact">
              <h2 id="contact">Contact</h2>
              <p>
                For privacy questions or requests, email{" "}
                <a href={"mailto:" + contact.email}>{contact.email}</a> or call{" "}
                <a href={"tel:" + contact.telephone}>{contact.phone}</a>.
              </p>
            </section>

            <section aria-labelledby="information">
              <h2 id="information">Information we process</h2>
              <p>
                When you visit this site, technical request information may be
                processed to deliver and protect it. This can include an IP
                address, network and browser or device information, requested
                pages, timestamps, and diagnostic or security logs. If you
                consent to Analytics, the additional information described
                below may be processed. If you contact us by email or phone, we
                process the details and message you choose to provide so we can
                respond. There is no contact form on this site.
              </p>
            </section>

            <section aria-labelledby="hosting">
              <h2 id="hosting">Website hosting</h2>
              <p>
                Vercel hosts and delivers this website. It may process technical
                request, network and diagnostic information for delivery,
                security and troubleshooting. More information is available in{" "}
                <a href="https://vercel.com/legal/privacy-notice">
                  Vercel&apos;s Privacy Notice
                </a>.
              </p>
            </section>

            <section aria-labelledby="analytics">
              <h2 id="analytics">Google Analytics 4</h2>
              <p>
                We use Google Analytics 4 (GA4) to understand use of this site.
                Normal Analytics collection is not enabled before you choose
                Accept. Accept grants analytics storage; Decline keeps it
                denied. Advertising storage, advertising user data and ad
                personalisation remain denied in both cases. We do not use GA4
                here for advertising or personalisation.
              </p>
              <p>
                After consent, GA4 may receive page views and selected site
                interactions, such as opening a project or using an email,
                phone or social link. The data may include page URLs, event
                names, approximate location, device and browser information,
                and online identifiers. We do not intentionally send names,
                email addresses, phone numbers or message content to GA4.
                Google explains its processing in the{" "}
                <a href="https://policies.google.com/privacy">
                  Google Privacy Policy
                </a>.
              </p>
            </section>

            <section aria-labelledby="cookies">
              <h2 id="cookies">Cookies and consent choices</h2>
              <p>
                With Analytics consent, GA4 may set first-party cookies such
                as <code>_ga</code> and <code>_ga_&lt;container-id&gt;</code> to
                distinguish visits and sessions. Cookie lifetime can vary
                with Google&apos;s settings and browser behaviour. This site
                saves your Accept or Decline choice in your browser&apos;s
                local storage. That choice is separate from GA4 cookies.
              </p>
              <p>
                Use Cookie settings in the legal row on Home, About or this
                page to withdraw consent or choose again. Opening it immediately changes
                Analytics consent to denied, removes the saved choice and
                attempts to delete the site&apos;s accessible <code>_ga</code>{" "}
                cookies; the Accept / Decline choice then reappears. A later
                Decline is saved and respected after reload. Withdrawal does
                not undo processing that occurred while consent was valid.
              </p>
            </section>

            <section aria-labelledby="legal-bases">
              <h2 id="legal-bases">Why we process data</h2>
              <p>
                Analytics relies on your consent. Website delivery, security
                and troubleshooting rely, where applicable, on our legitimate
                interest in operating a reliable site. We handle enquiries to
                respond to your request, including steps towards a possible
                contract where relevant, or for legitimate business
                communication. We may also process or retain information when
                required by law.
              </p>
            </section>

            <section aria-labelledby="retention">
              <h2 id="retention">How long information is kept</h2>
              <p>
                The current GA4 property settings retain event-level data for
                2 months and user-level data for 14 months. &ldquo;Reset on new
                activity&rdquo; is enabled for user-level data, so a new event
                can restart that user identifier&apos;s retention period.
                These settings do not set the lifetime of every cookie or
                standard aggregated report. Hosting logs are subject to the
                provider&apos;s applicable retention practices. Business
                correspondence is kept for as long as reasonably needed for
                the enquiry, relationship or applicable legal obligations.
              </p>
            </section>

            <section aria-labelledby="providers">
              <h2 id="providers">Service providers and transfers</h2>
              <p>
                Vercel provides hosting and Google provides Analytics after
                consent. Their services may involve processing outside the
                European Economic Area. Where a transfer requires a safeguard,
                an applicable adequacy decision or Standard Contractual
                Clauses may be used, depending on the provider and transfer.
                We do not assume that every request is processed in one
                country. The providers&apos; linked notices describe their
                current arrangements.
              </p>
            </section>

            <section aria-labelledby="rights">
              <h2 id="rights">Your rights</h2>
              <p>
                Subject to applicable conditions, you may request access to,
                rectification or erasure of your personal data, restriction
                of processing, or data portability. You may object to
                processing based on legitimate interests and withdraw
                Analytics consent at any time through Cookie settings.
                Contact us using the details above to exercise these rights.
              </p>
              <p>
                You may also complain to the{" "}
                <a href="https://www.ip-rs.si/en/">
                  Information Commissioner of the Republic of Slovenia
                  (Informacijski pooblaščenec)
                </a>, the Slovenian data protection supervisory authority.
              </p>
            </section>

            <section aria-labelledby="security">
              <h2 id="security">Security</h2>
              <p>
                We use appropriate measures and service providers to help
                protect information handled through this site. No online
                service can promise absolute security.
              </p>
            </section>

            <section aria-labelledby="external-links">
              <h2 id="external-links">External links</h2>
              <p>
                Links to Instagram, LinkedIn and other external websites take
                you to services with their own privacy practices. Their
                policies apply when you use those services.
              </p>
            </section>

            <section aria-labelledby="legal-information">
              <h2 id="legal-information">Legal information</h2>
              <dl className={styles.details}>
                <div><dt>Public brand</dt><dd>FLANK FILMS</dd></div>
                <div><dt>Operated by</dt><dd>Lan Lamut s.p., Flank Films</dd></div>
                <div>
                  <dt>Registered address</dt>
                  <dd>Fužine 134<br />1241 Kamnik<br />Slovenia</dd>
                </div>
                <div><dt>Registration number</dt><dd>7418043000</dd></div>
                <div><dt>Tax number</dt><dd>42668328</dd></div>
                <div><dt>VAT status</dt><dd>Not registered for VAT</dd></div>
                <div><dt>Registration date</dt><dd>14 January 2026</dd></div>
                <div><dt>Registered activity</dt><dd>Film and video activities</dd></div>
                <div><dt>Founder</dt><dd>Lan Lamut</dd></div>
                <div>
                  <dt>Email</dt>
                  <dd><a href={"mailto:" + contact.email}>{contact.email}</a></dd>
                </div>
                <div>
                  <dt>Telephone</dt>
                  <dd><a href={"tel:" + contact.telephone}>{contact.phone}</a></dd>
                </div>
                <div>
                  <dt>Website</dt>
                  <dd><a href={site.url}>{site.url}</a></dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby="intellectual-property">
              <h2 id="intellectual-property">Intellectual property</h2>
              <p>
                FLANK FILMS branding, site copy and content we own may be
                protected by intellectual property rights. Client and
                third-party names and trademarks belong to their respective
                owners. Project films and images may contain material owned
                by clients or other parties. Nothing on this site grants a
                licence to use any of these materials unless expressly stated.
              </p>
            </section>

            <section aria-labelledby="changes">
              <h2 id="changes">Changes to this page</h2>
              <p>
                We may update this information when our site, services or
                legal obligations change. The date above shows when this page
                was last updated.
              </p>
            </section>
          </div>
        </main>
        <LegalFooter />
      </div>
    </>
  );
}
