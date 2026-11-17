import { CurrentLegalPage, currentLegalMetadata } from "@/app/[lang]/legal-document";

export const dynamic = "force-static";

export const generateMetadata = () => currentLegalMetadata("terms");

export default async function TermsPage() {
  return CurrentLegalPage({ doc: "terms" });
}
