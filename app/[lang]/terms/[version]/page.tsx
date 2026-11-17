import {
  ArchivedLegalPage,
  archivedLegalMetadata,
  archivedParams,
} from "@/app/[lang]/legal-document";

export const dynamic = "force-static";
export const dynamicParams = false;
export const generateStaticParams = () => archivedParams("terms");

type Props = { params: Promise<{ version: string }> };

export async function generateMetadata({ params }: Props) {
  return archivedLegalMetadata("terms", (await params).version);
}

export default async function ArchivedTermsPage({ params }: Props) {
  return ArchivedLegalPage({ doc: "terms", version: (await params).version });
}
