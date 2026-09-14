import { ArrowUpRight } from "@/components/ArrowUpRight/ArrowUpRight";
import { aboutParagraphs, brandStatement } from "@/data/about";
import { contact } from "@/lib/site";

import styles from "./AboutPanel.module.css";

/**
 * A `tel:` href only for a number that is actually a number. A masked
 * placeholder stays plain text rather than becoming a link that dials
 * nothing; the real number turns into a link by itself, dialled as the digits
 * of the displayed string and written down nowhere else.
 */
function telHref(phone: string): string | null {
  if (/[a-z]/i.test(phone)) return null;
  const dialable = phone.replace(/[^\d+]/g, "");
  return /^\+?\d{8,15}$/.test(dialable) ? `tel:${dialable}` : null;
}

/**
 * The top editorial surface: statement, About copy and contact.
 *
 * Desktop is two tracks — statement | About — and the contact details belong
 * to the LEFT one: they sit under the statement as its small footer, pushed
 * to the bottom of the section so their last line lands on the same baseline
 * as the last line of the About copy. The section therefore closes on one
 * edge, left and right, and there is no separate contact row beneath it.
 * Stacked, the order is simply statement, About, contact.
 *
 * One surface, not cards — the columns exist only as grid tracks, with no
 * borders or backgrounds of their own. The contact block is the page's sign-off
 * and has one primary action — the email, large, with phone and location as a
 * quiet line beneath it.
 *
 * The left track carries the brand statement. It is the page's h1: real
 * approved copy, set as type. There is deliberately NO typographic "FLANK"
 * here — the official wordmark already appears in the header and again in the
 * black panel below, and a third, fake one would read as an alternative logo
 * treatment.
 */
export function AboutPanel() {
  const phoneHref = telHref(contact.phone);

  return (
    <section className={styles.panel} aria-labelledby="about-heading">
      <h1 id="about-heading" className={styles.statement}>
        {brandStatement.map((line) => (
          <span key={line} className={styles.statementLine}>
            {line}
          </span>
        ))}
      </h1>

      <div className={styles.body}>
        {aboutParagraphs.map((paragraph, i) => (
          <p key={i} className={styles.paragraph}>
            {paragraph}
          </p>
        ))}
      </div>

      <div className={styles.contact}>
        {/* Names the block and nothing more: small, uppercase, and a long way
            below the email it introduces. */}
        <h2 className={styles.contactHeading}>Contact</h2>

        <address className={styles.contactItems}>
          {/* The one action on the page, set as an editorial row rather than
              a button: the address large, a light outbound mark at the end of
              the line, and a hairline under both. */}
          <a className={styles.contactEmail} href={`mailto:${contact.email}`}>
            <span className={styles.contactEmailText}>{contact.email}</span>
            <span className={styles.contactArrow} aria-hidden="true">
              <ArrowUpRight />
            </span>
          </a>

          {/* Secondary metadata, at the About copy's own size. Location is
              informational, so it is text and not a link. */}
          <p className={styles.contactMeta}>
            {phoneHref ? (
              <a className={styles.contactPhone} href={phoneHref}>
                {contact.phone}
              </a>
            ) : (
              <span>{contact.phone}</span>
            )}
            <span className={styles.contactSeparator} aria-hidden="true">
              ·
            </span>
            <span>{contact.location}</span>
          </p>
        </address>
      </div>
    </section>
  );
}
