import {
  ArchivedLegalPage,
  archivedLegalMetadata,
  archivedParams,
} from "@/app/[lang]/legal-document";

/** 이전 판 고정 주소(`/terms/2026-10-22`). 판 목록은 `lib/legal-archive.ts`. */
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
