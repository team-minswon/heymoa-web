import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { lang } from "next/root-params";

import { LandingClient } from "@/components/heymoa/landing-client";
import { marketingLocale } from "@/lib/i18n/current";
import { isLocale } from "@/lib/i18n/locales";
import { localizedMetadata } from "@/lib/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata(await marketingLocale(), "/");
}

export const dynamic = "force-static";

export default async function Home() {
  if (!isLocale(await lang())) notFound();
  return <LandingClient />;
}
