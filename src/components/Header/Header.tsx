import Image from "next/image";
import Link from "next/link";

import { social } from "@/lib/site";

import styles from "./Header.module.css";

/**
 * Compact editorial header.
 *
 * The wordmark is positioned absolutely against the header box and offset by
 * -50% of its own width, so it sits on the true geometric centre of the
 * viewport no matter how wide the left or right navigation groups become.
 *
 * `current` marks the active route — carried by tone and weight only, with
 * `aria-current` doing the semantic work. Passed as a prop rather than read
 * from `usePathname()` so the header stays a server component with no client
 * JS.
 */
export function Header({ current = "home" }: { current?: "home" | "about" }) {
  const navLink = (page: "home" | "about") =>
    `${styles.link} ${page === current ? styles.linkCurrent : styles.linkInactive}`;

  return (
    <header className={styles.header}>
      <nav className={styles.left} aria-label="Primary">
        <Link
          href="/"
          className={navLink("home")}
          aria-current={current === "home" ? "page" : undefined}
        >
          Home
        </Link>
        <Link
          href="/about"
          className={navLink("about")}
          aria-current={current === "about" ? "page" : undefined}
        >
          About &amp; Contact
        </Link>
      </nav>

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
        <a
          className={styles.link}
          href={social.instagram}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="FLANK on Instagram"
        >
          <span className={styles.labelFull}>Instagram</span>
          <span className={styles.labelShort} aria-hidden="true">
            IG
          </span>
        </a>
        <a
          className={styles.link}
          href={social.linkedin}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="FLANK on LinkedIn"
        >
          <span className={styles.labelFull}>LinkedIn</span>
          <span className={styles.labelShort} aria-hidden="true">
            LI
          </span>
        </a>
      </nav>
    </header>
  );
}
