"use client";

import { resetAnalyticsConsent } from "@/lib/analytics";

import styles from "./LegalFooter.module.css";

export function CookieSettingsButton() {
  const reopen = () => {
    resetAnalyticsConsent();
    requestAnimationFrame(() => {
      document.getElementById("analytics-consent-accept")?.focus();
    });
  };

  return (
    <button type="button" className={styles.link} onClick={reopen}>
      Cookie settings
    </button>
  );
}
