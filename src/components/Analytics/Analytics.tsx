"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

import {
  ANALYTICS_CONSENT_EVENT,
  ANALYTICS_READY_EVENT,
  GA_MEASUREMENT_ID,
  analyticsHostEnabled,
  readAnalyticsConsent,
  setAnalyticsConsent,
  trackEvent,
  type AnalyticsConsent,
} from "@/lib/analytics";
import { aboutSeo, site, social } from "@/lib/site";

import styles from "./Analytics.module.css";

const noSubscription = () => () => {};
const hydratedSnapshot = () => true;
const serverHydratedSnapshot = () => false;
const serverConsentSnapshot = () => null;

function subscribeToConsent(onStoreChange: () => void): () => void {
  window.addEventListener(ANALYTICS_CONSENT_EVENT, onStoreChange);
  return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, onStoreChange);
}

function PageViews() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  const send = useCallback(() => {
    if (
      !pathname ||
      pathname.startsWith("/work/") ||
      lastPath.current === pathname ||
      window.__flankAnalyticsConsent !== "granted" ||
      !window.__flankAnalyticsReady
    ) {
      return;
    }

    lastPath.current = pathname;
    window.gtag?.("event", "page_view", {
      page_location: new URL(pathname, site.url).href,
      page_path: pathname,
      page_title:
        pathname === "/"
          ? site.title
          : pathname === "/about"
            ? `${aboutSeo.title} — ${site.legalName}`
            : document.title,
    });
  }, [pathname]);

  useEffect(() => {
    send();
    window.addEventListener(ANALYTICS_READY_EVENT, send);
    return () => window.removeEventListener(ANALYTICS_READY_EVENT, send);
  }, [send]);

  return null;
}

function BusinessEventTracking() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;

      const projectSlug = anchor.dataset.projectSlug;
      const projectName = anchor.dataset.projectName;
      const projectPosition = Number(anchor.dataset.projectPosition);
      if (projectSlug && projectName && Number.isInteger(projectPosition)) {
        trackEvent({
          name: "project_open",
          parameters: {
            project_slug: projectSlug,
            project_name: projectName,
            project_position: projectPosition,
          },
        });
        return;
      }

      if (anchor.protocol === "mailto:") {
        trackEvent({ name: "contact_email_click" });
        return;
      }
      if (anchor.protocol === "tel:") {
        trackEvent({ name: "phone_click" });
        return;
      }

      const href = anchor.href.replace(/\/$/, "");
      if (href === social.instagram.replace(/\/$/, "")) {
        trackEvent({ name: "instagram_click" });
      } else if (href === social.linkedin.replace(/\/$/, "")) {
        trackEvent({ name: "linkedin_click" });
      }
    };

    // Capture sees Next links before the router prevents their native default.
    // One document listener also means responsive duplicate markup can never
    // register duplicate handlers.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}

export function Analytics() {
  const hydrated = useSyncExternalStore(
    noSubscription,
    hydratedSnapshot,
    serverHydratedSnapshot,
  );
  const choice = useSyncExternalStore<AnalyticsConsent | null>(
    subscribeToConsent,
    readAnalyticsConsent,
    serverConsentSnapshot,
  );
  const loadGoogle = choice === "granted" && analyticsHostEnabled();

  const decide = (next: AnalyticsConsent) => {
    // The update is queued before rendering can request or configure gtag.js.
    setAnalyticsConsent(next);
  };

  const initialize = () => {
    if (window.__flankAnalyticsReady || !window.gtag) return;
    window.gtag("js", new Date());
    window.gtag("config", GA_MEASUREMENT_ID, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      ...(process.env.NEXT_PUBLIC_FLANK_ANALYTICS_DEBUG === "true"
        ? { debug_mode: true }
        : {}),
    });
    window.__flankAnalyticsReady = true;
    window.dispatchEvent(new Event(ANALYTICS_READY_EVENT));
  };

  return (
    <>
      {loadGoogle && (
        <Script
          id="flank-ga4"
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
          onLoad={initialize}
        />
      )}
      <PageViews />
      <BusinessEventTracking />

      {hydrated && choice === null && (
        <section className={styles.banner} aria-label="Analytics consent">
          <p className={styles.copy}>
            We use analytics to understand how people use this site and improve
            the experience.
          </p>
          <div className={styles.actions}>
            <button type="button" onClick={() => decide("granted")}>
              Accept
            </button>
            <button type="button" onClick={() => decide("denied")}>
              Decline
            </button>
          </div>
        </section>
      )}
    </>
  );
}
