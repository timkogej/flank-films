import Link from "next/link";

import { CookieSettingsButton } from "./CookieSettingsButton";

import styles from "./LegalFooter.module.css";

export function LegalFooter() {
  return (
    <footer className={styles.footer} aria-label="Legal">
      <Link href="/privacy" className={styles.link}>
        Privacy
      </Link>
      <CookieSettingsButton />
    </footer>
  );
}
