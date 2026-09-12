import { aboutParagraphs, brandStatement, contact } from "@/data/about";

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
 * borders or backgrounds of their own. Contact is editorial metadata (small
 * label, plain value), not a call to action.
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

      <address className={styles.contact}>
        <div className={styles.contactItem}>
          <span className={styles.contactLabel}>Email</span>
          <a className={styles.contactValue} href={`mailto:${contact.email}`}>
            {contact.email}
          </a>
        </div>
        <div className={styles.contactItem}>
          <span className={styles.contactLabel}>Phone</span>
          {phoneHref ? (
            <a className={styles.contactValue} href={phoneHref}>
              {contact.phone}
            </a>
          ) : (
            <span className={styles.contactValue}>{contact.phone}</span>
          )}
        </div>
      </address>
    </section>
  );
}
