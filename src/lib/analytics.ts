import { site } from "@/lib/site";

/**
 * FLANK's public analytics configuration and tiny event boundary.
 *
 * A GA measurement ID is public by design, so keeping it here is clearer than
 * making deployment depend on an environment variable. This is its only
 * source of truth.
 */
export const GA_MEASUREMENT_ID = "G-X7F9MDB3PE";
export const ANALYTICS_HOSTNAME = new URL(site.url).hostname;
export const ANALYTICS_CONSENT_KEY = "flank.analytics-consent";

export type AnalyticsConsent = "granted" | "denied";

export const ANALYTICS_CONSENT_EVENT = "flank:analytics-consent";
export const ANALYTICS_READY_EVENT = "flank:analytics-ready";

export const deniedConsent = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
} as const;

export const grantedAnalyticsConsent = {
  ...deniedConsent,
  analytics_storage: "granted",
} as const;

type AnalyticsEvent =
  | {
      name: "project_open";
      parameters: {
        project_slug: string;
        project_name: string;
        project_position: number;
      };
    }
  | { name: "contact_email_click" }
  | { name: "phone_click" }
  | { name: "instagram_click" }
  | { name: "linkedin_click" };

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
    __flankAnalyticsConsent?: AnalyticsConsent;
    __flankAnalyticsReady?: boolean;
  }
}

export function analyticsHostEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.location.hostname === ANALYTICS_HOSTNAME ||
    process.env.NEXT_PUBLIC_FLANK_ANALYTICS_DEBUG === "true"
  );
}

export function readAnalyticsConsent(): AnalyticsConsent | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return stored === "granted" || stored === "denied" ? stored : null;
  } catch {
    return window.__flankAnalyticsConsent ?? null;
  }
}

function clearAnalyticsCookies(): void {
  if (typeof document === "undefined") return;

  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=", 1)[0]?.trim();
    if (name !== "_ga" && !name?.startsWith("_ga_")) continue;

    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.${ANALYTICS_HOSTNAME}; SameSite=Lax`;
  }
}

export function setAnalyticsConsent(choice: AnalyticsConsent): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, choice);
  } catch {
    // Consent still applies for this document if storage is unavailable.
  }

  window.__flankAnalyticsConsent = choice;
  if (choice === "denied") clearAnalyticsCookies();
  window.gtag?.(
    "consent",
    "update",
    choice === "granted" ? grantedAnalyticsConsent : deniedConsent,
  );
  window.dispatchEvent(
    new CustomEvent<AnalyticsConsent>(ANALYTICS_CONSENT_EVENT, {
      detail: choice,
    }),
  );
}

/** A future Cookie settings control can call this and reopen the chooser. */
export function resetAnalyticsConsent(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(ANALYTICS_CONSENT_KEY);
  } catch {
    // The in-memory state below still reopens the chooser for this document.
  }

  window.__flankAnalyticsConsent = undefined;
  clearAnalyticsCookies();
  window.gtag?.("consent", "update", deniedConsent);
  window.dispatchEvent(
    new CustomEvent<null>(ANALYTICS_CONSENT_EVENT, { detail: null }),
  );
}

export function trackEvent(event: AnalyticsEvent): void {
  if (
    typeof window === "undefined" ||
    window.__flankAnalyticsConsent !== "granted" ||
    !window.__flankAnalyticsReady ||
    !window.gtag
  ) {
    return;
  }

  try {
    window.gtag("event", event.name, "parameters" in event ? event.parameters : {});
  } catch {
    // Analytics must never interrupt the interaction being measured.
  }
}
