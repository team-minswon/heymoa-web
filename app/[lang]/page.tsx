import type { Metadata } from "next";

import { LandingClient } from "@/components/heymoa/landing-client";
import { marketingLocale } from "@/lib/i18n/current";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata(await marketingLocale(), "/");
}

export default function Home() {
  return <LandingClient />;
}
