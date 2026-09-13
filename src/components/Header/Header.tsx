import Image from "next/image";
import Link from "next/link";

import { MobileNav } from "./MobileNav";
import { pages, socialLinks, type PageKey } from "@/lib/site";

import styles from "./Header.module.css";

/**
 * Compact editorial header.
 *
 * Two headers share one element and one wordmark. Above 700px the four links
 * are on the bar — HOME, ABOUT & CONTACT, then the two accounts — exactly as
 * they have always been. Below it those groups are hidden and `MobileNav`'s
 * two marks take the bar instead, because four links at phone width is the
 * compression the redesign exists to remove.
 *
 * The wordmark belongs to neither group. It is positioned absolutely against
 * the header box and offset by -50% of its own width, so it sits on the true
 * geometric centre of the viewport however wide the side groups become — or
 * whether they are there at all. Nothing in the phone bar or the phone panel
 * touches it.
 *
 * `current` marks the active route — carried by tone and weight only, with
 * `aria-current` doing the semantic work. Passed as a prop rather than read
 * from `usePathname()` so this stays a server component; only the phone menu,
 * which needs state, is a client island.
 */
export function Header({ current = "home" }: { current?: PageKey }) {
  const navLink = (page: PageKey) =>
    `${styles.link} ${page === current ? styles.linkCurrent : styles.linkInactive}`;

  return (
    <header className={styles.header}>
      <nav className={styles.left} aria-label="Primary">
        {pages.map((page) => (
          <Link
            key={page.key}
            href={page.href}
            className={navLink(page.key)}
            aria-current={page.key === current ? "page" : undefined}
          >
            {page.label}
          </Link>
        ))}
      </nav>

      <MobileNav current={current} />

      <Link href="/" className={styles.logo} aria-label="FLANK — home">
        <Image
          src="/brand/flank-wordmark-black.svg"
          alt="FLANK"
          width={1499}
          height={226}
          priority
          className={styles.logoMark}
        />
      </Link>

      <nav className={styles.social} aria-label="Social">
        {socialLinks.map((link) => (
          <a
            key={link.key}
            className={styles.link}
            href={link.href}
            target="_blank"
            rel="noreferrer noopener"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
