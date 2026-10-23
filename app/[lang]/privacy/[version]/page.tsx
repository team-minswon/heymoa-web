import {
  ArchivedLegalPage,
  archivedLegalMetadata,
  archivedParams,
} from "@/app/[lang]/legal-document";

/** 이전 판 고정 주소(`/privacy/2026-10-22`). 판 목록은 `lib/legal-archive.ts`. */
export const dynamic = "force-static";
export const dynamicParams = false;
export const generateStaticParams = () => archivedParams("privacy");

type Props = { params: Promise<{ version: string }> };

export async function generateMetadata({ params }: Props) {
  return archivedLegalMetadata("privacy", (await params).version);
}

export default async function ArchivedPrivacyPage({ params }: Props) {
  return ArchivedLegalPage({ doc: "privacy", version: (await params).version });
}
