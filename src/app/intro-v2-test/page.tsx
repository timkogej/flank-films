import type { Metadata } from "next";

import { FlankIntroV2Prototype } from "@/components/IntroV2/FlankIntroV2Prototype";

/**
 * DEVELOPMENT-ONLY visual test route for the Intro V2 prototype.
 *
 * Not linked from the header, the homepage, About or any project route, and
 * `noindex, nofollow` so it cannot be found from outside. Nothing on the site
 * imports anything under `src/components/IntroV2`, so deleting this file and
 * that folder removes the prototype completely.
 *
 * The production intro is untouched and still owns `/`.
 */
export const metadata: Metadata = {
  title: "Intro V2 prototype",
  robots: { index: false, follow: false },
};

export default function IntroV2TestPage() {
  return <FlankIntroV2Prototype />;
}
