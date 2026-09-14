import {
  ANALYTICS_CONSENT_KEY,
  deniedConsent,
  grantedAnalyticsConsent,
} from "@/lib/analytics";

/**
 * Runs before any interactive application code. It always establishes the
 * conservative Consent Mode defaults first, then restores a saved decision.
 * The Google tag itself is loaded later, and only for granted consent.
 */
export function ConsentBootstrap() {
  const source = `
window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function gtag(){window.dataLayer.push(arguments);};
window.gtag("consent", "default", ${JSON.stringify(deniedConsent)});
try {
  var flankConsent = window.localStorage.getItem(${JSON.stringify(ANALYTICS_CONSENT_KEY)});
  if (flankConsent === "granted" || flankConsent === "denied") {
    window.__flankAnalyticsConsent = flankConsent;
    window.gtag("consent", "update", flankConsent === "granted" ? ${JSON.stringify(grantedAnalyticsConsent)} : ${JSON.stringify(deniedConsent)});
  }
} catch (error) {}
`;

  return (
    <script
      id="flank-consent-defaults"
      dangerouslySetInnerHTML={{ __html: source }}
    />
  );
}
